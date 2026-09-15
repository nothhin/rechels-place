-- Centralized Rechel's Place pricing.
-- The settings table is the only source of current rates. Booking rows keep
-- their own immutable-in-practice price fields as the agreement snapshot.

create sequence if not exists public.snowaz_price_revision_seq
  start with 1 increment by 1;

create table if not exists public.snowaz_price_settings (
  price_key text primary key,
  display_name text not null,
  description text not null,
  value_type text not null check (value_type in ('amount', 'percentage')),
  amount_minor bigint,
  percentage_basis_points integer,
  currency text,
  pricing_unit text not null,
  maximum_amount_minor bigint,
  maximum_percentage_basis_points integer,
  active boolean not null default true,
  revision bigint not null default nextval('public.snowaz_price_revision_seq'),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.staff_users(id) on delete set null,
  constraint snowaz_price_key_format check (price_key ~ '^[a-z0-9_]+$'),
  constraint snowaz_price_value_shape check (
    (value_type = 'amount'
      and amount_minor is not null and amount_minor >= 0
      and percentage_basis_points is null
      and currency = 'PHP'
      and maximum_amount_minor is not null and maximum_amount_minor >= amount_minor
      and maximum_percentage_basis_points is null)
    or
    (value_type = 'percentage'
      and amount_minor is null
      and percentage_basis_points is not null
      and percentage_basis_points between 0 and 10000
      and currency is null
      and maximum_amount_minor is null
      and maximum_percentage_basis_points = 10000)
  ),
  constraint snowaz_price_text_valid check (
    char_length(trim(display_name)) between 1 and 120
    and char_length(trim(description)) between 1 and 500
    and char_length(trim(pricing_unit)) between 1 and 80
  )
);

comment on table public.snowaz_price_settings is
  'Authoritative current pricing configuration for new Rechel''s Place estimates and bookings.';
comment on column public.snowaz_price_settings.amount_minor is
  'PHP amount in integer minor units. Only populated for monetary settings.';
comment on column public.snowaz_price_settings.revision is
  'Monotonic optimistic-concurrency revision; included in customer price snapshots.';

create table if not exists public.snowaz_price_history (
  id uuid primary key default gen_random_uuid(),
  price_key text not null references public.snowaz_price_settings(price_key),
  display_name text not null,
  value_type text not null check (value_type in ('amount', 'percentage')),
  previous_amount_minor bigint,
  new_amount_minor bigint,
  previous_percentage_basis_points integer,
  new_percentage_basis_points integer,
  changed_at timestamptz not null default now(),
  changed_by uuid references public.staff_users(id) on delete set null,
  reason text,
  constraint snowaz_price_history_value_shape check (
    (value_type = 'amount'
      and previous_amount_minor is not null and previous_amount_minor >= 0
      and new_amount_minor is not null and new_amount_minor >= 0
      and previous_percentage_basis_points is null
      and new_percentage_basis_points is null)
    or
    (value_type = 'percentage'
      and previous_amount_minor is null and new_amount_minor is null
      and previous_percentage_basis_points is not null
      and previous_percentage_basis_points between 0 and 10000
      and new_percentage_basis_points is not null
      and new_percentage_basis_points between 0 and 10000)
  ),
  constraint snowaz_price_history_reason_valid check (
    reason is null or char_length(trim(reason)) between 1 and 500
  )
);

comment on table public.snowaz_price_history is
  'Append-only audit history for successful price changes.';

alter table public.snowaz_price_settings enable row level security;
alter table public.snowaz_price_history enable row level security;
revoke all on table public.snowaz_price_settings from public, anon, authenticated;
revoke all on table public.snowaz_price_history from public, anon, authenticated;

insert into public.snowaz_price_settings (
  price_key, display_name, description, value_type, amount_minor,
  percentage_basis_points, currency, pricing_unit, maximum_amount_minor,
  maximum_percentage_basis_points, revision
) values
  ('whole_condo_nightly_rate', 'Entire two-bedroom condo', 'Current nightly rate for the complete two-bedroom condo.', 'amount', 450000, null, 'PHP', 'per night', 10000000, null, 1),
  ('master_bedroom_nightly_rate', 'Master Bedroom nightly rate', 'Existing legacy single-bedroom nightly rate for the master bedroom.', 'amount', 170000, null, 'PHP', 'per night', 10000000, null, 2),
  ('second_bedroom_nightly_rate', 'Second Bedroom base rate', 'Existing second-bedroom nightly rate for up to two guests.', 'amount', 170000, null, 'PHP', 'per night', 10000000, null, 3),
  ('second_bedroom_3_guest_nightly_rate', 'Second Bedroom · 3 guests', 'Existing second-bedroom nightly rate when three guests are selected.', 'amount', 195000, null, 'PHP', 'per night', 10000000, null, 4),
  ('second_bedroom_4_guest_nightly_rate', 'Second Bedroom · 4 guests', 'Existing second-bedroom nightly rate when four guests are selected.', 'amount', 210000, null, 'PHP', 'per night', 10000000, null, 5),
  ('additional_guest_fee', 'Additional guest fee', 'Existing nightly adjustment for each second-bedroom guest above four.', 'amount', 25000, null, 'PHP', 'per additional guest / night', 1000000, null, 6),
  ('car_parking_nightly_rate', 'Car parking', 'Existing optional car parking charge.', 'amount', 35000, null, 'PHP', 'per night', 1000000, null, 7),
  ('motorcycle_parking_nightly_rate', 'Motorcycle parking', 'Existing optional motorcycle parking charge.', 'amount', 15000, null, 'PHP', 'per night', 1000000, null, 8),
  ('early_checkin_hourly_rate', 'Early check-in', 'Existing host-confirmed early check-in extension charge.', 'amount', 15000, null, 'PHP', 'per hour', 1000000, null, 9),
  ('late_checkout_hourly_rate', 'Late checkout', 'Existing host-confirmed late checkout extension charge.', 'amount', 15000, null, 'PHP', 'per hour', 1000000, null, 10),
  ('refundable_security_deposit', 'Refundable security deposit', 'Separate refundable deposit due upon check-in on the check-in day.', 'amount', 100000, null, 'PHP', 'one-time upon check-in', 10000000, null, 11),
  ('down_payment_percent', 'Accommodation down payment', 'Percentage of the accommodation total requested before the stay is confirmed.', 'percentage', null, 5000, null, 'of accommodation total', null, 10000, 12)
on conflict (price_key) do nothing;

select setval(
  'public.snowaz_price_revision_seq',
  greatest(coalesce((select max(revision) from public.snowaz_price_settings), 1), 1),
  true
);

-- The old column default was a second source of truth. New booking paths set
-- the snapshot explicitly from the settings table.
alter table public.booking_requests
  alter column deposit_amount_minor drop default;

comment on column public.booking_requests.deposit_amount_minor is
  'Price snapshot for the refundable security deposit; populated from snowaz_price_settings for new bookings.';

comment on column public.room_types.base_nightly_rate_minor is
  'Legacy availability compatibility field. Rechel''s Place current prices come from snowaz_price_settings.';

drop function if exists private.snowaz_price_amount(text);
create function private.snowaz_price_amount(p_price_key text)
returns bigint
language sql stable security definer set search_path = ''
as $$
  select amount_minor
  from public.snowaz_price_settings
  where price_key = $1 and active and value_type = 'amount'
$$;

drop function if exists private.snowaz_price_percentage(text);
create function private.snowaz_price_percentage(p_price_key text)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select percentage_basis_points::numeric / 100
  from public.snowaz_price_settings
  where price_key = $1 and active and value_type = 'percentage'
$$;

revoke all on function private.snowaz_price_amount(text) from public, anon, authenticated;
revoke all on function private.snowaz_price_percentage(text) from public, anon, authenticated;

drop function if exists private.snowaz_public_pricing_payload();
create function private.snowaz_public_pricing_payload()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'version', coalesce(max(revision), 0)::text,
    'settings', coalesce(jsonb_agg(jsonb_build_object(
      'key', price_key,
      'displayName', display_name,
      'description', description,
      'valueType', value_type,
      'amountMinor', amount_minor,
      'percentage', case when value_type = 'percentage' then percentage_basis_points::numeric / 100 else null end,
      'currency', currency,
      'unit', pricing_unit,
      'maximumAmountMinor', maximum_amount_minor,
      'maximumPercentage', case when value_type = 'percentage' then maximum_percentage_basis_points::numeric / 100 else null end,
      'revision', revision,
      'updatedAt', updated_at
    ) order by revision, price_key), '[]'::jsonb)
  )
  from public.snowaz_price_settings
  where active
$$;

drop function if exists private.snowaz_staff_pricing_payload();
create function private.snowaz_staff_pricing_payload()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  result jsonb;
begin
  if private.snowaz_staff_role() not in ('manager', 'admin') then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'version', coalesce((select max(revision) from public.snowaz_price_settings where active), 0)::text,
    'settings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', s.price_key,
        'displayName', s.display_name,
        'description', s.description,
        'valueType', s.value_type,
        'amountMinor', s.amount_minor,
        'percentage', case when s.value_type = 'percentage' then s.percentage_basis_points::numeric / 100 else null end,
        'currency', s.currency,
        'unit', s.pricing_unit,
        'maximumAmountMinor', s.maximum_amount_minor,
        'maximumPercentage', case when s.value_type = 'percentage' then s.maximum_percentage_basis_points::numeric / 100 else null end,
        'revision', s.revision,
        'updatedAt', s.updated_at,
        'updatedBy', u.email
      ) order by s.revision, s.price_key)
      from public.snowaz_price_settings s
      left join public.staff_users u on u.id = s.updated_by
      where s.active
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', h.id,
        'key', h.price_key,
        'displayName', h.display_name,
        'valueType', h.value_type,
        'previousAmountMinor', h.previous_amount_minor,
        'newAmountMinor', h.new_amount_minor,
        'previousPercentage', case when h.value_type = 'percentage' then h.previous_percentage_basis_points::numeric / 100 else null end,
        'newPercentage', case when h.value_type = 'percentage' then h.new_percentage_basis_points::numeric / 100 else null end,
        'changedAt', h.changed_at,
        'changedBy', u.email,
        'reason', h.reason
      ) order by h.changed_at desc)
      from (
        select * from public.snowaz_price_history order by changed_at desc limit 100
      ) h
      left join public.staff_users u on u.id = h.changed_by
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function private.snowaz_public_pricing_payload() from public, anon, authenticated;
revoke all on function private.snowaz_staff_pricing_payload() from public, anon, authenticated;

drop function if exists public.get_snowaz_public_pricing();
create function public.get_snowaz_public_pricing()
returns jsonb
language sql stable security invoker set search_path = ''
as $$ select private.snowaz_public_pricing_payload() $$;

drop function if exists public.staff_get_snowaz_pricing();
create function public.staff_get_snowaz_pricing()
returns jsonb
language sql stable security invoker set search_path = ''
as $$ select private.snowaz_staff_pricing_payload() $$;

drop function if exists private.snowaz_price_setting_json(text);
create function private.snowaz_price_setting_json(p_price_key text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'key', s.price_key,
    'displayName', s.display_name,
    'description', s.description,
    'valueType', s.value_type,
    'amountMinor', s.amount_minor,
    'percentage', case when s.value_type = 'percentage' then s.percentage_basis_points::numeric / 100 else null end,
    'currency', s.currency,
    'unit', s.pricing_unit,
    'maximumAmountMinor', s.maximum_amount_minor,
    'maximumPercentage', case when s.value_type = 'percentage' then s.maximum_percentage_basis_points::numeric / 100 else null end,
    'revision', s.revision,
    'updatedAt', s.updated_at,
    'updatedBy', u.email
  )
  from public.snowaz_price_settings s
  left join public.staff_users u on u.id = s.updated_by
  where s.price_key = $1
$$;

revoke all on function private.snowaz_price_setting_json(text) from public, anon, authenticated;

drop function if exists private.snowaz_update_price(text,bigint,integer,bigint,text);
create function private.snowaz_update_price(
  p_price_key text,
  p_new_amount_minor bigint,
  p_new_percentage_basis_points integer,
  p_expected_revision bigint,
  p_reason text default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  current_setting public.snowaz_price_settings%rowtype;
  actor uuid;
  next_revision bigint;
  normalized_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if private.snowaz_staff_role() not in ('manager', 'admin') then
    raise exception 'not authorized';
  end if;
  if p_expected_revision is null then
    raise exception 'price revision is required';
  end if;

  select * into current_setting
  from public.snowaz_price_settings
  where price_key = p_price_key and active
  for update;
  if not found then raise exception 'price setting is unavailable'; end if;
  if current_setting.revision <> p_expected_revision then
    raise exception 'price changed by another admin; reload the page';
  end if;
  if char_length(coalesce(normalized_reason, '')) > 500 then
    raise exception 'update note is too long';
  end if;

  select id into actor
  from public.staff_users
  where identity_provider_subject = (select auth.uid())::text
    and status = 'active'
  limit 1;
  if actor is null then raise exception 'not authorized'; end if;

  if current_setting.value_type = 'amount' then
    if p_new_amount_minor is null or p_new_percentage_basis_points is not null
      or p_new_amount_minor < 0
      or p_new_amount_minor > current_setting.maximum_amount_minor
    then
      raise exception 'amount must be a non-negative value within the allowed maximum';
    end if;
    if p_new_amount_minor = current_setting.amount_minor then
      return jsonb_build_object('status', 'unchanged', 'setting', private.snowaz_price_setting_json(p_price_key));
    end if;
    next_revision := nextval('public.snowaz_price_revision_seq');
    update public.snowaz_price_settings
    set amount_minor = p_new_amount_minor,
        revision = next_revision,
        updated_at = now(),
        updated_by = actor
    where price_key = p_price_key;
    insert into public.snowaz_price_history(
      price_key, display_name, value_type, previous_amount_minor,
      new_amount_minor, changed_by, reason
    ) values (
      p_price_key, current_setting.display_name, current_setting.value_type,
      current_setting.amount_minor, p_new_amount_minor, actor, normalized_reason
    );
  else
    if p_new_percentage_basis_points is null or p_new_amount_minor is not null
      or p_new_percentage_basis_points < 0
      or p_new_percentage_basis_points > current_setting.maximum_percentage_basis_points
    then
      raise exception 'percentage must be between zero and one hundred';
    end if;
    if p_new_percentage_basis_points = current_setting.percentage_basis_points then
      return jsonb_build_object('status', 'unchanged', 'setting', private.snowaz_price_setting_json(p_price_key));
    end if;
    next_revision := nextval('public.snowaz_price_revision_seq');
    update public.snowaz_price_settings
    set percentage_basis_points = p_new_percentage_basis_points,
        revision = next_revision,
        updated_at = now(),
        updated_by = actor
    where price_key = p_price_key;
    insert into public.snowaz_price_history(
      price_key, display_name, value_type, previous_percentage_basis_points,
      new_percentage_basis_points, changed_by, reason
    ) values (
      p_price_key, current_setting.display_name, current_setting.value_type,
      current_setting.percentage_basis_points, p_new_percentage_basis_points,
      actor, normalized_reason
    );
  end if;

  return jsonb_build_object('status', 'updated', 'setting', private.snowaz_price_setting_json(p_price_key));
end;
$$;

revoke all on function private.snowaz_update_price(text,bigint,integer,bigint,text) from public, anon, authenticated;
drop function if exists public.staff_update_snowaz_price(text,bigint,integer,bigint,text);
create function public.staff_update_snowaz_price(
  price_key text,
  new_amount_minor bigint,
  new_percentage_basis_points integer,
  expected_revision bigint,
  reason text default null
)
returns jsonb
language sql security invoker set search_path = ''
as $$
  select private.snowaz_update_price($1, $2, $3, $4, $5)
$$;

revoke all on function public.get_snowaz_public_pricing() from public;
grant execute on function public.get_snowaz_public_pricing() to anon, authenticated;
revoke all on function public.staff_get_snowaz_pricing() from public, anon;
grant execute on function public.staff_get_snowaz_pricing() to authenticated;
revoke all on function public.staff_update_snowaz_price(text,bigint,integer,bigint,text) from public, anon;
grant execute on function public.staff_update_snowaz_price(text,bigint,integer,bigint,text) to authenticated;

drop function if exists private.snowaz_booking_price(integer,text,text,integer,integer,integer);
create function private.snowaz_booking_price(
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
  if p_guests not between 1 and 6
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

drop function if exists public.submit_snowaz_booking_request_v2(uuid,text,text,text,date,date,integer,text,text,text,text,text,text,integer,integer,text,bigint);
create function public.submit_snowaz_booking_request_v2(
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
  if nullif(trim(coalesce(pricing_version, '')), '') is not null
    and trim(pricing_version) <> current_version
  then
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

revoke all on function public.submit_snowaz_booking_request_v2(uuid,text,text,text,date,date,integer,text,text,text,text,text,text,integer,integer,text,bigint) from public;
grant execute on function public.submit_snowaz_booking_request_v2(uuid,text,text,text,date,date,integer,text,text,text,text,text,text,integer,integer,text,bigint) to anon, authenticated;

create or replace function public.submit_snowaz_booking_request(
  request_idempotency uuid, guest_name text, guest_email text, guest_phone text,
  arrival date, departure date, guests integer, bedroom_selection text, requests text,
  contact_method text, consent_version text, token_hash text, parking_selection text,
  early_check_in_hours integer, late_checkout_hours integer
)
returns table(booking_id uuid, booking_reference text, deposit_expires_at timestamptz)
language sql security definer set search_path = ''
as $$
  select booking_id, booking_reference, deposit_expires_at
  from public.submit_snowaz_booking_request_v2(
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,null,null
  )
$$;

revoke all on function public.submit_snowaz_booking_request(uuid,text,text,text,date,date,integer,text,text,text,text,text,text,integer,integer) from public;
grant execute on function public.submit_snowaz_booking_request(uuid,text,text,text,date,date,integer,text,text,text,text,text,text,integer,integer) to anon, authenticated;

create or replace function public.submit_snowaz_booking_request(
  request_idempotency uuid, guest_name text, guest_email text, guest_phone text,
  arrival date, departure date, guests integer, bedroom_selection text, requests text,
  contact_method text, consent_version text, token_hash text, parking_selection text
)
returns table(booking_id uuid, booking_reference text, deposit_expires_at timestamptz)
language sql security definer set search_path = ''
as $$
  select * from public.submit_snowaz_booking_request(
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,0,0
  )
$$;

create or replace function public.submit_snowaz_booking_request(
  request_idempotency uuid, guest_name text, guest_email text, guest_phone text,
  arrival date, departure date, guests integer, requests text,
  contact_method text, consent_version text, token_hash text
)
returns table(booking_id uuid, booking_reference text, deposit_expires_at timestamptz)
language sql security definer set search_path = ''
as $$
  select * from public.submit_snowaz_booking_request(
    $1,$2,$3,$4,$5,$6,$7,
    case when $7 <= 2 then 'bedroom_1' else 'bedroom_2' end,
    $8,$9,$10,$11,'none',0,0
  )
$$;

create or replace function public.update_snowaz_pending_guest_count(
  token_hash text, guests integer, bedroom_selection text,
  parking_selection text, early_hours integer, late_hours integer
)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  booking public.booking_requests%rowtype;
  calculation record;
begin
  if guests not between 1 and 6
    or coalesce(bedroom_selection, '') <> 'both_bedrooms'
    or coalesce(parking_selection, '') <> 'none'
    or coalesce(early_hours, 0) <> 0
    or coalesce(late_hours, 0) <> 0
  then return false; end if;

  select * into booking
  from public.booking_requests
  where deposit_token_hash = token_hash
    and deposit_token_expires_at > now()
    and status in ('pending', 'contacted')
    and deposit_status in ('not_requested', 'awaiting_payment')
  for update;
  if not found then return false; end if;

  select * into calculation
  from private.snowaz_booking_price(
    guests, 'both_bedrooms', 'none', 0, 0,
    booking.check_out - booking.check_in
  );

  update public.booking_requests set
    guest_count = guests,
    bedroom_choice = 'both_bedrooms',
    stay_nights = booking.check_out - booking.check_in,
    base_nightly_rate_minor = calculation.base_nightly_rate_minor,
    additional_guest_count = calculation.additional_guest_count,
    additional_guest_charge_minor = calculation.additional_guest_charge_minor,
    parking_type = 'none', parking_nightly_rate_minor = calculation.parking_nightly_rate_minor,
    parking_charge_minor = calculation.parking_charge_minor,
    early_check_in_hours = calculation.early_check_in_hours,
    early_check_in_time = calculation.early_check_in_time,
    early_check_in_fee_minor = calculation.early_check_in_fee_minor,
    late_checkout_hours = calculation.late_checkout_hours,
    late_checkout_time = calculation.late_checkout_time,
    late_checkout_fee_minor = calculation.late_checkout_fee_minor,
    accommodation_subtotal_minor = calculation.accommodation_subtotal_minor,
    extras_total_minor = calculation.extras_total_minor,
    total_minor = calculation.total_minor,
    down_payment_amount_minor = calculation.down_payment_amount_minor,
    deposit_amount_minor = calculation.deposit_amount_minor,
    updated_at = now()
  where id = booking.id;
  return true;
end;
$$;

revoke all on function public.update_snowaz_pending_guest_count(text,integer,text,text,integer,integer) from public, authenticated;
grant execute on function public.update_snowaz_pending_guest_count(text,integer,text,text,integer,integer) to anon;

create or replace function public.update_snowaz_pending_guest_count(
  token_hash text, guests integer, bedroom_selection text, parking_selection text
)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  early_hours integer;
  late_hours integer;
begin
  select early_check_in_hours, late_checkout_hours into early_hours, late_hours
  from public.booking_requests where deposit_token_hash = token_hash limit 1;
  return public.update_snowaz_pending_guest_count(
    token_hash, guests, bedroom_selection, parking_selection,
    coalesce(early_hours, 0), coalesce(late_hours, 0)
  );
end
$$;

revoke all on function public.update_snowaz_pending_guest_count(text,integer,text,text) from public, authenticated;
grant execute on function public.update_snowaz_pending_guest_count(text,integer,text,text) to anon;

create or replace function public.staff_start_snowaz_deposit(
  target_id uuid, token_hash text, expires_at timestamptz
)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  booking_total bigint;
  down_payment bigint;
  security_deposit bigint;
begin
  if private.snowaz_staff_role() not in ('manager', 'admin') then raise exception 'not authorized'; end if;
  select total_minor, down_payment_amount_minor, deposit_amount_minor
    into booking_total, down_payment, security_deposit
  from public.booking_requests
  where id = target_id and source in ('guest_web', 'snowaz_guest_web')
    and status in ('pending', 'contacted') for update;
  if not found then return false; end if;
  down_payment := coalesce(down_payment, ceil(greatest(booking_total, 0)::numeric * private.snowaz_price_percentage('down_payment_percent') / 100)::bigint);

  update public.booking_requests set
    status = 'contacted', deposit_status = 'awaiting_payment',
    down_payment_amount_minor = down_payment,
    deposit_token_hash = token_hash, deposit_token_expires_at = expires_at,
    deposit_sender_name = null, deposit_reference = null,
    deposit_submitted_at = null, deposit_verified_at = null,
    deposit_refund_reference = null, deposit_refunded_at = null, updated_at = now()
  where id = target_id;

  insert into public.audit_log(actor_id, actor_type, action, entity_type, entity_id, request_id, redacted_metadata)
  select id, 'staff', 'booking.deposit_requested', 'booking_request', target_id,
    gen_random_uuid(), jsonb_build_object(
      'downPaymentAmountMinor', down_payment,
      'securityDepositAmountMinor', security_deposit,
      'expiresAt', expires_at
    )
  from public.staff_users where identity_provider_subject = (select auth.uid())::text limit 1;
  return true;
end;
$$;

create or replace function public.submit_snowaz_deposit_reference(
  token_hash text, sender_name text, payment_reference text
)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  target_id uuid;
  down_payment bigint;
  security_deposit bigint;
begin
  if char_length(trim(sender_name)) not between 2 and 120
    or char_length(trim(payment_reference)) not between 6 and 80 then return false; end if;
  update public.booking_requests set
    down_payment_amount_minor = coalesce(down_payment_amount_minor, ceil(greatest(total_minor, 0)::numeric * private.snowaz_price_percentage('down_payment_percent') / 100)::bigint),
    deposit_status = 'submitted', deposit_sender_name = trim(sender_name),
    deposit_reference = trim(payment_reference), deposit_submitted_at = now(),
    deposit_token_expires_at = ((check_out + 30)::timestamp at time zone 'Asia/Manila'), updated_at = now()
  where deposit_token_hash = token_hash and deposit_status = 'awaiting_payment'
    and deposit_token_expires_at > now()
  returning id, down_payment_amount_minor, deposit_amount_minor
    into target_id, down_payment, security_deposit;
  if target_id is null then return false; end if;
  insert into public.audit_log(actor_type, action, entity_type, entity_id, request_id, redacted_metadata)
  values ('guest', 'booking.deposit_reference_submitted', 'booking_request', target_id,
    gen_random_uuid(), jsonb_build_object(
      'downPaymentAmountMinor', down_payment,
      'securityDepositAmountMinor', security_deposit
    ));
  return true;
end;
$$;

create or replace function public.staff_verify_snowaz_deposit(target_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  deposit public.booking_requests%rowtype;
begin
  if private.snowaz_staff_role() not in ('manager', 'admin') then raise exception 'not authorized'; end if;
  update public.booking_requests set
    status = 'confirmed', deposit_status = 'verified',
    down_payment_amount_minor = coalesce(down_payment_amount_minor, ceil(greatest(total_minor, 0)::numeric * private.snowaz_price_percentage('down_payment_percent') / 100)::bigint),
    deposit_verified_at = now(),
    deposit_token_expires_at = ((check_out + 30)::timestamp at time zone 'Asia/Manila'), updated_at = now()
  where id = target_id and status in ('pending', 'contacted') and deposit_status = 'submitted'
  returning * into deposit;
  if not found then return false; end if;
  insert into public.booking_payments(
    booking_request_id, direction, category, amount_minor,
    payment_method, payment_reference, recorded_by, recorded_at
  ) values (
    target_id, 'payment', 'down_payment', deposit.down_payment_amount_minor,
    'bank_transfer', deposit.deposit_reference, auth.uid(), coalesce(deposit.deposit_submitted_at, now())
  ) on conflict do nothing;
  insert into public.audit_log(actor_id, actor_type, action, entity_type, entity_id, request_id, redacted_metadata)
  select id, 'staff', 'booking.deposit_verified', 'booking_request', target_id,
    gen_random_uuid(), jsonb_build_object(
      'downPaymentAmountMinor', deposit.down_payment_amount_minor,
      'securityDepositAmountMinor', deposit.deposit_amount_minor
    )
  from public.staff_users where identity_provider_subject = (select auth.uid())::text limit 1;
  return true;
end;
$$;

create or replace function public.staff_record_and_verify_snowaz_deposit(
  target_id uuid, sender_name text, payment_reference text
)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid;
  deposit public.booking_requests%rowtype;
begin
  if private.snowaz_staff_role() not in ('manager', 'admin')
    or char_length(trim(sender_name)) not between 2 and 120
    or char_length(trim(payment_reference)) not between 6 and 80 then
    raise exception 'invalid request';
  end if;
  select id into actor from public.staff_users
  where identity_provider_subject = (select auth.uid())::text and status = 'active' limit 1;
  update public.booking_requests set
    status = 'confirmed', deposit_status = 'verified',
    down_payment_amount_minor = coalesce(down_payment_amount_minor, ceil(greatest(total_minor, 0)::numeric * private.snowaz_price_percentage('down_payment_percent') / 100)::bigint),
    deposit_sender_name = trim(sender_name), deposit_reference = trim(payment_reference),
    deposit_submitted_at = now(), deposit_verified_at = now(),
    deposit_token_expires_at = ((check_out + 30)::timestamp at time zone 'Asia/Manila'), updated_at = now()
  where id = target_id and status in ('pending', 'contacted')
    and deposit_status = 'awaiting_payment' and deposit_token_expires_at > now()
  returning * into deposit;
  if not found then return false; end if;
  insert into public.booking_payments(
    booking_request_id, direction, category, amount_minor,
    payment_method, payment_reference, recorded_by
  ) values (
    target_id, 'payment', 'down_payment', deposit.down_payment_amount_minor,
    'messenger_receipt', trim(payment_reference), auth.uid()
  ) on conflict do nothing;
  insert into public.audit_log(actor_id, actor_type, action, entity_type, entity_id, request_id, redacted_metadata)
  values (actor, 'staff', 'booking.deposit_recorded_and_verified', 'booking_request', target_id,
    gen_random_uuid(), jsonb_build_object(
      'downPaymentAmountMinor', deposit.down_payment_amount_minor,
      'securityDepositAmountMinor', deposit.deposit_amount_minor,
      'source', 'messenger_receipt'
    ));
  return true;
end;
$$;

create or replace function public.staff_update_snowaz_booking(
  target_id uuid, arrival date, departure date, guests integer,
  bedroom_selection text, next_stay_status text,
  id_type text default null, id_last4 text default null
)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  booking public.booking_requests%rowtype;
  calculation record;
  effective_parking text;
  effective_early integer;
  effective_late integer;
  already_paid bigint;
  current_status public.booking_request_status;
begin
  if private.snowaz_staff_role() not in ('manager', 'admin') then raise exception 'not authorized'; end if;
  if guests not between 1 and 6 or departure <= arrival
    or bedroom_selection not in ('bedroom_1', 'bedroom_2', 'both_bedrooms')
    or (bedroom_selection = 'bedroom_1' and guests > 2)
    or next_stay_status not in ('upcoming', 'checked_in', 'checked_out', 'no_show') then
    raise exception 'invalid booking update';
  end if;
  select * into booking from public.booking_requests where id = target_id for update;
  if not found or booking.status in ('declined', 'cancelled') then return false; end if;
  current_status := booking.status;
  if exists (
    select 1 from public.snowaz_calendar_ranges r
    where r.check_in < departure and r.check_out > arrival
      and not (r.source_kind = 'booking_request' and r.source_id = target_id)
  ) or exists (
    select 1 from public.property_date_blocks x
    where x.status = 'active' and x.check_in < departure and x.check_out > arrival
  ) then raise exception 'dates unavailable'; end if;

  effective_parking := case when bedroom_selection = 'both_bedrooms' then 'none' else coalesce(booking.parking_type, 'none') end;
  effective_early := case when bedroom_selection = 'both_bedrooms' then 0 else coalesce(booking.early_check_in_hours, 0) end;
  effective_late := case when bedroom_selection = 'both_bedrooms' then 0 else coalesce(booking.late_checkout_hours, 0) end;
  select * into calculation from private.snowaz_booking_price(
    guests, bedroom_selection, effective_parking, effective_early, effective_late,
    departure - arrival
  );
  select coalesce(sum(case when direction = 'payment' then amount_minor else -amount_minor end), 0)
    into already_paid from public.booking_payments
    where booking_request_id = target_id and status = 'recorded';
  if already_paid > calculation.total_minor then raise exception 'new total below payments received'; end if;

  update public.booking_requests set
    check_in = arrival, check_out = departure, guest_count = guests,
    bedroom_choice = bedroom_selection, stay_nights = departure - arrival,
    base_nightly_rate_minor = calculation.base_nightly_rate_minor,
    additional_guest_count = calculation.additional_guest_count,
    additional_guest_charge_minor = calculation.additional_guest_charge_minor,
    parking_type = effective_parking, parking_nightly_rate_minor = calculation.parking_nightly_rate_minor,
    parking_charge_minor = calculation.parking_charge_minor,
    early_check_in_hours = calculation.early_check_in_hours,
    early_check_in_time = calculation.early_check_in_time,
    early_check_in_fee_minor = calculation.early_check_in_fee_minor,
    late_checkout_hours = calculation.late_checkout_hours,
    late_checkout_time = calculation.late_checkout_time,
    late_checkout_fee_minor = calculation.late_checkout_fee_minor,
    accommodation_subtotal_minor = calculation.accommodation_subtotal_minor,
    extras_total_minor = calculation.extras_total_minor, total_minor = calculation.total_minor,
    down_payment_amount_minor = calculation.down_payment_amount_minor,
    stay_status = next_stay_status,
    primary_guest_id_type = nullif(trim(coalesce(id_type, '')), ''),
    primary_guest_id_last4 = upper(nullif(trim(coalesce(id_last4, '')), '')),
    primary_guest_verified_at = case when trim(coalesce(id_type, '')) <> ''
      and trim(coalesce(id_last4, '')) ~ '^[A-Za-z0-9]{4}$' then now() end,
    primary_guest_verified_by = case when trim(coalesce(id_type, '')) <> '' then auth.uid() end,
    updated_at = now()
  where id = target_id;

  update public.snowaz_calendar_ranges set check_in = arrival, check_out = departure,
    display_status = case when current_status = 'confirmed' then 'booked' else 'pending' end
  where source_kind = 'booking_request' and source_id = target_id;
  if not found then
    insert into public.snowaz_calendar_ranges(source_kind, source_id, check_in, check_out, display_status)
    values ('booking_request', target_id, arrival, departure,
      case when current_status = 'confirmed' then 'booked' else 'pending' end);
  end if;
  insert into public.audit_log(actor_id, actor_type, action, entity_type, entity_id, request_id, redacted_metadata)
  values (auth.uid(), 'staff', 'booking.updated', 'booking_request', target_id,
    gen_random_uuid(), jsonb_build_object(
      'checkIn', arrival, 'checkOut', departure, 'guests', guests,
      'bedroom', bedroom_selection, 'totalMinor', calculation.total_minor
    ));
  return true;
end;
$$;

create or replace function public.lookup_snowaz_booking_status(booking_reference text, guest_phone text)
returns table(
  check_in date, check_out date, guest_count integer, booking_status text,
  stay_status text, deposit_status text, deposit_expires_at timestamptz,
  bedroom_choice text, total_minor bigint, paid_minor bigint, remaining_minor bigint
)
language sql stable security definer set search_path = ''
as $$
  select b.check_in, b.check_out, b.guest_count, b.status::text, b.stay_status,
    b.deposit_status, b.deposit_token_expires_at, b.bedroom_choice, b.total_minor,
    coalesce((select sum(case when p.direction = 'payment' then p.amount_minor else -p.amount_minor end)
      from public.booking_payments p where p.booking_request_id = b.id and p.status = 'recorded'), 0)::bigint,
    greatest(b.total_minor - coalesce((select sum(case when p.direction = 'payment' then p.amount_minor else -p.amount_minor end)
      from public.booking_payments p where p.booking_request_id = b.id and p.status = 'recorded'), 0), 0)::bigint
  from public.booking_requests b
  where 'RECHEL-' || upper(substr(replace(b.id::text, '-', ''), 1, 8)) = upper(trim(booking_reference))
    and regexp_replace(b.phone, '\\D', '', 'g') = regexp_replace(guest_phone, '\\D', '', 'g')
  limit 1
$$;
