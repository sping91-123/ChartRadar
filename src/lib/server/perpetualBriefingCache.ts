interface SharedPerpetualBriefing {
  briefing: string;
  model: string;
}

const SHARED_CACHE_TIMEOUT_MS = 1_500;
const SHARED_CACHE_PREFIX = "perpetual-briefing:v1";
const SHARED_LEASE_PREFIX = "perpetual-briefing-lease:v1";
// Covers the full provider chain, cost-limit checks, and the final shared-cache write.
// It is self-expiring so a crashed worker cannot hold a snapshot forever.
const SHARED_LEASE_TTL_MS = 60_000;

export type SharedPerpetualBriefingLease =
  | { status: "acquired"; token: string }
  | { status: "busy" }
  | { status: "unavailable" };

function configuration() {
  const baseUrl = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return baseUrl && token ? { baseUrl, token } : null;
}

function validValue(value: unknown): value is SharedPerpetualBriefing {
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

async function request(command: Array<string | number>) {
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
    return await response.json() as { result?: unknown; error?: string };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function sharedKey(cacheKey: string) {
  return `${SHARED_CACHE_PREFIX}:${cacheKey}`;
}

function leaseKey(cacheKey: string) {
  return `${SHARED_LEASE_PREFIX}:${cacheKey}`;
}

export async function getSharedPerpetualBriefing(cacheKey: string): Promise<SharedPerpetualBriefing | null> {
  const payload = await request(["GET", sharedKey(cacheKey)]);
  if (!payload || typeof payload.result !== "string") return null;
  try {
    const parsed = JSON.parse(payload.result) as unknown;
    return validValue(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function setSharedPerpetualBriefing(
  cacheKey: string,
  value: SharedPerpetualBriefing,
  ttlSeconds: number
) {
  if (!validValue(value)) return false;
  const safeTtl = Math.max(60, Math.min(86_400, Math.round(ttlSeconds)));
  const payload = await request([
    "SET",
    sharedKey(cacheKey),
    JSON.stringify(value),
    "EX",
    safeTtl
  ]);
  return payload?.result === "OK";
}

export async function acquireSharedPerpetualBriefingLease(cacheKey: string): Promise<SharedPerpetualBriefingLease> {
  if (!configuration()) return { status: "unavailable" };
  const token = crypto.randomUUID();
  const payload = await request([
    "SET",
    leaseKey(cacheKey),
    token,
    "NX",
    "PX",
    SHARED_LEASE_TTL_MS
  ]);
  if (!payload) return { status: "unavailable" };
  return payload.result === "OK" ? { status: "acquired", token } : { status: "busy" };
}

export async function releaseSharedPerpetualBriefingLease(cacheKey: string, token: string) {
  const payload = await request([
    "EVAL",
    "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
    1,
    leaseKey(cacheKey),
    token
  ]);
  return payload?.result === 1;
}
