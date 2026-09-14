drop trigger if exists queue_snowaz_booking_lifecycle_notification on public.booking_requests;

create or replace function private.pause_snowaz_email_notification() returns trigger language plpgsql set search_path='' as $$
begin
  if new.channel='email' then new.status:='cancelled'; new.last_error:='Email notifications are paused by the property owner.'; end if;
  return new;
end $$;
drop trigger if exists pause_snowaz_email_notification on public.booking_notifications;
create trigger pause_snowaz_email_notification before insert on public.booking_notifications for each row execute function private.pause_snowaz_email_notification();

do $$
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname='snowaz-arrival-reminders';
  end if;
end $$;

update public.booking_notifications
set status='cancelled',last_error='Email notifications are paused by the property owner.'
where channel='email' and status='queued';

comment on function private.queue_snowaz_booking_lifecycle_notification() is 'Retained for a future email-notification rollout; its trigger is intentionally disabled.';
