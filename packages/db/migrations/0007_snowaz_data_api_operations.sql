create or replace function private.snowaz_staff_role()
returns text language sql stable security definer set search_path = '' as $$
  select role::text from public.staff_users
  where identity_provider_subject = (select auth.uid())::text and status = 'active'
  limit 1
$$;
revoke all on function private.snowaz_staff_role() from public, anon, authenticated;

create or replace function public.get_snowaz_staff_profile()
returns table(id uuid, email text, role text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.email, s.role::text from public.staff_users s
  where s.identity_provider_subject = (select auth.uid())::text and s.status = 'active'
  limit 1
$$;
revoke all on function public.get_snowaz_staff_profile() from public, anon;
grant execute on function public.get_snowaz_staff_profile() to authenticated;

create or replace function public.get_snowaz_admin_dashboard()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if private.snowaz_staff_role() is null then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'templates', coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'slug',t.slug,'maxAdults',t.max_adults,'maxChildren',t.max_children,'baseNightlyRateMinor',t.base_nightly_rate_minor,'displayOrder',t.display_order,'status',t.status) order by t.display_order) from public.room_types t), '[]'::jsonb),
    'inventory', coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'roomNumber',r.room_number,'floor',r.floor,'status',r.status,'roomTypeName',t.name) order by r.room_number) from public.rooms r join public.room_types t on t.id=r.room_type_id), '[]'::jsonb),
    'upcoming', coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'checkIn',r.check_in,'checkOut',r.check_out,'status',r.status,'guestCount',r.guest_count,'totalMinor',r.total_minor,'currency',r.currency,'guestName',g.full_name,'roomNumber',rm.room_number,'roomTypeName',rt.name) order by r.check_in) from public.reservations r join public.guests g on g.id=r.guest_id join public.rooms rm on rm.id=r.room_id join public.room_types rt on rt.id=rm.room_type_id where r.status in ('confirmed','checked_in') and r.check_out >= current_date limit 25), '[]'::jsonb),
    'enquiries', coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'fullName',b.full_name,'email',b.normalized_email,'phone',b.phone,'checkIn',b.check_in,'checkOut',b.check_out,'guestCount',b.guest_count,'status',b.status,'depositStatus',b.deposit_status,'depositSenderName',b.deposit_sender_name,'depositReference',b.deposit_reference,'depositSubmittedAt',b.deposit_submitted_at,'depositRefundReference',b.deposit_refund_reference,'roomTypeName',rt.name) order by b.created_at desc) from (select * from public.booking_requests order by created_at desc limit 30) b left join public.room_types rt on rt.id=b.room_type_id), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.get_snowaz_admin_dashboard() from public, anon;
grant execute on function public.get_snowaz_admin_dashboard() to authenticated;

create or replace function public.staff_start_snowaz_deposit(target_id uuid, token_hash text, expires_at timestamptz)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if private.snowaz_staff_role() not in ('manager','admin') then raise exception 'not authorized'; end if;
  update public.booking_requests set status='contacted',deposit_status='awaiting_payment',deposit_amount_minor=100000,deposit_token_hash=token_hash,deposit_token_expires_at=expires_at,deposit_sender_name=null,deposit_reference=null,deposit_submitted_at=null,deposit_verified_at=null,deposit_refund_reference=null,deposit_refunded_at=null,updated_at=now() where id=target_id and source='snowaz_guest_web';
  if not found then return false; end if;
  insert into public.audit_log(actor_id,actor_type,action,entity_type,entity_id,request_id,redacted_metadata) select id,'staff','booking.deposit_requested','booking_request',target_id,gen_random_uuid(),jsonb_build_object('amountMinor',100000,'expiresAt',expires_at) from public.staff_users where identity_provider_subject=(select auth.uid())::text limit 1;
  return true;
end;
$$;

create or replace function public.staff_verify_snowaz_deposit(target_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if private.snowaz_staff_role() not in ('manager','admin') then raise exception 'not authorized'; end if;
  update public.booking_requests set status='confirmed',deposit_status='verified',deposit_verified_at=now(),deposit_token_expires_at=null,updated_at=now() where id=target_id and deposit_status='submitted';
  if not found then return false; end if;
  insert into public.audit_log(actor_id,actor_type,action,entity_type,entity_id,request_id,redacted_metadata) select id,'staff','booking.deposit_verified','booking_request',target_id,gen_random_uuid(),jsonb_build_object('amountMinor',100000) from public.staff_users where identity_provider_subject=(select auth.uid())::text limit 1;
  return true;
end;
$$;

create or replace function public.staff_refund_snowaz_deposit(target_id uuid, refund_reference text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if private.snowaz_staff_role() not in ('manager','admin') or char_length(trim(refund_reference)) not between 6 and 80 then raise exception 'invalid request'; end if;
  update public.booking_requests set deposit_status='refunded',deposit_refund_reference=trim(refund_reference),deposit_refunded_at=now(),updated_at=now() where id=target_id and deposit_status='verified';
  if not found then return false; end if;
  insert into public.audit_log(actor_id,actor_type,action,entity_type,entity_id,request_id,redacted_metadata) select id,'staff','booking.deposit_refunded','booking_request',target_id,gen_random_uuid(),jsonb_build_object('amountMinor',100000) from public.staff_users where identity_provider_subject=(select auth.uid())::text limit 1;
  return true;
end;
$$;

revoke all on function public.staff_start_snowaz_deposit(uuid,text,timestamptz), public.staff_verify_snowaz_deposit(uuid), public.staff_refund_snowaz_deposit(uuid,text) from public, anon;
grant execute on function public.staff_start_snowaz_deposit(uuid,text,timestamptz), public.staff_verify_snowaz_deposit(uuid), public.staff_refund_snowaz_deposit(uuid,text) to authenticated;

create or replace function public.get_snowaz_deposit_request(token_hash text)
returns table(full_name text,check_in date,check_out date,guest_count integer,deposit_status text,deposit_amount_minor bigint,deposit_token_expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select b.full_name,b.check_in,b.check_out,b.guest_count,b.deposit_status::text,b.deposit_amount_minor,b.deposit_token_expires_at from public.booking_requests b where b.deposit_token_hash=token_hash limit 1
$$;

create or replace function public.submit_snowaz_deposit_reference(token_hash text,sender_name text,payment_reference text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare target_id uuid;
begin
  if char_length(trim(sender_name)) not between 2 and 120 or char_length(trim(payment_reference)) not between 6 and 80 then return false; end if;
  update public.booking_requests set deposit_status='submitted',deposit_sender_name=trim(sender_name),deposit_reference=trim(payment_reference),deposit_submitted_at=now(),updated_at=now() where deposit_token_hash=token_hash and deposit_status='awaiting_payment' and deposit_token_expires_at>now() returning id into target_id;
  if target_id is null then return false; end if;
  insert into public.audit_log(actor_type,action,entity_type,entity_id,request_id,redacted_metadata) values ('guest','booking.deposit_reference_submitted','booking_request',target_id,gen_random_uuid(),jsonb_build_object('amountMinor',100000));
  return true;
end;
$$;
revoke all on function public.get_snowaz_deposit_request(text), public.submit_snowaz_deposit_reference(text,text,text) from public;
grant execute on function public.get_snowaz_deposit_request(text), public.submit_snowaz_deposit_reference(text,text,text) to anon, authenticated;
