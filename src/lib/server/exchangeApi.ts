import { NextResponse } from "next/server";
import {
  exchangeJournalCapabilities,
  hasExchangeJournalPaidAccess,
  isExchangeJournalReadable
} from "@/lib/server/exchangeJournalConfig";
import { readExchangeOperationalControl } from "@/lib/server/exchangeOperationalControl";
import { getRequestEntitlement, type RequestEntitlement } from "@/lib/server/requestEntitlement";

export function privateExchangeJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Authorization");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export type ExchangeApiContext =
  | { ok: true; entitlement: RequestEntitlement; capabilities: ReturnType<typeof exchangeJournalCapabilities> }
  | { ok: false; response: NextResponse };

export async function exchangeApiContext(
  request: Request,
  options: {
    allowDeletionPending?: boolean;
    allowFeatureDisabledForCleanup?: boolean;
    allowUnpaidForCleanup?: boolean;
  } = {}
): Promise<ExchangeApiContext> {
  const entitlement = await getRequestEntitlement(request, "crypto");
  if (!entitlement.userId || !entitlement.isAuthenticated) {
    return {
      ok: false,
      response: privateExchangeJson(
        { error: "로그인이 필요합니다.", code: "authentication_required" },
        { status: 401 }
      )
    };
  }
  if (entitlement.state === "deletion_pending" && !options.allowDeletionPending) {
    return {
      ok: false,
      response: privateExchangeJson(
        { error: "계정 삭제 대기 중에는 거래소 연결을 변경하거나 동기화할 수 없습니다.", code: "deletion_pending" },
        { status: 409 }
      )
    };
  }
  if (entitlement.state === "unavailable" && !options.allowUnpaidForCleanup) {
    return {
      ok: false,
      response: privateExchangeJson(
        { error: "계정 권한을 확인하지 못했습니다.", code: "entitlement_unavailable" },
        { status: 503 }
      )
    };
  }
  if (!hasExchangeJournalPaidAccess(entitlement) && !options.allowUnpaidForCleanup) {
    return {
      ok: false,
      response: privateExchangeJson(
        {
          error: "거래소 API 복기는 Coin Pro 또는 코인 권한이 포함된 상위 플랜에서 이용할 수 있습니다.",
          code: "coin_pro_required"
        },
        { status: 403 }
      )
    };
  }
  if (!isExchangeJournalReadable() && !options.allowFeatureDisabledForCleanup) {
    return {
      ok: false,
      response: privateExchangeJson(
        { error: "거래소 자동 복기는 현재 비활성화되어 있습니다.", code: "exchange_feature_disabled" },
        { status: 404 }
      )
    };
  }
  const operationalControl = await readExchangeOperationalControl();
  return {
    ok: true,
    entitlement,
    capabilities: exchangeJournalCapabilities(
      hasExchangeJournalPaidAccess(entitlement),
      entitlement.userId,
      operationalControl.operationsEnabled
    )
  };
}
