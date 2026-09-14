alter table public.booking_requests
  add column preferred_contact text not null default 'whatsapp'
  check (preferred_contact in ('whatsapp','messenger','phone','email'));

drop policy if exists "Public can submit SnowAZ booking requests" on public.booking_requests;
revoke insert on public.booking_requests from anon, authenticated;

create or replace function public.submit_snowaz_booking_request(
  request_idempotency uuid,
  guest_name text,
  guest_email text,
  guest_phone text,
  arrival date,
  departure date,
  guests integer,
  requests text,
  contact_method text,
  consent_version text,
  token_hash text
)
returns table(booking_id uuid, booking_reference text, deposit_expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare target_id uuid; expiry timestamptz := now() + interval '2 hours';
begin
  if char_length(trim(guest_name)) not between 2 and 120
    or char_length(trim(guest_phone)) not between 7 and 30
    or char_length(trim(coalesce(guest_email,''))) > 254
    or (trim(coalesce(guest_email,'')) <> '' and position('@' in guest_email) < 2)
    or contact_method not in ('whatsapp','messenger','phone','email')
    or (contact_method = 'email' and trim(coalesce(guest_email,'')) = '')
    or guests not between 1 and 8
    or departure <= arrival or arrival < current_date or departure > current_date + 366
    or consent_version <> 'booking-request-v2'
    or char_length(token_hash) <> 64
    or char_length(coalesce(requests,'')) > 1000
  then raise exception 'invalid booking request'; end if;

  if exists (
    select 1 from public.snowaz_calendar_ranges r
    where r.check_in < departure and r.check_out > arrival
      and not (r.source_kind='booking_request' and r.source_id = coalesce((select id from public.booking_requests where idempotency_key=request_idempotency), '00000000-0000-0000-0000-000000000000'::uuid))
  ) then raise exception 'dates unavailable'; end if;

  insert into public.booking_requests(
    idempotency_key,full_name,normalized_email,phone,preferred_contact,
    check_in,check_out,guest_count,special_requests,status,source,
    consent_version,deposit_status,deposit_amount_minor,deposit_token_hash,deposit_token_expires_at
  ) values (
    request_idempotency,trim(guest_name),lower(trim(coalesce(guest_email,''))),trim(guest_phone),contact_method,
    arrival,departure,guests,nullif(trim(coalesce(requests,'')),''),'pending','snowaz_guest_web',
    consent_version,'awaiting_payment',100000,token_hash,expiry
  )
  on conflict (idempotency_key) do update set
    deposit_token_hash = case when public.booking_requests.deposit_status='awaiting_payment' then excluded.deposit_token_hash else public.booking_requests.deposit_token_hash end,
    deposit_token_expires_at = case when public.booking_requests.deposit_status='awaiting_payment' then excluded.deposit_token_expires_at else public.booking_requests.deposit_token_expires_at end,
    updated_at = now()
  returning id into target_id;

  return query select target_id, 'SNOWAZ-' || upper(substr(replace(target_id::text,'-',''),1,8)), expiry;
end;
$$;
revoke all on function public.submit_snowaz_booking_request(uuid,text,text,text,date,date,integer,text,text,text,text) from public;
grant execute on function public.submit_snowaz_booking_request(uuid,text,text,text,date,date,integer,text,text,text,text) to anon, authenticated;

create or replace function public.expire_snowaz_deposit_holds()
returns integer language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  update public.booking_requests set status='cancelled',updated_at=now()
  where deposit_status='awaiting_payment' and deposit_token_expires_at <= now() and status in ('pending','contacted');
  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke all on function public.expire_snowaz_deposit_holds() from public;
revoke all on function public.expire_snowaz_deposit_holds() from anon, authenticated;

create or replace function public.get_snowaz_admin_dashboard()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if private.snowaz_staff_role() is null then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'templates', coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'slug',t.slug,'maxAdults',t.max_adults,'maxChildren',t.max_children,'baseNightlyRateMinor',t.base_nightly_rate_minor,'displayOrder',t.display_order,'status',t.status) order by t.display_order) from public.room_types t), '[]'::jsonb),
    'inventory', coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'roomNumber',r.room_number,'floor',r.floor,'status',r.status,'roomTypeName',t.name) order by r.room_number) from public.rooms r join public.room_types t on t.id=r.room_type_id), '[]'::jsonb),
    'upcoming', coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'checkIn',r.check_in,'checkOut',r.check_out,'status',r.status,'guestCount',r.guest_count,'totalMinor',r.total_minor,'currency',r.currency,'guestName',g.full_name,'roomNumber',rm.room_number,'roomTypeName',rt.name) order by r.check_in) from public.reservations r join public.guests g on g.id=r.guest_id join public.rooms rm on rm.id=r.room_id join public.room_types rt on rt.id=rm.room_type_id where r.status in ('confirmed','checked_in') and r.check_out >= current_date limit 25), '[]'::jsonb),
    'enquiries', coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'fullName',b.full_name,'email',b.normalized_email,'phone',b.phone,'preferredContact',b.preferred_contact,'checkIn',b.check_in,'checkOut',b.check_out,'guestCount',b.guest_count,'status',b.status,'depositStatus',b.deposit_status,'depositSenderName',b.deposit_sender_name,'depositReference',b.deposit_reference,'depositSubmittedAt',b.deposit_submitted_at,'depositRefundReference',b.deposit_refund_reference,'roomTypeName',rt.name) order by b.created_at desc) from (select * from public.booking_requests order by created_at desc limit 30) b left join public.room_types rt on rt.id=b.room_type_id), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;
