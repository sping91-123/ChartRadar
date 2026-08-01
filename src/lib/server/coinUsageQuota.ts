import type { RequestEntitlement } from "@/lib/server/requestEntitlement";
import { entitlementRateKey } from "@/lib/server/requestEntitlement";
import { kstDailyRateWindow, rateLimit } from "@/lib/server/rateLimit";

export interface CoinUsageSnapshot {
  used: number;
  limit: number;
  remaining: number;
  resetAt: string;
}

export async function claimCoinDailyUsage(params: {
  request: Request;
  entitlement: RequestEntitlement;
  bucket: "radar" | "watchlist";
  limit: number;
  now?: number;
}) {
  const daily = kstDailyRateWindow(params.now);
  const result = await rateLimit(params.request, {
    key: entitlementRateKey(`coin:${params.bucket}:${daily.dateKey}`, params.entitlement),
    limit: params.limit,
    windowMs: daily.windowMs,
    includeClientIp: !params.entitlement.userId,
    requireSharedBackend: process.env.NODE_ENV === "production"
  });
  const used = Math.min(result.count, params.limit);
  return {
    allowed: result.allowed,
    backend: result.backend,
    retryAfter: result.retryAfter,
    usage: {
      used,
      limit: params.limit,
      remaining: Math.max(0, params.limit - used),
      resetAt: new Date(daily.resetAt).toISOString()
    } satisfies CoinUsageSnapshot
  };
}
