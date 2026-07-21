import { randomUUID } from "node:crypto";
import type { PerpetualAsset } from "@/lib/perpetualDecisionSnapshot";
import {
  selectRecentPurchaseAttribution,
  type ProductEventName,
  type ProductEventSurface,
  type PurchaseAttributionCandidate
} from "@/lib/productEvents";
import { isSupabaseAdminConfigured, supabaseAdminRest } from "@/lib/server/supabaseAdmin";
export { hashAnonymousProductId } from "@/lib/server/productEventPrivacy";

export function productAnalyticsConfigured() {
  return isSupabaseAdminConfigured() && Boolean(process.env.PRODUCT_ANALYTICS_HMAC_SECRET?.trim());
}

export async function recordServerProductEvent(params: {
  eventId?: string;
  eventName: ProductEventName;
  userId: string;
  surface: ProductEventSurface;
  asset?: PerpetualAsset | null;
  snapshotId?: string | null;
  monitorId?: string | null;
  attributionId?: string | null;
  newsEventId?: string | null;
  newsReactionId?: string | null;
  properties?: Record<string, string | number | boolean | null>;
}) {
  if (!isSupabaseAdminConfigured()) return false;
  try {
    await supabaseAdminRest("product_events", {
      method: "POST",
      prefer: "resolution=ignore-duplicates",
      body: {
        event_id: params.eventId ?? randomUUID(),
        event_name: params.eventName,
        event_source: "server",
        user_id: params.userId,
        anonymous_id_hash: null,
        surface: params.surface,
        asset: params.asset ?? null,
        snapshot_id: params.snapshotId ?? null,
        monitor_id: params.monitorId ?? null,
        attribution_id: params.attributionId ?? null,
        news_event_id: params.newsEventId ?? null,
        news_reaction_id: params.newsReactionId ?? null,
        properties: params.properties ?? {},
        occurred_at: new Date().toISOString()
      }
    });
    return true;
  } catch (error) {
    console.warn("[product-events] server event was not stored", {
      eventName: params.eventName,
      message: error instanceof Error ? error.message : "unknown"
    });
    return false;
  }
}

export async function findRecentPurchaseAttribution(params: {
  userId: string;
  provider: string;
  planId?: string | null;
  now?: number;
}) {
  if (!isSupabaseAdminConfigured()) return null;
  const now = params.now ?? Date.now();
  const since = new Date(now - 30 * 60 * 1000).toISOString();
  try {
    const rows = await supabaseAdminRest<PurchaseAttributionCandidate[]>(
      `product_events?select=event_id,occurred_at,properties&user_id=eq.${encodeURIComponent(params.userId)}&event_name=eq.purchase_started&occurred_at=gte.${encodeURIComponent(since)}&order=occurred_at.desc&limit=10`
    );
    return selectRecentPurchaseAttribution(rows, {
      provider: params.provider,
      planId: params.planId,
      now
    });
  } catch (error) {
    console.warn("[product-events] purchase attribution lookup failed", {
      message: error instanceof Error ? error.message : "unknown"
    });
    return null;
  }
}
