// 공개 API 호출량을 운영 환경과 개발 환경에서 함께 제한하는 유틸리티.
interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
  includeClientIp?: boolean;
  requireSharedBackend?: boolean;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
  backend: "upstash" | "memory" | "unavailable";
  count: number;
  limit: number;
  resetAt: number;
}

interface DistinctRateLimitBucket {
  subjects: Set<string>;
  resetAt: number;
}

export interface DistinctRateLimitResult extends RateLimitResult {
  newlyCounted: boolean;
}

type UpstashWindowResponse = {
  result?: number[];
  error?: string;
};

const ATOMIC_WINDOW_SCRIPT = [
  "local count = redis.call('INCR', KEYS[1])",
  "local ttl = redis.call('PTTL', KEYS[1])",
  "if ttl < 0 then",
  "  redis.call('PEXPIRE', KEYS[1], ARGV[1])",
  "  ttl = tonumber(ARGV[1])",
  "end",
  "return {count, ttl}"
].join("\n");

const ATOMIC_DISTINCT_WINDOW_SCRIPT = [
  "local present = redis.call('SISMEMBER', KEYS[1], ARGV[1])",
  "local count = redis.call('SCARD', KEYS[1])",
  "local ttl = redis.call('PTTL', KEYS[1])",
  "if present == 1 then return {0, count, ttl} end",
  "if count >= tonumber(ARGV[2]) then return {-1, count, ttl} end",
  "redis.call('SADD', KEYS[1], ARGV[1])",
  "ttl = redis.call('PTTL', KEYS[1])",
  "if ttl < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[3]); ttl = tonumber(ARGV[3]) end",
  "return {1, count + 1, ttl}"
].join("\n");

const buckets = new Map<string, RateLimitBucket>();
const distinctBuckets = new Map<string, DistinctRateLimitBucket>();

function clientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  return forwardedFor || realIp || cfIp || "local";
}

function memoryRateLimit(request: Request, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const key = options.includeClientIp === false ? options.key : `${options.key}:${clientIp(request)}`;
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + options.windowMs
    });
    return { allowed: true, retryAfter: 0, backend: "memory", count: 1, limit: options.limit, resetAt: now + options.windowMs };
  }

  if (bucket.count >= options.limit) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      backend: "memory",
      count: bucket.count,
      limit: options.limit,
      resetAt: bucket.resetAt
    };
  }

  bucket.count += 1;
  return { allowed: true, retryAfter: 0, backend: "memory", count: bucket.count, limit: options.limit, resetAt: bucket.resetAt };
}

async function upstashCommand<T>(command: string, key: string, ...args: Array<string | number>): Promise<T> {
  const baseUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!baseUrl || !token) throw new Error("Upstash rate limit is not configured.");

  const path = [command, key, ...args.map(String)].map(encodeURIComponent).join("/");
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Upstash ${response.status}`);
  }

  const payload = (await response.json()) as T & { error?: string };
  if (payload.error) throw new Error(payload.error);
  return payload;
}

function sharedBackendConfigured() {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
    (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)
  );
}

async function upstashRateLimit(request: Request, options: RateLimitOptions): Promise<RateLimitResult> {
  const scopedKey = options.includeClientIp === false ? options.key : `${options.key}:${clientIp(request)}`;
  const key = `rate:${scopedKey}`;
  const windowMs = Math.max(1_000, Math.ceil(options.windowMs));
  const windowPayload = await upstashCommand<UpstashWindowResponse>(
    "eval",
    ATOMIC_WINDOW_SCRIPT,
    1,
    key,
    windowMs
  );
  const [rawCount, rawTtl] = Array.isArray(windowPayload.result) ? windowPayload.result : [0, windowMs];
  const count = Number(rawCount);
  const ttlMs = Number(rawTtl);
  if (!Number.isFinite(count) || count < 1 || !Number.isFinite(ttlMs) || ttlMs < 0) {
    throw new Error("Upstash rate limit returned an invalid atomic window.");
  }

  if (count > options.limit) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil(ttlMs / 1000)),
      backend: "upstash",
      count,
      limit: options.limit,
      resetAt: Date.now() + ttlMs
    };
  }

  return { allowed: true, retryAfter: 0, backend: "upstash", count, limit: options.limit, resetAt: Date.now() + ttlMs };
}

export async function rateLimit(request: Request, options: RateLimitOptions): Promise<RateLimitResult> {
  if (sharedBackendConfigured()) {
    try {
      return await upstashRateLimit(request, options);
    } catch (error) {
      if (options.requireSharedBackend) {
        console.warn("[rateLimit] 공유 비용 제한을 확인하지 못해 공급자 호출을 차단합니다.", error);
        return { allowed: false, retryAfter: 60, backend: "unavailable", count: 0, limit: options.limit, resetAt: Date.now() + 60_000 };
      }
      console.warn("[rateLimit] Upstash 제한 실패, 메모리 제한으로 대체합니다.", error);
    }
  }

  if (options.requireSharedBackend) {
    return { allowed: false, retryAfter: 60, backend: "unavailable", count: 0, limit: options.limit, resetAt: Date.now() + 60_000 };
  }

  return memoryRateLimit(request, options);
}

export async function distinctRateLimit(
  request: Request,
  options: RateLimitOptions & { subject: string }
): Promise<DistinctRateLimitResult> {
  const scopedKey = options.includeClientIp === false ? options.key : `${options.key}:${clientIp(request)}`;
  const now = Date.now();
  if (sharedBackendConfigured()) {
    try {
      const windowMs = Math.max(1_000, Math.ceil(options.windowMs));
      const payload = await upstashCommand<UpstashWindowResponse>(
        "eval",
        ATOMIC_DISTINCT_WINDOW_SCRIPT,
        1,
        `distinct:${scopedKey}`,
        options.subject,
        options.limit,
        windowMs
      );
      const [rawState, rawCount, rawTtl] = Array.isArray(payload.result) ? payload.result : [-1, 0, windowMs];
      const state = Number(rawState);
      const count = Number(rawCount);
      const ttlMs = Number(rawTtl);
      if (!Number.isFinite(state) || !Number.isFinite(count) || count < 0 || !Number.isFinite(ttlMs)) {
        throw new Error("Upstash distinct rate limit returned an invalid window.");
      }
      return {
        allowed: state >= 0,
        newlyCounted: state === 1,
        retryAfter: state >= 0 ? 0 : Math.max(1, Math.ceil(Math.max(1_000, ttlMs) / 1000)),
        backend: "upstash",
        count,
        limit: options.limit,
        resetAt: now + Math.max(1_000, ttlMs)
      };
    } catch (error) {
      if (options.requireSharedBackend) {
        console.warn("[rateLimit] shared distinct quota is unavailable", error);
        return {
          allowed: false,
          newlyCounted: false,
          retryAfter: 60,
          backend: "unavailable",
          count: 0,
          limit: options.limit,
          resetAt: now + 60_000
        };
      }
      console.warn("[rateLimit] Upstash distinct quota failed; using memory fallback", error);
    }
  } else if (options.requireSharedBackend) {
    return {
      allowed: false,
      newlyCounted: false,
      retryAfter: 60,
      backend: "unavailable",
      count: 0,
      limit: options.limit,
      resetAt: now + 60_000
    };
  }

  let bucket = distinctBuckets.get(scopedKey);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { subjects: new Set<string>(), resetAt: now + options.windowMs };
    distinctBuckets.set(scopedKey, bucket);
  }
  if (bucket.subjects.has(options.subject)) {
    return {
      allowed: true,
      newlyCounted: false,
      retryAfter: 0,
      backend: "memory",
      count: bucket.subjects.size,
      limit: options.limit,
      resetAt: bucket.resetAt
    };
  }
  if (bucket.subjects.size >= options.limit) {
    return {
      allowed: false,
      newlyCounted: false,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      backend: "memory",
      count: bucket.subjects.size,
      limit: options.limit,
      resetAt: bucket.resetAt
    };
  }
  bucket.subjects.add(options.subject);
  return {
    allowed: true,
    newlyCounted: true,
    retryAfter: 0,
    backend: "memory",
    count: bucket.subjects.size,
    limit: options.limit,
    resetAt: bucket.resetAt
  };
}

export function kstDailyRateWindow(now = Date.now()) {
  const shifted = new Date(now + 9 * 60 * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const date = shifted.getUTCDate();
  const resetAt = Date.UTC(year, month, date + 1) - 9 * 60 * 60 * 1000;
  return {
    dateKey: `${year}-${String(month + 1).padStart(2, "0")}-${String(date).padStart(2, "0")}`,
    resetAt,
    windowMs: Math.max(1_000, resetAt - now)
  };
}

export function isBodyTooLarge(request: Request, maxBytes: number) {
  const length = Number(request.headers.get("content-length") ?? 0);
  return Number.isFinite(length) && length > maxBytes;
}

export async function readJsonBodyLimited<T>(request: Request, maxBytes: number): Promise<
  | { ok: true; value: T }
  | { ok: false; tooLarge: boolean }
> {
  if (isBodyTooLarge(request, maxBytes)) return { ok: false, tooLarge: true };
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) return { ok: false, tooLarge: true };
  try {
    return { ok: true, value: JSON.parse(text) as T };
  } catch {
    return { ok: false, tooLarge: false };
  }
}
