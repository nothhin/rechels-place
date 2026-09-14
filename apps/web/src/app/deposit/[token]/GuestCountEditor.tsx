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
  const [guests, setGuests] = useState(Math.min(6, Math.max(1, initialGuests)));
  const router = useRouter();
  const [state, action, pending] = useActionState(updatePendingGuestCount, initialState);

  useEffect(() => {
    if (state.status === "success") {
      void showSuccess(state.message);
      router.refresh();
    }
    if (state.status === "error") void showError(state.message);
  }, [router, state]);

  return (
    <section className={styles.guestEditor}>
      <div>
        <p className={styles.eyebrow}>Review before paying</p>
        <h2>Need to correct the number of guests?</h2>
        <p>Update it now and your reference total will recalculate automatically.</p>
      </div>
      <form action={action}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="bedroom" value="both_bedrooms" />
        <input type="hidden" name="parkingType" value="none" />
        <input type="hidden" name="earlyCheckInHours" value="0" />
        <input type="hidden" name="lateCheckoutHours" value="0" />
        <label>
          <span>Number of guests</span>
          <select name="guests" value={guests} onChange={(event) => setGuests(Number(event.target.value))}>
            {Array.from({ length: 6 }, (_, index) => index + 1).map((count) => (
              <option key={count} value={count}>
                {count} guest{count === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.editorNote}>
          <strong>Entire two-bedroom condo</strong>
          <span>2 bedrooms · 5 beds · 2.5 baths · Up to 6 guests</span>
          <span>Free street parking is listed on Airbnb. Ask Rechel to confirm building and arrival details.</span>
        </div>
        <button disabled={pending}>{pending ? "Updating…" : "Update guests and total"}</button>
      </form>
      <BookingPriceReceipt
        checkIn={checkIn}
        checkOut={checkOut}
        guests={guests}
        bedroomChoice="both_bedrooms"
        parkingType="none"
        bookingReference={bookingReference}
        customerName={customerName}
        customerEmail={customerEmail}
        customerPhone={customerPhone}
        bookingStatus={bookingStatus}
        paymentStatus={paymentStatus}
      />
      <small>Changes are allowed only before payment details or a receipt are submitted.</small>
    </section>
  );
}
