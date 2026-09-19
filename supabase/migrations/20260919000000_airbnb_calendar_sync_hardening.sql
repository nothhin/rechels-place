-- Harden the two-way Airbnb calendar connection.
--
-- Imported VEVENT metadata stays in the service-role-only table. The public
-- schedule and website export continue to expose only generic unavailable
-- ranges, never Airbnb guest details.

alter table public.external_calendar_events
  add column if not exists summary text not null default 'Unavailable',
  add column if not exists description text,
  add column if not exists source_status text not null default 'UNKNOWN';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'external_calendar_events_summary_length'
      and conrelid = 'public.external_calendar_events'::regclass
  ) then
    alter table public.external_calendar_events
      add constraint external_calendar_events_summary_length
      check (char_length(summary) between 1 and 240);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'external_calendar_events_description_length'
      and conrelid = 'public.external_calendar_events'::regclass
  ) then
    alter table public.external_calendar_events
      add constraint external_calendar_events_description_length
      check (description is null or char_length(description) <= 2000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'external_calendar_events_source_status'
      and conrelid = 'public.external_calendar_events'::regclass
  ) then
    alter table public.external_calendar_events
      add constraint external_calendar_events_source_status
      check (source_status in ('TENTATIVE', 'CONFIRMED', 'CANCELLED', 'UNKNOWN'));
  end if;
end $$;

alter table public.external_calendar_sync_state
  add column if not exists sync_lock_id uuid,
  add column if not exists sync_lock_until timestamptz;

create table if not exists public.external_calendar_sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider = 'airbnb'),
  trigger_source text not null default 'manual'
    check (trigger_source in ('manual', 'cron', 'background')),
  import_source text not null default 'unknown'
    check (import_source in ('admin', 'vercel', 'unknown')),
  status text not null check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  events_seen integer not null default 0 check (events_seen >= 0),
  conflicts_seen integer not null default 0 check (conflicts_seen >= 0),
  active_events integer not null default 0 check (active_events >= 0),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists external_calendar_sync_runs_recent_idx
  on public.external_calendar_sync_runs(provider, started_at desc);

alter table public.external_calendar_sync_runs enable row level security;
revoke all on table public.external_calendar_sync_runs from public, anon, authenticated;
grant select, insert, update on table public.external_calendar_sync_runs to service_role;

-- The lock survives the network fetch and expires if a serverless invocation
-- is terminated. This prevents two admin/cron invocations from racing the
-- stale-event replacement while still allowing a later run to recover.
create or replace function public.acquire_snowaz_airbnb_sync_lock(
  p_lock_id uuid,
  p_lock_until timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  acquired boolean;
begin
  if p_lock_id is null or p_lock_until is null or p_lock_until <= now() then
    return false;
  end if;

  insert into public.external_calendar_sync_state(provider)
    values ('airbnb')
    on conflict (provider) do nothing;

  update public.external_calendar_sync_state
    set sync_lock_id = p_lock_id,
        sync_lock_until = p_lock_until
    where provider = 'airbnb'
      and (sync_lock_until is null or sync_lock_until <= now())
    returning true into acquired;

  return coalesce(acquired, false);
end
$$;

revoke all on function public.acquire_snowaz_airbnb_sync_lock(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.acquire_snowaz_airbnb_sync_lock(uuid, timestamptz)
  to service_role;

create or replace function public.release_snowaz_airbnb_sync_lock(p_lock_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.external_calendar_sync_state
  set sync_lock_id = null, sync_lock_until = null
  where provider = 'airbnb' and sync_lock_id = p_lock_id;
$$;

revoke all on function public.release_snowaz_airbnb_sync_lock(uuid)
  from public, anon, authenticated;
grant execute on function public.release_snowaz_airbnb_sync_lock(uuid)
  to service_role;

-- Replace the imported set in one database transaction. An empty, valid
-- VCALENDAR therefore releases dates that disappeared from Airbnb, while a
-- fetch/parse failure never reaches this function and preserves old rows.
create or replace function public.replace_snowaz_airbnb_events(
  p_events jsonb,
  p_seen_at timestamptz
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_count integer;
begin
  if p_seen_at is null or jsonb_typeof(coalesce(p_events, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid Airbnb event payload';
  end if;

  insert into public.external_calendar_events(
    provider, external_uid, check_in, check_out, status,
    summary, description, source_status, last_seen_at, updated_at
  )
  select
    'airbnb', item.external_uid, item.check_in, item.check_out, 'active',
    left(coalesce(nullif(trim(item.summary), ''), 'Unavailable'), 240),
    nullif(left(item.description, 2000), ''),
    case when item.source_status in ('TENTATIVE', 'CONFIRMED', 'CANCELLED', 'UNKNOWN')
      then item.source_status else 'UNKNOWN' end,
    p_seen_at, p_seen_at
  from (
    select distinct on (external_uid)
      external_uid, check_in, check_out, summary, description, source_status
    from jsonb_to_recordset(coalesce(p_events, '[]'::jsonb)) as rows(
      external_uid text,
      check_in date,
      check_out date,
      summary text,
      description text,
      source_status text
    )
    where external_uid is not null
      and char_length(external_uid) between 1 and 500
      and check_in is not null
      and check_out is not null
      and check_out > check_in
    order by external_uid, check_in, check_out
  ) item
  on conflict (provider, external_uid) do update
    set check_in = excluded.check_in,
        check_out = excluded.check_out,
        status = 'active',
        summary = excluded.summary,
        description = excluded.description,
        source_status = excluded.source_status,
        last_seen_at = excluded.last_seen_at,
        updated_at = excluded.updated_at;

  update public.external_calendar_events
    set status = 'cancelled', updated_at = p_seen_at
    where provider = 'airbnb'
      and status = 'active'
      and last_seen_at < p_seen_at;

  select count(*)::integer into active_count
  from public.external_calendar_events
  where provider = 'airbnb' and status = 'active';
  return active_count;
end
$$;

revoke all on function public.replace_snowaz_airbnb_events(jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.replace_snowaz_airbnb_events(jsonb, timestamptz)
  to service_role;

-- Staff can see a compact audit trail, but clients cannot read the sync tables.
create or replace function public.staff_get_snowaz_airbnb_sync_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if private.snowaz_staff_role() is null then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'provider', 'airbnb',
    'status', state.status,
    'lastStartedAt', state.last_started_at,
    'lastSucceededAt', state.last_succeeded_at,
    'lastFailedAt', state.last_failed_at,
    'lastError', state.last_error,
    'eventsSeen', state.events_seen,
    'conflictsSeen', state.conflicts_seen,
    'updatedAt', state.updated_at,
    'syncLockUntil', state.sync_lock_until,
    'activeEvents', (
      select count(*) from public.external_calendar_events event
      where event.provider = 'airbnb' and event.status = 'active'
    ),
    'websiteBookings', (
      select count(*) from public.booking_requests booking
      where booking.status in ('pending', 'contacted', 'confirmed')
        and booking.check_out > current_date
    ),
    'recentRuns', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', run.id,
        'triggerSource', run.trigger_source,
        'importSource', run.import_source,
        'status', run.status,
        'startedAt', run.started_at,
        'finishedAt', run.finished_at,
        'eventsSeen', run.events_seen,
        'conflictsSeen', run.conflicts_seen,
        'activeEvents', run.active_events,
        'errorMessage', run.error_message
      ) order by run.started_at desc)
      from (
        select * from public.external_calendar_sync_runs
        where provider = 'airbnb'
        order by started_at desc
        limit 8
      ) run
    ), '[]'::jsonb)
  ) into result
  from public.external_calendar_sync_state state
  where state.provider = 'airbnb';

  return coalesce(result, jsonb_build_object(
    'provider', 'airbnb',
    'status', 'never',
    'lastStartedAt', null,
    'lastSucceededAt', null,
    'lastFailedAt', null,
    'lastError', null,
    'eventsSeen', 0,
    'conflictsSeen', 0,
    'updatedAt', null,
    'syncLockUntil', null,
    'activeEvents', 0,
    'websiteBookings', 0,
    'recentRuns', '[]'::jsonb
  ));
end
$$;

revoke all on function public.staff_get_snowaz_airbnb_sync_status() from public, anon;
grant execute on function public.staff_get_snowaz_airbnb_sync_status() to authenticated;
