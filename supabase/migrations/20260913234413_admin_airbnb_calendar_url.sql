-- Server-side override for the Airbnb import URL. The URL includes a private
-- token; only the service role may read or write it.
create table if not exists public.external_calendar_settings (
  provider text primary key check (provider = 'airbnb'),
  import_url text not null check (length(import_url) <= 2048),
  updated_at timestamptz not null default now()
);
alter table public.external_calendar_settings enable row level security;
revoke all on table public.external_calendar_settings from public, anon, authenticated;
grant select, insert, update, delete on table public.external_calendar_settings to service_role;
