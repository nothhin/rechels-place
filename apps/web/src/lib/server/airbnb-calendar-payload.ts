import type { AirbnbCalendarEvent } from "./airbnb-calendar-parser";

/** Convert the parser's camelCase model to the snake_case RPC payload. */
export function serializeAirbnbCalendarEvents(events: readonly AirbnbCalendarEvent[]) {
  return events.map((event) => ({
    external_uid: event.externalUid,
    check_in: event.checkIn,
    check_out: event.checkOut,
    summary: event.summary ?? "Unavailable",
    description: event.description ?? null,
    source_status: event.sourceStatus ?? "UNKNOWN",
  }));
}
