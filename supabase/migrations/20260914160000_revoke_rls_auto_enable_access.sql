-- The Supabase project helper is not part of the application's public API.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
