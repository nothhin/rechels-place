"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { showError, showSuccess } from "@/lib/sweetalert";
import styles from "../admin.module.css";

export type AirbnbSyncPanelStatus = {
  status: "never" | "running" | "succeeded" | "failed";
  lastSucceededAt: string | null;
  lastFailedAt: string | null;
  lastError: string | null;
  eventsSeen: number;
  conflictsSeen: number;
  activeEvents: number;
  websiteBookings: number;
  syncLockUntil: string | null;
  recentRuns: AirbnbSyncPanelRun[];
};

export type AirbnbSyncPanelRun = {
  id: string;
  triggerSource: "manual" | "cron" | "background";
  importSource: "admin" | "vercel" | "unknown";
  status: "running" | "succeeded" | "failed";
  startedAt: string;
  finishedAt: string | null;
  eventsSeen: number;
  conflictsSeen: number;
  activeEvents: number;
  errorMessage: string | null;
};

function formatSyncTime(value: string | null) {
  if (!value) return "Not synced yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function syncStatusLabel(status: AirbnbSyncPanelStatus["status"]) {
  if (status === "succeeded") return "Healthy";
  if (status === "running") return "Sync in progress";
  if (status === "failed") return "Needs attention";
  return "Not synced yet";
}

export default function AirbnbCalendarSyncPanel({
  status,
  importConfigured,
  exportConfigured,
  importSource,
}: {
  status: AirbnbSyncPanelStatus;
  importConfigured: boolean;
  exportConfigured: boolean;
  importSource: "admin" | "vercel" | "none";
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const canSync = importConfigured && !syncing && status.status !== "running";

  const saveLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/airbnb-calendar/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importUrl }),
      });
      const body = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error || "Could not save the calendar link.");
      setImportUrl("");
      await showSuccess("Airbnb calendar link saved. Select Sync Airbnb now to import the latest dates.");
      router.refresh();
    } catch (error) {
      await showError(error instanceof Error ? error.message : "Could not save the calendar link.");
    } finally {
      setSaving(false);
    }
  };

  const restoreVercelLink = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/airbnb-calendar/settings", { method: "DELETE" });
      const body = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error || "Could not restore the Vercel link.");
      await showSuccess("The Vercel calendar link is active again.");
      router.refresh();
    } catch (error) {
      await showError(error instanceof Error ? error.message : "Could not restore the Vercel link.");
    } finally {
      setSaving(false);
    }
  };

  const syncNow = async () => {
    if (!canSync) return;
    setSyncing(true);
    try {
      const response = await fetch("/api/admin/airbnb-calendar/sync", { method: "POST", cache: "no-store" });
      const body = await response.json() as { ok?: boolean; error?: string; data?: { eventsSeen: number } };
      if (!response.ok || !body.ok) throw new Error(body.error || "Airbnb calendar sync failed.");
      await showSuccess(`Airbnb calendar synced. ${body.data?.eventsSeen ?? 0} event(s) imported.`);
      router.refresh();
    } catch (error) {
      await showError(error instanceof Error ? error.message : "Airbnb calendar sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  const copyExportUrl = async () => {
    if (copying) return;
    setCopying(true);
    try {
      const response = await fetch("/api/admin/airbnb-calendar/export-url", { cache: "no-store" });
      const body = await response.json() as { ok?: boolean; url?: string; error?: string };
      if (!response.ok || !body.ok || !body.url) throw new Error(body.error || "The website feed URL is unavailable.");
      await navigator.clipboard.writeText(body.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      await showError(error instanceof Error ? error.message : "Your browser could not copy the feed URL.");
    } finally {
      setCopying(false);
    }
  };

  return (
    <section className={`${styles.operationsSidePanel} ${styles.airbnbSyncPanel}`} aria-labelledby="airbnb-sync-title">
      <div className={styles.panelHeading}>
        <p className={styles.eyebrow}>External calendar</p>
        <h2 id="airbnb-sync-title">Airbnb availability sync</h2>
        <p>Airbnb dates and website bookings are kept in the same availability check.</p>
      </div>
      <div className={styles.airbnbSyncGrid}>
        <div><span>Airbnb → website</span><strong data-ready={importConfigured}>{importConfigured ? "Connected" : "Needs setup"}</strong></div>
        <div><span>Website → Airbnb</span><strong data-ready={exportConfigured}>{exportConfigured ? "Feed ready" : "Needs setup"}</strong></div>
        <div><span>Imported dates</span><strong>{status.activeEvents}</strong></div>
        <div><span>Website bookings</span><strong>{status.websiteBookings}</strong></div>
        <div><span>Sync status</span><strong>{syncStatusLabel(status.status)}</strong><small>{formatSyncTime(status.lastSucceededAt)}</small></div>
      </div>
      <form className={styles.airbnbLinkForm} onSubmit={saveLink}>
        <label htmlFor="airbnb-ical-url">Airbnb export link</label>
        <p>Paste the private .ics link from Airbnb. It is saved server-side and overrides the Vercel link. The saved link is never shown here.</p>
        <div>
          <input
            id="airbnb-ical-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://www.airbnb.com/calendar/ical/… .ics?t=…"
            value={importUrl}
            onChange={(event) => setImportUrl(event.target.value)}
            required
            disabled={saving}
          />
          <button type="submit" disabled={saving || !importUrl.trim()}>{saving ? "Saving…" : "Save link"}</button>
        </div>
        <small>Current source: {importSource === "admin" ? "Admin-saved link" : importSource === "vercel" ? "Vercel environment variable" : "Not configured"}</small>
        {importSource === "admin" ? <button type="button" className={styles.airbnbRestoreButton} onClick={restoreVercelLink} disabled={saving}>Use Vercel link instead</button> : null}
      </form>
      {exportConfigured ? (
        <div className={styles.airbnbExportFeed}>
          <label>Website availability feed</label>
          <p>The private URL is generated only after you request it. Copy it into Airbnb’s calendar import and do not post it publicly.</p>
          <div>
            <span className={styles.airbnbExportFeedPlaceholder}>/api/calendar/airbnb/••••••••.ics</span>
            <button type="button" onClick={copyExportUrl} disabled={copying}>{copying ? "Preparing…" : copied ? "Copied" : "Copy URL"}</button>
          </div>
          <small>Website requests and manual blocks are exported as generic unavailable dates. Airbnb dates are never exported back.</small>
        </div>
      ) : null}
      {status.conflictsSeen > 0 ? <p className={styles.airbnbSyncWarning} role="alert">{status.conflictsSeen} imported date range(s) overlap an existing website stay. Review the conflict before confirming anything.</p> : null}
      {status.status === "failed" && status.lastError ? <p className={styles.airbnbSyncError} role="alert">Last sync failed: {status.lastError}</p> : null}
      <div className={styles.airbnbSyncActions}>
        <button type="button" onClick={syncNow} disabled={!canSync}>{syncing ? "Syncing…" : status.status === "failed" ? "Retry sync" : "Sync Airbnb now"}</button>
        <small>{status.status === "running" ? `Another sync is running${status.syncLockUntil ? ` until ${formatSyncTime(status.syncLockUntil)}` : ""}.` : status.lastFailedAt ? `Last failed ${formatSyncTime(status.lastFailedAt)}` : "Automatic refresh runs when the calendar is viewed and on the configured scheduler."}</small>
      </div>
      {status.recentRuns.length ? (
        <details className={styles.airbnbSyncHistory}>
          <summary>Recent sync history</summary>
          <div>
            {status.recentRuns.map((run) => (
              <article key={run.id}>
                <strong>{run.status === "succeeded" ? "Succeeded" : run.status === "failed" ? "Failed" : "Running"}</strong>
                <span>{run.triggerSource} · {formatSyncTime(run.startedAt)}</span>
                <small>{run.status === "failed" ? run.errorMessage : `${run.eventsSeen} imported · ${run.activeEvents} active`}</small>
              </article>
            ))}
          </div>
        </details>
      ) : null}
      {!importConfigured || !exportConfigured ? <p className={styles.airbnbSyncSetup}>Add an Airbnb export link above. The website-to-Airbnb feed still requires the server-only export token and service key in Vercel.</p> : null}
    </section>
  );
}
