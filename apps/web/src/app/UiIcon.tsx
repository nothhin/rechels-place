import type { ReactNode, SVGProps } from "react";

export type IconName = "calendar" | "user" | "install" | "bolt" | "map" | "bed" | "users" | "wifi" | "lock" | "message" | "play" | "home" | "image" | "sparkles" | "kitchen" | "tv" | "snow" | "shower" | "pin" | "check" | "bookmark" | "arrow-right";

const paths: Record<IconName, ReactNode> = {
  calendar: <><path d="M7 3v3M17 3v3M4 9h16"/><rect x="4" y="5" width="16" height="16" rx="2"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></>,
  install: <><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 18v3h14v-3"/></>,
  bolt: <path d="m13 2-8 12h7l-1 8 8-12h-7z"/>,
  map: <><path d="m9 18-6 3V6l6-3 6 3 6-3v15l-6 3z"/><path d="M9 3v15m6-12v15"/></>,
  bed: <><path d="M3 19v-8m18 8v-6a2 2 0 0 0-2-2H9a3 3 0 0 0-3 3v2"/><path d="M3 16h18M6 11V8h5v3"/></>,
  users: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0m0-5a5 5 0 0 1 6 5"/></>,
  wifi: <><path d="M3 9a14 14 0 0 1 18 0M6 13a9 9 0 0 1 12 0M9.5 17a4 4 0 0 1 5 0"/><circle cx="12" cy="20" r="1" fill="currentColor" stroke="none"/></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/></>,
  message: <path d="M21 12a8 8 0 0 1-8 8H6l-3 2 1-5a9 9 0 1 1 17-5Z"/>,
  play: <path d="m9 6 9 6-9 6z"/>,
  home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10m-9 11v-6h4v6"/></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 15-5-5L5 20"/></>,
  sparkles: <><path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3zM5 15l.8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8zM19 14l.7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7z"/></>,
  kitchen: <><path d="M6 3v18M3 3v5a3 3 0 0 0 6 0V3M17 3v18m0-18c3 2 4 5 4 8h-4"/></>,
  tv: <><rect x="3" y="6" width="18" height="13" rx="2"/><path d="m9 2 3 4 3-4"/></>,
  snow: <><path d="M12 2v20M4 7l16 10M20 7 4 17"/><path d="m9 4 3 3 3-3M9 20l3-3 3 3"/></>,
  shower: <><path d="M5 20V9a5 5 0 0 1 10 0"/><path d="M12 9h6m-5 4v1m4-1v1m4-1v1m-6 3v1m4-1v1"/></>,
  pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  bookmark: <path d="M6 3h12v18l-6-4-6 4z"/>,
  "arrow-right": <path d="M5 12h14m-6-6 6 6-6 6"/>,
};

export default function UiIcon({ name, size = 20, ...props }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>{paths[name]}</svg>;
}
