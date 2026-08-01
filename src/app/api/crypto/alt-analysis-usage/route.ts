import { NextResponse } from "next/server";
import { getCoinCapabilityPolicy } from "@/lib/coinCapabilities";
import { isLikelyUsdtPerpSymbol } from "@/lib/cryptoUniverse";
import { entitlementRateKey, getRequestEntitlement } from "@/lib/server/requestEntitlement";
import { distinctRateLimit, isBodyTooLarge, kstDailyRateWindow, rateLimit, readJsonBodyLimited } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AltAnalysisUsageRequest {
  symbol?: string;
}

export async function POST(request: Request) {
  if (isBodyTooLarge(request, 2_000)) {
    return NextResponse.json({ error: "요청이 너무 큽니다." }, { status: 413 });
  }
  const parsed = await readJsonBodyLimited<AltAnalysisUsageRequest | null>(request, 2_000);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.tooLarge ? "요청이 너무 큽니다." : "요청 형식이 올바르지 않습니다." }, { status: parsed.tooLarge ? 413 : 400 });
  }
  const body = parsed.value;
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => key !== "symbol")) {
    return NextResponse.json({ error: "요청 필드가 올바르지 않습니다." }, { status: 400 });
  }
  const symbol = typeof body.symbol === "string" ? body.symbol.trim().toUpperCase() : "";
  if (!isLikelyUsdtPerpSymbol(symbol) || symbol === "BTCUSDT.P" || symbol === "ETHUSDT.P") {
    return NextResponse.json({ error: "지원하지 않는 알트코인 심볼입니다." }, { status: 400 });
  }

  const entitlement = await getRequestEntitlement(request, "crypto");
  if (entitlement.state === "unavailable") {
    return NextResponse.json({ error: "구독 권한을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }
  const capability = getCoinCapabilityPolicy(entitlement.plan);
  const abuse = await rateLimit(request, {
    key: entitlementRateKey("alt-analysis-claim", entitlement),
    limit: entitlement.isPaid ? 240 : 60,
    windowMs: 5 * 60 * 1000,
    includeClientIp: !entitlement.userId
  });
  if (!abuse.allowed) {
    return NextResponse.json({ error: "알트 분석 요청이 잠시 많습니다." }, { status: 429, headers: { "Retry-After": String(abuse.retryAfter) } });
  }

  if (capability.altAnalysisDailyLimit === null) {
    return NextResponse.json({
      allowed: true,
      newlyCounted: false,
      usage: { used: 0, limit: null, remaining: null, resetAt: null }
    });
  }

  const daily = kstDailyRateWindow();
  const quota = await distinctRateLimit(request, {
    key: entitlementRateKey(`coin:alt-analysis:${daily.dateKey}`, entitlement),
    subject: symbol,
    limit: capability.altAnalysisDailyLimit,
    windowMs: daily.windowMs,
    includeClientIp: !entitlement.userId,
    requireSharedBackend: process.env.NODE_ENV === "production"
  });
  const used = Math.min(quota.count, capability.altAnalysisDailyLimit);
  const usage = {
    used,
    limit: capability.altAnalysisDailyLimit,
    remaining: Math.max(0, capability.altAnalysisDailyLimit - used),
    resetAt: new Date(daily.resetAt).toISOString()
  };
  if (!quota.allowed) {
    const backendUnavailable = quota.backend === "unavailable";
    return NextResponse.json({
      allowed: false,
      error: backendUnavailable
        ? "알트 분석 사용량을 확인하지 못해 요청을 안전하게 중단했습니다. 잠시 후 다시 시도해 주세요."
        : "오늘 Basic 알트 개별 분석 3종목을 모두 확인했습니다. Pro에서는 상품상 일일 종목 제한 없이 추적할 수 있습니다.",
      code: backendUnavailable ? "usage_backend_unavailable" : "daily_quota_reached",
      usage
    }, { status: backendUnavailable ? 503 : 429, headers: { "Retry-After": String(quota.retryAfter) } });
  }
  return NextResponse.json({ allowed: true, newlyCounted: quota.newlyCounted, usage });
}
