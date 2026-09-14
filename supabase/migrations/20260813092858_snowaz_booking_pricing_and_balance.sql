alter table public.booking_requests
  add column bedroom_choice text,
  add column stay_nights integer,
  add column base_nightly_rate_minor bigint,
  add column additional_guest_count integer,
  add column additional_guest_charge_minor bigint,
  add column total_minor bigint,
  add column balance_paid_minor bigint not null default 0,
  add column balance_payment_method text,
  add column balance_payment_reference text,
  add column balance_paid_at timestamptz;

update public.booking_requests
set bedroom_choice = case when guest_count <= 2 then 'bedroom_1' else 'both_bedrooms' end,
    stay_nights = check_out - check_in,
    base_nightly_rate_minor = case when guest_count <= 2 then 180000 else 230000 end,
    additional_guest_count = greatest(guest_count - 4, 0),
    additional_guest_charge_minor = greatest(guest_count - 4, 0) * 30000 * (check_out - check_in),
    total_minor = (case when guest_count <= 2 then 180000 else 230000 end) * (check_out - check_in)
      + greatest(guest_count - 4, 0) * 30000 * (check_out - check_in);

alter table public.booking_requests
  alter column bedroom_choice set not null,
  alter column stay_nights set not null,
  alter column base_nightly_rate_minor set not null,
  alter column additional_guest_count set not null,
  alter column additional_guest_charge_minor set not null,
  alter column total_minor set not null,
  add constraint booking_requests_bedroom_choice_valid check (bedroom_choice in ('bedroom_1','bedroom_2','both_bedrooms')),
  add constraint booking_requests_bedroom_capacity_valid check (guest_count <= 2 or bedroom_choice = 'both_bedrooms'),
  add constraint booking_requests_pricing_snapshot_valid check (
    stay_nights > 0 and base_nightly_rate_minor >= 0 and additional_guest_count >= 0
    and additional_guest_charge_minor >= 0 and total_minor >= deposit_amount_minor
  ),
  add constraint booking_requests_balance_payment_valid check (
    balance_paid_minor >= 0 and balance_paid_minor <= greatest(total_minor - deposit_amount_minor, 0)
    and ((balance_paid_minor = 0 and balance_payment_method is null and balance_payment_reference is null and balance_paid_at is null)
      or (balance_paid_minor > 0 and balance_payment_method is not null and balance_payment_reference is not null and balance_paid_at is not null))
  );

create or replace function public.submit_snowaz_booking_request(
  request_idempotency uuid, guest_name text, guest_email text, guest_phone text,
  arrival date, departure date, guests integer, bedroom_selection text, requests text,
  contact_method text, consent_version text, token_hash text
)
returns table(booking_id uuid, booking_reference text, deposit_expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  target_id uuid; expiry timestamptz := now() + interval '2 hours';
  nights integer; base_rate bigint; extra_count integer; extra_charge bigint; booking_total bigint;
begin
  if char_length(trim(guest_name)) not between 2 and 120
    or char_length(trim(guest_phone)) not between 7 and 30
    or char_length(trim(coalesce(guest_email,''))) > 254
    or (trim(coalesce(guest_email,'')) <> '' and position('@' in guest_email) < 2)
    or contact_method not in ('whatsapp','messenger','phone','email')
    or guests not between 1 and 8
    or bedroom_selection not in ('bedroom_1','bedroom_2','both_bedrooms')
    or (guests > 2 and bedroom_selection <> 'both_bedrooms')
    or departure <= arrival or arrival < current_date or departure > current_date + 366
    or consent_version <> 'booking-request-v2' or char_length(token_hash) <> 64
    or char_length(coalesce(requests,'')) > 1000
  then raise exception 'invalid booking request'; end if;

  if exists (select 1 from public.snowaz_calendar_ranges r
    where r.check_in < departure and r.check_out > arrival
      and not (r.source_kind='booking_request' and r.source_id = coalesce((select id from public.booking_requests where idempotency_key=request_idempotency), '00000000-0000-0000-0000-000000000000'::uuid)))
  then raise exception 'dates unavailable'; end if;

  nights := departure - arrival;
  base_rate := case when guests <= 2 then 180000 else 230000 end;
  extra_count := greatest(guests - 4, 0);
  extra_charge := extra_count * 30000 * nights;
  booking_total := base_rate * nights + extra_charge;

  insert into public.booking_requests(
    idempotency_key,full_name,normalized_email,phone,preferred_contact,check_in,check_out,
    guest_count,bedroom_choice,stay_nights,base_nightly_rate_minor,additional_guest_count,
    additional_guest_charge_minor,total_minor,special_requests,status,source,consent_version,
    deposit_status,deposit_amount_minor,deposit_token_hash,deposit_token_expires_at
  ) values (
    request_idempotency,trim(guest_name),lower(trim(coalesce(guest_email,''))),trim(guest_phone),contact_method,arrival,departure,
    guests,bedroom_selection,nights,base_rate,extra_count,extra_charge,booking_total,nullif(trim(coalesce(requests,'')),''),
    'pending','snowaz_guest_web',consent_version,'awaiting_payment',100000,token_hash,expiry
  ) on conflict (idempotency_key) do update set
    deposit_token_hash = case when public.booking_requests.deposit_status='awaiting_payment' then excluded.deposit_token_hash else public.booking_requests.deposit_token_hash end,
    deposit_token_expires_at = case when public.booking_requests.deposit_status='awaiting_payment' then excluded.deposit_token_expires_at else public.booking_requests.deposit_token_expires_at end,
    updated_at = now()
  returning id into target_id;
  return query select target_id, 'SNOWAZ-' || upper(substr(replace(target_id::text,'-',''),1,8)), expiry;
end;
$$;
revoke all on function public.submit_snowaz_booking_request(uuid,text,text,text,date,date,integer,text,text,text,text,text) from public;
grant execute on function public.submit_snowaz_booking_request(uuid,text,text,text,date,date,integer,text,text,text,text,text) to anon, authenticated;
revoke all on function public.submit_snowaz_booking_request(uuid,text,text,text,date,date,integer,text,text,text,text) from public, anon, authenticated;

create or replace function public.get_snowaz_admin_dashboard()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if private.snowaz_staff_role() is null then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'templates', coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'slug',t.slug,'maxAdults',t.max_adults,'maxChildren',t.max_children,'baseNightlyRateMinor',t.base_nightly_rate_minor,'displayOrder',t.display_order,'status',t.status) order by t.display_order) from public.room_types t), '[]'::jsonb),
    'inventory', coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'roomNumber',r.room_number,'floor',r.floor,'status',r.status,'roomTypeName',t.name) order by r.room_number) from public.rooms r join public.room_types t on t.id=r.room_type_id), '[]'::jsonb),
    'upcoming', coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'checkIn',r.check_in,'checkOut',r.check_out,'status',r.status,'guestCount',r.guest_count,'totalMinor',r.total_minor,'currency',r.currency,'guestName',g.full_name,'roomNumber',rm.room_number,'roomTypeName',rt.name) order by r.check_in) from public.reservations r join public.guests g on g.id=r.guest_id join public.rooms rm on rm.id=r.room_id join public.room_types rt on rt.id=rm.room_type_id where r.status in ('confirmed','checked_in') and r.check_out >= current_date limit 25), '[]'::jsonb),
    'enquiries', coalesce((select jsonb_agg(jsonb_build_object(
      'id',b.id,'fullName',b.full_name,'email',b.normalized_email,'phone',b.phone,'preferredContact',b.preferred_contact,
      'checkIn',b.check_in,'checkOut',b.check_out,'guestCount',b.guest_count,'bedroomChoice',b.bedroom_choice,
      'stayNights',b.stay_nights,'baseNightlyRateMinor',b.base_nightly_rate_minor,'additionalGuestCount',b.additional_guest_count,
      'additionalGuestChargeMinor',b.additional_guest_charge_minor,'totalMinor',b.total_minor,'depositAmountMinor',b.deposit_amount_minor,
      'balancePaidMinor',b.balance_paid_minor,'remainingBalanceMinor',greatest(b.total_minor-b.deposit_amount_minor-b.balance_paid_minor,0),
      'balancePaymentMethod',b.balance_payment_method,'balancePaymentReference',b.balance_payment_reference,'balancePaidAt',b.balance_paid_at,
      'status',b.status,'depositStatus',b.deposit_status,'depositSenderName',b.deposit_sender_name,'depositReference',b.deposit_reference,
      'depositSubmittedAt',b.deposit_submitted_at,'depositRefundReference',b.deposit_refund_reference,'roomTypeName',rt.name
    ) order by b.created_at desc) from (select * from public.booking_requests order by created_at desc limit 30) b left join public.room_types rt on rt.id=b.room_type_id), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.get_snowaz_admin_dashboard() from public, anon;
grant execute on function public.get_snowaz_admin_dashboard() to authenticated;

create or replace function public.staff_record_snowaz_remaining_balance(target_id uuid, payment_method text, payment_reference text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare amount_due bigint;
begin
  if private.snowaz_staff_role() not in ('manager','admin') then raise exception 'not authorized'; end if;
  if char_length(trim(payment_method)) not between 2 and 40 or char_length(trim(payment_reference)) not between 3 and 80 then raise exception 'invalid payment details'; end if;
  select greatest(total_minor-deposit_amount_minor-balance_paid_minor,0) into amount_due
  from public.booking_requests where id=target_id and status='confirmed' and deposit_status='verified' for update;
  if amount_due is null or amount_due <= 0 then return false; end if;
  update public.booking_requests set balance_paid_minor=balance_paid_minor+amount_due,
    balance_payment_method=trim(payment_method),balance_payment_reference=trim(payment_reference),balance_paid_at=now(),updated_at=now()
  where id=target_id;
  insert into public.audit_log(actor_id,actor_type,action,entity_type,entity_id,request_id,redacted_metadata)
  values (auth.uid(),'staff','booking.remaining_balance_paid','booking_request',target_id,gen_random_uuid(),jsonb_build_object('amountMinor',amount_due,'method',trim(payment_method)));
  return true;
end;
$$;
revoke all on function public.staff_record_snowaz_remaining_balance(uuid,text,text) from public, anon;
grant execute on function public.staff_record_snowaz_remaining_balance(uuid,text,text) to authenticated;
