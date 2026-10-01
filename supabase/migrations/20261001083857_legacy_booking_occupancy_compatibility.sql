-- Keep already-deployed clients compatible while the adult/child booking UI
-- rolls out. The legacy v2 RPC only supplies guest_count, so PostgreSQL column
-- defaults would otherwise violate the new occupancy-total constraint.

create or replace function private.rechels_normalize_legacy_occupancy()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.guest_count between 1 and 9
    and new.guest_count <> coalesce(new.adult_count, 0) + coalesce(new.child_count, 0)
  then
    new.adult_count := least(new.guest_count, 6);
    new.child_count := greatest(new.guest_count - 6, 0);
  end if;

  return new;
end;
$$;

create trigger normalize_legacy_booking_occupancy
before insert or update of guest_count, adult_count, child_count
on public.booking_requests
for each row
execute function private.rechels_normalize_legacy_occupancy();

comment on function private.rechels_normalize_legacy_occupancy() is
  'Normalizes occupancy totals for legacy booking clients that predate adult and child fields.';
