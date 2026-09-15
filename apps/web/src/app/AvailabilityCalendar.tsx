"use client";

import { useEffect, useMemo, useState } from "react";
import type { RechelsPricingConfig } from "@uppadar-hollie/shared/pricing";
import BookingModal from "./BookingModal";

type Range = { checkIn: string; checkOut: string; status: "pending" | "booked" | "unavailable"; label?: string | null };
type ScheduleResponse = { data?: { ranges: Range[] }; error?: { message: string } };

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

export default function AvailabilityCalendar({ pricing }: { pricing: RechelsPricingConfig | null }) {
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [ranges, setRanges] = useState<Range[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedStay, setSelectedStay] = useState<{ checkIn: string; checkOut: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const from = iso(new Date(month.getFullYear(), month.getMonth(), 1));
    const to = iso(new Date(month.getFullYear(), month.getMonth() + 1, 1));
    let requestInFlight = false;

    const refresh = async (showLoading = false) => {
      if (requestInFlight) return;
      requestInFlight = true;
      if (showLoading) setLoading(true);

      try {
        const response = await fetch(`/api/v1/schedule?from=${from}&to=${to}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await response.json() as ScheduleResponse;
        if (!response.ok) throw new Error(body.error?.message || "Availability is temporarily unavailable.");
        setRanges(body.data?.ranges ?? []);
        setError("");
      } catch (reason: unknown) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Availability is temporarily unavailable.");
      } finally {
        requestInFlight = false;
        if (showLoading && !controller.signal.aborted) setLoading(false);
      }
    };

    const refreshSilently = () => { if (document.visibilityState === "visible") void refresh(false); };
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") refreshSilently(); };

    void refresh(true);
    const interval = window.setInterval(refreshSilently, 60_000);
    window.addEventListener("focus", refreshSilently);
    window.addEventListener("snowaz:availability-changed", refreshSilently);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshSilently);
      window.removeEventListener("snowaz:availability-changed", refreshSilently);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [month]);

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const totalDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: first.getDay() + totalDays }, (_, index) => index < first.getDay() ? null : new Date(month.getFullYear(), month.getMonth(), index - first.getDay() + 1));
  const todayIso = iso(today);
  const changeMonth = (offset: number) => {
    setLoading(true);
    setError("");
    setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1));
  };
  const availabilityFor = (dateIso: string) => {
    const matches = ranges.filter((range) => range.checkIn <= dateIso && range.checkOut > dateIso);
    const status = matches.some((range) => range.status === "booked") ? "booked" : matches.some((range) => range.status === "unavailable") ? "unavailable" : matches.some((range) => range.status === "pending") ? "pending" : "open";
    return { status, label: matches.find((range) => range.status === "unavailable")?.label || "Unavailable" };
  };
  const chooseDate = (date: Date) => setSelectedStay({ checkIn: iso(date), checkOut: iso(addDays(date, 1)) });
  const currentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();

  return <><div className="calendar-card">
    <div className="calendar-toolbar">
      <div><p className="eyebrow">Live availability</p><h3>{month.toLocaleDateString("en-PH", { month: "long", year: "numeric" })}</h3></div>
      <div className="calendar-controls">
        <button type="button" aria-label="Previous month" disabled={currentMonth} onClick={() => changeMonth(-1)}>←</button>
        <button type="button" aria-label="Next month" onClick={() => changeMonth(1)}>→</button>
      </div>
    </div>
    <div className="calendar-booking-hint" role="note"><span aria-hidden="true">☝</span><div><strong>Click an open date to request a reservation</strong><small>Select your preferred check-in date, then complete the booking form.</small></div></div>
    {error ? <div className="calendar-notice" role="status">{error} You can still contact us directly to check your dates.</div> : null}
    <div className="calendar-grid" aria-busy={loading}>
      {weekdays.map((day) => <span className="weekday" key={day}>{day}</span>)}
      {cells.map((date, index) => {
        if (!date) return <span className="calendar-empty" aria-hidden="true" key={`empty-${index}`} />;
        const dateIso = iso(date); const past = dateIso < todayIso; const availability = availabilityFor(dateIso); const status = past ? "past" : availability.status;
        const statusLabel = loading ? "Checking" : status === "open" ? "Open" : status === "pending" ? "Pending" : status === "booked" ? "Booked" : status === "unavailable" ? availability.label : "Past";
        const accessibleLabel = status === "unavailable" ? `Unavailable: ${availability.label}` : statusLabel;
        return <button type="button" key={dateIso} disabled={past || status !== "open" || loading} data-status={status} aria-label={`${date.toLocaleDateString("en-PH", { dateStyle: "long" })}: ${accessibleLabel}`} title={status === "unavailable" ? availability.label : undefined} onClick={() => chooseDate(date)}>
          <strong>{date.getDate()}</strong><small>{statusLabel}</small>
        </button>;
      })}
    </div>
    <div className="calendar-legend"><span data-status="open">Open · select to book</span><span data-status="pending">Pending</span><span data-status="booked">Booked</span><span data-status="unavailable">Unavailable reason</span></div>
  </div>{selectedStay ? <BookingModal {...selectedStay} pricing={pricing} onClose={() => setSelectedStay(null)} /> : null}</>;
}
