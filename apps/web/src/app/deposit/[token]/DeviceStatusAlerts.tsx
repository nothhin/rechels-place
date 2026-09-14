"use client";

import { useEffect, useSyncExternalStore } from "react";

const preferenceKey = "snowaz:device-status-alerts:v1";
const statusKey = "snowaz:last-deposit-status:v1";

function describeStatus(status: string) {
  if (status === "verified") return "Your down payment is verified and your stay is confirmed.";
  if (status === "refund_pending") return "Your cancellation is recorded and any applicable payment refund is being processed.";
  if (status === "refunded") return "Your payment refund has been recorded.";
  if (status === "submitted") return "Rechel's Place received your payment details and is verifying them.";
  return "Your private booking status has changed.";
}

export function DeviceStatusAlerts({ status }: { status: string }) {
  const state = useSyncExternalStore(
    (notify) => {
      window.addEventListener("storage", notify);
      window.addEventListener("snowaz-alert-preference", notify);
      return () => {
        window.removeEventListener("storage", notify);
        window.removeEventListener("snowaz-alert-preference", notify);
      };
    },
    () => {
      if (!("Notification" in window)) return "unsupported";
      return Notification.permission === "granted" && localStorage.getItem(preferenceKey) === "enabled"
        ? "enabled"
        : "disabled";
    },
    () => "unsupported",
  );
  const supported = state !== "unsupported";
  const enabled = state === "enabled";

  useEffect(() => {
    if (!enabled || Notification.permission !== "granted") return;
    const previous = localStorage.getItem(statusKey);
    if (previous && previous !== status) {
      new Notification("Rechel's Place booking update", {
        body: describeStatus(status),
        tag: "snowaz-booking-status",
      });
    }
    localStorage.setItem(statusKey, status);
  }, [enabled, status]);

  if (!supported) return null;

  async function enableAlerts() {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;
    localStorage.setItem(preferenceKey, "enabled");
    localStorage.setItem(statusKey, status);
    window.dispatchEvent(new Event("snowaz-alert-preference"));
  }

  return (
    <section className="device-status-alerts" aria-label="Device booking alerts">
      <div>
        <strong>{enabled ? "Device alerts are on" : "Get booking updates on this device"}</strong>
        <span>
          {enabled
            ? "This browser will alert you when the private booking page detects a status change."
            : "Free browser alerts work on this device—no reference number is needed."}
        </span>
      </div>
      {!enabled ? <button type="button" onClick={enableAlerts}>Turn on alerts</button> : null}
    </section>
  );
}
