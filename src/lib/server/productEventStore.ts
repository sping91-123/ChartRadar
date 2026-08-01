import { randomUUID } from "node:crypto";
import type { PerpetualAsset } from "@/lib/perpetualDecisionSnapshot";
import {
  selectRecentPurchaseAttribution,
  type ProductEventName,
  type ProductEventSurface,
  type PurchaseAttributionCandidate
} from "@/lib/productEvents";
import { isSupabaseAdminConfigured, supabaseAdminRest } from "@/lib/server/supabaseAdmin";
import { isInternalProductTester } from "@/lib/server/productEventPrivacy";
export { hashAnonymousProductId } from "@/lib/server/productEventPrivacy";

export type ProductTrafficClass = "user" | "internal";

export interface PurchaseAttributionContext {
  attributionId: string;
  funnelSessionHash: string | null;
  trafficClass: ProductTrafficClass;
}

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
  funnelSessionHash?: string | null;
  trafficClass?: ProductTrafficClass;
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
        funnel_session_hash: params.funnelSessionHash ?? null,
        traffic_class: params.trafficClass === "internal" || isInternalProductTester(params.userId) ? "internal" : "user",
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
  planIds?: readonly string[];
  now?: number;
  maxAgeMs?: number;
  providerOrderId?: string | null;
}) {
  return (await findRecentPurchaseAttributionContext(params))?.attributionId ?? null;
}

export async function findRecentPurchaseAttributionContext(params: {
  userId: string;
  provider: string;
  planId?: string | null;
  planIds?: readonly string[];
  now?: number;
  maxAgeMs?: number;
  providerOrderId?: string | null;
}): Promise<PurchaseAttributionContext | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const now = params.now ?? Date.now();
  if (params.providerOrderId) {
    try {
      const rows = await supabaseAdminRest<Array<{
        attribution_id: string;
        funnel_session_hash: string | null;
        traffic_class: ProductTrafficClass;
        plan_id: string;
      }>>(
        `product_purchase_attributions?select=attribution_id,funnel_session_hash,traffic_class,plan_id&user_id=eq.${encodeURIComponent(params.userId)}&provider=eq.${encodeURIComponent(params.provider)}&provider_order_id=eq.${encodeURIComponent(params.providerOrderId)}&expires_at=gt.${encodeURIComponent(new Date(now).toISOString())}&limit=1`
      );
      const matched = rows[0];
      const allowedPlans = params.planIds?.length
        ? new Set(params.planIds)
        : params.planId
          ? new Set([params.planId])
          : null;
      if (matched && (!allowedPlans || allowedPlans.has(matched.plan_id))) {
        return {
          attributionId: matched.attribution_id,
          funnelSessionHash: matched.funnel_session_hash,
          trafficClass: matched.traffic_class === "internal" ? "internal" : "user"
        };
      }
    } catch (error) {
      console.warn("[product-events] persisted purchase attribution lookup failed", {
        message: error instanceof Error ? error.message : "unknown"
      });
    }
  }
  const maxAgeMs = params.maxAgeMs ?? 30 * 60 * 1000;
  const since = new Date(now - maxAgeMs).toISOString();
  try {
    const rows = await supabaseAdminRest<Array<PurchaseAttributionCandidate & {
      funnel_session_hash?: string | null;
      traffic_class?: ProductTrafficClass;
    }>>(
      `product_events?select=event_id,occurred_at,properties,funnel_session_hash,traffic_class&user_id=eq.${encodeURIComponent(params.userId)}&event_name=eq.purchase_started&occurred_at=gte.${encodeURIComponent(since)}&order=occurred_at.desc&limit=10`
    );
    const attributionId = selectRecentPurchaseAttribution(rows, {
      provider: params.provider,
      planId: params.planId,
      planIds: params.planIds,
      now,
      maxAgeMs
    });
    if (!attributionId) return null;
    const matched = rows.find((row) => row.event_id === attributionId);
    return {
      attributionId,
      funnelSessionHash: matched?.funnel_session_hash ?? null,
      trafficClass: matched?.traffic_class === "internal" ? "internal" : "user"
    };
  } catch (error) {
    console.warn("[product-events] purchase attribution lookup failed", {
      message: error instanceof Error ? error.message : "unknown"
    });
    return null;
  }
}

export async function persistPurchaseAttributionContext(params: {
  userId: string;
  provider: string;
  providerOrderId: string;
  planId: string;
  context: PurchaseAttributionContext;
}) {
  if (!isSupabaseAdminConfigured()) return false;
  try {
    await supabaseAdminRest("product_purchase_attributions", {
      method: "POST",
      prefer: "resolution=merge-duplicates",
      body: {
        provider: params.provider,
        provider_order_id: params.providerOrderId,
        user_id: params.userId,
        plan_id: params.planId,
        attribution_id: params.context.attributionId,
        funnel_session_hash: params.context.funnelSessionHash,
        traffic_class: params.context.trafficClass,
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString()
      }
    });
    return true;
  } catch (error) {
    console.warn("[product-events] purchase attribution was not persisted", {
      message: error instanceof Error ? error.message : "unknown"
    });
    return false;
  }
}
