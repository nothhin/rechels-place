create or replace function public.get_snowaz_admin_dashboard()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if private.snowaz_staff_role() is null then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'templates', coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'slug',t.slug,'maxAdults',t.max_adults,'maxChildren',t.max_children,'baseNightlyRateMinor',t.base_nightly_rate_minor,'displayOrder',t.display_order,'status',t.status) order by t.display_order) from public.room_types t), '[]'::jsonb),
    'inventory', coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'roomNumber',r.room_number,'floor',r.floor,'status',r.status,'roomTypeName',t.name) order by r.room_number) from public.rooms r join public.room_types t on t.id=r.room_type_id), '[]'::jsonb),
    'upcoming', '[]'::jsonb,
    'enquiries', coalesce((select jsonb_agg(jsonb_build_object(
      'id',b.id,'fullName',b.full_name,'email',b.normalized_email,'phone',b.phone,'preferredContact',b.preferred_contact,
      'checkIn',b.check_in,'checkOut',b.check_out,'guestCount',b.guest_count,'bedroomChoice',b.bedroom_choice,
      'stayNights',b.stay_nights,'baseNightlyRateMinor',b.base_nightly_rate_minor,'additionalGuestCount',b.additional_guest_count,
      'additionalGuestChargeMinor',b.additional_guest_charge_minor,'parkingType',b.parking_type,'parkingNightlyRateMinor',b.parking_nightly_rate_minor,'parkingChargeMinor',b.parking_charge_minor,'totalMinor',b.total_minor,'depositAmountMinor',b.deposit_amount_minor,
      'balancePaidMinor',greatest(coalesce(pay.paid_minor,0)-case when b.deposit_status='verified' then b.deposit_amount_minor else 0 end,0),
      'remainingBalanceMinor',greatest(b.total_minor-coalesce(pay.paid_minor,0),0),
      'balancePaymentMethod',b.balance_payment_method,'balancePaymentReference',b.balance_payment_reference,'balancePaidAt',b.balance_paid_at,
      'status',b.status,'depositStatus',b.deposit_status,'depositSenderName',b.deposit_sender_name,'depositReference',b.deposit_reference,
      'depositSubmittedAt',b.deposit_submitted_at,'depositRefundReference',b.deposit_refund_reference,'roomTypeName',rt.name
    ) order by b.created_at desc) from (select * from public.booking_requests order by created_at desc limit 30) b
      left join public.room_types rt on rt.id=b.room_type_id
      left join lateral (select coalesce(sum(case when p.direction='payment' then p.amount_minor else -p.amount_minor end),0)::bigint paid_minor from public.booking_payments p where p.booking_request_id=b.id and p.status='recorded') pay on true), '[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.get_snowaz_admin_dashboard() from public,anon;
grant execute on function public.get_snowaz_admin_dashboard() to authenticated;

