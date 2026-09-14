"use client";

import { useEffect, useRef, useState } from "react";
import UiIcon from "./UiIcon";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export default function PwaInstallPrompt() {
  const deferred = useRef<InstallPromptEvent | null>(null);
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      deferred.current = event as InstallPromptEvent;
      setAvailable(true);
    };
    const onInstalled = () => { deferred.current = null; setAvailable(false); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (!available || dismissed) return null;
  return <div className="pwa-install"><span className="pwa-install-icon"><UiIcon name="install" size={17} /></span><div><strong>Install Rechel’s Place</strong><small>Fast offline access &amp; instant booking status.</small></div><button type="button" onClick={async () => { if (!deferred.current) return; await deferred.current.prompt(); await deferred.current.userChoice; deferred.current = null; setAvailable(false); }}>Install</button><button className="pwa-install-close" type="button" aria-label="Dismiss install prompt" onClick={() => setDismissed(true)}>×</button></div>;
}
