insert into public.booking_payments(booking_request_id,direction,category,amount_minor,payment_method,payment_reference,recorded_at)
select b.id,'payment','down_payment',b.deposit_amount_minor,'bank_transfer',
  coalesce(nullif(b.deposit_reference,''),'DEPOSIT-RECONCILED-'||upper(substr(replace(b.id::text,'-',''),1,8))),
  coalesce(b.deposit_verified_at,b.updated_at)
from public.booking_requests b
where b.deposit_status='verified'
  and not exists(select 1 from public.booking_payments p where p.booking_request_id=b.id and p.category='down_payment' and p.direction='payment' and p.status='recorded')
on conflict do nothing;

insert into public.booking_payments(booking_request_id,direction,category,amount_minor,payment_method,payment_reference,recorded_at)
select b.id,'payment','balance',b.balance_paid_minor,
  coalesce(nullif(b.balance_payment_method,''),'cash'),
  coalesce(nullif(b.balance_payment_reference,''),'BALANCE-RECONCILED-'||upper(substr(replace(b.id::text,'-',''),1,8))),
  coalesce(b.balance_paid_at,b.updated_at)
from public.booking_requests b
where b.balance_paid_minor>0
  and not exists(select 1 from public.booking_payments p where p.booking_request_id=b.id and p.category='balance' and p.direction='payment' and p.status='recorded')
on conflict do nothing;

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
  update public.snowaz_calendar_ranges set check_in=arrival,check_out=departure,display_status=case when current_status='confirmed' then 'confirmed' else 'held' end where source_kind='booking_request' and source_id=target_id;
  if not found then insert into public.snowaz_calendar_ranges(source_kind,source_id,check_in,check_out,display_status) values('booking_request',target_id,arrival,departure,case when current_status='confirmed' then 'confirmed' else 'held' end); end if;
  insert into public.audit_log(actor_id,actor_type,action,entity_type,entity_id,request_id,redacted_metadata) values(auth.uid(),'staff','booking.updated','booking_request',target_id,gen_random_uuid(),jsonb_build_object('checkIn',arrival,'checkOut',departure,'guests',guests,'bedroom',bedroom_selection,'stayStatus',next_stay_status,'totalMinor',booking_total));
  insert into public.booking_notifications(booking_request_id,notification_type,recipient,channel) select id,'booking_updated',case when preferred_contact='email' then normalized_email else phone end,preferred_contact from public.booking_requests where id=target_id;
  return true;
end $$;
revoke all on function public.staff_update_snowaz_booking(uuid,date,date,integer,text,text,text,text) from public,anon;
grant execute on function public.staff_update_snowaz_booking(uuid,date,date,integer,text,text,text,text) to authenticated;

create or replace function public.get_snowaz_admin_dashboard()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if private.snowaz_staff_role() is null then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'templates', coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'slug',t.slug,'maxAdults',t.max_adults,'maxChildren',t.max_children,'baseNightlyRateMinor',t.base_nightly_rate_minor,'displayOrder',t.display_order,'status',t.status) order by t.display_order) from public.room_types t), '[]'::jsonb),
    'inventory', coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'roomNumber',r.room_number,'floor',r.floor,'status',r.status,'roomTypeName',t.name) order by r.room_number) from public.rooms r join public.room_types t on t.id=r.room_type_id), '[]'::jsonb),
    'upcoming', '[]'::jsonb,
    'enquiries', coalesce((select jsonb_agg(jsonb_build_object(
      'id',b.id,'fullName',b.full_name,'email',b.normalized_email,'phone',b.phone,'preferredContact',b.preferred_contact,
      'checkIn',b.check_in,'checkOut',b.check_out,'guestCount',b.guest_count,'bedroomChoice',b.bedroom_choice,
      'stayNights',b.stay_nights,'baseNightlyRateMinor',b.base_nightly_rate_minor,'additionalGuestCount',b.additional_guest_count,
      'additionalGuestChargeMinor',b.additional_guest_charge_minor,'totalMinor',b.total_minor,'depositAmountMinor',b.deposit_amount_minor,
      'balancePaidMinor',greatest(coalesce(pay.paid_minor,0)-case when b.deposit_status='verified' then b.deposit_amount_minor else 0 end,0),
      'remainingBalanceMinor',greatest(b.total_minor-coalesce(pay.paid_minor,0),0),
      'balancePaymentMethod',b.balance_payment_method,'balancePaymentReference',b.balance_payment_reference,'balancePaidAt',b.balance_paid_at,
      'status',b.status,'depositStatus',b.deposit_status,'depositSenderName',b.deposit_sender_name,'depositReference',b.deposit_reference,
      'depositSubmittedAt',b.deposit_submitted_at,'depositRefundReference',b.deposit_refund_reference,'roomTypeName',rt.name
    ) order by b.created_at desc) from (select * from public.booking_requests order by created_at desc limit 30) b
      left join public.room_types rt on rt.id=b.room_type_id
      left join lateral (select coalesce(sum(case when p.direction='payment' then p.amount_minor else -p.amount_minor end),0)::bigint paid_minor from public.booking_payments p where p.booking_request_id=b.id and p.status='recorded') pay on true), '[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.get_snowaz_admin_dashboard() from public,anon;
grant execute on function public.get_snowaz_admin_dashboard() to authenticated;
