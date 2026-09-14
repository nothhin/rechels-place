"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { DepositControls } from "./DepositControls";
import styles from "./admin.module.css";
import { formatStayRange } from "@/lib/date-format";
import { AdminPriceReceipt } from "./AdminPriceReceipt";

export type AdminEnquiry = {
  id:string; fullName:string; email:string; phone:string; preferredContact:string;
  checkIn:string; checkOut:string; guestCount:number; status:string; depositStatus:string;
  depositSenderName:string|null; depositReference:string|null; depositSubmittedAt:string|null;
  depositRefundReference:string|null; roomTypeName:string|null;
  bedroomChoice:"bedroom_1"|"bedroom_2"|"both_bedrooms"; stayNights:number;
  baseNightlyRateMinor:number; additionalGuestCount:number; additionalGuestChargeMinor:number;
  bookingReference?:string; accommodationSubtotalMinor?:number;
  parkingType?:"none"|"car"|"motorcycle"; parkingNightlyRateMinor?:number; parkingChargeMinor?:number;
  earlyCheckInHours?:number; earlyCheckInTime?:string|null; earlyCheckInFeeMinor?:number;
  lateCheckoutHours?:number; lateCheckoutTime?:string|null; lateCheckoutFeeMinor?:number; extrasTotalMinor?:number;
  totalMinor:number; depositAmountMinor:number; balancePaidMinor:number; remainingBalanceMinor:number;
  balancePaymentMethod:string|null; balancePaymentReference:string|null; balancePaidAt:string|null;
};

export function BookingRequestsPanel({ enquiries, canManage }: { enquiries: AdminEnquiry[]; canManage: boolean }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("active");
  const [selected, setSelected] = useState<AdminEnquiry|null>(null);
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
    <div className={styles.panelHeading}><div><p className={styles.eyebrow}>Direct guest enquiries</p><h2 id="booking-requests-title">Stay enquiries</h2></div><span className={styles.countBadge}>{requests.length} awaiting action</span></div>
    <div className={styles.bookingFilters}><label><span>Search bookings</span><input type="search" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Guest, phone, email, or transfer reference" /></label><label><span>Show</span><select value={status} onChange={(event)=>setStatus(event.target.value)}><option value="active">All active requests</option><option value="pending">Pending</option><option value="contacted">Contacted</option><option value="submitted">Deposit submitted</option></select></label></div>
    {filtered.length ? <div className={styles.bookingCardGrid}>{filtered.map((item)=><article className={styles.bookingSummaryCard} key={item.id}><div><strong>{item.fullName}</strong><span>{formatStayRange(item.checkIn,item.checkOut)}</span></div><dl><div><dt>Guests</dt><dd>{item.guestCount}</dd></div><div><dt>Request</dt><dd>{item.status.replaceAll("_"," ")}</dd></div><div><dt>Deposit</dt><dd>{item.depositStatus.replaceAll("_"," ")}</dd></div></dl><button type="button" onClick={()=>setSelected(item)}>View booking details</button></article>)}</div> : <div className={styles.emptyState}><span aria-hidden="true">⌁</span><h3>No matching booking requests</h3><p>Try another search or status filter.</p></div>}
    {selected ? createPortal(<div className={styles.bookingModalBackdrop} role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)setSelected(null);}}><section className={styles.bookingInfoModal} role="dialog" aria-modal="true" aria-labelledby="booking-info-title"><header><div><p className={styles.eyebrow}>Booking request</p><h2 id="booking-info-title">{selected.fullName}</h2></div><button type="button" aria-label="Close booking details" onClick={()=>setSelected(null)}>×</button></header><div className={styles.bookingModalBody}><dl className={styles.bookingInfoGrid}><div><dt>Stay</dt><dd>{formatStayRange(selected.checkIn,selected.checkOut)}</dd></div><div><dt>Guests</dt><dd>{selected.guestCount}</dd></div><div><dt>Phone</dt><dd>{selected.phone}</dd></div><div><dt>Email</dt><dd>{selected.email||"Not provided"}</dd></div><div><dt>Request status</dt><dd>{selected.status.replaceAll("_"," ")}</dd></div><div><dt>Deposit status</dt><dd>{selected.depositStatus.replaceAll("_"," ")}</dd></div><div><dt>Sender/account name</dt><dd>{selected.depositSenderName||"Not submitted"}</dd></div><div><dt>Transaction reference</dt><dd>{selected.depositReference||"Not submitted"}</dd></div><div><dt>Booking ID</dt><dd>{selected.id}</dd></div></dl><AdminPriceReceipt booking={selected}/><div className={styles.bookingModalActions}><a className={styles.callGuestButton} href={`tel:${selected.phone}`}>Call guest</a>{selected.email?<a href={`mailto:${selected.email}`}>Email guest</a>:null}</div><div className={styles.bookingModalControls}><DepositControls bookingId={selected.id} bookingStatus={selected.status} depositStatus={selected.depositStatus} canManage={canManage}/></div></div></section></div>,document.body) : null}
  </section>;
}
