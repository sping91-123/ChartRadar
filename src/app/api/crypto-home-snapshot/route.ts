import { NextResponse } from "next/server";
import { getCoinCapabilityPolicy } from "@/lib/coinCapabilities";
import { CryptoExchangeMarketNotFoundError, getCryptoHomeSnapshot, normalizeCryptoExchangeId } from "@/lib/server/cryptoExchangeData";
import { serializeLegacyHomeSnapshot } from "@/lib/server/homeInterestAnalysis";
import { rateLimit } from "@/lib/server/rateLimit";
import { entitlementRateKey, getRequestEntitlement } from "@/lib/server/requestEntitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function privateJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Authorization");
  return response;
}

export async function GET(request: Request) {
  const entitlement = await getRequestEntitlement(request, "crypto");
  const limited = await rateLimit(request, {
    key: entitlementRateKey("crypto-home-snapshot", entitlement),
    limit: 120,
    windowMs: 5 * 60 * 1000
  });
  if (!limited.allowed) {
    return privateJson({ error: "홈 분석 요청이 많습니다. 잠시 후 다시 시도해 주세요." }, {
      status: 429, headers: { "Retry-After": String(limited.retryAfter) }
    });
  }

  const url = new URL(request.url);
  const exchangeId = normalizeCryptoExchangeId(url.searchParams.get("exchange")) ?? "binance";
  const symbol = url.searchParams.get("symbol") ?? "BTC/USDT:USDT";
  const failClosed = entitlement.state === "unavailable" || entitlement.state === "deletion_pending";
  const canSeeProDetail = entitlement.isPaid && !failClosed && getCoinCapabilityPolicy(entitlement.plan).preciseHigherTimeframeEvidence;

  try {
    const source = await getCryptoHomeSnapshot(exchangeId, symbol, {
      requireEstablishedStructure: !canSeeProDetail,
      includeChartTimeframes: !canSeeProDetail
    });
    return privateJson({
      snapshot: serializeLegacyHomeSnapshot(source, canSeeProDetail),
      capabilities: { canSeeProDetail }
    });
  } catch (error) {
    if (error instanceof CryptoExchangeMarketNotFoundError) {
      return privateJson({ error: "선택한 USDT 선물 종목을 찾지 못했습니다." }, { status: 404 });
    }
    console.error("[api/crypto-home-snapshot] error:", error);
    return privateJson({ error: "관심코인 홈 분석을 불러오지 못했습니다." }, { status: 500 });
  }
}
