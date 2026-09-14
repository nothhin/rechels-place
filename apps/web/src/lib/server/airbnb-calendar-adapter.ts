import type { AirbnbCalendarEvent } from "./airbnb-calendar-parser";
import { parseAirbnbCalendar } from "./airbnb-calendar-parser";

const MAX_ICAL_BYTES = 1_000_000;

/** Adapter boundary for channel calendars that expose an iCalendar feed. */
export interface ExternalCalendarAdapter<TEvent> {
  readonly provider: string;
  fetchEvents(url: string): Promise<readonly TEvent[]>;
}

export function createAirbnbCalendarAdapter(
  fetchImplementation: typeof fetch = fetch,
): ExternalCalendarAdapter<AirbnbCalendarEvent> {
  return {
    provider: "airbnb",
    async fetchEvents(url) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetchImplementation(url, {
          cache: "no-store",
          headers: {
            Accept: "text/calendar,text/plain;q=0.9,*/*;q=0.1",
            "User-Agent": "Rechels-Place-Calendar-Sync/1.0",
          },
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Airbnb calendar returned HTTP ${response.status}.`);
        }
        const contentLength = Number(response.headers.get("content-length") ?? "0");
        if (contentLength > MAX_ICAL_BYTES) {
          throw new Error("Airbnb calendar feed is too large.");
        }
        return parseAirbnbCalendar(await response.text());
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export const airbnbCalendarAdapter = createAirbnbCalendarAdapter();
