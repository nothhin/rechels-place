-- Persist and price the complete Uppadar Hollie booking selection server-side.
alter table public.booking_requests
  add column if not exists early_check_in_hours integer not null default 0,
  add column if not exists early_check_in_time time,
  add column if not exists early_check_in_fee_minor bigint not null default 0,
  add column if not exists late_checkout_hours integer not null default 0,
  add column if not exists late_checkout_time time,
  add column if not exists late_checkout_fee_minor bigint not null default 0,
  add column if not exists accommodation_subtotal_minor bigint not null default 0,
  add column if not exists extras_total_minor bigint not null default 0;

update public.booking_requests
set accommodation_subtotal_minor = greatest(total_minor - coalesce(parking_charge_minor,0),0),
    extras_total_minor = coalesce(parking_charge_minor,0)
where accommodation_subtotal_minor = 0 and total_minor > 0;

alter table public.booking_requests drop constraint if exists booking_requests_extra_time_valid;
alter table public.booking_requests add constraint booking_requests_extra_time_valid check (
  early_check_in_hours between 0 and 5 and late_checkout_hours between 0 and 5 and
  early_check_in_fee_minor = early_check_in_hours * 15000 and
  late_checkout_fee_minor = late_checkout_hours * 15000
);

alter table public.booking_requests drop constraint if exists booking_requests_bedroom_capacity_valid;
alter table public.booking_requests add constraint booking_requests_bedroom_capacity_valid check (
  (bedroom_choice='bedroom_1' and guest_count between 1 and 2) or
  (bedroom_choice='bedroom_2' and guest_count between 1 and 6) or
  (bedroom_choice='both_bedrooms' and guest_count between 1 and 6)
);

create or replace function public.submit_snowaz_booking_request(
  request_idempotency uuid, guest_name text, guest_email text, guest_phone text,
  arrival date, departure date, guests integer, bedroom_selection text, requests text,
  contact_method text, consent_version text, token_hash text, parking_selection text,
  early_check_in_hours integer, late_checkout_hours integer
)
returns table(booking_id uuid, booking_reference text, deposit_expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare target_id uuid; expiry timestamptz:=now()+interval '24 hours'; nights integer;
  base_rate bigint:=170000; extra_count integer; extra_charge bigint; parking_rate bigint;
  parking_charge bigint; early_fee bigint; late_fee bigint; accommodation bigint; extras bigint; booking_total bigint;
begin
  if char_length(trim(guest_name)) not between 2 and 120 or char_length(trim(guest_phone)) not between 7 and 30
    or char_length(trim(coalesce(guest_email,'')))>254 or (trim(coalesce(guest_email,''))<>'' and position('@' in guest_email)<2)
    or contact_method not in ('whatsapp','messenger','phone','email') or guests not between 1 and 6
    or bedroom_selection not in ('bedroom_1','bedroom_2') or (bedroom_selection='bedroom_1' and guests>2)
    or parking_selection not in ('none','car','motorcycle') or early_check_in_hours not between 0 and 5
    or late_checkout_hours not between 0 and 5 or departure<=arrival or arrival<current_date
    or departure>current_date+366 or consent_version<>'booking-request-v2' or char_length(token_hash)<>64
    or char_length(coalesce(requests,''))>1000 then raise exception 'invalid booking request'; end if;
  if exists(select 1 from public.snowaz_calendar_ranges r where r.check_in<departure and r.check_out>arrival)
    or exists(select 1 from public.property_date_blocks x where x.status='active' and x.check_in<departure and x.check_out>arrival)
    then raise exception 'dates unavailable'; end if;
  nights:=departure-arrival;
  extra_count:=case when bedroom_selection='bedroom_2' then greatest(guests-2,0) else 0 end;
  extra_charge:=case when bedroom_selection='bedroom_2' then
    (case guests when 3 then 25000 when 4 then 40000 else case when guests>4 then 40000+(guests-4)*25000 else 0 end end)*nights else 0 end;
  parking_rate:=case parking_selection when 'car' then 35000 when 'motorcycle' then 15000 else 0 end;
  parking_charge:=parking_rate*nights; early_fee:=early_check_in_hours*15000; late_fee:=late_checkout_hours*15000;
  accommodation:=base_rate*nights+extra_charge; extras:=parking_charge+early_fee+late_fee; booking_total:=accommodation+extras;
  insert into public.booking_requests(idempotency_key,full_name,normalized_email,phone,preferred_contact,check_in,check_out,
    guest_count,bedroom_choice,stay_nights,base_nightly_rate_minor,additional_guest_count,additional_guest_charge_minor,
    parking_type,parking_nightly_rate_minor,parking_charge_minor,early_check_in_hours,early_check_in_time,early_check_in_fee_minor,
    late_checkout_hours,late_checkout_time,late_checkout_fee_minor,accommodation_subtotal_minor,extras_total_minor,total_minor,
    special_requests,status,source,consent_version,deposit_status,deposit_amount_minor,deposit_token_hash,deposit_token_expires_at)
  values(request_idempotency,trim(guest_name),lower(nullif(trim(guest_email),'')),trim(guest_phone),contact_method,arrival,departure,
    guests,bedroom_selection,nights,base_rate,extra_count,extra_charge,parking_selection,parking_rate,parking_charge,
    early_check_in_hours,case when early_check_in_hours>0 then time '14:00'-early_check_in_hours*interval '1 hour' end,early_fee,
    late_checkout_hours,case when late_checkout_hours>0 then time '11:00'+late_checkout_hours*interval '1 hour' end,late_fee,
    accommodation,extras,booking_total,nullif(trim(coalesce(requests,'')),''),'pending','guest_web',consent_version,
    'awaiting_payment',least(100000,booking_total),token_hash,expiry)
  on conflict(idempotency_key) do update set updated_at=now() returning id into target_id;
  return query select target_id,'RECHEL-'||upper(substr(replace(target_id::text,'-',''),1,8)),expiry;
end $$;
revoke all on function public.submit_snowaz_booking_request(uuid,text,text,text,date,date,integer,text,text,text,text,text,text,integer,integer) from public;
grant execute on function public.submit_snowaz_booking_request(uuid,text,text,text,date,date,integer,text,text,text,text,text,text,integer,integer) to anon,authenticated;

create or replace function public.update_snowaz_pending_guest_count(token_hash text, guests integer, bedroom_selection text,
  parking_selection text, early_hours integer, late_hours integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare booking public.booking_requests%rowtype; nights integer; base_rate bigint:=170000; parking_rate bigint;
  extra_count integer; extra_charge bigint; parking_charge bigint; early_fee bigint; late_fee bigint; accommodation bigint; extras bigint;
begin
  if guests not between 1 and 6 or bedroom_selection not in ('bedroom_1','bedroom_2') or parking_selection not in ('none','car','motorcycle')
    or (bedroom_selection='bedroom_1' and guests>2) or early_hours not between 0 and 5 or late_hours not between 0 and 5 then return false; end if;
  select * into booking from public.booking_requests where deposit_token_hash=token_hash and deposit_token_expires_at>now()
    and status in ('pending','contacted') and deposit_status in ('not_requested','awaiting_payment') for update;
  if not found then return false; end if;
  nights:=booking.check_out-booking.check_in; extra_count:=case when bedroom_selection='bedroom_2' then greatest(guests-2,0) else 0 end;
  extra_charge:=case when bedroom_selection='bedroom_2' then
    (case guests when 3 then 25000 when 4 then 40000 else case when guests>4 then 40000+(guests-4)*25000 else 0 end end)*nights else 0 end;
  parking_rate:=case parking_selection when 'car' then 35000 when 'motorcycle' then 15000 else 0 end;
  parking_charge:=parking_rate*nights; early_fee:=early_hours*15000; late_fee:=late_hours*15000;
  accommodation:=base_rate*nights+extra_charge; extras:=parking_charge+early_fee+late_fee;
  update public.booking_requests set guest_count=guests,bedroom_choice=bedroom_selection,stay_nights=nights,
    base_nightly_rate_minor=base_rate,additional_guest_count=extra_count,additional_guest_charge_minor=extra_charge,
    parking_type=parking_selection,parking_nightly_rate_minor=parking_rate,parking_charge_minor=parking_charge,
    early_check_in_hours=early_hours,early_check_in_time=case when early_hours>0 then time '14:00'-early_hours*interval '1 hour' end,
    early_check_in_fee_minor=early_fee,late_checkout_hours=late_hours,
    late_checkout_time=case when late_hours>0 then time '11:00'+late_hours*interval '1 hour' end,late_checkout_fee_minor=late_fee,
    accommodation_subtotal_minor=accommodation,extras_total_minor=extras,total_minor=accommodation+extras,updated_at=now()
  where id=booking.id; return true;
end $$;
revoke all on function public.update_snowaz_pending_guest_count(text,integer,text,text,integer,integer) from public,authenticated;
grant execute on function public.update_snowaz_pending_guest_count(text,integer,text,text,integer,integer) to anon;

drop function if exists public.get_snowaz_deposit_request(text);
create function public.get_snowaz_deposit_request(token_hash text)
returns table(booking_reference text,full_name text,email text,phone text,check_in date,check_out date,guest_count integer,
  bedroom_choice text,parking_type text,stay_nights integer,base_nightly_rate_minor bigint,additional_guest_count integer,
  additional_guest_charge_minor bigint,parking_nightly_rate_minor bigint,parking_charge_minor bigint,
  early_check_in_hours integer,early_check_in_time time,early_check_in_fee_minor bigint,late_checkout_hours integer,
  late_checkout_time time,late_checkout_fee_minor bigint,accommodation_subtotal_minor bigint,extras_total_minor bigint,total_minor bigint,
  booking_status text,deposit_status text,deposit_amount_minor bigint,deposit_token_expires_at timestamptz)
language sql stable security definer set search_path='' as $$
  select 'RECHEL-'||upper(substr(replace(b.id::text,'-',''),1,8)),b.full_name,b.normalized_email,b.phone,b.check_in,b.check_out,
    b.guest_count,b.bedroom_choice,b.parking_type,b.stay_nights,b.base_nightly_rate_minor,b.additional_guest_count,
    b.additional_guest_charge_minor,b.parking_nightly_rate_minor,b.parking_charge_minor,b.early_check_in_hours,b.early_check_in_time,
    b.early_check_in_fee_minor,b.late_checkout_hours,b.late_checkout_time,b.late_checkout_fee_minor,b.accommodation_subtotal_minor,
    b.extras_total_minor,b.total_minor,b.status::text,b.deposit_status::text,b.deposit_amount_minor,b.deposit_token_expires_at
  from public.booking_requests b where b.deposit_token_hash=token_hash and b.deposit_token_expires_at>now() limit 1
$$;
revoke all on function public.get_snowaz_deposit_request(text) from public,authenticated;
grant execute on function public.get_snowaz_deposit_request(text) to anon;

create or replace function public.get_snowaz_admin_dashboard()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if private.snowaz_staff_role() is null then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'templates',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'slug',t.slug,'maxAdults',t.max_adults,'maxChildren',t.max_children,'baseNightlyRateMinor',t.base_nightly_rate_minor,'displayOrder',t.display_order,'status',t.status) order by t.display_order) from public.room_types t),'[]'::jsonb),
    'inventory',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'roomNumber',r.room_number,'floor',r.floor,'status',r.status,'roomTypeName',t.name) order by r.room_number) from public.rooms r join public.room_types t on t.id=r.room_type_id),'[]'::jsonb),
    'upcoming','[]'::jsonb,
    'enquiries',coalesce((select jsonb_agg(jsonb_build_object(
      'id',b.id,'bookingReference','RECHEL-'||upper(substr(replace(b.id::text,'-',''),1,8)),
      'fullName',b.full_name,'email',b.normalized_email,'phone',b.phone,'preferredContact',b.preferred_contact,
      'checkIn',b.check_in,'checkOut',b.check_out,'guestCount',b.guest_count,'bedroomChoice',b.bedroom_choice,
      'stayNights',b.stay_nights,'baseNightlyRateMinor',b.base_nightly_rate_minor,'additionalGuestCount',b.additional_guest_count,
      'additionalGuestChargeMinor',b.additional_guest_charge_minor,'accommodationSubtotalMinor',b.accommodation_subtotal_minor,
      'parkingType',b.parking_type,'parkingNightlyRateMinor',b.parking_nightly_rate_minor,'parkingChargeMinor',b.parking_charge_minor,
      'earlyCheckInHours',b.early_check_in_hours,'earlyCheckInTime',b.early_check_in_time,'earlyCheckInFeeMinor',b.early_check_in_fee_minor,
      'lateCheckoutHours',b.late_checkout_hours,'lateCheckoutTime',b.late_checkout_time,'lateCheckoutFeeMinor',b.late_checkout_fee_minor,
      'extrasTotalMinor',b.extras_total_minor,'totalMinor',b.total_minor,'depositAmountMinor',b.deposit_amount_minor,
      'balancePaidMinor',greatest(coalesce(pay.paid_minor,0)-case when b.deposit_status='verified' then b.deposit_amount_minor else 0 end,0),
      'remainingBalanceMinor',greatest(b.total_minor-coalesce(pay.paid_minor,0),0),
      'balancePaymentMethod',b.balance_payment_method,'balancePaymentReference',b.balance_payment_reference,'balancePaidAt',b.balance_paid_at,
      'status',b.status,'depositStatus',b.deposit_status,'depositSenderName',b.deposit_sender_name,'depositReference',b.deposit_reference,
      'depositSubmittedAt',b.deposit_submitted_at,'depositRefundReference',b.deposit_refund_reference,'roomTypeName',rt.name
    ) order by b.created_at desc) from (select * from public.booking_requests order by created_at desc limit 30) b
      left join public.room_types rt on rt.id=b.room_type_id
      left join lateral(select coalesce(sum(case when p.direction='payment' then p.amount_minor else -p.amount_minor end),0)::bigint paid_minor from public.booking_payments p where p.booking_request_id=b.id and p.status='recorded') pay on true),'[]'::jsonb)
  ) into result; return result;
end $$;
revoke all on function public.get_snowaz_admin_dashboard() from public,anon;
grant execute on function public.get_snowaz_admin_dashboard() to authenticated;
