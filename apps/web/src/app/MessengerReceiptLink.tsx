"use client";

import { useState } from "react";
import { propertyProfile } from "@/lib/property";
import { showSuccess } from "@/lib/sweetalert";

export function MessengerReceiptLink({ message, className, label = "Open Messenger and send receipt" }: { message: string; className?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return <div className={className}>
    <a href={propertyProfile.messengerUrl} target="_blank" rel="noreferrer" onClick={() => { void navigator.clipboard.writeText(message).then(() => { setCopied(true); void showSuccess("Message copied. Paste it in Messenger."); }); }}>{label}</a>
    <small>{copied ? "Message copied—paste it in Messenger, then attach your receipt screenshot." : "This copies your booking message. Paste it in Messenger and attach the receipt screenshot."}</small>
  </div>;
}
