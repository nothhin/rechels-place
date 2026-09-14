-- The guest status flow uses the high-entropy expiring deposit token.
-- This legacy reference/phone lookup exposes booking and payment data and must
-- not be callable by unauthenticated or authenticated client roles.
revoke all on function public.lookup_snowaz_booking_status(text, text)
  from public, anon, authenticated;
