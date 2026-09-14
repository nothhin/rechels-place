import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const publicationStatus = pgEnum("publication_status", ["draft", "published", "archived"]);
export const roomStatus = pgEnum("room_status", ["available", "maintenance", "out_of_service"]);
export const reservationStatus = pgEnum("reservation_status", ["confirmed", "checked_in", "checked_out", "cancelled"]);
export const reservationSource = pgEnum("reservation_source", ["guest_web", "phone", "walk_in", "staff"]);
export const staffRole = pgEnum("staff_role", ["front_desk", "manager", "admin"]);
export const staffStatus = pgEnum("staff_status", ["invited", "active", "suspended", "disabled"]);
export const outboxStatus = pgEnum("outbox_status", ["pending", "processing", "delivered", "failed", "dead_letter"]);
export const idempotencyStatus = pgEnum("idempotency_status", ["processing", "completed", "failed"]);
export const bookingRequestStatus = pgEnum("booking_request_status", ["pending", "contacted", "confirmed", "declined", "cancelled"]);
export const depositStatus = pgEnum("deposit_status", ["not_requested", "awaiting_payment", "submitted", "verified", "refund_pending", "refunded", "partially_withheld", "forfeited"]);

export const resortSettings = pgTable("resort_settings", {
  id: boolean("id").primaryKey().default(true),
  legalName: text("legal_name").notNull(),
  displayName: text("display_name").notNull(),
  address: text("address").notNull(),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  timezone: text("timezone").notNull().default("Asia/Manila"),
  currency: text("currency").notNull().default("PHP"),
  defaultLanguage: text("default_language").notNull().default("en"),
  cancellationDays: integer("cancellation_days").notNull().default(0),
  checkInTime: text("check_in_time").notNull().default("14:00"),
  checkOutTime: text("check_out_time").notNull().default("12:00"),
  taxConfiguration: jsonb("tax_configuration").notNull().default({}),
  termsVersion: text("terms_version").notNull().default("draft"),
  privacyVersion: text("privacy_version").notNull().default("draft"),
  ...timestamps,
});

export const roomTypes = pgTable("room_types", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  shortDescription: text("short_description"),
  description: text("description"),
  maxAdults: integer("max_adults").notNull(),
  maxChildren: integer("max_children").notNull().default(0),
  bedConfiguration: jsonb("bed_configuration").notNull().default([]),
  roomSizeSqm: integer("room_size_sqm"),
  accessibilityFeatures: jsonb("accessibility_features").notNull().default([]),
  baseNightlyRateMinor: bigint("base_nightly_rate_minor", { mode: "number" }).notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  status: publicationStatus("status").notNull().default("draft"),
  ...timestamps,
}, (table) => [
  uniqueIndex("room_types_slug_unique").on(table.slug),
  index("room_types_published_order_idx").on(table.displayOrder).where(sql`${table.status} = 'published'`),
]);

export const amenities = pgTable("amenities", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull(),
  label: text("label").notNull(),
  category: text("category").notNull(),
  iconKey: text("icon_key"),
  active: boolean("active").notNull().default(true),
}, (table) => [uniqueIndex("amenities_key_unique").on(table.key)]);

export const roomTypeAmenities = pgTable("room_type_amenities", {
  roomTypeId: uuid("room_type_id").notNull().references(() => roomTypes.id, { onDelete: "restrict" }),
  amenityId: uuid("amenity_id").notNull().references(() => amenities.id, { onDelete: "restrict" }),
}, (table) => [
  primaryKey({ columns: [table.roomTypeId, table.amenityId] }),
  index("room_type_amenities_amenity_id_idx").on(table.amenityId),
]);

export const rooms = pgTable("rooms", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomTypeId: uuid("room_type_id").notNull().references(() => roomTypes.id, { onDelete: "restrict" }),
  roomNumber: text("room_number").notNull(),
  floor: text("floor"),
  status: roomStatus("status").notNull().default("available"),
  version: integer("version").notNull().default(1),
  ...timestamps,
}, (table) => [
  uniqueIndex("rooms_room_number_unique").on(table.roomNumber),
  index("rooms_room_type_id_idx").on(table.roomTypeId),
  index("rooms_available_type_idx").on(table.roomTypeId).where(sql`${table.status} = 'available'`),
]);

export const ratePlans = pgTable("rate_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomTypeId: uuid("room_type_id").notNull().references(() => roomTypes.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  nightlyRateMinor: bigint("nightly_rate_minor", { mode: "number" }).notNull(),
  minStayNights: integer("min_stay_nights").notNull().default(1),
  active: boolean("active").notNull().default(true),
  ...timestamps,
}, (table) => [index("rate_plans_room_type_dates_idx").on(table.roomTypeId, table.startDate, table.endDate)]);

export const guests = pgTable("guests", {
  id: uuid("id").defaultRandom().primaryKey(),
  fullName: text("full_name").notNull(),
  normalizedEmail: text("normalized_email").notNull(),
  phone: text("phone"),
  ...timestamps,
}, (table) => [index("guests_normalized_email_idx").on(table.normalizedEmail)]);

export const bookingRequests = pgTable("booking_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  idempotencyKey: uuid("idempotency_key").notNull(),
  roomTypeId: uuid("room_type_id").references(() => roomTypes.id, { onDelete: "set null" }),
  fullName: text("full_name").notNull(),
  normalizedEmail: text("normalized_email").notNull(),
  phone: text("phone").notNull(),
  preferredContact: text("preferred_contact").notNull().default("whatsapp"),
  checkIn: date("check_in").notNull(),
  checkOut: date("check_out").notNull(),
  guestCount: integer("guest_count").notNull(),
  bedroomChoice: text("bedroom_choice").notNull(),
  stayNights: integer("stay_nights").notNull(),
  baseNightlyRateMinor: bigint("base_nightly_rate_minor", { mode: "number" }).notNull(),
  additionalGuestCount: integer("additional_guest_count").notNull(),
  additionalGuestChargeMinor: bigint("additional_guest_charge_minor", { mode: "number" }).notNull(),
  totalMinor: bigint("total_minor", { mode: "number" }).notNull(),
  specialRequests: text("special_requests"),
  status: bookingRequestStatus("status").notNull().default("pending"),
  source: text("source").notNull().default("guest_web"),
  consentVersion: text("consent_version").notNull(),
  consentedAt: timestamp("consented_at", { withTimezone: true }).defaultNow().notNull(),
  depositStatus: depositStatus("deposit_status").notNull().default("not_requested"),
  depositAmountMinor: bigint("deposit_amount_minor", { mode: "number" }).notNull().default(100000),
  depositTokenHash: text("deposit_token_hash"),
  depositTokenExpiresAt: timestamp("deposit_token_expires_at", { withTimezone: true }),
  depositSenderName: text("deposit_sender_name"),
  depositReference: text("deposit_reference"),
  depositSubmittedAt: timestamp("deposit_submitted_at", { withTimezone: true }),
  depositVerifiedAt: timestamp("deposit_verified_at", { withTimezone: true }),
  depositRefundReference: text("deposit_refund_reference"),
  depositRefundedAt: timestamp("deposit_refunded_at", { withTimezone: true }),
  balancePaidMinor: bigint("balance_paid_minor", { mode: "number" }).notNull().default(0),
  balancePaymentMethod: text("balance_payment_method"),
  balancePaymentReference: text("balance_payment_reference"),
  balancePaidAt: timestamp("balance_paid_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("booking_requests_idempotency_key_unique").on(table.idempotencyKey),
  index("booking_requests_status_created_idx").on(table.status, table.createdAt),
  index("booking_requests_check_in_idx").on(table.checkIn),
  uniqueIndex("booking_requests_deposit_token_hash_unique").on(table.depositTokenHash),
]);

export const reservations = pgTable("reservations", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id").notNull().references(() => rooms.id, { onDelete: "restrict" }),
  guestId: uuid("guest_id").notNull().references(() => guests.id, { onDelete: "restrict" }),
  checkIn: date("check_in").notNull(),
  checkOut: date("check_out").notNull(),
  guestCount: integer("guest_count").notNull(),
  status: reservationStatus("status").notNull().default("confirmed"),
  source: reservationSource("source").notNull(),
  confirmationCodeHash: text("confirmation_code_hash").notNull(),
  totalMinor: bigint("total_minor", { mode: "number" }).notNull(),
  currency: text("currency").notNull().default("PHP"),
  cancellationPolicySnapshot: jsonb("cancellation_policy_snapshot").notNull(),
  consentVersion: text("consent_version").notNull(),
  consentedAt: timestamp("consented_at", { withTimezone: true }).notNull(),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
  checkedOutAt: timestamp("checked_out_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
  ...timestamps,
}, (table) => [
  uniqueIndex("reservations_confirmation_hash_unique").on(table.confirmationCodeHash),
  index("reservations_room_id_idx").on(table.roomId),
  index("reservations_guest_id_idx").on(table.guestId),
  index("reservations_status_check_in_idx").on(table.status, table.checkIn),
]);

export const staffUsers = pgTable("staff_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  identityProviderSubject: text("identity_provider_subject").notNull(),
  email: text("email").notNull(),
  role: staffRole("role").notNull(),
  status: staffStatus("status").notNull().default("invited"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("staff_users_identity_subject_unique").on(table.identityProviderSubject),
  uniqueIndex("staff_users_email_unique").on(table.email),
]);

export const emailOutbox = pgTable("email_outbox", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  reservationId: uuid("reservation_id").notNull().references(() => reservations.id, { onDelete: "restrict" }),
  eventType: text("event_type").notNull(),
  payloadVersion: integer("payload_version").notNull().default(1),
  payload: jsonb("payload").notNull(),
  status: outboxStatus("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
  lastErrorRedacted: text("last_error_redacted"),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  index("email_outbox_reservation_id_idx").on(table.reservationId),
  index("email_outbox_pending_available_idx").on(table.availableAt).where(sql`${table.status} in ('pending', 'failed')`),
]);

export const auditLog = pgTable("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  actorId: uuid("actor_id"),
  actorType: text("actor_type").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  requestId: text("request_id").notNull(),
  redactedMetadata: jsonb("redacted_metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("audit_log_entity_created_idx").on(table.entityType, table.entityId, table.createdAt)]);

export const idempotencyKeys = pgTable("idempotency_keys", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  operation: text("operation").notNull(),
  keyHash: text("key_hash").notNull(),
  requestHash: text("request_hash").notNull(),
  responseReference: text("response_reference"),
  status: idempotencyStatus("status").notNull().default("processing"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("idempotency_operation_key_unique").on(table.operation, table.keyHash),
  index("idempotency_expires_at_idx").on(table.expiresAt),
]);
