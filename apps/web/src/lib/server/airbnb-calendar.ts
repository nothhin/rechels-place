import "server-only";

import { createClient } from "@supabase/supabase-js";
import {
  parseAirbnbCalendar,
} from "./airbnb-calendar-parser";
import { normalizeAirbnbIcalUrl } from "./airbnb-calendar-url";
export { isAirbnbExportTokenValid, parseAirbnbCalendar } from "./airbnb-calendar-parser";

const MAX_ICAL_BYTES = 1_000_000;
const SYNC_STALE_AFTER_MS = 15 * 60 * 1_000;

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
  activeEvents: number;
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
  const exportToken = process.env.AIRBNB_CALENDAR_TOKEN?.trim() || null;
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

async function fetchAirbnbCalendar(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "text/calendar,text/plain;q=0.9,*/*;q=0.1", "User-Agent": "Rechels-Place-Calendar-Sync/1.0" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Airbnb calendar returned HTTP ${response.status}.`);
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (contentLength > MAX_ICAL_BYTES) throw new Error("Airbnb calendar feed is too large.");
    const body = await response.text();
    return parseAirbnbCalendar(body);
  } finally {
    clearTimeout(timeout);
  }
}

async function updateSyncState(values: Record<string, unknown>) {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin.from("external_calendar_sync_state").upsert({ provider: "airbnb", ...values }, { onConflict: "provider" });
}

function hasOverlap(left: DateRange, right: DateRange) {
  return left.check_in < right.check_out && left.check_out > right.check_in;
}

export async function syncAirbnbCalendar(): Promise<AirbnbSyncResult> {
  const { importUrl } = await getAirbnbImportSource();
  if (!importUrl) throw new Error("Airbnb calendar import is not configured.");
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase server credentials are not configured.");
  const startedAt = new Date().toISOString();
  await updateSyncState({ status: "running", last_started_at: startedAt, last_error: null, updated_at: startedAt });

  try {
    const events = await fetchAirbnbCalendar(importUrl);
    // An empty response can be transient. Never clear known Airbnb holds from
    // a feed that contains no events; that could expose reserved dates.
    if (events.length === 0) {
      throw new Error("Airbnb calendar returned no events; existing blocked dates were preserved.");
    }
    const rows = events.map((event) => ({
      provider: "airbnb",
      external_uid: event.externalUid,
      check_in: event.checkIn,
      check_out: event.checkOut,
      status: "active",
      last_seen_at: startedAt,
      updated_at: startedAt,
    }));
    if (rows.length) {
      const { error } = await admin.from("external_calendar_events").upsert(rows, { onConflict: "provider,external_uid" });
      if (error) throw new Error("Airbnb calendar events could not be saved.");
    }
    const { error: staleError } = await admin.from("external_calendar_events")
      .update({ status: "cancelled", updated_at: startedAt })
      .eq("provider", "airbnb")
      .eq("status", "active")
      .lt("last_seen_at", startedAt);
    if (staleError) throw new Error("Stale Airbnb calendar events could not be cleared.");

    const ranges = await loadWebsiteCalendarRanges();
    const bookingRanges = ranges.filter((range) => range.uid.startsWith("website-booking-") || range.uid.startsWith("website-reservation-"));
    const conflictsSeen = events.filter((event) => bookingRanges.some((range) => hasOverlap(
      { check_in: event.checkIn, check_out: event.checkOut },
      { check_in: range.checkIn, check_out: range.checkOut },
    ))).length;
    const syncedAt = new Date().toISOString();
    const { count: activeEvents } = await admin.from("external_calendar_events")
      .select("external_uid", { count: "exact", head: true })
      .eq("provider", "airbnb")
      .eq("status", "active");
    await updateSyncState({
      status: "succeeded",
      last_succeeded_at: syncedAt,
      last_error: null,
      events_seen: events.length,
      conflicts_seen: conflictsSeen,
      updated_at: syncedAt,
    });
    return { eventsSeen: events.length, conflictsSeen, activeEvents: activeEvents ?? events.length, syncedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Airbnb calendar sync failed.";
    const failedAt = new Date().toISOString();
    await updateSyncState({ status: "failed", last_failed_at: failedAt, last_error: message.slice(0, 240), updated_at: failedAt });
    throw new Error(message);
  }
}

export async function getAirbnbSyncStatus(): Promise<AirbnbSyncStatus> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { provider: "airbnb", status: "never", lastStartedAt: null, lastSucceededAt: null, lastFailedAt: null, lastError: null, eventsSeen: 0, conflictsSeen: 0, updatedAt: null, activeEvents: 0 };
  }
  const { data, error } = await admin.from("external_calendar_sync_state").select("*").eq("provider", "airbnb").maybeSingle();
  if (error || !data) {
    return { provider: "airbnb", status: "never", lastStartedAt: null, lastSucceededAt: null, lastFailedAt: null, lastError: null, eventsSeen: 0, conflictsSeen: 0, updatedAt: null, activeEvents: 0 };
  }
  const { count } = await admin.from("external_calendar_events").select("external_uid", { count: "exact", head: true }).eq("provider", "airbnb").eq("status", "active");
  return {
    provider: "airbnb",
    status: data.status,
    lastStartedAt: data.last_started_at,
    lastSucceededAt: data.last_succeeded_at,
    lastFailedAt: data.last_failed_at,
    lastError: data.last_error,
    eventsSeen: data.events_seen,
    conflictsSeen: data.conflicts_seen,
    updatedAt: data.updated_at,
    activeEvents: count ?? 0,
  };
}

export async function syncAirbnbCalendarIfStale() {
  const { importUrl } = await getAirbnbImportSource();
  if (!importUrl || !getAirbnbCalendarConfiguration().serviceRoleKey) return;
  const status = await getAirbnbSyncStatus();
  const lastSync = status.lastSucceededAt ? Date.parse(status.lastSucceededAt) : 0;
  if (status.status === "running" || (lastSync > 0 && Date.now() - lastSync < SYNC_STALE_AFTER_MS)) return;
  await syncAirbnbCalendar();
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
