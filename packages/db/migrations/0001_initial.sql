create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto;

create type publication_status as enum ('draft', 'published', 'archived');
create type room_status as enum ('available', 'maintenance', 'out_of_service');
create type reservation_status as enum ('confirmed', 'checked_in', 'checked_out', 'cancelled');
create type reservation_source as enum ('guest_web', 'phone', 'walk_in', 'staff');
create type staff_role as enum ('front_desk', 'manager', 'admin');
create type staff_status as enum ('invited', 'active', 'suspended', 'disabled');
create type outbox_status as enum ('pending', 'processing', 'delivered', 'failed', 'dead_letter');
create type idempotency_status as enum ('processing', 'completed', 'failed');

create table resort_settings (
  id boolean primary key default true check (id),
  legal_name text not null,
  display_name text not null,
  address text not null,
  contact_email text,
  contact_phone text,
  timezone text not null default 'Asia/Manila',
  currency text not null default 'PHP' check (currency ~ '^[A-Z]{3}$'),
  default_language text not null default 'en',
  cancellation_days integer not null default 0 check (cancellation_days >= 0),
  check_in_time text not null default '14:00' check (check_in_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  check_out_time text not null default '12:00' check (check_out_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  tax_configuration jsonb not null default '{}'::jsonb,
  terms_version text not null default 'draft',
  privacy_version text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table room_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  short_description text,
  description text,
  max_adults integer not null check (max_adults > 0),
  max_children integer not null default 0 check (max_children >= 0),
  bed_configuration jsonb not null default '[]'::jsonb,
  room_size_sqm integer check (room_size_sqm > 0),
  accessibility_features jsonb not null default '[]'::jsonb,
  base_nightly_rate_minor bigint not null check (base_nightly_rate_minor >= 0),
  display_order integer not null default 0,
  status publication_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index room_types_published_order_idx on room_types (display_order) where status = 'published';

create table amenities (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9_]+$'),
  label text not null,
  category text not null,
  icon_key text,
  active boolean not null default true
);

create table room_type_amenities (
  room_type_id uuid not null references room_types(id) on delete restrict,
  amenity_id uuid not null references amenities(id) on delete restrict,
  primary key (room_type_id, amenity_id)
);
create index room_type_amenities_amenity_id_idx on room_type_amenities (amenity_id);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  room_type_id uuid not null references room_types(id) on delete restrict,
  room_number text not null unique,
  floor text,
  status room_status not null default 'available',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rooms_room_type_id_idx on rooms (room_type_id);
create index rooms_available_type_idx on rooms (room_type_id) where status = 'available';

create table rate_plans (
  id uuid primary key default gen_random_uuid(),
  room_type_id uuid not null references room_types(id) on delete restrict,
  name text not null,
  start_date date not null,
  end_date date not null,
  nightly_rate_minor bigint not null check (nightly_rate_minor >= 0),
  min_stay_nights integer not null default 1 check (min_stay_nights > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rate_plans_valid_dates check (end_date >= start_date)
);
create index rate_plans_room_type_dates_idx on rate_plans (room_type_id, start_date, end_date);

create table guests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  normalized_email text not null check (normalized_email = lower(btrim(normalized_email))),
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index guests_normalized_email_idx on guests (normalized_email);

create table reservations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete restrict,
  guest_id uuid not null references guests(id) on delete restrict,
  check_in date not null,
  check_out date not null,
  guest_count integer not null check (guest_count > 0),
  status reservation_status not null default 'confirmed',
  source reservation_source not null,
  confirmation_code_hash text not null unique,
  total_minor bigint not null check (total_minor >= 0),
  currency text not null default 'PHP' check (currency ~ '^[A-Z]{3}$'),
  cancellation_policy_snapshot jsonb not null,
  consent_version text not null,
  consented_at timestamptz not null,
  cancelled_at timestamptz,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservations_valid_stay check (check_out > check_in),
  constraint reservations_cancelled_timestamp check ((status = 'cancelled') = (cancelled_at is not null)),
  constraint reservations_checked_in_timestamp check (status not in ('checked_in', 'checked_out') or checked_in_at is not null),
  constraint reservations_checked_out_timestamp check ((status = 'checked_out') = (checked_out_at is not null)),
  constraint reservations_no_overlapping_stays exclude using gist (
    room_id with =,
    daterange(check_in, check_out, '[)') with &&
  ) where (status in ('confirmed', 'checked_in'))
);
create index reservations_room_id_idx on reservations (room_id);
create index reservations_guest_id_idx on reservations (guest_id);
create index reservations_status_check_in_idx on reservations (status, check_in);

create table staff_users (
  id uuid primary key default gen_random_uuid(),
  identity_provider_subject text not null unique,
  email text not null unique check (email = lower(btrim(email))),
  role staff_role not null,
  status staff_status not null default 'invited',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table email_outbox (
  id bigint generated always as identity primary key,
  reservation_id uuid not null references reservations(id) on delete restrict,
  event_type text not null,
  payload_version integer not null default 1 check (payload_version > 0),
  payload jsonb not null,
  status outbox_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  last_error_redacted text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index email_outbox_reservation_id_idx on email_outbox (reservation_id);
create index email_outbox_pending_available_idx on email_outbox (available_at) where status in ('pending', 'failed');

create table audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_type text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  request_id text not null,
  redacted_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_entity_created_idx on audit_log (entity_type, entity_id, created_at);

create table idempotency_keys (
  id bigint generated always as identity primary key,
  operation text not null,
  key_hash text not null,
  request_hash text not null,
  response_reference text,
  status idempotency_status not null default 'processing',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (operation, key_hash)
);
create index idempotency_expires_at_idx on idempotency_keys (expires_at);

-- Supabase exposes the public schema through its Data API. The application uses
-- a trusted server-side PostgreSQL connection, so every table is deny-by-default
-- for API roles. Add narrowly scoped policies only if browser-side access is
-- intentionally introduced later.
alter table resort_settings enable row level security;
alter table room_types enable row level security;
alter table amenities enable row level security;
alter table room_type_amenities enable row level security;
alter table rooms enable row level security;
alter table rate_plans enable row level security;
alter table guests enable row level security;
alter table reservations enable row level security;
alter table staff_users enable row level security;
alter table email_outbox enable row level security;
alter table audit_log enable row level security;
alter table idempotency_keys enable row level security;

insert into resort_settings (
  legal_name, display_name, address, timezone, currency, default_language
) values (
  'Casa Marga Inn',
  'Casa Marga Inn',
  'Hontanosas Street, Panglao, Bohol 6340, Philippines',
  'Asia/Manila',
  'PHP',
  'en'
);

comment on table resort_settings is 'Singleton property configuration; boolean primary key enforces one row.';
comment on column room_types.base_nightly_rate_minor is 'Price in integer currency minor units; verify production rates with management.';
comment on column reservations.confirmation_code_hash is 'Hash only; never store or log the guest-facing confirmation code.';
comment on table audit_log is 'Append-only application audit events. The runtime role must not receive UPDATE or DELETE.';
