-- Uppadar Hollie provisional catalog and pricing.
-- These rates are intentionally centralized here so they can be replaced when
-- the owner provides the final price list.

update public.resort_settings
set legal_name = 'Uppadar Hollie Staycation',
    display_name = 'Uppadar Hollie',
    address = 'Deca Homes Tower 1, Banilad, Cebu City, Philippines',
    timezone = 'Asia/Manila',
    currency = 'PHP',
    updated_at = now()
where id = true;

update public.room_types
set name = 'Entire Condo (2BR Suite)',
    slug = 'uppadar-entire-condo',
    short_description = 'Private two-bedroom condo with queen master bedroom and double-size bunk room.',
    max_adults = 8,
    max_children = 0,
    bed_configuration = '[{"type":"queen","count":1},{"type":"double_bunk","count":2}]'::jsonb,
    base_nightly_rate_minor = 420000,
    display_order = 10,
    status = 'published',
    updated_at = now()
where slug = 'snowaz-condo-stay';

insert into public.room_types
  (name, slug, short_description, max_adults, max_children, bed_configuration,
   base_nightly_rate_minor, display_order, status)
values
  ('Master Bedroom', 'uppadar-master-bedroom', 'Queen-size bed with spring mattress, wardrobe, blackout blind, LED vanity mirror, window grill, and air conditioning.', 2, 0, '[{"type":"queen","count":1}]'::jsonb, 240000, 20, 'published'),
  ('Second Bedroom', 'uppadar-second-bedroom', 'Double-size bunk bed with large spring mattresses, vanity mirror, wardrobe, window grill, and air conditioning.', 4, 0, '[{"type":"double_bunk","count":2}]'::jsonb, 210000, 30, 'published')
on conflict (slug) do update set
  name = excluded.name,
  short_description = excluded.short_description,
  max_adults = excluded.max_adults,
  max_children = excluded.max_children,
  bed_configuration = excluded.bed_configuration,
  base_nightly_rate_minor = excluded.base_nightly_rate_minor,
  display_order = excluded.display_order,
  status = excluded.status,
  updated_at = now();

update public.rooms
set room_number = 'RECHEL-ENTIRE-CONDO', floor = 'Tower 1', status = 'available', updated_at = now()
where room_number = 'SNOWAZ-PENDING';

insert into public.rooms (room_type_id, room_number, floor, status)
select id,
  case slug when 'uppadar-master-bedroom' then 'RECHEL-MASTER' else 'RECHEL-SECOND' end,
  'Tower 1', 'available'
from public.room_types
where slug in ('uppadar-master-bedroom', 'uppadar-second-bedroom')
on conflict (room_number) do update set
  room_type_id = excluded.room_type_id,
  floor = excluded.floor,
  status = excluded.status,
  updated_at = now();

alter table public.booking_requests
  drop constraint if exists booking_requests_bedroom_capacity_valid,
  drop constraint if exists booking_requests_pricing_snapshot_valid;

alter table public.booking_requests
  add constraint booking_requests_bedroom_capacity_valid check (
    (bedroom_choice = 'bedroom_1' and guest_count between 1 and 2)
    or (bedroom_choice = 'bedroom_2' and guest_count between 1 and 4)
    or (bedroom_choice = 'both_bedrooms' and guest_count between 1 and 8)
  ),
  add constraint booking_requests_pricing_snapshot_valid check (
    stay_nights > 0 and base_nightly_rate_minor >= 0
    and additional_guest_count = 0 and additional_guest_charge_minor = 0
    and total_minor >= deposit_amount_minor
  );

drop function if exists public.submit_snowaz_booking_request(uuid,text,text,text,date,date,integer,text,text,text,text,text,text);
create function public.submit_snowaz_booking_request(
  request_idempotency uuid, guest_name text, guest_email text, guest_phone text,
  arrival date, departure date, guests integer, bedroom_selection text, requests text,
  contact_method text, consent_version text, token_hash text, parking_selection text
)
returns table(booking_id uuid, booking_reference text, deposit_expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  target_id uuid;
  expiry timestamptz := now() + interval '2 hours';
  nights integer;
  base_rate bigint;
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
    or parking_selection <> 'none'
    or departure <= arrival or arrival < current_date or departure > current_date + 366
    or consent_version <> 'booking-request-v2'
    or char_length(token_hash) <> 64
    or char_length(coalesce(requests,'')) > 1000
  then raise exception 'invalid booking request'; end if;

  if exists (
    select 1 from public.snowaz_calendar_ranges r
    where r.check_in < departure and r.check_out > arrival
      and not (r.source_kind = 'booking_request' and r.source_id = coalesce(
        (select id from public.booking_requests where idempotency_key = request_idempotency),
        '00000000-0000-0000-0000-000000000000'::uuid))
  ) then raise exception 'dates unavailable'; end if;

  nights := departure - arrival;
  base_rate := case bedroom_selection
    when 'bedroom_1' then 240000
    when 'bedroom_2' then 210000
    else 420000
  end;
  booking_total := base_rate * nights;

  insert into public.booking_requests(
    idempotency_key, full_name, normalized_email, phone, preferred_contact,
    check_in, check_out, guest_count, bedroom_choice, stay_nights,
    base_nightly_rate_minor, additional_guest_count, additional_guest_charge_minor,
    parking_type, parking_nightly_rate_minor, parking_charge_minor, total_minor,
    special_requests, status, source, consent_version, deposit_status,
    deposit_amount_minor, deposit_token_hash, deposit_token_expires_at
  ) values (
    request_idempotency, trim(guest_name), lower(trim(coalesce(guest_email,''))),
    trim(guest_phone), contact_method, arrival, departure, guests, bedroom_selection,
    nights, base_rate, 0, 0, 'none', 0, 0, booking_total,
    nullif(trim(coalesce(requests,'')),''), 'pending', 'snowaz_guest_web',
    consent_version, 'awaiting_payment', least(100000, booking_total), token_hash, expiry
  ) on conflict (idempotency_key) do update set
    deposit_token_hash = case when public.booking_requests.deposit_status = 'awaiting_payment' then excluded.deposit_token_hash else public.booking_requests.deposit_token_hash end,
    deposit_token_expires_at = case when public.booking_requests.deposit_status = 'awaiting_payment' then excluded.deposit_token_expires_at else public.booking_requests.deposit_token_expires_at end,
    updated_at = now()
  returning id into target_id;

  return query select target_id, 'RECHEL-' || upper(substr(replace(target_id::text,'-',''),1,8)), expiry;
end;
$$;

revoke all on function public.submit_snowaz_booking_request(uuid,text,text,text,date,date,integer,text,text,text,text,text,text) from public;
grant execute on function public.submit_snowaz_booking_request(uuid,text,text,text,date,date,integer,text,text,text,text,text,text) to anon, authenticated;

comment on function public.submit_snowaz_booking_request(uuid,text,text,text,date,date,integer,text,text,text,text,text,text)
is 'Creates an Uppadar Hollie booking request using provisional bedroom pricing.';
