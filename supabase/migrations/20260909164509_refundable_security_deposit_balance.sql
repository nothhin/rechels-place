-- Security deposits are refundable and never reduce the accommodation balance.
alter table public.booking_requests drop constraint if exists booking_requests_financials_valid;
alter table public.booking_requests add constraint booking_requests_financials_valid check (
  total_minor >= 0 and deposit_amount_minor >= 0 and balance_paid_minor >= 0
  and balance_paid_minor <= total_minor
);

create or replace function public.staff_record_snowaz_remaining_balance(target_id uuid, payment_method text, payment_reference text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare amount_due bigint;
begin
  if private.snowaz_staff_role() not in ('manager','admin') then raise exception 'not authorized'; end if;
  if char_length(trim(payment_method)) not between 2 and 40 or char_length(trim(payment_reference)) not between 3 and 80 then raise exception 'invalid payment details'; end if;
  select greatest(total_minor-balance_paid_minor,0) into amount_due from public.booking_requests where id=target_id and status='confirmed' and deposit_status='verified' for update;
  if amount_due is null or amount_due <= 0 then return false; end if;
  update public.booking_requests set balance_paid_minor=balance_paid_minor+amount_due,balance_payment_method=trim(payment_method),balance_payment_reference=trim(payment_reference),balance_paid_at=now(),updated_at=now() where id=target_id;
  insert into public.audit_log(actor_id,actor_type,action,entity_type,entity_id,request_id,redacted_metadata) values (auth.uid(),'staff','booking.remaining_balance_paid','booking_request',target_id,gen_random_uuid(),jsonb_build_object('amountMinor',amount_due,'method',trim(payment_method)));
  return true;
end; $$;
revoke all on function public.staff_record_snowaz_remaining_balance(uuid,text,text) from public, anon;
grant execute on function public.staff_record_snowaz_remaining_balance(uuid,text,text) to authenticated;
