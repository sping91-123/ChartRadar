"use client";
import { useEffect } from "react";
import { isAndroidNativeApp } from "@/lib/appPush";
import { BROWSER_ALERTS_CHANGED, BROWSER_ALERT_POLL_MS, browserAlertStorageKey, freshBrowserPerpetualAlerts, parseBrowserAlertLedger } from "@/lib/browserPerpetualAlerts";
import { rememberPerpetualAlertContext } from "@/lib/perpetualAlertContext";
import { resolvePushTargetPath } from "@/lib/pushTargetPath";
import { getSupabaseSession } from "@/lib/supabase";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

/** Delivers existing server events; never scans markets or consumes analysis quota. */
export function BrowserPerpetualAlertMonitor() {
  const { session } = useSupabaseAuth();
  const userId = session?.userId;
  const accessToken = session?.accessToken;
  useEffect(() => {
    if (!userId || !accessToken || isAndroidNativeApp() || !("Notification" in window)) return;
    const storageKey = browserAlertStorageKey(userId);
    const notifications = new Set<Notification>();
    let disposed = false;
    let busy = false;
    let controller: AbortController | null = null;
    const isCurrent = () => !disposed && getSupabaseSession()?.userId === userId && Notification.permission === "granted";
    async function check() {
      if (!isCurrent() || busy || !navigator.onLine) return;
      busy = true;
      const run = async () => {
        if (!isCurrent()) return;
        const ledger = parseBrowserAlertLedger(localStorage.getItem(storageKey), Date.now());
        // Persist the initial boundary before a request; do not replay old account history.
        localStorage.setItem(storageKey, JSON.stringify(ledger));
        if (Date.now() - ledger.checkedAt < BROWSER_ALERT_POLL_MS) return;
        controller = new AbortController();
        const timeout = setTimeout(() => controller?.abort(), 12_000);
        try {
          const response = await fetch("/api/push-alert-events?market=crypto&kind=perpetual&limit=100", {
            headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: controller.signal
          });
          if (!response.ok || !isCurrent()) return;
          const payload = await response.json() as { events?: unknown[] };
          if (!isCurrent() || !Array.isArray(payload.events)) return;
          for (const event of freshBrowserPerpetualAlerts(payload.events, ledger, Date.now())) {
            if (!isCurrent()) return;
            const notification = new Notification(event.title.slice(0, 160), {
              body: event.body.slice(0, 500), icon: "/brand/chart-radar-mark.png", tag: `perpetual-${event.id}`
            });
            notifications.add(notification);
            notification.onclose = () => notifications.delete(notification);
            notification.onclick = () => {
              notification.close();
              if (!isCurrent()) return;
              try { rememberPerpetualAlertContext(event.payload); } catch { /* Navigation remains available. */ }
              void fetch("/api/push-alert-events", {
                method: "PATCH", headers: { Authorization: `Bearer ${getSupabaseSession()?.accessToken ?? ""}`, "Content-Type": "application/json" },
                body: JSON.stringify({ id: event.id }), keepalive: true
              }).catch(() => undefined);
              window.focus();
              window.location.assign(resolvePushTargetPath(event.payload));
            };
            ledger.delivered = [...ledger.delivered, event.id].slice(-200);
            localStorage.setItem(storageKey, JSON.stringify(ledger));
          }
          ledger.checkedAt = Date.now();
          localStorage.setItem(storageKey, JSON.stringify(ledger));
        } finally { clearTimeout(timeout); }
      };
      try {
        // Share one poll and delivery ledger across tabs on browsers supporting Web Locks.
        if (navigator.locks) await navigator.locks.request(storageKey, { ifAvailable: true }, async (lock) => { if (lock) await run(); });
        else await run();
      } catch { /* Offline/storage/permission failures retry on the next poll. */ }
      finally { busy = false; }
    }
    void check();
    const timer = setInterval(() => void check(), BROWSER_ALERT_POLL_MS);
    window.addEventListener("online", check);
    window.addEventListener("focus", check);
    window.addEventListener(BROWSER_ALERTS_CHANGED, check);
    return () => {
      disposed = true;
      controller?.abort();
      clearInterval(timer);
      window.removeEventListener("online", check);
      window.removeEventListener("focus", check);
      window.removeEventListener(BROWSER_ALERTS_CHANGED, check);
      notifications.forEach((notification) => notification.close());
    };
  }, [userId, accessToken]);
  return null;
}
