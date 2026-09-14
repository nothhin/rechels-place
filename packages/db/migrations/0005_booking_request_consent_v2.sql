drop policy if exists "Public can submit SnowAZ booking requests" on public.booking_requests;

create policy "Public can submit SnowAZ booking requests"
on public.booking_requests for insert
to anon, authenticated
with check (
  source = 'snowaz_guest_web'
  and status = 'pending'
  and room_type_id is null
  and char_length(full_name) between 2 and 120
  and char_length(normalized_email) between 3 and 320
  and char_length(phone) between 5 and 40
  and guest_count between 1 and 8
  and check_out > check_in
  and check_in >= current_date
  and check_out <= current_date + 366
  and consent_version = 'booking-request-v2'
);
