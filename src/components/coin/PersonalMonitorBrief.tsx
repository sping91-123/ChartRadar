"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { monitorChangeSummary, personalMonitorReason, readWatchContext, watchIntentLabels, type MonitorCurrentBrief } from "@/lib/personalMonitor";
import type { PerpetualScenarioMonitor } from "@/lib/perpetualMonitor";
import { monitorConditionDisplayLabel } from "@/lib/perpetualDecisionCopy";
import { startVisiblePolling } from "@/lib/visiblePolling";

function time(value: string) {
  return Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "시각 확인 필요";
}
export function PersonalMonitorBrief({ monitor, current, compact = false }: { monitor: PerpetualScenarioMonitor; current?: MonitorCurrentBrief | null; compact?: boolean }) {
  const context = readWatchContext(monitor.condition);
  const change = monitorChangeSummary(context, current, Date.now(), compact ? "last_check" : "latest");
  const ended = monitor.status === "triggered" || monitor.status === "expired" || monitor.status === "canceled" || Date.parse(monitor.expiresAt) <= Date.now();
  return <section aria-label="내 상황과 시장 변화" className="space-y-3 rounded-xl border border-ui-line bg-ui-inset/50 p-3 text-sm leading-6">
    <div><p className="font-bold text-ui-brand">{context ? watchIntentLabels[context.intent] : "내 감시 조건"}</p>
      {context ? <p className="text-xs text-ui-muted">{personalMonitorReason(context.intent, monitor.condition)}</p> : null}</div>
    {!compact ? <div><p className="text-xs text-ui-muted">{monitor.status === "triggered" ? `확인된 저장 조건 · ${time(monitor.triggeredAt ?? monitor.updatedAt)} KST` : "저장한 확인 조건"}{monitor.condition.id.includes(":user-price:") ? " · 직접 정한 가격" : ""}</p><p>{monitorConditionDisplayLabel(monitor.condition)}</p></div> : null}
    <div><p className="text-xs text-ui-muted">저장 당시와 최근 분석 비교</p><p className="font-semibold">{change.title}</p>
      {change.priceChange !== null ? <p className="text-xs text-ui-muted">기준 가격 {context!.price.toLocaleString("en-US", { maximumFractionDigits: 2 })} → {current!.price.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDT ({change.priceChange >= 0 ? "+" : ""}{change.priceChange.toFixed(2)}%) · 가격 변화이며 내 수익률은 아닙니다.</p> : null}
      {current ? <p className="text-xs text-ui-muted">최근 분석 {time(current.generatedAt)} KST</p> : null}</div>
    {!compact && context ? <details><summary className="cursor-pointer py-1 text-xs text-ui-muted">저장 당시 생각했던 근거</summary><p>{context.headline}</p><p className="text-xs text-ui-muted">당시 위험: {context.topRisk}</p></details> : null}
    {change.ready && current ? <div className="space-y-1 border-t border-ui-line pt-2"><p><span className="font-semibold">{compact ? "최근 검사 때 위험: " : "지금 주의: "}</span>{current.topRisk}</p><p><span className="font-semibold">{compact ? "최근 분석의 확인 기준: " : "다음 확인: "}</span>{current.nextCheck}</p></div> : <p className="text-xs text-ui-muted">최신 데이터가 정상화되면 변화와 다음 확인 기준을 보여드립니다.</p>}
    {!compact ? <><p className="text-xs text-ui-muted">{ended ? "이 감시는 종료됐습니다. 현재 분석에서 새 조건을 선택해 주세요." : monitor.status === "active" ? "저장한 조건만 최대 5분 간격으로 확인합니다. 1회 충족 또는 만료 시 종료됩니다." : "현재 감시는 일시 정지 상태입니다."} 손절 주문이나 모든 위험의 감시를 대신하지 않습니다.</p>
      <Link className="inline-flex min-h-11 items-center rounded-lg border border-ui-line px-3 font-semibold text-ui-brand" href={`/crypto/perpetual?asset=${monitor.asset}#monitor-condition`}>{ended ? "현재 상황으로 새 조건 선택" : "현재 분석에서 조건 확인"}</Link></> : null}
  </section>;
}

export function PersonalMonitorAlert({ monitorId, asset }: { monitorId: string; asset: "btc" | "eth" }) {
  const { session, user, isLoading } = useSupabaseAuth();
  const [state, setState] = useState<{ key: string; monitor?: PerpetualScenarioMonitor; current?: MonitorCurrentBrief | null; error?: string }>({ key: "" });
  const [retry, setRetry] = useState(0);
  const token = session?.accessToken;
  const key = `${user?.id}:${monitorId}:${asset}`;
  useEffect(() => {
    if (!token) return;
    return startVisiblePolling(async signal => {
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(abort, 8_000);
      try {
        const response = await fetch(`/api/crypto/perpetual/monitors/${encodeURIComponent(monitorId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok || data.monitor?.asset !== asset) throw new Error(data.error ?? "이 감시의 분석을 찾지 못했습니다.");
        if (!signal.aborted) setState({ key, monitor: data.monitor, current: data.current });
      } catch (e) {
        if (!signal.aborted) setState({ key, error: controller.signal.aborted ? "기록 확인이 지연되고 있습니다." : e instanceof Error ? e.message : "기록을 불러오지 못했습니다." });
      } finally { clearTimeout(timer); signal.removeEventListener("abort", abort); }
    }, 60_000);
  }, [token, key, monitorId, asset, retry]);
  if (isLoading) return <p role="status" className="p-3 text-sm">내 감시 기록 확인 중</p>;
  if (!token) return <p className="p-3 text-sm">알림을 설정한 계정으로 로그인하면 내 상황과 현재 변화를 확인할 수 있습니다.</p>;
  if (state.key !== key) return <p role="status" className="p-3 text-sm">저장 당시와 현재 상태 비교 중</p>;
  if (state.error || !state.monitor) return <div className="space-y-2 p-3 text-sm"><p role="alert">{state.error}</p><button className="min-h-11 underline" onClick={() => setRetry(v => v + 1)}>내 감시 다시 확인</button></div>;
  return <PersonalMonitorBrief monitor={state.monitor} current={state.current} />;
}
