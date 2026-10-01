import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { propertyLogoSrc, propertyProfile } from "@/lib/property";
import { requireStaff } from "@/lib/server/admin-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOut } from "../actions";
import { AdminLiveRefresh } from "../AdminLiveRefresh";
import { AdminBottomNav, AdminMobileNav, AdminNav } from "../AdminNav";
import {
  BookingOperations,
  NotificationQueue,
  type OpsBooking,
  type OpsNotification,
} from "./OperationsClient";
import styles from "../admin.module.css";
export const metadata: Metadata = {
  title: "Payments & tasks | Rechel's Place",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
type Operations = {
  bookings: OpsBooking[];
  notifications: OpsNotification[];
};
const mobileClasses = {
  button: styles.mobileMenu,
  backdrop: styles.mobileBackdrop,
  drawer: styles.mobileDrawer,
  drawerOpen: styles.mobileDrawerOpen,
  drawerHeader: styles.mobileDrawerHeader,
  closeButton: styles.mobileCloseButton,
  active: styles.mobileActiveNav,
};
export default async function OperationsPage() {
  const staff = await requireStaff(["manager", "admin"]);
  const supabase = await createSupabaseServerClient();
  let { data, error } = await supabase.rpc("staff_get_rechels_operations_v2");
  if (error || !data) {
    // A temporary Data API failure must not immediately blank the workspace.
    await new Promise((resolve) => setTimeout(resolve, 300));
    ({ data, error } = await supabase.rpc("staff_get_rechels_operations_v2"));
  }
  if (error || !data) console.error("[admin-operations] load failed", { code: error?.code ?? "missing-data" });
  if (error || !data) throw new Error("Operations data is unavailable.");
  const ops = data as Operations;
  const active = ops.bookings.filter(
    (item) => !["cancelled", "declined"].includes(item.bookingStatus),
  );
  const total = active.reduce((sum, b) => sum + b.totalMinor, 0);
  const paid = active.reduce((sum, b) => sum + b.paidMinor, 0);
  const outstanding = active.reduce((sum, b) => sum + b.remainingMinor, 0);
  const money = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  });
  return (
    <main className={styles.dashboardShell}>
      <aside className={styles.sidebar}>
        <Link className={styles.adminBrand} href="/">
          <Image
            src={propertyLogoSrc}
            alt=""
            width={48}
            height={48}
          />
          <div>
            <strong>Rechel’s Place</strong>
            <small>Property admin</small>
          </div>
        </Link>
        <AdminNav activeClassName={styles.activeNav} />
        <div className={styles.sidebarFooter}>
          <span className={styles.statusDot} />
          <div>
            <strong>Live operations</strong>
            <AdminLiveRefresh />
          </div>
        </div>
      </aside>
      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <AdminMobileNav classes={mobileClasses} />
          <div>
            <span>Payments & tasks</span>
            <strong>Live booking controls</strong>
          </div>
          <div className={styles.adminIdentity}>
            <span>{staff.email.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{staff.email}</strong>
              <small>{staff.role.replace("_", " ")}</small>
            </div>
            <form action={signOut}>
              <button type="submit">Sign out</button>
            </form>
          </div>
        </header>
        <div className={styles.content}>
          <section className={styles.welcome}>
            <div>
              <p className={styles.eyebrow}>Rechel’s Place control center</p>
              <h1>Payments & tasks.</h1>
              <p>
                Review stays, record payments, and track guest follow-ups.
              </p>
            </div>
            <div className={styles.liveBadge}>
              <strong>Connected everywhere</strong>
              <span>
                Saved changes update the admin dashboard, calendar, confirmed
                stays, and the guest’s private receipt.
              </span>
            </div>
          </section>
          <section
            className={styles.metricsGrid}
            aria-label="Financial summary"
          >
            {[
              {
                label: "Active booking value",
                value: money.format(total / 100),
                note: `${active.length} active booking${active.length === 1 ? "" : "s"}`,
              },
              {
                label: "Payments received",
                value: money.format(paid / 100),
                note: "Verified ledger entries",
              },
              {
                label: "Outstanding",
                value: money.format(outstanding / 100),
                note: "Guest balances due",
              },
              {
                label: "Follow-ups",
                value: String(
                  ops.notifications.filter((n) => n.status === "queued").length,
                ),
                note: "Queued notifications",
              },
            ].map((x) => (
              <article key={x.label}>
                <span>{x.label}</span>
                <strong>{x.value}</strong>
                <small>{x.note}</small>
              </article>
            ))}
          </section>
          <BookingOperations bookings={ops.bookings} />
          <div className={styles.operationsLowerGrid}>
            <NotificationQueue notifications={ops.notifications} />
          </div>
          <footer className={styles.operationsFooter}>
            <span>
              {propertyProfile.displayName} · {propertyProfile.timezone}
            </span>
            <Link href="/admin">Return to overview</Link>
          </footer>
        </div>
        <AdminBottomNav
          className={styles.adminBottomNav}
          activeClassName={styles.adminBottomNavActive}
        />
      </section>
    </main>
  );
}
