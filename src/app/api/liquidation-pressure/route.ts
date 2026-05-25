// Binance 공개 데이터로 청산 압력 레이더 리포트를 제공하는 API 라우트입니다.
import { NextResponse } from "next/server";
import type { LiquidationPressureReport } from "@/lib/liquidationPressure";
import { fetchLiquidationPressureReport } from "@/lib/server/liquidationPressureSource";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 60 * 1000;
const allowedPeriods = new Set(["5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "1d"]);

interface CacheValue {
  cachedAt: number;
  report: LiquidationPressureReport;
}

const cache = new Map<string, CacheValue>();

function normalizeSymbol(raw: string | null) {
  const fallback = "BTCUSDT";
  if (!raw) return fallback;
  const cleaned = raw.toUpperCase().replace(".P", "").replace("/", "").trim();
  if (!/^[A-Z0-9]{2,30}$/.test(cleaned)) return null;
  return cleaned.endsWith("USDT") ? cleaned : `${cleaned}USDT`;
}

function normalizePeriod(raw: string | null) {
  if (!raw) return "15m";
  if (allowedPeriods.has(raw)) return raw;
  return null;
}

function invalidParam(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function parseQuery(url: URL) {
  const rawSymbol = url.searchParams.get("symbol");
  const rawPeriod = url.searchParams.get("period");
  const symbol = normalizeSymbol(rawSymbol);
  const period = normalizePeriod(rawPeriod);

  if (!symbol) {
    return {
      error: invalidParam("지원하지 않는 코인 심볼입니다.")
    };
  }

  if (!period) {
    return {
      error: NextResponse.json(
        {
          error: "지원하지 않는 기간입니다.",
          allowedPeriods: Array.from(allowedPeriods)
        },
        { status: 400 }
      )
    };
  }

  return { symbol, period };
}

export async function GET(request: Request) {
  const limit = await rateLimit(request, { key: "liquidation-pressure", limit: 40, windowMs: 5 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "청산 압력 레이더 요청이 잠시 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const url = new URL(request.url);
  const parsedQuery = parseQuery(url);
  if ("error" in parsedQuery) return parsedQuery.error;

  const { symbol, period } = parsedQuery;
  const cacheKey = `${symbol}:${period}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);

  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json({ report: cached.report, cachedAt: cached.cachedAt, cached: true });
  }

  try {
    const report = await fetchLiquidationPressureReport(symbol, period);
    cache.set(cacheKey, { cachedAt: Date.now(), report });
    return NextResponse.json({ report, cachedAt: Date.now(), cached: false });
  } catch (error) {
    console.error("[api/liquidation-pressure] error:", error);
    if (cached) {
      return NextResponse.json({ report: cached.report, cachedAt: cached.cachedAt, cached: true, stale: true });
    }
    return NextResponse.json({ error: "청산 압력 흐름을 잠시 확인하지 못했습니다." }, { status: 500 });
  }
}
