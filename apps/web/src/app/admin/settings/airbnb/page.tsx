import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { propertyLogoSrc } from "@/lib/property";
import { requireStaff } from "@/lib/server/admin-auth";
import { isAirbnbCalendarConfigured } from "@/lib/server/airbnb-calendar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOut } from "../../actions";
import { AdminBottomNav, AdminMobileNav, AdminNav } from "../../AdminNav";
import { AdminLiveRefresh } from "../../AdminLiveRefresh";
import AirbnbCalendarSyncPanel, { type AirbnbSyncPanelStatus } from "../../operations/AirbnbCalendarSyncPanel";
import styles from "../../admin.module.css";

export const metadata: Metadata = {
  title: "Airbnb calendar | Rechel's Place",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const emptyStatus: AirbnbSyncPanelStatus = {
  status: "never", lastSucceededAt: null, lastFailedAt: null, lastError: null,
  eventsSeen: 0, conflictsSeen: 0, activeEvents: 0, websiteBookings: 0,
  syncLockUntil: null, recentRuns: [],
};

const mobileClasses = {
  button: styles.mobileMenu, backdrop: styles.mobileBackdrop,
  drawer: styles.mobileDrawer, drawerOpen: styles.mobileDrawerOpen,
  drawerHeader: styles.mobileDrawerHeader, closeButton: styles.mobileCloseButton,
  active: styles.mobileActiveNav,
};

export default async function AirbnbSettingsPage() {
  const staff = await requireStaff(["manager", "admin"]);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("staff_get_snowaz_airbnb_sync_status");
  const raw = (data ?? {}) as Partial<AirbnbSyncPanelStatus>;
  const status: AirbnbSyncPanelStatus = { ...emptyStatus, ...raw, status: raw.status ?? "never", syncLockUntil: raw.syncLockUntil ?? null, recentRuns: raw.recentRuns ?? [] };
  const configuration = await isAirbnbCalendarConfigured();

  return <main className={styles.dashboardShell}>
    <aside className={styles.sidebar}>
      <Link className={styles.adminBrand} href="/"><Image src={propertyLogoSrc} alt="Rechel's Place" width={48} height={48}/><div><strong>Rechel’s Place</strong><small>Host workspace</small></div></Link>
      <AdminNav activeClassName={styles.activeNav}/>
      <div className={styles.sidebarFooter}><span className={styles.statusDot}/><div><strong>Calendar connected</strong><AdminLiveRefresh/></div></div>
    </aside>
    <section className={styles.workspace}>
      <header className={styles.topbar}>
        <AdminMobileNav classes={mobileClasses}/>
        <div><span>Settings</span><strong>Airbnb calendar</strong></div>
        <div className={styles.adminIdentity}><span>{staff.email.slice(0,2).toUpperCase()}</span><div><strong>{staff.email}</strong><small>{staff.role.replace("_"," ")}</small></div><form action={signOut}><button type="submit">Sign out</button></form></div>
      </header>
      <div className={styles.content}>
        <section className={`${styles.welcome} ${styles.settingsWelcome}`}>
          <div><p className={styles.eyebrow}>Calendar connection</p><h1>Airbnb sync.</h1><p>This is an advanced setting. Once connected, normal calendar updates happen automatically.</p></div>
          <Link className={styles.adminBackLink} href="/admin/settings">← Back to settings</Link>
        </section>
        <AirbnbCalendarSyncPanel status={status} importConfigured={configuration.importConfigured} exportConfigured={configuration.exportConfigured} importSource={configuration.importSource}/>
      </div>
      <AdminBottomNav className={styles.adminBottomNav} activeClassName={styles.adminBottomNavActive}/>
    </section>
  </main>;
}
