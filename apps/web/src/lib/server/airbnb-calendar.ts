import "server-only";

import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeAirbnbIcalUrl } from "./airbnb-calendar-url";
import { airbnbCalendarAdapter } from "./airbnb-calendar-adapter";
import { serializeAirbnbCalendarEvents } from "./airbnb-calendar-payload";
export { isAirbnbExportTokenValid, parseAirbnbCalendar } from "./airbnb-calendar-parser";

const SYNC_STALE_AFTER_MS = 15 * 60 * 1_000;
const SYNC_LOCK_MS = 10 * 60 * 1_000;

export type AirbnbSyncTrigger = "manual" | "cron" | "background";

export type AirbnbSyncRun = {
  id: string;
  triggerSource: AirbnbSyncTrigger;
  importSource: "admin" | "vercel" | "unknown";
  status: "running" | "succeeded" | "failed";
  startedAt: string;
  finishedAt: string | null;
  eventsSeen: number;
  conflictsSeen: number;
  activeEvents: number;
  errorMessage: string | null;
};

export type AirbnbSyncResult = {
  eventsSeen: number;
  conflictsSeen: number;
  activeEvents: number;
  syncedAt: string;
};

export type AirbnbSyncStatus = {
  provider: "airbnb";
  status: "never" | "running" | "succeeded" | "failed";
  lastStartedAt: string | null;
  lastSucceededAt: string | null;
  lastFailedAt: string | null;
  lastError: string | null;
  eventsSeen: number;
  conflictsSeen: number;
  updatedAt: string | null;
  syncLockUntil: string | null;
  activeEvents: number;
  websiteBookings: number;
  recentRuns: AirbnbSyncRun[];
};

type CalendarConfiguration = {
  importUrl: string | null;
  exportToken: string | null;
  serviceRoleKey: string | null;
};

type DateRange = { check_in: string; check_out: string };

function readHttpsUrl(value: string | undefined) {
  const candidate = value?.trim();
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function getAirbnbCalendarConfiguration(): CalendarConfiguration {
  const exportToken = process.env.AIRBNB_CALENDAR_TOKEN?.trim()
    || process.env.ICAL_EXPORT_TOKEN?.trim()
    || null;
  return {
    importUrl: readHttpsUrl(process.env.AIRBNB_ICAL_URL),
    exportToken: exportToken && exportToken.length >= 32 ? exportToken : null,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
      || process.env.SUPABASE_SECRET_KEY?.trim()
      || null,
  };
}

function createSupabaseAdminClient() {
  const configuration = getAirbnbCalendarConfiguration();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !configuration.serviceRoleKey) return null;
  return createClient(url, configuration.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function baseUrlFromEnvironment() {
  const configured = readHttpsUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (configured) return configured;
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (productionHost) return readHttpsUrl(`https://${productionHost}`);
  const deploymentHost = process.env.VERCEL_URL?.trim();
  return deploymentHost ? readHttpsUrl(`https://${deploymentHost}`) : null;
}

export function getAirbnbCalendarExportPath() {
  const token = getAirbnbCalendarConfiguration().exportToken;
  return token ? `/api/calendar/airbnb/${encodeURIComponent(token)}.ics` : null;
}

/** The bearer URL is generated only for the authenticated admin workspace. */
export function getAirbnbCalendarExportUrl(origin?: string) {
  const path = getAirbnbCalendarExportPath();
  if (!path) return null;
  const candidate = origin?.trim() || baseUrlFromEnvironment();
  if (!candidate) return path;
  try {
    const base = new URL(candidate);
    if (!['http:', 'https:'].includes(base.protocol)) return path;
    return new URL(path, base).toString();
  } catch {
    return path;
  }
}

export async function getAirbnbImportSource() {
  const fallback = getAirbnbCalendarConfiguration().importUrl;
  const admin = createSupabaseAdminClient();
  if (!admin) return { importUrl: fallback, source: fallback ? "vercel" as const : "none" as const };
  const { data, error } = await admin.from("external_calendar_settings")
    .select("import_url")
    .eq("provider", "airbnb")
    .maybeSingle();
  // Never silently import a different Vercel feed during a settings outage.
  // Doing so could cancel dates from the admin-configured Airbnb calendar.
  if (error) throw new Error("Airbnb calendar settings could not be read.");
  const override = data?.import_url ? normalizeAirbnbIcalUrl(data.import_url) : null;
  if (data?.import_url && !override) throw new Error("Saved Airbnb calendar link is invalid.");
  return override
    ? { importUrl: override, source: "admin" as const }
    : { importUrl: fallback, source: fallback ? "vercel" as const : "none" as const };
}

export async function saveAirbnbImportUrl(value: string) {
  const importUrl = normalizeAirbnbIcalUrl(value);
  if (!importUrl) throw new Error("Paste the full Airbnb export link ending in .ics, including its private t parameter.");
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Calendar settings are unavailable.");
  const { error } = await admin.from("external_calendar_settings")
    .upsert({ provider: "airbnb", import_url: importUrl, updated_at: new Date().toISOString() }, { onConflict: "provider" });
  if (error) throw new Error("Could not save the Airbnb calendar link.");
}

export async function clearAirbnbImportUrl() {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Calendar settings are unavailable.");
  const { error } = await admin.from("external_calendar_settings").delete().eq("provider", "airbnb");
  if (error) throw new Error("Could not restore the Vercel calendar link.");
}

function formatIcalDate(value: string) {
  return value.replaceAll("-", "");
}

function escapeIcalText(value: string) {
  return value.replace(/[\\;,\n]/g, (character) => `\\${character}`);
}

async function loadWebsiteCalendarRanges() {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase server credentials are not configured.");
  const calendarClient = admin;

  async function readRanges() {
    return Promise.all([
      calendarClient.from("booking_requests")
        .select("id,check_in,check_out,status")
        .in("status", ["pending", "contacted", "confirmed"]),
      calendarClient.from("property_date_blocks")
        .select("id,check_in,check_out,status")
        .eq("status", "active"),
      calendarClient.from("snowaz_calendar_ranges")
        .select("source_kind,source_id,check_in,check_out,display_status")
        .eq("source_kind", "reservation")
        .eq("display_status", "booked"),
    ]);
  }
  let [bookings, blocks, reservations] = await readRanges();
  if (bookings.error || blocks.error || reservations.error) {
    // The calendar is polled by Airbnb; a brief Data API interruption should
    // not make a valid subscription look like an invalid feed.
    await new Promise((resolve) => setTimeout(resolve, 300));
    [bookings, blocks, reservations] = await readRanges();
  }
  const firstError = bookings.error || blocks.error || reservations.error;
  if (firstError) throw new Error("Website calendar data could not be read.");

  const ranges: Array<{ uid: string; checkIn: string; checkOut: string }> = [];
  for (const booking of bookings.data ?? []) {
    if (booking.check_in && booking.check_out) ranges.push({ uid: `website-booking-${booking.id}`, checkIn: booking.check_in, checkOut: booking.check_out });
  }
  for (const block of blocks.data ?? []) {
    if (block.check_in && block.check_out) ranges.push({ uid: `website-block-${block.id}`, checkIn: block.check_in, checkOut: block.check_out });
  }
  for (const reservation of reservations.data ?? []) {
    if (reservation.check_in && reservation.check_out) ranges.push({ uid: `website-reservation-${reservation.source_id}`, checkIn: reservation.check_in, checkOut: reservation.check_out });
  }
  return ranges;
}

export async function buildWebsiteIcalFeed() {
  const configuration = getAirbnbCalendarConfiguration();
  if (!configuration.exportToken) throw new Error("Airbnb calendar export is not configured.");
  const today = new Date().toISOString().slice(0, 10);
  const ranges = (await loadWebsiteCalendarRanges()).filter((range) => range.checkOut > today);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rechel's Place//Availability//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const range of ranges) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeIcalText(range.uid)}@rechels-place`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${formatIcalDate(range.checkIn)}`,
      `DTEND;VALUE=DATE:${formatIcalDate(range.checkOut)}`,
      "SUMMARY:Unavailable",
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

function emptySyncStatus(): AirbnbSyncStatus {
  return {
    provider: "airbnb",
    status: "never",
    lastStartedAt: null,
    lastSucceededAt: null,
    lastFailedAt: null,
    lastError: null,
    eventsSeen: 0,
    conflictsSeen: 0,
    updatedAt: null,
    syncLockUntil: null,
    activeEvents: 0,
    websiteBookings: 0,
    recentRuns: [],
  };
}

function normalizeRun(value: Record<string, unknown>): AirbnbSyncRun {
  return {
    id: String(value.id ?? ""),
    triggerSource: value.trigger_source as AirbnbSyncTrigger,
    importSource: value.import_source as AirbnbSyncRun["importSource"],
    status: value.status as AirbnbSyncRun["status"],
    startedAt: String(value.started_at ?? ""),
    finishedAt: typeof value.finished_at === "string" ? value.finished_at : null,
    eventsSeen: Number(value.events_seen ?? 0),
    conflictsSeen: Number(value.conflicts_seen ?? 0),
    activeEvents: Number(value.active_events ?? 0),
    errorMessage: typeof value.error_message === "string" ? value.error_message : null,
  };
}

async function updateSyncState(admin: SupabaseClient, values: Record<string, unknown>, lockId?: string) {
  let query = admin.from("external_calendar_sync_state").update(values).eq("provider", "airbnb");
  if (lockId) query = query.eq("sync_lock_id", lockId);
  const { error } = await query;
  if (error) throw new Error("Airbnb sync status could not be saved.");
}

async function updateSyncRun(admin: SupabaseClient, id: string, values: Record<string, unknown>) {
  const { error } = await admin.from("external_calendar_sync_runs").update(values).eq("id", id);
  if (error) throw new Error("Airbnb sync history could not be saved.");
}

async function releaseSyncLock(admin: SupabaseClient, lockId: string) {
  const { error } = await admin.rpc("release_snowaz_airbnb_sync_lock", { p_lock_id: lockId });
  if (error) console.error("[airbnb-calendar] release lock failed", { code: error.code });
}

function hasOverlap(left: DateRange, right: DateRange) {
  return left.check_in < right.check_out && left.check_out > right.check_in;
}

export async function syncAirbnbCalendar(options: { trigger?: AirbnbSyncTrigger } = {}): Promise<AirbnbSyncResult> {
  const { importUrl, source } = await getAirbnbImportSource();
  if (!importUrl) throw new Error("Airbnb calendar import is not configured.");
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase server credentials are not configured.");

  const trigger = options.trigger ?? "manual";
  const startedAt = new Date().toISOString();
  const lockId = randomUUID();
  const lockUntil = new Date(Date.now() + SYNC_LOCK_MS).toISOString();
  const { data: acquired, error: lockError } = await admin.rpc("acquire_snowaz_airbnb_sync_lock", {
    p_lock_id: lockId,
    p_lock_until: lockUntil,
  });
  if (lockError) throw new Error("Airbnb sync locking is unavailable. Apply the calendar sync migration first.");
  if (acquired !== true) throw new Error("Airbnb calendar sync is already running. Try again shortly.");

  let runId: string | null = null;
  try {
    const { data: run, error: runError } = await admin.from("external_calendar_sync_runs")
      .insert({ provider: "airbnb", trigger_source: trigger, import_source: source, status: "running", started_at: startedAt })
      .select("id")
      .single();
    if (runError || !run?.id) throw new Error("Airbnb sync history is unavailable. Apply the calendar sync migration first.");
    runId = String(run.id);
    await updateSyncState(admin, { status: "running", last_started_at: startedAt, last_error: null, updated_at: startedAt }, lockId);

    const events = await airbnbCalendarAdapter.fetchEvents(importUrl);
    // Read website ranges before changing imported rows. A temporary website
    // data failure therefore preserves both the old rows and availability.
    const ranges = await loadWebsiteCalendarRanges();
    const conflictsSeen = events.filter((event) => ranges.some((range) => hasOverlap(
      { check_in: event.checkIn, check_out: event.checkOut },
      { check_in: range.checkIn, check_out: range.checkOut },
    ))).length;
    const { data: activeEventsData, error: replaceError } = await admin.rpc("replace_snowaz_airbnb_events", {
      // The SQL RPC consumes snake_case jsonb keys. Do not pass the parser's
      // camelCase objects directly: jsonb_to_recordset would silently filter
      // every row as null and report a successful zero-event replacement.
      p_events: serializeAirbnbCalendarEvents(events),
      p_seen_at: startedAt,
    });
    if (replaceError) throw new Error("Airbnb calendar events could not be saved. Apply the calendar sync migration first.");

    const activeEvents = Number(activeEventsData ?? 0);
    const syncedAt = new Date().toISOString();
    await updateSyncState(admin, {
      status: "succeeded",
      last_succeeded_at: syncedAt,
      last_error: null,
      events_seen: events.length,
      conflicts_seen: conflictsSeen,
      updated_at: syncedAt,
    }, lockId);
    await updateSyncRun(admin, runId, {
      status: "succeeded",
      finished_at: syncedAt,
      events_seen: events.length,
      conflicts_seen: conflictsSeen,
      active_events: activeEvents,
      error_message: null,
    });
    await releaseSyncLock(admin, lockId);
    return { eventsSeen: events.length, conflictsSeen, activeEvents, syncedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Airbnb calendar sync failed.";
    const failedAt = new Date().toISOString();
    if (runId) {
      try {
        await updateSyncRun(admin, runId, { status: "failed", finished_at: failedAt, error_message: message.slice(0, 240) });
      } catch (historyError) {
        console.error("[airbnb-calendar] failed to record sync history", historyError instanceof Error ? historyError.message : "unknown error");
      }
    }
    try {
      await updateSyncState(admin, { status: "failed", last_failed_at: failedAt, last_error: message.slice(0, 240), updated_at: failedAt }, lockId);
    } catch (stateError) {
      console.error("[airbnb-calendar] failed to record sync status", stateError instanceof Error ? stateError.message : "unknown error");
    }
    await releaseSyncLock(admin, lockId);
    throw new Error(message);
  }
}

export async function getAirbnbSyncStatus(): Promise<AirbnbSyncStatus> {
  const admin = createSupabaseAdminClient();
  if (!admin) return emptySyncStatus();
  const { data, error } = await admin.from("external_calendar_sync_state").select("*").eq("provider", "airbnb").maybeSingle();
  if (error || !data) return emptySyncStatus();
  const [{ count }, { count: websiteBookings }, { data: runs }] = await Promise.all([
    admin.from("external_calendar_events").select("external_uid", { count: "exact", head: true }).eq("provider", "airbnb").eq("status", "active"),
    admin.from("booking_requests").select("id", { count: "exact", head: true }).in("status", ["pending", "contacted", "confirmed"]).gt("check_out", new Date().toISOString().slice(0, 10)),
    admin.from("external_calendar_sync_runs").select("*").eq("provider", "airbnb").order("started_at", { ascending: false }).limit(8),
  ]);
  const status = emptySyncStatus();
  return {
    ...status,
    provider: "airbnb",
    status: data.status,
    lastStartedAt: data.last_started_at,
    lastSucceededAt: data.last_succeeded_at,
    lastFailedAt: data.last_failed_at,
    lastError: data.last_error,
    eventsSeen: Number(data.events_seen ?? 0),
    conflictsSeen: Number(data.conflicts_seen ?? 0),
    updatedAt: data.updated_at,
    syncLockUntil: data.sync_lock_until,
    activeEvents: count ?? 0,
    websiteBookings: websiteBookings ?? 0,
    recentRuns: (runs ?? []).map((run) => normalizeRun(run as Record<string, unknown>)),
  };
}

export async function syncAirbnbCalendarIfStale() {
  const { importUrl } = await getAirbnbImportSource();
  if (!importUrl || !getAirbnbCalendarConfiguration().serviceRoleKey) return;
  const status = await getAirbnbSyncStatus();
  const lockUntil = status.syncLockUntil ? Date.parse(status.syncLockUntil) : 0;
  const lastSync = status.lastSucceededAt ? Date.parse(status.lastSucceededAt) : 0;
  if ((status.status === "running" && lockUntil > Date.now()) || (lastSync > 0 && Date.now() - lastSync < SYNC_STALE_AFTER_MS)) return;
  await syncAirbnbCalendar({ trigger: "background" });
}

export async function isAirbnbCalendarConfigured() {
  const configuration = getAirbnbCalendarConfiguration();
  const { importUrl, source } = await getAirbnbImportSource();
  return {
    importConfigured: Boolean(importUrl && configuration.serviceRoleKey),
    exportConfigured: Boolean(configuration.exportToken && configuration.serviceRoleKey),
    importSource: source,
  };
}
