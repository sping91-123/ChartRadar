// Binance 공개 선물 체결에서 큰 금액 체결 흐름을 제공하는 API 라우트입니다.
import { NextResponse } from "next/server";
import type { LargeTradeFlowReport } from "@/lib/largeTradeFlow";
import { fetchLargeTradeFlowReport } from "@/lib/server/largeTradeFlowSource";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 30 * 1000;
const allowedSymbols = new Set(["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT"]);

interface CacheValue {
  cachedAt: number;
  report: LargeTradeFlowReport;
}

const cache = new Map<string, CacheValue>();

function normalizeSymbol(raw: string | null) {
  const symbol = (raw || "BTCUSDT").toUpperCase().replace(".P", "").replace("/", "").trim();
  const normalized = symbol.endsWith("USDT") ? symbol : `${symbol}USDT`;
  return allowedSymbols.has(normalized) ? normalized : null;
}

export async function GET(request: Request) {
  const limit = await rateLimit(request, { key: "large-trade-flow", limit: 60, windowMs: 5 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "큰 체결 흐름 요청이 잠시 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const url = new URL(request.url);
  const symbol = normalizeSymbol(url.searchParams.get("symbol"));
  if (!symbol) {
    return NextResponse.json({ error: "지원하지 않는 큰 체결 심볼입니다.", allowedSymbols: Array.from(allowedSymbols) }, { status: 400 });
  }

  const now = Date.now();
  const cached = cache.get(symbol);
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json({ report: cached.report, cachedAt: cached.cachedAt, cached: true });
  }

  try {
    const report = await fetchLargeTradeFlowReport(symbol);
    const cachedAt = Date.now();
    cache.set(symbol, { cachedAt, report });
    return NextResponse.json({ report, cachedAt, cached: false });
  } catch (error) {
    console.error("[api/large-trade-flow] error:", error);
    if (cached) {
      return NextResponse.json({ report: cached.report, cachedAt: cached.cachedAt, cached: true, stale: true });
    }
    return NextResponse.json({ error: "큰 체결 흐름을 잠시 확인하지 못했습니다." }, { status: 500 });
  }
}
