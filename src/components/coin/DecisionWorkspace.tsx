"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { startVisiblePolling } from "@/lib/visiblePolling";
import { monitorEvaluationStatus } from "@/lib/perpetualMonitoringStatus";
import { PersonalMonitorBrief } from "@/components/coin/PersonalMonitorBrief";
import { plainDecisionText } from "@/lib/perpetualDecisionCopy";
import { decisionReviewChoices, workspaceAnalysisHref, workspaceSummary, type DecisionReview, type DecisionWorkspaceData, type WorkspaceJournal } from "@/lib/decisionWorkspace";

const button = "inline-flex min-h-11 items-center justify-center rounded-xl border border-ui-line px-3 py-2 text-sm font-semibold";
const time = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)) : "아직 확인 전";

function ReviewCard({ journal, focused, onSave }: { journal: WorkspaceJournal; focused: boolean; onSave: (id: string, conclusion: DecisionReview["conclusion"], nextCheck: string) => Promise<void> }) {
  const [open, setOpen] = useState(focused);
  const [conclusion, setConclusion] = useState<DecisionReview["conclusion"] | "">(journal.review?.conclusion ?? "");
  const [nextCheck, setNextCheck] = useState(journal.review?.nextCheck ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const c = journal.context;
  async function save() {
    if (!conclusion || !nextCheck.trim() || busy) return;
    setBusy(true); setError(null);
    try { await onSave(journal.id, conclusion, nextCheck); setOpen(false); }
    catch (e) { setError(e instanceof Error ? e.message : "저장하지 못했습니다."); }
    finally { setBusy(false); }
  }
  return <article id={`decision-${journal.id}`} className="scroll-mt-5 space-y-3 rounded-2xl border border-ui-line bg-ui-panel p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">{c.asset.toUpperCase()} · {journal.review ? "다시 확인한 판단" : "확인할 판단"}</h3><span className="text-xs text-ui-muted">{time(journal.createdAt)} 저장</span></div>
    <p className="text-sm font-semibold leading-6">{plainDecisionText(c.headline)}</p>
    <dl className="space-y-2 text-sm leading-6"><div><dt className="text-xs text-ui-muted">당시 기다린 조건</dt><dd>{c.monitorCondition?.label ?? c.primaryCondition.label}</dd></div><div><dt className="text-xs text-ui-muted">당시 주의할 점</dt><dd>{plainDecisionText(c.topRisk)}</dd></div></dl>
    <div className="flex flex-wrap gap-2"><Link className={button} href={workspaceAnalysisHref(c.asset, c.snapshotId)}>당시 분석</Link><Link className={button} href={workspaceAnalysisHref(c.asset)}>현재 분석</Link></div>
    {journal.review ? <div className="rounded-xl bg-ui-inset p-3 text-sm leading-6" role="status"><p className="font-semibold">내 확인: {decisionReviewChoices[journal.review.conclusion]}</p><p>다음 기준: {journal.review.nextCheck}</p><p className="text-xs text-ui-muted">{time(journal.review.reviewedAt)} · 직접 남긴 기록</p></div> : null}
    <details open={open} onToggle={e => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer py-3 text-sm font-semibold text-ui-brand">{journal.review ? "확인 기록 수정" : "결론과 다음 기준 남기기"}</summary>
      <div className="space-y-3 pt-2">
        <fieldset disabled={busy}><legend className="mb-2 text-sm font-semibold">지금 다시 보니</legend><div className="grid grid-cols-2 gap-2">{Object.entries(decisionReviewChoices).map(([key, label]) => <label key={key} className={`${button} gap-2 ${conclusion === key ? "border-sky-400 bg-sky-400/10" : ""}`}><input type="radio" name={`conclusion-${journal.id}`} value={key} checked={conclusion === key} onChange={() => setConclusion(key as DecisionReview["conclusion"])} />{label}</label>)}</div></fieldset>
        <label className="block space-y-2 text-sm font-semibold"><span>다음에 확인할 기준 한 줄</span><textarea value={nextCheck} onChange={e => setNextCheck(e.target.value)} maxLength={240} rows={3} disabled={busy} placeholder="예: 이전 저가 회복을 확인할 때까지 관망" className="w-full rounded-xl border border-ui-line bg-ui-inset p-3 font-normal" /></label>
        <p className="text-xs leading-5 text-ui-muted">내 판단을 돌아보는 기록입니다. 실제 매매 결과나 자동 검증된 적중률로 집계하지 않습니다.</p>
        {error ? <p role="alert" className="text-sm text-ui-risk">{error}</p> : null}
        <button type="button" className={`${button} w-full bg-sky-500 text-slate-950 disabled:opacity-50`} onClick={() => void save()} disabled={busy || !conclusion || !nextCheck.trim()}>{busy ? "저장 중" : "이 판단에 확인 기록 저장"}</button>
      </div>
    </details>
  </article>;
}

export function DecisionWorkspace({ compact = false, reviewId = null }: { compact?: boolean; reviewId?: string | null }) {
  const { session, user, isLoading } = useSupabaseAuth();
  const [state, setState] = useState<{ key: string; data: DecisionWorkspaceData | null; error: string | null }>({ key: "", data: null, error: null });
  const [retry, setRetry] = useState(0);
  const revision = useRef(0);
  const requestKey = `${user?.id ?? "guest"}:${reviewId ?? ""}`;
  const accessToken = session?.accessToken;
  const load = useCallback(async (signal: AbortSignal) => {
    if (!accessToken) return;
    const startedRevision = revision.current;
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, 8000);
    try {
      const response = await fetch(`/api/crypto/decision-workspace${reviewId ? `?journal=${encodeURIComponent(reviewId)}` : ""}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "기록을 불러오지 못했습니다.");
      if (!Array.isArray(data.monitors) || !Array.isArray(data.journals) || !Array.isArray(data.history)) throw new Error("기록 응답을 확인하지 못했습니다.");
      if (!signal.aborted && revision.current === startedRevision) setState({ key: requestKey, data, error: null });
    } catch (e) {
      if (!signal.aborted && revision.current === startedRevision) setState(current => ({ key: requestKey, data: current.key === requestKey ? current.data : null, error: controller.signal.aborted ? "기록 확인이 지연되고 있습니다. 다시 시도해 주세요." : e instanceof Error ? e.message : "기록을 불러오지 못했습니다." }));
    } finally { clearTimeout(timeout); signal.removeEventListener("abort", abort); }
  }, [accessToken, requestKey, reviewId]);
  useEffect(() => {
    if (!accessToken || isLoading) return;
    return startVisiblePolling(load, compact ? 300_000 : 60_000);
  }, [accessToken, compact, isLoading, load, retry]);
  const data = state.key === requestKey ? state.data : null;
  const focusedId = data?.focusedJournal?.id;
  useEffect(() => {
    if (!compact && reviewId && focusedId === reviewId) {
      document.getElementById(`decision-${reviewId}`)?.scrollIntoView({ block: "start" });
    }
  }, [compact, focusedId, requestKey, reviewId]);
  async function saveReview(id: string, conclusion: DecisionReview["conclusion"], nextCheck: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch("/api/crypto/decision-workspace", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ id, conclusion, nextCheck }), signal: controller.signal });
      const payload = await response.json();
      if (!response.ok || !payload.journal) throw new Error(payload.error ?? "저장 결과를 확인하지 못했습니다.");
      revision.current++;
      setState(current => current.key !== requestKey || !current.data ? current : { ...current, data: { ...current.data, journals: current.data.journals.map(j => j.id === id ? payload.journal : j), focusedJournal: current.data.focusedJournal?.id === id ? payload.journal : current.data.focusedJournal } });
    } catch (error) {
      if (controller.signal.aborted) throw new Error("저장 응답이 지연되고 있습니다. 입력한 내용은 유지되니 다시 시도해 주세요.");
      if (error instanceof TypeError) throw new Error("연결을 확인하지 못했습니다. 입력한 내용은 유지되니 다시 시도해 주세요.");
      throw error;
    } finally { clearTimeout(timeout); }
  }
  if (isLoading) return <p className="p-3 text-xs text-ui-muted" role="status">내 기록 확인 중</p>;
  if (!session && compact) return <Link href="/login?returnTo=%2Fcrypto%2Ftracking" className="flex min-h-12 items-center justify-between gap-2 rounded-xl bg-ui-panel px-3 text-xs"><strong>내 조건·판단 기록</strong><span className="text-ui-brand">로그인하고 이어보기</span></Link>;
  if (!session) return <section className="space-y-2 rounded-xl bg-ui-panel p-3"><h2 className="text-sm font-bold">내 조건·판단 기록</h2><p className="text-xs leading-5 text-ui-muted">저장한 조건이 어디까지 확인됐는지, 지난 판단에서 무엇을 바꿨는지 이어보세요.</p><Link className={button} href={`/login?returnTo=${encodeURIComponent(`/crypto/tracking${reviewId ? `?review=${encodeURIComponent(reviewId)}` : ""}`)}`}>로그인하고 내 기록 보기</Link></section>;
  const refreshError = state.key === requestKey && state.error ? <div className="space-y-2 rounded-xl bg-ui-panel p-3"><p className="text-sm" role="alert">{state.error}</p><button className={button} onClick={() => setRetry(v => v + 1)}>내 기록 다시 불러오기</button></div> : null;
  if (refreshError && !data) return refreshError;
  if (!data) return <p className="p-3 text-xs text-ui-muted" role="status">저장한 조건과 판단을 불러오는 중입니다.</p>;
  const summary = workspaceSummary(data);
  if (compact) return <section className="rounded-xl border border-ui-line bg-ui-panel px-3 py-3" aria-label="내 조건 이어보기"><div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold">내 조건·판단 기록</h2><p className="mt-1 text-xs leading-5 text-ui-muted">{refreshError ? "기록 갱신 지연 · 다시 확인해 주세요" : summary.running === 0 ? "지금 감시 중인 개인 조건이 없습니다. 만료·종료된 조건은 새로 선택해 주세요." : `${summary.running}개 추적 중 · 저장한 판단 ${summary.pending}개 확인 대기`}</p></div><Link href={summary.running === 0 && !refreshError ? "/crypto/perpetual?asset=btc#monitor-condition" : "/crypto/tracking"} className={`${button} shrink-0 text-ui-brand`}>{summary.running === 0 && !refreshError ? "조건 설정" : "이어보기"}</Link></div></section>;
  const journals = [...(data.focusedJournal ? [data.focusedJournal] : []), ...data.journals.filter(j => j.id !== data.focusedJournal?.id)];
  const pending = journals.filter(j => !j.review);
  const reviewed = journals.filter(j => j.review);
  return <div className="space-y-6">
    {refreshError}
    <section className="space-y-3"><h1 className="text-2xl font-bold">내 조건·판단 기록</h1><p className="text-sm leading-6 text-ui-muted">기다리는 조건을 확인하고, 저장한 당시 분석에 지금의 판단을 이어 남기세요.</p><div className="grid grid-cols-3 gap-2 rounded-2xl bg-ui-panel p-4 text-center"><div><strong className="text-xl">{summary.running}</strong><p className="mt-1 text-xs text-ui-muted">추적 중</p></div><div><strong className="text-xl">{summary.checked}</strong><p className="mt-1 text-xs text-ui-muted">최근 정상 검사</p></div><div><strong className="text-xl">{summary.reviewed}/{data.journals.length}</strong><p className="mt-1 text-xs text-ui-muted">판단 다시 확인</p></div></div><p className="text-xs leading-5 text-ui-muted">검사는 최근 7분 내 정상 자료 기준 · 판단은 최근 저장한 최대 20개 기준입니다.</p></section>
    <section className="space-y-3"><h2 className="text-lg font-bold">지금 기다리는 조건</h2>
      {data.monitors.length ? data.monitors.map(m => { const status = monitorEvaluationStatus(m); return <article key={m.id} className="space-y-2 rounded-2xl border border-ui-line bg-ui-panel p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">{m.asset.toUpperCase()} · {m.timeframe}</h3><span className="text-xs text-ui-muted">{m.status === "paused_entitlement" ? "구독 확인 필요 · 일시 정지" : m.status === "paused" ? "일시 정지" : status.label}</span></div><p className="text-sm leading-6">{m.condition.label}</p><p className="text-xs leading-5 text-ui-muted">{status.detail}</p><p className="text-xs text-ui-muted">마지막 검사 {time(m.lastEvaluatedAt)} · 종료 {time(m.expiresAt)}</p><PersonalMonitorBrief monitor={m} current={m.lastEvaluation?.brief} compact /><div className="flex flex-wrap gap-2"><Link className={button} href={workspaceAnalysisHref(m.asset, m.snapshotId)}>저장 당시</Link><Link className={button} href={workspaceAnalysisHref(m.asset, m.lastSnapshotId)}>{m.lastSnapshotId ? "최근 검사 분석" : "현재 분석"}</Link><Link className={button} href={`${workspaceAnalysisHref(m.asset)}#saved-monitors`}>조건 관리</Link></div></article>; }) : <div className="space-y-3 rounded-2xl bg-ui-panel p-4"><p className="text-sm leading-6">아직 저장한 조건이 없습니다. 분석에서 기다릴 조건을 하나 선택해 보세요.</p><Link className={`${button} text-ui-brand`} href="/crypto/perpetual?asset=btc#monitor-condition">BTC 분석에서 조건 선택</Link></div>}
    </section>
    {data.history.length ? <details className="rounded-xl border border-ui-line p-4"><summary className="cursor-pointer py-1 font-semibold">최근 종료된 조건 {data.history.length}개</summary><div className="mt-3 divide-y divide-ui-line">{data.history.map(m => <article key={m.id} className="space-y-2 py-3"><p className="text-sm font-semibold">{m.asset.toUpperCase()} · {m.status === "triggered" ? "조건 확인됨" : m.status === "expired" ? "기간 종료" : "취소됨"}</p><p className="text-sm leading-6">{m.condition.label}</p><p className="text-xs text-ui-muted">{time(m.triggeredAt ?? m.updatedAt)}</p><Link className={button} href={`/crypto/tracking?asset=${m.asset}&monitor=${m.id}`}>당시와 현재 비교</Link></article>)}</div></details> : null}
    <section className="space-y-3"><h2 className="text-lg font-bold">저장한 판단 다시 확인</h2>
      {reviewId && !data.focusedJournal ? <p role="alert" className="text-sm text-ui-risk">이 계정에서 선택한 기록을 찾지 못했습니다. 아래 내 기록에서 선택해 주세요.</p> : null}
      {data.unavailableJournalCount > 0 ? <p className="text-xs text-ui-muted">원본 연결을 확인하지 못한 기록 {data.unavailableJournalCount}개는 기존 복기에서 확인해 주세요.</p> : null}
      {!journals.length ? <div className="space-y-3 rounded-2xl bg-ui-panel p-4"><p className="text-sm leading-6">분석 화면에서 ‘판단 기록에 저장’을 누르면 당시 조건과 위험을 그대로 보관합니다.</p><Link className={button} href="/crypto/perpetual?asset=btc">분석 보고 첫 판단 저장</Link></div> : null}
      {pending.map(j => <ReviewCard key={`${j.id}:${j.review?.reviewedAt ?? "pending"}`} journal={j} focused={j.id === reviewId} onSave={saveReview} />)}
      {reviewed.length ? <details open={Boolean(reviewId && data.focusedJournal?.review)} className="rounded-xl border border-ui-line p-3"><summary className="cursor-pointer py-2 font-semibold">다시 확인한 판단 {reviewed.length}개</summary><div className="mt-3 space-y-3">{reviewed.map(j => <ReviewCard key={`${j.id}:${j.review?.reviewedAt}`} journal={j} focused={j.id === reviewId} onSave={saveReview} />)}</div></details> : null}
    </section>
    <div className="flex flex-wrap gap-2"><Link className={button} href="/crypto/review">전체 복기·직접 기록</Link><Link className={button} href="/crypto/alertlist">알림 기록</Link></div>
  </div>;
}
