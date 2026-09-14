create extension if not exists pg_cron;

revoke all on function public.expire_snowaz_deposit_holds() from public, anon, authenticated;

select cron.schedule(
  'snowaz-expire-deposit-holds',
  '* * * * *',
  'select public.expire_snowaz_deposit_holds()'
);
