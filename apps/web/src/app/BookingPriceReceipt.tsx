"use client";

import Image from "next/image";
import {
  calculateSnowazBookingReceipt,
  createRechelsPlacePricingStrategy,
} from "@uppadar-hollie/shared/booking";
import { formatPricingPercent, type RechelsPricingConfig } from "@uppadar-hollie/shared/pricing";
import { propertyLogoSrc } from "@/lib/property";

const php = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

type BookingPriceReceiptProps = {
  checkIn: string;
  checkOut: string;
  guests: number;
  bedroomChoice?: "bedroom_1" | "bedroom_2" | "both_bedrooms";
  parkingType?: "none" | "car" | "motorcycle";
  earlyCheckInHours?: number;
  lateCheckoutHours?: number;
  bookingReference?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  bookingStatus?: string;
  paymentStatus?: string;
  downPaymentMinor?: number;
  refundableSecurityDepositMinor?: number;
  pricing?: RechelsPricingConfig | null;
  snapshot?: ReturnType<typeof calculateSnowazBookingReceipt>;
};
export type BookingPriceSnapshot = ReturnType<typeof calculateSnowazBookingReceipt>;

const bedroomLabels = {
  bedroom_1: "Legacy single-bedroom record",
  bedroom_2: "Legacy single-bedroom record",
  both_bedrooms: "Entire two-bedroom condo",
} as const;

export default function BookingPriceReceipt({
  checkIn,
  checkOut,
  guests,
  bedroomChoice,
  parkingType = "none",
  earlyCheckInHours = 0,
  lateCheckoutHours = 0,
  bookingReference,
  customerName,
  customerEmail,
  customerPhone,
  bookingStatus,
  paymentStatus,
  downPaymentMinor,
  refundableSecurityDepositMinor,
  pricing,
  snapshot,
}: BookingPriceReceiptProps) {
  let receipt: ReturnType<typeof calculateSnowazBookingReceipt> | null = snapshot ?? null;
  if (!receipt && pricing) {
    try {
      receipt = calculateSnowazBookingReceipt(
        checkIn,
        checkOut,
        guests,
        parkingType,
        bedroomChoice,
        earlyCheckInHours,
        lateCheckoutHours,
        createRechelsPlacePricingStrategy(pricing),
      );
    } catch {
      // The form fields provide their own validation while the receipt waits for valid values.
    }
  }

  if (!receipt)
    return (
      <aside
        className="booking-receipt booking-receipt-empty"
        aria-live="polite"
      >
        <strong>Digital booking receipt</strong>
        <p>
          {pricing
            ? "Choose valid stay dates and a guest count to calculate your payment."
            : "Live pricing is temporarily unavailable. Please try again shortly."}
        </p>
      </aside>
    );

  const displayDownPaymentMinor = downPaymentMinor ?? receipt.downPaymentMinor;
  const displaySecurityDepositMinor =
    refundableSecurityDepositMinor ?? receipt.refundableSecurityDepositMinor;
  const downPaymentPercent =
    receipt.downPaymentPercent ??
    (receipt.totalMinor > 0
      ? (displayDownPaymentMinor / receipt.totalMinor) * 100
      : 0);
  const downPaymentLabel = `${formatPricingPercent(downPaymentPercent)} down payment`;

  return (
    <aside
      className="booking-receipt"
      aria-live="polite"
      aria-label="Calculated booking payment"
    >
      <header>
        <div className="booking-receipt-brand"><Image src={propertyLogoSrc} alt="" width={38} height={38} /><span><small>Rechel’s Place</small><strong>Digital booking receipt</strong></span></div>
        <span>Estimate</span>
      </header>
      <dl>
        {bookingReference ? <div><dt>Booking reference</dt><dd>{bookingReference}</dd></div> : null}
        {customerName ? <div><dt>Guest</dt><dd>{customerName}</dd></div> : null}
        {customerPhone || customerEmail ? <div><dt>Contact</dt><dd>{[customerPhone, customerEmail].filter(Boolean).join(" · ")}</dd></div> : null}
        <div><dt>Check-in</dt><dd>{checkIn}</dd></div>
        <div><dt>Check-out</dt><dd>{checkOut}</dd></div>
        <div>
          <dt>Stay</dt>
          <dd>
            {receipt.nights} night{receipt.nights === 1 ? "" : "s"}
          </dd>
        </div>
        <div>
          <dt>Guests</dt>
          <dd>{receipt.guests} pax</dd>
        </div>
        <div>
          <dt>Bedroom selection</dt>
          <dd>
            {bedroomChoice
              ? bedroomLabels[bedroomChoice]
              : `${receipt.bedrooms} bedroom${receipt.bedrooms === 1 ? "" : "s"}`}
          </dd>
        </div>
        <div><dt>Space description</dt><dd>{bedroomChoice === "both_bedrooms" ? "2 bedrooms · 5 beds · 2.5 baths · Up to 6 guests" : "Legacy bedroom selection"}</dd></div>
        <div>
          <dt>Nightly rate</dt>
          <dd>{php.format(receipt.baseNightlyRateMinor / 100)}</dd>
        </div>
        {receipt.additionalGuests > 0 ? (
          <div className="booking-receipt-additional">
            <dt>
              Additional occupancy adjustment
              <br />
              <small>
                Host-confirmed adjustment × {receipt.nights} night
                {receipt.nights === 1 ? "" : "s"}
              </small>
            </dt>
            <dd>+{php.format(receipt.additionalGuestChargeMinor / 100)}</dd>
          </div>
        ) : null}
        {receipt.parkingChargeMinor > 0 ? (
          <div className="booking-receipt-additional">
            <dt>
              {receipt.parkingType === "car" ? "Car" : "Motorcycle"} parking
              <br />
              <small>
                {php.format(receipt.parkingNightlyRateMinor / 100)} ×{" "}
                {receipt.nights} night{receipt.nights === 1 ? "" : "s"}
              </small>
            </dt>
            <dd>+{php.format(receipt.parkingChargeMinor / 100)}</dd>
          </div>
        ) : null}
        {receipt.earlyCheckInFeeMinor > 0 ? <div className="booking-receipt-additional"><dt>Early check-in<br /><small>{receipt.earlyCheckInHours} hour{receipt.earlyCheckInHours === 1 ? "" : "s"} early · Host confirms availability</small></dt><dd>+{php.format(receipt.earlyCheckInFeeMinor / 100)}</dd></div> : null}
        {receipt.lateCheckoutFeeMinor > 0 ? <div className="booking-receipt-additional"><dt>Late checkout<br /><small>{receipt.lateCheckoutHours} hour{receipt.lateCheckoutHours === 1 ? "" : "s"} late · Host confirms availability</small></dt><dd>+{php.format(receipt.lateCheckoutFeeMinor / 100)}</dd></div> : null}
        <div><dt>Accommodation subtotal</dt><dd>{php.format(receipt.accommodationSubtotalMinor / 100)}</dd></div>
        {receipt.extrasTotalMinor > 0 ? <div><dt>Extras total</dt><dd>+{php.format(receipt.extrasTotalMinor / 100)}</dd></div> : null}
        <div className="booking-receipt-total">
          <dt>Estimated stay total</dt>
          <dd>{php.format(receipt.totalMinor / 100)}</dd>
        </div>
        <div className="booking-receipt-down">
          <dt>{downPaymentLabel}</dt>
          <dd>{php.format(displayDownPaymentMinor / 100)}</dd>
        </div>
        <div>
          <dt>Remaining accommodation balance</dt>
          <dd>{php.format((receipt.totalMinor - displayDownPaymentMinor) / 100)}</dd>
        </div>
        <div>
          <dt>
            Refundable security deposit
            <br />
            <small>Due upon check-in on the check-in day · separate from the down payment</small>
          </dt>
          <dd>{php.format(displaySecurityDepositMinor / 100)}</dd>
        </div>
        {bookingStatus ? <div><dt>Booking status</dt><dd>{bookingStatus.replaceAll("_", " ")}</dd></div> : null}
        {paymentStatus ? <div><dt>Payment status</dt><dd>{paymentStatus.replaceAll("_", " ")}</dd></div> : null}
      </dl>
      <p>
        The {downPaymentLabel} secures the accommodation balance. The {php.format(displaySecurityDepositMinor / 100)}
        refundable security deposit is separate and due upon check-in on that
        day. Rechel confirms availability, house rules, and any final payment
        instructions after reviewing the request.
      </p>
    </aside>
  );
}
