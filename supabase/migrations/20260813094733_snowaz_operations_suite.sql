alter table public.booking_requests
  add column stay_status text not null default 'upcoming',
  add column cancellation_reason text,
  add column cancelled_at timestamptz,
  add column primary_guest_id_type text,
  add column primary_guest_id_last4 text,
  add column primary_guest_verified_at timestamptz,
  add column primary_guest_verified_by uuid references auth.users(id),
  add constraint booking_requests_stay_status_valid check (stay_status in ('upcoming','checked_in','checked_out','no_show')),
  add constraint booking_requests_guest_id_valid check (
    (primary_guest_id_type is null and primary_guest_id_last4 is null)
    or (char_length(primary_guest_id_type) between 2 and 40 and primary_guest_id_last4 ~ '^[A-Za-z0-9]{4}$')
  );

create table public.booking_payments (
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid not null references public.booking_requests(id) on delete restrict,
  direction text not null check (direction in ('payment','refund')),
  category text not null check (category in ('down_payment','balance','adjustment','refund')),
  amount_minor bigint not null check (amount_minor > 0),
  payment_method text not null,
  payment_reference text not null,
  status text not null default 'recorded' check (status in ('recorded','reversed')),
  recorded_by uuid references auth.users(id),
  recorded_at timestamptz not null default now(),
  reversed_by uuid references auth.users(id),
  reversed_at timestamptz,
  reversal_reason text,
  unique (booking_request_id, direction, payment_reference)
);
create index booking_payments_booking_idx on public.booking_payments(booking_request_id, recorded_at desc);
alter table public.booking_payments enable row level security;

create table public.property_date_blocks (
  id uuid primary key default gen_random_uuid(),
  check_in date not null,
  check_out date not null,
  reason text not null,
  status text not null default 'active' check (status in ('active','released')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  released_by uuid references auth.users(id),
  released_at timestamptz,
  check (check_out > check_in)
);
create index property_date_blocks_active_dates_idx on public.property_date_blocks(check_in, check_out) where status='active';
alter table public.property_date_blocks enable row level security;

create table public.booking_notifications (
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid not null references public.booking_requests(id) on delete cascade,
  notification_type text not null check (notification_type in ('booking_updated','payment_recorded','payment_due','arrival_reminder','cancellation','refund')),
  recipient text not null,
  channel text not null check (channel in ('email','phone','messenger','whatsapp')),
  due_at timestamptz not null default now(),
  status text not null default 'queued' check (status in ('queued','sent','failed','cancelled')),
  attempt_count integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index booking_notifications_queue_idx on public.booking_notifications(status, due_at) where status='queued';
create index booking_notifications_booking_idx on public.booking_notifications(booking_request_id);
alter table public.booking_notifications enable row level security;

create or replace function private.reject_snowaz_blocked_dates()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.property_date_blocks x where x.status='active' and x.check_in<new.check_out and x.check_out>new.check_in) then raise exception 'dates unavailable'; end if;
  return new;
end $$;
create trigger booking_requests_reject_property_blocks before insert or update of check_in,check_out on public.booking_requests for each row execute function private.reject_snowaz_blocked_dates();

create or replace function public.get_snowaz_schedule(range_start date, range_end date)
returns table(check_in date,check_out date,display_status text)
language sql stable security definer set search_path='' as $$
  select r.check_in,r.check_out,r.display_status from public.snowaz_calendar_ranges r where r.check_in<range_end and r.check_out>range_start
  union all
  select x.check_in,x.check_out,'unavailable'::text from public.property_date_blocks x where x.status='active' and x.check_in<range_end and x.check_out>range_start
$$;
revoke all on function public.get_snowaz_schedule(date,date) from public;
grant execute on function public.get_snowaz_schedule(date,date) to anon,authenticated;

insert into public.booking_payments(booking_request_id,direction,category,amount_minor,payment_method,payment_reference,recorded_by,recorded_at)
select id,'payment','down_payment',deposit_amount_minor,'bank_transfer',coalesce(nullif(deposit_reference,''),'LEGACY-'||id),null,coalesce(deposit_verified_at,updated_at)
from public.booking_requests where deposit_status='verified'
on conflict do nothing;

insert into public.booking_payments(booking_request_id,direction,category,amount_minor,payment_method,payment_reference,recorded_at)
select id,'payment','balance',balance_paid_minor,balance_payment_method,balance_payment_reference,balance_paid_at
from public.booking_requests where balance_paid_minor > 0
on conflict do nothing;

create or replace function public.staff_get_snowaz_operations()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if private.snowaz_staff_role() is null then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'bookings',coalesce((select jsonb_agg(jsonb_build_object(
      'id',b.id,'reference','SNOWAZ-'||upper(substr(replace(b.id::text,'-',''),1,8)),'fullName',b.full_name,'phone',b.phone,'email',b.normalized_email,
      'checkIn',b.check_in,'checkOut',b.check_out,'guestCount',b.guest_count,'bedroomChoice',b.bedroom_choice,'bookingStatus',b.status,'stayStatus',b.stay_status,
      'totalMinor',b.total_minor,'depositAmountMinor',case when b.deposit_status='verified' then b.deposit_amount_minor else 0 end,
      'paidMinor',coalesce((select sum(case when p.direction='payment' then p.amount_minor else -p.amount_minor end) from public.booking_payments p where p.booking_request_id=b.id and p.status='recorded'),0),
      'remainingMinor',greatest(b.total_minor-coalesce((select sum(case when p.direction='payment' then p.amount_minor else -p.amount_minor end) from public.booking_payments p where p.booking_request_id=b.id and p.status='recorded'),0),0),
      'idType',b.primary_guest_id_type,'idLast4',b.primary_guest_id_last4,'idVerifiedAt',b.primary_guest_verified_at,
      'payments',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'direction',p.direction,'category',p.category,'amountMinor',p.amount_minor,'method',p.payment_method,'reference',p.payment_reference,'status',p.status,'recordedAt',p.recorded_at,'reversalReason',p.reversal_reason) order by p.recorded_at desc) from public.booking_payments p where p.booking_request_id=b.id),'[]'::jsonb)
    ) order by b.check_in desc) from public.booking_requests b where b.status not in ('declined')),'[]'::jsonb),
    'blocks',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'checkIn',x.check_in,'checkOut',x.check_out,'reason',x.reason,'status',x.status) order by x.check_in) from public.property_date_blocks x),'[]'::jsonb),
    'notifications',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'bookingId',n.booking_request_id,'type',n.notification_type,'recipient',n.recipient,'channel',n.channel,'status',n.status,'dueAt',n.due_at,'attempts',n.attempt_count) order by n.created_at desc) from (select * from public.booking_notifications order by created_at desc limit 50) n),'[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.staff_get_snowaz_operations() from public,anon;
grant execute on function public.staff_get_snowaz_operations() to authenticated;

create or replace function public.staff_update_snowaz_booking(target_id uuid, arrival date, departure date, guests integer, bedroom_selection text, next_stay_status text, id_type text default null, id_last4 text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare nights integer; base_rate bigint; extra_count integer; extra_charge bigint; booking_total bigint; already_paid bigint; current_status public.booking_request_status;
begin
  if private.snowaz_staff_role() not in ('manager','admin') then raise exception 'not authorized'; end if;
  if guests not between 1 and 8 or departure<=arrival or bedroom_selection not in ('bedroom_1','bedroom_2','both_bedrooms') or (guests>2 and bedroom_selection<>'both_bedrooms') or next_stay_status not in ('upcoming','checked_in','checked_out','no_show') then raise exception 'invalid booking update'; end if;
  select status into current_status from public.booking_requests where id=target_id for update;
  if current_status is null or current_status in ('declined','cancelled') then return false; end if;
  if exists(select 1 from public.snowaz_calendar_ranges r where r.check_in<departure and r.check_out>arrival and not(r.source_kind='booking_request' and r.source_id=target_id))
    or exists(select 1 from public.property_date_blocks x where x.status='active' and x.check_in<departure and x.check_out>arrival) then raise exception 'dates unavailable'; end if;
  nights:=departure-arrival; base_rate:=case when guests<=2 then 180000 else 230000 end; extra_count:=greatest(guests-4,0); extra_charge:=extra_count*30000*nights; booking_total:=base_rate*nights+extra_charge;
  select coalesce(sum(case when direction='payment' then amount_minor else -amount_minor end),0) into already_paid from public.booking_payments where booking_request_id=target_id and status='recorded';
  if already_paid>booking_total then raise exception 'new total below payments received'; end if;
  update public.booking_requests set check_in=arrival,check_out=departure,guest_count=guests,bedroom_choice=bedroom_selection,stay_nights=nights,base_nightly_rate_minor=base_rate,additional_guest_count=extra_count,additional_guest_charge_minor=extra_charge,total_minor=booking_total,stay_status=next_stay_status,
    primary_guest_id_type=nullif(trim(coalesce(id_type,'')),''),primary_guest_id_last4=upper(nullif(trim(coalesce(id_last4,'')),'')),primary_guest_verified_at=case when trim(coalesce(id_type,''))<>'' and trim(coalesce(id_last4,''))~'^[A-Za-z0-9]{4}$' then now() else null end,primary_guest_verified_by=case when trim(coalesce(id_type,''))<>'' then auth.uid() else null end,updated_at=now() where id=target_id;
  insert into public.audit_log(actor_id,actor_type,action,entity_type,entity_id,request_id,redacted_metadata) values(auth.uid(),'staff','booking.updated','booking_request',target_id,gen_random_uuid(),jsonb_build_object('checkIn',arrival,'checkOut',departure,'guests',guests,'bedroom',bedroom_selection,'stayStatus',next_stay_status,'totalMinor',booking_total));
  insert into public.booking_notifications(booking_request_id,notification_type,recipient,channel) select id,'booking_updated',case when preferred_contact='email' then normalized_email else phone end,preferred_contact from public.booking_requests where id=target_id;
  return true;
end $$;
revoke all on function public.staff_update_snowaz_booking(uuid,date,date,integer,text,text,text,text) from public,anon;
grant execute on function public.staff_update_snowaz_booking(uuid,date,date,integer,text,text,text,text) to authenticated;

create or replace function public.staff_record_snowaz_payment(target_id uuid, amount_minor bigint, payment_method text, payment_reference text)
returns boolean language plpgsql security definer set search_path='' as $$
declare due bigint;
begin
  if private.snowaz_staff_role() not in ('manager','admin') then raise exception 'not authorized'; end if;
  if amount_minor<=0 or char_length(trim(payment_reference)) not between 3 and 80 then raise exception 'invalid payment'; end if;
  select greatest(b.total_minor-coalesce((select sum(case when p.direction='payment' then p.amount_minor else -p.amount_minor end) from public.booking_payments p where p.booking_request_id=b.id and p.status='recorded'),0),0) into due from public.booking_requests b where b.id=target_id and b.status='confirmed' for update;
  if due is null or amount_minor>due then return false; end if;
  insert into public.booking_payments(booking_request_id,direction,category,amount_minor,payment_method,payment_reference,recorded_by) values(target_id,'payment','balance',amount_minor,trim(payment_method),trim(payment_reference),auth.uid());
  update public.booking_requests set balance_paid_minor=balance_paid_minor+amount_minor,balance_payment_method=trim(payment_method),balance_payment_reference=trim(payment_reference),balance_paid_at=now(),updated_at=now() where id=target_id;
  insert into public.audit_log(actor_id,actor_type,action,entity_type,entity_id,request_id,redacted_metadata) values(auth.uid(),'staff','booking.payment_recorded','booking_request',target_id,gen_random_uuid(),jsonb_build_object('amountMinor',amount_minor,'method',trim(payment_method)));
  insert into public.booking_notifications(booking_request_id,notification_type,recipient,channel) select id,'payment_recorded',case when preferred_contact='email' then normalized_email else phone end,preferred_contact from public.booking_requests where id=target_id;
  return true;
end $$;
revoke all on function public.staff_record_snowaz_payment(uuid,bigint,text,text) from public,anon;
grant execute on function public.staff_record_snowaz_payment(uuid,bigint,text,text) to authenticated;

create or replace function public.staff_reverse_snowaz_payment(payment_id uuid, reason text)
returns boolean language plpgsql security definer set search_path='' as $$
declare p public.booking_payments%rowtype;
begin
  if private.snowaz_staff_role() not in ('manager','admin') or char_length(trim(reason))<5 then raise exception 'not authorized or invalid reason'; end if;
  select * into p from public.booking_payments where id=payment_id and status='recorded' for update; if p.id is null then return false; end if;
  update public.booking_payments set status='reversed',reversed_by=auth.uid(),reversed_at=now(),reversal_reason=trim(reason) where id=payment_id;
  if p.category='balance' and p.direction='payment' then update public.booking_requests set balance_paid_minor=greatest(balance_paid_minor-p.amount_minor,0),updated_at=now() where id=p.booking_request_id; end if;
  insert into public.audit_log(actor_id,actor_type,action,entity_type,entity_id,request_id,redacted_metadata) values(auth.uid(),'staff','booking.payment_reversed','booking_payment',payment_id,gen_random_uuid(),jsonb_build_object('reason',trim(reason)));
  return true;
end $$;
revoke all on function public.staff_reverse_snowaz_payment(uuid,text) from public,anon;
grant execute on function public.staff_reverse_snowaz_payment(uuid,text) to authenticated;

create or replace function public.staff_manage_snowaz_date_block(target_id uuid, arrival date, departure date, block_reason text, release_block boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare result_id uuid;
begin
  if private.snowaz_staff_role() not in ('manager','admin') then raise exception 'not authorized'; end if;
  if release_block then update public.property_date_blocks set status='released',released_by=auth.uid(),released_at=now() where id=target_id and status='active' returning id into result_id; return result_id; end if;
  if departure<=arrival or char_length(trim(block_reason))<3 then raise exception 'invalid block'; end if;
  if exists(select 1 from public.snowaz_calendar_ranges r where r.check_in<departure and r.check_out>arrival) then raise exception 'booking conflict'; end if;
  insert into public.property_date_blocks(check_in,check_out,reason,created_by) values(arrival,departure,trim(block_reason),auth.uid()) returning id into result_id; return result_id;
end $$;
revoke all on function public.staff_manage_snowaz_date_block(uuid,date,date,text,boolean) from public,anon;
grant execute on function public.staff_manage_snowaz_date_block(uuid,date,date,text,boolean) to authenticated;

drop function public.lookup_snowaz_booking_status(text,text);
create function public.lookup_snowaz_booking_status(booking_reference text, guest_phone text)
returns table(check_in date,check_out date,guest_count integer,booking_status text,stay_status text,deposit_status text,deposit_expires_at timestamptz,bedroom_choice text,total_minor bigint,paid_minor bigint,remaining_minor bigint)
language sql stable security definer set search_path='' as $$
  select b.check_in,b.check_out,b.guest_count,b.status::text,b.stay_status,b.deposit_status,b.deposit_token_expires_at,b.bedroom_choice,b.total_minor,
    coalesce((select sum(case when p.direction='payment' then p.amount_minor else -p.amount_minor end) from public.booking_payments p where p.booking_request_id=b.id and p.status='recorded'),0)::bigint,
    greatest(b.total_minor-coalesce((select sum(case when p.direction='payment' then p.amount_minor else -p.amount_minor end) from public.booking_payments p where p.booking_request_id=b.id and p.status='recorded'),0),0)::bigint
  from public.booking_requests b where 'SNOWAZ-'||upper(substr(replace(b.id::text,'-',''),1,8))=upper(trim(booking_reference)) and regexp_replace(b.phone,'\D','','g')=regexp_replace(guest_phone,'\D','','g') limit 1
$$;
revoke all on function public.lookup_snowaz_booking_status(text,text) from public, anon, authenticated;
