-- Keep the admin calendar on the same authoritative sources as the public
-- availability calendar, while returning the private details staff need.
create or replace function public.staff_get_snowaz_calendar()
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
    'bookings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'bookingReference', 'RECHEL-' || upper(substr(replace(b.id::text, '-', ''), 1, 8)),
        'fullName', b.full_name,
        'checkIn', b.check_in,
        'checkOut', b.check_out,
        'guestCount', b.guest_count,
        'bedroomChoice', b.bedroom_choice,
        'status', b.status::text
      ) order by b.check_in, b.created_at)
      from public.booking_requests b
      where b.status not in ('declined', 'cancelled')
    ), '[]'::jsonb),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id,
        'checkIn', x.check_in,
        'checkOut', x.check_out,
        'reason', x.reason,
        'status', x.status,
        'createdAt', x.created_at,
        'createdBy', x.created_by,
        'createdByEmail', nullif(u.email, ''),
        'releasedAt', x.released_at,
        'releasedBy', x.released_by
      ) order by x.check_in, x.created_at)
      from public.property_date_blocks x
      left join auth.users u on u.id = x.created_by
    ), '[]'::jsonb),
    'externalBlocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'provider', e.provider,
        'externalUid', e.external_uid,
        'checkIn', e.check_in,
        'checkOut', e.check_out,
        'status', e.status,
        'updatedAt', e.updated_at
      ) order by e.check_in, e.updated_at)
      from public.external_calendar_events e
      where e.provider = 'airbnb' and e.status = 'active'
    ), '[]'::jsonb)
  ) into result;

  return result;
end
$$;

revoke all on function public.staff_get_snowaz_calendar() from public, anon;
grant execute on function public.staff_get_snowaz_calendar() to authenticated;

-- Re-check all active website requests during submission. This closes the
-- race where a booking request exists before its calendar-range projection.
create or replace function private.reject_snowaz_blocked_dates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.property_date_blocks x
    where x.status = 'active'
      and x.check_in < new.check_out and x.check_out > new.check_in
  ) or exists (
    select 1 from public.external_calendar_events e
    where e.provider = 'airbnb' and e.status = 'active'
      and e.check_in < new.check_out and e.check_out > new.check_in
  ) or exists (
    select 1 from public.booking_requests b
    where b.id <> new.id
      and b.status in ('pending', 'contacted', 'confirmed')
      and b.check_in < new.check_out and b.check_out > new.check_in
  ) then
    raise exception 'dates unavailable';
  end if;
  return new;
end
$$;

-- Serialize manual changes with other calendar writes and never overwrite a
-- reservation, pending request, external event, or another manual block.
create or replace function public.staff_manage_snowaz_date_block(
  target_id uuid,
  arrival date,
  departure date,
  block_reason text,
  release_block boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_id uuid;
begin
  if private.snowaz_staff_role() not in ('manager', 'admin') then
    raise exception 'not authorized';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('uppadar-calendar-availability', 0)
  );

  if release_block then
    update public.property_date_blocks
      set status = 'released', released_by = auth.uid(), released_at = now()
      where id = target_id and status = 'active'
      returning id into result_id;
    if result_id is not null then
      insert into public.audit_log(actor_id, actor_type, action, entity_type, entity_id, request_id, redacted_metadata)
      values (auth.uid(), 'staff', 'availability.block_released', 'property_date_block', result_id, gen_random_uuid(),
        jsonb_build_object('checkIn', (select check_in from public.property_date_blocks where id = result_id),
                           'checkOut', (select check_out from public.property_date_blocks where id = result_id)));
    end if;
    return result_id;
  end if;

  if departure <= arrival or char_length(trim(block_reason)) < 3 then
    raise exception 'invalid block';
  end if;
  if exists (
    select 1 from public.snowaz_calendar_ranges r
    where r.check_in < departure and r.check_out > arrival
  ) or exists (
    select 1 from public.booking_requests b
    where b.status in ('pending', 'contacted', 'confirmed')
      and b.check_in < departure and b.check_out > arrival
  ) or exists (
    select 1 from public.property_date_blocks x
    where x.status = 'active' and x.check_in < departure and x.check_out > arrival
  ) or exists (
    select 1 from public.external_calendar_events e
    where e.provider = 'airbnb' and e.status = 'active'
      and e.check_in < departure and e.check_out > arrival
  ) then
    raise exception 'booking conflict';
  end if;

  insert into public.property_date_blocks(check_in, check_out, reason, created_by)
    values (arrival, departure, trim(block_reason), auth.uid())
    returning id into result_id;

  insert into public.audit_log(actor_id, actor_type, action, entity_type, entity_id, request_id, redacted_metadata)
    values (auth.uid(), 'staff', 'availability.block_created', 'property_date_block', result_id, gen_random_uuid(),
      jsonb_build_object('checkIn', arrival, 'checkOut', departure));

  return result_id;
end
$$;

revoke all on function public.staff_manage_snowaz_date_block(uuid, date, date, text, boolean) from public, anon;
grant execute on function public.staff_manage_snowaz_date_block(uuid, date, date, text, boolean) to authenticated;
