alter table public.booking_requests drop constraint if exists booking_requests_bedroom_capacity_valid;
alter table public.booking_requests add constraint booking_requests_bedroom_capacity_valid check (
  (bedroom_choice='bedroom_1' and guest_count between 1 and 2) or
  (bedroom_choice='bedroom_2' and guest_count between 1 and 6) or
  (bedroom_choice='both_bedrooms' and guest_count between 1 and 6)
);

create or replace function public.update_snowaz_pending_guest_count(token_hash text, guests integer, bedroom_selection text, parking_selection text)
returns boolean language plpgsql security definer set search_path='' as $$
declare booking public.booking_requests%rowtype; nights integer; base_rate bigint; parking_rate bigint; extra_count integer; extra_charge bigint; parking_charge bigint;
begin
  if guests not between 1 and 6 or bedroom_selection not in ('bedroom_1','bedroom_2','both_bedrooms') or parking_selection not in ('none','car','motorcycle') or (bedroom_selection='bedroom_1' and guests>2) then return false; end if;
  select * into booking from public.booking_requests where deposit_token_hash=token_hash and deposit_token_expires_at>now() and status in ('pending','contacted') and deposit_status in ('not_requested','awaiting_payment') for update;
  if not found then return false; end if;
  nights:=booking.check_out-booking.check_in;
  base_rate:=case when bedroom_selection in ('bedroom_1','bedroom_2') then 170000 else 220000 end;
  extra_count:=case when bedroom_selection='bedroom_2' then greatest(guests-2,0) else 0 end;
  extra_charge:=case when bedroom_selection='bedroom_2' and guests=3 then 25000*nights when bedroom_selection='bedroom_2' and guests>=4 then (40000+greatest(guests-4,0)*25000)*nights else 0 end;
  parking_rate:=case when parking_selection='car' then 35000 when parking_selection='motorcycle' then 15000 else 0 end; parking_charge:=parking_rate*nights;
  update public.booking_requests set guest_count=guests,bedroom_choice=bedroom_selection,stay_nights=nights,base_nightly_rate_minor=base_rate,additional_guest_count=extra_count,additional_guest_charge_minor=extra_charge,parking_type=parking_selection,parking_nightly_rate_minor=parking_rate,parking_charge_minor=parking_charge,total_minor=base_rate*nights+parking_charge,updated_at=now() where id=booking.id;
  return true;
end $$;
