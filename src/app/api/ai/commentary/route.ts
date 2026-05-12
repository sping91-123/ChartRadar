/**
 * POST /api/ai/commentary
 *
 * Setup Scout 移대뱶 1?μ뿉 ???AI ??以?肄붾찘???앹꽦.
 * - ?ㅻ뒗 ?덈? ?대씪?댁뼵?몃줈 ?몄텧?섏? ?딆쓬 (?쒕쾭?먯꽌留??ъ슜).
 * - ?숈씪 ?낅젰 5遺꾧컙 硫붾え由?罹먯떆 (rate limit 蹂댄샇 + ?묐떟 ?띾룄).
 * - ?낅젰 寃利???GeminiProvider???꾩엫.
 *
 * ?대씪?댁뼵?몃뒗 ?⑥닚 fetch:
 *   const r = await fetch("/api/ai/commentary", { method: "POST", body: JSON.stringify(input) });
 *   const { commentary } = await r.json();
 */

import { NextResponse } from "next/server";
import { getAIProvider, AIProviderError, type CommentaryInput } from "@/lib/ai";
import { generateFallbackCommentary } from "@/lib/ai/fallback";
import { isBodyTooLarge, rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { text: string; expiresAt: number }>();

function cacheKey(input: CommentaryInput): string {
  // 媛寃⑹? ?뚯닔???섏㎏?먮━源뚯?留?諛섏쁺 (?붾??숈쑝濡?罹먯떆 ????컻 諛⑹?)
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
      { error: "AI 肄붾찘???붿껌???덈Т 留롮뒿?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄?섏꽭??" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  if (isBodyTooLarge(request, 40_000)) {
    return NextResponse.json({ error: "?붿껌 蹂몃Ц???덈Т ?쎈땲??" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "?좏슚??JSON 蹂몃Ц???꾩슂?⑸땲??" }, { status: 400 });
  }

  if (!isValidInput(body)) {
    return NextResponse.json({ error: "?꾩닔 ?꾨뱶媛 ?꾨씫?섏뿀?듬땲??" }, { status: 400 });
  }

  const input = body as CommentaryInput;
  const key = cacheKey(input);
  const now = Date.now();

  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) {
    return NextResponse.json({ commentary: hit.text, model: "cache", cached: true });
  }

  let provider;
  try {
    provider = getAIProvider();
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI Provider 珥덇린???ㅽ뙣";
    console.warn("[ai/commentary] Provider ?놁쓬, ?대갚 ?ъ슜:", message);
    const fallback = generateFallbackCommentary(input);
    cache.set(key, { text: fallback, expiresAt: now + CACHE_TTL_MS });
    return NextResponse.json({ commentary: fallback, model: "fallback", cached: false });
  }

  try {
    const text = await provider.generateCommentary(input);
    cache.set(key, { text, expiresAt: now + CACHE_TTL_MS });
    return NextResponse.json({ commentary: text, model: provider.model, cached: false });
  } catch (error) {
    if (error instanceof AIProviderError) {
      console.warn(`[ai/commentary] ${error.provider} ?ㅽ뙣, ?대갚 ?ъ슜:`, error.message);
      const fallback = generateFallbackCommentary(input);
      return NextResponse.json({ commentary: fallback, model: "fallback", cached: false });
    }
    console.error("[ai/commentary] ?????녿뒗 ?ㅻ쪟:", error);
    // ?????녿뒗 ?ㅻ쪟???대갚?쇰줈 泥섎━
    const fallback = generateFallbackCommentary(input);
    return NextResponse.json({ commentary: fallback, model: "fallback", cached: false });
  }
}
