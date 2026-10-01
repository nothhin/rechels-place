"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { RechelsPricingConfig } from "@uppadar-hollie/shared/pricing";
import BookingPriceReceipt from "../../BookingPriceReceipt";
import type { BookingPriceSnapshot } from "../../BookingPriceReceipt";
import { showError, showSuccess } from "@/lib/sweetalert";
import { updatePendingGuestCount, type GuestCountState } from "./actions";
import styles from "./deposit.module.css";

const initialState: GuestCountState = { status: "idle", message: "" };

export function GuestCountEditor({
  token,
  checkIn,
  checkOut,
  initialAdults,
  initialChildren,
  bookingReference,
  customerName,
  customerEmail,
  customerPhone,
  bookingStatus,
  paymentStatus,
  pricing,
  bookingSnapshot,
}: {
  token: string;
  checkIn: string;
  checkOut: string;
  initialAdults: number;
  initialChildren: number;
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
  pricing: RechelsPricingConfig | null;
  bookingSnapshot: BookingPriceSnapshot;
}) {
  const [adults, setAdults] = useState(Math.min(6, Math.max(1, initialAdults)));
  const [children, setChildren] = useState(Math.min(3, Math.max(0, initialChildren)));
  const guests = adults + children;
  const router = useRouter();
  const [state, action, pending] = useActionState(updatePendingGuestCount, initialState);
  const unchanged = adults === initialAdults && children === initialChildren;
  const previewSnapshot = unchanged ? bookingSnapshot : undefined;

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
          <span>Adults</span>
          <select name="adults" value={adults} onChange={(event) => setAdults(Number(event.target.value))}>
            {Array.from({ length: 6 }, (_, index) => index + 1).map((count) => (
              <option key={count} value={count}>
                {count} adult{count === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Children</span>
          <select name="children" value={children} onChange={(event) => setChildren(Number(event.target.value))}>
            {Array.from({ length: 4 }, (_, index) => index).map((count) => (
              <option key={count} value={count}>
                {count} child{count === 1 ? "" : "ren"}
              </option>
            ))}
          </select>
        </label>
        <input type="hidden" name="guests" value={guests} />
        <div className={styles.editorNote}>
          <strong>Entire two-bedroom condo</strong>
          <span>2 bedrooms · 5 beds · 2.5 baths · Up to 6 adults + 3 children</span>
          <span>Free street parking is listed on Airbnb. Ask Rechel to confirm building and arrival details.</span>
        </div>
        <button disabled={pending || unchanged}>{pending ? "Updating…" : unchanged ? "Choose a different occupancy" : "Update occupancy"}</button>
      </form>
      <BookingPriceReceipt
        checkIn={checkIn}
        checkOut={checkOut}
        guests={guests}
        adults={adults}
        childCount={children}
        bedroomChoice="both_bedrooms"
        parkingType="none"
        bookingReference={bookingReference}
        customerName={customerName}
        customerEmail={customerEmail}
        customerPhone={customerPhone}
        bookingStatus={bookingStatus}
        paymentStatus={paymentStatus}
        pricing={pricing}
        snapshot={previewSnapshot}
      />
      <small>Changes are allowed only before payment details or a receipt are submitted.</small>
    </section>
  );
}
