"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { propertyProfile } from "@/lib/property";
import { useSavedBooking } from "../BookingMemory";

const subscribe = () => () => {};

export function DeviceBookingStatus() {
  const router = useRouter();
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const booking = useSavedBooking();

  useEffect(() => {
    if (ready && booking) router.replace(booking.url);
  }, [booking, ready, router]);

  if (!ready || booking) {
    return (
      <section className="booking-status-result" aria-live="polite">
        <p className="eyebrow">Checking this device</p>
        <h2>{booking ? "Booking found—opening your private status…" : "Looking for your saved booking…"}</h2>
        {booking ? <div className="booking-status-result-actions"><Link href={booking.url}>Open booking now</Link></div> : null}
      </section>
    );
  }

  return (
    <section className="booking-status-result" aria-live="polite">
      <p className="eyebrow">No saved booking on this device</p>
      <h2>We could not find a private booking link in this browser.</h2>
      <p>
        Use the same phone and browser where the booking was submitted. If you
        changed devices, cleared browser data, or booked in private mode,
        contact Rechel’s Place so staff can assist you securely.
      </p>
      <div className="booking-status-result-actions">
        <a href={propertyProfile.messengerUrl} target="_blank" rel="noreferrer">Message Rechel’s Place</a>
        <a href={`tel:${propertyProfile.phoneHref}`}>Call {propertyProfile.phoneDisplay}</a>
        <Link href="/#availability">Start a new booking</Link>
      </div>
    </section>
  );
}
