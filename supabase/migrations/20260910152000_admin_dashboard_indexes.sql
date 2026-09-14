-- Keep the admin dashboard's newest-booking and operational status lookups index-backed.
create index if not exists booking_requests_created_at_desc_idx
  on public.booking_requests (created_at desc);

create index if not exists booking_requests_active_status_idx
  on public.booking_requests (status)
  where status not in ('declined', 'cancelled');

create index if not exists booking_requests_confirmed_checkin_checkout_idx
  on public.booking_requests (check_in, check_out)
  where status = 'confirmed';
