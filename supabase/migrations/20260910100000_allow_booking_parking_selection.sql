-- Preserve the parking option selected in the booking request.
-- The provisional Uppadar function previously rejected every value except
-- none and always wrote zero parking charges.
drop function if exists public.submit_snowaz_booking_request(uuid,text,text,text,date,date,integer,text,text,text,text,text,text);

create or replace function public.submit_snowaz_booking_request(
  request_idempotency uuid, guest_name text, guest_email text, guest_phone text,
  arrival date, departure date, guests integer, bedroom_selection text, requests text,
  contact_method text, consent_version text, token_hash text, parking_selection text
)
returns table(booking_id uuid, booking_reference text, deposit_expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  target_id uuid;
  expiry timestamptz := now() + interval '24 hours';
  nights integer;
  base_rate bigint;
  extra_guests integer;
  extra_charge bigint;
  parking_rate bigint;
  parking_charge bigint;
  booking_total bigint;
begin
  if char_length(trim(guest_name)) not between 2 and 120
    or char_length(trim(guest_phone)) not between 7 and 30
    or char_length(trim(coalesce(guest_email,''))) > 254
    or (trim(coalesce(guest_email,'')) <> '' and position('@' in guest_email) < 2)
    or contact_method not in ('whatsapp','messenger','phone','email')
    or guests not between 1 and 8
    or bedroom_selection not in ('bedroom_1','bedroom_2','both_bedrooms')
    or (bedroom_selection = 'bedroom_1' and guests > 2)
    or (bedroom_selection = 'bedroom_2' and guests > 4)
    or parking_selection not in ('none','car','motorcycle')
    or departure <= arrival or arrival < current_date or departure > current_date + 366
    or consent_version <> 'booking-request-v2'
    or char_length(token_hash) <> 64
    or char_length(coalesce(requests,'')) > 1000
  then raise exception 'invalid booking request'; end if;

  if exists (
    select 1 from public.snowaz_calendar_ranges r
    where r.check_in < departure and r.check_out > arrival
  ) or exists (
    select 1 from public.property_date_blocks x
    where x.status = 'active' and x.check_in < departure and x.check_out > arrival
  ) then raise exception 'dates unavailable'; end if;

  nights := departure - arrival;
  base_rate := case when bedroom_selection in ('bedroom_1','bedroom_2') then 170000 else 220000 end;
  extra_guests := case when bedroom_selection in ('bedroom_1','bedroom_2') then greatest(guests - 2, 0) else 0 end;
  extra_charge := extra_guests * 25000;
  parking_rate := case when parking_selection = 'car' then 35000 when parking_selection = 'motorcycle' then 15000 else 0 end;
  parking_charge := parking_rate * nights;
  booking_total := (base_rate + extra_charge) * nights + parking_charge;

  insert into public.booking_requests(
    idempotency_key, full_name, normalized_email, phone, preferred_contact,
    check_in, check_out, guest_count, bedroom_choice, stay_nights,
    base_nightly_rate_minor, additional_guest_count, additional_guest_charge_minor,
    parking_type, parking_nightly_rate_minor, parking_charge_minor, total_minor,
    special_requests, status, source, consent_version, deposit_status,
    deposit_amount_minor, deposit_token_hash, deposit_token_expires_at
  ) values (
    request_idempotency, trim(guest_name), lower(nullif(trim(guest_email),'')), trim(guest_phone), contact_method,
    arrival, departure, guests, bedroom_selection, nights, base_rate, extra_guests, extra_charge,
    parking_selection, parking_rate, parking_charge, booking_total, nullif(trim(coalesce(requests,'')),''),
    'pending', 'guest_web', consent_version, 'awaiting_payment', least(100000, booking_total), token_hash, expiry
  ) on conflict (idempotency_key) do update set updated_at = now()
  returning id into target_id;

  return query select target_id, 'RECHEL-' || upper(substr(replace(target_id::text,'-',''),1,8)), expiry;
end;
$$;

revoke all on function public.submit_snowaz_booking_request(uuid,text,text,text,date,date,integer,text,text,text,text,text,text) from public;
grant execute on function public.submit_snowaz_booking_request(uuid,text,text,text,date,date,integer,text,text,text,text,text,text) to anon, authenticated;
