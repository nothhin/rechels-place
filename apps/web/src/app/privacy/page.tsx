import type { Metadata } from "next";
import Link from "next/link";
import { propertyProfile } from "@/lib/property";

export const metadata: Metadata = {
  title: "Privacy Notice | Rechel's Place",
  description:
    "How Rechel's Place handles guest and booking-request information.",
};

export default function PrivacyPage() {
  return (
    <main className="legal-shell">
      <header className="legal-header">
        <Link href="/">Rechel’s Place</Link>
        <Link href="/#availability">Back to availability</Link>
      </header>
      <article className="legal-content">
        <p className="eyebrow">Guest data and privacy</p>
        <h1>Privacy Notice</h1>
        <p className="legal-updated">
          Effective and last updated: August 10, 2026
        </p>
        <section>
          <h2>Who is responsible for your information?</h2>
          <p>
            Rechel’s Place is responsible for the guest information submitted
            through this website. You may contact us through{" "}
            <a href={propertyProfile.facebookUrl} target="_blank" rel="noreferrer">
              Facebook Messenger
            </a>
            , or at {propertyProfile.address}.
          </p>
        </section>
        <section>
          <h2>Information we collect</h2>
          <p>
            When you send a booking request, we collect your selected check-in
            and check-out dates, number of guests, full name, required contact
            number, optional email address, optional special requests, and a
            record of your consent. During the payment-proof step, we also
            collect the sender name, transaction reference, payment status,
            verification time, and any applicable refund reference. The
            separate ₱1,000 security deposit is due at check-in and is not
            collected through this payment page.
            We do not collect your PIN, OTP, password, account balance, or full
            banking credentials. Our hosting and database services may also
            process limited technical and security records needed to operate and
            protect the website.
          </p>
        </section>
        <section>
          <h2>Why we use it</h2>
          <ul>
            <li>To check availability and respond to your booking inquiry.</li>
            <li>
              To contact you about rates, bedroom access, house rules, arrival
              arrangements, and offline payment instructions.
            </li>
            <li>
              To prevent duplicate requests, misuse, or security incidents.
            </li>
            <li>
              To maintain records required for legitimate business or legal
              obligations.
            </li>
          </ul>
          <p>
            Submitting the form is an inquiry and does not confirm a
            reservation. This website does not collect card, bank-account, or
            direct online-payment details.
          </p>
        </section>
        <section>
          <h2>Who may receive it?</h2>
          <p>
            Access is limited to authorized Rechel’s Place personnel and service
            providers that help operate the booking site: Supabase for database
            services and Vercel for website hosting. FormSubmit may process
            booking-notification email details if that notification feature is
            configured. These providers may process information outside the
            Philippines using their infrastructure and safeguards.
          </p>
        </section>
        <section>
          <h2>Sharing, selling, and marketing</h2>
          <p>
            Rechel’s Place does not sell guest information. We do not use
            booking-request details for advertising or marketing without first
            reviewing the purpose, legal basis, notice, and any required
            consent. We may disclose information when legally required or when
            reasonably necessary to protect guests, Rechel’s Place, or the property.
          </p>
        </section>
        <section>
          <h2>Security and public availability</h2>
          <p>
            We use access controls, private random payment links, and database
            row-level security to limit public access. The availability calendar
            exposes stay dates and their booking status only; it does not
            display guest names, contact details, payment references, or special
            requests. No internet service can be guaranteed completely secure,
            but we limit collection and access to what the booking process
            needs.
          </p>
        </section>
        <section>
          <h2>How long we keep it</h2>
          <p>
            We retain information only for as long as needed to handle the
            inquiry or stay, maintain appropriate booking and business records,
            resolve disputes, and meet legal obligations. Rechel’s Place is finalizing
            its documented retention schedule. You may request deletion, subject
            to records that must be retained for legitimate or legal reasons.
          </p>
        </section>
        <section>
          <h2>Your privacy rights</h2>
          <p>
            Subject to Philippine law, you may ask to be informed about
            processing, access or correct your information, object to or
            withdraw consent for consent-based processing, request erasure or
            blocking where applicable, and raise a complaint with the National
            Privacy Commission. Contact Rechel’s Place first using the details above so
            we can verify and respond to your request.
          </p>
        </section>
        <section>
          <h2>Bookings involving minors</h2>
          <p>
            A booking request should be submitted by a person authorized to
            arrange the stay. If information about a minor was submitted without
            appropriate authority, contact us so we can review or remove it
            where appropriate.
          </p>
        </section>
        <section>
          <h2>Changes to this notice</h2>
          <p>
            We may update this notice when the booking process, service
            providers, or legal requirements change. The updated date at the top
            will show the latest revision. See our{" "}
            <Link href="/cookies">Cookie Notice</Link> for website storage and
            tracking information.
          </p>
        </section>
      </article>
    </main>
  );
}
