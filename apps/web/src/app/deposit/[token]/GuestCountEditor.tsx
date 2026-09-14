"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BookingPriceReceipt from "../../BookingPriceReceipt";
import { showError, showSuccess } from "@/lib/sweetalert";
import { updatePendingGuestCount, type GuestCountState } from "./actions";
import styles from "./deposit.module.css";

const initialState: GuestCountState = { status: "idle", message: "" };

export function GuestCountEditor({
  token,
  checkIn,
  checkOut,
  initialGuests,
  initialBedroom,
  initialParking,
  initialEarlyCheckInHours,
  initialLateCheckoutHours,
  bookingReference,
  customerName,
  customerEmail,
  customerPhone,
  bookingStatus,
  paymentStatus,
}: {
  token: string;
  checkIn: string;
  checkOut: string;
  initialGuests: number;
  initialBedroom: string;
  initialParking: "none" | "car" | "motorcycle";
  initialEarlyCheckInHours: number;
  initialLateCheckoutHours: number;
  bookingReference?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  bookingStatus: string;
  paymentStatus: string;
}) {
  const [guests, setGuests] = useState(initialGuests);
  const [bedroom, setBedroom] = useState(initialBedroom);
  const [parkingType, setParkingType] = useState(initialParking);
  const [earlyCheckInHours, setEarlyCheckInHours] = useState(initialEarlyCheckInHours);
  const [lateCheckoutHours, setLateCheckoutHours] = useState(initialLateCheckoutHours);
  const router = useRouter();
  const [state, action, pending] = useActionState(
    updatePendingGuestCount,
    initialState,
  );
  useEffect(() => {
    if (state.status === "success") {
      void showSuccess(state.message);
      router.refresh();
    }
    if (state.status === "error") void showError(state.message);
  }, [router, state]);
  const chooseGuests = (value: number) => {
    setGuests(value);
    if (value > 2 && bedroom === "bedroom_1") {
      setBedroom("bedroom_2");
      void showError(
        "The Master bedroom can accommodate a maximum of 2 guests. We switched your selection to the Second bedroom (bunk bed).",
      );
    }
  };
  const chooseBedroom = (value: string) => {
    setBedroom(value);
    if (value === "bedroom_1" && guests > 2) {
      setBedroom("bedroom_2");
      void showError(
        "The Master bedroom can accommodate a maximum of 2 guests. We switched your selection back to the Second bedroom (bunk bed).",
      );
    }
  };
  return (
    <section className={styles.guestEditor}>
      <div>
        <p className={styles.eyebrow}>Review before paying</p>
        <h2>Need to correct the number of guests?</h2>
        <p>Update it now and your total will recalculate automatically.</p>
      </div>
      <form action={action}>
        <input type="hidden" name="token" value={token} />
        <label>
          <span>Overnight parking</span>
          <select
            name="parkingType"
            value={parkingType}
            onChange={(event) =>
              setParkingType(event.target.value as typeof parkingType)
            }
          >
            <option value="none">No parking</option>
            <option value="car">Car — ₱350/night</option>
            <option value="motorcycle">Motorcycle — ₱150/night</option>
          </select>
        </label>
        <label>
          <span>Number of guests</span>
          <select
            name="guests"
            value={guests}
            onChange={(event) => chooseGuests(Number(event.target.value))}
          >
            {Array.from({ length: 6 }, (_, index) => index + 1).map((count) => (
              <option key={count} value={count}>
                {count} guest{count === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Bedroom selection</span>
          <select name="bedroom" value={bedroom} onChange={(event) => chooseBedroom(event.target.value)}>
            <option value="bedroom_1">Master bedroom — up to 2 guests</option>
            <option value="bedroom_2">Second bedroom — Double-size bunk bed</option>
          </select>
        </label>
        <fieldset className={styles.extraTimeFields}>
          <legend>Optional Extra Time</legend>
          <p>Regular check-in is 2:00 PM and checkout is 11:00 AM. Optional time is ₱150/hour, subject to host availability.</p>
          <label><span>Early check-in</span><select name="earlyCheckInHours" value={earlyCheckInHours} onChange={(event) => setEarlyCheckInHours(Number(event.target.value))}><option value={0}>None</option>{[1,2,3,4,5].map((hour) => <option key={hour} value={hour}>{hour} hour{hour===1?"":"s"} early · {14-hour}:00 · ₱{hour*150}</option>)}</select></label>
          <label><span>Late checkout</span><select name="lateCheckoutHours" value={lateCheckoutHours} onChange={(event) => setLateCheckoutHours(Number(event.target.value))}><option value={0}>None</option>{[1,2,3,4,5].map((hour) => <option key={hour} value={hour}>{hour} hour{hour===1?"":"s"} late · {11+hour}:00 · ₱{hour*150}</option>)}</select></label>
        </fieldset>
        <button disabled={pending}>
          {pending ? "Updating…" : "Update guests and total"}
        </button>
      </form>
      <BookingPriceReceipt
        checkIn={checkIn}
        checkOut={checkOut}
        guests={guests}
        bedroomChoice={bedroom as "bedroom_1" | "bedroom_2" | "both_bedrooms"}
        parkingType={parkingType}
        earlyCheckInHours={earlyCheckInHours}
        lateCheckoutHours={lateCheckoutHours}
        bookingReference={bookingReference}
        customerName={customerName}
        customerEmail={customerEmail}
        customerPhone={customerPhone}
        bookingStatus={bookingStatus}
        paymentStatus={paymentStatus}
      />
      <small>
        Changes are allowed only before payment details or a receipt are
        submitted.
      </small>
    </section>
  );
}
