import { createHash, timingSafeEqual } from "node:crypto";
import ical, { type ParameterValue, type VEvent } from "node-ical";

const MAX_ICAL_BYTES = 1_000_000;
const MAX_EVENTS = 5_000;
const MAX_UID_LENGTH = 500;
const MAX_SUMMARY_LENGTH = 240;
const MAX_DESCRIPTION_LENGTH = 2_000;

export type AirbnbCalendarSourceStatus = "TENTATIVE" | "CONFIRMED" | "UNKNOWN";

export type AirbnbCalendarEvent = {
  externalUid: string;
  checkIn: string;
  checkOut: string;
  summary?: string;
  description?: string;
  sourceStatus?: AirbnbCalendarSourceStatus;
};

export function isAirbnbExportTokenValid(candidate: string, expected: string | null) {
  if (!expected || !candidate || candidate.length !== expected.length) return false;
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  return timingSafeEqual(candidateBytes, expectedBytes);
}

function parameterValue(value: ParameterValue | undefined) {
  if (typeof value === "string") return value;
  return value?.val;
}

function cleanText(value: string | undefined, maximum: number) {
  const cleaned = value?.replaceAll("\0", "").trim().slice(0, maximum);
  return cleaned || undefined;
}

function localDateValue(value: Date) {
  const year = value.getFullYear();
  const month = value.getMonth() + 1;
  const day = value.getDate();
  if (!Number.isInteger(year) || year < 1900 || year > 2200) return null;
  const candidate = new Date(year, month - 1, day);
  if (
    candidate.getFullYear() !== year
    || candidate.getMonth() !== month - 1
    || candidate.getDate() !== day
  ) return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function zonedDateValue(value: Date & { tz?: string; dateOnly?: true }) {
  if (value.dateOnly) return localDateValue(value);
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone: value.tz ?? "UTC",
      year: "numeric",
    }).formatToParts(value);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    if (!values.year || !values.month || !values.day) return null;
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return null;
  }
}

function addOneDay(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function fallbackUid(checkIn: string, checkOut: string, summary: string, description: string) {
  return `airbnb-${createHash("sha256").update(`${checkIn}|${checkOut}|${summary}|${description}`).digest("hex").slice(0, 32)}`;
}

function sourceStatus(value: string | undefined): AirbnbCalendarSourceStatus {
  const normalized = value?.toUpperCase();
  if (normalized === "TENTATIVE" || normalized === "CONFIRMED") return normalized;
  return "UNKNOWN";
}

function toEvent(event: VEvent): AirbnbCalendarEvent | null {
  const checkIn = event.start ? zonedDateValue(event.start) : null;
  const checkOut = event.end ? zonedDateValue(event.end) : (checkIn ? addOneDay(checkIn) : null);
  const summary = cleanText(parameterValue(event.summary), MAX_SUMMARY_LENGTH) ?? "Unavailable";
  const description = cleanText(parameterValue(event.description), MAX_DESCRIPTION_LENGTH) ?? "";
  const status = event.status?.toUpperCase();
  if (!checkIn || !checkOut || checkOut <= checkIn || status === "CANCELLED") return null;

  const externalUid = cleanText(event.uid, MAX_UID_LENGTH)
    ?? fallbackUid(checkIn, checkOut, summary, description);
  return {
    externalUid,
    checkIn,
    checkOut,
    summary,
    ...(description ? { description } : {}),
    sourceStatus: sourceStatus(event.status),
  };
}

/** Parse an RFC 5545 iCalendar feed using node-ical's standards-aware parser. */
export function parseAirbnbCalendar(icalText: string): AirbnbCalendarEvent[] {
  if (Buffer.byteLength(icalText, "utf8") > MAX_ICAL_BYTES) {
    throw new Error("Airbnb calendar feed is too large.");
  }

  let calendar: ReturnType<typeof ical.parseICS>;
  try {
    calendar = ical.parseICS(icalText);
  } catch {
    throw new Error("Airbnb calendar feed is not a valid iCalendar document.");
  }
  if (calendar.vcalendar?.type !== "VCALENDAR") {
    throw new Error("Airbnb calendar feed is not a valid iCalendar document.");
  }

  const events: AirbnbCalendarEvent[] = [];
  for (const component of Object.values(calendar)) {
    if (!component || component.type !== "VEVENT") continue;
    if (events.length >= MAX_EVENTS) throw new Error("Airbnb calendar feed contains too many events.");
    let event: AirbnbCalendarEvent | null = null;
    try {
      event = toEvent(component as VEvent);
    } catch {
      // A malformed VEVENT must not discard otherwise valid reservations in
      // the same feed. The next successful sync can reconcile the skipped row.
      continue;
    }
    if (event) events.push(event);
  }

  return [...new Map(events.map((event) => [event.externalUid, event])).values()];
}
