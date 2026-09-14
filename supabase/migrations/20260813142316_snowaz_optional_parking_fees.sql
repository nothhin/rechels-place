alter table public.booking_requests add column if not exists parking_type text not null default 'none', add column if not exists parking_nightly_rate_minor bigint not null default 0, add column if not exists parking_charge_minor bigint not null default 0;

alter table public.booking_requests add constraint booking_requests_parking_valid check ((parking_type='none' and parking_nightly_rate_minor=0 and parking_charge_minor=0) or (parking_type='car' and parking_nightly_rate_minor=35000 and parking_charge_minor=35000*stay_nights) or (parking_type='motorcycle' and parking_nightly_rate_minor=7500 and parking_charge_minor=7500*stay_nights));

drop function if exists public.submit_snowaz_booking_request(uuid,text,text,text,date,date,integer,text,text,text,text,text);
drop function if exists public.update_snowaz_pending_guest_count(text,integer,text);

create or replace function public.submit_snowaz_booking_request(
  request_idempotency uuid, guest_name text, guest_email text, guest_phone text,
  arrival date, departure date, guests integer, bedroom_selection text, requests text,
  contact_method text, consent_version text, token_hash text, parking_selection text
)
returns table(booking_id uuid, booking_reference text, deposit_expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  target_id uuid; expiry timestamptz := now() + interval '2 hours';
  nights integer; base_rate bigint; extra_count integer; extra_charge bigint; parking_rate bigint; parking_charge bigint; booking_total bigint;
begin
  if char_length(trim(guest_name)) not between 2 and 120
    or char_length(trim(guest_phone)) not between 7 and 30
    or char_length(trim(coalesce(guest_email,''))) > 254
    or (trim(coalesce(guest_email,'')) <> '' and position('@' in guest_email) < 2)
    or contact_method not in ('whatsapp','messenger','phone','email')
    or guests not between 1 and 8
    or bedroom_selection not in ('bedroom_1','bedroom_2','both_bedrooms')
    or parking_selection not in ('none','car','motorcycle')
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
  parking_rate := case when parking_selection='car' then 35000 when parking_selection='motorcycle' then 7500 else 0 end;
  parking_charge := parking_rate*nights;
  booking_total := base_rate * nights + extra_charge + parking_charge;

  insert into public.booking_requests(
    idempotency_key,full_name,normalized_email,phone,preferred_contact,check_in,check_out,
    guest_count,bedroom_choice,stay_nights,base_nightly_rate_minor,additional_guest_count,
    additional_guest_charge_minor,parking_type,parking_nightly_rate_minor,parking_charge_minor,total_minor,special_requests,status,source,consent_version,
    deposit_status,deposit_amount_minor,deposit_token_hash,deposit_token_expires_at
  ) values (
    request_idempotency,trim(guest_name),lower(trim(coalesce(guest_email,''))),trim(guest_phone),contact_method,arrival,departure,
    guests,bedroom_selection,nights,base_rate,extra_count,extra_charge,parking_selection,parking_rate,parking_charge,booking_total,nullif(trim(coalesce(requests,'')),''),
    'pending','snowaz_guest_web',consent_version,'awaiting_payment',100000,token_hash,expiry
  ) on conflict (idempotency_key) do update set
    deposit_token_hash = case when public.booking_requests.deposit_status='awaiting_payment' then excluded.deposit_token_hash else public.booking_requests.deposit_token_hash end,
    deposit_token_expires_at = case when public.booking_requests.deposit_status='awaiting_payment' then excluded.deposit_token_expires_at else public.booking_requests.deposit_token_expires_at end,
    updated_at = now()
  returning id into target_id;
  return query select target_id, 'SNOWAZ-' || upper(substr(replace(target_id::text,'-',''),1,8)), expiry;
end;
$$;


create or replace function public.update_snowaz_pending_guest_count(token_hash text, guests integer, bedroom_selection text, parking_selection text)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  booking public.booking_requests%rowtype;
  nights integer;
  base_rate bigint;
  parking_rate bigint;
  extra_count integer;
  extra_charge bigint;
  parking_charge bigint;
begin
  if guests not between 1 and 8
    or bedroom_selection not in ('bedroom_1','bedroom_2','both_bedrooms')
    or parking_selection not in ('none','car','motorcycle')
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
  parking_rate := case when parking_selection='car' then 35000 when parking_selection='motorcycle' then 7500 else 0 end;
  parking_charge := parking_rate*nights;

  update public.booking_requests set
    guest_count=guests,
    bedroom_choice=bedroom_selection,
    stay_nights=nights,
    base_nightly_rate_minor=base_rate,
    additional_guest_count=extra_count,
    additional_guest_charge_minor=extra_charge,
    parking_type=parking_selection,parking_nightly_rate_minor=parking_rate,parking_charge_minor=parking_charge,
    total_minor=base_rate*nights+extra_charge+parking_charge,
    updated_at=now()
  where id=booking.id;

  insert into public.audit_log(actor_type,action,entity_type,entity_id,request_id,redacted_metadata)
  values('guest','booking.guest_count_updated','booking_request',booking.id,gen_random_uuid(),
    jsonb_build_object('previousGuests',booking.guest_count,'guests',guests,'bedroom',bedroom_selection));
  return true;
end $$;



revoke all on function public.update_snowaz_pending_guest_count(text,integer,text,text) from public,authenticated;

grant execute on function public.update_snowaz_pending_guest_count(text,integer,text,text) to anon;



drop function if exists public.get_snowaz_deposit_request(text);
create function public.get_snowaz_deposit_request(token_hash text) returns table(full_name text,check_in date,check_out date,guest_count integer,bedroom_choice text,parking_type text,deposit_status text,deposit_amount_minor bigint,deposit_token_expires_at timestamptz) language sql stable security definer set search_path='' as $$ select b.full_name,b.check_in,b.check_out,b.guest_count,b.bedroom_choice,b.parking_type,b.deposit_status::text,b.deposit_amount_minor,b.deposit_token_expires_at from public.booking_requests b where b.deposit_token_hash=token_hash and b.deposit_token_expires_at>now() limit 1 $$;
revoke all on function public.get_snowaz_deposit_request(text) from public,authenticated; grant execute on function public.get_snowaz_deposit_request(text) to anon;
