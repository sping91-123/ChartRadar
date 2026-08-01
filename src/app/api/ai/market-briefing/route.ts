// 차트 판독 데이터를 받아 AI 종합 브리핑을 생성하는 API 라우트.
import { NextResponse } from "next/server";
import { AIProviderError, getAIProviderCandidates, type MarketBriefingInput } from "@/lib/ai";
import { generateFallbackMarketBriefing } from "@/lib/ai/fallback";
import { isBodyTooLarge, rateLimit } from "@/lib/server/rateLimit";
import { entitlementRateKey, getRequestEntitlement } from "@/lib/server/requestEntitlement";
import { getCoinCapabilityPolicy } from "@/lib/coinCapabilities";
import {
  getMarketBriefingCache,
  marketBriefingCacheKey,
  setMarketBriefingCache
} from "@/lib/ai/marketBriefingCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_SECONDS = 5 * 60;

function cleanMarketBriefingText(text: string) {
  return text
    .replace(/[\u3040-\u30ff]+/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 12 && value.every((item) => typeof item === "string" && item.length <= 240);
}

function isValidInput(value: unknown): value is MarketBriefingInput {
  if (!isRecord(value)) return false;
  if (!isRecord(value.active)) return false;
  if (!Array.isArray(value.timeframes)) return false;
  if (!Array.isArray(value.reasons)) return false;
  if (value.timeframes.length > 5 || value.reasons.length > 16) return false;
  const aggregate = value.aggregate;
  const validAggregate =
    aggregate === undefined ||
    (isRecord(aggregate) &&
      typeof aggregate.directionLabel === "string" &&
      typeof aggregate.compositeScore === "number" &&
      typeof aggregate.alignment === "string" &&
      typeof aggregate.shortTimeframeSummary === "string" &&
      typeof aggregate.higherTimeframeSummary === "string" &&
      typeof aggregate.volatility === "string" &&
      typeof aggregate.volume === "string" &&
      isStringArray(aggregate.keySignals));
  const pressure = value.pressure;
  const validPressure =
    pressure === undefined ||
    (isRecord(pressure) &&
      typeof pressure.dominant === "string" &&
      typeof pressure.dominantLabel === "string" &&
      typeof pressure.longScore === "number" &&
      typeof pressure.shortScore === "number" &&
      typeof pressure.summary === "string" &&
      typeof pressure.structurePressureRead === "string" &&
      isStringArray(pressure.evidence));

  return (
    typeof value.symbol === "string" &&
    (value.analysisScope === undefined || typeof value.analysisScope === "string") &&
    typeof value.activeTimeframe === "string" &&
    typeof value.tradingMode === "string" &&
    typeof value.price === "number" &&
    typeof value.verdict === "string" &&
    typeof value.bias === "string" &&
    typeof value.biasScore === "number" &&
    typeof value.scoreRange === "string" &&
    typeof value.readiness === "string" &&
    typeof value.summaryLine === "string" &&
    typeof value.actionGuide === "string" &&
    typeof value.currentLocationLabel === "string" &&
    typeof value.killzone === "string" &&
    isStringArray(value.opportunityFlags) &&
    isStringArray(value.riskFlags) &&
    validAggregate &&
    validPressure &&
    value.timeframes.every((item) => isRecord(item) && typeof item.timeframe === "string")
  );
}

function kstDateKey(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function millisecondsUntilNextKstMidnight(now = new Date()) {
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const nextMidnightUtc = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate() + 1);
  return Math.max(1_000, nextMidnightUtc - kstNow.getTime());
}

export async function POST(request: Request) {
  const entitlement = await getRequestEntitlement(request, "crypto");
  if (entitlement.state === "unavailable") {
    return NextResponse.json({ error: "구독 권한을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }
  const limit = await rateLimit(request, {
    key: entitlementRateKey("ai-market-briefing", entitlement),
    limit: entitlement.isPaid ? 60 : 12,
    windowMs: 10 * 60 * 1000
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "AI 브리핑 요청이 잠시 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  if (isBodyTooLarge(request, 80_000)) {
    return NextResponse.json({ error: "요청 본문이 너무 큽니다." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "유효한 JSON 본문이 필요합니다." }, { status: 400 });
  }

  if (!isValidInput(body)) {
    return NextResponse.json({ error: "AI 종합 브리핑 입력값이 부족합니다." }, { status: 400 });
  }

  const input = body as MarketBriefingInput;
  const key = marketBriefingCacheKey(input);
  const cached = await getMarketBriefingCache(key);
  if (cached.status === "hit") {
    return NextResponse.json({ briefing: cached.value.briefing, model: cached.value.model, cached: true });
  }
  if (cached.status === "unavailable") {
    return NextResponse.json(
      { error: "AI 브리핑 캐시를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.", code: "cache_unavailable" },
      { status: 503 }
    );
  }

  const policy = getCoinCapabilityPolicy(entitlement.plan);
  const dailyLimit = await rateLimit(request, {
    key: entitlementRateKey(`coin-ai-generation-daily:v1:${kstDateKey()}`, entitlement),
    limit: policy.cryptoAiDailyLimit,
    windowMs: millisecondsUntilNextKstMidnight(),
    includeClientIp: entitlement.userId ? false : true,
    requireSharedBackend: process.env.NODE_ENV === "production"
  });
  if (!dailyLimit.allowed) {
    const unavailable = dailyLimit.backend === "unavailable";
    return NextResponse.json(
      {
        error: unavailable
          ? "AI 사용량을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요."
          : policy.tier === "basic"
            ? "오늘 Basic AI 1회를 사용했습니다. Coin Pro는 새 브리핑을 하루 24회 생성할 수 있습니다."
            : "오늘 Coin Pro AI 새 브리핑 24회를 사용했습니다.",
        code: unavailable ? "usage_limit_unavailable" : "daily_limit"
      },
      { status: unavailable ? 503 : 429, headers: { "Retry-After": String(dailyLimit.retryAfter) } }
    );
  }

  try {
    const providers = getAIProviderCandidates();
    for (const provider of providers) {
      try {
        const text = cleanMarketBriefingText(await provider.generateMarketBriefing(input));
        const cachedResult = await setMarketBriefingCache(
          key,
          { briefing: text, model: provider.model },
          CACHE_TTL_SECONDS
        );
        if (!cachedResult && process.env.NODE_ENV === "production") {
          console.warn("[ai/market-briefing] Shared cache write failed after generation.");
        }
        return NextResponse.json({ briefing: text, model: provider.model, cached: false });
      } catch (error) {
        if (error instanceof AIProviderError) {
          console.warn(`[ai/market-briefing] ${error.provider} 실패, 다음 후보 확인.`, error.message);
        } else {
          console.warn("[ai/market-briefing] Provider 호출 실패, 다음 후보 확인.", error);
        }
      }
    }
  } catch (error) {
    console.warn("[ai/market-briefing] Provider 없음, 폴백 사용.", error instanceof Error ? error.message : error);
  }

  const fallback = cleanMarketBriefingText(generateFallbackMarketBriefing(input));
  const cachedFallback = await setMarketBriefingCache(
    key,
    { briefing: fallback, model: "fallback" },
    CACHE_TTL_SECONDS
  );
  if (!cachedFallback && process.env.NODE_ENV === "production") {
    console.warn("[ai/market-briefing] Shared fallback cache write failed after generation.");
  }
  return NextResponse.json({ briefing: fallback, model: "fallback", cached: false });
}
