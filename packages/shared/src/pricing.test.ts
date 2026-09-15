import { describe, expect, it } from "vitest";
import {
  parsePricingPayload,
  pricingConfigFromPayload,
  type PricingKey,
  type PricingSetting,
} from "./pricing";

const updatedAt = "2026-09-15T02:34:25.49031+00:00";

function amount(key: PricingKey, value: number, revision: number): PricingSetting {
  return {
    key,
    displayName: key,
    description: `Description for ${key}`,
    valueType: "amount",
    amountMinor: value,
    percentage: null,
    currency: "PHP",
    unit: "per night",
    maximumAmountMinor: 10_000_000,
    maximumPercentage: null,
    revision,
    updatedAt,
    updatedBy: null,
  };
}

function percentage(key: PricingKey, value: number, revision: number): PricingSetting {
  return {
    key,
    displayName: key,
    description: `Description for ${key}`,
    valueType: "percentage",
    amountMinor: null,
    percentage: value,
    currency: null,
    unit: "of accommodation total",
    maximumAmountMinor: null,
    maximumPercentage: 100,
    revision,
    updatedAt,
    updatedBy: null,
  };
}

const settings: PricingSetting[] = [
  amount("whole_condo_nightly_rate", 450_000, 1),
  amount("master_bedroom_nightly_rate", 170_000, 2),
  amount("second_bedroom_nightly_rate", 170_000, 3),
  amount("second_bedroom_3_guest_nightly_rate", 195_000, 4),
  amount("second_bedroom_4_guest_nightly_rate", 210_000, 5),
  amount("additional_guest_fee", 25_000, 6),
  amount("car_parking_nightly_rate", 35_000, 7),
  amount("motorcycle_parking_nightly_rate", 15_000, 8),
  amount("early_checkin_hourly_rate", 15_000, 9),
  amount("late_checkout_hourly_rate", 15_000, 10),
  amount("refundable_security_deposit", 100_000, 11),
  percentage("down_payment_percent", 50, 12),
];

describe("centralized pricing contract", () => {
  it("normalizes every configured setting for shared calculations", () => {
    const config = pricingConfigFromPayload({ version: "12", settings });
    expect(config).toMatchObject({
      version: "12",
      wholeCondoNightlyRateMinor: 450_000,
      masterBedroomNightlyRateMinor: 170_000,
      secondBedroomThreeGuestNightlyRateMinor: 195_000,
      additionalGuestFeeMinor: 25_000,
      carParkingNightlyRateMinor: 35_000,
      motorcycleParkingNightlyRateMinor: 15_000,
      earlyCheckinHourlyRateMinor: 15_000,
      lateCheckoutHourlyRateMinor: 15_000,
      refundableSecurityDepositMinor: 100_000,
      downPaymentPercent: 50,
    });
  });

  it("fails closed when a required setting is missing or invalid", () => {
    expect(() => pricingConfigFromPayload({ version: "11", settings: settings.slice(1) })).toThrow(/whole_condo/);
    expect(() => parsePricingPayload({ version: "12", settings: [{ ...settings[0], amountMinor: -1 }] })).toThrow();
  });
});
