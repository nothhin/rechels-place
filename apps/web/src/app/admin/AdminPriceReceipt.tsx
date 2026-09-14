import type { AdminEnquiry } from "./BookingRequestsPanel";
import styles from "./admin.module.css";

const php = new Intl.NumberFormat("en-PH", { style:"currency", currency:"PHP", maximumFractionDigits:0 });
const bedroomLabels = { bedroom_1:"Legacy single-bedroom record", bedroom_2:"Legacy single-bedroom record", both_bedrooms:"Entire two-bedroom condo" } as const;

export function AdminPriceReceipt({ booking }: { booking:AdminEnquiry }) {
  const downPaymentMinor = booking.downPaymentAmountMinor ?? Math.ceil(booking.totalMinor / 2);
  const securityDepositMinor = booking.securityDepositAmountMinor ?? booking.depositAmountMinor;
  return <section className={styles.adminReceipt} aria-label="Booking payment receipt"><header><strong>Payment summary</strong><span>{booking.remainingBalanceMinor === 0 ? "Fully paid" : "Balance due"}</span></header><dl>
    {booking.bookingReference?<div><dt>Booking reference</dt><dd>{booking.bookingReference}</dd></div>:null}
    <div><dt>Guest contact</dt><dd>{booking.phone}{booking.email?` · ${booking.email}`:""}</dd></div>
    <div><dt>Dates</dt><dd>{booking.checkIn} – {booking.checkOut}</dd></div>
    <div><dt>Stay</dt><dd>{booking.stayNights} night{booking.stayNights===1?"":"s"}</dd></div>
    <div><dt>Pax</dt><dd>{booking.guestCount}</dd></div>
    <div><dt>Space</dt><dd>{bedroomLabels[booking.bedroomChoice]}</dd></div>
    <div><dt>Nightly rate</dt><dd>{php.format(booking.baseNightlyRateMinor/100)}</dd></div>
    {booking.additionalGuestCount>0?<div><dt>Additional occupancy<br/><small>Host-confirmed adjustment × {booking.stayNights} night{booking.stayNights===1?"":"s"}</small></dt><dd>+{php.format(booking.additionalGuestChargeMinor/100)}</dd></div>:null}
    {(booking.parkingChargeMinor??0)>0?<div><dt>{booking.parkingType==="car"?"Car":"Motorcycle"} parking<br/><small>{php.format((booking.parkingNightlyRateMinor??0)/100)} × {booking.stayNights} night{booking.stayNights===1?"":"s"}</small></dt><dd>+{php.format((booking.parkingChargeMinor??0)/100)}</dd></div>:null}
    {(booking.earlyCheckInFeeMinor??0)>0?<div><dt>Early check-in<br/><small>{booking.earlyCheckInHours} hour(s) early · Host-confirmed adjustment</small></dt><dd>+{php.format((booking.earlyCheckInFeeMinor??0)/100)}</dd></div>:null}
    {(booking.lateCheckoutFeeMinor??0)>0?<div><dt>Late checkout<br/><small>{booking.lateCheckoutHours} hour(s) late · Host-confirmed adjustment</small></dt><dd>+{php.format((booking.lateCheckoutFeeMinor??0)/100)}</dd></div>:null}
    <div><dt>Accommodation subtotal</dt><dd>{php.format((booking.accommodationSubtotalMinor??(booking.totalMinor-(booking.extrasTotalMinor??booking.parkingChargeMinor??0)))/100)}</dd></div>
    {(booking.extrasTotalMinor??0)>0?<div><dt>Extras total</dt><dd>+{php.format((booking.extrasTotalMinor??0)/100)}</dd></div>:null}
    <div><dt>Final total</dt><dd>{php.format(booking.totalMinor/100)}</dd></div>
    <div><dt>50% down payment</dt><dd>{php.format(downPaymentMinor/100)}</dd></div>
    <div><dt>Refundable security deposit<br/><small>Due upon check-in on the check-in day · separate from the down payment</small></dt><dd>{php.format(securityDepositMinor/100)}</dd></div>
    <div><dt>Balance payments recorded</dt><dd>{booking.balancePaidMinor>0?"−":""}{php.format(booking.balancePaidMinor/100)}</dd></div>
    <div className={styles.adminReceiptBalance}><dt>Remaining balance</dt><dd>{php.format(booking.remainingBalanceMinor/100)}</dd></div>
    <div><dt>Status</dt><dd>{booking.status.replaceAll("_"," ")} · {booking.depositStatus.replaceAll("_"," ")}</dd></div>
  </dl></section>;
}
