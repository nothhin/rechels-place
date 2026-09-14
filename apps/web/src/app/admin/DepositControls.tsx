"use client";

import { useActionState, useEffect, useState } from "react";
import { markDepositRefunded, recordAndVerifyDeposit, startDepositRequest, updateBookingRequestStatus, verifyDeposit, type DepositActionState } from "./actions";
import { confirmAction, showError, showSuccess } from "@/lib/sweetalert";

const initialState: DepositActionState = { status: "idle" };

export function DepositControls({ bookingId, bookingStatus = "pending", depositStatus, canManage }: { bookingId: string; bookingStatus?: string; depositStatus: string; canManage: boolean }) {
  const [startState, startAction, startPending] = useActionState(startDepositRequest, initialState);
  const [verifyState, verifyAction, verifyPending] = useActionState(verifyDeposit, initialState);
  const [recordState, recordAction, recordPending] = useActionState(recordAndVerifyDeposit, initialState);
  const [refundState, refundAction, refundPending] = useActionState(markDepositRefunded, initialState);
  const [statusState, statusAction, statusPending] = useActionState(updateBookingRequestStatus, initialState);
  const [copied, setCopied] = useState(false);
  const [guideCopied, setGuideCopied] = useState(false);
  const result = [startState, verifyState, recordState, refundState, statusState].findLast((item) => item.status !== "idle") ?? initialState;

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
    const confirmed = await confirmAction("Confirm this down payment?", "Only continue after matching the 50% down-payment amount, sender, and transaction reference in the configured payment account. This will confirm the booking and block its dates.", "Confirm down payment");
    if (confirmed) { form.dataset.confirmed = "true"; form.requestSubmit(); }
  };

  if (!canManage) return <small>Manager verification required</small>;
  if (startState.status === "success" && startState.link) return <div className="deposit-admin-actions"><a href={startState.link} target="_blank" rel="noreferrer">Open guest payment page</a><button type="button" onClick={async () => { await navigator.clipboard.writeText(`${window.location.origin}${startState.link}`); setCopied(true); void showSuccess("Private guest link copied."); }}>{copied ? "Link copied" : "Copy guest link"}</button><small>Send this private link to the guest. Generating a new link invalidates this one.</small></div>;

  const active = !["cancelled", "declined"].includes(bookingStatus);
  const copyGuide = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const message = `Welcome to Rechel's Place CDO!\n\nAddress: 1229 Avida Aspira Tower 1, Cagayan de Oro\nCheck-in: 2:00 PM\nCheck-out: 11:00 AM\n\nSelf check-in\n• Parking/building note: ${values.gate || "Free street parking is listed on Airbnb; confirm building directions with the host."}\n• Keypad entry: ${values.rfid || "Details provided by host."}\n• Pool/gym note: ${values.smartlock || "Details provided by host."}\n• Additional host note: ${values.keybox || "None."}\n• Wi-Fi (31 Mbps): ${values.wifi || "Network details provided by host."}\n• Wi-Fi password: ${values.wifiPassword || "Provided by host."}\n\nPlease follow the host's checkout instructions and securely lock the condo before leaving. Thank you for staying with us!`;
    void navigator.clipboard.writeText(message).then(() => { setGuideCopied(true); void showSuccess("Guest access guide copied for Messenger."); });
  };
  return <div className="deposit-admin-actions">
    <div className="deposit-workflow-header"><span>Payment workflow</span><strong>{depositStatus === "submitted" ? "Verify submitted down payment" : depositStatus === "verified" || depositStatus === "refund_pending" ? "Down payment verified" : "Record 50% down payment"}</strong><small>Verify the payment account and the 50% down-payment amount before confirming the stay. The ₱1,000 refundable security deposit is collected separately upon check-in.</small></div>
    {active && depositStatus === "not_requested" ? <div className="deposit-action-card"><h4>Start the down-payment request</h4><p>Generate a private payment page for this guest.</p><form action={startAction}><input type="hidden" name="bookingId" value={bookingId} /><button disabled={startPending}>{startPending ? "Preparing…" : "Prepare secure payment link"}</button></form></div> : null}
    {active && depositStatus === "awaiting_payment" ? <div className="deposit-action-card deposit-action-primary"><h4>Record 50% down payment &amp; confirm</h4><p>Match the sender, reference, and 50% down-payment amount with the payment account before confirming.</p><form action={recordAction} className="deposit-record-form" onSubmit={(event) => { void confirmPayment(event); }}><input type="hidden" name="bookingId" value={bookingId} /><label><span>Sender or account name</span><input name="senderName" placeholder="e.g. Jevie C" required minLength={2} maxLength={120} /></label><label><span>Transaction reference</span><input name="paymentReference" placeholder="Enter the reference number" required minLength={6} maxLength={80} /></label><button disabled={recordPending}>{recordPending ? "Recording…" : "Record down payment & confirm"}</button></form></div> : null}
    {active && depositStatus === "submitted" ? <div className="deposit-action-card deposit-action-primary"><h4>Verify submitted down payment</h4><p>Open the configured payment account and verify the 50% down-payment amount, sender, and reference.</p><form action={verifyAction} onSubmit={(event) => { void confirmPayment(event); }}><input type="hidden" name="bookingId" value={bookingId} /><button disabled={verifyPending}>{verifyPending ? "Verifying…" : "Verify down payment & confirm stay"}</button></form></div> : null}
    {depositStatus === "verified" || depositStatus === "refund_pending" ? <div className="deposit-action-card"><h4>Guest access &amp; security deposit</h4><p>The ₱1,000 refundable security deposit is due upon check-in and is refunded after the host’s checkout inspection. It is not collected on this payment page.</p><form action={refundAction}><input type="hidden" name="bookingId" value={bookingId} /><label><span>Applicable payment refund reference</span><input name="refundReference" placeholder="Enter refund reference" required minLength={6} maxLength={80} /></label><button disabled={refundPending}>{refundPending ? "Saving…" : "Record applicable payment refund"}</button></form><form className="deposit-guide-form" onSubmit={copyGuide}><strong>Private guest access guide</strong><small>Enter this guest’s unique arrival details, copy the message, then paste it into Messenger. These values are not saved.</small><input name="gate" placeholder="Parking / building note" /><input name="rfid" placeholder="Keypad entry instructions" /><input name="smartlock" placeholder="Pool / gym note" /><input name="keybox" placeholder="Additional host note" /><input name="wifi" placeholder="Wi-Fi name" /><input name="wifiPassword" placeholder="Wi-Fi password" /><button type="submit">{guideCopied ? "Guide copied" : "Copy access guide"}</button></form></div> : null}
    {bookingStatus === "pending" || bookingStatus === "contacted" ? <div className="deposit-action-card deposit-action-danger"><h4>Decline request</h4><p>This releases the requested dates so another guest can enquire.</p><form action={statusAction} onSubmit={(event) => { void confirmStatusChange(event, "decline"); }}><input type="hidden" name="bookingId" value={bookingId} /><input type="hidden" name="status" value="declined" /><button className="deposit-danger" disabled={statusPending}>Decline request</button></form></div> : null}
    {bookingStatus === "confirmed" ? <div className="deposit-action-card deposit-action-danger"><h4>Cancel confirmed stay</h4><p>Use this only when the payment is invalid or the stay must be cancelled.</p><form action={statusAction} onSubmit={(event) => { void confirmStatusChange(event, "cancel"); }}><input type="hidden" name="bookingId" value={bookingId} /><input type="hidden" name="status" value="cancelled" /><button className="deposit-danger" disabled={statusPending}>{statusPending ? "Cancelling…" : "Cancel confirmed stay"}</button></form></div> : null}
  </div>;
}
