"use client";

import { useState } from "react";
import BookingPriceReceipt from "../BookingPriceReceipt";
import { showError } from "@/lib/sweetalert";
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
  const [guests, setGuests] = useState(() => Number(initialGuests) || 2);
  const [bedroomChoice, setBedroomChoice] = useState("bedroom_1");
  const [parkingType, setParkingType] = useState("none");
  const [earlyCheckInHours, setEarlyCheckInHours] = useState(0);
  const [lateCheckoutHours, setLateCheckoutHours] = useState(0);

  return (
    <>
      <div className={styles.grid}>
        <label>
          <span>Check-in</span>
          <input
            name="checkIn"
            type="date"
            value={checkIn}
            onChange={(event) => setCheckIn(event.target.value)}
            required
          />
        </label>
        <label>
          <span>Check-out</span>
          <input
            name="checkOut"
            type="date"
            value={checkOut}
            onChange={(event) => setCheckOut(event.target.value)}
            required
          />
        </label>
      </div>
      <fieldset className={styles.roomChoice}>
        <legend>Choose your stay</legend>
        {[{ value: "bedroom_1", title: "Master bedroom", detail: "Queen-size comfort bed · Up to 2 guests", rate: "₱1,700 / night" }, { value: "bedroom_2", title: "Double-size bunk room", detail: "2 guests ₱1,700 · 3 guests ₱1,950 · 4 guests ₱2,100 · +₱250 per guest after 4", rate: "From ₱1,700 / night" }].map((room) => <label key={room.value} className={bedroomChoice === room.value ? styles.roomChoiceActive : undefined}><input type="radio" name="bedroomChoice" value={room.value} checked={bedroomChoice === room.value} onChange={(event) => setBedroomChoice(event.target.value)} /><span><strong>{room.title}</strong><small>{room.detail}</small></span><b>{room.rate}</b></label>)}
      </fieldset>
      <label>
        <span>Number of guests</span>
        <select
          name="guests"
          value={guests}
          onChange={(event) => { const next = Number(event.target.value); setGuests(next); if (next > 2 && bedroomChoice === "bedroom_1") { setBedroomChoice("bedroom_2"); void showError("The Master bedroom accommodates a maximum of 2 guests. We switched you to the Second bedroom (double-size bunk bed)."); } }}
          required
        >
          {Array.from({ length: 6 }, (_, index) => index + 1).map(
            (guestCount) => (
              <option key={guestCount} value={guestCount}>
                {guestCount} guest{guestCount === 1 ? "" : "s"}
              </option>
            ),
          )}
        </select>
        <small>The host will confirm the allowed occupancy and final rate.</small>
      </label>
      <label>
        <span>Parking (optional)</span>
        <select name="parkingType" value={parkingType} onChange={(event) => setParkingType(event.target.value)}>
          <option value="none">No parking</option>
          <option value="car">Car parking · ₱350 / night</option>
          <option value="motorcycle">Motorcycle parking · ₱150 / night</option>
        </select>
      </label>
      <div className={styles.grid}>
        <label><span>Early check-in (optional)</span><select name="earlyCheckInHours" value={earlyCheckInHours} onChange={(event) => setEarlyCheckInHours(Number(event.target.value))}><option value={0}>No early check-in</option>{[1,2,3,4,5].map((hour) => <option key={hour} value={hour}>{hour} hour{hour === 1 ? "" : "s"} early · ₱{hour * 150}</option>)}</select></label>
        <label><span>Late checkout (optional)</span><select name="lateCheckoutHours" value={lateCheckoutHours} onChange={(event) => setLateCheckoutHours(Number(event.target.value))}><option value={0}>No late checkout</option>{[1,2,3,4,5].map((hour) => <option key={hour} value={hour}>{hour} hour{hour === 1 ? "" : "s"} late · ₱{hour * 150}</option>)}</select></label>
      </div>
      <BookingPriceReceipt checkIn={checkIn} checkOut={checkOut} guests={guests} bedroomChoice={bedroomChoice as "bedroom_1" | "bedroom_2"} parkingType={parkingType as "none" | "car" | "motorcycle"} earlyCheckInHours={earlyCheckInHours} lateCheckoutHours={lateCheckoutHours} />
    </>
  );
}
