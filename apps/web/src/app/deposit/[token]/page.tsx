import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  hashDepositToken,
  isValidDepositToken,
} from "@/lib/server/deposit-token";
import { createPublicSupabaseClient } from "@/lib/supabase/public-server";
import { propertyProfile } from "@/lib/property";
import { MessengerReceiptLink } from "../../MessengerReceiptLink";
import { ForgetBookingIfMatches, RememberBooking } from "../../BookingMemory";
import { BookingReferenceCard } from "../../BookingReferenceCard";
import { formatStayDate, formatStayRange } from "@/lib/date-format";
import styles from "./deposit.module.css";
import BookingPriceReceipt from "../../BookingPriceReceipt";
import { LiveRouteRefresh } from "../../LiveRouteRefresh";
import { GuestCountEditor } from "./GuestCountEditor";
import { DeviceStatusAlerts } from "./DeviceStatusAlerts";
import { submitDepositReference } from "./actions";

export const metadata: Metadata = {
  title: "Payment details | Rechel's Place",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function DepositPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{
    submitted?: string;
    error?: string;
    reference?: string;
  }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  if (!isValidDepositToken(token)) return <InvalidDepositLink token={token} />;
  const supabase = createPublicSupabaseClient();
  if (!supabase) throw new Error("Deposit service is unavailable.");
  const { data, error } = await supabase.rpc("get_snowaz_deposit_request", {
    token_hash: hashDepositToken(token),
  });
  if (error) throw new Error("Deposit service is unavailable.");
  const row = Array.isArray(data) ? data[0] : null;
  const request = row
    ? {
        fullName: row.full_name as string,
        email: (row.email as string | null) ?? "",
        phone: row.phone as string,
        bookingReference: row.booking_reference as string,
        checkIn: row.check_in as string,
        checkOut: row.check_out as string,
        guestCount: row.guest_count as number,
        bedroomChoice: row.bedroom_choice as string,
        parkingType: row.parking_type as "none" | "car" | "motorcycle",
        earlyCheckInHours: Number(row.early_check_in_hours ?? 0),
        lateCheckoutHours: Number(row.late_checkout_hours ?? 0),
        bookingStatus: row.booking_status as string,
        depositStatus: row.deposit_status as string,
        downPaymentAmountMinor: Number(
          row.down_payment_amount_minor ?? Math.ceil(Number(row.total_minor) / 2),
        ),
        securityDepositAmountMinor: Number(row.deposit_amount_minor ?? 100_000),
        depositTokenExpiresAt: row.deposit_token_expires_at
          ? new Date(row.deposit_token_expires_at as string)
          : null,
      }
    : null;
  if (
    !request ||
    !request.depositTokenExpiresAt ||
    request.depositTokenExpiresAt <= new Date()
  )
    return <InvalidDepositLink token={token} />;
  const finished = [
    "submitted",
    "verified",
    "refund_pending",
    "refunded",
    "partially_withheld",
    "forfeited",
  ].includes(request.depositStatus);
  const bookingReference = request.bookingReference || (/^[A-Z]+-[A-Z0-9]{8}$/.test(query.reference ?? "") ? query.reference : undefined);
  return (
    <main className={styles.shell}>
      <LiveRouteRefresh />
      <header>
        <Link href="/">Rechel’s Place</Link>
        <span>Live private booking status</span>
      </header>
      <article className={styles.card}>
        <RememberBooking
          booking={{
            url: `/deposit/${token}${bookingReference ? `?reference=${bookingReference}` : ""}`,
            reference: bookingReference,
            checkIn: request.checkIn,
            checkOut: request.checkOut,
          }}
        />
        <p className={styles.eyebrow}>Approved booking request</p>
        <h1>
          {finished
            ? request.depositStatus === "refunded"
              ? "Down payment refunded."
              : "Payment details received."
            : "Secure your stay."}
        </h1>
        {bookingReference ? (
          <BookingReferenceCard reference={bookingReference} />
        ) : null}
        <div className={styles.booking}>
          <strong>{request.fullName}</strong>
          <span>
            {formatStayRange(request.checkIn, request.checkOut)} ·{" "}
            {request.guestCount} guest{request.guestCount === 1 ? "" : "s"}
          </span>
        </div>
        <DeviceStatusAlerts status={request.depositStatus} />
        {!finished ? (
          <GuestCountEditor
            token={token}
            checkIn={request.checkIn}
            checkOut={request.checkOut}
            initialGuests={request.guestCount}
            initialBedroom={request.bedroomChoice}
            initialParking={request.parkingType}
            initialEarlyCheckInHours={request.earlyCheckInHours}
            initialLateCheckoutHours={request.lateCheckoutHours}
            bookingReference={bookingReference}
            customerName={request.fullName}
            customerEmail={request.email}
            customerPhone={request.phone}
            bookingStatus={request.bookingStatus}
            paymentStatus={request.depositStatus}
          />
        ) : (
          <BookingPriceReceipt
            checkIn={request.checkIn}
            checkOut={request.checkOut}
            guests={request.guestCount}
            bedroomChoice={request.bedroomChoice as "bedroom_1" | "bedroom_2" | "both_bedrooms"}
            parkingType={request.parkingType}
            earlyCheckInHours={request.earlyCheckInHours}
            lateCheckoutHours={request.lateCheckoutHours}
            bookingReference={bookingReference}
            customerName={request.fullName}
            customerEmail={request.email}
            customerPhone={request.phone}
            bookingStatus={request.bookingStatus}
            paymentStatus={request.depositStatus}
            downPaymentMinor={request.downPaymentAmountMinor}
            refundableSecurityDepositMinor={request.securityDepositAmountMinor}
          />
        )}
        {finished ? (
          <section className={styles.complete}>
            <span aria-hidden="true">✓</span>
            <h2>
              {request.depositStatus === "verified"
                ? "Down payment verified—your booking is confirmed."
                : request.depositStatus === "refund_pending"
                  ? "Your cancellation is recorded and the refund is being processed."
                  : request.depositStatus === "refunded"
                    ? "Your payment refund has been recorded."
                    : "Rechel’s Place is verifying your transfer."}
            </h2>
            <p>
              Keep your bank receipt. Rechel’s Place will contact you directly if any
              additional information is needed.
            </p>
          </section>
        ) : (
          <>
            <section className={styles.instructions}>
              <h2>Pay the 50% down payment</h2>
              <ol>
                <li>Review your stay total and 50% down payment in the receipt above.</li>
                <li>Scan the GCash/InstaPay QR below and send only the 50% down payment. Transfer fees may apply.</li>
                <li>The ₱1,000 refundable security deposit is separate and is due upon check-in on your check-in day. Do not include it in this transfer.</li>
                <li>Keep your receipt, then submit the sender name and transaction reference below.</li>
              </ol>
              <p>
                Never share your PIN, OTP, password, or full banking credentials
                with Rechel’s Place.
              </p>
            </section>
            <div className={styles.qr}>
              <Image
                src="/images/rechel-s-place/gcash-payment-qr.png"
                alt="GCash and InstaPay payment QR code for Rechel’s Place"
                width={1024}
                height={2048}
                sizes="(max-width: 560px) calc(100vw - 64px), 430px"
              />
              <a
                className={styles.downloadQr}
                href="/images/rechel-s-place/gcash-payment-qr.png"
                download
              >
                Download payment QR
              </a>
            </div>
            <section className={styles.proofOptions}>
              <p className={styles.eyebrow}>Submit payment proof</p>
              <div className={styles.proofGrid}>
                <article>
                  <span>GCash/InstaPay receipt</span>
                  <h2>Tell us who sent the payment</h2>
                  <p>
                    Enter the sender name and transaction reference exactly as
                    shown on your receipt. Rechel’s Place will verify the 50%
                    down payment before confirming your stay.
                  </p>
                  <form className={styles.form} action={submitDepositReference}>
                    <input type="hidden" name="token" value={token} />
                    {query.error === "invalid" ? (
                      <p className={styles.error} role="alert">
                        Enter the sender name and transaction reference from your payment receipt.
                      </p>
                    ) : null}
                    <label>
                      <span>Sender/account name</span>
                      <input
                        name="senderName"
                        required
                        minLength={2}
                        maxLength={120}
                        autoComplete="name"
                      />
                    </label>
                    <label>
                      <span>Transaction reference</span>
                      <input name="reference" required minLength={6} maxLength={80} />
                    </label>
                    <button type="submit">Submit payment details</button>
                  </form>
                  <p>
                    Prefer Messenger? Attach a clear GCash/InstaPay receipt
                    screenshot there after copying the prepared message.
                  </p>
                  <MessengerReceiptLink
                    className={styles.messengerAction}
                    label="Copy message and open Messenger"
                    message={`Hello Rechel’s Place! I am ${request.fullName}. I paid the 50% down payment for my stay on ${formatStayDate(request.checkIn)} to ${formatStayDate(request.checkOut)}. I am attaching my GCash/InstaPay receipt for verification.`}
                  />
                </article>
              </div>
            </section>
          </>
        )}
        <footer id="cancellation-help">
          <p>
            This private link becomes read-only after payment and expires 30
            days after checkout or a completed refund. Save your booking
            reference for future status checks.
          </p>
          <MessengerReceiptLink
            className={styles.messengerAction}
            label="Request cancellation or payment help in Messenger"
            message={`Hello Rechel’s Place! I am ${request.fullName}. I would like help cancelling my stay on ${formatStayDate(request.checkIn)} to ${formatStayDate(request.checkOut)}. Please confirm the next steps and any applicable payment refund.`}
          />
          <div className={styles.helpActions}>
            <a
              href={propertyProfile.messengerUrl}
              target="_blank"
              rel="noreferrer"
            >
              Need help? Open Messenger
            </a>
            <a href={`tel:${propertyProfile.phoneHref}`}>
              Call {propertyProfile.phoneDisplay}
            </a>
          </div>
        </footer>
      </article>
    </main>
  );
}

function InvalidDepositLink({ token }: { token: string }) {
  return (
    <main className={styles.shell}>
      <article className={styles.card}>
        <ForgetBookingIfMatches url={`/deposit/${token}`} />
        <p className={styles.eyebrow}>Private link unavailable</p>
        <h1>This private link has expired.</h1>
        <p>
          This device no longer has an active private status link. Contact
          Rechel’s Place before sending money or starting another request.
        </p>
        <Link className={styles.helpLink} href="/booking-status">
          Check booking status
        </Link>
      </article>
    </main>
  );
}
