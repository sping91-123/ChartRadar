/**
 * GET /api/scout
 *
 * 서버에서 레이더 후보를 스캔하고 짧게 캐시해 중복 요청을 줄입니다.
 * 클라이언트가 Binance를 직접 반복 호출하지 않도록 서버에서 한 번만 집계합니다.
 * 사용량과 권한 제한은 별도 사용량 시스템에서 처리합니다.
 * rate limit과 inflight 재사용으로 급격한 중복 요청을 줄입니다.
 */

import { NextResponse } from "next/server";
import { scanAllSetups, topSetups, type ScoutRiskProfile, type ScoutSetup } from "@/lib/setupScout";
import { getLiquidCryptoSymbols } from "@/lib/cryptoUniverse";
import { rateLimit } from "@/lib/server/rateLimit";
import { entitlementRateKey, getRequestEntitlement } from "@/lib/server/requestEntitlement";
import type { TradingMode } from "@/lib/marketAnalysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5분

interface ServerCache {
  setups: ScoutSetup[];
  cachedAt: number;
}

const cacheByKey = new Map<string, ServerCache>();
const inflightByKey = new Map<string, Promise<ScoutSetup[]>>();
type ScoutScope = "all" | "major" | "alts";

const majorSymbols = new Set(["BTCUSDT.P", "ETHUSDT.P"]);

function parseMode(searchParams: URLSearchParams): TradingMode | null {
  const raw = searchParams.get("mode");
  if (raw === null) return "scalp";
  if (raw === "scalp" || raw === "swing") return raw;
  return null;
}

function parseRiskProfile(searchParams: URLSearchParams): ScoutRiskProfile | null {
  const raw = searchParams.get("risk");
  if (raw === null) return "guard";
  if (raw === "guard" || raw === "radar") return raw;
  return null;
}

function parseScope(searchParams: URLSearchParams): ScoutScope | null {
  const raw = searchParams.get("scope");
  if (raw === null) return "all";
  if (raw === "all" || raw === "major" || raw === "alts") return raw;
  return null;
}

function setupInScope(setup: ScoutSetup, scope: ScoutScope) {
  if (scope === "all") return true;
  const isMajor = majorSymbols.has(setup.symbol);
  return scope === "major" ? isMajor : !isMajor;
}

async function getScannerSymbols(scope: ScoutScope) {
  if (scope === "major") return ["BTCUSDT.P", "ETHUSDT.P"];
  if (scope === "alts") return getLiquidCryptoSymbols({ excludeMajor: true, limit: 36 });
  return getLiquidCryptoSymbols({ includeMajor: true, limit: 40 });
}

function getScoutTopLimit(scope: ScoutScope, riskProfile: ScoutRiskProfile, isPaid: boolean) {
  if (scope === "alts") {
    if (!isPaid) return 3;
    return riskProfile === "radar" ? 5 : 3;
  }
  return isPaid ? (riskProfile === "radar" ? 12 : 6) : riskProfile === "radar" ? 6 : 3;
}

export async function GET(request: Request) {
  const entitlement = await getRequestEntitlement(request, "crypto");
  const limit = await rateLimit(request, {
    key: entitlementRateKey("scout", entitlement),
    limit: entitlement.isPaid ? 120 : 20,
    windowMs: 5 * 60 * 1000
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "레이더 요청이 잠시 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const mode = parseMode(searchParams);
  const riskProfile = parseRiskProfile(searchParams);
  const scope = parseScope(searchParams);
  if (!mode || !riskProfile || !scope) {
    return NextResponse.json(
      { error: "지원하지 않는 레이더 요청입니다. mode, risk, scope 값을 확인해 주세요." },
      { status: 400 }
    );
  }

  const cacheKey = `${mode}:${riskProfile}:${scope}:${entitlement.isPaid ? "pro" : "basic"}`;
  const now = Date.now();
  const cache = cacheByKey.get(cacheKey) ?? null;

  // 유효한 캐시가 있으면 즉시 반환합니다.
  if (cache && now - cache.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json({
      setups: cache.setups,
      cachedAt: cache.cachedAt,
      cached: true,
      entitlement: { isPaid: entitlement.isPaid, plan: entitlement.plan }
    });
  }

  // 같은 요청이 이미 진행 중이면 같은 Promise를 재사용합니다.
  if (!inflightByKey.has(cacheKey)) {
    const promise = getScannerSymbols(scope)
      .then((symbols) => scanAllSetups({ mode, riskProfile, symbols }))
      .then((all) => {
        const scoped = all.filter((setup) => setupInScope(setup, scope));
        const topLimit = getScoutTopLimit(scope, riskProfile, entitlement.isPaid);
        const top = topSetups(scoped, topLimit);
        cacheByKey.set(cacheKey, { setups: top, cachedAt: Date.now() });
        return top;
      })
      .finally(() => {
        inflightByKey.delete(cacheKey);
      });
    inflightByKey.set(cacheKey, promise);
  }

  try {
    const setups = await inflightByKey.get(cacheKey)!;
    return NextResponse.json({
      setups,
      cachedAt: cacheByKey.get(cacheKey)?.cachedAt ?? Date.now(),
      cached: false,
      entitlement: { isPaid: entitlement.isPaid, plan: entitlement.plan }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "레이더 자동 스캔에 실패했습니다.";
    console.error("[api/scout] 레이더 스캔 오류:", error);
    if (cache) {
      return NextResponse.json({
        setups: cache.setups,
        cachedAt: cache.cachedAt,
        cached: true,
        stale: true
      });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
