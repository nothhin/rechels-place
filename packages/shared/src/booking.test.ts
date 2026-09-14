import { describe, expect, it } from "vitest";
import {
  availabilitySearchSchema,
  calculateSnowazNightlyRateMinor,
  calculateSnowazBookingReceipt,
  calculateStayTotalMinor,
  normalizeGuestEmail,
  reservationRequestSchema,
  bookingEnquirySchema,
  stayNights,
} from "./booking";

describe("booking contracts", () => {
  it("rejects impossible calendar dates", () => {
    expect(
      availabilitySearchSchema.safeParse({
        checkIn: "2026-02-30",
        checkOut: "2026-03-02",
        guests: 2,
      }).success,
    ).toBe(false);
  });

  it("allows leap day and back-to-back date boundaries", () => {
    expect(stayNights("2028-02-29", "2028-03-01")).toBe(1);
    expect(stayNights("2026-08-10", "2026-08-11")).toBe(1);
  });

  it("normalizes email without changing booking identity semantics", () => {
    expect(normalizeGuestEmail("  Guest@Example.COM ")).toBe(
      "guest@example.com",
    );
  });

  it("requires explicit consent and a retry-safe idempotency key", () => {
    const result = reservationRequestSchema.safeParse({
      roomTypeId: "aa9d92d3-38cc-43f1-a32a-0b2b21d05c90",
      checkIn: "2026-08-10",
      checkOut: "2026-08-12",
      guests: 2,
      guest: { fullName: "Guest Name", email: "guest@example.com" },
      consent: false,
      consentVersion: "2026-08-01",
      idempotencyKey: "d87c7965-11f9-4e93-8ff4-fb8a60a21321",
    });
    expect(result.success).toBe(false);
  });
});

describe("booking enquiries", () => {
  const request = {
    checkIn: "2026-09-01",
    checkOut: "2026-09-02",
    guests: "2",
    bedroomChoice: "bedroom_1",
    fullName: "Guest Name",
    email: "",
    phone: "09951234567",
    preferredContact: "phone",
    specialRequests: "",
    consent: "on",
    idempotencyKey: "d87c7965-11f9-4e93-8ff4-fb8a60a21321",
    website: "",
  };
  it("allows an optional email when the required phone number is provided", () =>
    expect(bookingEnquirySchema.safeParse(request).success).toBe(true));
  it("allows either individual bedroom for up to two guests", () => {
    expect(
      bookingEnquirySchema.safeParse({ ...request, bedroomChoice: "bedroom_1" })
        .success,
    ).toBe(true);
    expect(
      bookingEnquirySchema.safeParse({ ...request, bedroomChoice: "bedroom_2" })
        .success,
    ).toBe(true);
  });
  it("allows Bedroom 2 for three or four guests", () =>
    expect(
      bookingEnquirySchema.safeParse({
        ...request,
        guests: "3",
        bedroomChoice: "bedroom_2",
      }).success,
    ).toBe(true));
  it("allows Bedroom 2 for up to six guests", () =>
    expect(
      bookingEnquirySchema.safeParse({
        ...request,
        guests: "6",
        bedroomChoice: "bedroom_2",
      }).success,
    ).toBe(true));
  it("rejects more than six guests", () =>
    expect(
      bookingEnquirySchema.safeParse({ ...request, guests: "7" }).success,
    ).toBe(false));
  it("does not accept an alternate preferred contact method", () =>
    expect(
      bookingEnquirySchema.safeParse({ ...request, preferredContact: "email" })
        .success,
    ).toBe(false));
});

describe("money calculations", () => {
  it("uses the provisional Uppadar bedroom prices", () => {
    expect(calculateSnowazNightlyRateMinor(2, "bedroom_1")).toBe(170_000);
    expect(calculateSnowazNightlyRateMinor(2, "bedroom_2")).toBe(170_000);
    expect(calculateSnowazNightlyRateMinor(3, "bedroom_2")).toBe(195_000);
    expect(calculateSnowazNightlyRateMinor(4, "bedroom_2")).toBe(210_000);
    expect(calculateSnowazNightlyRateMinor(5, "bedroom_2")).toBe(235_000);
    expect(() => calculateSnowazNightlyRateMinor(7)).toThrow(RangeError);
  });

  it("builds a receipt with the required down payment and remaining balance", () => {
    expect(
      calculateSnowazBookingReceipt("2026-09-01", "2026-09-04", 5, "none", "bedroom_2"),
    ).toEqual({
      nights: 3,
      guests: 5,
      bedrooms: 1,
      baseNightlyRateMinor: 170_000,
      nightlyRateMinor: 235_000,
      additionalGuests: 3,
      additionalGuestChargeMinor: 195_000,
      accommodationSubtotalMinor: 705_000,
      parkingType: "none",
      parkingNightlyRateMinor: 0,
      parkingChargeMinor: 0,
      earlyCheckInHours: 0,
      earlyCheckInTime: null,
      earlyCheckInFeeMinor: 0,
      lateCheckoutHours: 0,
      lateCheckoutTime: null,
      lateCheckoutFeeMinor: 0,
      timeExtensionChargeMinor: 0,
      extrasTotalMinor: 0,
      totalMinor: 705_000,
      downPaymentMinor: 100_000,
      remainingBalanceMinor: 705_000,
    });
  });
  it("adds optional parking per night", () => {
    expect(calculateSnowazBookingReceipt("2026-09-01", "2026-09-03", 2, "car").parkingChargeMinor).toBe(70_000);
    expect(calculateSnowazBookingReceipt("2026-09-01", "2026-09-03", 2, "motorcycle").parkingChargeMinor).toBe(30_000);
  });
  it("itemizes early and late time without multiplying the fee by nights", () => {
    const receipt = calculateSnowazBookingReceipt("2026-09-01", "2026-09-04", 3, "car", "bedroom_2", 2, 3);
    expect(receipt).toMatchObject({
      earlyCheckInTime: "12:00",
      earlyCheckInFeeMinor: 30_000,
      lateCheckoutTime: "14:00",
      lateCheckoutFeeMinor: 45_000,
      accommodationSubtotalMinor: 585_000,
      parkingChargeMinor: 105_000,
      extrasTotalMinor: 180_000,
      totalMinor: 765_000,
    });
  });
  it("calculates totals only with integer minor units", () => {
    expect(calculateStayTotalMinor(250_000, 3)).toBe(750_000);
    expect(() => calculateStayTotalMinor(2_500.5, 2)).toThrow(RangeError);
    expect(() => calculateStayTotalMinor(2_500, 0)).toThrow(RangeError);
  });
});
