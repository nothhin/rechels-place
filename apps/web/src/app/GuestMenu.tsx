"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { propertyProfile } from "@/lib/property";
import { useSavedBooking } from "./BookingMemory";

export default function GuestMenu() {
  const pathname = usePathname();
  const drawerId = useId();
  const [open, setOpen] = useState(false);
  const bookingUrl = useSavedBooking()?.url ?? null;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", closeOnEscape); };
  }, [open]);

  if (pathname.startsWith("/admin")) return null;
  const cancellationUrl = bookingUrl ? `${bookingUrl}#cancellation-help` : "/booking-status";
  const close = () => setOpen(false);

  return <>
    <button className="guest-menu-toggle" type="button" aria-label="Open guest menu" aria-expanded={open} aria-controls={drawerId} onClick={() => setOpen(true)}><span /><span /><span /></button>
    {open ? <div className="guest-menu-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <aside className="guest-menu-drawer" id={drawerId} aria-label="Guest menu">
        <header><div><small>Guest services</small><strong>Rechel’s Place</strong></div><button type="button" aria-label="Close guest menu" onClick={close}>×</button></header>
        <nav>
          <Link href="/" onClick={close}><span>01</span><div><strong>Home</strong><small>Property details and amenities</small></div></Link>
          <Link href="/#availability" onClick={close}><span>02</span><div><strong>Book available dates</strong><small>Open the live availability calendar</small></div></Link>
          {bookingUrl ? <Link href={bookingUrl} onClick={close}><span>03</span><div><strong>Continue my booking</strong><small>Open the private deposit and status page</small></div></Link> : null}
          <Link href="/booking-status" onClick={close}><span>{bookingUrl ? "04" : "03"}</span><div><strong>Check booking status</strong><small>Automatically open the booking saved on this device</small></div></Link>
          <Link href={cancellationUrl} onClick={close}><span>{bookingUrl ? "05" : "04"}</span><div><strong>Cancellation or refund</strong><small>{bookingUrl ? "Open your private assistance section" : "Check this device or contact Rechel’s Place"}</small></div></Link>
          <a href={propertyProfile.messengerUrl} target="_blank" rel="noreferrer" onClick={close}><span>{bookingUrl ? "06" : "05"}</span><div><strong>Contact Rechel’s Place</strong><small>Open Facebook Messenger</small></div></a>
        </nav>
        <footer><Link href="/privacy" onClick={close}>Privacy</Link><Link href="/cookies" onClick={close}>Cookies</Link><a href={`tel:${propertyProfile.phoneHref}`}>Call {propertyProfile.phoneDisplay}</a></footer>
      </aside>
    </div> : null}
  </>;
}
