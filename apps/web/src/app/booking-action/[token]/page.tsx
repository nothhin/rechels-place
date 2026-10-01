import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { verifyBookingEmailActionToken } from "@/lib/server/booking-email-action-token";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatStayRange } from "@/lib/date-format";
import { propertyLogoSrc, propertyProfile } from "@/lib/property";
import styles from "./booking-action.module.css";

export const metadata: Metadata = {
  title: "Review booking request | Rechel's Place",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const resultCopy: Record<string, { title: string; body: string }> = {
  accepted: {
    title: "Request accepted for payment",
    body: "The guest’s private page now shows that the request was accepted. The stay is not confirmed until the down payment is verified.",
  },
  declined: {
    title: "Request declined",
    body: "The guest and admin views now show the declined request, and its dates have been released.",
  },
  already_accepted: {
    title: "Already accepted",
    body: "This request was already accepted for payment. No duplicate change was made.",
  },
  already_declined: {
    title: "Already declined",
    body: "This request was already declined. No duplicate change was made.",
  },
  unavailable: {
    title: "Decision no longer available",
    body: "The booking has moved to another status, so this email action cannot change it.",
  },
  error: {
    title: "Decision was not saved",
    body: "Please open the admin dashboard and review the request there before trying again.",
  },
};

export default async function BookingActionPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ result?: string }>;
}) {
  const { token } = await params;
  const { result } = await searchParams;
  const payload = verifyBookingEmailActionToken(token);
  if (!payload) return <Unavailable />;

  const admin = createSupabaseAdminClient();
  const { data: booking, error } = await admin
    .from("booking_requests")
    .select("id,full_name,check_in,check_out,status")
    .eq("id", payload.bookingId)
    .maybeSingle();
  if (error || !booking) return <Unavailable />;

  const reference = `RECHEL-${booking.id.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
  const completed = result ? resultCopy[result] : null;
  const isAccept = payload.decision === "accept";
  const currentStatus = String(booking.status);
  const actionable = currentStatus === "pending";

  return (
    <main className={styles.shell}>
      <article className={styles.card}>
        <header className={styles.brand}>
          <Image src={propertyLogoSrc} alt="" width={58} height={58} priority />
          <div><strong>Rechel’s Place</strong><span>Secure booking decision</span></div>
        </header>

        {completed ? (
          <section className={styles.result} role="status">
            <span className={styles.resultMark} aria-hidden="true">✓</span>
            <p className={styles.eyebrow}>Update complete</p>
            <h1>{completed.title}</h1>
            <p>{completed.body}</p>
          </section>
        ) : (
          <>
            <p className={styles.eyebrow}>{isAccept ? "Accept request" : "Decline request"}</p>
            <h1>{isAccept ? "Approve this guest to continue?" : "Decline this booking request?"}</h1>
            <p className={styles.lead}>
              {isAccept
                ? "This lets the guest proceed with the payment instructions. It does not mark the booking as paid or confirmed."
                : "This releases the requested dates. The guest will see that the request was declined."}
            </p>
          </>
        )}

        <dl className={styles.summary}>
          <div><dt>Booking</dt><dd>{reference}</dd></div>
          <div><dt>Guest</dt><dd>{booking.full_name}</dd></div>
          <div><dt>Stay</dt><dd>{formatStayRange(booking.check_in, booking.check_out)}</dd></div>
          <div><dt>Current status</dt><dd><span className={styles.status}>{currentStatus.replaceAll("_", " ")}</span></dd></div>
        </dl>

        {!completed && actionable ? (
          <form action="/api/booking-action" method="post" className={styles.actions}>
            <input type="hidden" name="token" value={token} />
            <button className={isAccept ? styles.accept : styles.decline} type="submit">
              {isAccept ? "Yes, accept request" : "Yes, decline request"}
            </button>
            <Link href="/admin">Cancel and open admin</Link>
          </form>
        ) : null}

        {!completed && !actionable ? (
          <p className={styles.notice} role="status">This request can no longer be changed from this email. Open the admin dashboard to review its current status.</p>
        ) : null}

        {completed ? <Link className={styles.adminLink} href="/admin">Open admin dashboard</Link> : null}
        <footer>Signed link for {propertyProfile.shortName}. Never forward this email.</footer>
      </article>
    </main>
  );
}

function Unavailable() {
  return (
    <main className={styles.shell}>
      <article className={styles.card}>
        <p className={styles.eyebrow}>Secure link unavailable</p>
        <h1>This booking action link is invalid or expired.</h1>
        <p className={styles.lead}>No booking was changed. Open the admin dashboard to review pending requests safely.</p>
        <Link className={styles.adminLink} href="/admin">Open admin dashboard</Link>
      </article>
    </main>
  );
}
