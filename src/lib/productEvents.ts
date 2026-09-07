import type { PerpetualAsset } from "@/lib/perpetualDecisionSnapshot";
import { coinProPlacements, coinProRouteKeys, coinProSources } from "./coinProConversion";
import { purchaseErrorCategories, purchaseSdkCodes } from "./nativePurchaseErrors";

export const clientProductEventNames = [
  "home_snapshot_viewed",
  "home_perpetual_opened",
  "perpetual_snapshot_viewed",
  "pro_gate_viewed",
  "pro_cta_clicked",
  "monitor_failed",
  "scenario_opened",
  "paywall_viewed",
  "auth_started",
  "auth_completed",
  "store_opened",
  "purchase_started",
  "store_purchase_succeeded",
  "entitlement_sync_pending",
  "purchase_failed",
  "purchase_cancelled",
  "news_impact_viewed",
  "news_source_opened",
  "news_to_market_opened",
  "news_alert_opted_in",
  "news_alert_opened"
] as const;

export const serverProductEventNames = [
  "monitor_created",
  "scenario_triggered",
  "journal_saved",
  "entitlement_activated",
  "verified_trial_started",
  "trial_converted",
  "subscription_cancelled",
  "subscription_expired",
  "news_journal_saved"
] as const;

export type ClientProductEventName = (typeof clientProductEventNames)[number];
export type ServerProductEventName = (typeof serverProductEventNames)[number];
export type ProductEventName = ClientProductEventName | ServerProductEventName;
export type ProductEventSurface =
  | "home"
  | "perpetual"
  | "alts"
  | "spot"
  | "scout"
  | "watchlist"
  | "alerts"
  | "journal"
  | "paywall"
  | "billing"
  | "news";

export interface ClientProductEventInput {
  eventId: string;
  eventName: ClientProductEventName;
  attributionId?: string;
  anonymousId?: string;
  funnelSessionId?: string;
  surface: ProductEventSurface;
  asset?: PerpetualAsset;
  snapshotId?: string;
  monitorId?: string;
  newsEventId?: string;
  newsReactionId?: string;
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
    planIds,
    now = Date.now(),
    maxAgeMs = 30 * 60 * 1000
  }: { provider: string; planId?: string | null; planIds?: readonly string[]; now?: number; maxAgeMs?: number }
) {
  const allowedPlans = planIds?.length ? new Set(planIds) : planId ? new Set([planId]) : null;
  return [...candidates].sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at)).find((candidate) => {
    const occurredAt = Date.parse(candidate.occurred_at);
    if (!Number.isFinite(occurredAt) || occurredAt > now || now - occurredAt > maxAgeMs) return false;
    const properties = candidate.properties ?? {};
    if (properties.provider !== provider) return false;
    return !allowedPlans || (typeof properties.planId === "string" && allowedPlans.has(properties.planId));
  })?.event_id ?? null;
}

const clientNames = new Set<string>(clientProductEventNames);
const surfaces = new Set<string>([
  "home", "perpetual", "alts", "spot", "scout", "watchlist", "alerts", "journal", "paywall", "billing", "news"
]);
const funnelKeys = ["source", "placement", "routeKey", "symbol", "offerId", "platform", "authState", "variant"] as const;
const propertyKeys: Record<ClientProductEventName, ReadonlySet<string>> = {
  home_snapshot_viewed: new Set(["quality", "mode", "agreement"]),
  home_perpetual_opened: new Set(["quality", "source", "intent"]),
  perpetual_snapshot_viewed: new Set(["quality", "continuity", "source"]),
  pro_gate_viewed: new Set([...funnelKeys, "reason"]),
  pro_cta_clicked: new Set(funnelKeys),
  monitor_failed: new Set(["code", "conditionRole", "source"]),
  scenario_opened: new Set(["source"]),
  paywall_viewed: new Set([...funnelKeys, "planId"]),
  auth_started: new Set(funnelKeys),
  auth_completed: new Set(funnelKeys),
  store_opened: new Set([...funnelKeys, "planId", "provider"]),
  purchase_started: new Set([...funnelKeys, "planId", "provider"]),
  store_purchase_succeeded: new Set([...funnelKeys, "planId", "provider"]),
  entitlement_sync_pending: new Set([...funnelKeys, "planId", "provider", "code"]),
  purchase_failed: new Set([...funnelKeys, "planId", "provider", "code", "stage", "sdkCode", "category", "retryable"]),
  purchase_cancelled: new Set([...funnelKeys, "planId", "provider"]),
  news_impact_viewed: new Set(["market", "classification", "source"]),
  news_source_opened: new Set(["market", "source"]),
  news_to_market_opened: new Set(["market", "classification", "source"]),
  news_alert_opted_in: new Set(["market", "enabled"]),
  news_alert_opened: new Set(["market", "classification"])
};

function shortString(value: unknown, max = 80) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

const funnelEventNames = new Set<ClientProductEventName>([
  "pro_gate_viewed",
  "pro_cta_clicked",
  "paywall_viewed",
  "auth_started",
  "auth_completed",
  "store_opened",
  "purchase_started",
  "store_purchase_succeeded",
  "entitlement_sync_pending",
  "purchase_failed",
  "purchase_cancelled"
]);

function safeFunnelScalar(key: string, value: unknown) {
  const normalized = shortString(value);
  if (normalized === null) return null;
  if (key === "source") return coinProSources.includes(normalized as (typeof coinProSources)[number]) ? normalized : null;
  if (key === "placement") return coinProPlacements.includes(normalized as (typeof coinProPlacements)[number]) ? normalized : null;
  if (key === "routeKey") return coinProRouteKeys.includes(normalized as (typeof coinProRouteKeys)[number]) ? normalized : null;
  if (key === "platform") return ["android", "ios", "web"].includes(normalized) ? normalized : null;
  if (key === "authState") return ["anonymous", "authenticated"].includes(normalized) ? normalized : null;
  if (key === "variant") return [
    "coin-pro-v2",
    "coin-pro-v2-trial-eligible",
    "coin-pro-v2-trial-ineligible",
    "control"
  ].includes(normalized) ? normalized : null;
  if (key === "symbol") return /^[A-Z0-9][A-Z0-9._-]{1,23}$/.test(normalized) ? normalized : null;
  if (key === "offerId") return /^[a-z][a-z0-9._:-]{0,79}$/i.test(normalized) ? normalized : null;
  return null;
}

const allowedPlanIds = new Set([
  "crypto_monthly", "crypto_yearly", "stocks_monthly", "stocks_yearly", "bundle_monthly", "bundle_yearly"
]);
const allowedProviders = new Set(["google_play", "revenuecat"]);
const allowedSources = new Set([
  "direct", "home", "alert", "alert_refreshed", "news", "deep_link", "perpetual", "official"
]);
const allowedClassifications = new Set([
  "pending", "supports_existing_state", "conflicts_with_existing_state", "decision_state_changed",
  "risk_increase", "no_material_reaction", "insufficient_data", "alert_eligible"
]);
const allowedPurchaseStages = new Set([
  "native_start", "configure_start", "configure_success", "configure_cached", "get_products_start",
  "get_products_success", "product_matched", "base_plan_matched", "purchase_start", "purchase_success",
  "entitlement_sync_start", "entitlement_sync_success", "entitlement_sync_pending", "purchase_cancel",
  "purchase_error", "unknown"
]);

function enumValue(value: unknown, allowed: ReadonlySet<string>) {
  const normalized = shortString(value);
  return normalized && allowed.has(normalized) ? normalized : null;
}

function safeMachineCode(value: unknown) {
  const normalized = shortString(value, 48);
  if (!normalized) return null;
  if (/^[1-5][0-9]{2}$/.test(normalized)) return normalized;
  return /^[a-z][a-z0-9_]{0,47}$/.test(normalized) ? normalized : null;
}

function safePropertyScalar(eventName: ClientProductEventName, key: string, value: unknown) {
  if (funnelEventNames.has(eventName) && funnelKeys.includes(key as (typeof funnelKeys)[number])) {
    return safeFunnelScalar(key, value);
  }
  if (key === "quality") return enumValue(value, new Set(["ready", "partial", "stale", "unavailable"]));
  if (key === "intent") return enumValue(value, new Set(["monitor", "analysis"]));
  if (key === "mode") return enumValue(value, new Set(["off", "shadow", "on"]));
  if (key === "agreement") return enumValue(value, new Set(["agreement", "mismatch", "insufficient"]));
  if (key === "continuity") return enumValue(value, new Set(["same", "refreshed", "current"]));
  if (key === "conditionRole") return enumValue(value, new Set(["primary", "confirmation", "invalidation"]));
  if (key === "market") return enumValue(value, new Set(["crypto", "global", "stocks"]));
  if (key === "classification") return enumValue(value, allowedClassifications);
  if (key === "source") return enumValue(value, allowedSources);
  if (key === "planId") return enumValue(value, allowedPlanIds);
  if (key === "provider") return enumValue(value, allowedProviders);
  if (key === "reason") return enumValue(value, new Set(["monitor_limit"]));
  if (key === "stage") return enumValue(value, allowedPurchaseStages);
  if (key === "sdkCode") return enumValue(value, purchaseSdkCodes);
  if (key === "category") return enumValue(value, purchaseErrorCategories);
  if (key === "retryable") return typeof value === "boolean" ? value : null;
  if (key === "code") return safeMachineCode(value);
  if (key === "enabled") return typeof value === "boolean" ? value : null;
  return null;
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
    const normalized = safePropertyScalar(eventName, key, value);
    if (normalized !== null) result[key] = normalized;
  }
  return result;
}
