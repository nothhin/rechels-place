"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { propertyLogoSrc } from "@/lib/property";

const navigation = [
  { label: "Overview", href: "/admin#overview", id: "overview" },
  { label: "Stay enquiries", href: "/admin#booking-requests", id: "booking-requests" },
  { label: "Stay calendar", href: "/admin#calendar", id: "calendar" },
  { label: "Confirmed stays", href: "/admin/confirmed", id: "confirmed" },
  { label: "Housekeeping & finance", href: "/admin/operations", id: "operations" },
] as const;

function useActiveSection() {
  const pathname = usePathname();
  const [hash, setHash] = useState("overview");
  useEffect(() => {
    const update = () => setHash(window.location.hash.slice(1) || "overview");
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, [pathname]);
  if (pathname === "/admin/confirmed") return "confirmed";
  if (pathname === "/admin/operations") return "operations";
  return hash;
}

export function AdminNav({ activeClassName }: { activeClassName: string }) {
  const active = useActiveSection();
  return <nav aria-label="Host workspace navigation">{navigation.map((item,index)=><Link prefetch href={item.href} className={active===item.id?activeClassName:undefined} key={item.id}><span aria-hidden="true">{String(index+1).padStart(2,"0")}</span>{item.label}</Link>)}</nav>;
}

type MobileNavClasses = { button:string; backdrop:string; drawer:string; drawerOpen:string; drawerHeader:string; closeButton:string; active:string };

export function AdminMobileNav({ classes }: { classes: MobileNavClasses }) {
  const [open, setOpen] = useState(false);
  const active = useActiveSection();
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const drawer = open ? createPortal(<div className={classes.backdrop} role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)setOpen(false);}}><aside id="mobile-admin-navigation" className={`${classes.drawer} ${classes.drawerOpen}`} role="dialog" aria-modal="true" aria-label="Host workspace navigation"><div className={classes.drawerHeader}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><Image src={propertyLogoSrc} alt="" width={42} height={42} style={{ objectFit: "contain", borderRadius: "50%", background: "#f7f0e6", flex: "0 0 auto" }} /><span><strong>Rechel’s Place</strong><small>Host workspace</small></span></div><button className={classes.closeButton} type="button" aria-label="Close host navigation" onClick={()=>setOpen(false)}>×</button></div><nav aria-label="Mobile host navigation">{navigation.map((item,index)=><Link prefetch className={active===item.id?classes.active:undefined} href={item.href} key={item.id} onClick={()=>setOpen(false)}><span aria-hidden="true">{String(index+1).padStart(2,"0")}</span>{item.label}</Link>)}</nav></aside></div>, document.body) : null;

  return <><button className={classes.button} type="button" aria-label="Open admin navigation" aria-expanded={open} aria-controls="mobile-admin-navigation" onClick={()=>setOpen(true)}><span aria-hidden="true"><i/><i/><i/></span></button>{drawer}</>;
}

export function AdminBottomNav({ className, activeClassName }: { className: string; activeClassName: string }) {
  const active = useActiveSection();
  const items = [
    { label: "Overview", href: "/admin#overview", id: "overview", icon: "home" },
    { label: "Calendar", href: "/admin#calendar", id: "calendar", icon: "calendar" },
    { label: "Guests", href: "/admin#booking-requests", id: "booking-requests", icon: "users" },
    { label: "Operations", href: "/admin/operations", id: "operations", icon: "locks" },
    { label: "More", href: "/admin/confirmed", id: "confirmed", icon: "menu" },
  ] as const;
  return <nav className={className} aria-label="Mobile host workspace">{items.map(item => <Link prefetch className={active === item.id ? activeClassName : undefined} href={item.href} key={item.id}><AdminNavIcon name={item.icon} /><small>{item.label}</small></Link>)}</nav>;
}

type AdminNavIconName = "home" | "calendar" | "users" | "locks" | "menu";

function AdminNavIcon({ name }: { name: AdminNavIconName }) {
  const common = { width: 21, height: 21, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "home") return <svg {...common}><path d="m3 10 9-7 9 7"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></svg>;
  if (name === "calendar") return <svg {...common}><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M7 3v4M17 3v4M3.5 10h17"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01"/></svg>;
  if (name === "users") return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.5a3 3 0 0 1 0 5.8M17 14.5a5 5 0 0 1 3.5 4.8"/></svg>;
  if (name === "locks") return <svg {...common}><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg>;
  return <svg {...common}><path d="M4 6h16M4 12h16M4 18h16"/></svg>;
}
