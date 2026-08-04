import { NextResponse } from "next/server";
import { getCoinCapabilityPolicy } from "@/lib/coinCapabilities";
import type { CryptoExchangeId } from "@/lib/server/cryptoExchangeData";
import { getCryptoHomeSnapshot, normalizeCryptoExchangeId } from "@/lib/server/cryptoExchangeData";
import { serializeHomeInterestAnalysis } from "@/lib/server/homeInterestAnalysis";
import { rateLimit } from "@/lib/server/rateLimit";
import { entitlementRateKey, getRequestEntitlement } from "@/lib/server/requestEntitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

function privateJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Authorization");
  return response;
}

function validSymbol(value: string | null) {
  if (!value || value.length > 80) return null;
  return /^[A-Za-z0-9:/.\-_]+$/.test(value) ? value : null;
}

export async function GET(request: Request) {
  const entitlement = await getRequestEntitlement(request, "crypto");
  const limited = await rateLimit(request, {
    key: entitlementRateKey("crypto-home-interest-summary", entitlement),
    limit: entitlement.isPaid ? 120 : 45,
    windowMs: 5 * 60 * 1000
  });
  if (!limited.allowed) {
    return privateJson({ error: "관심코인 분석 요청이 많습니다. 잠시 후 다시 시도해 주세요." }, {
      status: 429,
      headers: { "Retry-After": String(limited.retryAfter) }
    });
  }

  const url = new URL(request.url);
  const exchangeId = normalizeCryptoExchangeId(url.searchParams.get("exchange"));
  const symbol = validSymbol(url.searchParams.get("symbol"));
  if (!exchangeId || !symbol) {
    return privateJson({ error: "지원하는 거래소와 USDT 선물 종목을 선택해 주세요." }, { status: 400 });
  }

  const failClosed = entitlement.state === "unavailable" || entitlement.state === "deletion_pending";
  const policy = getCoinCapabilityPolicy(entitlement.plan);
  const canSeeProDetail = entitlement.isPaid && !failClosed && policy.preciseHigherTimeframeEvidence;

  try {
    const source = await getCryptoHomeSnapshot(exchangeId as CryptoExchangeId, symbol, {
      requireEstablishedStructure: true
    });
    const snapshot = serializeHomeInterestAnalysis(source, canSeeProDetail);
    return privateJson({
      snapshot,
      capabilities: {
        access: snapshot.access,
        maxCoins: policy.homeInterestLimit,
        canSeeProDetail
      }
    });
  } catch (error) {
    console.error("[api/crypto/home-interest-summary] error:", error);
    return privateJson({ error: "선택한 관심코인 분석을 만들지 못했습니다." }, { status: 503 });
  }
}
