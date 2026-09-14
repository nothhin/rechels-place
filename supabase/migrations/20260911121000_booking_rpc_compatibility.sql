-- Keep older deployed clients safe during the rolling frontend deployment.
create or replace function public.submit_snowaz_booking_request(
  request_idempotency uuid, guest_name text, guest_email text, guest_phone text,
  arrival date, departure date, guests integer, bedroom_selection text, requests text,
  contact_method text, consent_version text, token_hash text, parking_selection text
)
returns table(booking_id uuid, booking_reference text, deposit_expires_at timestamptz)
language sql security definer set search_path='' as $$
  select * from public.submit_snowaz_booking_request(request_idempotency,guest_name,guest_email,guest_phone,
    arrival,departure,guests,bedroom_selection,requests,contact_method,consent_version,token_hash,parking_selection,0,0)
$$;
revoke all on function public.submit_snowaz_booking_request(uuid,text,text,text,date,date,integer,text,text,text,text,text,text) from public;
grant execute on function public.submit_snowaz_booking_request(uuid,text,text,text,date,date,integer,text,text,text,text,text,text) to anon,authenticated;

create or replace function public.submit_snowaz_booking_request(
  request_idempotency uuid, guest_name text, guest_email text, guest_phone text,
  arrival date, departure date, guests integer, requests text, contact_method text,
  consent_version text, token_hash text
)
returns table(booking_id uuid, booking_reference text, deposit_expires_at timestamptz)
language sql security definer set search_path='' as $$
  select * from public.submit_snowaz_booking_request(request_idempotency,guest_name,guest_email,guest_phone,
    arrival,departure,guests,case when guests<=2 then 'bedroom_1' else 'bedroom_2' end,requests,
    contact_method,consent_version,token_hash,'none',0,0)
$$;
revoke all on function public.submit_snowaz_booking_request(uuid,text,text,text,date,date,integer,text,text,text,text) from public;
grant execute on function public.submit_snowaz_booking_request(uuid,text,text,text,date,date,integer,text,text,text,text) to anon,authenticated;

create or replace function public.update_snowaz_pending_guest_count(token_hash text,guests integer,bedroom_selection text,parking_selection text)
returns boolean language plpgsql security definer set search_path='' as $$
declare early_hours integer; late_hours integer;
begin
  select b.early_check_in_hours,b.late_checkout_hours into early_hours,late_hours
  from public.booking_requests b where b.deposit_token_hash=token_hash limit 1;
  return public.update_snowaz_pending_guest_count(token_hash,guests,bedroom_selection,parking_selection,
    coalesce(early_hours,0),coalesce(late_hours,0));
end $$;
revoke all on function public.update_snowaz_pending_guest_count(text,integer,text,text) from public,authenticated;
grant execute on function public.update_snowaz_pending_guest_count(text,integer,text,text) to anon;
