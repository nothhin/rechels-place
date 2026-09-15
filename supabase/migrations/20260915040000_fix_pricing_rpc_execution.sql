-- The public/staff entry points call private helpers whose EXECUTE privilege
-- is revoked from client roles. They must therefore run as the trusted owner.

create or replace function public.get_snowaz_public_pricing()
returns jsonb
language sql security definer set search_path = ''
as $$ select private.snowaz_public_pricing_payload() $$;

create or replace function public.staff_get_snowaz_pricing()
returns jsonb
language sql security definer set search_path = ''
as $$ select private.snowaz_staff_pricing_payload() $$;

revoke all on function public.get_snowaz_public_pricing() from public;
grant execute on function public.get_snowaz_public_pricing() to anon, authenticated;
revoke all on function public.staff_get_snowaz_pricing() from public, anon;
grant execute on function public.staff_get_snowaz_pricing() to authenticated;
