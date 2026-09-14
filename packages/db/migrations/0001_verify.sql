begin;

insert into room_types (
  id, name, slug, max_adults, max_children, bed_configuration,
  base_nightly_rate_minor, status
) values (
  '10000000-0000-4000-8000-000000000001',
  'Verification Room Type',
  'verification-room-type',
  2,
  0,
  '[{"type":"queen","count":1}]'::jsonb,
  100000,
  'draft'
);

insert into rooms (id, room_type_id, room_number)
values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'VERIFY-101'
);

insert into guests (id, full_name, normalized_email)
values (
  '30000000-0000-4000-8000-000000000001',
  'Verification Guest',
  'verification@example.com'
);

insert into reservations (
  id, room_id, guest_id, check_in, check_out, guest_count, status,
  source, confirmation_code_hash, total_minor,
  cancellation_policy_snapshot, consent_version, consented_at
) values (
  '40000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '2026-08-10', '2026-08-12', 2, 'confirmed', 'guest_web',
  'verification-hash-1', 200000, '{"days":0}'::jsonb, 'draft', now()
);

-- Back-to-back is valid because stays are represented as [check_in, check_out).
insert into reservations (
  id, room_id, guest_id, check_in, check_out, guest_count, status,
  source, confirmation_code_hash, total_minor,
  cancellation_policy_snapshot, consent_version, consented_at
) values (
  '40000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '2026-08-12', '2026-08-13', 1, 'confirmed', 'phone',
  'verification-hash-2', 100000, '{"days":0}'::jsonb, 'draft', now()
);

do $$
begin
  begin
    insert into reservations (
      room_id, guest_id, check_in, check_out, guest_count, status,
      source, confirmation_code_hash, total_minor,
      cancellation_policy_snapshot, consent_version, consented_at
    ) values (
      '20000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      '2026-08-11', '2026-08-13', 1, 'confirmed', 'staff',
      'verification-overlap', 100000, '{"days":0}'::jsonb, 'draft', now()
    );
    raise exception 'overlapping reservation was incorrectly accepted';
  exception
    when exclusion_violation then null;
  end;
end $$;

rollback;
