"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { formatStayRange } from "@/lib/date-format";
import { manageDateBlock, type OperationActionState } from "./actions";
import styles from "./admin.module.css";

export type AdminCalendarBooking = {
  id: string;
  bookingReference: string;
  fullName: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  bedroomChoice: string;
  status: string;
};

export type AdminCalendarBlock = {
  id: string;
  checkIn: string;
  checkOut: string;
  reason: string;
  status: "active" | "released";
  createdAt: string;
  createdBy: string | null;
  createdByEmail: string | null;
  releasedAt: string | null;
};

export type AdminCalendarExternalBlock = {
  provider: string;
  externalUid: string;
  checkIn: string;
  checkOut: string;
  status: string;
  updatedAt: string;
};

type CalendarStatus = "open" | "pending" | "booked" | "blocked" | "unavailable" | "past";
type CalendarRange = { checkIn: string; checkOut: string };
type SelectedDate = { date: string; mode: "block" | "details" };
type DateStatus = {
  status: CalendarStatus;
  label: string;
  bookingsForDate: AdminCalendarBooking[];
  blocksForDate: AdminCalendarBlock[];
  externalForDate: AdminCalendarExternalBlock[];
};
type ActionState = OperationActionState;

const initialActionState: ActionState = { status: "idle" };
const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const addDays = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return iso(date);
};
const dateLabel = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" });
const dateTimeLabel = (value: string | null) => value ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(value)) : "Not recorded";
const overlaps = (range: CalendarRange, checkIn: string, checkOut: string) => range.checkIn < checkOut && range.checkOut > checkIn;
const isActiveBooking = (booking: AdminCalendarBooking) => !["cancelled", "declined"].includes(booking.status);
const statusLabels: Record<CalendarStatus, string> = { open: "Open", pending: "Pending", booked: "Booked", blocked: "Manually blocked", unavailable: "Unavailable", past: "Past" };

export function AdminCalendar({ bookings, blocks, externalBlocks, canManage }: {
  bookings: AdminCalendarBooking[];
  blocks: AdminCalendarBlock[];
  externalBlocks: AdminCalendarExternalBlock[];
  canManage: boolean;
}) {
  const today = useMemo(() => iso(new Date()), []);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState<SelectedDate | null>(null);
  const [rangeEnd, setRangeEnd] = useState("");
  const [reason, setReason] = useState("");
  const [actionState, action, pending] = useActionState(manageDateBlock, initialActionState);
  const activeBookings = useMemo(() => bookings.filter(isActiveBooking), [bookings]);
  const activeBlocks = useMemo(() => blocks.filter((block) => block.status === "active"), [blocks]);

  const statusFor = (date: string): DateStatus => {
    const bookingsForDate = activeBookings.filter((booking) => overlaps(booking, date, addDays(date, 1)));
    const blocksForDate = activeBlocks.filter((block) => overlaps(block, date, addDays(date, 1)));
    const externalForDate = externalBlocks.filter((block) => overlaps(block, date, addDays(date, 1)));
    if (date < today) return { status: "past", label: statusLabels.past, bookingsForDate, blocksForDate, externalForDate };
    const confirmed = bookingsForDate.some((booking) => booking.status === "confirmed");
    const pendingRequest = bookingsForDate.some((booking) => booking.status !== "confirmed");
    // Keep the same precedence as the public calendar: booked, unavailable,
    // then pending. Manual and external blocks are both unavailable publicly,
    // but remain distinct in this staff view.
    const status: CalendarStatus = confirmed ? "booked" : blocksForDate.length ? "blocked" : externalForDate.length ? "unavailable" : pendingRequest ? "pending" : "open";
    return { status, label: statusLabels[status], bookingsForDate, blocksForDate, externalForDate };
  };

  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", close); };
  }, [selected]);

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: first.getDay() + days }, (_, index) => index < first.getDay() ? null : new Date(month.getFullYear(), month.getMonth(), index - first.getDay() + 1));
  const currentMonth = month.getFullYear() === new Date().getFullYear() && month.getMonth() === new Date().getMonth();
  const monthStatuses = Array.from({ length: days }, (_, index) => statusFor(iso(new Date(month.getFullYear(), month.getMonth(), index + 1))).status);
  const occupiedCount = monthStatuses.filter((status) => status !== "open" && status !== "past").length;
  const conflictRanges = useMemo(() => {
    if (!selected || selected.mode !== "block" || !rangeEnd) return [] as Array<CalendarRange & { source: string }>;
    return [
      ...activeBookings.map((booking) => ({ checkIn: booking.checkIn, checkOut: booking.checkOut, source: booking.status === "confirmed" ? "a confirmed booking" : "a pending request" })),
      ...activeBlocks.map((block) => ({ checkIn: block.checkIn, checkOut: block.checkOut, source: "a manual block" })),
      ...externalBlocks.map((block) => ({ checkIn: block.checkIn, checkOut: block.checkOut, source: "an Airbnb block" })),
    ].filter((range) => overlaps(range, selected.date, rangeEnd));
  }, [activeBlocks, activeBookings, externalBlocks, rangeEnd, selected]);

  const openDate = (date: string) => {
    const info = statusFor(date);
    if (info.status === "open" && canManage) {
      setSelected({ date, mode: "block" });
      setRangeEnd(addDays(date, 1));
      setReason("");
      return;
    }
    setSelected({ date, mode: "details" });
  };

  return <section id="calendar" className={`${styles.panel} ${styles.calendarPanel}`}>
    <div className={styles.panelHeading}><div><p className={styles.eyebrow}>Live occupancy · admin view</p><h2>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2><p className={styles.calendarSubcopy}>This is the same availability source shown to guests. Select an open date to block it, or select any occupied date to review its source.</p></div><div className={styles.calendarControls}><button type="button" onClick={() => setMonth(new Date())}>Today</button><button type="button" aria-label="Previous month" disabled={currentMonth} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>←</button><button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>→</button></div></div>
    <div className={styles.calendarPulse}><div><span>OCCUPIED / HELD</span><strong>{Math.round((occupiedCount / days) * 100)}%</strong><small>this month</small></div><div><span>ACTIVE REQUESTS</span><strong>{activeBookings.length}</strong><small>pending or booked stays</small></div><div><span>MANUAL BLOCKS</span><strong>{activeBlocks.length}</strong><small>saved in the database</small></div></div>
    <div className={styles.adminCalendarGrid}>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span className={styles.calendarWeekday} key={day}>{day}</span>)}{cells.map((date, index) => {
      if (!date) return <span key={`empty-${index}`} aria-hidden="true" />;
      const value = iso(date); const info = statusFor(value); const disabled = info.status === "past";
      return <button type="button" key={value} data-status={info.status} onClick={() => openDate(value)} disabled={disabled} aria-label={`${dateLabel(value)}: ${info.label}`} title={info.label}><strong>{date.getDate()}</strong><small>{info.label}</small>{info.status === "blocked" && info.blocksForDate[0]?.reason ? <em>{info.blocksForDate[0].reason}</em> : null}{info.status === "unavailable" ? <em>Airbnb</em> : null}{info.status === "pending" || info.status === "booked" ? <em>{info.bookingsForDate.length} stay{info.bookingsForDate.length === 1 ? "" : "s"}</em> : null}</button>;
    })}</div>
    <div className={styles.calendarLegend} aria-label="Availability legend">{(["open", "pending", "booked", "blocked", "unavailable", "past"] as CalendarStatus[]).map((status) => <span key={status} data-status={status}>{statusLabels[status]}</span>)}</div>
    {selected ? <div className={styles.calendarModalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><div className={styles.calendarModal} role="dialog" aria-modal="true" aria-labelledby="admin-calendar-dialog-title"><header><div><p className={styles.eyebrow}>{selected.mode === "block" ? "Block availability" : "Date details"}</p><h2 id="admin-calendar-dialog-title">{dateLabel(selected.date)}</h2></div><button type="button" aria-label="Close" onClick={() => setSelected(null)}>×</button></header>{selected.mode === "block" ? <BlockDateForm selected={selected.date} rangeEnd={rangeEnd} setRangeEnd={setRangeEnd} reason={reason} setReason={setReason} conflictRanges={conflictRanges} action={action} pending={pending} actionState={actionState} /> : <DateDetails status={statusFor(selected.date)} canManage={canManage} action={action} pending={pending} actionState={actionState} onClose={() => setSelected(null)} />}</div></div> : null}
  </section>;
}

function BlockDateForm({ selected, rangeEnd, setRangeEnd, reason, setReason, conflictRanges, action, pending, actionState }: { selected: string; rangeEnd: string; setRangeEnd: (value: string) => void; reason: string; setReason: (value: string) => void; conflictRanges: Array<CalendarRange & { source: string }>; action: (formData: FormData) => void; pending: boolean; actionState: ActionState; }) {
  return <form className={styles.calendarBlockForm} action={action} onSubmit={(event) => { if (conflictRanges.length) { event.preventDefault(); return; } if (!window.confirm(`Block ${formatStayRange(selected, rangeEnd)} for new bookings?`)) event.preventDefault(); }}><p className={styles.calendarFormHint}>The reopen date is exclusive. For one night, leave the default next-day value. Customers will see these nights as unavailable.</p><label><span>Block from</span><input type="date" name="checkIn" value={selected} readOnly /></label><label><span>Reopen on (exclusive)</span><input type="date" name="checkOut" min={addDays(selected, 1)} value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} required /></label><label><span>Reason</span><input name="reason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={240} placeholder="Maintenance, owner use…" required /></label>{conflictRanges.length ? <div className={styles.calendarConflict} role="alert"><strong>Cannot block this range.</strong><span>It overlaps {conflictRanges.map((range) => range.source).join(", ")}.</span></div> : null}{actionState.status === "error" ? <div className={styles.calendarConflict} role="alert">{actionState.message}</div> : null}{actionState.status === "success" ? <div className={styles.calendarSuccess} role="status">{actionState.message}</div> : null}<input type="hidden" name="blockId" value="" /><button type="submit" disabled={pending || Boolean(conflictRanges.length)}>{pending ? "Blocking…" : "Confirm block"}</button></form>;
}

function DateDetails({ status, canManage, action, pending, actionState, onClose }: { status: DateStatus; canManage: boolean; action: (formData: FormData) => void; pending: boolean; actionState: ActionState; onClose: () => void; }) {
  return <div className={styles.calendarDetails}><div className={styles.calendarStatusBanner} data-status={status.status}><strong>{statusLabels[status.status]}</strong><span>{status.status === "open" ? "No booking, pending request, manual block, or external block was found." : status.status === "past" ? "Past dates are view-only." : "This status is calculated from the shared availability sources."}</span></div>{status.bookingsForDate.map((booking) => <article className={styles.calendarDetailCard} key={booking.id}><div><strong>{booking.fullName}</strong><span>{booking.status.replaceAll("_", " ")}</span></div><dl><div><dt>Reference</dt><dd>{booking.bookingReference}</dd></div><div><dt>Stay</dt><dd>{formatStayRange(booking.checkIn, booking.checkOut)}</dd></div><div><dt>Guests</dt><dd>{booking.guestCount}</dd></div><div><dt>Accommodation</dt><dd>{booking.bedroomChoice.replaceAll("_", " ")}</dd></div></dl></article>)}{status.blocksForDate.map((block) => <article className={styles.calendarDetailCard} key={block.id}><div><strong>Manual block</strong><span>{block.status}</span></div><dl><div><dt>Range</dt><dd>{formatStayRange(block.checkIn, block.checkOut)}</dd></div><div><dt>Reason</dt><dd>{block.reason}</dd></div><div><dt>Blocked</dt><dd>{dateTimeLabel(block.createdAt)}</dd></div><div><dt>Admin</dt><dd>{block.createdByEmail || block.createdBy || "Not recorded"}</dd></div></dl>{canManage && block.status === "active" ? <form action={action} onSubmit={(event) => { if (!window.confirm(`Release ${formatStayRange(block.checkIn, block.checkOut)}? Only this manual block will be removed.`)) event.preventDefault(); }}><input type="hidden" name="blockId" value={block.id} /><input type="hidden" name="release" value="true" /><input type="hidden" name="checkIn" value="" /><input type="hidden" name="checkOut" value="" /><input type="hidden" name="reason" value="Released" /><button type="submit" disabled={pending} className={styles.calendarReleaseButton}>{pending ? "Releasing…" : "Release date block"}</button></form> : null}</article>)}{status.externalForDate.map((block) => <article className={styles.calendarDetailCard} key={block.externalUid}><div><strong>{block.provider === "airbnb" ? "Airbnb calendar" : "External calendar"}</strong><span>Unavailable</span></div><dl><div><dt>Range</dt><dd>{formatStayRange(block.checkIn, block.checkOut)}</dd></div><div><dt>Last updated</dt><dd>{dateTimeLabel(block.updatedAt)}</dd></div></dl><p className={styles.calendarFormHint}>Release this date from the external calendar source. It cannot be manually unblocked here.</p></article>)}{status.status === "open" && !canManage ? <p className={styles.calendarFormHint}>Your role can view availability but cannot create date blocks.</p> : null}{actionState.status === "error" ? <div className={styles.calendarConflict} role="alert">{actionState.message}</div> : null}<button type="button" className={styles.calendarSecondaryButton} onClick={onClose}>Close details</button></div>;
}
