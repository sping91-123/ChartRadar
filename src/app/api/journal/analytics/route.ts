import {
  listExchangeConnections,
  listExchangePositions,
  publicExchangeConnection,
  selectExchangeConnectionsForEntitlement
} from "@/lib/server/exchangeConnectionStore";
import { buildExchangeAnalytics } from "@/lib/server/exchangeAnalytics";
import { exchangeApiContext, privateExchangeJson } from "@/lib/server/exchangeApi";
import { isSupabaseAdminConfigured } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const context = await exchangeApiContext(request);
  if (!context.ok) return context.response;
  if (!isSupabaseAdminConfigured()) {
    return privateExchangeJson({ error: "자동 복기 저장소가 설정되지 않았습니다." }, { status: 503 });
  }
  const windowDays = context.capabilities.historyDays as 30 | 90;
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  try {
    const connections = await listExchangeConnections(context.entitlement.userId as string, true);
    const eligible = selectExchangeConnectionsForEntitlement(
      connections,
      context.capabilities.connectionLimit
    );
    const positions = await listExchangePositions(
      context.entitlement.userId as string,
      since,
      eligible.map((connection) => connection.id)
    );
    return privateExchangeJson({
      ...buildExchangeAnalytics(positions, windowDays, context.entitlement.isPaid),
      canCrossAnalyze: context.entitlement.isPaid,
      connections: eligible.map(publicExchangeConnection)
    });
  } catch {
    return privateExchangeJson({ error: "자동 복기 분석을 불러오지 못했습니다." }, { status: 503 });
  }
}
