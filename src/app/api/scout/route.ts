/**
 * GET /api/scout
 *
 * ?쒕쾭 ?ъ씠??Setup Scout ??5遺??몃찓紐⑤━ 罹먯떆.
 * - ?대씪?댁뼵?멸? Binance??吏곸젒 ?붿껌?섏? ?딄퀬 ?ш린????踰덈쭔 吏묎퀎
 * - ???놁쓬 / ?몄쬆 ?놁쓬 (寃곌낵??plan-gating??SetupScoutPanel??泥섎━)
 * - rate limit: 5遺?罹먯떆濡??먯뿰?ㅻ읇寃?諛⑹뼱
 */

import { NextResponse } from "next/server";
import { scanAllSetups, topSetups, type ScoutRiskProfile, type ScoutSetup } from "@/lib/setupScout";
import { getLiquidCryptoSymbols } from "@/lib/cryptoUniverse";
import { rateLimit } from "@/lib/server/rateLimit";
import type { TradingMode } from "@/lib/marketAnalysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5遺?
interface ServerCache {
  setups: ScoutSetup[];
  cachedAt: number;
}

const cacheByKey = new Map<string, ServerCache>();
const inflightByKey = new Map<string, Promise<ScoutSetup[]>>();
type ScoutScope = "all" | "major" | "alts";

const majorSymbols = new Set(["BTCUSDT.P", "ETHUSDT.P"]);

function parseMode(request: Request): TradingMode {
  const raw = new URL(request.url).searchParams.get("mode");
  return raw === "swing" ? "swing" : "scalp";
}

function parseRiskProfile(request: Request): ScoutRiskProfile {
  const raw = new URL(request.url).searchParams.get("risk");
  return raw === "radar" ? "radar" : "guard";
}

function parseScope(request: Request): ScoutScope {
  const raw = new URL(request.url).searchParams.get("scope");
  if (raw === "major" || raw === "alts") return raw;
  return "all";
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

export async function GET(request: Request) {
  const limit = await rateLimit(request, { key: "scout", limit: 20, windowMs: 5 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
        { error: "?덉씠???붿껌???덈Т 留롮뒿?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄?섏꽭??" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const mode = parseMode(request);
  const riskProfile = parseRiskProfile(request);
  const scope = parseScope(request);
  const cacheKey = `${mode}:${riskProfile}:${scope}`;
  const now = Date.now();
  const cache = cacheByKey.get(cacheKey) ?? null;

  // ?좏슚??罹먯떆媛 ?덉쑝硫?利됱떆 諛섑솚
  if (cache && now - cache.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json({
      setups: cache.setups,
      cachedAt: cache.cachedAt,
      cached: true
    });
  }

  // ?숈떆 ?붿껌 以?inflight媛 ?덉쑝硫??ъ궗??(thundering-herd 諛⑹?)
  if (!inflightByKey.has(cacheKey)) {
    const promise = getScannerSymbols(scope)
      .then((symbols) => scanAllSetups({ mode, riskProfile, symbols }))
      .then((all) => {
        const scoped = all.filter((setup) => setupInScope(setup, scope));
        const top = topSetups(scoped, riskProfile === "radar" ? 6 : 3);
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
      cached: false
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "?덉씠???먮룆???ㅽ뙣?덉뒿?덈떎.";
    console.error("[api/scout] ?덉씠???ㅻ쪟:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
