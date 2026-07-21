import type { NewsImpactCapabilities, NewsImpactEvent, NewsMarket } from "@/lib/newsImpact";
import { serializeBasicNewsImpactEvent } from "@/lib/newsImpact";
import type { RequestEntitlement } from "@/lib/server/requestEntitlement";

const importanceRank = { critical: 3, high: 2, normal: 1 } as const;

export function newsImpactCapabilities(entitlement: RequestEntitlement): NewsImpactCapabilities {
  const failClosed = entitlement.state === "unavailable" || entitlement.state === "deletion_pending";
  return {
    canSeeProEvidence: entitlement.isPaid && !failClosed,
    canEnableImpactAlerts: Boolean(entitlement.userId) && entitlement.isPaid && !failClosed,
    canSaveJournal: Boolean(entitlement.userId) && entitlement.isPaid && !failClosed,
    requiresAuth: !entitlement.userId,
    alertDefaultEnabled: false
  };
}

export function sortNewsImpactEvents(events: NewsImpactEvent[]) {
  return [...events].sort((left, right) => {
    const importance = importanceRank[right.importance] - importanceRank[left.importance];
    return importance || right.occurredAt.localeCompare(left.occurredAt) || right.id.localeCompare(left.id);
  });
}

export function serializeNewsEvents(events: NewsImpactEvent[], pro: boolean) {
  return pro ? events : events.map(serializeBasicNewsImpactEvent);
}

export function encodeNewsCursor(offset: number) {
  return Buffer.from(JSON.stringify({ v: 1, offset }), "utf8").toString("base64url");
}

export function decodeNewsCursor(value: string | null) {
  if (!value) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { v?: unknown; offset?: unknown };
    if (parsed.v !== 1 || !Number.isInteger(parsed.offset) || Number(parsed.offset) < 0 || Number(parsed.offset) > 10_000) return 0;
    return Number(parsed.offset);
  } catch {
    return 0;
  }
}

export function normalizeNewsMarket(value: string | null): NewsMarket | null {
  return value === "crypto" || value === "global" ? value : null;
}
