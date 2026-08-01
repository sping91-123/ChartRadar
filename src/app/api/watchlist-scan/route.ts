/**
 * POST /api/watchlist-scan
 *
 * 관심코인 목록을 받아 레이더 자동 스캔 결과를 반환합니다.
 * Body: { symbols: string[] }
 *
 * - 종목은 최대 10개까지만 처리합니다.
 * - 3분 메모리 캐시를 사용합니다.
 * - 권한 제한은 별도 사용량 시스템에서 처리합니다.
 */

import { NextRequest, NextResponse } from "next/server";
import { scanAllSetups, serializeScoutSetups, type ScoutSetup } from "@/lib/setupScout";
import { getCoinCapabilityPolicy } from "@/lib/coinCapabilities";
import { isLikelyUsdtPerpSymbol } from "@/lib/cryptoUniverse";
import { isBodyTooLarge, rateLimit } from "@/lib/server/rateLimit";
import { entitlementRateKey, getRequestEntitlement } from "@/lib/server/requestEntitlement";
import { claimCoinDailyUsage } from "@/lib/server/coinUsageQuota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 3 * 60 * 1000;
interface CacheEntry {
  setups: ScoutSetup[];
  cachedAt: number;
}

// 심볼 조합별 캐시입니다.
const cacheMap = new Map<string, CacheEntry>();
const inflightMap = new Map<string, Promise<ScoutSetup[]>>();

function makeCacheKey(symbols: string[]): string {
  return [...symbols].sort().join(",");
}

export async function POST(req: NextRequest) {
  const entitlement = await getRequestEntitlement(req, "crypto");
  if (entitlement.state === "unavailable") {
    return NextResponse.json({ error: "구독 권한을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }
  const capability = getCoinCapabilityPolicy(entitlement.plan);
  const limit = await rateLimit(req, {
    key: entitlementRateKey("watchlist-scan", entitlement),
    limit: entitlement.isPaid ? 100 : 20,
    windowMs: 5 * 60 * 1000
  });
  if (!limit.allowed) {
    return NextResponse.json(
        { error: "관심코인 레이더 요청이 잠시 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  if (isBodyTooLarge(req, 12_000)) {
    return NextResponse.json({ error: "요청 본문이 너무 큽니다." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("symbols" in body)) {
    return NextResponse.json({ error: "symbols 필드가 필요합니다." }, { status: 400 });
  }

  const rawSymbols = (body as { symbols: unknown }).symbols;
  if (!Array.isArray(rawSymbols)) {
    return NextResponse.json({ error: "symbols는 배열이어야 합니다." }, { status: 400 });
  }

  const invalidSymbol = rawSymbols.find((symbol) => typeof symbol !== "string" || !isLikelyUsdtPerpSymbol(symbol));
  if (invalidSymbol !== undefined) {
    return NextResponse.json(
      { error: "지원하지 않는 관심코인 심볼이 포함되어 있습니다. 차트 레이더에서 제공하는 코인 심볼만 요청해 주세요." },
      { status: 400 }
    );
  }

  const maxSymbols = capability.watchlistScanSymbolLimit;
  const symbols = (rawSymbols as string[]).slice(0, maxSymbols);

  if (symbols.length === 0) {
    return NextResponse.json({ setups: [], cachedAt: Date.now(), cached: false, maxSymbols });
  }

  const successResponse = async (payload: Record<string, unknown>) => {
    const quota = await claimCoinDailyUsage({
      request: req,
      entitlement,
      bucket: "watchlist",
      limit: capability.watchlistScanDailyLimit
    });
    if (!quota.allowed) {
      const backendUnavailable = quota.backend === "unavailable";
      return NextResponse.json(
        {
          error: backendUnavailable
            ? "관심코인 사용량을 확인하지 못해 요청을 안전하게 중단했습니다. 잠시 후 다시 시도해 주세요."
            : "오늘 관심코인 자동 확인 한도를 모두 사용했습니다. 저장한 결과는 다시 볼 수 있고 Pro에서는 장중 반복 확인이 가능합니다.",
          code: backendUnavailable ? "usage_backend_unavailable" : "daily_quota_reached",
          usage: quota.usage
        },
        { status: backendUnavailable ? 503 : 429, headers: { "Retry-After": String(quota.retryAfter) } }
      );
    }
    return NextResponse.json({ ...payload, usage: quota.usage });
  };

  const key = makeCacheKey(symbols);
  const now = Date.now();

  // 캐시 확인.
  const cached = cacheMap.get(key);
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return successResponse({
      setups: serializeScoutSetups(cached.setups, capability.detailedScoutEvidence),
      cachedAt: cached.cachedAt,
      cached: true,
      maxSymbols
    });
  }

  // thundering-herd 방지.
  let inflight = inflightMap.get(key);
  if (!inflight) {
    inflight = scanAllSetups({ symbols })
      .then((setups) => {
        cacheMap.set(key, { setups, cachedAt: Date.now() });
        return setups;
      })
      .finally(() => {
        inflightMap.delete(key);
      });
    inflightMap.set(key, inflight);
  }

  try {
    const setups = await inflight;
    const entry = cacheMap.get(key);
    return successResponse({
      setups: serializeScoutSetups(setups, capability.detailedScoutEvidence),
      cachedAt: entry?.cachedAt ?? Date.now(),
      cached: false,
      maxSymbols,
      entitlement: { isPaid: entitlement.isPaid, plan: entitlement.plan }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "레이더 자동 스캔에 실패했습니다.";
    console.error("[api/watchlist-scan] 오류:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
