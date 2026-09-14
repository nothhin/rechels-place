-- Two-way Airbnb iCal synchronization.
--
-- Airbnb reservations are stored separately from local blocks so imported
-- events can be replaced safely on every sync without touching staff-created
-- blocks or website booking records.
create table if not exists public.external_calendar_events (
  provider text not null check (provider = 'airbnb'),
  external_uid text not null,
  check_in date not null,
  check_out date not null,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider, external_uid),
  check (check_out > check_in)
);

create index if not exists external_calendar_events_active_dates_idx
  on public.external_calendar_events(provider, check_in, check_out)
  where status = 'active';

alter table public.external_calendar_events enable row level security;
revoke all on table public.external_calendar_events from public, anon, authenticated;
grant select, insert, update, delete on table public.external_calendar_events to service_role;

create table if not exists public.external_calendar_sync_state (
  provider text primary key check (provider = 'airbnb'),
  status text not null default 'never' check (status in ('never', 'running', 'succeeded', 'failed')),
  last_started_at timestamptz,
  last_succeeded_at timestamptz,
  last_failed_at timestamptz,
  last_error text,
  events_seen integer not null default 0 check (events_seen >= 0),
  conflicts_seen integer not null default 0 check (conflicts_seen >= 0),
  updated_at timestamptz not null default now()
);

alter table public.external_calendar_sync_state enable row level security;
revoke all on table public.external_calendar_sync_state from public, anon, authenticated;
grant select, insert, update, delete on table public.external_calendar_sync_state to service_role;

-- Imported Airbnb dates must participate in every booking overlap check.
create or replace function private.reject_snowaz_blocked_dates()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(
    select 1 from public.property_date_blocks x
    where x.status='active' and x.check_in<new.check_out and x.check_out>new.check_in
  ) or exists(
    select 1 from public.external_calendar_events e
    where e.provider='airbnb' and e.status='active'
      and e.check_in<new.check_out and e.check_out>new.check_in
  ) then
    raise exception 'dates unavailable';
  end if;
  return new;
end $$;

-- Keep the public calendar generic. The source of an unavailable date is an
-- admin detail and must not disclose another channel's guest information.
drop function public.get_snowaz_schedule(date,date);
create function public.get_snowaz_schedule(range_start date, range_end date)
returns table(check_in date,check_out date,display_status text,public_label text)
language sql stable security definer set search_path='' as $$
  select r.check_in,r.check_out,r.display_status,null::text
  from public.snowaz_calendar_ranges r
  where r.check_in<range_end and r.check_out>range_start
  union all
  select x.check_in,x.check_out,'unavailable'::text,
    coalesce(nullif(array_to_string((regexp_split_to_array(trim(regexp_replace(x.reason,'[^[:alnum:] -]+','','g')),'\\s+'))[1:2],' '),''),'Unavailable')
  from public.property_date_blocks x
  where x.status='active' and x.check_in<range_end and x.check_out>range_start
  union all
  select e.check_in,e.check_out,'unavailable'::text,'Unavailable'::text
  from public.external_calendar_events e
  where e.provider='airbnb' and e.status='active'
    and e.check_in<range_end and e.check_out>range_start
$$;
revoke all on function public.get_snowaz_schedule(date,date) from public;
grant execute on function public.get_snowaz_schedule(date,date) to anon,authenticated;

-- Staff-only status read for the operations workspace. The iCal URL and
-- export token never leave server environment variables.
create or replace function public.staff_get_snowaz_airbnb_sync_status()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if private.snowaz_staff_role() is null then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'provider','airbnb',
    'status',s.status,
    'lastStartedAt',s.last_started_at,
    'lastSucceededAt',s.last_succeeded_at,
    'lastFailedAt',s.last_failed_at,
    'lastError',s.last_error,
    'eventsSeen',s.events_seen,
    'conflictsSeen',s.conflicts_seen,
    'updatedAt',s.updated_at,
    'activeEvents',(select count(*) from public.external_calendar_events e where e.provider='airbnb' and e.status='active')
  ) into result
  from public.external_calendar_sync_state s
  where s.provider='airbnb';
  return coalesce(result, jsonb_build_object(
    'provider','airbnb','status','never','lastStartedAt',null,'lastSucceededAt',null,
    'lastFailedAt',null,'lastError',null,'eventsSeen',0,'conflictsSeen',0,'updatedAt',null,'activeEvents',0
  ));
end $$;
revoke all on function public.staff_get_snowaz_airbnb_sync_status() from public,anon;
grant execute on function public.staff_get_snowaz_airbnb_sync_status() to authenticated;

-- Manual blocks must not be allowed to overlap an imported Airbnb stay.
create or replace function public.staff_manage_snowaz_date_block(target_id uuid, arrival date, departure date, block_reason text, release_block boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare result_id uuid;
begin
  if private.snowaz_staff_role() not in ('manager','admin') then raise exception 'not authorized'; end if;
  if release_block then
    update public.property_date_blocks set status='released',released_by=auth.uid(),released_at=now()
    where id=target_id and status='active' returning id into result_id;
    return result_id;
  end if;
  if departure<=arrival or char_length(trim(block_reason))<3 then raise exception 'invalid block'; end if;
  if exists(select 1 from public.snowaz_calendar_ranges r where r.check_in<departure and r.check_out>arrival)
    or exists(select 1 from public.property_date_blocks x where x.status='active' and x.check_in<departure and x.check_out>arrival)
    or exists(select 1 from public.external_calendar_events e where e.provider='airbnb' and e.status='active' and e.check_in<departure and e.check_out>arrival) then
    raise exception 'booking conflict';
  end if;
  insert into public.property_date_blocks(check_in,check_out,reason,created_by)
  values(arrival,departure,trim(block_reason),auth.uid()) returning id into result_id;
  return result_id;
end $$;
revoke all on function public.staff_manage_snowaz_date_block(uuid,date,date,text,boolean) from public,anon;
grant execute on function public.staff_manage_snowaz_date_block(uuid,date,date,text,boolean) to authenticated;
