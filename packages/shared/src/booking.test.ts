import { describe, expect, it } from "vitest";
import {
  availabilitySearchSchema,
  calculateSnowazNightlyRateMinor,
  calculateSnowazBookingReceipt,
  calculateStayTotalMinor,
  normalizeGuestEmail,
  reservationRequestSchema,
  bookingEnquirySchema,
  rechelsPlacePricingStrategy,
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
    bedroomChoice: "both_bedrooms",
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
  it("accepts the entire two-bedroom condo for up to six guests", () =>
    expect(
      bookingEnquirySchema.safeParse({
        ...request,
        guests: "6",
        bedroomChoice: "both_bedrooms",
      }).success,
    ).toBe(true));
  it("rejects individual-bedroom selections for the whole-condo booking flow", () =>
    expect(
      bookingEnquirySchema.safeParse({ ...request, bedroomChoice: "bedroom_1" }).success,
    ).toBe(false));
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
  it("uses the current whole-condo nightly rate", () => {
    expect(calculateSnowazNightlyRateMinor(2, "both_bedrooms")).toBe(450_000);
    expect(calculateSnowazNightlyRateMinor(6, "both_bedrooms")).toBe(450_000);
    expect(() => calculateSnowazNightlyRateMinor(7)).toThrow(RangeError);
  });

  it("defaults new pricing requests to the whole-condo rate", () => {
    expect(calculateSnowazNightlyRateMinor(2)).toBe(450_000);
  });

  it("allows a different property strategy to reuse the receipt workflow", () => {
    const strategy = {
      ...rechelsPlacePricingStrategy,
      nightlyRateMinor: () => 600_000,
      baseNightlyRateMinor: () => 600_000,
      additionalGuestChargeMinor: () => 0,
      parkingNightlyRateMinor: () => 0,
      timeExtensionFeeMinor: () => 0,
      downPaymentPercent: 30,
      refundableSecurityDepositMinor: 200_000,
    };
    const receipt = calculateSnowazBookingReceipt(
      "2026-09-01",
      "2026-09-03",
      2,
      "none",
      "both_bedrooms",
      0,
      0,
      strategy,
    );

    expect(receipt.totalMinor).toBe(1_200_000);
    expect(receipt.downPaymentMinor).toBe(360_000);
    expect(receipt.refundableSecurityDepositMinor).toBe(200_000);
  });

  it("builds a receipt with a 50% down payment and separate security deposit", () => {
    expect(
      calculateSnowazBookingReceipt("2026-09-01", "2026-09-04", 5, "none", "both_bedrooms"),
    ).toEqual({
      nights: 3,
      guests: 5,
      bedrooms: 2,
      baseNightlyRateMinor: 450_000,
      nightlyRateMinor: 450_000,
      additionalGuests: 0,
      additionalGuestChargeMinor: 0,
      accommodationSubtotalMinor: 1_350_000,
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
      totalMinor: 1_350_000,
      downPaymentMinor: 675_000,
      refundableSecurityDepositMinor: 100_000,
      remainingBalanceMinor: 675_000,
    });
  });
  it("keeps the refundable security deposit out of the accommodation balance", () => {
    const receipt = calculateSnowazBookingReceipt(
      "2026-09-01",
      "2026-09-02",
      2,
      "none",
      "both_bedrooms",
    );
    expect(receipt.totalMinor).toBe(450_000);
    expect(receipt.downPaymentMinor).toBe(225_000);
    expect(receipt.remainingBalanceMinor).toBe(225_000);
    expect(receipt.refundableSecurityDepositMinor).toBe(100_000);
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
