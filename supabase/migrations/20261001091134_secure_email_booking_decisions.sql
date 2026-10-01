create or replace function public.apply_rechels_email_booking_decision(
  target_id uuid,
  decision text
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_decision text := lower(trim(decision));
  current_status public.booking_request_status;
  next_status public.booking_request_status;
begin
  if normalized_decision not in ('accept', 'decline') then
    raise exception 'invalid booking decision';
  end if;

  select status
  into current_status
  from public.booking_requests
  where id = target_id
  for update;

  if not found then
    return 'unavailable';
  end if;

  if normalized_decision = 'accept' then
    if current_status = 'contacted' then
      return 'already_accepted';
    end if;
    if current_status <> 'pending' then
      return 'unavailable';
    end if;
    next_status := 'contacted';
  else
    if current_status = 'declined' then
      return 'already_declined';
    end if;
    if current_status <> 'pending' then
      return 'unavailable';
    end if;
    next_status := 'declined';
  end if;

  update public.booking_requests
  set status = next_status,
      updated_at = now()
  where id = target_id;

  insert into public.audit_log(
    actor_type,
    action,
    entity_type,
    entity_id,
    request_id,
    redacted_metadata
  ) values (
    'email_action',
    'booking.' || next_status::text,
    'booking_request',
    target_id,
    gen_random_uuid(),
    jsonb_build_object(
      'decision', normalized_decision,
      'previousStatus', current_status::text,
      'status', next_status::text
    )
  );

  return case normalized_decision
    when 'accept' then 'accepted'
    else 'declined'
  end;
end;
$$;

revoke all on function public.apply_rechels_email_booking_decision(uuid, text)
  from public, anon, authenticated;
grant execute on function public.apply_rechels_email_booking_decision(uuid, text)
  to service_role;

comment on function public.apply_rechels_email_booking_decision(uuid, text) is
  'Applies a signed email decision through the server-only service role. Accept moves pending to contacted; it never confirms payment.';
