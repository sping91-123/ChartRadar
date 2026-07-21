import { NextResponse } from "next/server";
import { fetchSupabaseUserOnServer, isSupabaseAdminConfigured, supabaseAdminRest, supabaseAdminRpc } from "@/lib/server/supabaseAdmin";
import { rateLimit } from "@/lib/server/rateLimit";
import { isUuid } from "@/lib/perpetualMonitor";
import { newsImpactRuntimePolicy } from "@/lib/server/newsImpactMode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PushAlertEventRow {
  id: string;
  market: "crypto" | "stocks";
  rule_id: string;
  event_key: string;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  sent_at: string;
  created_at: string;
  notification_kind: string | null;
  delivery_status: string | null;
  read_at: string | null;
}

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function normalizeMarket(raw: string | null) {
  if (raw === "stocks" || raw === "global") return "stocks";
  return "crypto";
}

function normalizeLimit(raw: string | null) {
  const parsed = Number(raw ?? 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(10, Math.min(100, Math.round(parsed)));
}

export async function GET(request: Request) {
  const limited = await rateLimit(request, { key: "push-alert-events", limit: 90, windowMs: 5 * 60 * 1000 });
  if (!limited.allowed) {
    return NextResponse.json({ error: "알림 기록 요청이 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "알림 기록 저장소가 설정되어 있지 않습니다." }, { status: 503 });
  }

  const accessToken = bearerToken(request);
  if (!accessToken) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  try {
    const user = await fetchSupabaseUserOnServer(accessToken);
    const url = new URL(request.url);
    const market = normalizeMarket(url.searchParams.get("market"));
    const limit = normalizeLimit(url.searchParams.get("limit"));
    const rows = await supabaseAdminRest<PushAlertEventRow[]>(
      `push_alert_events?select=id,market,rule_id,event_key,title,body,payload,sent_at,created_at,notification_kind,delivery_status,read_at&user_id=eq.${encodeURIComponent(
        user.id
      )}&market=eq.${market}&order=sent_at.desc&limit=${limit}`
    );

    const events = newsImpactRuntimePolicy().expose
      ? rows
      : rows.filter((row) => row.notification_kind !== "news_impact" && row.rule_id !== "news-impact");
    return NextResponse.json({ events, market });
  } catch (error) {
    console.error("[api/push-alert-events] error:", error);
    return NextResponse.json({ error: "알림 기록을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isSupabaseAdminConfigured()) return NextResponse.json({ error: "알림 기록 저장소가 설정되어 있지 않습니다." }, { status: 503 });
  const accessToken = bearerToken(request);
  if (!accessToken) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  let body: { id?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 }); }
  if (!isUuid(body.id)) return NextResponse.json({ error: "알림 ID를 확인해 주세요." }, { status: 400 });
  try {
    const user = await fetchSupabaseUserOnServer(accessToken);
    const marked = await supabaseAdminRpc<boolean>("mark_push_alert_read", { p_user_id: user.id, p_event_id: body.id });
    return NextResponse.json({ marked }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    console.error("[api/push-alert-events] mark read error:", error);
    return NextResponse.json({ error: "알림 읽음 상태를 저장하지 못했습니다." }, { status: 503 });
  }
}
