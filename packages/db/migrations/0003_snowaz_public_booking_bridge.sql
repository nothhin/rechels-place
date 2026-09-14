create table if not exists public.snowaz_calendar_ranges (
  source_kind text not null check (source_kind in ('reservation', 'booking_request')),
  source_id uuid not null,
  check_in date not null,
  check_out date not null,
  display_status text not null check (display_status in ('booked', 'pending')),
  primary key (source_kind, source_id),
  check (check_out > check_in)
);

alter table public.snowaz_calendar_ranges enable row level security;
grant select on public.snowaz_calendar_ranges to anon, authenticated;

create policy "Public can view SnowAZ calendar ranges"
on public.snowaz_calendar_ranges for select
to anon, authenticated
using (true);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.sync_snowaz_booking_calendar()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare target_id uuid;
begin
  target_id := case when tg_op = 'DELETE' then old.id else new.id end;
  delete from public.snowaz_calendar_ranges where source_kind = 'booking_request' and source_id = target_id;
  if tg_op <> 'DELETE' and new.source = 'snowaz_guest_web' and new.status in ('pending', 'contacted') then
    insert into public.snowaz_calendar_ranges values ('booking_request', new.id, new.check_in, new.check_out, 'pending');
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.sync_snowaz_reservation_calendar()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare target_id uuid;
begin
  target_id := case when tg_op = 'DELETE' then old.id else new.id end;
  delete from public.snowaz_calendar_ranges where source_kind = 'reservation' and source_id = target_id;
  if tg_op <> 'DELETE' and new.status in ('confirmed', 'checked_in') and exists (
    select 1 from public.rooms r join public.room_types rt on rt.id = r.room_type_id
    where r.id = new.room_id and rt.slug = 'snowaz-condo-stay'
  ) then
    insert into public.snowaz_calendar_ranges values ('reservation', new.id, new.check_in, new.check_out, 'booked');
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.sync_snowaz_booking_calendar() from public, anon, authenticated;
revoke all on function private.sync_snowaz_reservation_calendar() from public, anon, authenticated;

create trigger sync_snowaz_booking_calendar after insert or update or delete on public.booking_requests
for each row execute function private.sync_snowaz_booking_calendar();
create trigger sync_snowaz_reservation_calendar after insert or update or delete on public.reservations
for each row execute function private.sync_snowaz_reservation_calendar();

grant insert on public.booking_requests to anon, authenticated;
create policy "Public can submit SnowAZ booking requests"
on public.booking_requests for insert to anon, authenticated
with check (
  source = 'snowaz_guest_web' and status = 'pending' and room_type_id is null
  and char_length(full_name) between 2 and 120
  and char_length(normalized_email) between 3 and 320
  and char_length(phone) between 5 and 40
  and guest_count between 1 and 20 and check_out > check_in
  and check_in >= current_date and check_out <= current_date + 366
  and consent_version = 'booking-request-v1'
);
