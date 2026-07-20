// 공개 API 호출량을 운영 환경과 개발 환경에서 함께 제한하는 유틸리티.
interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
  backend: "upstash" | "memory";
}

type UpstashNumberResponse = {
  result?: number;
  error?: string;
};

const buckets = new Map<string, RateLimitBucket>();

function clientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  return forwardedFor || realIp || cfIp || "local";
}

function memoryRateLimit(request: Request, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const key = `${options.key}:${clientIp(request)}`;
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
  const key = `rate:${options.key}:${clientIp(request)}`;
  const windowSeconds = Math.max(1, Math.ceil(options.windowMs / 1000));
  const countPayload = await upstashCommand<UpstashNumberResponse>("incr", key);
  const count = Number(countPayload.result ?? 0);

  if (count <= 1) {
    await upstashCommand<UpstashNumberResponse>("expire", key, windowSeconds);
  }

  if (count > options.limit) {
    const ttlPayload = await upstashCommand<UpstashNumberResponse>("ttl", key);
    return {
      allowed: false,
      retryAfter: Math.max(1, Number(ttlPayload.result ?? windowSeconds)),
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
      console.warn("[rateLimit] Upstash 제한 실패, 메모리 제한으로 대체합니다.", error);
    }
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
