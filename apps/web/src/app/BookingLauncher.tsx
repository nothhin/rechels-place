"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

export default function BookingLauncher({ children, className }: { children: ReactNode; className?: string }) {
  const router = useRouter();
  const goToAvailability = () => {
    if (window.location.pathname !== "/") {
      router.push("/#availability");
      return;
    }

    const section = document.getElementById("availability");
    if (!section) {
      window.location.hash = "availability";
      return;
    }

    if (window.location.hash !== "#availability") {
      window.history.pushState({ section: "availability" }, "", "#availability");
    }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    section.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    section.focus({ preventScroll: true });
  };

  return <button className={className} type="button" onClick={goToAvailability}>{children}</button>;
}
