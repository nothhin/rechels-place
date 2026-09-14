create or replace function public.staff_verify_snowaz_deposit(target_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare deposit public.booking_requests%rowtype;
begin
  if private.snowaz_staff_role() not in ('manager','admin') then raise exception 'not authorized'; end if;
  update public.booking_requests
  set status='confirmed',deposit_status='verified',deposit_verified_at=now(),
      deposit_token_expires_at=((check_out + 30)::timestamp at time zone 'Asia/Manila'),updated_at=now()
  where id=target_id and status in ('pending','contacted') and deposit_status='submitted'
  returning * into deposit;
  if not found then return false; end if;
  insert into public.booking_payments(booking_request_id,direction,category,amount_minor,payment_method,payment_reference,recorded_by,recorded_at)
  values(target_id,'payment','down_payment',deposit.deposit_amount_minor,'bank_transfer',deposit.deposit_reference,auth.uid(),coalesce(deposit.deposit_submitted_at,now()))
  on conflict do nothing;
  insert into public.audit_log(actor_id,actor_type,action,entity_type,entity_id,request_id,redacted_metadata)
  select id,'staff','booking.deposit_verified','booking_request',target_id,gen_random_uuid(),jsonb_build_object('amountMinor',deposit.deposit_amount_minor)
  from public.staff_users where identity_provider_subject=(select auth.uid())::text limit 1;
  return true;
end $$;

create or replace function public.staff_record_and_verify_snowaz_deposit(target_id uuid, sender_name text, payment_reference text)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid; deposit public.booking_requests%rowtype;
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
    and deposit_token_expires_at>now()
  returning * into deposit;
  if not found then return false; end if;
  insert into public.booking_payments(booking_request_id,direction,category,amount_minor,payment_method,payment_reference,recorded_by)
  values(target_id,'payment','down_payment',deposit.deposit_amount_minor,'messenger_receipt',trim(payment_reference),auth.uid())
  on conflict do nothing;
  insert into public.audit_log(actor_id,actor_type,action,entity_type,entity_id,request_id,redacted_metadata)
  values(actor,'staff','booking.deposit_recorded_and_verified','booking_request',target_id,gen_random_uuid(),
    jsonb_build_object('amountMinor',deposit.deposit_amount_minor,'source','messenger_receipt'));
  return true;
end $$;

insert into public.booking_payments(booking_request_id,direction,category,amount_minor,payment_method,payment_reference,recorded_at)
select b.id,'payment','down_payment',b.deposit_amount_minor,
  case when b.deposit_submitted_at is null then 'messenger_receipt' else 'bank_transfer' end,
  coalesce(nullif(b.deposit_reference,''),'DEPOSIT-RECONCILED-'||upper(substr(replace(b.id::text,'-',''),1,8))),
  coalesce(b.deposit_verified_at,b.updated_at)
from public.booking_requests b
where b.status='confirmed' and b.deposit_status='verified'
  and not exists(select 1 from public.booking_payments p where p.booking_request_id=b.id and p.category='down_payment' and p.status='recorded')
on conflict do nothing;

create or replace function public.staff_get_snowaz_operations()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if private.snowaz_staff_role() is null then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'bookings',coalesce((select jsonb_agg(jsonb_build_object(
      'id',b.id,'reference','SNOWAZ-'||upper(substr(replace(b.id::text,'-',''),1,8)),'fullName',b.full_name,'phone',b.phone,'email',b.normalized_email,
      'checkIn',b.check_in,'checkOut',b.check_out,'guestCount',b.guest_count,'bedroomChoice',b.bedroom_choice,'bookingStatus',b.status,'stayStatus',b.stay_status,
      'totalMinor',b.total_minor,'depositAmountMinor',case when b.deposit_status='verified' then b.deposit_amount_minor else 0 end,
      'paidMinor',coalesce((select sum(case when p.direction='payment' then p.amount_minor else -p.amount_minor end) from public.booking_payments p where p.booking_request_id=b.id and p.status='recorded'),0),
      'remainingMinor',greatest(b.total_minor-coalesce((select sum(case when p.direction='payment' then p.amount_minor else -p.amount_minor end) from public.booking_payments p where p.booking_request_id=b.id and p.status='recorded'),0),0),
      'idType',b.primary_guest_id_type,'idLast4',b.primary_guest_id_last4,'idVerifiedAt',b.primary_guest_verified_at,
      'payments',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'direction',p.direction,'category',p.category,'amountMinor',p.amount_minor,'method',p.payment_method,'reference',p.payment_reference,'status',p.status,'recordedAt',p.recorded_at,'reversalReason',p.reversal_reason) order by p.recorded_at desc) from public.booking_payments p where p.booking_request_id=b.id),'[]'::jsonb)
    ) order by b.check_in desc) from public.booking_requests b where b.status='confirmed'),'[]'::jsonb),
    'blocks',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'checkIn',x.check_in,'checkOut',x.check_out,'reason',x.reason,'status',x.status) order by x.check_in) from public.property_date_blocks x),'[]'::jsonb),
    'notifications',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'bookingId',n.booking_request_id,'type',n.notification_type,'recipient',n.recipient,'channel',n.channel,'status',n.status,'dueAt',n.due_at,'attempts',n.attempt_count) order by n.created_at desc) from (select * from public.booking_notifications order by created_at desc limit 50) n),'[]'::jsonb)
  ) into result;
  return result;
end $$;

revoke all on function public.staff_get_snowaz_operations() from public,anon;
grant execute on function public.staff_get_snowaz_operations() to authenticated;
