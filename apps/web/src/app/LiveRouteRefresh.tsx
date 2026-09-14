"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function LiveRouteRefresh({ intervalMs = 5_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    let refreshing = false;
    const refresh = () => {
      if (refreshing || document.visibilityState !== "visible") return;
      refreshing = true;
      router.refresh();
      window.setTimeout(() => { refreshing = false; }, 1_000);
    };
    const interval = window.setInterval(refresh, intervalMs);
    window.addEventListener("focus", refresh);
    window.addEventListener("snowaz:booking-changed", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("snowaz:booking-changed", refresh);
    };
  }, [intervalMs, router]);
  return null;
}
