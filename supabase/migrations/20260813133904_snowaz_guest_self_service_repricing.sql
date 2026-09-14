drop function if exists public.get_snowaz_deposit_request(text);
create function public.get_snowaz_deposit_request(token_hash text)
returns table(full_name text, check_in date, check_out date, guest_count integer, bedroom_choice text, deposit_status text, deposit_amount_minor bigint, deposit_token_expires_at timestamptz)
language sql stable security definer set search_path='' as $$
  select b.full_name,b.check_in,b.check_out,b.guest_count,b.bedroom_choice,b.deposit_status::text,b.deposit_amount_minor,b.deposit_token_expires_at
  from public.booking_requests b
  where b.deposit_token_hash=token_hash and b.deposit_token_expires_at>now()
  limit 1
$$;
revoke all on function public.get_snowaz_deposit_request(text) from public,authenticated;
grant execute on function public.get_snowaz_deposit_request(text) to anon;

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
    or (guests > 2 and bedroom_selection <> 'both_bedrooms')
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
