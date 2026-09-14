-- Private deposit links accept payment for two hours, become read-only after proof,
-- and remain available for status/cancellation until 30 days after checkout or refund.

update public.booking_requests
set deposit_token_expires_at = case
  when deposit_status = 'refunded' and deposit_refunded_at is not null then deposit_refunded_at + interval '30 days'
  else ((check_out + 30)::timestamp at time zone 'Asia/Manila')
end
where deposit_token_hash is not null
  and deposit_status in ('submitted','verified','refund_pending','refunded','partially_withheld','forfeited')
  and (deposit_token_expires_at is null or deposit_token_expires_at < now());

create or replace function public.get_snowaz_deposit_request(token_hash text)
returns table(full_name text,check_in date,check_out date,guest_count integer,deposit_status text,deposit_amount_minor bigint,deposit_token_expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select b.full_name,b.check_in,b.check_out,b.guest_count,b.deposit_status::text,b.deposit_amount_minor,b.deposit_token_expires_at
  from public.booking_requests b
  where b.deposit_token_hash=token_hash and b.deposit_token_expires_at>now()
  limit 1
$$;

create or replace function public.submit_snowaz_deposit_reference(token_hash text,sender_name text,payment_reference text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare target_id uuid;
begin
  if char_length(trim(sender_name)) not between 2 and 120 or char_length(trim(payment_reference)) not between 6 and 80 then return false; end if;
  update public.booking_requests
  set deposit_status='submitted',deposit_sender_name=trim(sender_name),deposit_reference=trim(payment_reference),
      deposit_submitted_at=now(),deposit_token_expires_at=((check_out + 30)::timestamp at time zone 'Asia/Manila'),updated_at=now()
  where deposit_token_hash=token_hash and deposit_status='awaiting_payment' and deposit_token_expires_at>now()
  returning id into target_id;
  if target_id is null then return false; end if;
  insert into public.audit_log(actor_type,action,entity_type,entity_id,request_id,redacted_metadata)
  values ('guest','booking.deposit_reference_submitted','booking_request',target_id,gen_random_uuid(),jsonb_build_object('amountMinor',100000));
  return true;
end;
$$;

create or replace function public.staff_verify_snowaz_deposit(target_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if private.snowaz_staff_role() not in ('manager','admin') then raise exception 'not authorized'; end if;
  update public.booking_requests
  set status='confirmed',deposit_status='verified',deposit_verified_at=now(),
      deposit_token_expires_at=((check_out + 30)::timestamp at time zone 'Asia/Manila'),updated_at=now()
  where id=target_id and deposit_status='submitted';
  if not found then return false; end if;
  insert into public.audit_log(actor_id,actor_type,action,entity_type,entity_id,request_id,redacted_metadata)
  select id,'staff','booking.deposit_verified','booking_request',target_id,gen_random_uuid(),jsonb_build_object('amountMinor',100000)
  from public.staff_users where identity_provider_subject=(select auth.uid())::text limit 1;
  return true;
end;
$$;

create or replace function public.staff_refund_snowaz_deposit(target_id uuid, refund_reference text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if private.snowaz_staff_role() not in ('manager','admin') or char_length(trim(refund_reference)) not between 6 and 80 then raise exception 'invalid request'; end if;
  update public.booking_requests
  set deposit_status='refunded',deposit_refund_reference=trim(refund_reference),deposit_refunded_at=now(),
      deposit_token_expires_at=now()+interval '30 days',updated_at=now()
  where id=target_id and deposit_status in ('verified','refund_pending');
  if not found then return false; end if;
  insert into public.audit_log(actor_id,actor_type,action,entity_type,entity_id,request_id,redacted_metadata)
  select id,'staff','booking.deposit_refunded','booking_request',target_id,gen_random_uuid(),jsonb_build_object('amountMinor',100000)
  from public.staff_users where identity_provider_subject=(select auth.uid())::text limit 1;
  return true;
end;
$$;

revoke all on function public.get_snowaz_deposit_request(text), public.submit_snowaz_deposit_reference(text,text,text) from public;
grant execute on function public.get_snowaz_deposit_request(text), public.submit_snowaz_deposit_reference(text,text,text) to anon, authenticated;
revoke all on function public.staff_verify_snowaz_deposit(uuid), public.staff_refund_snowaz_deposit(uuid,text) from public, anon;
grant execute on function public.staff_verify_snowaz_deposit(uuid), public.staff_refund_snowaz_deposit(uuid,text) to authenticated;
