// Deribit 공개 옵션 데이터를 BTC/ETH 옵션 시장 온도로 제공하는 API 라우트입니다.
import { NextResponse } from "next/server";
import type { OptionsCurrency, OptionsMarketReport } from "@/lib/optionsMarket";
import { rateLimit } from "@/lib/server/rateLimit";
import { fetchOptionsMarketReport } from "@/lib/server/optionsMarketSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 2 * 60 * 1000;
const allowedCurrencies = new Set<OptionsCurrency>(["BTC", "ETH"]);

interface CacheValue {
  cachedAt: number;
  report: OptionsMarketReport;
}

const cache = new Map<OptionsCurrency, CacheValue>();

function normalizeCurrency(raw: string | null): OptionsCurrency | null {
  const currency = (raw || "BTC").trim().toUpperCase();
  return allowedCurrencies.has(currency as OptionsCurrency) ? (currency as OptionsCurrency) : null;
}

export async function GET(request: Request) {
  const limit = await rateLimit(request, { key: "options-market", limit: 40, windowMs: 5 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "옵션 시장 요청이 잠시 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const url = new URL(request.url);
  const currency = normalizeCurrency(url.searchParams.get("currency"));
  if (!currency) {
    return NextResponse.json({ error: "지원하지 않는 옵션 통화입니다.", allowedCurrencies: Array.from(allowedCurrencies) }, { status: 400 });
  }

  const now = Date.now();
  const cached = cache.get(currency);
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json({ report: cached.report, cachedAt: cached.cachedAt, cached: true });
  }

  try {
    const report = await fetchOptionsMarketReport(currency);
    const cachedAt = Date.now();
    cache.set(currency, { cachedAt, report });
    return NextResponse.json({ report, cachedAt, cached: false });
  } catch (error) {
    console.error("[api/options-market] error:", error);
    if (cached) {
      return NextResponse.json({ report: cached.report, cachedAt: cached.cachedAt, cached: true, stale: true });
    }
    return NextResponse.json({ error: "옵션 시장 흐름을 잠시 확인하지 못했습니다." }, { status: 500 });
  }
}
