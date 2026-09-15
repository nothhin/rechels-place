import { z } from "zod";

export const pricingValueTypeSchema = z.enum(["amount", "percentage"]);
export type PricingValueType = z.infer<typeof pricingValueTypeSchema>;

export const pricingKeySchema = z.enum([
  "whole_condo_nightly_rate",
  "master_bedroom_nightly_rate",
  "second_bedroom_nightly_rate",
  "second_bedroom_3_guest_nightly_rate",
  "second_bedroom_4_guest_nightly_rate",
  "additional_guest_fee",
  "car_parking_nightly_rate",
  "motorcycle_parking_nightly_rate",
  "early_checkin_hourly_rate",
  "late_checkout_hourly_rate",
  "refundable_security_deposit",
  "down_payment_percent",
]);
export type PricingKey = z.infer<typeof pricingKeySchema>;

export const pricingSettingSchema = z.object({
  key: pricingKeySchema,
  displayName: z.string().trim().min(1),
  description: z.string().trim().min(1),
  valueType: pricingValueTypeSchema,
  amountMinor: z.number().int().nonnegative().nullable(),
  percentage: z.number().finite().min(0).max(100).nullable(),
  currency: z.string().trim().length(3).nullable(),
  unit: z.string().trim().min(1),
  maximumAmountMinor: z.number().int().nonnegative().nullable(),
  maximumPercentage: z.number().finite().min(0).max(100).nullable(),
  revision: z.number().int().positive(),
  updatedAt: z.string().datetime({ offset: true }),
  updatedBy: z.string().trim().min(1).nullable().optional(),
});
export type PricingSetting = z.infer<typeof pricingSettingSchema>;

export const pricingHistoryEntrySchema = z.object({
  id: z.string(),
  key: pricingKeySchema,
  displayName: z.string(),
  valueType: pricingValueTypeSchema,
  previousAmountMinor: z.number().int().nonnegative().nullable(),
  newAmountMinor: z.number().int().nonnegative().nullable(),
  previousPercentage: z.number().finite().min(0).max(100).nullable(),
  newPercentage: z.number().finite().min(0).max(100).nullable(),
  changedAt: z.string().datetime({ offset: true }),
  changedBy: z.string().trim().min(1).nullable(),
  reason: z.string().nullable(),
});
export type PricingHistoryEntry = z.infer<typeof pricingHistoryEntrySchema>;

export const pricingPayloadSchema = z.object({
  version: z.string().trim().min(1),
  settings: z.array(pricingSettingSchema),
  history: z.array(pricingHistoryEntrySchema).optional().default([]),
});
export type PricingPayload = z.infer<typeof pricingPayloadSchema>;

/** The normalized values consumed by every client-side estimate. */
export type RechelsPricingConfig = {
  version: string;
  wholeCondoNightlyRateMinor: number;
  masterBedroomNightlyRateMinor: number;
  secondBedroomNightlyRateMinor: number;
  secondBedroomThreeGuestNightlyRateMinor: number;
  secondBedroomFourGuestNightlyRateMinor: number;
  additionalGuestFeeMinor: number;
  carParkingNightlyRateMinor: number;
  motorcycleParkingNightlyRateMinor: number;
  earlyCheckinHourlyRateMinor: number;
  lateCheckoutHourlyRateMinor: number;
  refundableSecurityDepositMinor: number;
  downPaymentPercent: number;
  settings: PricingSetting[];
};

function amountFor(settings: Map<PricingKey, PricingSetting>, key: PricingKey) {
  const setting = settings.get(key);
  if (!setting || setting.valueType !== "amount" || setting.amountMinor === null) {
    throw new Error(`Missing monetary pricing setting: ${key}`);
  }
  return setting.amountMinor;
}

function percentageFor(settings: Map<PricingKey, PricingSetting>, key: PricingKey) {
  const setting = settings.get(key);
  if (!setting || setting.valueType !== "percentage" || setting.percentage === null) {
    throw new Error(`Missing percentage pricing setting: ${key}`);
  }
  return setting.percentage;
}

export function parsePricingPayload(value: unknown): PricingPayload {
  return pricingPayloadSchema.parse(value);
}

export function pricingConfigFromPayload(value: unknown): RechelsPricingConfig {
  const payload = parsePricingPayload(value);
  const settings = new Map(payload.settings.map((setting) => [setting.key, setting]));
  return {
    version: payload.version,
    wholeCondoNightlyRateMinor: amountFor(settings, "whole_condo_nightly_rate"),
    masterBedroomNightlyRateMinor: amountFor(settings, "master_bedroom_nightly_rate"),
    secondBedroomNightlyRateMinor: amountFor(settings, "second_bedroom_nightly_rate"),
    secondBedroomThreeGuestNightlyRateMinor: amountFor(settings, "second_bedroom_3_guest_nightly_rate"),
    secondBedroomFourGuestNightlyRateMinor: amountFor(settings, "second_bedroom_4_guest_nightly_rate"),
    additionalGuestFeeMinor: amountFor(settings, "additional_guest_fee"),
    carParkingNightlyRateMinor: amountFor(settings, "car_parking_nightly_rate"),
    motorcycleParkingNightlyRateMinor: amountFor(settings, "motorcycle_parking_nightly_rate"),
    earlyCheckinHourlyRateMinor: amountFor(settings, "early_checkin_hourly_rate"),
    lateCheckoutHourlyRateMinor: amountFor(settings, "late_checkout_hourly_rate"),
    refundableSecurityDepositMinor: amountFor(settings, "refundable_security_deposit"),
    downPaymentPercent: percentageFor(settings, "down_payment_percent"),
    settings: payload.settings,
  };
}

export function formatPhpMinor(amountMinor: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export function formatPricingPercent(value: number) {
  return `${new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 2,
  }).format(value)}%`;
}
