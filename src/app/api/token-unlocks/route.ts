import { NextResponse } from "next/server";
import type { TokenUnlockReport } from "@/lib/tokenUnlocks";
import { fetchTokenUnlockReport } from "@/lib/server/tokenUnlocksSource";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 10 * 60 * 1000;
const MIN_LIMIT = 1;
const MAX_LIMIT = 12;

interface CacheValue {
  cachedAt: number;
  report: TokenUnlockReport;
}

let cache: CacheValue | null = null;

function parseLimit(raw: string | null) {
  if (raw === null || raw.trim() === "") return 6;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < MIN_LIMIT || value > MAX_LIMIT) return null;
  return value;
}

function withLimit(report: TokenUnlockReport, limit: number): TokenUnlockReport {
  return {
    ...report,
    items: report.items.slice(0, limit),
    highestPressure: report.items[0] ?? null
  };
}

export async function GET(request: Request) {
  const limitResult = await rateLimit(request, { key: "token-unlocks", limit: 30, windowMs: 5 * 60 * 1000 });
  if (!limitResult.allowed) {
    return NextResponse.json(
      { error: "언락 데이터 요청이 잠시 많습니다. 잠시 뒤 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(limitResult.retryAfter) } }
    );
  }

  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  if (limit === null) {
    return NextResponse.json({ error: "limit은 1부터 12 사이의 정수여야 합니다." }, { status: 400 });
  }

  const now = Date.now();
  if (cache && now - cache.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json({ report: withLimit(cache.report, limit), cachedAt: cache.cachedAt, cached: true });
  }

  try {
    const report = await fetchTokenUnlockReport();
    const cachedAt = Date.now();
    cache = { report, cachedAt };
    return NextResponse.json({ report: withLimit(report, limit), cachedAt, cached: false });
  } catch (error) {
    console.error("[api/token-unlocks] error:", error);
    if (cache) {
      return NextResponse.json({ report: withLimit(cache.report, limit), cachedAt: cache.cachedAt, cached: true, stale: true });
    }
    return NextResponse.json({ error: "언락 데이터를 잠시 확인하지 못했습니다." }, { status: 500 });
  }
}
