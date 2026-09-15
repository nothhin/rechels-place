-- Operational edits must never silently replace an existing booking's
-- agreed price snapshot with the current pricing configuration.

create or replace function public.staff_update_snowaz_booking(
  target_id uuid, arrival date, departure date, guests integer,
  bedroom_selection text, next_stay_status text,
  id_type text default null, id_last4 text default null
)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  booking public.booking_requests%rowtype;
  current_status public.booking_request_status;
begin
  if private.snowaz_staff_role() not in ('manager', 'admin') then
    raise exception 'not authorized';
  end if;
  if guests not between 1 and 6 or departure <= arrival
    or bedroom_selection not in ('bedroom_1', 'bedroom_2', 'both_bedrooms')
    or (bedroom_selection = 'bedroom_1' and guests > 2)
    or next_stay_status not in ('upcoming', 'checked_in', 'checked_out', 'no_show') then
    raise exception 'invalid booking update';
  end if;

  select * into booking
  from public.booking_requests
  where id = target_id
  for update;
  if not found or booking.status in ('declined', 'cancelled') then
    return false;
  end if;

  -- Dates, guest count, and bedroom selection all affect the agreed total.
  -- Keep this operational action limited to status and guest-verification
  -- details. A future explicit reprice workflow must be a separate action.
  if booking.check_in <> arrival
    or booking.check_out <> departure
    or booking.guest_count <> guests
    or booking.bedroom_choice <> bedroom_selection then
    raise exception 'booking price snapshot is protected; use the explicit reprice workflow';
  end if;

  current_status := booking.status;
  update public.booking_requests set
    stay_status = next_stay_status,
    primary_guest_id_type = nullif(trim(coalesce(id_type, '')), ''),
    primary_guest_id_last4 = upper(nullif(trim(coalesce(id_last4, '')), '')),
    primary_guest_verified_at = case when trim(coalesce(id_type, '')) <> ''
      and trim(coalesce(id_last4, '')) ~ '^[A-Za-z0-9]{4}$' then now() end,
    primary_guest_verified_by = case when trim(coalesce(id_type, '')) <> '' then auth.uid() end,
    updated_at = now()
  where id = target_id;

  update public.snowaz_calendar_ranges set
    check_in = booking.check_in,
    check_out = booking.check_out,
    display_status = case when current_status = 'confirmed' then 'booked' else 'pending' end
  where source_kind = 'booking_request' and source_id = target_id;
  if not found then
    insert into public.snowaz_calendar_ranges(
      source_kind, source_id, check_in, check_out, display_status
    ) values (
      'booking_request', target_id, booking.check_in, booking.check_out,
      case when current_status = 'confirmed' then 'booked' else 'pending' end
    );
  end if;

  insert into public.audit_log(
    actor_id, actor_type, action, entity_type, entity_id, request_id,
    redacted_metadata
  ) values (
    auth.uid(), 'staff', 'booking.updated', 'booking_request', target_id,
    gen_random_uuid(), jsonb_build_object(
      'stayStatus', next_stay_status,
      'priceSnapshotPreserved', true,
      'totalMinor', booking.total_minor
    )
  );
  return true;
end;
$$;

revoke all on function public.staff_update_snowaz_booking(
  uuid, date, date, integer, text, text, text, text
) from public, anon;
grant execute on function public.staff_update_snowaz_booking(
  uuid, date, date, integer, text, text, text, text
) to authenticated;
