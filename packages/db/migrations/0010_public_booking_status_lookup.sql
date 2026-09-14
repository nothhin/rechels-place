create or replace function public.lookup_snowaz_booking_status(booking_reference text, guest_phone text)
returns table(check_in date, check_out date, guest_count integer, booking_status text, deposit_status text, deposit_expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select b.check_in, b.check_out, b.guest_count, b.status::text, b.deposit_status::text, b.deposit_token_expires_at
  from public.booking_requests b
  where upper(trim(booking_reference)) = 'SNOWAZ-' || upper(substr(replace(b.id::text, '-', ''), 1, 8))
    and char_length(regexp_replace(guest_phone, '[^0-9]', '', 'g')) >= 7
    and regexp_replace(b.phone, '[^0-9]', '', 'g') = regexp_replace(guest_phone, '[^0-9]', '', 'g')
  limit 1
$$;
revoke all on function public.lookup_snowaz_booking_status(text,text) from public, anon, authenticated;
