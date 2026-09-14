import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(new URL("./0001_initial.sql", import.meta.url));
const migration = readFileSync(migrationPath, "utf8");
const provisionalSeedPath = fileURLToPath(new URL("./0002_provisional_catalog.sql", import.meta.url));
const provisionalSeed = readFileSync(provisionalSeedPath, "utf8");
const depositMigrationPath = fileURLToPath(new URL("./0006_snowaz_manual_deposit_workflow.sql", import.meta.url));
const depositMigration = readFileSync(depositMigrationPath, "utf8");
const immediateDepositPath = fileURLToPath(new URL("./0008_immediate_deposit_checkout.sql", import.meta.url));
const immediateDeposit = readFileSync(immediateDepositPath, "utf8");
const adminOperationsPath = fileURLToPath(new URL("./0009_admin_booking_operations.sql", import.meta.url));
const adminOperations = readFileSync(adminOperationsPath, "utf8");
const bookingLookupPath = fileURLToPath(new URL("./0010_public_booking_status_lookup.sql", import.meta.url));
const bookingLookup = readFileSync(bookingLookupPath, "utf8");
const privateLinkLifecyclePath = fileURLToPath(new URL("./0011_private_deposit_link_lifecycle.sql", import.meta.url));
const privateLinkLifecycle = readFileSync(privateLinkLifecyclePath, "utf8");
const messengerVerificationPath = fileURLToPath(new URL("./0012_admin_messenger_deposit_verification.sql", import.meta.url));
const messengerVerification = readFileSync(messengerVerificationPath, "utf8");
const expiryRestrictionPath = fileURLToPath(new URL("./0013_restrict_deposit_expiry_rpc.sql", import.meta.url));
const expiryRestriction = readFileSync(expiryRestrictionPath, "utf8");
const removePublicLookupPath = fileURLToPath(new URL("./0014_remove_public_booking_status_lookup.sql", import.meta.url));
const removePublicLookup = readFileSync(removePublicLookupPath, "utf8");
const lifecycleNotificationsPath = fileURLToPath(new URL("./0015_booking_lifecycle_notifications.sql", import.meta.url));
const lifecycleNotifications = readFileSync(lifecycleNotificationsPath, "utf8");
const pauseEmailNotificationsPath = fileURLToPath(new URL("./0016_pause_email_notifications.sql", import.meta.url));
const pauseEmailNotifications = readFileSync(pauseEmailNotificationsPath, "utf8");

describe("initial database migration", () => {
  it("enforces a single property settings row", () => {
    expect(migration).toContain("id boolean primary key default true check (id)");
  });

  it("uses a half-open range exclusion constraint for active stays", () => {
    expect(migration).toContain("daterange(check_in, check_out, '[)') with &&");
    expect(migration).toContain("where (status in ('confirmed', 'checked_in'))");
  });

  it("indexes foreign keys and operational queues", () => {
    expect(migration).toContain("reservations_room_id_idx");
    expect(migration).toContain("reservations_guest_id_idx");
    expect(migration).toContain("email_outbox_pending_available_idx");
  });

  it("stores prices as integer minor units", () => {
    expect(migration).toContain("base_nightly_rate_minor bigint");
    expect(migration).toContain("total_minor bigint");
  });

  it("enables row-level security on every Data API table", () => {
    const protectedTables = [
      "resort_settings", "room_types", "amenities", "room_type_amenities",
      "rooms", "rate_plans", "guests", "reservations", "staff_users",
      "email_outbox", "audit_log", "idempotency_keys",
    ];

    for (const table of protectedTables) {
      expect(migration).toContain(`alter table ${table} enable row level security;`);
    }
  });
});

describe("SnowAZ manual deposit workflow", () => {
  it("stores tokens as hashes and requires complete payment evidence", () => {
    expect(depositMigration).toContain("deposit_token_hash text");
    expect(depositMigration).toContain("booking_requests_deposit_token_hash_unique");
    expect(depositMigration).toContain("booking_requests_deposit_submission_complete");
  });

  it("keeps verified booking requests blocked on the public calendar", () => {
    expect(depositMigration).toContain("new.status in ('pending', 'contacted', 'confirmed')");
    expect(depositMigration).toContain("new.status = 'confirmed' then 'booked'");
  });
});

describe("SnowAZ immediate deposit checkout", () => {
  it("uses one controlled RPC instead of anonymous table inserts", () => {
    expect(immediateDeposit).toContain("revoke insert on public.booking_requests from anon, authenticated");
    expect(immediateDeposit).toContain("submit_snowaz_booking_request");
  });

  it("expires unpaid holds after two hours", () => {
    expect(immediateDeposit).toContain("now() + interval '2 hours'");
    expect(immediateDeposit).toContain("expire_snowaz_deposit_holds");
  });
});

describe("SnowAZ deposit hold expiry", () => {
  it("runs centrally and cannot be invoked by public clients", () => {
    expect(expiryRestriction).toContain("cron.schedule");
    expect(expiryRestriction).toContain("revoke all on function public.expire_snowaz_deposit_holds() from public, anon, authenticated");
  });
});

describe("SnowAZ admin booking operations", () => {
  it("restricts status changes to managers and admins", () => {
    expect(adminOperations).toContain("private.snowaz_staff_role() not in ('manager', 'admin')");
    expect(adminOperations).toContain("revoke all on function public.staff_update_snowaz_booking_status(uuid,text) from public, anon");
  });

  it("routes verified cancellations into the refund workflow", () => {
    expect(adminOperations).toContain("then 'refund_pending'::public.deposit_status");
    expect(adminOperations).toContain("insert into public.audit_log");
  });
});

describe("SnowAZ public booking status lookup", () => {
  it("requires the booking reference and exact normalized guest phone", () => {
    expect(bookingLookup).toContain("upper(trim(booking_reference))");
    expect(bookingLookup).toContain("regexp_replace(b.phone, '[^0-9]', '', 'g')");
  });

  it("returns operational status without guest or bank identity", () => {
    expect(bookingLookup).toContain("booking_status text");
    expect(bookingLookup).toContain("deposit_status text");
    expect(bookingLookup).not.toContain("full_name");
    expect(bookingLookup).not.toContain("deposit_reference");
  });
});

describe("SnowAZ device-only booking status", () => {
  it("removes the legacy reference and phone lookup from public access", () => {
    expect(removePublicLookup).toContain("revoke all on function public.lookup_snowaz_booking_status(text,text) from public, anon, authenticated");
  });
});

describe("SnowAZ booking lifecycle notifications", () => {
  it("queues email events from booking and deposit changes without duplicates", () => {
    expect(lifecycleNotifications).toContain("booking_received");
    expect(lifecycleNotifications).toContain("deposit_submitted");
    expect(lifecycleNotifications).toContain("booking_confirmed");
    expect(lifecycleNotifications).toContain("on conflict (dedupe_key)");
  });

  it("creates a server-side arrival reminder job", () => {
    expect(lifecycleNotifications).toContain("snowaz-arrival-reminders");
    expect(lifecycleNotifications).toContain("private.queue_snowaz_arrival_reminders()");
    expect(lifecycleNotifications).toContain("revoke all on function private.queue_snowaz_arrival_reminders()");
  });
});

describe("SnowAZ paused email delivery", () => {
  it("stops new automatic email records and cancels the pending queue", () => {
    expect(pauseEmailNotifications).toContain("drop trigger if exists queue_snowaz_booking_lifecycle_notification");
    expect(pauseEmailNotifications).toContain("jobname='snowaz-arrival-reminders'");
    expect(pauseEmailNotifications).toContain("channel='email' and status='queued'");
    expect(pauseEmailNotifications).toContain("status='cancelled'");
    expect(pauseEmailNotifications).toContain("before insert on public.booking_notifications");
  });
});

describe("SnowAZ private deposit link lifecycle", () => {
  it("makes submitted and verified links expire after checkout", () => {
    expect(privateLinkLifecycle).toContain("check_out + 30");
    expect(privateLinkLifecycle).toContain("b.deposit_token_expires_at>now()");
  });

  it("keeps refund links for thirty days and supports refund pending", () => {
    expect(privateLinkLifecycle).toContain("deposit_token_expires_at=now()+interval '30 days'");
    expect(privateLinkLifecycle).toContain("deposit_status in ('verified','refund_pending')");
  });
});

describe("SnowAZ admin Messenger receipt verification", () => {
  it("requires manager access and complete bank evidence", () => {
    expect(messengerVerification).toContain("private.snowaz_staff_role() not in ('manager','admin')");
    expect(messengerVerification).toContain("char_length(trim(payment_reference)) not between 6 and 80");
  });

  it("only confirms an active unexpired payment request", () => {
    expect(messengerVerification).toContain("deposit_status='awaiting_payment'");
    expect(messengerVerification).toContain("deposit_token_expires_at>now()");
    expect(messengerVerification).toContain("booking.deposit_recorded_and_verified");
  });
});

describe("provisional catalogue seed", () => {
  it("keeps the SnowAZ template unpublished", () => {
    expect(provisionalSeed).toContain("'SnowAZ Condo Stay'");
    expect(provisionalSeed).toContain("'draft'");
    expect(provisionalSeed).not.toContain("'published'");
  });

  it("keeps the unapproved physical unit unavailable", () => {
    expect(provisionalSeed).toContain("'SNOWAZ-PENDING'");
    expect(provisionalSeed).toContain("'out_of_service'");
    expect(provisionalSeed).not.toContain("'available'");
  });

  it("does not invent a rate before owner approval", () => {
    expect(provisionalSeed).toContain("null, 0, 10, 'draft'");
  });
});
