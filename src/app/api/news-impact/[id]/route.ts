import { NextResponse } from "next/server";
import { newsImpactCapabilities, serializeNewsEvents } from "@/lib/server/news/newsImpactApi";
import { readNewsImpactEvents, readNewsSourceStatusSummary } from "@/lib/server/news/newsImpactStore";
import { isNewsImpactUiEnabled, newsImpactMode } from "@/lib/server/newsImpactMode";
import { entitlementRateKey, getRequestEntitlement } from "@/lib/server/requestEntitlement";
import { normalizePerpetualAsset } from "@/lib/server/perpetualDecisionSource";
import { isSupabaseAdminConfigured } from "@/lib/server/supabaseAdmin";
import { rateLimit } from "@/lib/server/rateLimit";
import { isUuid } from "@/lib/perpetualMonitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function privateJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Authorization");
  return response;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return privateJson({ error: "유효하지 않은 사건 ID입니다." }, { status: 400 });
  const url = new URL(request.url);
  const requestedMarketValue = url.searchParams.get("market");
  if (requestedMarketValue && requestedMarketValue !== "crypto" && requestedMarketValue !== "global") {
    return privateJson({ error: "market은 crypto 또는 global이어야 합니다." }, { status: 400 });
  }
  const requestedMarket: "crypto" | "global" | null = requestedMarketValue === "crypto" || requestedMarketValue === "global"
    ? requestedMarketValue
    : null;
  const requestedAsset = requestedMarket === "crypto" && url.searchParams.has("asset")
    ? normalizePerpetualAsset(url.searchParams.get("asset"))
    : null;
  if (requestedMarket === "crypto" && url.searchParams.has("asset") && !requestedAsset) {
    return privateJson({ error: "asset은 btc 또는 eth여야 합니다." }, { status: 400 });
  }
  const requestedSnapshotId = url.searchParams.get("snapshot");
  if (requestedSnapshotId && !isUuid(requestedSnapshotId)) {
    return privateJson({ error: "유효하지 않은 snapshot ID입니다." }, { status: 400 });
  }
  const mode = newsImpactMode();
  if (!isNewsImpactUiEnabled(mode)) return privateJson({ error: "뉴스 임팩트가 아직 공개되지 않았습니다.", mode }, { status: 404 });
  if (!isSupabaseAdminConfigured()) return privateJson({ error: "뉴스 임팩트 저장소가 설정되지 않았습니다." }, { status: 503 });
  const lookupLimit = await rateLimit(request, {
    key: "news-impact-detail-lookup",
    limit: 120,
    windowMs: 5 * 60_000
  });
  if (!lookupLimit.allowed) {
    return privateJson({ error: "Too many news event lookup requests." }, { status: 429 });
  }
  try {
    const candidates = requestedMarket
      ? await readNewsImpactEvents({ market: requestedMarket, asset: requestedAsset, eventId: id, snapshotId: requestedSnapshotId, since: new Date(0).toISOString(), limit: 1 })
      : await readNewsImpactEvents({ market: "crypto", eventId: id, snapshotId: requestedSnapshotId, since: new Date(0).toISOString(), limit: 1 });
    const fallback = requestedMarket || candidates.length > 0
      ? candidates
      : await readNewsImpactEvents({ market: "global", eventId: id, snapshotId: requestedSnapshotId, since: new Date(0).toISOString(), limit: 1 });
    const event = fallback[0];
    if (!event || (requestedSnapshotId && event.reaction?.evaluatedSnapshotId !== requestedSnapshotId)) {
      return privateJson({ error: requestedSnapshotId ? "같은 snapshot의 뉴스 반응을 찾을 수 없습니다." : "사건을 찾을 수 없습니다." }, { status: 404 });
    }
    const entitlement = await getRequestEntitlement(request, event.market === "crypto" ? "crypto" : "stocks");
    const capabilities = newsImpactCapabilities(entitlement);
    const limited = await rateLimit(request, {
      key: entitlementRateKey(`news-impact-detail:${event.market}`, entitlement),
      limit: entitlement.isPaid ? 180 : 90,
      windowMs: 5 * 60_000
    });
    if (!limited.allowed) return privateJson({ error: "뉴스 사건 요청이 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
    if (!capabilities.canSeeProEvidence && Date.parse(event.occurredAt) < Date.now() - 24 * 60 * 60_000) {
      return privateJson({ error: "24시간이 지난 공식 사건 이력은 Pro에서 확인할 수 있습니다.", upgradePath: `/pro?market=${event.market === "crypto" ? "crypto" : "stocks"}&source=news` }, { status: 403 });
    }
    const health = await readNewsSourceStatusSummary();
    return privateJson({ event: serializeNewsEvents([event], capabilities.canSeeProEvidence)[0], capabilities, sourceHealth: health, mode });
  } catch (error) {
    console.error("[api/news-impact/:id] error:", error);
    return privateJson({ error: "뉴스 사건을 불러오지 못했습니다." }, { status: 503 });
  }
}
