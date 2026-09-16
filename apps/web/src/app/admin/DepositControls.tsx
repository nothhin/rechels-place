"use client";

import { useActionState, useEffect, useState } from "react";
import { bookingRequestStatusSchema, canTransitionBookingRequestStatus, isTerminalBookingRequestStatus } from "@uppadar-hollie/shared/booking-lifecycle";
import { formatPhpMinor, formatPricingPercent } from "@uppadar-hollie/shared/pricing";
import { markDepositRefunded, recordAndVerifyDeposit, startDepositRequest, updateBookingRequestStatus, verifyDeposit, type DepositActionState } from "./actions";
import { confirmAction, showError, showSuccess } from "@/lib/sweetalert";

const initialState: DepositActionState = { status: "idle" };

export function DepositControls({ bookingId, bookingStatus = "pending", depositStatus, canManage, downPaymentMinor, securityDepositAmountMinor, totalMinor }: { bookingId: string; bookingStatus?: string; depositStatus: string; canManage: boolean; downPaymentMinor?: number; securityDepositAmountMinor?: number; totalMinor?: number }) {
  const [startState, startAction, startPending] = useActionState(startDepositRequest, initialState);
  const [verifyState, verifyAction, verifyPending] = useActionState(verifyDeposit, initialState);
  const [recordState, recordAction, recordPending] = useActionState(recordAndVerifyDeposit, initialState);
  const [refundState, refundAction, refundPending] = useActionState(markDepositRefunded, initialState);
  const [statusState, statusAction, statusPending] = useActionState(updateBookingRequestStatus, initialState);
  const [copied, setCopied] = useState(false);
  const result = [startState, verifyState, recordState, refundState, statusState].findLast((item) => item.status !== "idle") ?? initialState;
  const downPaymentLabel = downPaymentMinor !== undefined && totalMinor
    ? `${formatPricingPercent((downPaymentMinor / totalMinor) * 100)} down payment`
    : "configured down payment";
  const securityDepositLabel = securityDepositAmountMinor !== undefined
    ? `${formatPhpMinor(securityDepositAmountMinor)} refundable security deposit`
    : "configured refundable security deposit";

  useEffect(() => {
    if (result.status === "success") {
      window.dispatchEvent(new Event("snowaz:admin-changed"));
      if (result.message) void showSuccess(result.message);
    } else if (result.status === "error" && result.message) void showError(result.message);
  }, [result.status, result.message, result.link]);

  const confirmStatusChange = async (event: React.FormEvent<HTMLFormElement>, kind: "decline" | "cancel") => {
    const form = event.currentTarget;
    if (form.dataset.confirmed === "true") return;
    event.preventDefault();
    const confirmed = await confirmAction(
      kind === "decline" ? "Decline this request?" : "Cancel this booking?",
      kind === "decline" ? "The dates will reopen for other guests." : "The confirmed stay will be cancelled and its dates will reopen. Any payment refund follows the host’s confirmed cancellation policy.",
      kind === "decline" ? "Decline request" : "Cancel booking",
    );
    if (confirmed) { form.dataset.confirmed = "true"; form.requestSubmit(); }
  };

  const confirmPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    if (form.dataset.confirmed === "true") return;
    event.preventDefault();
    const confirmed = await confirmAction("Confirm this down payment?", `Only continue after matching the ${downPaymentLabel}, sender, and transaction reference in the configured payment account. This will confirm the booking and block its dates.`, "Confirm down payment");
    if (confirmed) { form.dataset.confirmed = "true"; form.requestSubmit(); }
  };

  if (!canManage) return <small>Manager verification required</small>;
  if (startState.status === "success" && startState.link) return <div className="deposit-admin-actions"><a href={startState.link} target="_blank" rel="noreferrer">Open guest payment page</a><button type="button" onClick={async () => { await navigator.clipboard.writeText(`${window.location.origin}${startState.link}`); setCopied(true); void showSuccess("Private guest link copied."); }}>{copied ? "Link copied" : "Copy guest link"}</button><small>Send this private link to the guest. Generating a new link invalidates this one.</small></div>;

  const parsedBookingStatus = bookingRequestStatusSchema.safeParse(bookingStatus);
  const currentBookingStatus = parsedBookingStatus.success ? parsedBookingStatus.data : null;
  const active = currentBookingStatus ? !isTerminalBookingRequestStatus(currentBookingStatus) : false;
  const canDecline = currentBookingStatus
    ? canTransitionBookingRequestStatus(currentBookingStatus, "declined")
    : false;
  const canCancel = currentBookingStatus === "confirmed"
    ? canTransitionBookingRequestStatus(currentBookingStatus, "cancelled")
    : false;
  return <div className="deposit-admin-actions">
    <div className="deposit-workflow-header"><span>Payment workflow</span><strong>{depositStatus === "submitted" ? "Verify submitted down payment" : depositStatus === "verified" || depositStatus === "refund_pending" ? "Down payment verified" : `Record ${downPaymentLabel}`}</strong><small>Verify the payment account and the {downPaymentLabel} before confirming the stay. The {securityDepositLabel} is collected separately upon check-in.</small></div>
    {active && depositStatus === "not_requested" ? <div className="deposit-action-card"><h4>Start the down-payment request</h4><p>Generate a private payment page for this guest.</p><form action={startAction}><input type="hidden" name="bookingId" value={bookingId} /><button disabled={startPending}>{startPending ? "Preparing…" : "Prepare secure payment link"}</button></form></div> : null}
    {active && depositStatus === "awaiting_payment" ? <div className="deposit-action-card deposit-action-primary"><h4>Record {downPaymentLabel} &amp; confirm</h4><p>Match the sender, reference, and {downPaymentLabel} with the payment account before confirming.</p><form action={recordAction} className="deposit-record-form" onSubmit={(event) => { void confirmPayment(event); }}><input type="hidden" name="bookingId" value={bookingId} /><label><span>Sender or account name</span><input name="senderName" placeholder="e.g. Jevie C" required minLength={2} maxLength={120} /></label><label><span>Transaction reference</span><input name="paymentReference" placeholder="Enter the reference number" required minLength={6} maxLength={80} /></label><button disabled={recordPending}>{recordPending ? "Recording…" : "Record down payment & confirm"}</button></form></div> : null}
    {active && depositStatus === "submitted" ? <div className="deposit-action-card deposit-action-primary"><h4>Verify submitted down payment</h4><p>Open the configured payment account and verify the {downPaymentLabel}, sender, and reference.</p><form action={verifyAction} onSubmit={(event) => { void confirmPayment(event); }}><input type="hidden" name="bookingId" value={bookingId} /><button disabled={verifyPending}>{verifyPending ? "Verifying…" : "Verify down payment & confirm stay"}</button></form></div> : null}
    {depositStatus === "verified" || depositStatus === "refund_pending" ? <div className="deposit-action-card"><h4>Security deposit</h4><p>The {securityDepositLabel} is due upon check-in and is refunded after the host’s checkout inspection. It is not collected on this payment page.</p><form action={refundAction}><input type="hidden" name="bookingId" value={bookingId} /><label><span>Applicable payment refund reference</span><input name="refundReference" placeholder="Enter refund reference" required minLength={6} maxLength={80} /></label><button disabled={refundPending}>{refundPending ? "Saving…" : "Record applicable payment refund"}</button></form></div> : null}
    {canDecline ? <div className="deposit-action-card deposit-action-danger"><h4>Decline request</h4><p>This releases the requested dates so another guest can enquire.</p><form action={statusAction} onSubmit={(event) => { void confirmStatusChange(event, "decline"); }}><input type="hidden" name="bookingId" value={bookingId} /><input type="hidden" name="currentStatus" value={currentBookingStatus ?? ""} /><input type="hidden" name="status" value="declined" /><button className="deposit-danger" disabled={statusPending}>Decline request</button></form></div> : null}
    {canCancel ? <div className="deposit-action-card deposit-action-danger"><h4>Cancel confirmed stay</h4><p>Use this only when the payment is invalid or the stay must be cancelled.</p><form action={statusAction} onSubmit={(event) => { void confirmStatusChange(event, "cancel"); }}><input type="hidden" name="bookingId" value={bookingId} /><input type="hidden" name="currentStatus" value={currentBookingStatus ?? ""} /><input type="hidden" name="status" value="cancelled" /><button className="deposit-danger" disabled={statusPending}>{statusPending ? "Cancelling…" : "Cancel confirmed stay"}</button></form></div> : null}
  </div>;
}
