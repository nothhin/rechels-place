-- Rechel's Place payment rules:
-- PHP 4,500/night, 50% accommodation down payment, and a separate
-- PHP 1,000 refundable security deposit due upon check-in.

alter table public.booking_requests
  add column if not exists down_payment_amount_minor bigint not null default 0;

comment on column public.booking_requests.down_payment_amount_minor is
  'Snapshot of the 50% accommodation down payment; excludes the refundable security deposit.';

update public.room_types
set base_nightly_rate_minor = 450000,
    updated_at = now()
where slug = 'uppadar-entire-condo';

update public.booking_requests
set down_payment_amount_minor = (greatest(total_minor, 0) + 1) / 2,
    deposit_amount_minor = 100000,
    updated_at = now()
where source in ('guest_web', 'snowaz_guest_web')
  and total_minor is not null;

alter table public.booking_requests
  drop constraint if exists booking_requests_down_payment_amount_valid;

alter table public.booking_requests
  add constraint booking_requests_down_payment_amount_valid
  check (down_payment_amount_minor >= 0);

-- The independent client uses guest_web for new requests. Keep the calendar
-- trigger compatible with historical SnowAZ rows while including new rows.
create or replace function private.sync_snowaz_booking_calendar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  target_id uuid := coalesce(new.id, old.id);
begin
  delete from public.snowaz_calendar_ranges
  where source_kind = 'booking_request' and source_id = target_id;

  if tg_op <> 'DELETE'
    and new.source in ('snowaz_guest_web', 'guest_web')
    and new.status in ('pending', 'contacted', 'confirmed')
  then
    insert into public.snowaz_calendar_ranges
      (source_kind, source_id, check_in, check_out, display_status)
    values (
      'booking_request', new.id, new.check_in, new.check_out,
      case when new.status = 'confirmed' then 'booked' else 'pending' end
    );
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function private.sync_snowaz_booking_calendar() from public, anon, authenticated;

create or replace function public.submit_snowaz_booking_request(
  request_idempotency uuid, guest_name text, guest_email text, guest_phone text,
  arrival date, departure date, guests integer, bedroom_selection text, requests text,
  contact_method text, consent_version text, token_hash text, parking_selection text,
  early_check_in_hours integer, late_checkout_hours integer
)
returns table(booking_id uuid, booking_reference text, deposit_expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  target_id uuid;
  expiry timestamptz := now() + interval '24 hours';
  nights integer;
  base_rate bigint := 450000;
  booking_total bigint;
  down_payment bigint;
begin
  if char_length(trim(guest_name)) not between 2 and 120
    or char_length(trim(guest_phone)) not between 7 and 30
    or char_length(trim(coalesce(guest_email, ''))) > 254
    or (trim(coalesce(guest_email, '')) <> '' and position('@' in guest_email) < 2)
    or contact_method not in ('whatsapp', 'messenger', 'phone', 'email')
    or guests not between 1 and 6
    or coalesce(bedroom_selection, '') <> 'both_bedrooms'
    or coalesce(parking_selection, '') <> 'none'
    or coalesce(early_check_in_hours, 0) <> 0
    or coalesce(late_checkout_hours, 0) <> 0
    or departure <= arrival
    or arrival < current_date
    or departure > current_date + 366
    or consent_version <> 'booking-request-v2'
    or char_length(token_hash) <> 64
    or char_length(coalesce(requests, '')) > 1000
  then
    raise exception 'invalid booking request';
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
  booking_total := base_rate * nights;
  down_payment := (booking_total + 1) / 2;

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
    trim(guest_phone), contact_method, arrival, departure, guests, 'both_bedrooms',
    nights, base_rate, 0, 0, 'none', 0, 0, 0, null, 0, 0, null, 0,
    booking_total, 0, booking_total, down_payment,
    nullif(trim(coalesce(requests, '')), ''), 'pending', 'guest_web', consent_version,
    'awaiting_payment', 100000, token_hash, expiry
  )
  on conflict (idempotency_key) do update set updated_at = now()
  returning id into target_id;

  return query
    select target_id,
      'RECHEL-' || upper(substr(replace(target_id::text, '-', ''), 1, 8)),
      expiry;
end;
$$;

revoke all on function public.submit_snowaz_booking_request(uuid,text,text,text,date,date,integer,text,text,text,text,text,text,integer,integer) from public;
grant execute on function public.submit_snowaz_booking_request(uuid,text,text,text,date,date,integer,text,text,text,text,text,text,integer,integer) to anon, authenticated;

create or replace function public.update_snowaz_pending_guest_count(
  token_hash text, guests integer, bedroom_selection text,
  parking_selection text, early_hours integer, late_hours integer
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  booking public.booking_requests%rowtype;
  nights integer;
  base_rate bigint := 450000;
  accommodation bigint;
begin
  if guests not between 1 and 6
    or coalesce(bedroom_selection, '') <> 'both_bedrooms'
    or coalesce(parking_selection, '') <> 'none'
    or coalesce(early_hours, 0) <> 0
    or coalesce(late_hours, 0) <> 0
  then
    return false;
  end if;

  select * into booking
  from public.booking_requests
  where deposit_token_hash = token_hash
    and deposit_token_expires_at > now()
    and status in ('pending', 'contacted')
    and deposit_status in ('not_requested', 'awaiting_payment')
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
    down_payment_amount_minor = (accommodation + 1) / 2,
    deposit_amount_minor = 100000,
    updated_at = now()
  where id = booking.id;
  return true;
end;
$$;

revoke all on function public.update_snowaz_pending_guest_count(text,integer,text,text,integer,integer) from public, authenticated;
grant execute on function public.update_snowaz_pending_guest_count(text,integer,text,text,integer,integer) to anon;

create or replace function public.staff_start_snowaz_deposit(
  target_id uuid, token_hash text, expires_at timestamptz
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  booking_total bigint;
  down_payment bigint;
begin
  if private.snowaz_staff_role() not in ('manager', 'admin') then
    raise exception 'not authorized';
  end if;

  select total_minor into booking_total
  from public.booking_requests
  where id = target_id
    and source in ('guest_web', 'snowaz_guest_web')
    and status in ('pending', 'contacted')
  for update;
  if not found then return false; end if;

  down_payment := (greatest(booking_total, 0) + 1) / 2;
  update public.booking_requests set
    status = 'contacted',
    deposit_status = 'awaiting_payment',
    down_payment_amount_minor = down_payment,
    deposit_amount_minor = 100000,
    deposit_token_hash = token_hash,
    deposit_token_expires_at = expires_at,
    deposit_sender_name = null,
    deposit_reference = null,
    deposit_submitted_at = null,
    deposit_verified_at = null,
    deposit_refund_reference = null,
    deposit_refunded_at = null,
    updated_at = now()
  where id = target_id;

  insert into public.audit_log(
    actor_id, actor_type, action, entity_type, entity_id, request_id, redacted_metadata
  )
  select id, 'staff', 'booking.deposit_requested', 'booking_request', target_id,
    gen_random_uuid(), jsonb_build_object(
      'downPaymentAmountMinor', down_payment,
      'securityDepositAmountMinor', 100000,
      'expiresAt', expires_at
    )
  from public.staff_users
  where identity_provider_subject = (select auth.uid())::text
  limit 1;
  return true;
end;
$$;

revoke all on function public.staff_start_snowaz_deposit(uuid,text,timestamptz) from public, anon;
grant execute on function public.staff_start_snowaz_deposit(uuid,text,timestamptz) to authenticated;

create or replace function public.submit_snowaz_deposit_reference(
  token_hash text, sender_name text, payment_reference text
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  target_id uuid;
  down_payment bigint;
  security_deposit bigint;
begin
  if char_length(trim(sender_name)) not between 2 and 120
    or char_length(trim(payment_reference)) not between 6 and 80
  then
    return false;
  end if;

  update public.booking_requests set
    down_payment_amount_minor = greatest(
      coalesce(down_payment_amount_minor, 0), (greatest(total_minor, 0) + 1) / 2
    ),
    deposit_amount_minor = 100000,
    deposit_status = 'submitted',
    deposit_sender_name = trim(sender_name),
    deposit_reference = trim(payment_reference),
    deposit_submitted_at = now(),
    deposit_token_expires_at = ((check_out + 30)::timestamp at time zone 'Asia/Manila'),
    updated_at = now()
  where deposit_token_hash = token_hash
    and deposit_status = 'awaiting_payment'
    and deposit_token_expires_at > now()
  returning id, down_payment_amount_minor, deposit_amount_minor
    into target_id, down_payment, security_deposit;
  if target_id is null then return false; end if;

  insert into public.audit_log(
    actor_type, action, entity_type, entity_id, request_id, redacted_metadata
  ) values (
    'guest', 'booking.deposit_reference_submitted', 'booking_request', target_id,
    gen_random_uuid(), jsonb_build_object(
      'downPaymentAmountMinor', down_payment,
      'securityDepositAmountMinor', security_deposit
    )
  );
  return true;
end;
$$;

revoke all on function public.submit_snowaz_deposit_reference(text,text,text) from public;
grant execute on function public.submit_snowaz_deposit_reference(text,text,text) to anon, authenticated;

create or replace function public.staff_verify_snowaz_deposit(target_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  deposit public.booking_requests%rowtype;
begin
  if private.snowaz_staff_role() not in ('manager', 'admin') then
    raise exception 'not authorized';
  end if;

  update public.booking_requests set
    status = 'confirmed',
    deposit_status = 'verified',
    down_payment_amount_minor = greatest(
      coalesce(down_payment_amount_minor, 0), (greatest(total_minor, 0) + 1) / 2
    ),
    deposit_amount_minor = 100000,
    deposit_verified_at = now(),
    deposit_token_expires_at = ((check_out + 30)::timestamp at time zone 'Asia/Manila'),
    updated_at = now()
  where id = target_id
    and status in ('pending', 'contacted')
    and deposit_status = 'submitted'
  returning * into deposit;
  if not found then return false; end if;

  insert into public.booking_payments(
    booking_request_id, direction, category, amount_minor,
    payment_method, payment_reference, recorded_by, recorded_at
  ) values (
    target_id, 'payment', 'down_payment', deposit.down_payment_amount_minor,
    'bank_transfer', deposit.deposit_reference, auth.uid(),
    coalesce(deposit.deposit_submitted_at, now())
  ) on conflict do nothing;

  insert into public.audit_log(
    actor_id, actor_type, action, entity_type, entity_id, request_id, redacted_metadata
  )
  select id, 'staff', 'booking.deposit_verified', 'booking_request', target_id,
    gen_random_uuid(), jsonb_build_object(
      'downPaymentAmountMinor', deposit.down_payment_amount_minor,
      'securityDepositAmountMinor', deposit.deposit_amount_minor
    )
  from public.staff_users
  where identity_provider_subject = (select auth.uid())::text
  limit 1;
  return true;
end;
$$;

revoke all on function public.staff_verify_snowaz_deposit(uuid) from public, anon;
grant execute on function public.staff_verify_snowaz_deposit(uuid) to authenticated;

create or replace function public.staff_record_and_verify_snowaz_deposit(
  target_id uuid, sender_name text, payment_reference text
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  deposit public.booking_requests%rowtype;
begin
  if private.snowaz_staff_role() not in ('manager', 'admin')
    or char_length(trim(sender_name)) not between 2 and 120
    or char_length(trim(payment_reference)) not between 6 and 80
  then
    raise exception 'invalid request';
  end if;

  select id into actor
  from public.staff_users
  where identity_provider_subject = (select auth.uid())::text
    and status = 'active'
  limit 1;

  update public.booking_requests set
    status = 'confirmed',
    deposit_status = 'verified',
    down_payment_amount_minor = greatest(
      coalesce(down_payment_amount_minor, 0), (greatest(total_minor, 0) + 1) / 2
    ),
    deposit_amount_minor = 100000,
    deposit_sender_name = trim(sender_name),
    deposit_reference = trim(payment_reference),
    deposit_submitted_at = now(),
    deposit_verified_at = now(),
    deposit_token_expires_at = ((check_out + 30)::timestamp at time zone 'Asia/Manila'),
    updated_at = now()
  where id = target_id
    and status in ('pending', 'contacted')
    and deposit_status = 'awaiting_payment'
    and deposit_token_expires_at > now()
  returning * into deposit;
  if not found then return false; end if;

  insert into public.booking_payments(
    booking_request_id, direction, category, amount_minor,
    payment_method, payment_reference, recorded_by
  ) values (
    target_id, 'payment', 'down_payment', deposit.down_payment_amount_minor,
    'messenger_receipt', trim(payment_reference), auth.uid()
  ) on conflict do nothing;

  insert into public.audit_log(
    actor_id, actor_type, action, entity_type, entity_id, request_id, redacted_metadata
  ) values (
    actor, 'staff', 'booking.deposit_recorded_and_verified', 'booking_request', target_id,
    gen_random_uuid(), jsonb_build_object(
      'downPaymentAmountMinor', deposit.down_payment_amount_minor,
      'securityDepositAmountMinor', deposit.deposit_amount_minor,
      'source', 'messenger_receipt'
    )
  );
  return true;
end;
$$;

revoke all on function public.staff_record_and_verify_snowaz_deposit(uuid,text,text) from public, anon;
grant execute on function public.staff_record_and_verify_snowaz_deposit(uuid,text,text) to authenticated;

create or replace function public.staff_refund_snowaz_deposit(
  target_id uuid, refund_reference text
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  security_deposit bigint;
begin
  if private.snowaz_staff_role() not in ('manager', 'admin')
    or char_length(trim(refund_reference)) not between 6 and 80
  then
    raise exception 'invalid request';
  end if;

  select id into actor
  from public.staff_users
  where identity_provider_subject = (select auth.uid())::text
  limit 1;

  update public.booking_requests set
    deposit_status = 'refunded',
    deposit_refund_reference = trim(refund_reference),
    deposit_refunded_at = now(),
    deposit_token_expires_at = now() + interval '30 days',
    updated_at = now()
  where id = target_id
    and deposit_status in ('verified', 'refund_pending')
  returning deposit_amount_minor into security_deposit;
  if not found then return false; end if;

  insert into public.audit_log(
    actor_id, actor_type, action, entity_type, entity_id, request_id, redacted_metadata
  ) values (
    actor, 'staff', 'booking.deposit_refunded', 'booking_request', target_id,
    gen_random_uuid(), jsonb_build_object(
      'securityDepositAmountMinor', security_deposit,
      'refundReference', trim(refund_reference)
    )
  );
  return true;
end;
$$;

revoke all on function public.staff_refund_snowaz_deposit(uuid,text) from public, anon;
grant execute on function public.staff_refund_snowaz_deposit(uuid,text) to authenticated;

drop function if exists public.get_snowaz_deposit_request(text);

create function public.get_snowaz_deposit_request(token_hash text)
returns table(
  booking_reference text, full_name text, email text, phone text,
  check_in date, check_out date, guest_count integer, bedroom_choice text,
  parking_type text, stay_nights integer, base_nightly_rate_minor bigint,
  additional_guest_count integer, additional_guest_charge_minor bigint,
  parking_nightly_rate_minor bigint, parking_charge_minor bigint,
  early_check_in_hours integer, early_check_in_time time,
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
    b.guest_count, b.bedroom_choice, b.parking_type, b.stay_nights,
    b.base_nightly_rate_minor, b.additional_guest_count, b.additional_guest_charge_minor,
    b.parking_nightly_rate_minor, b.parking_charge_minor,
    b.early_check_in_hours, b.early_check_in_time, b.early_check_in_fee_minor,
    b.late_checkout_hours, b.late_checkout_time, b.late_checkout_fee_minor,
    b.accommodation_subtotal_minor, b.extras_total_minor, b.total_minor,
    b.status::text, b.deposit_status::text, b.down_payment_amount_minor,
    b.deposit_amount_minor, b.deposit_token_expires_at
  from public.booking_requests b
  where b.deposit_token_hash = token_hash
    and b.deposit_token_expires_at > now()
  limit 1
$$;

revoke all on function public.get_snowaz_deposit_request(text) from public, authenticated;
grant execute on function public.get_snowaz_deposit_request(text) to anon, authenticated;

create or replace function public.get_snowaz_admin_dashboard()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  if private.snowaz_staff_role() is null then raise exception 'not authorized'; end if;

  select jsonb_build_object(
    'templates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', t.name, 'slug', t.slug, 'maxAdults', t.max_adults,
        'maxChildren', t.max_children, 'baseNightlyRateMinor', t.base_nightly_rate_minor,
        'displayOrder', t.display_order, 'status', t.status
      ) order by t.display_order)
      from public.room_types t
    ), '[]'::jsonb),
    'inventory', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'roomNumber', r.room_number, 'floor', r.floor,
        'status', r.status, 'roomTypeName', t.name
      ) order by r.room_number)
      from public.rooms r join public.room_types t on t.id = r.room_type_id
    ), '[]'::jsonb),
    'upcoming', '[]'::jsonb,
    'enquiries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'bookingReference', 'RECHEL-' || upper(substr(replace(b.id::text, '-', ''), 1, 8)),
        'fullName', b.full_name, 'email', b.normalized_email, 'phone', b.phone,
        'preferredContact', b.preferred_contact, 'checkIn', b.check_in,
        'checkOut', b.check_out, 'guestCount', b.guest_count,
        'bedroomChoice', b.bedroom_choice, 'stayNights', b.stay_nights,
        'baseNightlyRateMinor', b.base_nightly_rate_minor,
        'additionalGuestCount', b.additional_guest_count,
        'additionalGuestChargeMinor', b.additional_guest_charge_minor,
        'accommodationSubtotalMinor', b.accommodation_subtotal_minor,
        'parkingType', b.parking_type, 'parkingNightlyRateMinor', b.parking_nightly_rate_minor,
        'parkingChargeMinor', b.parking_charge_minor,
        'earlyCheckInHours', b.early_check_in_hours, 'earlyCheckInTime', b.early_check_in_time,
        'earlyCheckInFeeMinor', b.early_check_in_fee_minor,
        'lateCheckoutHours', b.late_checkout_hours, 'lateCheckoutTime', b.late_checkout_time,
        'lateCheckoutFeeMinor', b.late_checkout_fee_minor,
        'extrasTotalMinor', b.extras_total_minor, 'totalMinor', b.total_minor,
        'downPaymentAmountMinor', b.down_payment_amount_minor,
        'securityDepositAmountMinor', b.deposit_amount_minor,
        'depositAmountMinor', b.deposit_amount_minor,
        'balancePaidMinor', coalesce(pay.balance_paid_minor, 0),
        'remainingBalanceMinor', greatest(b.total_minor - coalesce(pay.paid_minor, 0), 0),
        'balancePaymentMethod', b.balance_payment_method,
        'balancePaymentReference', b.balance_payment_reference,
        'balancePaidAt', b.balance_paid_at, 'status', b.status,
        'depositStatus', b.deposit_status, 'depositSenderName', b.deposit_sender_name,
        'depositReference', b.deposit_reference, 'depositSubmittedAt', b.deposit_submitted_at,
        'depositRefundReference', b.deposit_refund_reference, 'roomTypeName', rt.name
      ) order by b.created_at desc)
      from (select * from public.booking_requests order by created_at desc limit 30) b
      left join public.room_types rt on rt.id = b.room_type_id
      left join lateral (
        select
          coalesce(sum(case when p.direction = 'payment' then p.amount_minor else -p.amount_minor end), 0)::bigint as paid_minor,
          coalesce(sum(case
            when p.category = 'balance' and p.direction = 'payment' then p.amount_minor
            when p.category = 'balance' and p.direction = 'refund' then -p.amount_minor
            else 0
          end), 0)::bigint as balance_paid_minor
        from public.booking_payments p
        where p.booking_request_id = b.id and p.status = 'recorded'
      ) pay on true
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_snowaz_admin_dashboard() from public, anon;
grant execute on function public.get_snowaz_admin_dashboard() to authenticated;

create or replace function public.staff_update_snowaz_booking(
  target_id uuid, arrival date, departure date, guests integer,
  bedroom_selection text, next_stay_status text,
  id_type text default null, id_last4 text default null
)
returns boolean language plpgsql security definer set search_path = '' as $$
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
  if private.snowaz_staff_role() not in ('manager', 'admin') then
    raise exception 'not authorized';
  end if;
  if guests not between 1 and 6 or departure <= arrival
    or bedroom_selection not in ('bedroom_1', 'bedroom_2', 'both_bedrooms')
    or (bedroom_selection = 'bedroom_1' and guests > 2)
    or next_stay_status not in ('upcoming', 'checked_in', 'checked_out', 'no_show')
  then
    raise exception 'invalid booking update';
  end if;

  select status, parking_type, parking_nightly_rate_minor,
    early_check_in_hours, early_check_in_fee_minor,
    late_checkout_hours, late_checkout_fee_minor
  into current_status, current_parking_type, parking_rate,
    current_early_hours, early_fee, current_late_hours, late_fee
  from public.booking_requests
  where id = target_id
  for update;
  if current_status is null or current_status in ('declined', 'cancelled') then
    return false;
  end if;

  if exists (
    select 1 from public.snowaz_calendar_ranges r
    where r.check_in < departure and r.check_out > arrival
      and not (r.source_kind = 'booking_request' and r.source_id = target_id)
  ) or exists (
    select 1 from public.property_date_blocks x
    where x.status = 'active' and x.check_in < departure and x.check_out > arrival
  ) then
    raise exception 'dates unavailable';
  end if;

  nights := departure - arrival;
  if bedroom_selection = 'both_bedrooms' then
    base_rate := 450000;
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
      (case guests
        when 3 then 25000
        when 4 then 40000
        else case when guests > 4 then 40000 + (guests - 4) * 25000 else 0 end
      end) * nights
      else 0
    end;
    parking_charge := coalesce(parking_rate, 0) * nights;
  end if;

  accommodation := base_rate * nights + extra_charge;
  extras := parking_charge + coalesce(early_fee, 0) + coalesce(late_fee, 0);
  booking_total := accommodation + extras;

  select coalesce(sum(case when direction = 'payment' then amount_minor else -amount_minor end), 0)
  into already_paid
  from public.booking_payments
  where booking_request_id = target_id and status = 'recorded';
  if already_paid > booking_total then raise exception 'new total below payments received'; end if;

  update public.booking_requests set
    check_in = arrival, check_out = departure, guest_count = guests,
    bedroom_choice = bedroom_selection, stay_nights = nights,
    base_nightly_rate_minor = base_rate, additional_guest_count = extra_count,
    additional_guest_charge_minor = extra_charge,
    parking_type = case when bedroom_selection = 'both_bedrooms' then 'none' else current_parking_type end,
    parking_nightly_rate_minor = case when bedroom_selection = 'both_bedrooms' then 0 else coalesce(parking_rate, 0) end,
    parking_charge_minor = case when bedroom_selection = 'both_bedrooms' then 0 else parking_charge end,
    early_check_in_hours = case when bedroom_selection = 'both_bedrooms' then 0 else coalesce(current_early_hours, 0) end,
    early_check_in_time = case when bedroom_selection = 'both_bedrooms' then null else early_check_in_time end,
    early_check_in_fee_minor = case when bedroom_selection = 'both_bedrooms' then 0 else coalesce(early_fee, 0) end,
    late_checkout_hours = case when bedroom_selection = 'both_bedrooms' then 0 else coalesce(current_late_hours, 0) end,
    late_checkout_time = case when bedroom_selection = 'both_bedrooms' then null else late_checkout_time end,
    late_checkout_fee_minor = case when bedroom_selection = 'both_bedrooms' then 0 else coalesce(late_fee, 0) end,
    accommodation_subtotal_minor = accommodation, extras_total_minor = extras,
    total_minor = booking_total,
    down_payment_amount_minor = (booking_total + 1) / 2,
    deposit_amount_minor = 100000,
    stay_status = next_stay_status,
    primary_guest_id_type = nullif(trim(coalesce(id_type, '')), ''),
    primary_guest_id_last4 = upper(nullif(trim(coalesce(id_last4, '')), '')),
    primary_guest_verified_at = case
      when trim(coalesce(id_type, '')) <> ''
        and trim(coalesce(id_last4, '')) ~ '^[A-Za-z0-9]{4}$'
      then now()
    end,
    primary_guest_verified_by = case when trim(coalesce(id_type, '')) <> '' then auth.uid() end,
    updated_at = now()
  where id = target_id;

  update public.snowaz_calendar_ranges
  set check_in = arrival,
      check_out = departure,
      display_status = case when current_status = 'confirmed' then 'booked' else 'pending' end
  where source_kind = 'booking_request' and source_id = target_id;
  if not found then
    insert into public.snowaz_calendar_ranges
      (source_kind, source_id, check_in, check_out, display_status)
    values (
      'booking_request', target_id, arrival, departure,
      case when current_status = 'confirmed' then 'booked' else 'pending' end
    );
  end if;

  insert into public.audit_log(
    actor_id, actor_type, action, entity_type, entity_id, request_id, redacted_metadata
  ) values (
    auth.uid(), 'staff', 'booking.updated', 'booking_request', target_id,
    gen_random_uuid(), jsonb_build_object(
      'checkIn', arrival, 'checkOut', departure, 'guests', guests,
      'bedroom', bedroom_selection, 'totalMinor', booking_total
    )
  );
  return true;
end;
$$;

revoke all on function public.staff_update_snowaz_booking(uuid,date,date,integer,text,text,text,text) from public, anon;
grant execute on function public.staff_update_snowaz_booking(uuid,date,date,integer,text,text,text,text) to authenticated;

create or replace function public.staff_get_snowaz_operations()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  if private.snowaz_staff_role() is null then raise exception 'not authorized'; end if;

  select jsonb_build_object(
    'bookings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'reference', 'RECHEL-' || upper(substr(replace(b.id::text, '-', ''), 1, 8)),
        'fullName', b.full_name, 'phone', b.phone, 'email', b.normalized_email,
        'checkIn', b.check_in, 'checkOut', b.check_out, 'stayNights', b.stay_nights,
        'guestCount', b.guest_count, 'bedroomChoice', b.bedroom_choice,
        'bookingStatus', b.status, 'stayStatus', b.stay_status,
        'baseNightlyRateMinor', b.base_nightly_rate_minor,
        'additionalGuestCount', b.additional_guest_count,
        'additionalGuestChargeMinor', b.additional_guest_charge_minor,
        'accommodationSubtotalMinor', b.accommodation_subtotal_minor,
        'parkingType', b.parking_type, 'parkingNightlyRateMinor', b.parking_nightly_rate_minor,
        'parkingChargeMinor', b.parking_charge_minor,
        'earlyCheckInHours', b.early_check_in_hours, 'earlyCheckInTime', b.early_check_in_time,
        'earlyCheckInFeeMinor', b.early_check_in_fee_minor,
        'lateCheckoutHours', b.late_checkout_hours, 'lateCheckoutTime', b.late_checkout_time,
        'lateCheckoutFeeMinor', b.late_checkout_fee_minor,
        'extrasTotalMinor', b.extras_total_minor, 'totalMinor', b.total_minor,
        'downPaymentAmountMinor', b.down_payment_amount_minor,
        'securityDepositAmountMinor', b.deposit_amount_minor,
        'depositStatus', b.deposit_status,
        'depositAmountMinor', case when b.deposit_status = 'verified' then b.deposit_amount_minor else 0 end,
        'paidMinor', coalesce(pay.paid_minor, 0),
        'remainingMinor', greatest(b.total_minor - coalesce(pay.paid_minor, 0), 0),
        'idType', b.primary_guest_id_type, 'idLast4', b.primary_guest_id_last4,
        'idVerifiedAt', b.primary_guest_verified_at,
        'payments', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', p.id, 'direction', p.direction, 'category', p.category,
            'amountMinor', p.amount_minor, 'method', p.payment_method,
            'reference', p.payment_reference, 'status', p.status,
            'recordedAt', p.recorded_at, 'reversalReason', p.reversal_reason
          ) order by p.recorded_at desc)
          from public.booking_payments p
          where p.booking_request_id = b.id
        ), '[]'::jsonb)
      ) order by b.check_in desc)
      from public.booking_requests b
      left join lateral (
        select coalesce(sum(case when p.direction = 'payment' then p.amount_minor else -p.amount_minor end), 0)::bigint as paid_minor
        from public.booking_payments p
        where p.booking_request_id = b.id and p.status = 'recorded'
      ) pay on true
      where b.status = 'confirmed'
    ), '[]'::jsonb),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'checkIn', x.check_in, 'checkOut', x.check_out,
        'reason', x.reason, 'status', x.status
      ) order by x.check_in)
      from public.property_date_blocks x
    ), '[]'::jsonb),
    'notifications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id, 'bookingId', n.booking_request_id, 'type', n.notification_type,
        'recipient', n.recipient, 'channel', n.channel, 'status', n.status,
        'dueAt', n.due_at, 'attempts', n.attempt_count
      ) order by n.created_at desc)
      from (select * from public.booking_notifications order by created_at desc limit 50) n
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.staff_get_snowaz_operations() from public, anon;
grant execute on function public.staff_get_snowaz_operations() to authenticated;
