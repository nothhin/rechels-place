-- Keep failed and concurrent administrator update attempts visible in the
-- existing audit log without exposing database error text to public clients.

create or replace function public.staff_update_snowaz_price(
  price_key text,
  new_amount_minor bigint,
  new_percentage_basis_points integer,
  expected_revision bigint,
  reason text default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid;
  failure_message text;
  failure_code text;
begin
  begin
    return private.snowaz_update_price(
      price_key, new_amount_minor, new_percentage_basis_points,
      expected_revision, reason
    );
  exception when others then
    get stacked diagnostics failure_message = message_text;
    failure_code := case
      when failure_message = 'price changed by another admin; reload the page'
        then 'price_revision_conflict'
      else 'price_update_failed'
    end;

    select id into actor
    from public.staff_users
    where identity_provider_subject = (select auth.uid())::text
      and status = 'active'
    limit 1;

    begin
      insert into public.audit_log(
        actor_id, actor_type, action, entity_type, entity_id,
        request_id, redacted_metadata
      ) values (
        actor, 'staff', 'pricing.update_failed', 'price_setting',
        coalesce(nullif(trim(price_key), ''), 'unknown'), gen_random_uuid(),
        jsonb_build_object('priceKey', nullif(trim(price_key), ''), 'errorCode', failure_code)
      );
    exception when others then
      -- A failed audit insert must not turn a safe validation response into a
      -- database error or leak implementation details to the administrator.
      null;
    end;

    return jsonb_build_object('status', 'error', 'code', failure_code);
  end;
end;
$$;

revoke all on function public.staff_update_snowaz_price(text,bigint,integer,bigint,text) from public, anon;
grant execute on function public.staff_update_snowaz_price(text,bigint,integer,bigint,text) to authenticated;
