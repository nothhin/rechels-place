"use client";

import { useState } from "react";
import { showSuccess } from "@/lib/sweetalert";

export function BookingReferenceCard({ reference }: { reference: string }) {
  const [copied, setCopied] = useState(false);
  return <section className="booking-reference-card" aria-label="Save your booking reference">
    <div><small>Optional staff reference</small><strong>{reference}</strong><p>Your status is already saved on this device. Keep this reference only in case Rechel’s Place staff asks for it while assisting you.</p></div>
    <button type="button" onClick={async () => { await navigator.clipboard.writeText(reference); setCopied(true); void showSuccess("Booking reference copied. Keep it somewhere safe."); }}>{copied ? "Reference copied" : "Copy reference"}</button>
  </section>;
}
