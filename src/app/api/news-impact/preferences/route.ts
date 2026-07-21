import { NextResponse } from "next/server";
import { newsImpactCapabilities, normalizeNewsMarket } from "@/lib/server/news/newsImpactApi";
import { isNewsImpactUiEnabled, newsImpactMode } from "@/lib/server/newsImpactMode";
import { getRequestEntitlement } from "@/lib/server/requestEntitlement";
import { isSupabaseAdminConfigured, supabaseAdminRest, supabaseAdminRpc } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function privateJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Authorization");
  return response;
}

async function access(request: Request, market: "crypto" | "global") {
  const entitlement = await getRequestEntitlement(request, market === "crypto" ? "crypto" : "stocks");
  return { entitlement, capabilities: newsImpactCapabilities(entitlement) };
}

export async function GET(request: Request) {
  const market = normalizeNewsMarket(new URL(request.url).searchParams.get("market"));
  if (!market) return privateJson({ error: "market은 crypto 또는 global이어야 합니다." }, { status: 400 });
  const { entitlement, capabilities } = await access(request, market);
  if (!entitlement.userId) return privateJson({ error: "로그인이 필요합니다.", enabled: false, capabilities }, { status: 401 });
  if (!isNewsImpactUiEnabled(newsImpactMode())) return privateJson({ error: "뉴스 임팩트가 아직 공개되지 않았습니다." }, { status: 409 });
  if (!isSupabaseAdminConfigured()) return privateJson({ error: "알림 설정 저장소가 준비되지 않았습니다." }, { status: 503 });
  const rows = await supabaseAdminRest<Array<{ enabled: boolean }>>(
    `news_alert_preferences?select=enabled&user_id=eq.${entitlement.userId}&market=eq.${market}&limit=1`
  ).catch(() => []);
  return privateJson({ enabled: Boolean(rows[0]?.enabled), capabilities });
}

export async function PATCH(request: Request) {
  if (!isNewsImpactUiEnabled(newsImpactMode())) return privateJson({ error: "뉴스 임팩트가 아직 공개되지 않았습니다." }, { status: 409 });
  let body: { market?: unknown; enabled?: unknown };
  try { body = await request.json(); } catch { return privateJson({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 }); }
  const market = normalizeNewsMarket(typeof body.market === "string" ? body.market : null);
  if (!market || typeof body.enabled !== "boolean") return privateJson({ error: "market과 enabled가 필요합니다." }, { status: 400 });
  const { entitlement, capabilities } = await access(request, market);
  const disabling = body.enabled === false;
  if (!entitlement.userId) return privateJson({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!disabling && !capabilities.canEnableImpactAlerts) return privateJson({ error: "뉴스 임팩트 알림은 해당 시장 Pro에서 사용할 수 있습니다.", upgradePath: "/pro" }, { status: 403 });
  if (!isSupabaseAdminConfigured()) return privateJson({ error: "알림 설정 저장소가 준비되지 않았습니다." }, { status: 503 });
  const rows = await supabaseAdminRpc<Array<{ enabled: boolean }>>("set_news_alert_preference", {
    p_user_id: entitlement.userId,
    p_market: market,
    p_enabled: body.enabled
  });
  return privateJson({
    enabled: Boolean(rows[0]?.enabled),
    capabilities
  });
}
