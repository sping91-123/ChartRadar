import { NextResponse } from "next/server";
import { isUuid } from "@/lib/perpetualMonitor";
import { readDecisionReviewInput, toWorkspaceJournal, type WorkspaceJournalRow } from "@/lib/decisionWorkspace";
import { listUserPerpetualMonitors, listRecentTerminalPerpetualMonitors } from "@/lib/server/perpetualMonitorStore";
import { getRequestEntitlement, entitlementRateKey } from "@/lib/server/requestEntitlement";
import { isPerpetualRevenueCoreUserEnabled } from "@/lib/server/perpetualRevenueCore";
import { isSupabaseAdminConfigured, supabaseAdminRest } from "@/lib/server/supabaseAdmin";
import { rateLimit, readJsonBodyLimited } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const select = "id,created_at,decision_snapshot_id,decision_context";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Authorization" } });
async function authorize(request: Request) {
  const e = await getRequestEntitlement(request, "crypto");
  if (!e.isAuthenticated || !e.userId) return { denied: json({ error: "로그인하면 내 조건과 판단 기록을 이어볼 수 있습니다." }, 401) };
  if (e.state === "deletion_pending") return { denied: json({ error: "계정 삭제 대기 중에는 기록을 사용할 수 없습니다." }, 409) };
  if (e.state === "unavailable" || !isSupabaseAdminConfigured()) return { denied: json({ error: "계정 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 503) };
  if (!isPerpetualRevenueCoreUserEnabled(e.userId)) return { denied: json({ error: "조건 추적을 아직 사용할 수 없습니다." }, 409) };
  const limited = await rateLimit(request, { key: entitlementRateKey("decision-workspace", e), limit: 60, windowMs: 5 * 60000 });
  if (!limited.allowed) return { denied: json({ error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." }, 429) };
  return { userId: e.userId };
}
export async function GET(request: Request) {
  const auth = await authorize(request);
  if (auth.denied) return auth.denied;
  const focus = new URL(request.url).searchParams.get("journal");
  if (focus !== null && !isUuid(focus)) return json({ error: "판단 기록 주소를 확인해 주세요." }, 400);
  const owned = `journals?select=${select}&user_id=eq.${encodeURIComponent(auth.userId!)}&market=eq.crypto&source=in.(snapshot,alert,news)&decision_context=not.is.null`;
  try {
    // This view never expires, reconciles, or creates monitors on a GET.
    const [monitors, history, rows, focused] = await Promise.all([
      listUserPerpetualMonitors(auth.userId!), listRecentTerminalPerpetualMonitors(auth.userId!, 20),
      supabaseAdminRest<WorkspaceJournalRow[]>(`${owned}&order=created_at.desc&limit=20`, { timeoutMs: 6000 }),
      focus ? supabaseAdminRest<WorkspaceJournalRow[]>(`${owned}&id=eq.${encodeURIComponent(focus)}&limit=1`, { timeoutMs: 6000 }) : Promise.resolve([])
    ]);
    const journals = rows.map(toWorkspaceJournal).filter((j): j is NonNullable<typeof j> => j !== null);
    return json({ monitors, history, journals, focusedJournal: focused[0] ? toWorkspaceJournal(focused[0]) : null,
      unavailableJournalCount: rows.length - journals.length, checkedAt: new Date().toISOString() });
  } catch {
    console.error("[decision-workspace] read failed");
    return json({ error: "내 조건과 판단 기록을 불러오지 못했습니다. 다시 시도해 주세요." }, 503);
  }
}
export async function PATCH(request: Request) {
  const auth = await authorize(request);
  if (auth.denied) return auth.denied;
  const parsed = await readJsonBodyLimited<Record<string, unknown>>(request, 3072);
  const body = parsed.ok ? parsed.value : null;
  const review = readDecisionReviewInput(body);
  if (!body || !review || !isUuid(body.id) || Object.keys(body).some(k => !["id", "conclusion", "nextCheck"].includes(k))) return json({ error: "결론을 선택하고 다음 확인 기준을 240자 이내로 적어 주세요." }, 400);
  const owned = `journals?select=${select}&id=eq.${encodeURIComponent(body.id)}&user_id=eq.${encodeURIComponent(auth.userId!)}&market=eq.crypto&source=in.(snapshot,alert,news)`;
  try {
    const rows = await supabaseAdminRest<WorkspaceJournalRow[]>(`${owned}&limit=1`, { timeoutMs: 6000 });
    const entry = rows[0] && toWorkspaceJournal(rows[0]);
    if (!entry) return json({ error: "이 계정의 원본 판단 기록을 찾을 수 없습니다." }, 404);
    const updated = await supabaseAdminRest<WorkspaceJournalRow[]>(owned, {
      method: "PATCH", prefer: "return=representation", timeoutMs: 6000,
      body: { decision_context: { ...rows[0].decision_context, review: { ...review, reviewedAt: new Date().toISOString() } } }
    });
    const journal = updated[0] && toWorkspaceJournal(updated[0]);
    if (!journal) return json({ error: "기록 저장 결과를 확인하지 못했습니다. 다시 불러와 확인해 주세요." }, 409);
    return json({ journal });
  } catch {
    console.error("[decision-workspace] review save failed");
    return json({ error: "확인 기록을 저장하지 못했습니다. 입력한 내용은 유지됩니다." }, 503);
  }
}
