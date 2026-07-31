import { listExchangeConnections } from "@/lib/server/exchangeConnectionStore";
import { exchangeApiContext, privateExchangeJson } from "@/lib/server/exchangeApi";
import {
  assertExchangeMutationConfiguration,
  ExchangeJournalConfigurationError
} from "@/lib/server/exchangeJournalConfig";
import { ExchangeConnectorError } from "@/lib/server/exchanges/types";
import { syncExchangeConnection } from "@/lib/server/exchangeSync";
import { isUuid } from "@/lib/perpetualMonitor";
import { entitlementRateKey } from "@/lib/server/requestEntitlement";
import { rateLimit } from "@/lib/server/rateLimit";
import { isSupabaseAdminConfigured } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = Promise<{ id: string }>;

export async function POST(request: Request, { params }: { params: RouteParams }) {
  const context = await exchangeApiContext(request);
  if (!context.ok) return context.response;
  if (!isSupabaseAdminConfigured()) {
    return privateExchangeJson({ error: "거래소 연결 저장소가 설정되지 않았습니다." }, { status: 503 });
  }
  const { id } = await params;
  if (!isUuid(id)) return privateExchangeJson({ error: "유효하지 않은 연결 ID입니다." }, { status: 400 });
  const limited = await rateLimit(request, {
    key: entitlementRateKey(`exchange-sync:${id}`, context.entitlement),
    limit: 4,
    windowMs: 15 * 60 * 1000
  });
  if (!limited.allowed) {
    return privateExchangeJson(
      { error: "동기화 요청이 많습니다. 잠시 후 다시 시도해 주세요.", code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }
  try {
    assertExchangeMutationConfiguration(context.entitlement.userId as string);
    const active = await listExchangeConnections(context.entitlement.userId as string);
    const allowed = active.slice(0, context.capabilities.connectionLimit);
    if (!allowed.some((connection) => connection.id === id)) {
      return privateExchangeJson(
        { error: "현재 플랜에서 동기화할 수 없는 연결입니다.", code: "connection_limit_reached" },
        { status: 403 }
      );
    }
    return privateExchangeJson({ sync: await syncExchangeConnection(context.entitlement.userId as string, id) });
  } catch (error) {
    if (error instanceof ExchangeJournalConfigurationError) {
      return privateExchangeJson({ error: "자동 동기화 운영 설정이 완료되지 않았습니다.", code: error.code }, { status: 409 });
    }
    if (error instanceof ExchangeConnectorError) {
      const status = error.code === "rate_limited" ? 429 : error.code === "provider_unavailable" ? 503 : 409;
      return privateExchangeJson(
        { error: "거래소 동기화를 완료하지 못했습니다.", code: error.code },
        { status }
      );
    }
    return privateExchangeJson({ error: "거래소 동기화를 완료하지 못했습니다." }, { status: 503 });
  }
}
