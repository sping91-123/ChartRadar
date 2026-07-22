import { NextResponse } from "next/server";
import { AIProviderError, getAIProviderCandidates } from "@/lib/ai";
import { type PerpetualDecisionSnapshot } from "@/lib/perpetualDecisionSnapshot";
import { buildPerpetualBriefingInput, fallbackPerpetualBriefing } from "@/lib/server/perpetualBriefing";
import {
  acquireSharedPerpetualBriefingLease,
  getSharedPerpetualBriefing,
  releaseSharedPerpetualBriefingLease,
  setSharedPerpetualBriefing
} from "@/lib/server/perpetualBriefingCache";
import { getPerpetualDecisionSnapshotById, isSnapshotId } from "@/lib/server/perpetualDecisionSource";
import { isPerpetualRevenueCoreUserEnabled } from "@/lib/server/perpetualRevenueCore";
import { rateLimit, readJsonBodyLimited } from "@/lib/server/rateLimit";
import { entitlementRateKey, getRequestEntitlement } from "@/lib/server/requestEntitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROMPT_VERSION = "perpetual-beginner-v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PROVIDER_TIMEOUT_MS = 18_000;
const CACHE_MAX_ENTRIES = 3_000;
const DAILY_PROVIDER_GENERATION_LIMIT = 24;
const DEFAULT_GLOBAL_DAILY_PROVIDER_GENERATION_LIMIT = 240;
const cache = new Map<string, { briefing: string; model: string; expiresAt: number }>();

function globalDailyProviderGenerationLimit() {
  const configured = Number(process.env.PERPETUAL_AI_DAILY_PROVIDER_LIMIT);
  return Number.isInteger(configured) && configured >= 1 && configured <= 5_000
    ? configured
    : DEFAULT_GLOBAL_DAILY_PROVIDER_GENERATION_LIMIT;
}

function privateJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Authorization");
  return response;
}

function clean(text: string) {
  return text.replace(/[\u3040-\u30ff]+/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("AI explanation timed out.")), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function pruneCache(now: number) {
  cache.forEach((value, key) => {
    if (value.expiresAt <= now) cache.delete(key);
  });
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
}

export async function POST(request: Request) {
  const entitlement = await getRequestEntitlement(request, "crypto");
  if (!entitlement.userId || !entitlement.isAuthenticated) return privateJson({ error: "로그인이 필요합니다.", code: "authentication_required" }, { status: 401 });
  if (entitlement.state === "deletion_pending") return privateJson({ error: "계정 삭제 대기 중에는 AI 설명을 만들 수 없습니다." }, { status: 409 });
  if (entitlement.state === "unavailable") return privateJson({ error: "구독 권한을 확인하지 못했습니다." }, { status: 503 });
  if (!entitlement.isPaid) return privateJson({ error: "AI 쉬운 설명은 Coin Pro에서 사용할 수 있습니다.", code: "pro_required" }, { status: 403 });
  if (!isPerpetualRevenueCoreUserEnabled(entitlement.userId)) {
    return privateJson({ error: "선물 AI 설명은 아직 활성화되지 않았습니다.", code: "revenue_core_not_active" }, { status: 409 });
  }
  const limit = await rateLimit(request, { key: entitlementRateKey("perpetual-briefing", entitlement), limit: 20, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) return privateJson({ error: "AI 설명 요청이 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });

  const parsed = await readJsonBodyLimited<{ snapshotId?: unknown } | null>(request, 2_000);
  if (!parsed.ok && parsed.tooLarge) return privateJson({ error: "요청 본문이 너무 큽니다." }, { status: 413 });
  const body = parsed.ok ? parsed.value : null;
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => key !== "snapshotId") ||
    typeof body.snapshotId !== "string" ||
    !isSnapshotId(body.snapshotId)
  ) {
    return privateJson({ error: "유효한 분석 ID가 필요합니다." }, { status: 400 });
  }
  const snapshot = await getPerpetualDecisionSnapshotById(body.snapshotId);
  if (!snapshot) return privateJson({ error: "요청한 분석을 찾지 못했습니다." }, { status: 404 });
  if (snapshot.pro?.detailVersion !== 1) {
    return privateJson({ error: "이전 분석에는 AI 설명에 필요한 상세 근거가 저장되지 않았습니다.", code: "snapshot_detail_unavailable" }, { status: 409 });
  }

  const cacheKey = `${PROMPT_VERSION}:${snapshot.id}`;
  const now = Date.now();
  pruneCache(now);
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > now) {
    return privateJson({ snapshotId: snapshot.id, generatedAt: snapshot.generatedAt, briefing: hit.briefing, model: hit.model, cached: true });
  }

  const sharedHit = await getSharedPerpetualBriefing(cacheKey);
  if (sharedHit) {
    cache.set(cacheKey, { ...sharedHit, expiresAt: now + CACHE_TTL_MS });
    pruneCache(now);
    return privateJson({
      snapshotId: snapshot.id,
      generatedAt: snapshot.generatedAt,
      briefing: sharedHit.briefing,
      model: sharedHit.model,
      cached: true
    });
  }

  const lease = await acquireSharedPerpetualBriefingLease(cacheKey);
  if (lease.status !== "acquired") {
    if (lease.status === "busy") {
      await new Promise((resolve) => setTimeout(resolve, 350));
      const completedByFirstRequest = await getSharedPerpetualBriefing(cacheKey);
      if (completedByFirstRequest) {
        cache.set(cacheKey, { ...completedByFirstRequest, expiresAt: Date.now() + CACHE_TTL_MS });
        pruneCache(Date.now());
        return privateJson({
          snapshotId: snapshot.id,
          generatedAt: snapshot.generatedAt,
          briefing: completedByFirstRequest.briefing,
          model: completedByFirstRequest.model,
          cached: true
        });
      }
      return deterministicResponse(snapshot, "deterministic_generation_in_progress");
    }
    return deterministicResponse(snapshot, "deterministic_cost_guard");
  }

  let releaseLease = true;
  try {
    // A previous request can populate the cache between our first GET and lease acquisition.
    const lockedHit = await getSharedPerpetualBriefing(cacheKey);
    if (lockedHit) {
      cache.set(cacheKey, { ...lockedHit, expiresAt: Date.now() + CACHE_TTL_MS });
      pruneCache(Date.now());
      return privateJson({
        snapshotId: snapshot.id,
        generatedAt: snapshot.generatedAt,
        briefing: lockedHit.briefing,
        model: lockedHit.model,
        cached: true
      });
    }

    const dailyGenerationLimit = await rateLimit(request, {
      key: entitlementRateKey("perpetual-briefing-provider-daily", entitlement),
      limit: DAILY_PROVIDER_GENERATION_LIMIT,
      windowMs: 24 * 60 * 60 * 1000,
      includeClientIp: false,
      requireSharedBackend: true
    });
    const globalGenerationLimit = dailyGenerationLimit.allowed
      ? await rateLimit(request, {
          key: "perpetual-briefing-provider-global-daily:v1",
          limit: globalDailyProviderGenerationLimit(),
          windowMs: 24 * 60 * 60 * 1000,
          includeClientIp: false,
          requireSharedBackend: true
        })
      : dailyGenerationLimit;
    if (!dailyGenerationLimit.allowed || !globalGenerationLimit.allowed) {
      return deterministicResponse(
        snapshot,
        dailyGenerationLimit.backend === "unavailable" || globalGenerationLimit.backend === "unavailable"
          ? "deterministic_cost_guard"
          : "deterministic_daily_limit"
      );
    }

    let briefing = fallbackPerpetualBriefing(snapshot);
    let model = "fallback";
    try {
      const input = buildPerpetualBriefingInput(snapshot);
      const providerDeadline = Date.now() + PROVIDER_TIMEOUT_MS;
      for (const provider of getAIProviderCandidates()) {
        const remainingMs = providerDeadline - Date.now();
        if (remainingMs <= 0) break;
        try {
          briefing = clean(await withTimeout(provider.generateMarketBriefing(input), remainingMs));
          model = provider.model;
          break;
        } catch (error) {
          if (error instanceof AIProviderError) console.warn(`[perpetual-briefing] ${error.provider} failed`, error.message);
          else console.warn("[perpetual-briefing] provider failed", error);
        }
      }
    } catch (error) {
      console.warn("[perpetual-briefing] fallback used", error instanceof Error ? error.message : error);
    }
    briefing = clean(briefing);
    const providerGenerated = model !== "fallback";
    if (providerGenerated) {
      const cachedAt = Date.now();
      cache.set(cacheKey, { briefing, model, expiresAt: cachedAt + CACHE_TTL_MS });
      pruneCache(cachedAt);
      const sharedStored = await setSharedPerpetualBriefing(cacheKey, { briefing, model }, CACHE_TTL_MS / 1000);
      // If the cache write failed, keep the short lease until its TTL expires so
      // another instance cannot immediately pay for the same explanation again.
      releaseLease = sharedStored;
    }
    return privateJson({
      snapshotId: snapshot.id,
      generatedAt: snapshot.generatedAt,
      briefing,
      model,
      cached: false,
      ...(!providerGenerated ? { providerSkipped: true } : {})
    });
  } finally {
    if (releaseLease) await releaseSharedPerpetualBriefingLease(cacheKey, lease.token);
  }
}

function deterministicResponse(
  snapshot: PerpetualDecisionSnapshot,
  model: "deterministic_cost_guard" | "deterministic_daily_limit" | "deterministic_generation_in_progress"
) {
  return privateJson({
    snapshotId: snapshot.id,
    generatedAt: snapshot.generatedAt,
    briefing: clean(fallbackPerpetualBriefing(snapshot)),
    model,
    cached: false,
    providerSkipped: true
  });
}
