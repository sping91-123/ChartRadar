"use client";

import type { ClientProductEventInput, ClientProductEventName, ProductEventSurface } from "@/lib/productEvents";
import type { PerpetualAsset } from "@/lib/perpetualDecisionSnapshot";
import { getActiveSupabaseSession } from "@/lib/supabase";

const anonymousStorageKey = "chartRadar.productAnalytics.anonymousId";

function anonymousId() {
  if (typeof window === "undefined") return crypto.randomUUID();
  const current = window.localStorage.getItem(anonymousStorageKey);
  if (current) return current;
  const next = crypto.randomUUID();
  window.localStorage.setItem(anonymousStorageKey, next);
  return next;
}

export async function trackProductEvent(params: {
  eventId?: string;
  eventName: ClientProductEventName;
  attributionId?: string;
  surface: ProductEventSurface;
  asset?: PerpetualAsset;
  snapshotId?: string;
  monitorId?: string;
  newsEventId?: string;
  newsReactionId?: string;
  properties?: Record<string, string | number | boolean>;
}) {
  try {
    const session = await getActiveSupabaseSession();
    const body: ClientProductEventInput = {
      eventId: params.eventId ?? crypto.randomUUID(),
      eventName: params.eventName,
      attributionId: params.attributionId,
      anonymousId: anonymousId(),
      surface: params.surface,
      asset: params.asset,
      snapshotId: params.snapshotId,
      monitorId: params.monitorId,
      newsEventId: params.newsEventId,
      newsReactionId: params.newsReactionId,
      properties: params.properties
    };
    await fetch("/api/product-events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {})
      },
      body: JSON.stringify(body),
      keepalive: true,
      cache: "no-store"
    });
  } catch {
    // Analytics must never block the product flow.
  }
}
