"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { DepositControls } from "./DepositControls";
import styles from "./admin.module.css";
import { formatStayRange } from "@/lib/date-format";
import { AdminPriceReceipt } from "./AdminPriceReceipt";

export type AdminEnquiry = {
  id:string; fullName:string; email:string; phone:string; preferredContact:string;
  checkIn:string; checkOut:string; guestCount:number; adultCount?:number; childCount?:number; status:string; depositStatus:string;
  depositSenderName:string|null; depositReference:string|null; depositSubmittedAt:string|null;
  depositRefundReference:string|null; roomTypeName:string|null;
  bedroomChoice:"bedroom_1"|"bedroom_2"|"both_bedrooms"; stayNights:number;
  baseNightlyRateMinor:number; additionalGuestCount:number; additionalGuestChargeMinor:number;
  bookingReference?:string; accommodationSubtotalMinor?:number;
  parkingType?:"none"|"car"|"motorcycle"; parkingNightlyRateMinor?:number; parkingChargeMinor?:number;
  earlyCheckInHours?:number; earlyCheckInTime?:string|null; earlyCheckInFeeMinor?:number;
  lateCheckoutHours?:number; lateCheckoutTime?:string|null; lateCheckoutFeeMinor?:number; extrasTotalMinor?:number;
  totalMinor:number; depositAmountMinor:number; downPaymentAmountMinor?:number; securityDepositAmountMinor?:number; balancePaidMinor:number; remainingBalanceMinor:number;
  balancePaymentMethod:string|null; balancePaymentReference:string|null; balancePaidAt:string|null;
};

const plainStatus: Record<string,string> = {
  pending: "New request",
  contacted: "Waiting for payment",
  submitted: "Payment ready to verify",
  not_submitted: "Payment not submitted",
  requested: "Payment requested",
};

function statusLabel(value:string) {
  return plainStatus[value] ?? value.replaceAll("_", " ");
}

function currentStep(item:AdminEnquiry) {
  if (item.depositStatus === "submitted") return 3;
  if (item.status === "contacted" || item.depositStatus === "requested") return 2;
  return 1;
}

export function BookingRequestsPanel({ enquiries, canManage }: { enquiries: AdminEnquiry[]; canManage: boolean }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("active");
  const [selected, setSelected] = useState<AdminEnquiry|null>(null);
  const closeSelected = useCallback(() => setSelected(null), []);
  const requests = useMemo(() => enquiries.filter((item) => !["confirmed","cancelled","declined"].includes(item.status)), [enquiries]);
  const filtered = useMemo(() => requests.filter((item) => {
    const matchesQuery = !query || [item.fullName,item.phone,item.email,item.depositReference].some((value)=>value?.toLowerCase().includes(query.toLowerCase()));
    const matchesStatus = status === "all" || status === "active" || item.status === status || item.depositStatus === status;
    return matchesQuery && matchesStatus;
  }), [requests,query,status]);

  useEffect(() => {
    if (!selected) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event:KeyboardEvent)=>{if(event.key==="Escape")setSelected(null);};
    document.body.style.overflow="hidden";
    window.addEventListener("keydown",closeOnEscape);
    return ()=>{document.body.style.overflow=previousOverflow;window.removeEventListener("keydown",closeOnEscape);};
  }, [selected]);

  return <section id="booking-requests" className={styles.panel} aria-labelledby="booking-requests-title">
    <div className={styles.panelHeading}><div><p className={styles.eyebrow}>Guest requests</p><h2 id="booking-requests-title">Booking requests</h2><p className={styles.panelHelper}>Open a request to see exactly what to do next.</p></div><span className={styles.countBadge}>{requests.length} need a response</span></div>
    <div className={styles.bookingFilters}><label><span>Find a guest</span><input type="search" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Name, phone, or email" /></label><label><span>Show</span><select value={status} onChange={(event)=>setStatus(event.target.value)}><option value="active">All requests</option><option value="pending">New requests</option><option value="contacted">Waiting for payment</option><option value="submitted">Payment ready to verify</option></select></label></div>
    {filtered.length ? <div className={styles.bookingCardGrid}>{filtered.map((item)=><article className={styles.bookingSummaryCard} key={item.id}><div><strong>{item.fullName}</strong><span>{formatStayRange(item.checkIn,item.checkOut)}</span></div><dl><div><dt>Guests</dt><dd>{item.adultCount ?? item.guestCount} adults · {item.childCount ?? 0} children</dd></div><div><dt>Next step</dt><dd>{statusLabel(item.depositStatus === "submitted" ? item.depositStatus : item.status)}</dd></div><div><dt>Total</dt><dd>₱{(item.totalMinor/100).toLocaleString("en-PH")}</dd></div></dl><button type="button" onClick={()=>setSelected(item)}>Review request</button></article>)}</div> : <div className={styles.emptyState}><span aria-hidden="true">✓</span><h3>No requests need your attention</h3><p>You are all caught up.</p></div>}
    {selected ? createPortal(<div className={styles.bookingModalBackdrop} role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)closeSelected();}}><section className={styles.bookingInfoModal} role="dialog" aria-modal="true" aria-labelledby="booking-info-title"><header><div><p className={styles.eyebrow}>Booking request</p><h2 id="booking-info-title">{selected.fullName}</h2></div><button type="button" aria-label="Close booking details" onClick={closeSelected}>×</button></header><div className={styles.bookingModalBody}>
      <div className={styles.bookingProgress} aria-label={`Booking request step ${currentStep(selected)} of 3`}><div data-complete={currentStep(selected)>=1}><span>1</span><strong>Review request</strong></div><div data-complete={currentStep(selected)>=2}><span>2</span><strong>Wait for payment</strong></div><div data-complete={currentStep(selected)>=3}><span>3</span><strong>Verify & confirm</strong></div></div>
      <section className={styles.nextStepCard}><p className={styles.eyebrow}>What to do next</p><h3>{selected.depositStatus === "submitted" ? "Verify the guest’s down payment" : selected.status === "contacted" || selected.depositStatus === "requested" ? "Wait for the guest’s payment" : "Review the request and contact the guest"}</h3><p>{selected.depositStatus === "submitted" ? "Check the sender and reference below, then use the confirmation button." : selected.status === "contacted" || selected.depositStatus === "requested" ? "The payment instructions were prepared. Contact the guest if a follow-up is needed." : "Make sure the dates and guest details are correct before starting the payment request."}</p></section>
      <dl className={styles.bookingInfoGrid}><div><dt>Stay</dt><dd>{formatStayRange(selected.checkIn,selected.checkOut)}</dd></div><div><dt>Guests</dt><dd>{selected.adultCount ?? selected.guestCount} adults · {selected.childCount ?? 0} children</dd></div><div><dt>Total</dt><dd>₱{(selected.totalMinor/100).toLocaleString("en-PH")}</dd></div><div><dt>Down payment</dt><dd>₱{((selected.downPaymentAmountMinor ?? 0)/100).toLocaleString("en-PH")}</dd></div></dl>
      <div className={styles.bookingModalActions}><a className={styles.callGuestButton} href={`tel:${selected.phone}`}>Call guest</a>{selected.email?<a href={`mailto:${selected.email}`}>Email guest</a>:null}</div>
      <div className={styles.bookingModalControls}><DepositControls bookingId={selected.id} bookingStatus={selected.status} depositStatus={selected.depositStatus} canManage={canManage} downPaymentMinor={selected.downPaymentAmountMinor} securityDepositAmountMinor={selected.securityDepositAmountMinor ?? selected.depositAmountMinor} totalMinor={selected.totalMinor} onSuccess={closeSelected}/></div>
      <details className={styles.bookingAdvancedDetails}><summary>View full booking and payment details</summary><dl className={styles.bookingInfoGrid}><div><dt>Phone</dt><dd>{selected.phone}</dd></div><div><dt>Email</dt><dd>{selected.email||"Not provided"}</dd></div><div><dt>Request status</dt><dd>{statusLabel(selected.status)}</dd></div><div><dt>Payment status</dt><dd>{statusLabel(selected.depositStatus)}</dd></div><div><dt>Sender/account name</dt><dd>{selected.depositSenderName||"Not submitted"}</dd></div><div><dt>Transaction reference</dt><dd>{selected.depositReference||"Not submitted"}</dd></div><div><dt>Booking ID</dt><dd>{selected.id}</dd></div></dl><AdminPriceReceipt booking={selected}/></details>
    </div></section></div>,document.body) : null}
  </section>;
}
