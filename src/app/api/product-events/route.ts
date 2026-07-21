import { NextResponse } from "next/server";
import {
  isClientProductEventName,
  isProductEventSurface,
  sanitizeProductEventProperties,
  type ClientProductEventInput
} from "@/lib/productEvents";
import { isUuid, monitorLinksSnapshot } from "@/lib/perpetualMonitor";
import { getRequestEntitlement } from "@/lib/server/requestEntitlement";
import { hashAnonymousProductId } from "@/lib/server/productEventStore";
import { anonymousProductRateKey } from "@/lib/server/productEventPrivacy";
import { rateLimit } from "@/lib/server/rateLimit";
import { isSupabaseAdminConfigured, supabaseAdminRest } from "@/lib/server/supabaseAdmin";
import { newsImpactRuntimePolicy } from "@/lib/server/newsImpactMode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function accepted() {
  const response = NextResponse.json({ accepted: true }, { status: 202 });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Authorization");
  return response;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 4_096) {
    return NextResponse.json({ error: "이벤트 요청이 너무 큽니다." }, { status: 413 });
  }

  const bodyText = await request.text();
  if (new TextEncoder().encode(bodyText).byteLength > 4_096) {
    return NextResponse.json({ error: "이벤트 요청이 너무 큽니다." }, { status: 413 });
  }
  let body: ClientProductEventInput;
  try {
    body = JSON.parse(bodyText) as ClientProductEventInput;
  } catch {
    return NextResponse.json({ error: "이벤트 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const allowedKeys = new Set(["eventId", "eventName", "attributionId", "anonymousId", "surface", "asset", "snapshotId", "monitorId", "newsEventId", "newsReactionId", "properties"]);
  if (!body || typeof body !== "object" || Object.keys(body).some((key) => !allowedKeys.has(key))) {
    return NextResponse.json({ error: "허용되지 않은 제품 이벤트 필드입니다." }, { status: 400 });
  }
  if (
    !isUuid(body.eventId) ||
    (body.attributionId !== undefined && !isUuid(body.attributionId)) ||
    !isClientProductEventName(body.eventName) ||
    !isProductEventSurface(body.surface) ||
    (body.asset !== undefined && body.asset !== "btc" && body.asset !== "eth") ||
    (body.snapshotId !== undefined && !isUuid(body.snapshotId)) ||
    (body.monitorId !== undefined && !isUuid(body.monitorId)) ||
    (body.newsEventId !== undefined && !isUuid(body.newsEventId)) ||
    (body.newsReactionId !== undefined && !isUuid(body.newsReactionId))
  ) {
    return NextResponse.json({ error: "허용되지 않은 제품 이벤트입니다." }, { status: 400 });
  }
  if (body.eventName.startsWith("news_") && !newsImpactRuntimePolicy().mutate) return accepted();

  const entitlement = await getRequestEntitlement(request, "crypto");
  let anonymousIdHash: string | null = null;
  if (!entitlement.userId) {
    if (!isUuid(body.anonymousId)) return accepted();
    if (body.monitorId || body.attributionId) return accepted();
    try {
      anonymousIdHash = hashAnonymousProductId(body.anonymousId);
    } catch {
      return accepted();
    }
  }
  const limited = await rateLimit(request, {
    key: entitlement.userId
      ? `product-events:user:${entitlement.userId}`
      : anonymousProductRateKey(anonymousIdHash!),
    limit: 120,
    windowMs: 5 * 60 * 1000
  });
  if (!limited.allowed) return accepted();
  if (!isSupabaseAdminConfigured()) return accepted();

  try {
    if (body.monitorId && entitlement.userId) {
      const monitors = await supabaseAdminRest<Array<{ id: string; snapshot_id: string; last_snapshot_id: string | null }>>(
        `perpetual_scenario_monitors?select=id,snapshot_id,last_snapshot_id&id=eq.${encodeURIComponent(body.monitorId)}&user_id=eq.${encodeURIComponent(entitlement.userId)}&limit=1`
      );
      const monitor = monitors[0];
      const linkedToSnapshot = !body.snapshotId || Boolean(
        monitor && monitorLinksSnapshot(monitor, body.snapshotId, body.eventName === "scenario_opened")
      );
      if (!monitor || !linkedToSnapshot) return accepted();
    }
    if (body.newsEventId || body.newsReactionId) {
      const reactions = body.newsReactionId
        ? await supabaseAdminRest<Array<{ id: string; event_id: string; target: string; evaluated_snapshot_id: string | null }>>(
            `news_market_reactions?select=id,event_id,target,evaluated_snapshot_id&id=eq.${encodeURIComponent(body.newsReactionId)}&limit=1`
          )
        : [];
      const reaction = reactions[0];
      const eventId = body.newsEventId ?? reaction?.event_id;
      if (!eventId || (body.newsEventId && reaction && reaction.event_id !== body.newsEventId)) return accepted();
      const events = await supabaseAdminRest<Array<{ id: string }>>(
        `news_impact_events?select=id&id=eq.${encodeURIComponent(eventId)}&status=neq.retracted&limit=1`
      );
      if (!events[0]) return accepted();
      if (body.newsReactionId && !reaction) return accepted();
      if (body.snapshotId && reaction?.evaluated_snapshot_id !== body.snapshotId) return accepted();
    }
    await supabaseAdminRest("product_events", {
      method: "POST",
      prefer: "resolution=ignore-duplicates",
      body: {
        event_id: body.eventId,
        event_name: body.eventName,
        event_source: "client",
        user_id: entitlement.userId,
        anonymous_id_hash: entitlement.userId ? null : anonymousIdHash,
        surface: body.surface,
        asset: body.asset ?? null,
        snapshot_id: body.snapshotId ?? null,
        monitor_id: body.monitorId ?? null,
        attribution_id: body.attributionId ?? null,
        news_event_id: body.newsEventId ?? null,
        news_reaction_id: body.newsReactionId ?? null,
        properties: sanitizeProductEventProperties(body.eventName, body.properties),
        occurred_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.warn("[api/product-events] event was not stored", {
      eventName: body.eventName,
      message: error instanceof Error ? error.message : "unknown"
    });
  }
  return accepted();
}
