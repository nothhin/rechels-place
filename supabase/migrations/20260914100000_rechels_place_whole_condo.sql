-- Rechel's Place CDO is sold as one entire two-bedroom condo.
-- The Airbnb listing currently shows a reference rate of PHP 4,800 per night;
-- the host still confirms the final total for each requested date.

update public.resort_settings
set legal_name = 'Rechel''s Place',
    display_name = 'Rechel''s Place',
    address = '1229 Avida Aspira Tower 1, Cagayan de Oro, Philippines 9000',
    contact_email = 'rechel1977@hotmail.com',
    contact_phone = '(043) 109 8599',
    check_in_time = '14:00',
    check_out_time = '11:00',
    terms_version = 'rechels-place-v1',
    privacy_version = 'rechels-place-v1',
    updated_at = now()
where id = true;

update public.room_types
set name = 'Rechel''s Place · Entire condo',
    short_description = 'Private two-bedroom condo in Avida Aspira Tower 1 for up to 6 guests.',
    description = 'Entire condo with 2 bedrooms, 5 beds, 2.5 baths, 31 Mbps Wi-Fi, pool access, and keypad self check-in.',
    max_adults = 6,
    max_children = 0,
    bed_configuration = '[{"type":"queen","count":2},{"type":"sofa_bed","count":1},{"type":"bunk_bed","count":1},{"type":"floor_mattress","count":2}]'::jsonb,
    base_nightly_rate_minor = 480000,
    display_order = 10,
    status = 'published',
    updated_at = now()
where slug = 'uppadar-entire-condo';

update public.room_types
set status = 'archived', updated_at = now()
where slug in ('snowaz-condo-stay', 'uppadar-master-bedroom', 'uppadar-second-bedroom');

update public.rooms
set floor = 'Avida Aspira Tower 1', status = 'available', updated_at = now()
where room_number = 'RECHEL-ENTIRE-CONDO';

create or replace function public.submit_snowaz_booking_request(
  request_idempotency uuid, guest_name text, guest_email text, guest_phone text,
  arrival date, departure date, guests integer, bedroom_selection text, requests text,
  contact_method text, consent_version text, token_hash text, parking_selection text,
  early_check_in_hours integer, late_checkout_hours integer
)
returns table(booking_id uuid, booking_reference text, deposit_expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare
  target_id uuid;
  expiry timestamptz := now() + interval '24 hours';
  nights integer;
  base_rate bigint := 480000;
  booking_total bigint;
begin
  if char_length(trim(guest_name)) not between 2 and 120
    or char_length(trim(guest_phone)) not between 7 and 30
    or char_length(trim(coalesce(guest_email,''))) > 254
    or (trim(coalesce(guest_email,'')) <> '' and position('@' in guest_email) < 2)
    or contact_method not in ('whatsapp','messenger','phone','email')
    or guests not between 1 and 6
    or coalesce(bedroom_selection,'') <> 'both_bedrooms'
    or coalesce(parking_selection,'') <> 'none'
    or coalesce(early_check_in_hours,0) <> 0
    or coalesce(late_checkout_hours,0) <> 0
    or departure <= arrival
    or arrival < current_date
    or departure > current_date + 366
    or consent_version <> 'booking-request-v2'
    or char_length(token_hash) <> 64
    or char_length(coalesce(requests,'')) > 1000
  then raise exception 'invalid booking request'; end if;

  if exists(
    select 1 from public.snowaz_calendar_ranges r
    where r.check_in < departure and r.check_out > arrival
  ) or exists(
    select 1 from public.property_date_blocks x
    where x.status = 'active' and x.check_in < departure and x.check_out > arrival
  ) then raise exception 'dates unavailable'; end if;

  nights := departure - arrival;
  booking_total := base_rate * nights;

  insert into public.booking_requests(
    idempotency_key, full_name, normalized_email, phone, preferred_contact,
    check_in, check_out, guest_count, bedroom_choice, stay_nights,
    base_nightly_rate_minor, additional_guest_count, additional_guest_charge_minor,
    parking_type, parking_nightly_rate_minor, parking_charge_minor,
    early_check_in_hours, early_check_in_time, early_check_in_fee_minor,
    late_checkout_hours, late_checkout_time, late_checkout_fee_minor,
    accommodation_subtotal_minor, extras_total_minor, total_minor,
    special_requests, status, source, consent_version, deposit_status,
    deposit_amount_minor, deposit_token_hash, deposit_token_expires_at
  ) values (
    request_idempotency, trim(guest_name), lower(nullif(trim(guest_email),'')), trim(guest_phone), contact_method,
    arrival, departure, guests, 'both_bedrooms', nights, base_rate, 0, 0,
    'none', 0, 0, 0, null, 0, 0, null, 0, booking_total, 0, booking_total,
    nullif(trim(coalesce(requests,'')),''), 'pending', 'guest_web', consent_version,
    'awaiting_payment', least(100000, booking_total), token_hash, expiry
  ) on conflict(idempotency_key) do update set updated_at = now()
  returning id into target_id;

  return query select target_id, 'RECHEL-' || upper(substr(replace(target_id::text,'-',''),1,8)), expiry;
end $$;

revoke all on function public.submit_snowaz_booking_request(uuid,text,text,text,date,date,integer,text,text,text,text,text,text,integer,integer) from public;
grant execute on function public.submit_snowaz_booking_request(uuid,text,text,text,date,date,integer,text,text,text,text,text,text,integer,integer) to anon,authenticated;

create or replace function public.update_snowaz_pending_guest_count(
  token_hash text, guests integer, bedroom_selection text,
  parking_selection text, early_hours integer, late_hours integer
)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  booking public.booking_requests%rowtype;
  nights integer;
  base_rate bigint := 480000;
  accommodation bigint;
begin
  if guests not between 1 and 6
    or coalesce(bedroom_selection,'') <> 'both_bedrooms'
    or coalesce(parking_selection,'') <> 'none'
    or coalesce(early_hours,0) <> 0
    or coalesce(late_hours,0) <> 0
  then return false; end if;

  select * into booking
  from public.booking_requests
  where deposit_token_hash = token_hash
    and deposit_token_expires_at > now()
    and status in ('pending','contacted')
    and deposit_status in ('not_requested','awaiting_payment')
  for update;
  if not found then return false; end if;

  nights := booking.check_out - booking.check_in;
  accommodation := base_rate * nights;
  update public.booking_requests set
    guest_count = guests,
    bedroom_choice = 'both_bedrooms',
    stay_nights = nights,
    base_nightly_rate_minor = base_rate,
    additional_guest_count = 0,
    additional_guest_charge_minor = 0,
    parking_type = 'none',
    parking_nightly_rate_minor = 0,
    parking_charge_minor = 0,
    early_check_in_hours = 0,
    early_check_in_time = null,
    early_check_in_fee_minor = 0,
    late_checkout_hours = 0,
    late_checkout_time = null,
    late_checkout_fee_minor = 0,
    accommodation_subtotal_minor = accommodation,
    extras_total_minor = 0,
    total_minor = accommodation,
    updated_at = now()
  where id = booking.id;
  return true;
end $$;

revoke all on function public.update_snowaz_pending_guest_count(text,integer,text,text,integer,integer) from public,authenticated;
grant execute on function public.update_snowaz_pending_guest_count(text,integer,text,text,integer,integer) to anon;

create or replace function public.staff_update_snowaz_booking(
  target_id uuid, arrival date, departure date, guests integer,
  bedroom_selection text, next_stay_status text,
  id_type text default null, id_last4 text default null
)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  nights integer;
  base_rate bigint;
  extra_count integer;
  extra_charge bigint;
  parking_rate bigint;
  parking_charge bigint;
  early_fee bigint;
  late_fee bigint;
  accommodation bigint;
  extras bigint;
  booking_total bigint;
  already_paid bigint;
  current_status public.booking_request_status;
  current_parking_type text;
  current_early_hours integer;
  current_late_hours integer;
begin
  if private.snowaz_staff_role() not in ('manager','admin') then raise exception 'not authorized'; end if;
  if guests not between 1 and 6 or departure <= arrival
    or bedroom_selection not in ('bedroom_1','bedroom_2','both_bedrooms')
    or (bedroom_selection = 'bedroom_1' and guests > 2)
    or next_stay_status not in ('upcoming','checked_in','checked_out','no_show')
  then raise exception 'invalid booking update'; end if;

  select status, parking_type, parking_nightly_rate_minor,
    early_check_in_hours, early_check_in_fee_minor,
    late_checkout_hours, late_checkout_fee_minor
  into current_status, current_parking_type, parking_rate,
    current_early_hours, early_fee, current_late_hours, late_fee
  from public.booking_requests where id = target_id for update;
  if current_status is null or current_status in ('declined','cancelled') then return false; end if;
  if exists(select 1 from public.snowaz_calendar_ranges r where r.check_in < departure and r.check_out > arrival and not(r.source_kind='booking_request' and r.source_id=target_id))
    or exists(select 1 from public.property_date_blocks x where x.status='active' and x.check_in < departure and x.check_out > arrival)
  then raise exception 'dates unavailable'; end if;

  nights := departure - arrival;
  if bedroom_selection = 'both_bedrooms' then
    base_rate := 480000;
    extra_count := 0;
    extra_charge := 0;
    parking_rate := 0;
    parking_charge := 0;
    early_fee := 0;
    late_fee := 0;
  else
    base_rate := 170000;
    extra_count := case when bedroom_selection = 'bedroom_2' then greatest(guests - 2, 0) else 0 end;
    extra_charge := case when bedroom_selection = 'bedroom_2' then
      (case guests when 3 then 25000 when 4 then 40000 else case when guests > 4 then 40000 + (guests - 4) * 25000 else 0 end end) * nights
      else 0 end;
    parking_charge := coalesce(parking_rate,0) * nights;
  end if;
  accommodation := base_rate * nights + extra_charge;
  extras := parking_charge + coalesce(early_fee,0) + coalesce(late_fee,0);
  booking_total := accommodation + extras;

  select coalesce(sum(case when direction='payment' then amount_minor else -amount_minor end),0)
  into already_paid from public.booking_payments where booking_request_id=target_id and status='recorded';
  if already_paid > booking_total then raise exception 'new total below payments received'; end if;

  update public.booking_requests set
    check_in = arrival, check_out = departure, guest_count = guests,
    bedroom_choice = bedroom_selection, stay_nights = nights,
    base_nightly_rate_minor = base_rate, additional_guest_count = extra_count,
    additional_guest_charge_minor = extra_charge,
    parking_type = case when bedroom_selection='both_bedrooms' then 'none' else current_parking_type end,
    parking_nightly_rate_minor = case when bedroom_selection='both_bedrooms' then 0 else coalesce(parking_rate,0) end,
    parking_charge_minor = case when bedroom_selection='both_bedrooms' then 0 else parking_charge end,
    early_check_in_hours = case when bedroom_selection='both_bedrooms' then 0 else coalesce(current_early_hours,0) end,
    early_check_in_time = case when bedroom_selection='both_bedrooms' then null else early_check_in_time end,
    early_check_in_fee_minor = case when bedroom_selection='both_bedrooms' then 0 else coalesce(early_fee,0) end,
    late_checkout_hours = case when bedroom_selection='both_bedrooms' then 0 else coalesce(current_late_hours,0) end,
    late_checkout_time = case when bedroom_selection='both_bedrooms' then null else late_checkout_time end,
    late_checkout_fee_minor = case when bedroom_selection='both_bedrooms' then 0 else coalesce(late_fee,0) end,
    accommodation_subtotal_minor = accommodation, extras_total_minor = extras,
    total_minor = booking_total, stay_status = next_stay_status,
    primary_guest_id_type = nullif(trim(coalesce(id_type,'')),''),
    primary_guest_id_last4 = upper(nullif(trim(coalesce(id_last4,'')),'')),
    primary_guest_verified_at = case when trim(coalesce(id_type,''))<>'' and trim(coalesce(id_last4,''))~'^[A-Za-z0-9]{4}$' then now() end,
    primary_guest_verified_by = case when trim(coalesce(id_type,''))<>'' then auth.uid() end,
    updated_at = now()
  where id = target_id;

  update public.snowaz_calendar_ranges set check_in=arrival, check_out=departure,
    display_status=case when current_status='confirmed' then 'booked' else 'pending' end
  where source_kind='booking_request' and source_id=target_id;
  if not found then
    insert into public.snowaz_calendar_ranges(source_kind,source_id,check_in,check_out,display_status)
    values('booking_request',target_id,arrival,departure,case when current_status='confirmed' then 'booked' else 'pending' end);
  end if;
  insert into public.audit_log(actor_id,actor_type,action,entity_type,entity_id,request_id,redacted_metadata)
  values(auth.uid(),'staff','booking.updated','booking_request',target_id,gen_random_uuid(),jsonb_build_object('checkIn',arrival,'checkOut',departure,'guests',guests,'bedroom',bedroom_selection,'totalMinor',booking_total));
  return true;
end $$;

revoke all on function public.staff_update_snowaz_booking(uuid,date,date,integer,text,text,text,text) from public,anon;
grant execute on function public.staff_update_snowaz_booking(uuid,date,date,integer,text,text,text,text) to authenticated;
