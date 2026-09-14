import { describe, expect, it } from "vitest";
import { availabilitySearchSchema } from "./availability";

describe("availabilitySearchSchema", () => {
  it("accepts a valid half-open stay range", () => {
    const result = availabilitySearchSchema.safeParse({
      checkIn: "2026-08-10",
      checkOut: "2026-08-11",
      guests: "2",
    });

    expect(result.success).toBe(true);
  });

  it("rejects same-day checkout", () => {
    const result = availabilitySearchSchema.safeParse({
      checkIn: "2026-08-10",
      checkOut: "2026-08-10",
      guests: 2,
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid party sizes", () => {
    expect(
      availabilitySearchSchema.safeParse({
        checkIn: "2026-08-10",
        checkOut: "2026-08-11",
        guests: 0,
      }).success,
    ).toBe(false);
  });
});
