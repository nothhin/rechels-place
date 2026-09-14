import { describe, expect, it } from "vitest";
import { normalizeAirbnbIcalUrl } from "./airbnb-calendar-url";

describe("normalizeAirbnbIcalUrl", () => {
  it("accepts an Airbnb calendar export URL", () => {
    expect(normalizeAirbnbIcalUrl(" https://www.airbnb.com/calendar/ical/123456.ics?t=private-token&locale=en "))
      .toBe("https://www.airbnb.com/calendar/ical/123456.ics?t=private-token&locale=en");
  });

  it.each([
    "https://example.com/calendar/ical/123456.ics?t=x",
    "http://www.airbnb.com/calendar/ical/123456.ics?t=x",
    "https://www.airbnb.com.evil.test/calendar/ical/123456.ics?t=x",
    "https://www.airbnb.com/calendar/ical/123456.ics",
    "https://www.airbnb.com/",
  ])("rejects a non-export URL", (url) => {
    expect(normalizeAirbnbIcalUrl(url)).toBeNull();
  });
});
