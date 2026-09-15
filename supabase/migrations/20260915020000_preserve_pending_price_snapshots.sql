-- A pending guest-count correction is an operational edit for the entire
-- condo flow. It must not silently reprice the already-submitted request.

create or replace function public.update_snowaz_pending_guest_count(
  token_hash text, guests integer, bedroom_selection text,
  parking_selection text, early_hours integer, late_hours integer
)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  booking public.booking_requests%rowtype;
begin
  if guests not between 1 and 6
    or coalesce(bedroom_selection, '') <> 'both_bedrooms'
    or coalesce(parking_selection, '') <> 'none'
    or coalesce(early_hours, 0) <> 0
    or coalesce(late_hours, 0) <> 0
  then return false; end if;

  select * into booking
  from public.booking_requests
  where deposit_token_hash = token_hash
    and deposit_token_expires_at > now()
    and status in ('pending', 'contacted')
    and deposit_status in ('not_requested', 'awaiting_payment')
  for update;
  if not found then return false; end if;

  -- The public editor is restricted to the entire-condo selection, whose
  -- submitted price is independent of guest count. Preserve every stored
  -- rate, fee, deposit, and total snapshot while changing only occupancy.
  update public.booking_requests set
    guest_count = guests,
    bedroom_choice = 'both_bedrooms',
    updated_at = now()
  where id = booking.id;
  return true;
end;
$$;

revoke all on function public.update_snowaz_pending_guest_count(text,integer,text,text,integer,integer) from public, authenticated;
grant execute on function public.update_snowaz_pending_guest_count(text,integer,text,text,integer,integer) to anon;
