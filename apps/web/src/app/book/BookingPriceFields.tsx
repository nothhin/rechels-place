"use client";

import { useState } from "react";
import { formatPhpMinor, formatPricingPercent, type RechelsPricingConfig } from "@uppadar-hollie/shared/pricing";
import BookingPriceReceipt from "../BookingPriceReceipt";
import styles from "./book.module.css";

type BookingPriceFieldsProps = {
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialGuests?: string;
  pricing?: RechelsPricingConfig | null;
};

export default function BookingPriceFields({
  initialCheckIn = "",
  initialCheckOut = "",
  initialGuests = "2",
  pricing = null,
}: BookingPriceFieldsProps) {
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [adults, setAdults] = useState(() => Math.min(6, Math.max(1, Number(initialGuests) || 2)));
  const [children, setChildren] = useState(0);
  const guests = adults + children;

  return (
    <>
      <div className={styles.grid}>
        <label>
          <span>Check-in</span>
          <input name="checkIn" type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} required />
        </label>
        <label>
          <span>Check-out</span>
          <input name="checkOut" type="date" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} required />
        </label>
      </div>
      <input type="hidden" name="bedroomChoice" value="both_bedrooms" />
      <input type="hidden" name="parkingType" value="none" />
      <input type="hidden" name="earlyCheckInHours" value="0" />
      <input type="hidden" name="lateCheckoutHours" value="0" />
      <fieldset className={styles.roomChoice}>
        <legend>Choose your stay</legend>
        <div className={`${styles.roomChoiceActive} ${styles.roomOption}`}>
          <span>
            <strong>Entire two-bedroom condo</strong>
            <small>2 bedrooms · 5 beds · 2.5 baths · Up to 6 adults + 3 children</small>
          </span>
          <b>{pricing ? formatPhpMinor(pricing.wholeCondoNightlyRateMinor) : "Current rate"}/night</b>
        </div>
      </fieldset>
      <label>
        <span>Adults</span>
        <select name="adults" value={adults} onChange={(event) => setAdults(Number(event.target.value))} required>
          {Array.from({ length: 6 }, (_, index) => index + 1).map((guestCount) => (
            <option key={guestCount} value={guestCount}>
              {guestCount} adult{guestCount === 1 ? "" : "s"}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Children</span>
        <select name="children" value={children} onChange={(event) => setChildren(Number(event.target.value))} required>
          {Array.from({ length: 4 }, (_, index) => index).map((childCount) => (
            <option key={childCount} value={childCount}>
              {childCount} child{childCount === 1 ? "" : "ren"}
            </option>
          ))}
        </select>
        <small>Maximum occupancy: 6 adults plus 3 children.</small>
      </label>
      <input type="hidden" name="guests" value={guests} />
      <p className={styles.note}>Current rate: {pricing ? formatPhpMinor(pricing.wholeCondoNightlyRateMinor) : "the configured rate"}/night. A {pricing ? formatPricingPercent(pricing.downPaymentPercent) : "configured"} down payment secures the accommodation balance, and the separate {pricing ? formatPhpMinor(pricing.refundableSecurityDepositMinor) : "refundable security deposit"} is due upon check-in on that day. Free street parking is listed on Airbnb; ask Rechel about arrival details when you send your request.</p>
      <BookingPriceReceipt checkIn={checkIn} checkOut={checkOut} guests={guests} adults={adults} childCount={children} bedroomChoice="both_bedrooms" parkingType="none" pricing={pricing} />
    </>
  );
}
