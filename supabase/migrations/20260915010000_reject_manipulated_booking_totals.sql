-- A client estimate is a display aid only. If it is present, it must match
-- the server calculation before a new booking can be inserted.

create or replace function public.submit_snowaz_booking_request_v2(
  request_idempotency uuid, guest_name text, guest_email text, guest_phone text,
  arrival date, departure date, guests integer, bedroom_selection text, requests text,
  contact_method text, consent_version text, token_hash text, parking_selection text,
  early_check_in_hours integer, late_checkout_hours integer,
  pricing_version text default null, client_total_minor bigint default null
)
returns table(
  booking_id uuid,
  booking_reference text,
  deposit_expires_at timestamptz,
  pricing_changed boolean,
  previous_total_minor bigint,
  current_total_minor bigint,
  current_pricing jsonb
)
language plpgsql security definer set search_path = ''
as $$
declare
  target_id uuid;
  expiry timestamptz := now() + interval '24 hours';
  nights integer;
  calculation record;
  existing public.booking_requests%rowtype;
  current_version text;
begin
  if request_idempotency is null
    or guest_name is null or char_length(trim(guest_name)) not between 2 and 120
    or guest_phone is null or char_length(trim(guest_phone)) not between 7 and 30
    or char_length(trim(coalesce(guest_email, ''))) > 254
    or (trim(coalesce(guest_email, '')) <> '' and position('@' in guest_email) < 2)
    or contact_method not in ('whatsapp', 'messenger', 'phone', 'email')
    or guests not between 1 and 6
    or bedroom_selection not in ('bedroom_1', 'bedroom_2', 'both_bedrooms')
    or (bedroom_selection = 'bedroom_1' and guests > 2)
    or parking_selection not in ('none', 'car', 'motorcycle')
    or early_check_in_hours not between 0 and 5
    or late_checkout_hours not between 0 and 5
    or departure <= arrival
    or arrival < current_date
    or departure > current_date + 366
    or consent_version <> 'booking-request-v2'
    or token_hash is null or char_length(token_hash) <> 64
    or char_length(coalesce(requests, '')) > 1000
    or (client_total_minor is not null and client_total_minor < 0)
  then
    raise exception 'invalid booking request';
  end if;

  select * into existing
  from public.booking_requests
  where idempotency_key = request_idempotency;
  if found then
    return query select existing.id,
      'RECHEL-' || upper(substr(replace(existing.id::text, '-', ''), 1, 8)),
      existing.deposit_token_expires_at, false, client_total_minor,
      existing.total_minor, null::jsonb;
    return;
  end if;

  if exists (
    select 1 from public.snowaz_calendar_ranges r
    where r.check_in < departure and r.check_out > arrival
  ) or exists (
    select 1 from public.property_date_blocks x
    where x.status = 'active' and x.check_in < departure and x.check_out > arrival
  ) then
    raise exception 'dates unavailable';
  end if;

  nights := departure - arrival;
  select * into calculation
  from private.snowaz_booking_price(
    guests, bedroom_selection, parking_selection,
    early_check_in_hours, late_checkout_hours, nights
  );
  current_version := coalesce((select max(revision)::text from public.snowaz_price_settings where active), '0');

  -- A revision mismatch or a client total mismatch both require a fresh
  -- review. Neither case is allowed to create a booking with stale data.
  if nullif(trim(coalesce(pricing_version, '')), '') is not null
    and trim(pricing_version) <> current_version
  then
    return query select null::uuid, null::text, null::timestamptz, true,
      client_total_minor, calculation.total_minor, private.snowaz_public_pricing_payload();
    return;
  end if;
  if client_total_minor is not null and client_total_minor <> calculation.total_minor then
    return query select null::uuid, null::text, null::timestamptz, true,
      client_total_minor, calculation.total_minor, private.snowaz_public_pricing_payload();
    return;
  end if;

  insert into public.booking_requests(
    idempotency_key, full_name, normalized_email, phone, preferred_contact,
    check_in, check_out, guest_count, bedroom_choice, stay_nights,
    base_nightly_rate_minor, additional_guest_count, additional_guest_charge_minor,
    parking_type, parking_nightly_rate_minor, parking_charge_minor,
    early_check_in_hours, early_check_in_time, early_check_in_fee_minor,
    late_checkout_hours, late_checkout_time, late_checkout_fee_minor,
    accommodation_subtotal_minor, extras_total_minor, total_minor,
    down_payment_amount_minor, special_requests, status, source, consent_version,
    deposit_status, deposit_amount_minor, deposit_token_hash, deposit_token_expires_at
  ) values (
    request_idempotency, trim(guest_name), coalesce(lower(nullif(trim(guest_email), '')), ''),
    trim(guest_phone), contact_method, arrival, departure, guests, bedroom_selection,
    nights, calculation.base_nightly_rate_minor, calculation.additional_guest_count,
    calculation.additional_guest_charge_minor, parking_selection,
    calculation.parking_nightly_rate_minor, calculation.parking_charge_minor,
    calculation.early_check_in_hours, calculation.early_check_in_time,
    calculation.early_check_in_fee_minor, calculation.late_checkout_hours,
    calculation.late_checkout_time, calculation.late_checkout_fee_minor,
    calculation.accommodation_subtotal_minor, calculation.extras_total_minor,
    calculation.total_minor, calculation.down_payment_amount_minor,
    nullif(trim(coalesce(requests, '')), ''), 'pending', 'guest_web', consent_version,
    'awaiting_payment', calculation.deposit_amount_minor, token_hash, expiry
  ) on conflict (idempotency_key) do nothing
  returning id into target_id;

  if target_id is null then
    select * into existing from public.booking_requests where idempotency_key = request_idempotency;
    return query select existing.id,
      'RECHEL-' || upper(substr(replace(existing.id::text, '-', ''), 1, 8)),
      existing.deposit_token_expires_at, false, client_total_minor,
      existing.total_minor, null::jsonb;
    return;
  end if;

  return query select target_id,
    'RECHEL-' || upper(substr(replace(target_id::text, '-', ''), 1, 8)),
    expiry, false, client_total_minor, calculation.total_minor, null::jsonb;
end;
$$;

revoke all on function public.submit_snowaz_booking_request_v2(
  uuid, text, text, text, date, date, integer, text, text, text, text, text,
  text, integer, integer, text, bigint
) from public;
grant execute on function public.submit_snowaz_booking_request_v2(
  uuid, text, text, text, date, date, integer, text, text, text, text, text,
  text, integer, integer, text, bigint
) to anon, authenticated;
