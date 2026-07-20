"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, Bell, BookOpen, CheckCircle2, Clock3, Database, History, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { PerpetualDecisionChart } from "@/components/coin/PerpetualDecisionChart";
import { PerpetualMonitorManager } from "@/components/coin/PerpetualMonitorManager";
import { ActionButton, StatusPill } from "@/components/ui/DesignPrimitives";
import { withSupabaseAuth } from "@/lib/authFetch";
import { appendJournalEntry, decisionJournalContextFromSnapshot } from "@/lib/journal";
import { readPerpetualAlertContext } from "@/lib/perpetualAlertContext";
import { journalMonitorIdForSnapshot } from "@/lib/perpetualMonitor";
import type { CryptoHomeTicker } from "@/lib/server/cryptoExchangeData";
import type { MonitorCondition, PerpetualAsset, PerpetualDecisionSnapshot } from "@/lib/perpetualDecisionSnapshot";
import type { PerpetualSnapshotCapabilities, PerpetualSnapshotResponse } from "@/lib/perpetualApi";
import { buildStalePerpetualDecisionFallback, perpetualSnapshotRefreshDelay } from "@/lib/perpetualSnapshotContinuity";
import { trackProductEvent } from "@/lib/trackProductEvent";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

type DecisionLoadState =
  | { status: "loading"; snapshot: null; capabilities: null; continuity: null }
  | {
      status: "ready" | "refreshing";
      snapshot: PerpetualDecisionSnapshot;
      capabilities: PerpetualSnapshotCapabilities;
      continuity: NonNullable<PerpetualSnapshotResponse["continuity"]>;
    }
  | {
      status: "error";
      snapshot: PerpetualDecisionSnapshot | null;
      capabilities: PerpetualSnapshotCapabilities | null;
      continuity: NonNullable<PerpetualSnapshotResponse["continuity"]> | null;
      message: string;
    };

type MonitorState =
  | { status: "idle" }
  | { status: "saving"; conditionId: string }
  | { status: "saved"; conditionId: string; monitorId: string; snapshotId: string; message: string }
  | { status: "error"; conditionId: string; message: string };

type JournalState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

class JournalRouteError extends Error {
  allowLocalFallback: boolean;

  constructor(message: string, allowLocalFallback: boolean) {
    super(message);
    this.name = "JournalRouteError";
    this.allowLocalFallback = allowLocalFallback;
  }
}

const assetSymbols = {
  btc: { label: "BTC", tickerSymbol: "BTC/USDT:USDT" },
  eth: { label: "ETH", tickerSymbol: "ETH/USDT:USDT" }
} as const;

function formatAsOf(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "시각 확인 필요";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function formatPrice(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: value >= 10_000 ? 0 : 2 });
}

function decisionTone(state: PerpetualDecisionSnapshot["summary"]["state"]) {
  if (state === "upside_watch") return "long" as const;
  if (state === "downside_watch") return "short" as const;
  if (state === "risk") return "risk" as const;
  return "watch" as const;
}

function decisionLabel(state: PerpetualDecisionSnapshot["summary"]["state"]) {
  if (state === "upside_watch") return "상방 확인 시나리오";
  if (state === "downside_watch") return "하방 확인 시나리오";
  if (state === "risk") return "리스크 우선";
  return "범위 확인";
}

function qualityLabel(quality: PerpetualDecisionSnapshot["quality"]) {
  if (quality === "ready") return "데이터 정상";
  if (quality === "partial") return "일부 근거 부족";
  if (quality === "stale") return "갱신 지연";
  return "데이터 확인 필요";
}

function currentReturnTo() {
  if (typeof window === "undefined") return "/crypto/perpetual";
  return `${window.location.pathname}${window.location.search}`;
}

function MonitorAction({
  condition,
  capabilities,
  monitorState,
  onCreate,
  isAuthenticated,
  actionable,
  snapshotId
}: {
  condition: MonitorCondition;
  capabilities: PerpetualSnapshotCapabilities;
  monitorState: MonitorState;
  onCreate: (condition: MonitorCondition) => void;
  isAuthenticated: boolean;
  actionable: boolean;
  snapshotId: string;
}) {
  const busy = monitorState.status === "saving" && monitorState.conditionId === condition.id;
  const saved = monitorState.status === "saved" && monitorState.snapshotId === snapshotId && monitorState.conditionId === condition.id;
  const disabled = !capabilities.monitorEnabled || !actionable || capabilities.setupRequired || capabilities.activeMonitorCount >= capabilities.monitorLimit;

  if (!capabilities.monitorEnabled) {
    return (
      <ActionButton tone="secondary" disabled className="w-full sm:w-auto">
        <Bell size={15} aria-hidden /> 조건 감시 준비 중
      </ActionButton>
    );
  }

  if (!actionable) {
    return (
      <ActionButton tone="secondary" disabled className="w-full sm:w-auto">
        <Bell size={15} aria-hidden /> 데이터 정상화 후 가능
      </ActionButton>
    );
  }

  if (!isAuthenticated || capabilities.requiresAuth) {
    return (
      <ActionButton href={`/login?returnTo=${encodeURIComponent(currentReturnTo())}`} tone="primary" className="w-full sm:w-auto">
        <Bell size={15} aria-hidden /> 로그인하고 조건 감시
      </ActionButton>
    );
  }

  if (capabilities.activeMonitorCount >= capabilities.monitorLimit) {
    return <ActionButton href="/pro?market=crypto&source=perpetual" tone="secondary" className="w-full sm:w-auto">감시 한도 확인</ActionButton>;
  }

  return (
    <ActionButton
      tone={saved ? "secondary" : "primary"}
      disabled={disabled || busy || saved}
      onClick={() => onCreate(condition)}
      className="w-full sm:w-auto"
    >
      {busy ? <Loader2 className="animate-spin" size={15} aria-hidden /> : saved ? <CheckCircle2 size={15} aria-hidden /> : <Bell size={15} aria-hidden />}
      {saved ? "감시 저장됨" : capabilities.setupRequired ? "저장소 준비 필요" : !actionable ? "데이터 정상화 후 가능" : "이 조건 감시하기"}
    </ActionButton>
  );
}

export function PerpetualDecisionExperience({
  asset,
  requestedSnapshotId,
  source,
  attributionId
}: {
  asset: PerpetualAsset;
  requestedSnapshotId?: string | null;
  source?: "home" | "alert" | null;
  attributionId?: string | null;
}) {
  const { session } = useSupabaseAuth();
  const [state, setState] = useState<DecisionLoadState>({ status: "loading", snapshot: null, capabilities: null, continuity: null });
  const [monitorState, setMonitorState] = useState<MonitorState>({ status: "idle" });
  const [journalState, setJournalState] = useState<JournalState>({ status: "idle" });
  const [alertMonitorId, setAlertMonitorId] = useState<string | null>(null);
  const [effectiveSource, setEffectiveSource] = useState<"home" | "alert" | null>(source ?? null);
  const [monitorRefreshKey, setMonitorRefreshKey] = useState(0);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const generationRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const initialRequestRef = useRef(requestedSnapshotId ?? null);
  const effectiveSourceRef = useRef<"home" | "alert" | null>(source ?? null);
  const trackedViewRef = useRef(false);
  const trackedGateRef = useRef(false);

  useEffect(() => {
    initialRequestRef.current = requestedSnapshotId ?? null;
    effectiveSourceRef.current = source ?? null;
    setEffectiveSource(source ?? null);
    setAlertMonitorId(null);
    trackedViewRef.current = false;
    trackedGateRef.current = false;
  }, [asset, requestedSnapshotId, source]);

  const load = useCallback(async (silent = false) => {
    const generation = ++generationRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (!silent) setState({ status: "loading", snapshot: null, capabilities: null, continuity: null });
    else setState((current) => {
      if (!current.snapshot || !current.capabilities || !current.continuity) return current;
      return {
        status: "refreshing",
        snapshot: current.snapshot,
        capabilities: current.capabilities,
        continuity: current.continuity
      };
    });
    try {
      const requestSource = effectiveSourceRef.current;
      const params = new URLSearchParams({ asset });
      if (initialRequestRef.current) params.set("snapshot", initialRequestRef.current);
      if (requestSource === "alert") params.set("source", "alert");
      const response = await fetch(`/api/crypto/perpetual/snapshot?${params.toString()}`, await withSupabaseAuth({ cache: "no-store", signal: controller.signal }));
      const payload = (await response.json().catch(() => ({}))) as PerpetualSnapshotResponse;
      if (!response.ok || !payload.snapshot || !payload.capabilities || !payload.continuity) {
        throw new Error(payload.error ?? "선물 판단 스냅샷을 불러오지 못했습니다.");
      }
      if (controller.signal.aborted || generation !== generationRef.current) return null;
      const nextSnapshot = payload.snapshot;
      const nextCapabilities = payload.capabilities;
      const nextContinuity = payload.continuity;
      const nextEffectiveSource = requestSource === "alert" && nextContinuity.status !== "same"
        ? null
        : requestSource;
      initialRequestRef.current = nextSnapshot.id;
      effectiveSourceRef.current = nextEffectiveSource;
      setEffectiveSource(nextEffectiveSource);
      setState({
        status: "ready",
        snapshot: nextSnapshot,
        capabilities: nextCapabilities,
        continuity: nextContinuity
      });
      const url = new URL(window.location.href);
      url.searchParams.set("asset", asset);
      url.searchParams.set("timeframe", "15m");
      url.searchParams.set("snapshot", payload.snapshot.id);
      if (nextEffectiveSource) url.searchParams.set("source", nextEffectiveSource);
      else url.searchParams.delete("source");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      return nextSnapshot;
    } catch (error) {
      if (controller.signal.aborted || generation !== generationRef.current) return null;
      setState((current) => ({
        status: "error",
        snapshot: current.snapshot,
        capabilities: current.capabilities,
        continuity: current.continuity,
        message: error instanceof Error ? error.message : "선물 판단 스냅샷을 불러오지 못했습니다."
      }));
      return null;
    }
  }, [asset]);

  useEffect(() => {
    setMonitorState({ status: "idle" });
    let cancelled = false;
    let timer: number | undefined;
    async function refresh(silent: boolean) {
      const nextSnapshot = await load(silent);
      if (cancelled) return;
      timer = window.setTimeout(
        () => void refresh(true),
        perpetualSnapshotRefreshDelay(nextSnapshot?.expiresAt)
      );
    }
    void refresh(false);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      generationRef.current += 1;
      abortRef.current?.abort();
    };
  }, [asset, load, requestedSnapshotId, session?.accessToken]);

  const snapshot = state.snapshot;
  const exactAlertContext = effectiveSource === "alert" && state.continuity?.status === "same";
  useEffect(() => {
    if (!snapshot) return;
    const context = source === "alert"
      ? readPerpetualAlertContext(requestedSnapshotId ?? snapshot.id)
      : null;
    const scenarioOpened = source === "alert" && Boolean(context);
    setAlertMonitorId(exactAlertContext ? context?.monitorId ?? null : null);
    if (!trackedViewRef.current) {
      trackedViewRef.current = true;
      void trackProductEvent({
        eventName: scenarioOpened ? "scenario_opened" : "perpetual_snapshot_viewed",
        surface: "perpetual",
        asset: snapshot.asset,
        snapshotId: scenarioOpened ? context!.snapshotId : snapshot.id,
        monitorId: context?.monitorId,
        attributionId: scenarioOpened ? undefined : attributionId ?? undefined,
        properties: scenarioOpened
          ? { source: exactAlertContext ? "alert" : "alert_refreshed" }
          : { quality: snapshot.quality, continuity: state.continuity?.status ?? "current", source: effectiveSource ?? "direct" }
      });
    }
    if (!snapshot.pro && !trackedGateRef.current) {
      trackedGateRef.current = true;
      void trackProductEvent({
        eventName: "pro_gate_viewed",
        surface: "perpetual",
        asset: snapshot.asset,
        snapshotId: snapshot.id,
        properties: { source: effectiveSource ?? "direct", reason: "pro_conditions" }
      });
    }
  }, [attributionId, effectiveSource, exactAlertContext, requestedSnapshotId, snapshot, source, state.continuity?.status]);
  useEffect(() => {
    if (!snapshot) return;
    let cancelled = false;
    async function tick() {
      try {
        const params = new URLSearchParams({ exchange: "binance", symbol: assetSymbols[asset].tickerSymbol });
        const response = await fetch(`/api/crypto-home-ticker?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json()) as { ticker?: CryptoHomeTicker };
        if (!cancelled && response.ok && payload.ticker?.price) setLivePrice(payload.ticker.price);
      } catch {
        // Keep the immutable snapshot price when the live ticker is unavailable.
      }
    }
    setLivePrice(snapshot.price);
    void tick();
    const timer = window.setInterval(tick, 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [asset, snapshot]);

  const createMonitor = useCallback(async (condition: MonitorCondition) => {
    if (!snapshot) return;
    setMonitorState({ status: "saving", conditionId: condition.id });
    let failureTracked = false;
    try {
      const response = await fetch(
        "/api/crypto/perpetual/monitors",
        await withSupabaseAuth({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshotId: snapshot.id, conditionId: condition.id })
        })
      );
      const payload = (await response.json().catch(() => ({}))) as {
        monitor?: { id: string };
        usage?: { activeMonitorCount?: number; enabledPresetCount?: number; total?: number };
        error?: string;
        code?: string;
      };
      if (!response.ok || !payload.monitor) {
        failureTracked = true;
        void trackProductEvent({
          eventName: "monitor_failed",
          surface: "perpetual",
          asset: snapshot.asset,
          snapshotId: snapshot.id,
          properties: { code: payload.code ?? String(response.status), conditionRole: condition.role, source: effectiveSource ?? "direct" }
        });
        throw new Error(payload.error ?? "조건 감시를 저장하지 못했습니다.");
      }
      setMonitorState({ status: "saved", conditionId: condition.id, monitorId: payload.monitor.id, snapshotId: snapshot.id, message: "최대 5분 간격 감시가 시작됐습니다." });
      setMonitorRefreshKey((current) => current + 1);
      setState((current) => current.capabilities ? {
        ...current,
        capabilities: {
          ...current.capabilities,
          activeMonitorCount: typeof payload.usage?.total === "number"
            ? payload.usage.total
            : current.capabilities.activeMonitorCount + 1,
          scenarioMonitorCount: typeof payload.usage?.activeMonitorCount === "number"
            ? payload.usage.activeMonitorCount
            : current.capabilities.scenarioMonitorCount + 1,
          presetCount: typeof payload.usage?.enabledPresetCount === "number"
            ? payload.usage.enabledPresetCount
            : current.capabilities.presetCount
        }
      } : current);
    } catch (error) {
      if (!failureTracked) {
        void trackProductEvent({
          eventName: "monitor_failed",
          surface: "perpetual",
          asset: snapshot.asset,
          snapshotId: snapshot.id,
          properties: { code: "network_error", conditionRole: condition.role, source: effectiveSource ?? "direct" }
        });
      }
      setMonitorState({ status: "error", conditionId: condition.id, message: error instanceof Error ? error.message : "조건 감시를 저장하지 못했습니다." });
    }
  }, [effectiveSource, snapshot]);

  const handleMonitorUsageChange = useCallback((count: number) => {
    setState((current) => {
      if (!current.capabilities || current.capabilities.activeMonitorCount === count) return current;
      return {
        ...current,
        capabilities: { ...current.capabilities, activeMonitorCount: count }
      };
    });
  }, []);

  const saveJournal = useCallback(async () => {
    if (!snapshot || !session) return;
    const monitorId = journalMonitorIdForSnapshot(
      snapshot.id,
      monitorState.status === "saved"
        ? { monitorId: monitorState.monitorId, snapshotId: monitorState.snapshotId }
        : null,
      alertMonitorId,
      exactAlertContext
    );
    const journalSource = exactAlertContext ? "alert" : "snapshot";
    setJournalState({ status: "saving" });
    try {
      const response = await fetch(
        "/api/crypto/perpetual/journal",
        await withSupabaseAuth({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshotId: snapshot.id, monitorId, source: journalSource })
        })
      );
      const payload = (await response.json().catch(() => ({}))) as { journal?: { id: string }; error?: string };
      if (!response.ok) {
        throw new JournalRouteError(payload.error ?? "복기를 저장하지 못했습니다.", response.status >= 500);
      }
      if (!payload.journal) throw new JournalRouteError("복기 저장 응답을 확인하지 못했습니다.", false);
      setJournalState({ status: "saved", message: "판단 당시 snapshot을 복기에 연결했습니다." });
    } catch (error) {
      if (error instanceof JournalRouteError && !error.allowLocalFallback) {
        setJournalState({ status: "error", message: error.message });
        return;
      }
      try {
        appendJournalEntry({
          title: `${snapshot.symbol} 선물 리스크 스냅샷`,
          bias: decisionLabel(snapshot.summary.state),
          note: `${snapshot.summary.topRisk}\n다음 확인: ${snapshot.summary.primaryCondition.label}`,
          market: "crypto",
          source: journalSource,
          symbol: snapshot.symbol,
          timeframe: snapshot.primaryTimeframe,
          verdict: snapshot.summary.headline,
          decisionSnapshotId: snapshot.id,
          monitorId: monitorId ?? undefined,
          decisionContext: decisionJournalContextFromSnapshot(snapshot)
        }, session.userId);
        setJournalState({ status: "saved", message: "서버 연결이 불안정해 이 기기에 미동기화 복기로 보관했습니다." });
      } catch {
        setJournalState({ status: "error", message: error instanceof Error ? error.message : "복기를 저장하지 못했습니다." });
      }
    }
  }, [alertMonitorId, exactAlertContext, monitorState, session, snapshot]);

  if (!snapshot && state.status === "loading") {
    return (
      <section className="min-h-[360px] bg-ui-panel px-4 py-6" aria-busy="true">
        <div className="flex items-center gap-2 text-sm font-semibold text-ui-muted">
          <Loader2 className="animate-spin text-ui-brand" size={18} aria-hidden /> Home과 같은 선물 판단 스냅샷을 확인하고 있습니다.
        </div>
      </section>
    );
  }

  if (!snapshot || !state.capabilities) {
    return (
      <section className="bg-ui-panel px-4 py-6">
        <p className="text-base font-black text-ui-text">선물 리스크 스냅샷을 불러오지 못했습니다.</p>
        <p className="mt-2 text-sm leading-6 text-ui-muted">{state.status === "error" ? state.message : "잠시 뒤 다시 확인해 주세요."}</p>
        <ActionButton tone="secondary" className="mt-4" onClick={() => void load()}><RefreshCw size={15} aria-hidden /> 다시 불러오기</ActionButton>
      </section>
    );
  }

  const capabilities = state.capabilities;
  const displaySnapshot = state.status === "error"
    ? buildStalePerpetualDecisionFallback(snapshot)
    : snapshot;
  const displayQuality: PerpetualDecisionSnapshot["quality"] = displaySnapshot.quality;
  const monitorActionable =
    displayQuality === "ready" &&
    !exactAlertContext &&
    new Date(displaySnapshot.expiresAt).getTime() > Date.now();
  const continuityRefreshed = state.continuity?.status === "refreshed" && Boolean(requestedSnapshotId);
  const conditions = displaySnapshot.pro
    ? [displaySnapshot.summary.primaryCondition, ...displaySnapshot.pro.confirmationConditions, ...displaySnapshot.pro.invalidationConditions]
    : [displaySnapshot.summary.primaryCondition];

  return (
    <div className="space-y-3">
      {continuityRefreshed ? (
        <div className="flex items-start gap-2 bg-ui-watch/10 px-3 py-2 text-xs font-semibold leading-5 text-ui-watch">
          <History size={15} className="mt-0.5 shrink-0" aria-hidden />
          {source === "alert"
            ? "알림 당시 snapshot을 찾지 못해 최신 상태로 갱신했습니다. 조건을 다시 확인해 주세요."
            : "Home에서 본 이후 데이터가 갱신되었습니다. 현재 snapshot으로 조건을 다시 확인해 주세요."}
        </div>
      ) : null}

      <section className="bg-ui-panel px-3 py-4 sm:px-5" aria-labelledby="perpetual-decision-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-ui-subtle">{assetSymbols[asset].label} · Binance USDT-M · 15분 확정</p>
            <p className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-semibold text-ui-muted"><Clock3 size={12} aria-hidden /> 판단 시각 {formatAsOf(displaySnapshot.generatedAt)}</p>
          </div>
          <div className="flex gap-1">
            <StatusPill tone={displayQuality === "ready" ? "long" : "risk"} icon={Database}>{qualityLabel(displayQuality)}</StatusPill>
            <StatusPill tone={decisionTone(displaySnapshot.summary.state)} icon={Activity}>{decisionLabel(displaySnapshot.summary.state)}</StatusPill>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-1.5 min-[390px]:flex-row min-[390px]:items-end min-[390px]:justify-between min-[390px]:gap-3">
          <h1 id="perpetual-decision-title" className="min-w-0 max-w-3xl text-2xl font-black leading-8 tracking-tight text-ui-text [word-break:keep-all]">{displaySnapshot.summary.headline}</h1>
          <p className="shrink-0 text-2xl font-black tabular-nums text-ui-text">{formatPrice(livePrice ?? displaySnapshot.price)}</p>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <div className="bg-ui-risk/10 px-3 py-3">
            <p className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.1em] text-ui-risk"><AlertTriangle size={12} aria-hidden /> 가장 큰 위험</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-ui-text [word-break:keep-all]">{displaySnapshot.summary.topRisk}</p>
          </div>
          <div className="bg-ui-inset/65 px-3 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.1em] text-ui-brand">다음 확인 조건</p>
            <p className="mt-1 text-sm font-black leading-6 text-ui-text [word-break:keep-all]">{displaySnapshot.summary.primaryCondition.label}</p>
          </div>
        </div>

        <ul className="mt-3 grid gap-1.5 text-xs font-semibold leading-5 text-ui-muted md:grid-cols-2">
          {displaySnapshot.summary.reasons.map((reason) => <li key={reason}>· {reason}</li>)}
        </ul>

        <div className="mt-4 flex flex-col gap-2 border-t border-ui-line pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-ui-muted">감시는 실시간 체결 지시가 아니라 조건 변화를 최대 5분 간격으로 확인합니다.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <MonitorAction condition={displaySnapshot.summary.primaryCondition} capabilities={capabilities} monitorState={monitorState} onCreate={createMonitor} isAuthenticated={Boolean(session)} actionable={monitorActionable} snapshotId={displaySnapshot.id} />
            {session ? (
              <ActionButton
                tone="secondary"
                disabled={state.status === "error" || journalState.status === "saving" || journalState.status === "saved"}
                onClick={() => void saveJournal()}
                className="w-full sm:w-auto"
              >
                {journalState.status === "saving" ? <Loader2 className="animate-spin" size={15} aria-hidden /> : <BookOpen size={15} aria-hidden />}
                {journalState.status === "saved" ? "복기 저장됨" : "복기에 저장"}
              </ActionButton>
            ) : null}
          </div>
        </div>
        {monitorState.status === "saved" || monitorState.status === "error" ? (
          <p role={monitorState.status === "error" ? "alert" : "status"} aria-live="polite" className={`mt-2 text-xs font-semibold ${monitorState.status === "saved" ? "text-ui-long" : "text-ui-risk"}`}>{monitorState.message}</p>
        ) : null}
        {journalState.status === "saved" || journalState.status === "error" ? (
          <p role={journalState.status === "error" ? "alert" : "status"} aria-live="polite" className={`mt-2 text-xs font-semibold ${journalState.status === "saved" ? "text-ui-long" : "text-ui-risk"}`}>
            {journalState.message} {journalState.status === "saved" ? <a href="/journal?market=crypto" className="underline">복기 보기</a> : null}
          </p>
        ) : null}
      </section>

      <PerpetualMonitorManager
        accessToken={session?.accessToken}
        refreshKey={monitorRefreshKey}
        onUsageChange={handleMonitorUsageChange}
      />

      <section className="bg-ui-panel px-3 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[0.12em] text-ui-subtle">가격 확인</p><h2 className="mt-1 text-lg font-black text-ui-text">동일 snapshot의 조건선만 확인합니다</h2></div>
          <StatusPill tone="watch">15분</StatusPill>
        </div>
        <div className="mt-3"><PerpetualDecisionChart snapshot={displaySnapshot} /></div>
      </section>

      {state.status === "error" ? (
        <section className="bg-ui-panel px-3 py-4 text-sm leading-6 text-ui-muted sm:px-5">
          확인·판단 변경 조건은 필수 데이터가 다시 정상화된 뒤 표시합니다.
        </section>
      ) : displaySnapshot.pro ? (
        <section className="bg-ui-panel px-3 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[10px] font-black uppercase tracking-[0.12em] text-ui-brand">Coin Pro</p><h2 className="mt-1 text-lg font-black text-ui-text">확인·판단 변경 조건과 근거</h2></div>
            <StatusPill tone="long" icon={ShieldAlert}>{capabilities.activeMonitorCount}/{capabilities.monitorLimit}</StatusPill>
          </div>
          <div className="mt-3 divide-y divide-ui-line border-y border-ui-line">
            {conditions.slice(1).map((condition) => (
              <div key={condition.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-xs font-black text-ui-text">{condition.role === "confirmation" ? "추가 확인" : "판단 변경 기준"}</p><p className="mt-1 text-xs leading-5 text-ui-muted">{condition.label}</p></div>
                <MonitorAction condition={condition} capabilities={capabilities} monitorState={monitorState} onCreate={createMonitor} isAuthenticated={Boolean(session)} actionable={monitorActionable} snapshotId={displaySnapshot.id} />
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {displaySnapshot.pro.multiTimeframeEvidence.map((evidence) => (
              <div key={evidence.timeframe} className="bg-ui-inset/55 px-3 py-3">
                <p className="text-xs font-black text-ui-text">{evidence.label}</p>
                <p className="mt-1 text-[11px] leading-5 text-ui-muted">구조 {evidence.structure} · 전환 {evidence.transition} · {evidence.regime}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-2 text-xs leading-5 text-ui-muted md:grid-cols-2">
            <p>{displaySnapshot.pro.pressure?.summary ?? "청산 압력 근거가 부족합니다."}</p>
            <p>{displaySnapshot.pro.flow?.summary ?? "큰 체결 근거가 부족합니다."}</p>
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-3 bg-ui-panel px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div><p className="text-[10px] font-black uppercase tracking-[0.12em] text-ui-brand">Coin Pro</p><h2 className="mt-1 text-base font-black text-ui-text">확인·판단 변경 조건을 저장하고 알림·복기로 이어갑니다</h2><p className="mt-1 text-xs leading-5 text-ui-muted">현재 상태는 Basic에서도 확인할 수 있고, Pro는 최대 20개 조건을 최대 5분 간격으로 감시합니다.</p></div>
          <ActionButton href="/pro?market=crypto&source=perpetual" tone="primary" className="w-full sm:w-auto">Pro 기준 보기</ActionButton>
        </section>
      )}

      {state.status === "error" ? (
        <div role="alert" className="flex items-center justify-between gap-3 bg-ui-risk/10 px-3 py-2 text-xs font-semibold text-ui-risk">
          <span>최신 갱신에 실패해 마지막 정상 snapshot은 맥락용으로만 표시합니다.</span>
          <button type="button" onClick={() => void load()} className="shrink-0 underline">다시 시도</button>
        </div>
      ) : null}
    </div>
  );
}
