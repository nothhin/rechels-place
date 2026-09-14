-- This helper is only used by the database event trigger. It must not be a
-- callable Data API endpoint because it runs with elevated privileges.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

create index if not exists booking_requests_room_type_id_idx
on public.booking_requests(room_type_id);
