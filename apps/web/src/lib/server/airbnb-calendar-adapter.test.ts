import { describe, expect, it } from "vitest";
import { createAirbnbCalendarAdapter } from "./airbnb-calendar-adapter";

const calendar = [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT",
  "UID:airbnb-adapter-test",
  "DTSTART;VALUE=DATE:20261010",
  "DTEND;VALUE=DATE:20261012",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("external calendar adapter", () => {
  it("translates the Airbnb feed into provider-neutral events", async () => {
    const adapter = createAirbnbCalendarAdapter(
      async () => new Response(calendar, { headers: { "content-type": "text/calendar" } }),
    );

    expect(adapter.provider).toBe("airbnb");
    await expect(adapter.fetchEvents("https://example.com/calendar.ics")).resolves.toEqual([
      {
        externalUid: "airbnb-adapter-test",
        checkIn: "2026-10-10",
        checkOut: "2026-10-12",
        summary: "Unavailable",
        sourceStatus: "UNKNOWN",
      },
    ]);
  });

  it("keeps upstream failures visible to the sync workflow", async () => {
    const adapter = createAirbnbCalendarAdapter(
      async () => new Response(null, { status: 503 }),
    );

    await expect(adapter.fetchEvents("https://example.com/calendar.ics")).rejects.toThrow(
      "Airbnb calendar returned HTTP 503.",
    );
  });

  it("converts network failures into a safe actionable message", async () => {
    const adapter = createAirbnbCalendarAdapter(
      async () => { throw new TypeError("socket details should not reach the admin"); },
    );

    await expect(adapter.fetchEvents("https://example.com/calendar.ics")).rejects.toThrow(
      "Airbnb calendar could not be reached.",
    );
  });
});
