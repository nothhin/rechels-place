update public.room_types set base_nightly_rate_minor = 170000, updated_at = now() where slug in ('uppadar-master-bedroom','uppadar-second-bedroom');

drop function if exists public.submit_snowaz_booking_request(uuid,text,text,text,date,date,integer,text,text,text,text,text,text);

create or replace function public.submit_snowaz_booking_request(
  request_idempotency uuid, guest_name text, guest_email text, guest_phone text,
  arrival date, departure date, guests integer, bedroom_selection text,
  parking_selection text, requests text, contact_method text,
  consent_version text, token_hash text
) returns table(booking_id uuid, booking_reference text, deposit_expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare booking_total bigint; base_rate bigint; extra_guests integer; extra_charge bigint; nights integer; expiry timestamptz;
begin
  if departure <= arrival or guests < 1 or guests > 8 or bedroom_selection not in ('bedroom_1','bedroom_2','both_bedrooms') or (bedroom_selection in ('bedroom_1','bedroom_2') and guests > 4) or (bedroom_selection='both_bedrooms' and guests > 8) then raise exception 'invalid booking request'; end if;
  if exists(select 1 from public.snowaz_calendar_ranges r where r.check_in < departure and r.check_out > arrival) then raise exception 'dates unavailable'; end if;
  if exists(select 1 from public.property_date_blocks x where x.status='active' and x.check_in < departure and x.check_out > arrival) then raise exception 'dates unavailable'; end if;
  nights := departure - arrival;
  base_rate := case when bedroom_selection in ('bedroom_1','bedroom_2') then 170000 else 220000 end;
  extra_guests := case when bedroom_selection in ('bedroom_1','bedroom_2') then greatest(guests - 2, 0) else 0 end;
  extra_charge := extra_guests * 25000;
  booking_total := (base_rate + extra_charge) * nights;
  expiry := now() + interval '24 hours';
  insert into public.booking_requests(idempotency_key,full_name,normalized_email,phone,preferred_contact,check_in,check_out,guest_count,bedroom_choice,stay_nights,base_nightly_rate_minor,additional_guest_count,additional_guest_charge_minor,parking_type,parking_nightly_rate_minor,parking_charge_minor,total_minor,special_requests,status,source,consent_version,deposit_status,deposit_amount_minor,deposit_token_hash,deposit_token_expires_at)
  values(request_idempotency,trim(guest_name),lower(nullif(trim(guest_email),'')),trim(guest_phone),contact_method,arrival,departure,guests,bedroom_selection,nights,base_rate,extra_guests,extra_charge,'none',0,0,booking_total,trim(requests),'pending','guest_web',consent_version,'awaiting_payment',least(100000,booking_total),token_hash,expiry)
  on conflict(idempotency_key) do update set updated_at=now()
  returning id, 'RECHEL-'||upper(substr(replace(id::text,'-',''),1,8)), deposit_token_expires_at into booking_id,booking_reference,deposit_expires_at;
  return next;
end $$;

revoke all on function public.submit_snowaz_booking_request(uuid,text,text,text,date,date,integer,text,text,text,text,text,text) from public;
grant execute on function public.submit_snowaz_booking_request(uuid,text,text,text,date,date,integer,text,text,text,text,text,text) to anon,authenticated;
