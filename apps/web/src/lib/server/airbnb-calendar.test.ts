import { describe, expect, it } from "vitest";
import { isAirbnbExportTokenValid, parseAirbnbCalendar } from "./airbnb-calendar-parser";

describe("Airbnb iCal calendar parser", () => {
  it("parses folded all-day events and keeps checkout exclusive", () => {
    const events = parseAirbnbCalendar([
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:airbnb-123",
      "DTSTART;VALUE=DATE:20261126",
      "DTEND;VALUE=DATE:20261130",
      "SUMMARY:Reserved",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:airbnb-folded",
      "DTSTART;VALUE=DATE:20261201",
      "DTEND;VALUE=DATE:20261202",
      "SUMMARY:Reserved for a very long guest",
      " description",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n"));

    expect(events).toEqual([
      { externalUid: "airbnb-123", checkIn: "2026-11-26", checkOut: "2026-11-30" },
      { externalUid: "airbnb-folded", checkIn: "2026-12-01", checkOut: "2026-12-02" },
    ]);
  });

  it("ignores cancelled and invalid ranges", () => {
    const events = parseAirbnbCalendar([
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:cancelled",
      "DTSTART;VALUE=DATE:20261101",
      "DTEND;VALUE=DATE:20261103",
      "STATUS:CANCELLED",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:invalid",
      "DTSTART;VALUE=DATE:20261104",
      "DTEND;VALUE=DATE:20261104",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n"));

    expect(events).toEqual([]);
  });

  it("defaults a date-only event without DTEND to one night", () => {
    const events = parseAirbnbCalendar([
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:one-night",
      "DTSTART;VALUE=DATE:20261126",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n"));

    expect(events).toEqual([{ externalUid: "one-night", checkIn: "2026-11-26", checkOut: "2026-11-27" }]);
  });

  it("compares export tokens without accepting a different token", () => {
    expect(isAirbnbExportTokenValid("token", "token")).toBe(true);
    expect(isAirbnbExportTokenValid("token", "tokens")).toBe(false);
    expect(isAirbnbExportTokenValid("token", null)).toBe(false);
  });
});
