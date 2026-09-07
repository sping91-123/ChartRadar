import { perpetualAlertContextFromPushData, type PushTargetData } from "./pushTargetPath";

export const BROWSER_ALERTS_CHANGED = "chart-radar.browser-alerts-changed";
export const BROWSER_ALERT_POLL_MS = 60_000;
export const BROWSER_ALERT_MAX_AGE_MS = 10 * 60_000;
export interface BrowserPerpetualAlert {
  id: string;
  title: string;
  body: string;
  payload: PushTargetData;
  created_at: string;
  read_at?: string | null;
}
export interface BrowserAlertLedger { enabledAt: number; checkedAt: number; delivered: string[] }
export function browserAlertStorageKey(userId: string) {
  return `chart-radar.browser-perpetual-alerts.v1.${userId}`;
}
export function parseBrowserAlertLedger(raw: string | null, now: number): BrowserAlertLedger {
  try {
    const value = JSON.parse(raw ?? "null") as BrowserAlertLedger | null;
    if (value && Number.isFinite(value.enabledAt) && value.enabledAt > 0 && value.enabledAt <= now && Array.isArray(value.delivered)) {
      return {
        enabledAt: value.enabledAt,
        checkedAt: Number.isFinite(value.checkedAt) && value.checkedAt <= now ? value.checkedAt : 0,
        delivered: value.delivered.filter((id): id is string => typeof id === "string").slice(-200)
      };
    }
  } catch { /* A corrupt ledger must not replay historical alerts. */ }
  return { enabledAt: now, checkedAt: 0, delivered: [] };
}
export function freshBrowserPerpetualAlerts(events: unknown[], ledger: BrowserAlertLedger, now: number): BrowserPerpetualAlert[] {
  const ids = new Set(ledger.delivered);
  return events.filter((value): value is BrowserPerpetualAlert => {
    if (!value || typeof value !== "object") return false;
    const event = value as BrowserPerpetualAlert;
    const created = Date.parse(event.created_at);
    if (typeof event.id !== "string" || !event.id || ids.has(event.id) || event.read_at) return false;
    if (typeof event.title !== "string" || !event.title.trim() || typeof event.body !== "string") return false;
    if (!Number.isFinite(created) || created < Math.max(ledger.enabledAt, now - BROWSER_ALERT_MAX_AGE_MS) || created > now + 30_000) return false;
    if (!event.payload || typeof event.payload !== "object" || !perpetualAlertContextFromPushData(event.payload)) return false;
    ids.add(event.id);
    return true;
  }).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
}
