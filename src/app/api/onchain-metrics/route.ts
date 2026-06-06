import { NextResponse } from "next/server";
import type { OnchainMetricReport } from "@/lib/onchainMetrics";
import { fetchBitcoinOnchainMetricReport } from "@/lib/server/onchainMetricsSource";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 60 * 1000;
const supportedNetworks = new Set(["btc"]);

interface CacheValue {
  cachedAt: number;
  report: OnchainMetricReport;
}

let cache: CacheValue | null = null;

function normalizeNetwork(raw: string | null) {
  const network = (raw || "btc").toLowerCase().trim();
  return supportedNetworks.has(network) ? network : null;
}

export async function GET(request: Request) {
  const limit = await rateLimit(request, { key: "onchain-metrics", limit: 60, windowMs: 5 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "온체인 데이터 요청이 잠시 많습니다. 잠시 뒤 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const url = new URL(request.url);
  const network = normalizeNetwork(url.searchParams.get("network"));
  if (!network) {
    return NextResponse.json({ error: "network는 btc만 지원합니다.", supportedNetworks: Array.from(supportedNetworks) }, { status: 400 });
  }

  const now = Date.now();
  if (cache && now - cache.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json({ report: cache.report, cachedAt: cache.cachedAt, cached: true });
  }

  try {
    const report = await fetchBitcoinOnchainMetricReport();
    const cachedAt = Date.now();
    cache = { report, cachedAt };
    return NextResponse.json({ report, cachedAt, cached: false });
  } catch (error) {
    console.error("[api/onchain-metrics] error:", error);
    if (cache) {
      return NextResponse.json({ report: cache.report, cachedAt: cache.cachedAt, cached: true, stale: true });
    }
    return NextResponse.json({ error: "온체인 데이터를 잠시 확인하지 못했습니다." }, { status: 500 });
  }
}
