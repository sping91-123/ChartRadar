import { NextResponse } from "next/server";
import type { StablecoinLiquidityReport } from "@/lib/stablecoinLiquidity";
import { rateLimit } from "@/lib/server/rateLimit";
import { fetchStablecoinLiquidityReport } from "@/lib/server/stablecoinLiquiditySource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheValue {
  cachedAt: number;
  report: StablecoinLiquidityReport;
}

let cache: CacheValue | null = null;

export async function GET(request: Request) {
  const limit = await rateLimit(request, { key: "stablecoin-liquidity", limit: 40, windowMs: 5 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "스테이블코인 유동성 요청이 잠시 많습니다. 잠시 뒤 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const now = Date.now();
  if (cache && now - cache.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json({ report: cache.report, cachedAt: cache.cachedAt, cached: true });
  }

  try {
    const report = await fetchStablecoinLiquidityReport();
    const cachedAt = Date.now();
    cache = { report, cachedAt };
    return NextResponse.json({ report, cachedAt, cached: false });
  } catch (error) {
    console.error("[api/stablecoin-liquidity] error:", error);
    if (cache) {
      return NextResponse.json({ report: cache.report, cachedAt: cache.cachedAt, cached: true, stale: true });
    }
    return NextResponse.json({ error: "스테이블코인 유동성을 잠시 확인하지 못했습니다." }, { status: 500 });
  }
}
