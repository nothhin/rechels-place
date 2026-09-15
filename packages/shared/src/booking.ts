import { z } from "zod";
import type { RechelsPricingConfig } from "./pricing";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MILLISECONDS_PER_DAY = 86_400_000;
export const bedroomChoiceSchema = z.enum([
  "bedroom_1",
  "bedroom_2",
  "both_bedrooms",
]);
export const parkingTypeSchema = z.enum(["none", "car", "motorcycle"]);

function isCalendarDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export const stayDateSchema = z
  .string()
  .refine(isCalendarDate, "Choose a valid calendar date.");

export const staySchema = z
  .object({
    checkIn: stayDateSchema,
    checkOut: stayDateSchema,
  })
  .refine(({ checkIn, checkOut }) => checkOut > checkIn, {
    message: "Check-out must be after check-in.",
    path: ["checkOut"],
  });

export const availabilitySearchSchema = staySchema.extend({
  guests: z.coerce.number().int().min(1).max(6),
});

export const guestDetailsSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().regex(/^09\d{9}$/, "Enter a valid Philippine mobile number starting with 09 (11 digits).").optional().or(z.literal("")),
});

export const reservationRequestSchema = staySchema.extend({
  roomTypeId: z.string().uuid(),
  guests: z.coerce.number().int().min(1).max(6),
  guest: guestDetailsSchema,
  specialRequests: z.string().trim().max(1_000).optional().or(z.literal("")),
  consent: z.literal(true, {
    error: "Accept the booking terms and privacy notice.",
  }),
  consentVersion: z.string().trim().min(1).max(50),
  idempotencyKey: z.string().uuid(),
});

export const bookingEnquirySchema = staySchema.extend({
    roomTypeId: z.string().uuid().optional().or(z.literal("")),
    guests: z.coerce.number().int().min(1).max(6),
    bedroomChoice: z.literal("both_bedrooms"),
    parkingType: parkingTypeSchema.default("none"),
    earlyCheckInHours: z.coerce.number().int().min(0).max(5).default(0),
    lateCheckoutHours: z.coerce.number().int().min(0).max(5).default(0),
    fullName: z.string().trim().min(2).max(120),
    email: z.union([
      z.literal(""),
      z.string().trim().toLowerCase().email().max(254),
    ]),
    phone: z.string().trim().regex(/^09\d{9}$/, "Enter a valid Philippine mobile number starting with 09 (11 digits)."),
    preferredContact: z.literal("phone"),
    specialRequests: z.string().trim().max(1_000).optional().or(z.literal("")),
    consent: z.literal("on", {
      error: "Accept the privacy notice before submitting.",
    }),
    idempotencyKey: z.string().uuid(),
    pricingVersion: z.string().trim().max(64).optional().or(z.literal("")),
    clientTotalMinor: z.coerce.number().int().min(0).optional().or(z.literal("")),
    website: z.string().max(0).optional().or(z.literal("")),
  });

export type BedroomChoice = z.infer<typeof bedroomChoiceSchema>;
export type ParkingType = z.infer<typeof parkingTypeSchema>;

export type AdditionalGuestChargeInput = {
  guests: number;
  bedroomChoice: BedroomChoice;
  nightlyRateMinor: number;
  nights: number;
};

/**
 * Strategy boundary for stay pricing. A future property can provide its own
 * rates and payment policy without changing the booking receipt workflow.
 */
export type StayPricingStrategy = {
  nightlyRateMinor: (guests: number, bedroomChoice: BedroomChoice) => number;
  baseNightlyRateMinor: (bedroomChoice: BedroomChoice) => number;
  additionalGuestChargeMinor: (input: AdditionalGuestChargeInput) => number;
  parkingNightlyRateMinor: (parkingType: ParkingType) => number;
  timeExtensionFeeMinor: (hours: number, kind?: "early" | "late") => number;
  downPaymentPercent: number;
  refundableSecurityDepositMinor: number;
};

export function stayNights(checkIn: string, checkOut: string) {
  const parsed = staySchema.parse({ checkIn, checkOut });
  const start = Date.parse(`${parsed.checkIn}T00:00:00.000Z`);
  const end = Date.parse(`${parsed.checkOut}T00:00:00.000Z`);
  return (end - start) / MILLISECONDS_PER_DAY;
}

export function calculateStayTotalMinor(
  nightlyRateMinor: number,
  nights: number,
) {
  if (!Number.isSafeInteger(nightlyRateMinor) || nightlyRateMinor < 0) {
    throw new RangeError(
      "Nightly rate must be a non-negative integer in minor units.",
    );
  }
  if (!Number.isSafeInteger(nights) || nights < 1) {
    throw new RangeError(
      "Stay length must be a positive whole number of nights.",
    );
  }

  const total = nightlyRateMinor * nights;
  if (!Number.isSafeInteger(total))
    throw new RangeError("Stay total exceeds the safe integer range.");
  return total;
}

function validateGuestCount(guests: number) {
  if (!Number.isSafeInteger(guests) || guests < 1 || guests > 6) {
    throw new RangeError("Guest count must be a whole number from 1 to 6.");
  }
}

function calculateRechelsPlaceNightlyRateMinor(
  guests: number,
  bedroomChoice: BedroomChoice,
  pricing: RechelsPricingConfig,
) {
  validateGuestCount(guests);
  if (bedroomChoice === "bedroom_1") return pricing.masterBedroomNightlyRateMinor;
  if (bedroomChoice === "bedroom_2") {
    if (guests <= 2) return pricing.secondBedroomNightlyRateMinor;
    if (guests === 3) return pricing.secondBedroomThreeGuestNightlyRateMinor;
    return pricing.secondBedroomFourGuestNightlyRateMinor + Math.max(0, guests - 4) * pricing.additionalGuestFeeMinor;
  }
  return pricing.wholeCondoNightlyRateMinor;
}

export function createRechelsPlacePricingStrategy(
  pricing: RechelsPricingConfig,
): StayPricingStrategy {
  return {
    nightlyRateMinor: (guests, bedroomChoice) =>
      calculateRechelsPlaceNightlyRateMinor(guests, bedroomChoice, pricing),
    baseNightlyRateMinor: (bedroomChoice) =>
      bedroomChoice === "both_bedrooms"
        ? pricing.wholeCondoNightlyRateMinor
        : bedroomChoice === "bedroom_1"
          ? pricing.masterBedroomNightlyRateMinor
          : pricing.secondBedroomNightlyRateMinor,
    additionalGuestChargeMinor: ({ bedroomChoice, nightlyRateMinor, nights }) =>
      bedroomChoice === "bedroom_2"
        ? Math.max(0, nightlyRateMinor - pricing.secondBedroomNightlyRateMinor) * nights
        : 0,
    parkingNightlyRateMinor: (parkingType) =>
      parkingType === "car"
        ? pricing.carParkingNightlyRateMinor
        : parkingType === "motorcycle"
          ? pricing.motorcycleParkingNightlyRateMinor
          : 0,
    timeExtensionFeeMinor: (hours, kind = "early") =>
      hours * (kind === "early" ? pricing.earlyCheckinHourlyRateMinor : pricing.lateCheckoutHourlyRateMinor),
    downPaymentPercent: pricing.downPaymentPercent,
    refundableSecurityDepositMinor: pricing.refundableSecurityDepositMinor,
  };
}

export function calculateSnowazNightlyRateMinor(
  guests: number,
  bedroomChoice: BedroomChoice,
  pricing: RechelsPricingConfig,
) {
  return createRechelsPlacePricingStrategy(pricing).nightlyRateMinor(guests, bedroomChoice);
}

export function calculateRechelsPlaceTimeExtensionFeeMinor(
  hours: number,
  pricing: RechelsPricingConfig,
  kind: "early" | "late" = "early",
) {
  return hours * (kind === "early" ? pricing.earlyCheckinHourlyRateMinor : pricing.lateCheckoutHourlyRateMinor);
}

export function automaticBedroomChoice(guests: number) {
  if (!Number.isSafeInteger(guests) || guests < 1 || guests > 6)
    throw new RangeError("Guest count must be a whole number from 1 to 6.");
  return guests <= 2
    ? ("bedroom_1" as const)
    : ("bedroom_2" as const);
}

export function calculateSnowazBookingReceipt(
  checkIn: string,
  checkOut: string,
  guests: number,
  parkingType: ParkingType = "none",
  bedroomChoice: BedroomChoice = "both_bedrooms",
  earlyCheckInHours = 0,
  lateCheckoutHours = 0,
  pricingStrategy: StayPricingStrategy,
) {
  if (!Number.isSafeInteger(earlyCheckInHours) || earlyCheckInHours < 0 || earlyCheckInHours > 5)
    throw new RangeError("Early check-in must be a whole number from 0 to 5 hours.");
  if (!Number.isSafeInteger(lateCheckoutHours) || lateCheckoutHours < 0 || lateCheckoutHours > 5)
    throw new RangeError("Late checkout must be a whole number from 0 to 5 hours.");
  const nights = stayNights(checkIn, checkOut);
  const nightlyRateMinor = pricingStrategy.nightlyRateMinor(guests, bedroomChoice);
  const baseNightlyRateMinor = pricingStrategy.baseNightlyRateMinor(bedroomChoice);
  const parkingNightlyRateMinor = pricingStrategy.parkingNightlyRateMinor(parkingType);
  const parkingChargeMinor = parkingNightlyRateMinor * nights;
  const earlyCheckInFeeMinor = pricingStrategy.timeExtensionFeeMinor(earlyCheckInHours, "early");
  const lateCheckoutFeeMinor = pricingStrategy.timeExtensionFeeMinor(lateCheckoutHours, "late");
  const timeExtensionChargeMinor = earlyCheckInFeeMinor + lateCheckoutFeeMinor;
  const additionalGuests = bedroomChoice === "both_bedrooms" ? 0 : Math.max(0, guests - 2);
  const additionalGuestChargeMinor = pricingStrategy.additionalGuestChargeMinor({
    guests,
    bedroomChoice,
    nightlyRateMinor,
    nights,
  });
  const accommodationSubtotalMinor =
    calculateStayTotalMinor(baseNightlyRateMinor, nights) + additionalGuestChargeMinor;
  const extrasTotalMinor = parkingChargeMinor + timeExtensionChargeMinor;
  const totalMinor = accommodationSubtotalMinor + extrasTotalMinor;
  const downPaymentMinor = Math.ceil(
    (totalMinor * pricingStrategy.downPaymentPercent) / 100,
  );
  const earlyCheckInTime = earlyCheckInHours
    ? `${String(14 - earlyCheckInHours).padStart(2, "0")}:00`
    : null;
  const lateCheckoutTime = lateCheckoutHours
    ? `${String(11 + lateCheckoutHours).padStart(2, "0")}:00`
    : null;

  return {
    nights,
    guests,
    bedrooms: bedroomChoice === "both_bedrooms" ? 2 : 1,
    baseNightlyRateMinor,
    nightlyRateMinor,
    additionalGuests,
    additionalGuestChargeMinor,
    accommodationSubtotalMinor,
    parkingType,
    parkingNightlyRateMinor,
    parkingChargeMinor,
    earlyCheckInHours,
    earlyCheckInTime,
    earlyCheckInFeeMinor,
    lateCheckoutHours,
    lateCheckoutTime,
    lateCheckoutFeeMinor,
    timeExtensionChargeMinor,
    extrasTotalMinor,
    totalMinor,
    downPaymentMinor,
    downPaymentPercent: pricingStrategy.downPaymentPercent,
    refundableSecurityDepositMinor: pricingStrategy.refundableSecurityDepositMinor,
    remainingBalanceMinor: totalMinor - downPaymentMinor,
  } as const;
}

export function normalizeGuestEmail(email: string) {
  return guestDetailsSchema.shape.email.parse(email);
}

export type AvailabilitySearch = z.infer<typeof availabilitySearchSchema>;
export type ReservationRequest = z.infer<typeof reservationRequestSchema>;
export type BookingEnquiry = z.infer<typeof bookingEnquirySchema>;
