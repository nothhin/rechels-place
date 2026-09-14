alter table public.booking_notifications
  drop constraint if exists booking_notifications_notification_type_check;

alter table public.booking_notifications
  add constraint booking_notifications_notification_type_check check (
    notification_type in (
      'booking_received','deposit_submitted','booking_confirmed','booking_updated',
      'payment_recorded','payment_due','arrival_reminder','cancellation','refund'
    )
  );

alter table public.booking_notifications add column if not exists dedupe_key text;
create unique index if not exists booking_notifications_dedupe_key_idx
  on public.booking_notifications(dedupe_key) where dedupe_key is not null;

create or replace function private.queue_snowaz_booking_lifecycle_notification()
returns trigger language plpgsql security definer set search_path='' as $$
declare event_type text;
begin
  if nullif(trim(new.normalized_email),'') is null then return new; end if;
  if tg_op='INSERT' then
    event_type := 'booking_received';
  elsif new.deposit_status is distinct from old.deposit_status then
    event_type := case
      when new.deposit_status='submitted' then 'deposit_submitted'
      when new.deposit_status='verified' then 'booking_confirmed'
      when new.deposit_status='refunded' then 'refund'
      when new.deposit_status='refund_pending' then 'cancellation'
      else null end;
  elsif new.status is distinct from old.status and new.status in ('cancelled','declined') then
    event_type := 'cancellation';
  end if;
  if event_type is not null then
    insert into public.booking_notifications(
      booking_request_id,notification_type,recipient,channel,dedupe_key
    ) values (
      new.id,event_type,new.normalized_email,'email',event_type||':'||new.id::text
    ) on conflict (dedupe_key) where dedupe_key is not null do nothing;
  end if;
  return new;
end $$;

drop trigger if exists queue_snowaz_booking_lifecycle_notification on public.booking_requests;
create trigger queue_snowaz_booking_lifecycle_notification
after insert or update of status,deposit_status on public.booking_requests
for each row execute function private.queue_snowaz_booking_lifecycle_notification();

create or replace function private.queue_snowaz_arrival_reminders()
returns void language sql security definer set search_path='' as $$
  insert into public.booking_notifications(
    booking_request_id,notification_type,recipient,channel,dedupe_key
  )
  select b.id,'arrival_reminder',b.normalized_email,'email','arrival_reminder:'||b.id::text
  from public.booking_requests b
  where b.status='confirmed'
    and b.check_in=current_date+1
    and nullif(trim(b.normalized_email),'') is not null
  on conflict (dedupe_key) where dedupe_key is not null do nothing
$$;

revoke all on function private.queue_snowaz_arrival_reminders() from public,anon,authenticated;

do $$
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname='snowaz-arrival-reminders';
    perform cron.schedule('snowaz-arrival-reminders','0 0 * * *',
      'select private.queue_snowaz_arrival_reminders()');
  end if;
end $$;
