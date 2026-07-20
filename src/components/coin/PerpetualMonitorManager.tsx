"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, Loader2, Pause, Play, X } from "lucide-react";
import { ActionButton, StatusPill } from "@/components/ui/DesignPrimitives";
import type { PerpetualMonitorCapabilities, PerpetualScenarioMonitor } from "@/lib/perpetualMonitor";

type ManagerState =
  | { status: "idle" | "loading"; monitors: PerpetualScenarioMonitor[] }
  | { status: "ready"; monitors: PerpetualScenarioMonitor[]; capabilities: PerpetualMonitorCapabilities }
  | { status: "error"; monitors: PerpetualScenarioMonitor[]; message: string };

type MonitorAction = "pause" | "resume" | "cancel";

const manageableStatuses = new Set(["active", "paused", "paused_entitlement"]);

function statusCopy(status: PerpetualScenarioMonitor["status"]) {
  if (status === "active") return { label: "감시 중", tone: "long" as const };
  if (status === "paused") return { label: "일시 정지", tone: "watch" as const };
  return { label: "구독 종료로 정지", tone: "risk" as const };
}

function expiryCopy(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "만료 시각 확인 필요";
  return `${date.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })} ${date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })}까지`;
}

export function PerpetualMonitorManager({
  accessToken,
  refreshKey,
  onUsageChange
}: {
  accessToken?: string | null;
  refreshKey: number;
  onUsageChange: (count: number) => void;
}) {
  const [state, setState] = useState<ManagerState>({ status: "idle", monitors: [] });
  const [busyId, setBusyId] = useState<string | null>(null);
  const generationRef = useRef(0);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!accessToken) {
      setState({ status: "idle", monitors: [] });
      return;
    }
    const generation = ++generationRef.current;
    setState((current) => ({ status: "loading", monitors: current.monitors }));
    try {
      const response = await fetch("/api/crypto/perpetual/monitors", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
        signal
      });
      const payload = (await response.json().catch(() => ({}))) as {
        monitors?: PerpetualScenarioMonitor[];
        capabilities?: PerpetualMonitorCapabilities;
        error?: string;
      };
      if (!response.ok || !payload.monitors || !payload.capabilities) {
        throw new Error(payload.error ?? "저장한 감시 조건을 불러오지 못했습니다.");
      }
      if (signal?.aborted || generation !== generationRef.current) return;
      const monitors = payload.monitors.filter((monitor) => manageableStatuses.has(monitor.status));
      setState({ status: "ready", monitors, capabilities: payload.capabilities });
      onUsageChange(payload.capabilities.activeMonitorCount);
    } catch (error) {
      if (signal?.aborted || generation !== generationRef.current) return;
      setState((current) => ({
        status: "error",
        monitors: current.monitors,
        message: error instanceof Error ? error.message : "저장한 감시 조건을 불러오지 못했습니다."
      }));
    }
  }, [accessToken, onUsageChange]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => {
      generationRef.current += 1;
      controller.abort();
    };
  }, [load, refreshKey]);

  const updateMonitor = useCallback(async (monitor: PerpetualScenarioMonitor, action: MonitorAction) => {
    if (!accessToken || busyId) return;
    if (action === "cancel" && !window.confirm("이 감시 조건을 취소할까요? 취소한 조건은 다시 시작할 수 없습니다.")) return;
    setBusyId(monitor.id);
    try {
      const response = await fetch(`/api/crypto/perpetual/monitors/${encodeURIComponent(monitor.id)}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action }),
        cache: "no-store"
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "감시 조건을 변경하지 못했습니다.");
      await load();
    } catch (error) {
      setState((current) => ({
        status: "error",
        monitors: current.monitors,
        message: error instanceof Error ? error.message : "감시 조건을 변경하지 못했습니다."
      }));
    } finally {
      setBusyId(null);
    }
  }, [accessToken, busyId, load]);

  if (!accessToken) return null;

  const monitors = state.monitors;
  const loading = state.status === "loading";
  return (
    <details className="group bg-ui-panel px-3 py-3 sm:px-5">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <Bell size={15} className="shrink-0 text-ui-brand" aria-hidden />
          <span className="min-w-0 text-sm font-black text-ui-text">내 감시 조건</span>
          <StatusPill tone="watch">
            {state.status === "ready" ? `${state.capabilities.activeMonitorCount}/${state.capabilities.monitorLimit}` : monitors.length}
          </StatusPill>
        </span>
        {loading ? <Loader2 size={16} className="animate-spin text-ui-muted" aria-hidden /> : <ChevronDown size={16} className="text-ui-muted transition group-open:rotate-180" aria-hidden />}
      </summary>

      <div className="mt-3 border-t border-ui-line pt-3">
        {state.status === "ready" ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs leading-5 text-ui-muted">
            <span>
              시나리오 {state.capabilities.scenarioMonitorCount} · 기존 알림 {state.capabilities.presetCount} · 합계 {state.capabilities.activeMonitorCount}/{state.capabilities.monitorLimit}
            </span>
            <a href="/crypto/alertset" className="shrink-0 font-black text-ui-brand underline-offset-2 hover:underline">기존 알림 관리</a>
          </div>
        ) : null}
        {monitors.length === 0 && !loading ? (
          <p className="text-xs leading-5 text-ui-muted">저장된 조건이 없습니다. 최신 정상 스냅샷에서 확인할 조건을 선택할 수 있습니다.</p>
        ) : (
          <div className="divide-y divide-ui-line">
            {monitors.map((monitor) => {
              const status = statusCopy(monitor.status);
              const busy = busyId === monitor.id;
              return (
                <article key={monitor.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-black text-ui-text">{monitor.asset.toUpperCase()} · {monitor.timeframe}</p>
                    <StatusPill tone={status.tone}>{status.label}</StatusPill>
                  </div>
                  <p className="mt-1 text-xs font-semibold leading-5 text-ui-muted [word-break:keep-all]">{monitor.condition.label}</p>
                  <p className="mt-1 text-[10.5px] text-ui-subtle">{expiryCopy(monitor.expiresAt)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {monitor.status === "active" ? (
                      <ActionButton tone="secondary" disabled={busy} onClick={() => void updateMonitor(monitor, "pause")}>
                        {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Pause size={14} aria-hidden />} 일시 정지
                      </ActionButton>
                    ) : monitor.status === "paused" ? (
                      <ActionButton tone="secondary" disabled={busy} onClick={() => void updateMonitor(monitor, "resume")}>
                        {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Play size={14} aria-hidden />} 다시 시작
                      </ActionButton>
                    ) : (
                      <ActionButton href="/pro?market=crypto&source=paused-monitor" tone="secondary">Coin Pro에서 재개</ActionButton>
                    )}
                    <ActionButton tone="ghost" disabled={busy} onClick={() => void updateMonitor(monitor, "cancel")}>
                      <X size={14} aria-hidden /> 취소
                    </ActionButton>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {state.status === "error" ? <p role="alert" className="mt-2 text-xs font-semibold text-ui-risk">{state.message}</p> : null}
      </div>
    </details>
  );
}
