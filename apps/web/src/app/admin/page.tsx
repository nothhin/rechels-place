import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { propertyLogoSrc, propertyProfile } from "@/lib/property";
import { requireStaff } from "@/lib/server/admin-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { AdminBottomNav, AdminMobileNav, AdminNav } from "./AdminNav";
import { AdminLiveRefresh } from "./AdminLiveRefresh";
import { AdminFlashAlert } from "./AdminFlashAlert";
import {
  AdminCalendar,
  type AdminCalendarBlock,
  type AdminCalendarBooking,
  type AdminCalendarExternalBlock,
} from "./AdminCalendar";
import {
  BookingRequestsPanel,
  type AdminEnquiry,
} from "./BookingRequestsPanel";
import styles from "./admin.module.css";

export const metadata: Metadata = {
  title: "Property admin | Rechel's Place",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
type DashboardData = { enquiries: AdminEnquiry[] };
type CalendarData = {
  bookings: AdminCalendarBooking[];
  blocks: AdminCalendarBlock[];
  externalBlocks: AdminCalendarExternalBlock[];
};
const mobileClasses = (styles: { [key: string]: string }) => ({
  button: styles.mobileMenu,
  backdrop: styles.mobileBackdrop,
  drawer: styles.mobileDrawer,
  drawerOpen: styles.mobileDrawerOpen,
  drawerHeader: styles.mobileDrawerHeader,
  closeButton: styles.mobileCloseButton,
  active: styles.mobileActiveNav,
});

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const staff = await requireStaff();
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_rechels_admin_dashboard_v2");
  if (error || !data) throw new Error("Admin data is unavailable.");
  const { enquiries } = data as DashboardData;
  const { data: calendarData, error: calendarError } = await supabase.rpc(
    "staff_get_snowaz_calendar",
  );
  if (calendarError || !calendarData) {
    console.error("[admin-calendar] load failed", {
      code: calendarError?.code ?? "missing-data",
    });
    throw new Error("Admin calendar data is unavailable.");
  }
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: propertyProfile.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const active = enquiries.filter(
    (item) => !["cancelled", "declined"].includes(item.status),
  );
  const confirmed = active.filter((item) => item.status === "confirmed");
  const requests = active.filter((item) => item.status !== "confirmed");
  const arrivals = confirmed.filter((item) => item.checkIn === today).length;
  const departures = confirmed.filter((item) => item.checkOut === today).length;
  const paymentsToVerify = requests.filter(
    (item) => item.depositStatus === "submitted",
  ).length;
  const staying = confirmed.filter(
    (item) => item.checkIn <= today && item.checkOut > today,
  ).length;
  const canManage = ["admin", "manager"].includes(staff.role);
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: propertyProfile.timezone,
  }).format(now);
  const fullDate = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: propertyProfile.timezone,
  }).format(now);
  return (
    <main className={styles.dashboardShell}>
      <aside className={styles.sidebar}>
        <Link className={styles.adminBrand} href="/">
          <Image src={propertyLogoSrc} alt="Rechel's Place" width={58} height={58} />
          <div>
            <strong>Rechel’s Place</strong>
            <small>Host workspace · Cagayan de Oro</small>
          </div>
        </Link>
        <AdminNav activeClassName={styles.activeNav} />
        <div className={styles.sidebarFooter}>
          <span className={styles.statusDot} />
          <div>
            <strong>Rechel’s Place live</strong>
            <AdminLiveRefresh />
          </div>
        </div>
      </aside>
      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <AdminMobileNav classes={mobileClasses(styles)} />
          <div>
            <span className={styles.systemOnline}><i aria-hidden="true" />Live system online</span>
            <strong>{weekday}, {fullDate} · {propertyProfile.timezone}</strong>
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
          <AdminFlashAlert saved={params.saved} error={params.error} />
          <section id="overview" className={styles.welcome}>
            <div>
              <p className={styles.eyebrow}>Today at Rechel’s Place</p>
              <h1>Good day.</h1>
              <p>Start with the items below. The most important task is shown first.</p>
            </div>
            <div className={styles.liveBadge}>
              <strong>System online</strong>
              <span>
                Changes from guests and staff appear automatically without
                reloading.
              </span>
            </div>
          </section>
          <section className={styles.adminQuickActions} aria-label="Quick host actions">
            <Link href="#booking-requests"><span aria-hidden="true">＋</span><small>Booking requests</small></Link>
            <Link href="#calendar"><span aria-hidden="true">▣</span><small>Block dates</small></Link>
            <Link href="/admin/confirmed"><span aria-hidden="true">✓</span><small>Upcoming guests</small></Link>
            <Link href="/admin/settings"><span aria-hidden="true">•••</span><small>Settings</small></Link>
          </section>
          <section className={styles.attentionPanel} aria-labelledby="attention-title">
            <div className={styles.attentionHeader}>
              <div><p className={styles.eyebrow}>Your next steps</p><h2 id="attention-title">Needs your attention</h2></div>
              <span>{requests.length + arrivals + departures} items</span>
            </div>
            <div className={styles.attentionList}>
              <Link href="#booking-requests" data-urgent={requests.length > 0}>
                <span aria-hidden="true">1</span><div><strong>{requests.length ? `${requests.length} booking ${requests.length === 1 ? "request needs" : "requests need"} a response` : "No new booking requests"}</strong><small>{requests.length ? "Review the guest details and choose the next step." : "You are all caught up."}</small></div><b>{requests.length ? "Review" : "Done"}</b>
              </Link>
              <Link href="#booking-requests" data-urgent={paymentsToVerify > 0}>
                <span aria-hidden="true">2</span><div><strong>{paymentsToVerify ? `${paymentsToVerify} payment ${paymentsToVerify === 1 ? "is" : "are"} ready to verify` : "No payments waiting for verification"}</strong><small>{paymentsToVerify ? "Check the payment before confirming the stay." : "Nothing to verify right now."}</small></div><b>{paymentsToVerify ? "Verify" : "Done"}</b>
              </Link>
              <Link href="/admin/confirmed" data-urgent={arrivals + departures > 0}>
                <span aria-hidden="true">3</span><div><strong>{arrivals} arriving · {departures} checking out today</strong><small>Open the guest list for contact and payment details.</small></div><b>View</b>
              </Link>
            </div>
          </section>
          <section className={styles.sanctuaryCard} aria-label="Property status">
            <div className={styles.sanctuaryHeader}><div><p className={styles.eyebrow}>Sanctuary status</p><h2>Avida Aspira Tower 1 · Two-bedroom condo</h2></div><span className={styles.statusPill}>LIVE</span></div>
            <div className={styles.sanctuaryBody}><div><strong>{staying ? "Currently staying" : "Ready for guests"}</strong><small>{staying ? `${staying} confirmed stay in the condo` : "No active guest stay right now"}</small></div><div className={styles.sanctuaryMeta}><span>{confirmed.length} confirmed</span><span>{requests.length} awaiting action</span></div></div>
          </section>
      <section className={styles.metricsGrid} aria-label="Property summary">
            {[
              {
            label: "Booking requests",
                value: requests.length,
                note: "Need your response",
              },
              {
                label: "Upcoming guests",
                value: confirmed.length,
                note: "Verified bookings",
              },
              {
                label: "Arrivals today",
                value: arrivals,
                note: "Confirmed arrivals",
              },
              {
                label: "Currently staying",
                value: staying,
                note: "Guests in the condo",
              },
            ].map((metric) => (
              <article key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.note}</small>
              </article>
            ))}
      </section>
      <Link className={styles.confirmedStaysButton} href="/admin/confirmed">
        Open upcoming guests <span>{confirmed.length}</span>
      </Link>
      <BookingRequestsPanel enquiries={enquiries} canManage={canManage} />
          <AdminCalendar
            bookings={(calendarData as CalendarData).bookings ?? []}
            blocks={(calendarData as CalendarData).blocks ?? []}
            externalBlocks={(calendarData as CalendarData).externalBlocks ?? []}
            canManage={canManage}
          />
        </div>
      </section>
      <AdminBottomNav className={styles.adminBottomNav} activeClassName={styles.adminBottomNavActive} />
    </main>
  );
}
