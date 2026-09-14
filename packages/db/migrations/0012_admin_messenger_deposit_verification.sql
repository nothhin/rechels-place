create or replace function public.staff_record_and_verify_snowaz_deposit(
  target_id uuid,
  sender_name text,
  payment_reference text
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare actor uuid;
begin
  if private.snowaz_staff_role() not in ('manager','admin')
    or char_length(trim(sender_name)) not between 2 and 120
    or char_length(trim(payment_reference)) not between 6 and 80
  then raise exception 'invalid request'; end if;

  select id into actor from public.staff_users
  where identity_provider_subject=(select auth.uid())::text and status='active' limit 1;

  update public.booking_requests
  set status='confirmed',deposit_status='verified',deposit_sender_name=trim(sender_name),
      deposit_reference=trim(payment_reference),deposit_submitted_at=now(),deposit_verified_at=now(),
      deposit_token_expires_at=((check_out + 30)::timestamp at time zone 'Asia/Manila'),updated_at=now()
  where id=target_id and status in ('pending','contacted') and deposit_status='awaiting_payment'
    and deposit_token_expires_at>now();
  if not found then return false; end if;

  insert into public.audit_log(actor_id,actor_type,action,entity_type,entity_id,request_id,redacted_metadata)
  values(actor,'staff','booking.deposit_recorded_and_verified','booking_request',target_id,gen_random_uuid(),
    jsonb_build_object('amountMinor',100000,'source','messenger_receipt'));
  return true;
end;
$$;

revoke all on function public.staff_record_and_verify_snowaz_deposit(uuid,text,text) from public, anon;
grant execute on function public.staff_record_and_verify_snowaz_deposit(uuid,text,text) to authenticated;
