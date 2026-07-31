import { disconnectExchangeConnection, getExchangeConnection } from "@/lib/server/exchangeConnectionStore";
import { exchangeApiContext, privateExchangeJson } from "@/lib/server/exchangeApi";
import { isUuid } from "@/lib/perpetualMonitor";
import { rateLimit } from "@/lib/server/rateLimit";
import { entitlementRateKey } from "@/lib/server/requestEntitlement";
import { isSupabaseAdminConfigured } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = Promise<{ id: string }>;

export async function DELETE(request: Request, { params }: { params: RouteParams }) {
  const context = await exchangeApiContext(request, {
    allowDeletionPending: true,
    allowFeatureDisabledForCleanup: true,
    allowUnpaidForCleanup: true
  });
  if (!context.ok) return context.response;
  if (!isSupabaseAdminConfigured()) {
    return privateExchangeJson({ error: "거래소 연결 저장소가 설정되지 않았습니다." }, { status: 503 });
  }
  const { id } = await params;
  if (!isUuid(id)) return privateExchangeJson({ error: "유효하지 않은 연결 ID입니다." }, { status: 400 });
  const limited = await rateLimit(request, {
    key: entitlementRateKey("exchange-connection-delete", context.entitlement),
    limit: 10,
    windowMs: 10 * 60 * 1000
  });
  if (!limited.allowed) return privateExchangeJson({ error: "연결 해제 요청이 많습니다." }, { status: 429 });
  const connection = await getExchangeConnection(context.entitlement.userId as string, id).catch(() => null);
  if (!connection) return privateExchangeJson({ error: "연결을 찾지 못했습니다." }, { status: 404 });
  const deleteHistory = new URL(request.url).searchParams.get("deleteHistory") === "true";
  const disconnected = await disconnectExchangeConnection(
    context.entitlement.userId as string,
    id,
    deleteHistory
  ).catch(() => false);
  if (!disconnected) return privateExchangeJson({ error: "연결을 해제하지 못했습니다." }, { status: 503 });
  return privateExchangeJson({ disconnected: true, historyDeleted: deleteHistory });
}
