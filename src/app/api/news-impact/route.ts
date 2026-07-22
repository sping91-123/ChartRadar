import { NextResponse } from "next/server";
import type { NewsImpactListResponse } from "@/lib/newsImpact";
import {
  decodeNewsCursor,
  encodeNewsCursor,
  newsImpactCapabilitiesForMode,
  normalizeNewsMarket,
  serializeOfficialNewsEvents,
  serializeNewsEvents,
  sortNewsImpactEvents
} from "@/lib/server/news/newsImpactApi";
import { readNewsImpactEvents, readNewsSourceStatusSummary } from "@/lib/server/news/newsImpactStore";
import { isNewsImpactReadEnabled, isOfficialNewsFeedEnabled, newsImpactMode } from "@/lib/server/newsImpactMode";
import { entitlementRateKey, getRequestEntitlement } from "@/lib/server/requestEntitlement";
import { normalizePerpetualAsset } from "@/lib/server/perpetualDecisionSource";
import { isUuid } from "@/lib/perpetualMonitor";
import { rateLimit } from "@/lib/server/rateLimit";
import { isSupabaseAdminConfigured } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

function privateJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Authorization");
  return response;
}

function normalizeLimit(raw: string | null, pro: boolean) {
  const fallback = pro ? 20 : 3;
  const parsed = Number(raw ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(pro ? 50 : 3, Math.round(parsed)));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const market = normalizeNewsMarket(url.searchParams.get("market"));
  if (!market) return privateJson({ error: "market은 crypto 또는 global이어야 합니다." }, { status: 400 });
  const asset = market === "crypto" ? normalizePerpetualAsset(url.searchParams.get("asset") ?? "btc") : null;
  if (market === "crypto" && !asset) return privateJson({ error: "asset은 btc 또는 eth여야 합니다." }, { status: 400 });
  const requestedSnapshotId = url.searchParams.get("snapshot");
  if (requestedSnapshotId && !isUuid(requestedSnapshotId)) {
    return privateJson({ error: "유효하지 않은 분석 ID입니다." }, { status: 400 });
  }

  const entitlement = await getRequestEntitlement(request, market === "crypto" ? "crypto" : "stocks");
  const limited = await rateLimit(request, {
    key: entitlementRateKey(`news-impact:${market}`, entitlement),
    limit: entitlement.isPaid ? 180 : 90,
    windowMs: 5 * 60_000
  });
  if (!limited.allowed) return privateJson({ error: "공식 뉴스 요청이 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });

  const mode = newsImpactMode();
  const capabilities = newsImpactCapabilitiesForMode(entitlement, mode);
  const generatedAt = new Date().toISOString();
  const disabled: NewsImpactListResponse = {
    mode,
    market,
    asset,
    snapshotId: requestedSnapshotId ?? null,
    snapshotContext: requestedSnapshotId
      ? mode === "on" ? "matched" : "ignored_official_only"
      : "not_requested",
    generatedAt,
    quality: "unavailable",
    warning: mode === "shadow" ? "공식 뉴스와 시장 반응의 정확도를 검증 중입니다." : "공식 뉴스 분석이 비활성화되어 있습니다.",
    sourceHealth: { active: 0, healthy: 0, degraded: 0, blocked: 4 },
    events: [],
    capabilities,
    nextCursor: null
  };
  if (!isOfficialNewsFeedEnabled(mode)) return privateJson(disabled);
  if (!isSupabaseAdminConfigured()) return privateJson({ ...disabled, warning: "공식 뉴스 분석 저장소가 설정되지 않았습니다." }, { status: 503 });

  try {
    const impactEnabled = isNewsImpactReadEnabled(mode);
    const pro = impactEnabled && capabilities.canSeeProEvidence;
    const limit = normalizeLimit(url.searchParams.get("limit"), pro);
    const offset = pro ? decodeNewsCursor(url.searchParams.get("cursor")) : 0;
    const since = new Date(Date.now() - (pro ? 30 : 1) * 24 * 60 * 60_000).toISOString();
    const [initialStored, health] = await Promise.all([
      readNewsImpactEvents({ market, asset, snapshotId: impactEnabled ? requestedSnapshotId : null, since, limit: 100 }),
      readNewsSourceStatusSummary(market)
    ]);
    const usedRecentFallback = !pro && !requestedSnapshotId && initialStored.length === 0;
    const stored = usedRecentFallback
      ? await readNewsImpactEvents({
          market,
          asset,
          since: new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString(),
          limit: 100
        })
      : initialStored;
    const snapshotScoped = impactEnabled && requestedSnapshotId
      ? stored.filter((event) => event.reaction?.evaluatedSnapshotId === requestedSnapshotId)
      : stored;
    const sorted = sortNewsImpactEvents(snapshotScoped);
    const page = sorted.slice(offset, offset + limit);
    const latestRunMs = health.latestRunAt ? Date.parse(health.latestRunAt) : 0;
    const stale = !latestRunMs || Date.now() - latestRunMs > 15 * 60_000;
    const quality = health.active === 0 ? "unavailable" : stale ? "stale" : health.degraded > 0 ? "partial" : "ready";
    return privateJson({
      mode,
      market,
      asset,
      snapshotId: requestedSnapshotId ?? null,
      snapshotContext: requestedSnapshotId
        ? impactEnabled ? "matched" : "ignored_official_only"
        : "not_requested",
      generatedAt: health.latestRunAt ?? generatedAt,
      quality,
      warning: health.active === 0
        ? "활성화된 공식 출처가 없어 뉴스 분석을 제공하지 않습니다."
        : stale
          ? "공식 출처 갱신이 지연되어 마지막 정상 결과를 표시합니다."
          : health.degraded > 0
            ? "일부 공식 출처의 갱신이 지연되고 있습니다."
            : usedRecentFallback && stored.length > 0
              ? "24시간 안에 새 공식 사건이 없어 최근 7일의 중요 발표·공시를 보여드립니다."
              : mode === "shadow"
                ? "공식 발표는 바로 제공하며, 발표 전후 시장 반응 연결은 정확도를 검증 중입니다."
                : null,
      sourceHealth: { active: health.active, healthy: health.healthy, degraded: health.degraded, blocked: health.blocked },
      events: impactEnabled ? serializeNewsEvents(page, pro) : serializeOfficialNewsEvents(page),
      capabilities,
      nextCursor: pro && offset + limit < sorted.length ? encodeNewsCursor(offset + limit) : null
    } satisfies NewsImpactListResponse);
  } catch (error) {
    console.error("[api/news-impact] error:", error);
    return privateJson({ ...disabled, warning: "공식 뉴스 분석을 불러오지 못했습니다." }, { status: 503 });
  }
}
