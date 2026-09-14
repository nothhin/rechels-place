import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireStaff } from "@/lib/server/admin-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOut } from "../actions";
import { AdminBottomNav, AdminMobileNav, AdminNav } from "../AdminNav";
import { AdminLiveRefresh } from "../AdminLiveRefresh";
import { ConfirmedBookingsPanel } from "../ConfirmedBookingsPanel";
import type { AdminEnquiry } from "../BookingRequestsPanel";
import styles from "../admin.module.css";

export const metadata: Metadata = {
  title: "Confirmed bookings | Rechel's Place",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function ConfirmedBookingsPage() {
  const staff = await requireStaff();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_snowaz_admin_dashboard");
  if (error || !data) throw new Error("Confirmed bookings are unavailable.");
  const enquiries = (data as { enquiries: AdminEnquiry[] }).enquiries;
  const canManage = ["admin", "manager"].includes(staff.role);
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
        <Image src="/images/rechel-s-place/logo.svg" alt="Rechel's Place" width={48} height={48}/>
        <div><strong>Rechel’s Place</strong><small>Host workspace</small></div>
      </Link>
      <AdminNav activeClassName={styles.activeNav}/>
      <div className={styles.sidebarFooter}><span className={styles.statusDot}/><div><strong>Rechel’s Place live</strong><AdminLiveRefresh/></div></div>
    </aside>
    <section className={styles.workspace}>
      <header className={styles.topbar}>
        <AdminMobileNav classes={classes}/>
        <div><span>Confirmed stays</span><strong>Verified guest bookings</strong></div>
        <div className={styles.adminIdentity}><span>{staff.email.slice(0,2).toUpperCase()}</span><div><strong>{staff.email}</strong><small>{staff.role.replace("_"," ")}</small></div><form action={signOut}><button type="submit">Sign out</button></form></div>
      </header>
      <div className={styles.content}>
        <section className={styles.welcome}>
          <div><p className={styles.eyebrow}>Front desk</p><h1>Confirmed bookings.</h1><p>Bookings move here automatically after the required payment is verified.</p></div>
          <Link className={styles.adminBackLink} href="/admin">← Back to dashboard</Link>
        </section>
        <ConfirmedBookingsPanel bookings={enquiries} canManage={canManage}/>
      </div>
      <AdminBottomNav className={styles.adminBottomNav} activeClassName={styles.adminBottomNavActive}/>
    </section>
  </main>;
}
