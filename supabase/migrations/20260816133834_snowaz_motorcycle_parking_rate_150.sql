-- Motorcycle parking is now ₱150 per night (15,000 minor units).
alter table public.booking_requests drop constraint if exists booking_requests_parking_valid;

update public.booking_requests
set parking_nightly_rate_minor = 15000,
    parking_charge_minor = 15000 * stay_nights,
    total_minor = total_minor + (15000 - 7500) * stay_nights
where parking_type = 'motorcycle';

alter table public.booking_requests add constraint booking_requests_parking_valid check (
  (parking_type = 'none' and parking_nightly_rate_minor = 0 and parking_charge_minor = 0)
  or (parking_type = 'car' and parking_nightly_rate_minor = 35000 and parking_charge_minor = 35000 * stay_nights)
  or (parking_type = 'motorcycle' and parking_nightly_rate_minor = 15000 and parking_charge_minor = 15000 * stay_nights)
);

do $$
declare fn record;
begin
  for fn in
    select p.oid, n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args,
           replace(pg_get_functiondef(p.oid), 'then 7500', 'then 15000') as definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('submit_snowaz_booking', 'update_snowaz_pending_guest_count')
      and pg_get_functiondef(p.oid) like '%7500%'
  loop
    execute fn.definition;
  end loop;
end $$;
