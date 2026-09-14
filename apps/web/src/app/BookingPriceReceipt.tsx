"use client";

import { calculateSnowazBookingReceipt } from "@uppadar-hollie/shared/booking";

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
};

const bedroomLabels = {
  bedroom_1: "Master bedroom",
  bedroom_2: "Second bedroom",
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
}: BookingPriceReceiptProps) {
  let receipt: ReturnType<typeof calculateSnowazBookingReceipt> | null = null;
  try {
    receipt = calculateSnowazBookingReceipt(
      checkIn,
      checkOut,
      guests,
      parkingType,
      bedroomChoice,
      earlyCheckInHours,
      lateCheckoutHours,
    );
  } catch {
    // The form fields provide their own validation while the receipt waits for valid values.
  }

  if (!receipt)
    return (
      <aside
        className="booking-receipt booking-receipt-empty"
        aria-live="polite"
      >
        <strong>Digital booking receipt</strong>
        <p>
          Choose valid stay dates and a guest count to calculate your payment.
        </p>
      </aside>
    );

  return (
    <aside
      className="booking-receipt"
      aria-live="polite"
      aria-label="Calculated booking payment"
    >
      <header>
        <div>
          <small>Rechel’s Place</small>
          <strong>Digital booking receipt</strong>
        </div>
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
        <div><dt>Room description</dt><dd>{bedroomChoice === "bedroom_1" ? "Queen bed · Up to 2 guests" : bedroomChoice === "bedroom_2" ? "Double-size bunk bed" : "Entire unit · Maximum of 6 guests"}</dd></div>
        <div>
          <dt>Base nightly rate</dt>
          <dd>{php.format(receipt.baseNightlyRateMinor / 100)}</dd>
        </div>
        {receipt.additionalGuests > 0 ? (
          <div className="booking-receipt-additional">
            <dt>
              Second-bedroom occupancy adjustment
              <br />
              <small>
                {php.format(receipt.additionalGuestChargeMinor / receipt.nights / 100)} per night × {receipt.nights} night
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
        {receipt.earlyCheckInFeeMinor > 0 ? <div className="booking-receipt-additional"><dt>Early check-in<br /><small>{receipt.earlyCheckInHours} hour{receipt.earlyCheckInHours === 1 ? "" : "s"} early · {receipt.earlyCheckInTime} · ₱150/hour</small></dt><dd>+{php.format(receipt.earlyCheckInFeeMinor / 100)}</dd></div> : null}
        {receipt.lateCheckoutFeeMinor > 0 ? <div className="booking-receipt-additional"><dt>Late checkout<br /><small>{receipt.lateCheckoutHours} hour{receipt.lateCheckoutHours === 1 ? "" : "s"} late · {receipt.lateCheckoutTime} · ₱150/hour</small></dt><dd>+{php.format(receipt.lateCheckoutFeeMinor / 100)}</dd></div> : null}
        <div><dt>Accommodation subtotal</dt><dd>{php.format(receipt.accommodationSubtotalMinor / 100)}</dd></div>
        {receipt.extrasTotalMinor > 0 ? <div><dt>Extras total</dt><dd>+{php.format(receipt.extrasTotalMinor / 100)}</dd></div> : null}
        <div className="booking-receipt-total">
          <dt>Final total</dt>
          <dd>{php.format(receipt.totalMinor / 100)}</dd>
        </div>
        <div className="booking-receipt-down">
          <dt>Refundable security deposit</dt>
          <dd>{php.format(receipt.downPaymentMinor / 100)}</dd>
        </div>
        <div>
          <dt>Remaining balance</dt>
          <dd>{php.format(receipt.remainingBalanceMinor / 100)}</dd>
        </div>
        {bookingStatus ? <div><dt>Booking status</dt><dd>{bookingStatus.replaceAll("_", " ")}</dd></div> : null}
        {paymentStatus ? <div><dt>Payment status</dt><dd>{paymentStatus.replaceAll("_", " ")}</dd></div> : null}
      </dl>
      <p>
        The ₱1,000 security deposit is refundable after checkout and is separate
        from the accommodation total. It is verified manually.
      </p>
    </aside>
  );
}
