import type { AdminEnquiry } from "./BookingRequestsPanel";
import { formatPricingPercent } from "@uppadar-hollie/shared/pricing";
import styles from "./admin.module.css";

const php = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
const bedroomLabels = { bedroom_1: "Legacy single-bedroom record", bedroom_2: "Legacy single-bedroom record", both_bedrooms: "Entire two-bedroom condo" } as const;

export function AdminPriceReceipt({ booking }: { booking: AdminEnquiry }) {
  const downPaymentMinor = booking.downPaymentAmountMinor ?? 0;
  const securityDepositMinor = booking.securityDepositAmountMinor ?? booking.depositAmountMinor ?? 0;
  const downPaymentPercent = booking.totalMinor > 0 ? downPaymentMinor / booking.totalMinor * 100 : 0;
  const downPaymentVerified = ["verified", "refund_pending", "refunded"].includes(booking.depositStatus);
  const downPaymentStatus = downPaymentVerified
    ? "Verified and applied to the stay total"
    : booking.depositStatus === "submitted"
      ? "Submitted by guest · awaiting verification"
      : "Not yet verified";

  return <section className={styles.adminReceipt} aria-label="Booking payment summary">
    <header className={styles.adminReceiptHeader}>
      <div><strong>Payment overview</strong><small>Amounts saved with this booking</small></div>
      <span>{booking.remainingBalanceMinor === 0 && downPaymentVerified ? "Fully paid" : downPaymentVerified ? "Balance due" : "Down payment pending"}</span>
    </header>
    <div className={styles.adminReceiptOverview}>
      <div className={styles.adminReceiptMetric}><span>Stay total</span><strong>{php.format(booking.totalMinor / 100)}</strong><small>Accommodation and selected extras</small></div>
      <div className={styles.adminReceiptMetric}><span>{formatPricingPercent(downPaymentPercent)} down payment</span><strong>{php.format(downPaymentMinor / 100)}</strong><small>{downPaymentStatus}</small></div>
      <div className={`${styles.adminReceiptMetric} ${styles.adminReceiptDue}`}><span>{downPaymentVerified ? "Remaining stay balance" : "Balance after down payment"}</span><strong>{php.format(booking.remainingBalanceMinor / 100)}</strong><small>{downPaymentVerified ? booking.balancePaidMinor > 0 ? `${php.format(booking.balancePaidMinor / 100)} in later balance payments recorded` : "No later balance payments recorded" : "Due after the down payment is verified"}</small></div>
    </div>
    <div className={styles.adminReceiptDeposit}>
      <div><strong>Refundable security deposit</strong><p>Collect separately on the check-in day. It is not part of the stay total or down payment.</p></div>
      <b>{php.format(securityDepositMinor / 100)}</b>
    </div>
    <details className={styles.adminReceiptDetails}>
      <summary>View rate breakdown and booking snapshot</summary>
      <dl>
        {booking.bookingReference ? <div><dt>Booking reference</dt><dd>{booking.bookingReference}</dd></div> : null}
        <div><dt>Dates</dt><dd>{booking.checkIn} – {booking.checkOut}</dd></div>
        <div><dt>Stay</dt><dd>{booking.stayNights} night{booking.stayNights === 1 ? "" : "s"} · {booking.guestCount} guest{booking.guestCount === 1 ? "" : "s"}</dd></div>
        <div><dt>Space</dt><dd>{bedroomLabels[booking.bedroomChoice]}</dd></div>
        <div><dt>Nightly rate</dt><dd>{php.format(booking.baseNightlyRateMinor / 100)}</dd></div>
        {booking.additionalGuestCount > 0 ? <div><dt>Additional occupancy<br/><small>Host-confirmed adjustment × {booking.stayNights} night{booking.stayNights === 1 ? "" : "s"}</small></dt><dd>+{php.format(booking.additionalGuestChargeMinor / 100)}</dd></div> : null}
        {(booking.parkingChargeMinor ?? 0) > 0 ? <div><dt>{booking.parkingType === "car" ? "Car" : "Motorcycle"} parking<br/><small>{php.format((booking.parkingNightlyRateMinor ?? 0) / 100)} × {booking.stayNights} night{booking.stayNights === 1 ? "" : "s"}</small></dt><dd>+{php.format((booking.parkingChargeMinor ?? 0) / 100)}</dd></div> : null}
        {(booking.earlyCheckInFeeMinor ?? 0) > 0 ? <div><dt>Early check-in<br/><small>{booking.earlyCheckInHours} hour(s) early · Host-confirmed adjustment</small></dt><dd>+{php.format((booking.earlyCheckInFeeMinor ?? 0) / 100)}</dd></div> : null}
        {(booking.lateCheckoutFeeMinor ?? 0) > 0 ? <div><dt>Late checkout<br/><small>{booking.lateCheckoutHours} hour(s) late · Host-confirmed adjustment</small></dt><dd>+{php.format((booking.lateCheckoutFeeMinor ?? 0) / 100)}</dd></div> : null}
        <div><dt>Accommodation subtotal</dt><dd>{php.format((booking.accommodationSubtotalMinor ?? (booking.totalMinor - (booking.extrasTotalMinor ?? booking.parkingChargeMinor ?? 0))) / 100)}</dd></div>
        {(booking.extrasTotalMinor ?? 0) > 0 ? <div><dt>Extras total</dt><dd>+{php.format((booking.extrasTotalMinor ?? 0) / 100)}</dd></div> : null}
        <div><dt>Stay total</dt><dd>{php.format(booking.totalMinor / 100)}</dd></div>
        <div><dt>Down payment required</dt><dd>{php.format(downPaymentMinor / 100)}</dd></div>
        <div><dt>Later balance payments recorded</dt><dd>{booking.balancePaidMinor > 0 ? "−" : ""}{php.format(booking.balancePaidMinor / 100)}</dd></div>
        <div><dt>Remaining stay balance</dt><dd>{php.format(booking.remainingBalanceMinor / 100)}</dd></div>
      </dl>
    </details>
  </section>;
}
