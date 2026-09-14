-- SnowAZ inventory remains deliberately unpublished until the owner confirms
-- the final capacity, bed configuration, rates, rules, and sellable unit label.

insert into room_types (
  name, slug, short_description, max_adults, max_children,
  bed_configuration, room_size_sqm, base_nightly_rate_minor, display_order, status
) values (
  'SnowAZ Condo Stay',
  'snowaz-condo-stay',
  'Private condo stay at Urban Deca Homes Banilad. Final capacity, rates, and policies require owner approval.',
  2, 0, '[]'::jsonb, null, 0, 10, 'draft'
)
on conflict (slug) do update set
  short_description = excluded.short_description,
  updated_at = now()
where room_types.status = 'draft';

insert into rooms (room_type_id, room_number, floor, status)
select id, 'SNOWAZ-PENDING', 'Tower 1', 'out_of_service'
from room_types
where slug = 'snowaz-condo-stay'
on conflict (room_number) do update set
  room_type_id = excluded.room_type_id,
  floor = excluded.floor,
  status = excluded.status,
  updated_at = now();

comment on table rooms is 'Physical inventory. SNOWAZ-PENDING remains out_of_service until the owner approves the final unit details.';
