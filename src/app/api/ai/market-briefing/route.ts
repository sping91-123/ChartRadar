// 차트 판독 데이터를 받아 AI 종합 브리핑을 생성하는 API 라우트.
import { NextResponse } from "next/server";
import { AIProviderError, getAIProviderCandidates, type MarketBriefingInput } from "@/lib/ai";
import { generateFallbackMarketBriefing } from "@/lib/ai/fallback";
import { isBodyTooLarge, rateLimit } from "@/lib/server/rateLimit";
import { entitlementRateKey, getRequestEntitlement } from "@/lib/server/requestEntitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { text: string; expiresAt: number }>();

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

function cacheKey(input: MarketBriefingInput) {
  return [
    input.symbol,
    input.analysisScope,
    input.activeTimeframe,
    input.tradingMode,
    Math.round(input.price * 100) / 100,
    input.bias,
    input.biasScore,
    input.active.msb,
    input.active.choch,
    input.active.ob,
    input.active.fvg,
    input.active.poc,
    input.active.pd,
    input.aggregate?.compositeScore ?? "",
    input.aggregate?.alignment ?? "",
    input.pressure?.dominant ?? "",
    input.pressure?.longScore ?? "",
    input.pressure?.shortScore ?? ""
  ].join("|");
}

export async function POST(request: Request) {
  const entitlement = await getRequestEntitlement(request, "crypto");
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
  const key = cacheKey(input);
  const now = Date.now();
  const hit = cache.get(key);

  if (hit && hit.expiresAt > now) {
    return NextResponse.json({ briefing: hit.text, model: "cache", cached: true });
  }

  try {
    const providers = getAIProviderCandidates();
    for (const provider of providers) {
      try {
        const text = cleanMarketBriefingText(await provider.generateMarketBriefing(input));
        cache.set(key, { text, expiresAt: now + CACHE_TTL_MS });
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
  cache.set(key, { text: fallback, expiresAt: now + CACHE_TTL_MS });
  return NextResponse.json({ briefing: fallback, model: "fallback", cached: false });
}
