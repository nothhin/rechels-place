create or replace function public.staff_update_snowaz_booking_status(target_id uuid, next_status text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare affected integer; actor uuid;
begin
  if private.snowaz_staff_role() not in ('manager', 'admin') then raise exception 'not authorized'; end if;
  select id into actor from public.staff_users where identity_provider_subject = (select auth.uid())::text limit 1;

  if next_status = 'declined' then
    update public.booking_requests set status='declined', updated_at=now()
    where id=target_id and status in ('pending','contacted') and deposit_status in ('not_requested','awaiting_payment');
  elsif next_status = 'cancelled' then
    update public.booking_requests set status='cancelled',
      deposit_status=case when deposit_status='verified' then 'refund_pending'::public.deposit_status else deposit_status end,
      updated_at=now()
    where id=target_id and status in ('pending','contacted','confirmed');
  else raise exception 'invalid booking status';
  end if;

  get diagnostics affected = row_count;
  if affected = 1 then
    insert into public.audit_log(actor_id,actor_type,action,entity_type,entity_id,request_id,redacted_metadata)
    values(actor,'staff','booking.' || next_status,'booking_request',target_id,gen_random_uuid(),jsonb_build_object('status',next_status));
  end if;
  return affected = 1;
end;
$$;
revoke all on function public.staff_update_snowaz_booking_status(uuid,text) from public, anon;
grant execute on function public.staff_update_snowaz_booking_status(uuid,text) to authenticated;
