import type { PerpetualAsset } from "@/lib/perpetualDecisionSnapshot";

export const clientProductEventNames = [
  "home_snapshot_viewed",
  "home_perpetual_opened",
  "perpetual_snapshot_viewed",
  "pro_gate_viewed",
  "monitor_failed",
  "scenario_opened",
  "paywall_viewed",
  "purchase_started",
  "purchase_failed",
  "purchase_cancelled"
] as const;

export const serverProductEventNames = [
  "monitor_created",
  "scenario_triggered",
  "journal_saved",
  "entitlement_activated"
] as const;

export type ClientProductEventName = (typeof clientProductEventNames)[number];
export type ServerProductEventName = (typeof serverProductEventNames)[number];
export type ProductEventName = ClientProductEventName | ServerProductEventName;
export type ProductEventSurface = "home" | "perpetual" | "alerts" | "journal" | "paywall" | "billing";

export interface ClientProductEventInput {
  eventId: string;
  eventName: ClientProductEventName;
  attributionId?: string;
  anonymousId?: string;
  surface: ProductEventSurface;
  asset?: PerpetualAsset;
  snapshotId?: string;
  monitorId?: string;
  properties?: Record<string, unknown>;
}

export interface PurchaseAttributionCandidate {
  event_id: string;
  occurred_at: string;
  properties: Record<string, unknown> | null;
}

export function selectRecentPurchaseAttribution(
  candidates: readonly PurchaseAttributionCandidate[],
  {
    provider,
    planId,
    now = Date.now(),
    maxAgeMs = 30 * 60 * 1000
  }: { provider: string; planId?: string | null; now?: number; maxAgeMs?: number }
) {
  return candidates.find((candidate) => {
    const occurredAt = Date.parse(candidate.occurred_at);
    if (!Number.isFinite(occurredAt) || occurredAt > now || now - occurredAt > maxAgeMs) return false;
    const properties = candidate.properties ?? {};
    if (properties.provider !== provider) return false;
    return !planId || properties.planId === planId;
  })?.event_id ?? null;
}

const clientNames = new Set<string>(clientProductEventNames);
const surfaces = new Set<string>(["home", "perpetual", "alerts", "journal", "paywall", "billing"]);
const propertyKeys: Record<ClientProductEventName, ReadonlySet<string>> = {
  home_snapshot_viewed: new Set(["quality", "mode", "agreement"]),
  home_perpetual_opened: new Set(["quality", "source"]),
  perpetual_snapshot_viewed: new Set(["quality", "continuity", "source"]),
  pro_gate_viewed: new Set(["source", "reason"]),
  monitor_failed: new Set(["code", "conditionRole", "source"]),
  scenario_opened: new Set(["source"]),
  paywall_viewed: new Set(["source", "planId"]),
  purchase_started: new Set(["source", "planId", "provider"]),
  purchase_failed: new Set(["source", "planId", "provider", "code"]),
  purchase_cancelled: new Set(["source", "planId", "provider"])
};

function shortString(value: unknown, max = 80) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function safeScalar(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return shortString(value);
}

export function isClientProductEventName(value: unknown): value is ClientProductEventName {
  return typeof value === "string" && clientNames.has(value);
}

export function isProductEventSurface(value: unknown): value is ProductEventSurface {
  return typeof value === "string" && surfaces.has(value);
}

export function sanitizeProductEventProperties(
  eventName: ClientProductEventName,
  value: unknown
): Record<string, string | number | boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const allowed = propertyKeys[eventName];
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(source)) {
    if (!allowed.has(key)) continue;
    const normalized = safeScalar(value);
    if (normalized !== null) result[key] = normalized;
  }
  return result;
}
