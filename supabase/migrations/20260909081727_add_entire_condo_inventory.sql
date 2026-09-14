insert into public.room_types
  (name, slug, short_description, max_adults, max_children, bed_configuration,
   base_nightly_rate_minor, display_order, status)
values
  ('Entire Condo (2BR Suite)', 'uppadar-entire-condo',
   'Private two-bedroom condo with queen master bedroom and double-size bunk room.',
   8, 0, '[{"type":"queen","count":1},{"type":"double_bunk","count":2}]'::jsonb,
   420000, 10, 'published')
on conflict (slug) do update set
  name = excluded.name,
  short_description = excluded.short_description,
  max_adults = excluded.max_adults,
  max_children = excluded.max_children,
  bed_configuration = excluded.bed_configuration,
  base_nightly_rate_minor = excluded.base_nightly_rate_minor,
  display_order = excluded.display_order,
  status = excluded.status,
  updated_at = now();

insert into public.rooms (room_type_id, room_number, floor, status)
select id, 'RECHEL-ENTIRE-CONDO', 'Tower 1', 'available'
from public.room_types
where slug = 'uppadar-entire-condo'
on conflict (room_number) do update set
  room_type_id = excluded.room_type_id,
  floor = excluded.floor,
  status = excluded.status,
  updated_at = now();
