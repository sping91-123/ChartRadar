import { createHash } from "node:crypto";
import type { MarketBriefingInput } from "./types";

export interface CachedMarketBriefing {
  briefing: string;
  model: string;
}

export type MarketBriefingCacheLookup =
  | { status: "hit"; value: CachedMarketBriefing }
  | { status: "miss" }
  | { status: "unavailable" };

const SHARED_CACHE_PREFIX = "market-briefing:v1";
const SHARED_CACHE_TIMEOUT_MS = 1_500;
const localCache = new Map<string, { value: CachedMarketBriefing; expiresAt: number }>();

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)])
  );
}

/** Every prompt-affecting input participates in the cache identity. */
export function marketBriefingCacheKey(input: MarketBriefingInput) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(input)))
    .digest("hex");
}

function configuration() {
  const baseUrl = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)?.trim().replace(/\/$/, "");
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)?.trim();
  return baseUrl && token ? { baseUrl, token } : null;
}

function validValue(value: unknown): value is CachedMarketBriefing {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.briefing === "string" &&
    record.briefing.length > 0 &&
    record.briefing.length <= 8_000 &&
    typeof record.model === "string" &&
    record.model.length > 0 &&
    record.model.length <= 120
  );
}

async function sharedRequest(command: Array<string | number>) {
  const configured = configuration();
  if (!configured) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SHARED_CACHE_TIMEOUT_MS);
  try {
    const response = await fetch(configured.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${configured.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(command),
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) return null;
    return await response.json() as { result?: unknown };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function sharedKey(cacheKey: string) {
  return `${SHARED_CACHE_PREFIX}:${cacheKey}`;
}

export async function getMarketBriefingCache(
  cacheKey: string,
  now = Date.now()
): Promise<MarketBriefingCacheLookup> {
  if (configuration()) {
    const payload = await sharedRequest(["GET", sharedKey(cacheKey)]);
    if (!payload) return { status: "unavailable" };
    if (payload.result === null || payload.result === undefined) return { status: "miss" };
    if (typeof payload.result !== "string") return { status: "unavailable" };
    try {
      const parsed = JSON.parse(payload.result) as unknown;
      return validValue(parsed) ? { status: "hit", value: parsed } : { status: "unavailable" };
    } catch {
      return { status: "unavailable" };
    }
  }

  if (process.env.NODE_ENV === "production") return { status: "unavailable" };
  const local = localCache.get(cacheKey);
  if (!local || local.expiresAt <= now) {
    localCache.delete(cacheKey);
    return { status: "miss" };
  }
  return { status: "hit", value: local.value };
}

export async function setMarketBriefingCache(
  cacheKey: string,
  value: CachedMarketBriefing,
  ttlSeconds: number,
  now = Date.now()
) {
  if (!validValue(value)) return false;
  const safeTtl = Math.max(60, Math.min(86_400, Math.round(ttlSeconds)));
  if (configuration()) {
    const payload = await sharedRequest(["SET", sharedKey(cacheKey), JSON.stringify(value), "EX", safeTtl]);
    return payload?.result === "OK";
  }
  if (process.env.NODE_ENV === "production") return false;
  localCache.set(cacheKey, { value, expiresAt: now + safeTtl * 1000 });
  return true;
}
