create or replace function public.staff_update_snowaz_booking(target_id uuid, arrival date, departure date, guests integer, bedroom_selection text, next_stay_status text, id_type text default null, id_last4 text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare nights integer; base_rate bigint; extra_count integer; extra_charge bigint; parking_rate bigint; parking_charge bigint; booking_total bigint; already_paid bigint; current_status public.booking_request_status;
begin
  if private.snowaz_staff_role() not in ('manager','admin') then raise exception 'not authorized'; end if;
  if guests not between 1 and 8 or departure<=arrival or bedroom_selection not in ('bedroom_1','bedroom_2','both_bedrooms') or bedroom_selection<>(case when guests<=2 then 'bedroom_1' when guests<=4 then 'bedroom_2' else 'both_bedrooms' end) or next_stay_status not in ('upcoming','checked_in','checked_out','no_show') then raise exception 'invalid booking update'; end if;
  select status,parking_nightly_rate_minor into current_status,parking_rate from public.booking_requests where id=target_id for update;
  if current_status is null or current_status in ('declined','cancelled') then return false; end if;
  if exists(select 1 from public.snowaz_calendar_ranges r where r.check_in<departure and r.check_out>arrival and not(r.source_kind='booking_request' and r.source_id=target_id))
    or exists(select 1 from public.property_date_blocks x where x.status='active' and x.check_in<departure and x.check_out>arrival) then raise exception 'dates unavailable'; end if;
  nights:=departure-arrival; base_rate:=case when guests<=2 then 180000 else 230000 end; extra_count:=greatest(guests-4,0); extra_charge:=extra_count*30000*nights; parking_charge:=parking_rate*nights; booking_total:=base_rate*nights+extra_charge+parking_charge;
  select coalesce(sum(case when direction='payment' then amount_minor else -amount_minor end),0) into already_paid from public.booking_payments where booking_request_id=target_id and status='recorded';
  if already_paid>booking_total then raise exception 'new total below payments received'; end if;
  update public.booking_requests set check_in=arrival,check_out=departure,guest_count=guests,bedroom_choice=bedroom_selection,stay_nights=nights,base_nightly_rate_minor=base_rate,additional_guest_count=extra_count,additional_guest_charge_minor=extra_charge,parking_charge_minor=parking_charge,total_minor=booking_total,stay_status=next_stay_status,
    primary_guest_id_type=nullif(trim(coalesce(id_type,'')),''),primary_guest_id_last4=upper(nullif(trim(coalesce(id_last4,'')),'')),primary_guest_verified_at=case when trim(coalesce(id_type,''))<>'' and trim(coalesce(id_last4,''))~'^[A-Za-z0-9]{4}$' then now() else null end,primary_guest_verified_by=case when trim(coalesce(id_type,''))<>'' then auth.uid() else null end,updated_at=now() where id=target_id;
  update public.snowaz_calendar_ranges set check_in=arrival,check_out=departure,display_status=case when current_status='confirmed' then 'confirmed' else 'held' end where source_kind='booking_request' and source_id=target_id;
  if not found then insert into public.snowaz_calendar_ranges(source_kind,source_id,check_in,check_out,display_status) values('booking_request',target_id,arrival,departure,case when current_status='confirmed' then 'confirmed' else 'held' end); end if;
  insert into public.audit_log(actor_id,actor_type,action,entity_type,entity_id,request_id,redacted_metadata) values(auth.uid(),'staff','booking.updated','booking_request',target_id,gen_random_uuid(),jsonb_build_object('checkIn',arrival,'checkOut',departure,'guests',guests,'bedroom',bedroom_selection,'stayStatus',next_stay_status,'parkingChargeMinor',parking_charge,'totalMinor',booking_total));
  insert into public.booking_notifications(booking_request_id,notification_type,recipient,channel) select id,'booking_updated',case when preferred_contact='email' then normalized_email else phone end,preferred_contact from public.booking_requests where id=target_id;
  return true;
end $$;
revoke all on function public.staff_update_snowaz_booking(uuid,date,date,integer,text,text,text,text) from public,anon;
grant execute on function public.staff_update_snowaz_booking(uuid,date,date,integer,text,text,text,text) to authenticated;
