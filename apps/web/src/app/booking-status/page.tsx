import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { propertyLogoSrc, propertyProfile } from "@/lib/property";
import { DeviceBookingStatus } from "./DeviceBookingStatus";

export const metadata: Metadata = {
  title: "Check booking status | Rechel's Place",
  robots: { index: false, follow: false },
};
export default function BookingStatusPage() {
  return (
    <main className="booking-status-shell">
      <header>
        <Link href="/" className="booking-status-brand"><Image src={propertyLogoSrc} alt="" width={46} height={46} /><span>Rechel’s Place</span></Link>
        <span>Private status on this device</span>
      </header>
      <article className="booking-status-card">
        <div className="booking-status-intro">
          <p className="eyebrow">Your saved booking</p>
          <h1>No reference number needed.</h1>
          <p>
            Rechel’s Place remembers the private booking link in the browser used to
            submit your request and opens your live status automatically.
          </p>
          <aside>
            <strong>Saved only on this device</strong>
            <span>
              It does not sync to another phone or browser. Clearing browser
              data or using private browsing removes the saved link.
            </span>
          </aside>
        </div>
        <DeviceBookingStatus />
        <footer className="booking-status-footer">
          <a
            href={propertyProfile.messengerUrl}
            target="_blank"
            rel="noreferrer"
          >
            Need help? Open Messenger
          </a>
          <Link href="/">Return to availability</Link>
        </footer>
      </article>
    </main>
  );
}
