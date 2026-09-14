alter table public.booking_requests drop constraint if exists booking_requests_bedroom_capacity_valid;

update public.booking_requests set bedroom_choice=case when guest_count<=2 then 'bedroom_1' when guest_count<=4 then 'bedroom_2' else 'both_bedrooms' end;

alter table public.booking_requests add constraint booking_requests_bedroom_capacity_valid check (bedroom_choice=case when guest_count<=2 then 'bedroom_1' when guest_count<=4 then 'bedroom_2' else 'both_bedrooms' end);

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
    or bedroom_selection <> (case when guests <= 2 then 'bedroom_1' when guests <= 4 then 'bedroom_2' else 'both_bedrooms' end)
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

create or replace function public.staff_update_snowaz_booking(target_id uuid, arrival date, departure date, guests integer, bedroom_selection text, next_stay_status text, id_type text default null, id_last4 text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare nights integer; base_rate bigint; extra_count integer; extra_charge bigint; booking_total bigint; already_paid bigint; current_status public.booking_request_status;
begin
  if private.snowaz_staff_role() not in ('manager','admin') then raise exception 'not authorized'; end if;
  if guests not between 1 and 8 or departure<=arrival or bedroom_selection not in ('bedroom_1','bedroom_2','both_bedrooms') or bedroom_selection<>(case when guests<=2 then 'bedroom_1' when guests<=4 then 'bedroom_2' else 'both_bedrooms' end) or next_stay_status not in ('upcoming','checked_in','checked_out','no_show') then raise exception 'invalid booking update'; end if;
  select status into current_status from public.booking_requests where id=target_id for update;
  if current_status is null or current_status in ('declined','cancelled') then return false; end if;
  if exists(select 1 from public.snowaz_calendar_ranges r where r.check_in<departure and r.check_out>arrival and not(r.source_kind='booking_request' and r.source_id=target_id))
    or exists(select 1 from public.property_date_blocks x where x.status='active' and x.check_in<departure and x.check_out>arrival) then raise exception 'dates unavailable'; end if;
  nights:=departure-arrival; base_rate:=case when guests<=2 then 180000 else 230000 end; extra_count:=greatest(guests-4,0); extra_charge:=extra_count*30000*nights; booking_total:=base_rate*nights+extra_charge;
  select coalesce(sum(case when direction='payment' then amount_minor else -amount_minor end),0) into already_paid from public.booking_payments where booking_request_id=target_id and status='recorded';
  if already_paid>booking_total then raise exception 'new total below payments received'; end if;
  update public.booking_requests set check_in=arrival,check_out=departure,guest_count=guests,bedroom_choice=bedroom_selection,stay_nights=nights,base_nightly_rate_minor=base_rate,additional_guest_count=extra_count,additional_guest_charge_minor=extra_charge,total_minor=booking_total,stay_status=next_stay_status,
    primary_guest_id_type=nullif(trim(coalesce(id_type,'')),''),primary_guest_id_last4=upper(nullif(trim(coalesce(id_last4,'')),'')),primary_guest_verified_at=case when trim(coalesce(id_type,''))<>'' and trim(coalesce(id_last4,''))~'^[A-Za-z0-9]{4}$' then now() else null end,primary_guest_verified_by=case when trim(coalesce(id_type,''))<>'' then auth.uid() else null end,updated_at=now() where id=target_id;
  update public.snowaz_calendar_ranges set check_in=arrival,check_out=departure,display_status=case when current_status='confirmed' then 'confirmed' else 'held' end where source_kind='booking_request' and source_id=target_id;
  if not found then insert into public.snowaz_calendar_ranges(source_kind,source_id,check_in,check_out,display_status) values('booking_request',target_id,arrival,departure,case when current_status='confirmed' then 'confirmed' else 'held' end); end if;
  insert into public.audit_log(actor_id,actor_type,action,entity_type,entity_id,request_id,redacted_metadata) values(auth.uid(),'staff','booking.updated','booking_request',target_id,gen_random_uuid(),jsonb_build_object('checkIn',arrival,'checkOut',departure,'guests',guests,'bedroom',bedroom_selection,'stayStatus',next_stay_status,'totalMinor',booking_total));
  insert into public.booking_notifications(booking_request_id,notification_type,recipient,channel) select id,'booking_updated',case when preferred_contact='email' then normalized_email else phone end,preferred_contact from public.booking_requests where id=target_id;
  return true;
end $$;

create or replace function public.update_snowaz_pending_guest_count(token_hash text, guests integer, bedroom_selection text)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  booking public.booking_requests%rowtype;
  nights integer;
  base_rate bigint;
  extra_count integer;
  extra_charge bigint;
begin
  if guests not between 1 and 8
    or bedroom_selection not in ('bedroom_1','bedroom_2','both_bedrooms')
    or bedroom_selection <> (case when guests <= 2 then 'bedroom_1' when guests <= 4 then 'bedroom_2' else 'both_bedrooms' end)
  then return false; end if;

  select * into booking from public.booking_requests
  where deposit_token_hash=token_hash
    and deposit_token_expires_at>now()
    and status in ('pending','contacted')
    and deposit_status in ('not_requested','awaiting_payment')
  for update;
  if not found then return false; end if;

  nights := booking.check_out-booking.check_in;
  base_rate := case when guests<=2 then 180000 else 230000 end;
  extra_count := greatest(guests-4,0);
  extra_charge := extra_count*30000*nights;

  update public.booking_requests set
    guest_count=guests,
    bedroom_choice=bedroom_selection,
    stay_nights=nights,
    base_nightly_rate_minor=base_rate,
    additional_guest_count=extra_count,
    additional_guest_charge_minor=extra_charge,
    total_minor=base_rate*nights+extra_charge,
    updated_at=now()
  where id=booking.id;

  insert into public.audit_log(actor_type,action,entity_type,entity_id,request_id,redacted_metadata)
  values('guest','booking.guest_count_updated','booking_request',booking.id,gen_random_uuid(),
    jsonb_build_object('previousGuests',booking.guest_count,'guests',guests,'bedroom',bedroom_selection));
  return true;
end $$;



revoke all on function public.update_snowaz_pending_guest_count(text,integer,text) from public,authenticated;

grant execute on function public.update_snowaz_pending_guest_count(text,integer,text) to anon;
