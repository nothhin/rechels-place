import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { propertyLogoSrc } from "@/lib/property";
import { requireStaff } from "@/lib/server/admin-auth";
import { signOut } from "../actions";
import { AdminBottomNav, AdminMobileNav, AdminNav } from "../AdminNav";
import { AdminLiveRefresh } from "../AdminLiveRefresh";
import styles from "../admin.module.css";

export const metadata: Metadata = {
  title: "Settings | Rechel's Place",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const mobileClasses = {
  button: styles.mobileMenu,
  backdrop: styles.mobileBackdrop,
  drawer: styles.mobileDrawer,
  drawerOpen: styles.mobileDrawerOpen,
  drawerHeader: styles.mobileDrawerHeader,
  closeButton: styles.mobileCloseButton,
  active: styles.mobileActiveNav,
};

export default async function SettingsPage() {
  const staff = await requireStaff(["manager", "admin"]);
  return <main className={styles.dashboardShell}>
    <aside className={styles.sidebar}>
      <Link className={styles.adminBrand} href="/"><Image src={propertyLogoSrc} alt="Rechel's Place" width={48} height={48}/><div><strong>Rechel’s Place</strong><small>Host workspace</small></div></Link>
      <AdminNav activeClassName={styles.activeNav}/>
      <div className={styles.sidebarFooter}><span className={styles.statusDot}/><div><strong>Rechel’s Place live</strong><AdminLiveRefresh/></div></div>
    </aside>
    <section className={styles.workspace}>
      <header className={styles.topbar}>
        <AdminMobileNav classes={mobileClasses}/>
        <div><span>Settings</span><strong>Property setup</strong></div>
        <div className={styles.adminIdentity}><span>{staff.email.slice(0,2).toUpperCase()}</span><div><strong>{staff.email}</strong><small>{staff.role.replace("_"," ")}</small></div><form action={signOut}><button type="submit">Sign out</button></form></div>
      </header>
      <div className={styles.content}>
        <section className={`${styles.welcome} ${styles.settingsWelcome}`}>
          <div><p className={styles.eyebrow}>Property setup</p><h1>Settings.</h1><p>Change occasional property settings here. Daily booking and payment work stays in the main dashboard.</p></div>
          <Link className={styles.adminBackLink} href="/admin">← Back to home</Link>
        </section>
        <section className={styles.settingsGrid} aria-label="Property settings">
          <Link href="/admin/pricing"><span className={styles.settingsIcon} aria-hidden="true">₱</span><div><p className={styles.eyebrow}>Booking prices</p><h2>Rates & fees</h2><p>Change nightly rates, parking fees, and extra-time charges for new bookings.</p></div><b>Open rates <span aria-hidden="true">→</span></b></Link>
          <Link href="/admin#calendar"><span className={styles.settingsIcon} aria-hidden="true">□</span><div><p className={styles.eyebrow}>Availability</p><h2>Block dates</h2><p>Mark dates unavailable or reopen dates directly from the property calendar.</p></div><b>Open calendar <span aria-hidden="true">→</span></b></Link>
          <Link href="/admin/settings/airbnb"><span className={styles.settingsIcon} aria-hidden="true">↔</span><div><p className={styles.eyebrow}>External calendar</p><h2>Airbnb calendar sync</h2><p>View sync health, update the Airbnb link, and copy the website calendar feed.</p></div><b>Manage sync <span aria-hidden="true">→</span></b></Link>
        </section>
        <aside className={styles.settingsHelp}><strong>Not sure where to go?</strong><p>Use Home for new requests, Calendar for availability, Upcoming Guests for confirmed stays, and Payments & tasks for money already received or still due.</p></aside>
      </div>
      <AdminBottomNav className={styles.adminBottomNav} activeClassName={styles.adminBottomNavActive}/>
    </section>
  </main>;
}
