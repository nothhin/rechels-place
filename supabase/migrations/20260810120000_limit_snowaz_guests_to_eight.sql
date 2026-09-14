alter table public.booking_requests
  drop constraint if exists booking_requests_valid_guest_count;

alter table public.booking_requests
  add constraint booking_requests_valid_guest_count
  check (guest_count between 1 and 8);
