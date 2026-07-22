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

interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
  backend: "upstash" | "memory" | "unavailable";
}

type UpstashWindowResponse = {
  result?: [number, number];
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

const buckets = new Map<string, RateLimitBucket>();

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
    return { allowed: true, retryAfter: 0, backend: "memory" };
  }

  if (bucket.count >= options.limit) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      backend: "memory"
    };
  }

  bucket.count += 1;
  return { allowed: true, retryAfter: 0, backend: "memory" };
}

async function upstashCommand<T>(command: string, key: string, ...args: Array<string | number>): Promise<T> {
  const baseUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
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
      backend: "upstash"
    };
  }

  return { allowed: true, retryAfter: 0, backend: "upstash" };
}

export async function rateLimit(request: Request, options: RateLimitOptions): Promise<RateLimitResult> {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      return await upstashRateLimit(request, options);
    } catch (error) {
      if (options.requireSharedBackend) {
        console.warn("[rateLimit] 공유 비용 제한을 확인하지 못해 공급자 호출을 차단합니다.", error);
        return { allowed: false, retryAfter: 60, backend: "unavailable" };
      }
      console.warn("[rateLimit] Upstash 제한 실패, 메모리 제한으로 대체합니다.", error);
    }
  }

  if (options.requireSharedBackend) {
    return { allowed: false, retryAfter: 60, backend: "unavailable" };
  }

  return memoryRateLimit(request, options);
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
