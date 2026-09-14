create type booking_request_status as enum ('pending', 'contacted', 'confirmed', 'declined', 'cancelled');

create table booking_requests (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  room_type_id uuid references room_types(id) on delete set null,
  full_name text not null,
  normalized_email text not null,
  phone text not null,
  check_in date not null,
  check_out date not null,
  guest_count integer not null,
  special_requests text,
  status booking_request_status not null default 'pending',
  source text not null default 'guest_web',
  consent_version text not null,
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_requests_valid_stay check (check_out > check_in),
  constraint booking_requests_valid_guest_count check (guest_count between 1 and 20)
);

create index booking_requests_status_created_idx on booking_requests (status, created_at desc);
create index booking_requests_check_in_idx on booking_requests (check_in);
alter table booking_requests enable row level security;

comment on table booking_requests is 'Unconfirmed guest enquiries. Server-only writes; staff review before inventory is reserved.';
