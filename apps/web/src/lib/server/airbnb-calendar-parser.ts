import { createHash, timingSafeEqual } from "node:crypto";

const MAX_ICAL_BYTES = 1_000_000;
const MAX_EVENTS = 5_000;

export type AirbnbCalendarEvent = {
  externalUid: string;
  checkIn: string;
  checkOut: string;
};

export function isAirbnbExportTokenValid(candidate: string, expected: string | null) {
  if (!expected || !candidate || candidate.length !== expected.length) return false;
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  return timingSafeEqual(candidateBytes, expectedBytes);
}

function dateFromIcalValue(value: string) {
  const compact = value.trim().slice(0, 8);
  if (!/^\d{8}$/.test(compact)) return null;
  const year = Number(compact.slice(0, 4));
  const month = Number(compact.slice(4, 6));
  const day = Number(compact.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

function addOneDay(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function unescapeIcalValue(value: string) {
  return value.replace(/\\([\\;,])/g, "$1").replace(/\\n/gi, "\n");
}

function fallbackUid(checkIn: string, checkOut: string, summary: string) {
  return `airbnb-${createHash("sha256").update(`${checkIn}|${checkOut}|${summary}`).digest("hex").slice(0, 32)}`;
}

/** Parse the all-day VEVENT form used by Airbnb and most channel calendars. */
export function parseAirbnbCalendar(ical: string): AirbnbCalendarEvent[] {
  if (Buffer.byteLength(ical, "utf8") > MAX_ICAL_BYTES) {
    throw new Error("Airbnb calendar feed is too large.");
  }
  const normalized = ical.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!/^\s*BEGIN:VCALENDAR(?:\n|$)/i.test(normalized)) {
    throw new Error("Airbnb calendar feed is not a valid iCalendar document.");
  }
  const physicalLines = normalized.split("\n");
  const lines: string[] = [];
  for (const line of physicalLines) {
    if (/^[ \t]/.test(line) && lines.length > 0) lines[lines.length - 1] += line.slice(1);
    else lines.push(line);
  }

  const events: AirbnbCalendarEvent[] = [];
  let current: Record<string, string> | null = null;
  for (const line of lines) {
    if (line.toUpperCase() === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line.toUpperCase() === "END:VEVENT") {
      if (current) {
        const checkIn = dateFromIcalValue(current.DTSTART ?? "");
        const checkOut = dateFromIcalValue(current.DTEND ?? "") ?? (checkIn ? addOneDay(checkIn) : null);
        const summary = unescapeIcalValue(current.SUMMARY ?? "Unavailable").slice(0, 120);
        if (checkIn && checkOut && checkOut > checkIn && current.STATUS?.toUpperCase() !== "CANCELLED") {
          const externalUid = unescapeIcalValue(current.UID ?? "").trim()
            || fallbackUid(checkIn, checkOut, summary);
          events.push({
            externalUid: externalUid.slice(0, 500),
            checkIn,
            checkOut,
          });
        }
      }
      current = null;
      if (events.length > MAX_EVENTS) throw new Error("Airbnb calendar feed contains too many events.");
      continue;
    }
    if (!current) continue;
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    const property = line.slice(0, separator).split(";", 1)[0].toUpperCase();
    if (["UID", "DTSTART", "DTEND", "STATUS", "SUMMARY"].includes(property)) {
      current[property] = line.slice(separator + 1);
    }
  }
  return [...new Map(events.map((event) => [event.externalUid, event])).values()];
}
