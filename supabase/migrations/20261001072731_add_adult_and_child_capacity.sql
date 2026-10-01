-- Rechel's Place accommodates up to six adults plus three children. Keep the
-- combined guest_count for existing pricing/calendar consumers while storing
-- the occupancy breakdown as the authoritative booking snapshot.

alter table public.booking_requests
  add column adult_count integer,
  add column child_count integer;

update public.booking_requests
set adult_count = guest_count,
    child_count = 0;

alter table public.booking_requests
  alter column adult_count set not null,
  alter column adult_count set default 1,
  alter column child_count set not null,
  alter column child_count set default 0;

alter table public.booking_requests
  drop constraint if exists booking_requests_valid_guest_count,
  add constraint booking_requests_valid_guest_count check (guest_count between 1 and 9),
  add constraint booking_requests_valid_adult_count check (adult_count between 1 and 6),
  add constraint booking_requests_valid_child_count check (child_count between 0 and 3),
  add constraint booking_requests_occupancy_total_matches check (guest_count = adult_count + child_count);

alter table public.booking_requests
  drop constraint if exists booking_requests_bedroom_capacity_valid,
  add constraint booking_requests_bedroom_capacity_valid check (
    (bedroom_choice = 'bedroom_1' and guest_count between 1 and 2) or
    (bedroom_choice = 'bedroom_2' and guest_count between 1 and 6) or
    (bedroom_choice = 'both_bedrooms' and guest_count between 1 and 9)
  );

update public.room_types
set max_adults = 6,
    max_children = 3,
    updated_at = now()
where slug = 'uppadar-entire-condo';

create or replace function private.snowaz_booking_price(
  p_guests integer,
  p_bedroom_selection text,
  p_parking_selection text,
  p_early_check_in_hours integer,
  p_late_checkout_hours integer,
  p_nights integer
)
returns table(
  base_nightly_rate_minor bigint,
  nightly_rate_minor bigint,
  additional_guest_count integer,
  additional_guest_charge_minor bigint,
  parking_nightly_rate_minor bigint,
  parking_charge_minor bigint,
  early_check_in_hours integer,
  early_check_in_time time,
  early_check_in_fee_minor bigint,
  late_checkout_hours integer,
  late_checkout_time time,
  late_checkout_fee_minor bigint,
  accommodation_subtotal_minor bigint,
  extras_total_minor bigint,
  total_minor bigint,
  down_payment_amount_minor bigint,
  deposit_amount_minor bigint
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  base_rate bigint;
  nightly_rate bigint;
  additional_count integer;
  additional_charge bigint;
  parking_rate bigint;
  parking_charge bigint;
  early_fee bigint;
  late_fee bigint;
  accommodation bigint;
  extras bigint;
  total bigint;
  down_payment bigint;
  security_deposit bigint;
begin
  if p_guests not between 1 and 9
    or p_bedroom_selection not in ('bedroom_1', 'bedroom_2', 'both_bedrooms')
    or (p_bedroom_selection = 'bedroom_1' and p_guests > 2)
    or p_parking_selection not in ('none', 'car', 'motorcycle')
    or p_early_check_in_hours not between 0 and 5
    or p_late_checkout_hours not between 0 and 5
    or p_nights < 1
  then
    raise exception 'invalid booking price inputs';
  end if;

  if p_bedroom_selection = 'both_bedrooms' then
    base_rate := private.snowaz_price_amount('whole_condo_nightly_rate');
    nightly_rate := base_rate;
    additional_count := 0;
  elsif p_bedroom_selection = 'bedroom_1' then
    base_rate := private.snowaz_price_amount('master_bedroom_nightly_rate');
    nightly_rate := base_rate;
    additional_count := 0;
  else
    base_rate := private.snowaz_price_amount('second_bedroom_nightly_rate');
    additional_count := greatest(p_guests - 2, 0);
    if p_guests <= 2 then
      nightly_rate := base_rate;
    elsif p_guests = 3 then
      nightly_rate := private.snowaz_price_amount('second_bedroom_3_guest_nightly_rate');
    else
      nightly_rate := private.snowaz_price_amount('second_bedroom_4_guest_nightly_rate')
        + greatest(p_guests - 4, 0) * private.snowaz_price_amount('additional_guest_fee');
    end if;
  end if;

  parking_rate := case p_parking_selection
    when 'car' then private.snowaz_price_amount('car_parking_nightly_rate')
    when 'motorcycle' then private.snowaz_price_amount('motorcycle_parking_nightly_rate')
    else 0
  end;
  parking_charge := parking_rate * p_nights;
  additional_charge := greatest(nightly_rate - base_rate, 0) * p_nights;
  early_fee := p_early_check_in_hours * private.snowaz_price_amount('early_checkin_hourly_rate');
  late_fee := p_late_checkout_hours * private.snowaz_price_amount('late_checkout_hourly_rate');
  accommodation := base_rate * p_nights + additional_charge;
  extras := parking_charge + early_fee + late_fee;
  total := accommodation + extras;
  down_payment := ceil(total::numeric * private.snowaz_price_percentage('down_payment_percent') / 100)::bigint;
  security_deposit := private.snowaz_price_amount('refundable_security_deposit');

  if base_rate is null or nightly_rate is null or parking_rate is null
    or early_fee is null or late_fee is null or down_payment is null
    or security_deposit is null
  then
    raise exception 'pricing configuration is unavailable';
  end if;

  return query select
    base_rate, nightly_rate, additional_count, additional_charge,
    parking_rate, parking_charge, p_early_check_in_hours,
    case when p_early_check_in_hours > 0 then make_time(14 - p_early_check_in_hours, 0, 0) else null end,
    early_fee, p_late_checkout_hours,
    case when p_late_checkout_hours > 0 then make_time(11 + p_late_checkout_hours, 0, 0) else null end,
    late_fee, accommodation, extras, total, down_payment, security_deposit;
end;
$$;

revoke all on function private.snowaz_booking_price(integer,text,text,integer,integer,integer) from public, anon, authenticated;

create function public.submit_rechels_booking_request_v3(
  request_idempotency uuid, guest_name text, guest_email text, guest_phone text,
  arrival date, departure date, guests integer, adult_count integer, child_count integer,
  bedroom_selection text, requests text, contact_method text, consent_version text,
  token_hash text, parking_selection text, early_check_in_hours integer,
  late_checkout_hours integer, pricing_version text default null,
  client_total_minor bigint default null
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
    or adult_count not between 1 and 6
    or child_count not between 0 and 3
    or guests <> adult_count + child_count
    or guests not between 1 and 9
    or bedroom_selection <> 'both_bedrooms'
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

  select * into existing from public.booking_requests
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
  select * into calculation from private.snowaz_booking_price(
    guests, bedroom_selection, parking_selection,
    early_check_in_hours, late_checkout_hours, nights
  );
  current_version := coalesce((select max(revision)::text from public.snowaz_price_settings where active), '0');

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
    check_in, check_out, guest_count, adult_count, child_count, bedroom_choice, stay_nights,
    base_nightly_rate_minor, additional_guest_count, additional_guest_charge_minor,
    parking_type, parking_nightly_rate_minor, parking_charge_minor,
    early_check_in_hours, early_check_in_time, early_check_in_fee_minor,
    late_checkout_hours, late_checkout_time, late_checkout_fee_minor,
    accommodation_subtotal_minor, extras_total_minor, total_minor,
    down_payment_amount_minor, special_requests, status, source, consent_version,
    deposit_status, deposit_amount_minor, deposit_token_hash, deposit_token_expires_at
  ) values (
    request_idempotency, trim(guest_name), coalesce(lower(nullif(trim(guest_email), '')), ''),
    trim(guest_phone), contact_method, arrival, departure, guests, adult_count, child_count,
    bedroom_selection, nights, calculation.base_nightly_rate_minor,
    calculation.additional_guest_count, calculation.additional_guest_charge_minor,
    parking_selection, calculation.parking_nightly_rate_minor, calculation.parking_charge_minor,
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

revoke all on function public.submit_rechels_booking_request_v3(
  uuid,text,text,text,date,date,integer,integer,integer,text,text,text,text,text,
  text,integer,integer,text,bigint
) from public;
grant execute on function public.submit_rechels_booking_request_v3(
  uuid,text,text,text,date,date,integer,integer,integer,text,text,text,text,text,
  text,integer,integer,text,bigint
) to anon, authenticated;

create function public.update_rechels_pending_occupancy(
  token_hash text, guests integer, adult_count integer, child_count integer,
  bedroom_selection text, parking_selection text, early_hours integer, late_hours integer
)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  booking public.booking_requests%rowtype;
begin
  if adult_count not between 1 and 6
    or child_count not between 0 and 3
    or guests <> adult_count + child_count
    or guests not between 1 and 9
    or coalesce(bedroom_selection, '') <> 'both_bedrooms'
    or coalesce(parking_selection, '') <> 'none'
    or coalesce(early_hours, 0) <> 0
    or coalesce(late_hours, 0) <> 0
  then return false; end if;

  select * into booking from public.booking_requests
  where deposit_token_hash = token_hash
    and deposit_token_expires_at > now()
    and status in ('pending', 'contacted')
    and deposit_status in ('not_requested', 'awaiting_payment')
  for update;
  if not found then return false; end if;

  update public.booking_requests set
    guest_count = guests,
    adult_count = update_rechels_pending_occupancy.adult_count,
    child_count = update_rechels_pending_occupancy.child_count,
    bedroom_choice = 'both_bedrooms',
    updated_at = now()
  where id = booking.id;
  return true;
end;
$$;

revoke all on function public.update_rechels_pending_occupancy(text,integer,integer,integer,text,text,integer,integer) from public, authenticated;
grant execute on function public.update_rechels_pending_occupancy(text,integer,integer,integer,text,text,integer,integer) to anon;

drop function if exists public.get_snowaz_deposit_request(text);
create function public.get_snowaz_deposit_request(token_hash text)
returns table(
  booking_reference text, full_name text, email text, phone text,
  check_in date, check_out date, guest_count integer, adult_count integer,
  child_count integer, bedroom_choice text, parking_type text, stay_nights integer,
  base_nightly_rate_minor bigint, additional_guest_count integer,
  additional_guest_charge_minor bigint, parking_nightly_rate_minor bigint,
  parking_charge_minor bigint, early_check_in_hours integer, early_check_in_time time,
  early_check_in_fee_minor bigint, late_checkout_hours integer,
  late_checkout_time time, late_checkout_fee_minor bigint,
  accommodation_subtotal_minor bigint, extras_total_minor bigint, total_minor bigint,
  booking_status text, deposit_status text, down_payment_amount_minor bigint,
  deposit_amount_minor bigint, deposit_token_expires_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select
    'RECHEL-' || upper(substr(replace(b.id::text, '-', ''), 1, 8)),
    b.full_name, b.normalized_email, b.phone, b.check_in, b.check_out,
    b.guest_count, b.adult_count, b.child_count, b.bedroom_choice, b.parking_type,
    b.stay_nights, b.base_nightly_rate_minor, b.additional_guest_count,
    b.additional_guest_charge_minor, b.parking_nightly_rate_minor,
    b.parking_charge_minor, b.early_check_in_hours, b.early_check_in_time,
    b.early_check_in_fee_minor, b.late_checkout_hours, b.late_checkout_time,
    b.late_checkout_fee_minor, b.accommodation_subtotal_minor, b.extras_total_minor,
    b.total_minor, b.status::text, b.deposit_status::text,
    b.down_payment_amount_minor, b.deposit_amount_minor, b.deposit_token_expires_at
  from public.booking_requests b
  where b.deposit_token_hash = token_hash
    and b.deposit_token_expires_at > now()
  limit 1
$$;

revoke all on function public.get_snowaz_deposit_request(text) from public, authenticated;
grant execute on function public.get_snowaz_deposit_request(text) to anon, authenticated;

create function public.get_rechels_admin_dashboard_v2()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
  enriched jsonb;
begin
  if private.snowaz_staff_role() is null then raise exception 'not authorized'; end if;
  result := public.get_snowaz_admin_dashboard();
  select coalesce(jsonb_agg(entry.value || jsonb_build_object(
    'adultCount', b.adult_count,
    'childCount', b.child_count
  )), '[]'::jsonb)
  into enriched
  from jsonb_array_elements(coalesce(result->'enquiries', '[]'::jsonb)) entry
  join public.booking_requests b on b.id = (entry.value->>'id')::uuid;
  return jsonb_set(result, '{enquiries}', enriched, true);
end;
$$;

revoke all on function public.get_rechels_admin_dashboard_v2() from public, anon;
grant execute on function public.get_rechels_admin_dashboard_v2() to authenticated;

create function public.staff_get_rechels_operations_v2()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
  enriched jsonb;
begin
  if private.snowaz_staff_role() is null then raise exception 'not authorized'; end if;
  result := public.staff_get_snowaz_operations();
  select coalesce(jsonb_agg(entry.value || jsonb_build_object(
    'adultCount', b.adult_count,
    'childCount', b.child_count
  )), '[]'::jsonb)
  into enriched
  from jsonb_array_elements(coalesce(result->'bookings', '[]'::jsonb)) entry
  join public.booking_requests b on b.id = (entry.value->>'id')::uuid;
  return jsonb_set(result, '{bookings}', enriched, true);
end;
$$;

revoke all on function public.staff_get_rechels_operations_v2() from public, anon;
grant execute on function public.staff_get_rechels_operations_v2() to authenticated;
