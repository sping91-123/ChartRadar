"use client";

import type { ClientProductEventInput, ClientProductEventName, ProductEventSurface } from "@/lib/productEvents";
import type { PerpetualAsset } from "@/lib/perpetualDecisionSnapshot";
import { getActiveSupabaseSession } from "@/lib/supabase";

const anonymousStorageKey = "chartRadar.productAnalytics.anonymousId";
const funnelStorageKey = "chartRadar.productAnalytics.funnelSession.v1";
const funnelTtlMs = 24 * 60 * 60 * 1000;

function anonymousId() {
  if (typeof window === "undefined") return crypto.randomUUID();
  const current = window.localStorage.getItem(anonymousStorageKey);
  if (current) return current;
  const next = crypto.randomUUID();
  window.localStorage.setItem(anonymousStorageKey, next);
  return next;
}

export function getFunnelSessionId() {
  if (typeof window === "undefined") return crypto.randomUUID();
  try {
    const raw = window.localStorage.getItem(funnelStorageKey);
    const parsed = raw ? (JSON.parse(raw) as { id?: unknown; createdAt?: unknown }) : null;
    if (
      typeof parsed?.id === "string" &&
      typeof parsed.createdAt === "number" &&
      Date.now() - parsed.createdAt < funnelTtlMs
    ) {
      return parsed.id;
    }
  } catch {
    // Replace malformed or expired state below.
  }
  const next = { id: crypto.randomUUID(), createdAt: Date.now() };
  window.localStorage.setItem(funnelStorageKey, JSON.stringify(next));
  return next.id;
}

export function adoptFunnelSessionId(value: string | null | undefined) {
  if (typeof window === "undefined" || !value || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return getFunnelSessionId();
  }
  window.localStorage.setItem(funnelStorageKey, JSON.stringify({ id: value, createdAt: Date.now() }));
  return value;
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
      funnelSessionId: getFunnelSessionId(),
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
