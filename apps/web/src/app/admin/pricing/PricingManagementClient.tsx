"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  formatPhpMinor,
  formatPricingPercent,
  type PricingHistoryEntry,
  type PricingSetting,
  type RechelsPricingConfig,
} from "@uppadar-hollie/shared/pricing";
import { updatePriceSetting, type PriceActionState } from "../actions";
import styles from "../admin.module.css";

const initialState: PriceActionState = { status: "idle" };
const decimalPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const managedPriceKeys = new Set<PricingSetting["key"]>([
  "whole_condo_nightly_rate",
  "refundable_security_deposit",
  "down_payment_percent",
]);

function inputValue(setting: PricingSetting) {
  if (setting.valueType === "percentage") return String(setting.percentage ?? 0);
  const amount = (setting.amountMinor ?? 0) / 100;
  return amount.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function displayValue(setting: PricingSetting) {
  return setting.valueType === "percentage"
    ? formatPricingPercent(setting.percentage ?? 0)
    : formatPhpMinor(setting.amountMinor ?? 0);
}

function maximumValue(setting: PricingSetting) {
  return setting.valueType === "percentage"
    ? setting.maximumPercentage
    : setting.maximumAmountMinor === null
      ? null
      : setting.maximumAmountMinor / 100;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function historyValue(entry: PricingHistoryEntry, next: boolean) {
  if (entry.valueType === "percentage") return formatPricingPercent(next ? entry.newPercentage ?? 0 : entry.previousPercentage ?? 0);
  return formatPhpMinor(next ? entry.newAmountMinor ?? 0 : entry.previousAmountMinor ?? 0);
}

export default function PricingManagementClient({
  pricing,
  history,
}: {
  pricing: RechelsPricingConfig;
  history: PricingHistoryEntry[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updatePriceSetting, initialState);
  const [editing, setEditing] = useState<PricingSetting | null>(null);
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submittedEditingKey, setSubmittedEditingKey] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [router, state.status]);

  const openEditor = (setting: PricingSetting) => {
    setEditing(setting);
    setSubmittedEditingKey(null);
    setValue(inputValue(setting));
    setReason("");
    setConfirmed(false);
  };

  const closeEditor = () => {
    if (pending) return;
    setEditing(null);
    setConfirmed(false);
    setReason("");
  };

  const validValue = Boolean(editing && decimalPattern.test(value.trim()) && Number(value) >= 0 && (maximumValue(editing) === null || Number(value) <= (maximumValue(editing) ?? 0)));

  return <>
    <section className={styles.pricingPage} aria-labelledby="pricing-heading">
      <div className={styles.pricingStatus}>
        <div><p className="eyebrow">Live configuration · Version {pricing.version}</p><h2 id="pricing-heading">Active prices</h2><p>Changes apply to new booking calculations immediately. Every setting is stored in PHP and tracked by revision.</p></div>
        {state.status === "success" ? <span className={styles.pricingSuccess} role="status">{state.message}</span> : null}
        {state.status === "error" ? <span className={styles.pricingError} role="alert">{state.message}</span> : null}
      </div>
      <div className={styles.pricingGrid}>
        {pricing.settings.filter((setting) => managedPriceKeys.has(setting.key)).map((setting) => <article className={styles.pricingCard} key={setting.key}>
          <div className={styles.pricingCardHeader}><div><p className={styles.pricingKey}>{setting.key}</p><h3>{setting.displayName}</h3></div><span className={styles.pricingRevision}>v{setting.revision}</span></div>
          <p className={styles.pricingDescription}>{setting.description}</p>
          <p className={styles.pricingValue}>{displayValue(setting)}</p>
          <dl className={styles.pricingMeta}>
            <div><dt>Currency</dt><dd>{setting.currency ?? "Policy"}</dd></div>
            <div><dt>Unit</dt><dd>{setting.unit}</dd></div>
            <div><dt>Updated</dt><dd>{formatDate(setting.updatedAt)}</dd></div>
            <div><dt>By</dt><dd>{setting.updatedBy ?? "System seed"}</dd></div>
          </dl>
          <button className={styles.pricingEdit} type="button" onClick={() => openEditor(setting)}>Edit price</button>
        </article>)}
      </div>
    </section>

    <section className={styles.pricingHistory} aria-labelledby="pricing-history-heading">
      <div><p className="eyebrow">Audit trail</p><h2 id="pricing-history-heading">Price history</h2><p>Every successful change records the previous value, new value, administrator, and optional reason.</p></div>
      {history.some((entry) => managedPriceKeys.has(entry.key)) ? <div className={styles.pricingHistoryList}>{history.filter((entry) => managedPriceKeys.has(entry.key)).map((entry) => <article className={styles.pricingHistoryRow} key={entry.id}>
        <div><strong>{entry.displayName}</strong><small>{formatDate(entry.changedAt)} · {entry.changedBy ?? "Unknown administrator"}</small></div>
        <div className={styles.pricingHistoryChange}><span>{historyValue(entry, false)}</span><b aria-hidden="true">→</b><strong>{historyValue(entry, true)}</strong></div>
        {entry.reason ? <p>{entry.reason}</p> : null}
      </article>)}</div> : <p className={styles.pricingEmpty}>No price changes have been recorded yet.</p>}
    </section>

    {editing && !(state.status === "success" && submittedEditingKey === editing.key) ? <div className={styles.pricingBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor(); }}>
      <section className={styles.pricingDialog} role="dialog" aria-modal="true" aria-labelledby="pricing-dialog-heading">
        <div className={styles.pricingDialogHeader}><div><p className="eyebrow">Revision {editing.revision}</p><h2 id="pricing-dialog-heading">Edit {editing.displayName}</h2></div><button type="button" className={styles.pricingClose} aria-label="Close price editor" onClick={closeEditor}>×</button></div>
        <p className={styles.pricingDescription}>{editing.description}</p>
        <div className={styles.pricingPreview}><div><span>Current</span><strong>{displayValue(editing)}</strong></div><span aria-hidden="true">→</span><div><span>New</span><strong>{validValue ? editing.valueType === "percentage" ? `${Number(value)}%` : formatPhpMinor(Math.round(Number(value) * 100)) : "—"}</strong></div></div>
        <form className={styles.pricingForm} action={action} onSubmit={() => setSubmittedEditingKey(editing.key)}>
          <input type="hidden" name="priceKey" value={editing.key} />
          <input type="hidden" name="expectedRevision" value={editing.revision} />
          <label><span>{editing.valueType === "percentage" ? "New percentage" : "New amount in PHP"}</span><input name="value" value={value} onChange={(event) => setValue(event.target.value)} inputMode="decimal" pattern="(?:0|[1-9]\d*)(?:\.\d{1,2})?" required aria-describedby="pricing-value-help" disabled={pending} /></label>
          <small id="pricing-value-help">Up to two decimal places{maximumValue(editing) === null ? "" : ` · Maximum ${editing.valueType === "percentage" ? `${maximumValue(editing)}%` : `₱${maximumValue(editing)?.toLocaleString("en-PH")}`}`}</small>
          <label><span>Reason (optional)</span><textarea name="reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} placeholder="Why is this rate changing?" disabled={pending} /></label>
          <label className={styles.pricingConfirm}><input type="checkbox" name="confirm" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} required disabled={pending} /><span>I confirm this change applies to new bookings and will not reprice existing reservations.</span></label>
          {state.status === "error" ? <p className={styles.pricingError} role="alert">{state.message}</p> : null}
          <div className={styles.pricingActions}><button type="button" className={styles.pricingCancel} onClick={closeEditor} disabled={pending}>Cancel</button><button type="submit" className={styles.pricingSave} disabled={pending || !confirmed || !validValue}>{pending ? "Saving…" : "Save price"}</button></div>
        </form>
      </section>
    </div> : null}
  </>;
}
