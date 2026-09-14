-- Keep the admin status action available in the Supabase migration stream.
-- The first Rechel's Place deployment had the frontend call this RPC, but the
-- hosted project did not yet contain it.
create or replace function public.staff_update_snowaz_booking_status(
  target_id uuid,
  next_status text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
  actor uuid;
  current_status text;
begin
  if private.snowaz_staff_role() not in ('manager', 'admin') then
    raise exception 'not authorized';
  end if;

  select id into actor
  from public.staff_users
  where identity_provider_subject = (select auth.uid())::text
    and status = 'active'
  limit 1;

  if next_status = 'declined' then
    update public.booking_requests
    set status = 'declined', updated_at = now()
    where id = target_id
      and status in ('pending', 'contacted')
      and deposit_status in ('not_requested', 'awaiting_payment');
  elsif next_status = 'cancelled' then
    update public.booking_requests
    set status = 'cancelled',
        deposit_status = case
          when deposit_status = 'verified' then 'refund_pending'::public.deposit_status
          else deposit_status
        end,
        cancelled_at = coalesce(cancelled_at, now()),
        updated_at = now()
    where id = target_id
      and status in ('pending', 'contacted', 'confirmed');
  else
    raise exception 'invalid booking status';
  end if;

  get diagnostics affected = row_count;

  -- A retry after the first request has committed is a successful no-op.
  if affected = 0 then
    select status::text into current_status
    from public.booking_requests
    where id = target_id;
    return coalesce(current_status = next_status, false);
  end if;

  insert into public.audit_log(
    actor_id, actor_type, action, entity_type, entity_id, request_id, redacted_metadata
  ) values (
    actor, 'staff', 'booking.' || next_status, 'booking_request', target_id,
    gen_random_uuid(), jsonb_build_object('status', next_status)
  );

  if next_status = 'cancelled' then
    insert into public.booking_notifications(
      booking_request_id, notification_type, recipient, channel
    )
    select id, 'cancellation',
      case when preferred_contact = 'email' then normalized_email else phone end,
      preferred_contact
    from public.booking_requests
    where id = target_id;
  end if;

  return true;
end;
$$;

revoke all on function public.staff_update_snowaz_booking_status(uuid, text)
  from public, anon;
grant execute on function public.staff_update_snowaz_booking_status(uuid, text)
  to authenticated;
