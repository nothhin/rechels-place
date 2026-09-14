"use client";

import { useState } from "react";
import BookingPriceReceipt from "../BookingPriceReceipt";
import styles from "./book.module.css";

type BookingPriceFieldsProps = {
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialGuests?: string;
};

export default function BookingPriceFields({
  initialCheckIn = "",
  initialCheckOut = "",
  initialGuests = "2",
}: BookingPriceFieldsProps) {
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [guests, setGuests] = useState(() => Math.min(6, Math.max(1, Number(initialGuests) || 2)));

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
            <small>2 bedrooms · 5 beds · 2.5 baths · Up to 6 guests</small>
          </span>
          <b>Ask host</b>
        </div>
      </fieldset>
      <label>
        <span>Number of guests</span>
        <select name="guests" value={guests} onChange={(event) => setGuests(Number(event.target.value))} required>
          {Array.from({ length: 6 }, (_, index) => index + 1).map((guestCount) => (
            <option key={guestCount} value={guestCount}>
              {guestCount} guest{guestCount === 1 ? "" : "s"}
            </option>
          ))}
        </select>
        <small>Current Airbnb listing capacity: up to 6 guests.</small>
      </label>
      <p className={styles.note}>Free street parking is listed on Airbnb. Ask the host about parking, early arrival, and late checkout when you send your request.</p>
      <BookingPriceReceipt checkIn={checkIn} checkOut={checkOut} guests={guests} bedroomChoice="both_bedrooms" parkingType="none" />
    </>
  );
}
