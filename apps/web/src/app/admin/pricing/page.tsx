import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireStaff } from "@/lib/server/admin-auth";
import { getStaffPricing } from "@/lib/server/pricing";
import { signOut } from "../actions";
import { AdminBottomNav, AdminMobileNav, AdminNav } from "../AdminNav";
import { AdminLiveRefresh } from "../AdminLiveRefresh";
import { propertyLogoSrc } from "@/lib/property";
import PricingManagementClient from "./PricingManagementClient";
import styles from "../admin.module.css";

export const metadata: Metadata = {
  title: "Price management | Rechel's Place",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function PriceManagementPage() {
  const staff = await requireStaff(["manager", "admin"]);
  const staffPricing = await getStaffPricing();
  if (!staffPricing) throw new Error("Price management is unavailable.");

  const classes = {
    button: styles.mobileMenu,
    backdrop: styles.mobileBackdrop,
    drawer: styles.mobileDrawer,
    drawerOpen: styles.mobileDrawerOpen,
    drawerHeader: styles.mobileDrawerHeader,
    closeButton: styles.mobileCloseButton,
    active: styles.mobileActiveNav,
  };

  return <main className={styles.dashboardShell}>
    <aside className={styles.sidebar}>
      <Link className={styles.adminBrand} href="/">
        <Image src={propertyLogoSrc} alt="Rechel's Place" width={48} height={48} />
        <div><strong>Rechel’s Place</strong><small>Host workspace</small></div>
      </Link>
      <AdminNav activeClassName={styles.activeNav} />
      <div className={styles.sidebarFooter}><span className={styles.statusDot} /><div><strong>Rechel’s Place live</strong><AdminLiveRefresh /></div></div>
    </aside>
    <section className={styles.workspace}>
      <header className={styles.topbar}>
        <AdminMobileNav classes={classes} />
        <div><span>Price management</span><strong>One source of truth for every stay</strong></div>
        <div className={styles.adminIdentity}><span>{staff.email.slice(0, 2).toUpperCase()}</span><div><strong>{staff.email}</strong><small>{staff.role.replace("_", " ")}</small></div><form action={signOut}><button type="submit">Sign out</button></form></div>
      </header>
      <div className={styles.content}>
        <section className={`${styles.welcome} ${styles.pricingIntro}`}>
          <div><p className={styles.eyebrow}>Protected settings</p><h1>Price management.</h1><p>Update the active rates used by new estimates, booking requests, receipts, and host operations. Existing bookings keep their saved price snapshot.</p></div>
          <Link className={styles.adminBackLink} href="/admin">← Back to dashboard</Link>
        </section>
        <PricingManagementClient pricing={staffPricing.pricing} history={staffPricing.history} />
      </div>
      <AdminBottomNav className={styles.adminBottomNav} activeClassName={styles.adminBottomNavActive} />
    </section>
  </main>;
}
