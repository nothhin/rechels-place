"use client";

import Link from "next/link";
import { useEffect, useMemo, useSyncExternalStore } from "react";

const storageKey = "snowaz:last-booking:v1";
export type SavedBooking = { url:string; reference?:string; checkIn?:string; checkOut?:string };
const subscribeToSavedBooking = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("snowaz:booking-saved", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("snowaz:booking-saved", onStoreChange);
  };
};
const getSavedBookingSnapshot = () => localStorage.getItem(storageKey) ?? "";

export function useSavedBooking() {
  const snapshot = useSyncExternalStore(subscribeToSavedBooking, getSavedBookingSnapshot, () => "");
  return useMemo(() => {
    try {
      const booking = JSON.parse(snapshot || "null") as SavedBooking | null;
      return booking?.url?.startsWith("/deposit/") ? booking : null;
    } catch {
      return null;
    }
  }, [snapshot]);
}

export function rememberBooking(booking: SavedBooking) {
  localStorage.setItem(storageKey, JSON.stringify(booking));
  window.dispatchEvent(new Event("snowaz:booking-saved"));
}

export function RememberBooking({ booking }: { booking: SavedBooking }) {
  const { url, reference, checkIn, checkOut } = booking;
  useEffect(() => {
    rememberBooking({ url, reference, checkIn, checkOut });
  }, [url, reference, checkIn, checkOut]);
  return null;
}

export function SavedBookingLink() {
  const booking = useSavedBooking();
  if (!booking) return <Link href="/booking-status">Check this device for my booking</Link>;
  return <Link href={booking.url}>Continue or check my booking</Link>;
}

export function ForgetBookingIfMatches({ url }: { url: string }) {
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null") as SavedBooking | null;
      if (saved?.url?.split("?")[0] === url.split("?")[0]) {
        localStorage.removeItem(storageKey);
        window.dispatchEvent(new Event("snowaz:booking-saved"));
      }
    } catch { localStorage.removeItem(storageKey); }
  }, [url]);
  return null;
}
