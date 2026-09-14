"use client";

import { useState, useSyncExternalStore } from "react";

const DISMISSED_KEY = "snowaz-browser-prompt-v2";
const IN_APP_BROWSER = /FBAN|FBAV|Instagram|Messenger|Line\/|; wv\)|WebView/i;
const subscribe = () => () => {};

export default function BrowserViewPrompt() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  const userAgent = mounted ? navigator.userAgent : "";
  const android = /Android/i.test(userAgent);
  const visible = mounted && !dismissed && IN_APP_BROWSER.test(userAgent) && sessionStorage.getItem(DISMISSED_KEY) !== "1";

  if (!visible) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  const openExternalBrowser = async () => {
    const currentUrl = window.location.href;
    if (android) {
      const externalTarget = currentUrl.replace(/^https?:\/\//, "");
      window.location.href = `intent://${externalTarget}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(currentUrl)};end`;
      return;
    }

    await navigator.clipboard.writeText(currentUrl);
    setCopied(true);
  };

  return <aside className="browser-view-prompt" role="dialog" aria-label="Open Rechel's Place in your browser">
    <div><strong>For a better view</strong><span>{android ? "Open Rechel's Place in Chrome instead of this in-app window." : "Copy the link, then paste it into Safari or your preferred browser."}</span></div>
    <div className="browser-view-actions"><button type="button" onClick={openExternalBrowser}>{android ? "Open in Chrome" : copied ? "Link copied" : "Copy website link"}</button><button type="button" onClick={dismiss}>Continue here</button></div>
  </aside>;
}
