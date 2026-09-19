import { describe, expect, it } from "vitest";
import { serializeAirbnbCalendarEvents } from "./airbnb-calendar-payload";

describe("Airbnb calendar database payload", () => {
  it("maps parser fields to the snake_case RPC contract", () => {
    expect(serializeAirbnbCalendarEvents([{
      externalUid: "airbnb-reservation-1",
      checkIn: "2026-09-19",
      checkOut: "2026-09-29",
      summary: "Reserved",
      description: "Private source detail",
      sourceStatus: "CONFIRMED",
    }])).toEqual([{
      external_uid: "airbnb-reservation-1",
      check_in: "2026-09-19",
      check_out: "2026-09-29",
      summary: "Reserved",
      description: "Private source detail",
      source_status: "CONFIRMED",
    }]);
  });

  it("supplies safe defaults for optional metadata", () => {
    expect(serializeAirbnbCalendarEvents([{
      externalUid: "airbnb-reservation-2",
      checkIn: "2026-10-01",
      checkOut: "2026-10-02",
    }])).toEqual([{
      external_uid: "airbnb-reservation-2",
      check_in: "2026-10-01",
      check_out: "2026-10-02",
      summary: "Unavailable",
      description: null,
      source_status: "UNKNOWN",
    }]);
  });
});
