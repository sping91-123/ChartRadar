/**
 * POST /api/watchlist-scan
 *
 * 愿??肄붿씤 紐⑸줉??諛쏆븘 ?덉씠???먮룆 寃곌낵瑜?諛섑솚.
 * Body: { symbols: string[] }
 *
 * - 醫낅ぉ ??理쒕? 10媛?(?쒕쾭 遺??諛⑹?)
 * - 3遺??몃찓紐⑤━ 罹먯떆 (?뺣젹???щ낵 臾몄옄????
 * - ?몄쬆 ?놁쓬 ??plan gating? ?대씪?댁뼵?멸? 泥섎━
 */

import { NextRequest, NextResponse } from "next/server";
import { scanAllSetups, type ScoutSetup } from "@/lib/setupScout";
import { isLikelyUsdtPerpSymbol } from "@/lib/cryptoUniverse";
import { isBodyTooLarge, rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 3 * 60 * 1000;
const MAX_SYMBOLS = 10;

interface CacheEntry {
  setups: ScoutSetup[];
  cachedAt: number;
}

// ?щ낵 議고빀蹂?罹먯떆
const cacheMap = new Map<string, CacheEntry>();
const inflightMap = new Map<string, Promise<ScoutSetup[]>>();

function makeCacheKey(symbols: string[]): string {
  return [...symbols].sort().join(",");
}

export async function POST(req: NextRequest) {
  const limit = await rateLimit(req, { key: "watchlist-scan", limit: 20, windowMs: 5 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
        { error: "愿??肄붿씤 ?덉씠???붿껌???덈Т 留롮뒿?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄?섏꽭??" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  if (isBodyTooLarge(req, 12_000)) {
    return NextResponse.json({ error: "?붿껌 蹂몃Ц???덈Т ?쎈땲??" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "?붿껌 ?뺤떇???щ컮瑜댁? ?딆뒿?덈떎." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("symbols" in body)) {
    return NextResponse.json({ error: "symbols ?꾨뱶媛 ?꾩슂?⑸땲??" }, { status: 400 });
  }

  const rawSymbols = (body as { symbols: unknown }).symbols;
  if (!Array.isArray(rawSymbols)) {
    return NextResponse.json({ error: "symbols??諛곗뿴?댁뼱???⑸땲??" }, { status: 400 });
  }

  // 諛붿씠?몄뒪 ?꾩껜 USDT-M ?щ낵 ?뺤떇留??덉슜?쒕떎. ?ㅼ젣 議댁옱 ?щ????ㅼ틪 ?④퀎?먯꽌 ?먯뿰?ㅻ읇寃?嫄몃윭吏꾨떎.
  const symbols: string[] = (rawSymbols as unknown[])
    .filter((s): s is string => typeof s === "string" && isLikelyUsdtPerpSymbol(s))
    .slice(0, MAX_SYMBOLS);

  if (symbols.length === 0) {
    return NextResponse.json({ setups: [], cachedAt: Date.now(), cached: false });
  }

  const key = makeCacheKey(symbols);
  const now = Date.now();

  // 罹먯떆 ?뺤씤
  const cached = cacheMap.get(key);
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json({ setups: cached.setups, cachedAt: cached.cachedAt, cached: true });
  }

  // thundering-herd 諛⑹?
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
    return NextResponse.json({
      setups,
      cachedAt: entry?.cachedAt ?? Date.now(),
      cached: false
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "?덉씠???먮룆???ㅽ뙣?덉뒿?덈떎.";
    console.error("[api/watchlist-scan] ?ㅻ쪟:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
