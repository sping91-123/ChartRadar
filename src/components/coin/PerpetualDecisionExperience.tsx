"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, Bell, BookOpen, CheckCircle2, Clock3, Database, History, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { PerpetualDecisionChart } from "@/components/coin/PerpetualDecisionChart";
import { PerpetualEvidenceWorkbench } from "@/components/coin/PerpetualEvidenceWorkbench";
import { PerpetualMonitorManager } from "@/components/coin/PerpetualMonitorManager";
import { NewsImpactContextCard } from "@/components/news/NewsImpactContextCard";
import { PerpetualNewsContextStrip } from "@/components/news/PerpetualNewsContextStrip";
import { ActionButton, StatusPill } from "@/components/ui/DesignPrimitives";
import { withSupabaseAuth } from "@/lib/authFetch";
import { appendJournalEntry, decisionJournalContextFromSnapshot } from "@/lib/journal";
import { readPerpetualAlertContext } from "@/lib/perpetualAlertContext";
import { decisionStateLabel, flowDirectionLabel, monitorConditionHeading, plainDirection, pressureDirectionLabel, qualityLabel } from "@/lib/perpetualDecisionCopy";
import { isPerpetualSnapshotScopedStateCurrent, journalMonitorIdForSnapshot } from "@/lib/perpetualMonitor";
import type { CryptoHomeTicker } from "@/lib/server/cryptoExchangeData";
import type { MonitorCondition, PerpetualAsset, PerpetualDecisionSnapshot } from "@/lib/perpetualDecisionSnapshot";
import type { NewsDecisionContext } from "@/lib/newsImpact";
import type { PerpetualSnapshotCapabilities, PerpetualSnapshotResponse } from "@/lib/perpetualApi";
import {
  buildStalePerpetualDecisionFallback,
  PERPETUAL_SNAPSHOT_REQUEST_TIMEOUT_MS,
  perpetualSnapshotRefreshDelay,
  shouldContinuePerpetualSnapshotRefresh
} from "@/lib/perpetualSnapshotContinuity";
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
  | { status: "saving"; conditionId: string; snapshotId: string }
  | { status: "saved"; conditionId: string; monitorId: string; snapshotId: string; message: string }
  | { status: "error"; conditionId: string; snapshotId: string; message: string };

type JournalState =
  | { status: "idle" }
  | { status: "saving"; snapshotId: string }
  | { status: "saved"; snapshotId: string; message: string }
  | { status: "error"; snapshotId: string; message: string };

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
  snapshotId,
  upgradeHref
}: {
  condition: MonitorCondition;
  capabilities: PerpetualSnapshotCapabilities;
  monitorState: MonitorState;
  onCreate: (condition: MonitorCondition) => void;
  isAuthenticated: boolean;
  actionable: boolean;
  snapshotId: string;
  upgradeHref: string;
}) {
  const operationBusy = monitorState.status === "saving";
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
    return <ActionButton href={upgradeHref} tone="secondary" className="w-full sm:w-auto">Coin Pro 감시 한도 보기</ActionButton>;
  }

  return (
    <ActionButton
      tone={saved ? "secondary" : "primary"}
      disabled={disabled || operationBusy || saved}
      onClick={() => onCreate(condition)}
      className="w-full sm:w-auto"
    >
      {operationBusy ? <Loader2 className="animate-spin" size={15} aria-hidden /> : saved ? <CheckCircle2 size={15} aria-hidden /> : <Bell size={15} aria-hidden />}
      {operationBusy ? "조건 저장 중" : saved ? "감시 저장됨" : capabilities.setupRequired ? "저장소 준비 필요" : !actionable ? "데이터 정상화 후 가능" : "이 조건 감시하기"}
    </ActionButton>
  );
}

export function PerpetualDecisionExperience({
  asset,
  requestedSnapshotId,
  source,
  attributionId,
  impactId,
  initialAlertMonitorId
}: {
  asset: PerpetualAsset;
  requestedSnapshotId?: string | null;
  source?: "home" | "alert" | "news" | null;
  attributionId?: string | null;
  impactId?: string | null;
  initialAlertMonitorId?: string | null;
}) {
  const { session } = useSupabaseAuth();
  const [state, setState] = useState<DecisionLoadState>({ status: "loading", snapshot: null, capabilities: null, continuity: null });
  const [monitorState, setMonitorState] = useState<MonitorState>({ status: "idle" });
  const [journalState, setJournalState] = useState<JournalState>({ status: "idle" });
  const [alertMonitorId, setAlertMonitorId] = useState<string | null>(null);
  const [effectiveSource, setEffectiveSource] = useState<"home" | "alert" | "news" | null>(source ?? null);
  const [newsContext, setNewsContext] = useState<NewsDecisionContext | null>(null);
  const [monitorRefreshKey, setMonitorRefreshKey] = useState(0);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const generationRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const initialRequestRef = useRef(requestedSnapshotId ?? null);
  const effectiveSourceRef = useRef<"home" | "alert" | "news" | null>(source ?? null);
  const trackedViewRef = useRef(false);
  const trackedGateRef = useRef(false);

  useEffect(() => {
    initialRequestRef.current = requestedSnapshotId ?? null;
    effectiveSourceRef.current = source ?? null;
    setEffectiveSource(source ?? null);
    setAlertMonitorId(null);
    setNewsContext(null);
    trackedViewRef.current = false;
    trackedGateRef.current = false;
  }, [asset, requestedSnapshotId, source, impactId]);

  const load = useCallback(async (silent = false) => {
    const generation = ++generationRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, PERPETUAL_SNAPSHOT_REQUEST_TIMEOUT_MS);
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
      if (requestSource === "alert" || requestSource === "news") params.set("source", requestSource);
      if (requestSource === "news" && impactId) params.set("impact", impactId);
      const response = await fetch(`/api/crypto/perpetual/snapshot?${params.toString()}`, await withSupabaseAuth({ cache: "no-store", signal: controller.signal }));
      const payload = (await response.json().catch(() => ({}))) as PerpetualSnapshotResponse;
      if (!response.ok || !payload.snapshot || !payload.capabilities || !payload.continuity) {
        throw new Error(payload.error ?? "선물 시장 분석을 불러오지 못했습니다.");
      }
      if (controller.signal.aborted || generation !== generationRef.current) return null;
      const nextSnapshot = payload.snapshot;
      const nextCapabilities = payload.capabilities;
      const nextContinuity = payload.continuity;
      const exactLinkedContext = nextContinuity.status === "same";
      const nextEffectiveSource = requestSource === "news"
        ? exactLinkedContext && payload.newsContext ? "news" : null
        : requestSource === "alert"
          ? exactLinkedContext ? "alert" : null
          : requestSource;
      initialRequestRef.current = nextSnapshot.id;
      effectiveSourceRef.current = nextEffectiveSource;
      setEffectiveSource(nextEffectiveSource);
      setNewsContext(nextEffectiveSource === "news" ? payload.newsContext ?? null : null);
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
      if (nextEffectiveSource === "alert" && initialAlertMonitorId) url.searchParams.set("monitor", initialAlertMonitorId);
      else if (nextEffectiveSource !== "alert") url.searchParams.delete("monitor");
      if (nextEffectiveSource === "news" && payload.newsContext) url.searchParams.set("impact", payload.newsContext.reactionId);
      else url.searchParams.delete("impact");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      return nextSnapshot;
    } catch (error) {
      if (generation !== generationRef.current || (controller.signal.aborted && !timedOut)) return null;
      setState((current) => ({
        status: "error",
        snapshot: current.snapshot,
        capabilities: current.capabilities,
        continuity: current.continuity,
        message: error instanceof Error ? error.message : "선물 시장 분석을 불러오지 못했습니다."
      }));
      return null;
    } finally {
      window.clearTimeout(timeout);
    }
  }, [asset, impactId, initialAlertMonitorId]);

  useEffect(() => {
    setMonitorState({ status: "idle" });
    let cancelled = false;
    let timer: number | undefined;
    async function refresh(silent: boolean) {
      const nextSnapshot = await load(silent);
      if (cancelled) return;
      if (!shouldContinuePerpetualSnapshotRefresh(
        nextSnapshot?.expiresAt,
        effectiveSourceRef.current === "alert" || effectiveSourceRef.current === "news"
      )) return;
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
    const storedContext = source === "alert"
      ? readPerpetualAlertContext(requestedSnapshotId ?? snapshot.id)
      : null;
    // The server-validated URL identifies the alert the user actually opened.
    // Session storage is only a fallback for older links without a monitor ID.
    const linkedMonitorId = initialAlertMonitorId ?? storedContext?.monitorId ?? null;
    const linkedSnapshotId = storedContext?.snapshotId ?? requestedSnapshotId ?? snapshot.id;
    const scenarioOpened = source === "alert" && Boolean(linkedMonitorId);
    setAlertMonitorId(exactAlertContext ? linkedMonitorId : null);
    if (!trackedViewRef.current) {
      trackedViewRef.current = true;
      void trackProductEvent({
        eventName: scenarioOpened ? "scenario_opened" : "perpetual_snapshot_viewed",
        surface: "perpetual",
        asset: snapshot.asset,
        snapshotId: scenarioOpened ? linkedSnapshotId : snapshot.id,
        monitorId: linkedMonitorId ?? undefined,
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
  }, [attributionId, effectiveSource, exactAlertContext, initialAlertMonitorId, requestedSnapshotId, snapshot, source, state.continuity?.status]);
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
    const monitorSnapshotId = snapshot.id;
    setMonitorState({ status: "saving", conditionId: condition.id, snapshotId: monitorSnapshotId });
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
      setMonitorState({ status: "error", conditionId: condition.id, snapshotId: monitorSnapshotId, message: error instanceof Error ? error.message : "조건 감시를 저장하지 못했습니다." });
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
    const journalSnapshotId = snapshot.id;
    const monitorId = journalMonitorIdForSnapshot(
      journalSnapshotId,
      monitorState.status === "saved"
        ? { monitorId: monitorState.monitorId, snapshotId: monitorState.snapshotId }
        : null,
      alertMonitorId,
      exactAlertContext
    );
    const exactNewsContext = effectiveSource === "news" && newsContext !== null && newsContext.evaluatedSnapshotId === snapshot.id;
    const canSaveExactNewsContext = exactNewsContext && Boolean(state.capabilities?.canSaveNewsJournal);
    const journalSource = canSaveExactNewsContext ? "news" : exactAlertContext ? "alert" : "snapshot";
    setJournalState({ status: "saving", snapshotId: journalSnapshotId });
    try {
      const response = await fetch(
        "/api/crypto/perpetual/journal",
        await withSupabaseAuth({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            snapshotId: snapshot.id,
            monitorId,
            source: journalSource,
            ...(canSaveExactNewsContext ? { reactionId: newsContext?.reactionId } : {})
          })
        })
      );
      const payload = (await response.json().catch(() => ({}))) as { journal?: { id: string }; error?: string };
      if (!response.ok) {
        throw new JournalRouteError(payload.error ?? "판단 기록을 저장하지 못했습니다.", response.status >= 500);
      }
      if (!payload.journal) throw new JournalRouteError("판단 기록 저장 응답을 확인하지 못했습니다.", false);
      setJournalState({ status: "saved", snapshotId: journalSnapshotId, message: "지금 보고 있는 분석을 판단 기록에 저장했습니다." });
    } catch (error) {
      if (journalSource === "news") {
        setJournalState({
          status: "error",
          snapshotId: journalSnapshotId,
          message: error instanceof Error ? error.message : "뉴스 발표와 연결된 판단 기록을 저장하지 못했습니다. 연결이 복구된 뒤 다시 시도해 주세요."
        });
        return;
      }
      if (error instanceof JournalRouteError && !error.allowLocalFallback) {
        setJournalState({ status: "error", snapshotId: journalSnapshotId, message: error.message });
        return;
      }
      if (monitorId) {
        setJournalState({
          status: "error",
          snapshotId: journalSnapshotId,
          message: "실제로 감시한 조건을 정확히 남기려면 서버 연결이 필요합니다. 연결이 복구된 뒤 다시 저장해 주세요."
        });
        return;
      }
      try {
        appendJournalEntry({
          title: `${snapshot.symbol} 선물 시장 분석`,
          bias: decisionStateLabel(snapshot.summary.state),
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
        setJournalState({ status: "saved", snapshotId: journalSnapshotId, message: "서버 연결이 불안정해 이 기기에 아직 동기화되지 않은 판단 기록으로 보관했습니다." });
      } catch {
        setJournalState({ status: "error", snapshotId: journalSnapshotId, message: error instanceof Error ? error.message : "판단 기록을 저장하지 못했습니다." });
      }
    }
  }, [alertMonitorId, effectiveSource, exactAlertContext, monitorState, newsContext, session, snapshot, state.capabilities?.canSaveNewsJournal]);

  if (!snapshot && state.status === "loading") {
    return (
      <section className="bg-ui-panel px-4 py-5" aria-busy="true" aria-label="선물 시장 분석을 불러오는 중">
        <div className="flex items-center justify-between gap-3 text-sm font-semibold text-ui-muted">
          <span>Home에서 본 것과 같은 분석을 확인하고 있습니다.</span>
          <Loader2 className="shrink-0 animate-spin text-ui-brand" size={18} aria-hidden />
        </div>
        <div className="mt-5 h-8 w-5/6 animate-pulse bg-ui-inset" />
        <div className="mt-2 h-8 w-2/3 animate-pulse bg-ui-inset" />
        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="min-h-24 animate-pulse bg-ui-risk/10 px-3 py-3 text-xs font-bold text-ui-risk">가장 큰 위험 확인 중</div>
          <div className="min-h-24 animate-pulse bg-ui-brand/8 px-3 py-3 text-xs font-bold text-ui-brand">확인할 가격 계산 중</div>
        </div>
      </section>
    );
  }

  if (!snapshot || !state.capabilities) {
    return (
      <section className="bg-ui-panel px-4 py-6">
        <p className="text-base font-black text-ui-text">선물 시장 분석을 불러오지 못했습니다.</p>
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
  const currentJournalState = journalState.status === "idle" || isPerpetualSnapshotScopedStateCurrent(
    displaySnapshot.id,
    journalState
  ) ? journalState : { status: "idle" } as const;
  const currentMonitorState = monitorState.status === "idle" || isPerpetualSnapshotScopedStateCurrent(
    displaySnapshot.id,
    monitorState
  ) ? monitorState : { status: "idle" } as const;
  const quickEvidence = displaySnapshot.publicEvidence;
  const analysisReturnTo = `/crypto/perpetual?asset=${asset}&timeframe=15m&snapshot=${encodeURIComponent(displaySnapshot.id)}`;
  const monitorUpgradeHref = `/pro?market=crypto&source=perpetual-monitor&returnTo=${encodeURIComponent(analysisReturnTo)}`;
  const savesNewsContext = effectiveSource === "news" && newsContext?.evaluatedSnapshotId === displaySnapshot.id && Boolean(capabilities.canSaveNewsJournal);
  const savesSnapshotWithoutNews = effectiveSource === "news" && Boolean(newsContext) && !savesNewsContext;

  return (
    <div className="space-y-3">
      {continuityRefreshed ? (
        <div className="flex items-start gap-2 bg-ui-watch/10 px-3 py-2 text-xs font-semibold leading-5 text-ui-watch">
          <History size={15} className="mt-0.5 shrink-0" aria-hidden />
          {source === "alert"
            ? "알림을 받았던 당시 분석이 만료되어 최신 분석으로 바꿨습니다. 확인 가격을 다시 봐주세요."
            : source === "news"
              ? "뉴스에서 연결한 당시 분석이 만료되어 최신 분석으로 바꿨습니다. 다른 시점의 뉴스 해석은 자동으로 섞지 않았습니다."
              : "Home에서 본 뒤 시장 데이터가 달라져 최신 분석으로 바꿨습니다. 확인 가격을 다시 봐주세요."}
        </div>
      ) : null}

      <section className="bg-ui-panel px-3 py-4 sm:px-5" aria-labelledby="perpetual-decision-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-ui-subtle">{assetSymbols[asset].label} · 바이낸스 만기 없는 선물 · 15분 흐름 기준</p>
            <p className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-semibold text-ui-muted"><Clock3 size={12} aria-hidden /> {formatAsOf(displaySnapshot.generatedAt)} 기준 분석</p>
          </div>
          <div className="flex gap-1">
            <StatusPill tone={displayQuality === "ready" ? "long" : "risk"} icon={Database}>{qualityLabel(displayQuality)}</StatusPill>
            <StatusPill tone={decisionTone(displaySnapshot.summary.state)} icon={Activity}>{decisionStateLabel(displaySnapshot.summary.state)}</StatusPill>
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
            <p className="text-[10px] font-black uppercase tracking-[0.1em] text-ui-brand">{monitorConditionHeading(displaySnapshot.summary.primaryCondition)}</p>
            <p className="mt-1 text-sm font-black leading-6 text-ui-text [word-break:keep-all]">{displaySnapshot.summary.primaryCondition.label}</p>
          </div>
        </div>

        <ul className="mt-3 grid gap-1.5 text-xs font-semibold leading-5 text-ui-muted md:grid-cols-2">
          {displaySnapshot.summary.reasons.map((reason) => <li key={reason}>· {reason}</li>)}
        </ul>

        <div className="mt-3 flex flex-col gap-2 border-t border-ui-line pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="order-2 text-xs leading-5 text-ui-muted sm:order-1">알림은 주문을 실행하지 않습니다. 선택한 가격 조건을 최대 5분마다 확인합니다.</p>
          <div className="order-1 flex flex-col gap-2 sm:order-2 sm:flex-row">
            <MonitorAction condition={displaySnapshot.summary.primaryCondition} capabilities={capabilities} monitorState={monitorState} onCreate={createMonitor} isAuthenticated={Boolean(session)} actionable={monitorActionable} snapshotId={displaySnapshot.id} upgradeHref={monitorUpgradeHref} />
            {session ? (
              <ActionButton
                tone="secondary"
                disabled={state.status === "error" || journalState.status === "saving" || currentJournalState.status === "saved"}
                onClick={() => void saveJournal()}
                className="w-full sm:w-auto"
              >
                {journalState.status === "saving" ? <Loader2 className="animate-spin" size={15} aria-hidden /> : <BookOpen size={15} aria-hidden />}
                {journalState.status === "saving" ? "판단 기록 저장 중" : currentJournalState.status === "saved" ? "판단 기록 저장됨" : savesSnapshotWithoutNews ? "선물 판단만 저장" : "판단 기록에 저장"}
              </ActionButton>
            ) : null}
          </div>
        </div>
        {savesSnapshotWithoutNews ? <p className="mt-2 text-[11px] font-semibold leading-5 text-ui-watch">현재 플랜에서는 선물 분석만 저장됩니다. 공식 뉴스와 발표 전후 비교까지 함께 복기하는 기능은 Coin Pro에서 열립니다.</p> : null}

        {quickEvidence ? (
          <div className="mt-3 grid grid-cols-2 gap-1.5 border-t border-ui-line pt-3 sm:grid-cols-4" aria-label="현재 판단 근거 요약">
            <p className="bg-ui-inset/45 px-2.5 py-2 text-[10.5px] text-ui-muted"><span className="block font-black text-ui-text">추세 확인(MSB)</span>{plainDirection(quickEvidence.structure)}</p>
            <p className="bg-ui-inset/45 px-2.5 py-2 text-[10.5px] text-ui-muted"><span className="block font-black text-ui-text">흐름 전환(CHoCH)</span>{plainDirection(quickEvidence.transition)}</p>
            <p className="bg-ui-inset/45 px-2.5 py-2 text-[10.5px] text-ui-muted"><span className="block font-black text-ui-text">몰린 포지션</span>{quickEvidence.pressure ? pressureDirectionLabel(quickEvidence.pressure.dominantSide) : "확인 중"}</p>
            <p className="bg-ui-inset/45 px-2.5 py-2 text-[10.5px] text-ui-muted"><span className="block font-black text-ui-text">큰 금액 체결</span>{quickEvidence.flow ? flowDirectionLabel(quickEvidence.flow.dominantSide) : "확인 중"}</p>
          </div>
        ) : null}
        {currentMonitorState.status === "saved" || currentMonitorState.status === "error" ? (
          <p role={currentMonitorState.status === "error" ? "alert" : "status"} aria-live="polite" className={`mt-2 text-xs font-semibold ${currentMonitorState.status === "saved" ? "text-ui-long" : "text-ui-risk"}`}>{currentMonitorState.message}</p>
        ) : null}
        {currentJournalState.status === "saved" || currentJournalState.status === "error" ? (
          <p role={currentJournalState.status === "error" ? "alert" : "status"} aria-live="polite" className={`mt-2 text-xs font-semibold ${currentJournalState.status === "saved" ? "text-ui-long" : "text-ui-risk"}`}>
            {currentJournalState.message} {currentJournalState.status === "saved" ? <a href="/journal?market=crypto" className="underline">저장한 판단 보기</a> : null}
          </p>
        ) : null}
      </section>

      {newsContext ? <NewsImpactContextCard context={newsContext} /> : null}
      {!newsContext ? <PerpetualNewsContextStrip asset={asset} snapshotId={displaySnapshot.id} /> : null}

      <section className="bg-ui-panel px-3 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[0.12em] text-ui-subtle">가격 흐름</p><h2 className="mt-1 text-lg font-black text-ui-text">차트에서 흐름과 확인 가격을 같이 보세요</h2><p className="mt-1 text-xs leading-5 text-ui-muted">{displaySnapshot.pro ? "지금 분석에 사용한 15분 차트 위에 추세 확인·전환 신호와 중요한 가격을 표시합니다." : "지금 분석에 사용한 15분 봉과 먼저 확인할 가격을 함께 표시합니다."}</p></div>
          <StatusPill tone="watch">15분</StatusPill>
        </div>
        <div className="mt-3"><PerpetualDecisionChart snapshot={displaySnapshot} /></div>
      </section>

      <PerpetualEvidenceWorkbench snapshot={displaySnapshot} />

      {state.status === "error" ? (
        <section className="bg-ui-panel px-3 py-4 text-sm leading-6 text-ui-muted sm:px-5">
          확인·판단 변경 조건은 필수 데이터가 다시 정상화된 뒤 표시합니다.
        </section>
      ) : displaySnapshot.pro ? (
        <section className="bg-ui-panel px-3 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[10px] font-black uppercase tracking-[0.12em] text-ui-brand">Coin Pro</p><h2 className="mt-1 text-lg font-black text-ui-text">어떤 경우에 현재 해석이 더 강해지거나 바뀌나요?</h2><p className="mt-1 text-xs leading-5 text-ui-muted">원하는 가격 조건을 저장하면 최대 5분 간격으로 확인해 알려드립니다.</p></div>
            <StatusPill tone="long" icon={ShieldAlert}>{capabilities.activeMonitorCount}/{capabilities.monitorLimit}</StatusPill>
          </div>
          <div className="mt-3 divide-y divide-ui-line border-y border-ui-line">
            {conditions.slice(1).map((condition) => (
              <div key={condition.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-xs font-black text-ui-text">{condition.role === "confirmation" ? "흐름이 더 강해지는 확인 가격" : "이 조건이 나오면 해석을 다시 봐야 해요"}</p><p className="mt-1 text-xs leading-5 text-ui-muted">{condition.label}</p></div>
                <MonitorAction condition={condition} capabilities={capabilities} monitorState={monitorState} onCreate={createMonitor} isAuthenticated={Boolean(session)} actionable={monitorActionable} snapshotId={displaySnapshot.id} upgradeHref={monitorUpgradeHref} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <PerpetualMonitorManager
        accessToken={session?.accessToken}
        refreshKey={monitorRefreshKey}
        onUsageChange={handleMonitorUsageChange}
      />

      {state.status === "error" ? (
        <div role="alert" className="flex items-center justify-between gap-3 bg-ui-risk/10 px-3 py-2 text-xs font-semibold text-ui-risk">
          <span>최신 갱신에 실패해 마지막 정상 분석을 참고용으로 보여드립니다.</span>
          <button type="button" onClick={() => void load()} className="shrink-0 underline">다시 시도</button>
        </div>
      ) : null}
    </div>
  );
}
