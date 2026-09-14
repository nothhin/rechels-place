create type deposit_status as enum (
  'not_requested', 'awaiting_payment', 'submitted', 'verified',
  'refund_pending', 'refunded', 'partially_withheld', 'forfeited'
);

alter table public.booking_requests
  add column deposit_status deposit_status not null default 'not_requested',
  add column deposit_amount_minor bigint not null default 100000,
  add column deposit_token_hash text,
  add column deposit_token_expires_at timestamptz,
  add column deposit_sender_name text,
  add column deposit_reference text,
  add column deposit_submitted_at timestamptz,
  add column deposit_verified_at timestamptz,
  add column deposit_refund_reference text,
  add column deposit_refunded_at timestamptz;

create unique index booking_requests_deposit_token_hash_unique
  on public.booking_requests(deposit_token_hash)
  where deposit_token_hash is not null;

alter table public.booking_requests
  add constraint booking_requests_deposit_amount_positive check (deposit_amount_minor > 0),
  add constraint booking_requests_deposit_submission_complete check (
    deposit_status not in ('submitted', 'verified', 'refund_pending', 'refunded', 'partially_withheld', 'forfeited')
    or (deposit_sender_name is not null and deposit_reference is not null and deposit_submitted_at is not null)
  ),
  add constraint booking_requests_deposit_verified_complete check (
    deposit_status not in ('verified', 'refund_pending', 'refunded', 'partially_withheld', 'forfeited')
    or deposit_verified_at is not null
  ),
  add constraint booking_requests_deposit_refunded_complete check (
    deposit_status <> 'refunded'
    or (deposit_refund_reference is not null and deposit_refunded_at is not null)
  );

create or replace function private.sync_snowaz_booking_calendar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_id uuid := coalesce(new.id, old.id);
begin
  delete from public.snowaz_calendar_ranges where source_kind = 'booking_request' and source_id = target_id;
  if tg_op <> 'DELETE' and new.source = 'snowaz_guest_web' and new.status in ('pending', 'contacted', 'confirmed') then
    insert into public.snowaz_calendar_ranges
      values ('booking_request', new.id, new.check_in, new.check_out, case when new.status = 'confirmed' then 'booked' else 'pending' end);
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function private.sync_snowaz_booking_calendar() from public, anon, authenticated;
