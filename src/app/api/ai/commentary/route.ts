/**
 * POST /api/ai/commentary
 *
 * 레이더 카드 1개에 대한 AI 코멘트를 생성합니다.
 * - 키는 서버에서만 사용하고 클라이언트에 노출하지 않습니다.
 * - 같은 입력은 5분간 메모리 캐시로 재사용합니다.
 * - 입력 검증과 rate limit을 먼저 적용합니다.
 *
 * 클라이언트는 단순 fetch로 호출합니다.
 *   const r = await fetch("/api/ai/commentary", { method: "POST", body: JSON.stringify(input) });
 *   const { commentary } = await r.json();
 */

import { NextResponse } from "next/server";
import { getAIProviderCandidates, AIProviderError, type CommentaryInput } from "@/lib/ai";
import { generateFallbackCommentary } from "@/lib/ai/fallback";
import { isBodyTooLarge, rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { text: string; expiresAt: number }>();

function cacheKey(input: CommentaryInput): string {
  // 가격은 소수 둘째 자리까지만 반영해 캐시 폭증을 줄입니다.
  const r = (n: number) => Math.round(n * 100) / 100;
  return [
    input.symbol,
    input.timeframe,
    input.side,
    input.score,
    r(input.currentPrice),
    r(input.entryLow),
    r(input.entryHigh),
    input.proximity,
    input.context.killzone,
    input.context.quality,
    input.context.inOte ? "1" : "0",
    input.context.inOb ? "1" : "0",
    input.context.inFvg ? "1" : "0",
    input.context.pocPosition ?? "unknown"
  ].join("|");
}

function isValidInput(value: unknown): value is CommentaryInput {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const context = v.context as Record<string, unknown> | null;
  return (
    typeof v.symbol === "string" &&
    v.symbol.length <= 24 &&
    typeof v.timeframe === "string" &&
    typeof v.side === "string" &&
    typeof v.score === "number" &&
    typeof v.currentPrice === "number" &&
    typeof v.entryLow === "number" &&
    typeof v.entryHigh === "number" &&
    typeof v.invalidation === "number" &&
    typeof v.target1 === "number" &&
    typeof v.target2 === "number" &&
    typeof v.proximity === "string" &&
    typeof v.distancePercent === "number" &&
    typeof v.context === "object" &&
    v.context !== null &&
    Array.isArray(context?.riskFlags) &&
    context.riskFlags.length <= 8 &&
    Array.isArray(context?.opportunityFlags) &&
    context.opportunityFlags.length <= 8
  );
}

export async function POST(request: Request) {
  const limit = await rateLimit(request, { key: "ai-commentary", limit: 30, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "AI 코멘트 요청이 잠시 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  if (isBodyTooLarge(request, 40_000)) {
    return NextResponse.json({ error: "요청 본문이 너무 큽니다." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "유효한 JSON 본문이 필요합니다." }, { status: 400 });
  }

  if (!isValidInput(body)) {
    return NextResponse.json({ error: "필수 입력값이 부족합니다." }, { status: 400 });
  }

  const input = body as CommentaryInput;
  const key = cacheKey(input);
  const now = Date.now();

  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) {
    return NextResponse.json({ commentary: hit.text, model: "cache", cached: true });
  }

  let providers;
  try {
    providers = getAIProviderCandidates();
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI Provider 초기화 실패";
    console.warn("[ai/commentary] Provider 없음, 폴백 사용:", message);
    const fallback = generateFallbackCommentary(input);
    cache.set(key, { text: fallback, expiresAt: now + CACHE_TTL_MS });
    return NextResponse.json({ commentary: fallback, model: "fallback", cached: false });
  }

  for (const provider of providers) {
    try {
      const text = await provider.generateCommentary(input);
      cache.set(key, { text, expiresAt: now + CACHE_TTL_MS });
      return NextResponse.json({ commentary: text, model: provider.model, cached: false });
    } catch (error) {
      if (error instanceof AIProviderError) {
        console.warn(`[ai/commentary] ${error.provider} 실패, 다음 후보 확인:`, error.message);
      } else {
        console.warn("[ai/commentary] Provider 호출 실패, 다음 후보 확인:", error);
      }
    }
  }

  const fallback = generateFallbackCommentary(input);
  cache.set(key, { text: fallback, expiresAt: now + CACHE_TTL_MS });
  return NextResponse.json({ commentary: fallback, model: "fallback", cached: false });
}
