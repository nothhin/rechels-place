create or replace function public.staff_update_snowaz_booking(target_id uuid,arrival date,departure date,guests integer,
  bedroom_selection text,next_stay_status text,id_type text default null,id_last4 text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare nights integer; base_rate bigint:=170000; extra_count integer; extra_charge bigint; parking_rate bigint;
  parking_charge bigint; early_fee bigint; late_fee bigint; accommodation bigint; extras bigint; booking_total bigint;
  already_paid bigint; current_status public.booking_request_status;
begin
  if private.snowaz_staff_role() not in ('manager','admin') then raise exception 'not authorized'; end if;
  if guests not between 1 and 6 or departure<=arrival or bedroom_selection not in ('bedroom_1','bedroom_2')
    or (bedroom_selection='bedroom_1' and guests>2) or next_stay_status not in ('upcoming','checked_in','checked_out','no_show')
    then raise exception 'invalid booking update'; end if;
  select status,parking_nightly_rate_minor,early_check_in_fee_minor,late_checkout_fee_minor
    into current_status,parking_rate,early_fee,late_fee from public.booking_requests where id=target_id for update;
  if current_status is null or current_status in ('declined','cancelled') then return false; end if;
  if exists(select 1 from public.snowaz_calendar_ranges r where r.check_in<departure and r.check_out>arrival and not(r.source_kind='booking_request' and r.source_id=target_id))
    or exists(select 1 from public.property_date_blocks x where x.status='active' and x.check_in<departure and x.check_out>arrival)
    then raise exception 'dates unavailable'; end if;
  nights:=departure-arrival; extra_count:=case when bedroom_selection='bedroom_2' then greatest(guests-2,0) else 0 end;
  extra_charge:=case when bedroom_selection='bedroom_2' then
    (case guests when 3 then 25000 when 4 then 40000 else case when guests>4 then 40000+(guests-4)*25000 else 0 end end)*nights else 0 end;
  parking_charge:=coalesce(parking_rate,0)*nights; accommodation:=base_rate*nights+extra_charge;
  extras:=parking_charge+coalesce(early_fee,0)+coalesce(late_fee,0); booking_total:=accommodation+extras;
  select coalesce(sum(case when direction='payment' then amount_minor else -amount_minor end),0) into already_paid
    from public.booking_payments where booking_request_id=target_id and status='recorded';
  if already_paid>booking_total then raise exception 'new total below payments received'; end if;
  update public.booking_requests set check_in=arrival,check_out=departure,guest_count=guests,bedroom_choice=bedroom_selection,
    stay_nights=nights,base_nightly_rate_minor=base_rate,additional_guest_count=extra_count,
    additional_guest_charge_minor=extra_charge,parking_charge_minor=parking_charge,accommodation_subtotal_minor=accommodation,
    extras_total_minor=extras,total_minor=booking_total,stay_status=next_stay_status,
    primary_guest_id_type=nullif(trim(coalesce(id_type,'')),''),primary_guest_id_last4=upper(nullif(trim(coalesce(id_last4,'')),'')),
    primary_guest_verified_at=case when trim(coalesce(id_type,''))<>'' and trim(coalesce(id_last4,''))~'^[A-Za-z0-9]{4}$' then now() end,
    primary_guest_verified_by=case when trim(coalesce(id_type,''))<>'' then auth.uid() end,updated_at=now() where id=target_id;
  update public.snowaz_calendar_ranges set check_in=arrival,check_out=departure,
    display_status=case when current_status='confirmed' then 'booked' else 'pending' end
    where source_kind='booking_request' and source_id=target_id;
  if not found then insert into public.snowaz_calendar_ranges(source_kind,source_id,check_in,check_out,display_status)
    values('booking_request',target_id,arrival,departure,case when current_status='confirmed' then 'booked' else 'pending' end); end if;
  insert into public.audit_log(actor_id,actor_type,action,entity_type,entity_id,request_id,redacted_metadata)
    values(auth.uid(),'staff','booking.updated','booking_request',target_id,gen_random_uuid(),jsonb_build_object('checkIn',arrival,'checkOut',departure,'guests',guests,'bedroom',bedroom_selection,'totalMinor',booking_total));
  return true;
end $$;
revoke all on function public.staff_update_snowaz_booking(uuid,date,date,integer,text,text,text,text) from public,anon;
grant execute on function public.staff_update_snowaz_booking(uuid,date,date,integer,text,text,text,text) to authenticated;

create or replace function public.staff_get_snowaz_operations()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if private.snowaz_staff_role() is null then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'bookings',coalesce((select jsonb_agg(jsonb_build_object(
      'id',b.id,'reference','RECHEL-'||upper(substr(replace(b.id::text,'-',''),1,8)),'fullName',b.full_name,'phone',b.phone,'email',b.normalized_email,
      'checkIn',b.check_in,'checkOut',b.check_out,'stayNights',b.stay_nights,'guestCount',b.guest_count,'bedroomChoice',b.bedroom_choice,
      'bookingStatus',b.status,'stayStatus',b.stay_status,'baseNightlyRateMinor',b.base_nightly_rate_minor,
      'additionalGuestCount',b.additional_guest_count,'additionalGuestChargeMinor',b.additional_guest_charge_minor,
      'accommodationSubtotalMinor',b.accommodation_subtotal_minor,'parkingType',b.parking_type,'parkingNightlyRateMinor',b.parking_nightly_rate_minor,
      'parkingChargeMinor',b.parking_charge_minor,'earlyCheckInHours',b.early_check_in_hours,'earlyCheckInTime',b.early_check_in_time,
      'earlyCheckInFeeMinor',b.early_check_in_fee_minor,'lateCheckoutHours',b.late_checkout_hours,'lateCheckoutTime',b.late_checkout_time,
      'lateCheckoutFeeMinor',b.late_checkout_fee_minor,'extrasTotalMinor',b.extras_total_minor,'totalMinor',b.total_minor,
      'depositStatus',b.deposit_status,'depositAmountMinor',case when b.deposit_status='verified' then b.deposit_amount_minor else 0 end,
      'paidMinor',coalesce((select sum(case when p.direction='payment' then p.amount_minor else -p.amount_minor end) from public.booking_payments p where p.booking_request_id=b.id and p.status='recorded'),0),
      'remainingMinor',greatest(b.total_minor-coalesce((select sum(case when p.direction='payment' then p.amount_minor else -p.amount_minor end) from public.booking_payments p where p.booking_request_id=b.id and p.status='recorded'),0),0),
      'idType',b.primary_guest_id_type,'idLast4',b.primary_guest_id_last4,'idVerifiedAt',b.primary_guest_verified_at,
      'payments',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'direction',p.direction,'category',p.category,'amountMinor',p.amount_minor,'method',p.payment_method,'reference',p.payment_reference,'status',p.status,'recordedAt',p.recorded_at,'reversalReason',p.reversal_reason) order by p.recorded_at desc) from public.booking_payments p where p.booking_request_id=b.id),'[]'::jsonb)
    ) order by b.check_in desc) from public.booking_requests b where b.status='confirmed'),'[]'::jsonb),
    'blocks',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'checkIn',x.check_in,'checkOut',x.check_out,'reason',x.reason,'status',x.status) order by x.check_in) from public.property_date_blocks x),'[]'::jsonb),
    'notifications',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'bookingId',n.booking_request_id,'type',n.notification_type,'recipient',n.recipient,'channel',n.channel,'status',n.status,'dueAt',n.due_at,'attempts',n.attempt_count) order by n.created_at desc) from (select * from public.booking_notifications order by created_at desc limit 50)n),'[]'::jsonb)
  ) into result; return result;
end $$;
revoke all on function public.staff_get_snowaz_operations() from public,anon;
grant execute on function public.staff_get_snowaz_operations() to authenticated;
