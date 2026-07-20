"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, ArrowRight, ChevronDown, Clock3, Database, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { CoinRadarHomePanel } from "@/components/coin/CoinRadarHomePanel";
import { HomeInterestCoinPrices } from "@/components/coin/HomeInterestCoinPrices";
import { PerpetualDecisionChart } from "@/components/coin/PerpetualDecisionChart";
import { MacroTicker } from "@/components/MacroTicker";
import { ActionButton, StatusPill } from "@/components/ui/DesignPrimitives";
import { withSupabaseAuth } from "@/lib/authFetch";
import type { CryptoHomeTicker } from "@/lib/server/cryptoExchangeData";
import type { PerpetualAsset, PerpetualDecisionSnapshot, SnapshotQuality } from "@/lib/perpetualDecisionSnapshot";
import type { PerpetualSnapshotCapabilities, PerpetualSnapshotResponse } from "@/lib/perpetualApi";
import { comparePerpetualShadowDecision, type LegacyPerpetualDirection } from "@/lib/perpetualShadowComparison";
import {
  buildStalePerpetualDecisionFallback,
  PERPETUAL_SNAPSHOT_REQUEST_TIMEOUT_MS,
  perpetualSnapshotRefreshDelay
} from "@/lib/perpetualSnapshotContinuity";
import type { PerpetualRevenueCoreMode } from "@/lib/server/perpetualRevenueCore";
import { trackProductEvent } from "@/lib/trackProductEvent";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

type LoadState =
  | { status: "loading"; snapshot: null; capabilities: null }
  | { status: "ready"; snapshot: PerpetualDecisionSnapshot; capabilities: PerpetualSnapshotCapabilities; warning?: string }
  | { status: "error"; snapshot: PerpetualDecisionSnapshot | null; capabilities: PerpetualSnapshotCapabilities | null; message: string };

const assetCopy = {
  btc: { label: "BTC", symbol: "BTC/USDT:USDT" },
  eth: { label: "ETH", symbol: "ETH/USDT:USDT" }
} as const;

function qualityCopy(quality: SnapshotQuality) {
  if (quality === "ready") return { label: "데이터 정상", tone: "long" as const };
  if (quality === "partial") return { label: "일부 근거 부족", tone: "watch" as const };
  if (quality === "stale") return { label: "갱신 지연", tone: "risk" as const };
  return { label: "데이터 확인 필요", tone: "risk" as const };
}

function stateCopy(state: PerpetualDecisionSnapshot["summary"]["state"]) {
  if (state === "upside_watch") return { label: "상방 확인 중", tone: "long" as const };
  if (state === "downside_watch") return { label: "하방 확인 중", tone: "short" as const };
  if (state === "risk") return { label: "리스크 우선", tone: "risk" as const };
  return { label: "범위 확인", tone: "watch" as const };
}

function formatAsOf(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "시각 확인 필요";
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function formatPrice(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: value >= 10_000 ? 0 : 2 });
}

async function requestSnapshot(asset: PerpetualAsset, signal?: AbortSignal) {
  const response = await fetch(
    `/api/crypto/perpetual/snapshot?asset=${asset}`,
    await withSupabaseAuth({ cache: "no-store", signal })
  );
  const payload = (await response.json().catch(() => ({}))) as PerpetualSnapshotResponse;
  if (!response.ok || !payload.snapshot || !payload.capabilities) {
    throw new Error(payload.error ?? "선물 판단 스냅샷을 불러오지 못했습니다.");
  }
  return { snapshot: payload.snapshot, capabilities: payload.capabilities };
}

function SnapshotShadowProbe() {
  useEffect(() => {
    const controller = new AbortController();
    async function compareAsset(asset: PerpetualAsset) {
      const legacyParams = new URLSearchParams({ exchange: "binance", symbol: assetCopy[asset].symbol });
      const [current, legacyResponse] = await Promise.all([
        requestSnapshot(asset, controller.signal),
        fetch(`/api/crypto-home-snapshot?${legacyParams.toString()}`, { cache: "no-store", signal: controller.signal })
      ]);
      const legacyPayload = (await legacyResponse.json().catch(() => ({}))) as {
        snapshot?: { direction?: LegacyPerpetualDirection };
      };
      if (!legacyResponse.ok) throw new Error("Legacy shadow snapshot unavailable.");
      const agreement = comparePerpetualShadowDecision({
        quality: current.snapshot.quality,
        state: current.snapshot.summary.state,
        legacyDirection: legacyPayload.snapshot?.direction
      });
      await trackProductEvent({
        eventName: "home_snapshot_viewed",
        surface: "home",
        asset,
        snapshotId: current.snapshot.id,
        properties: { quality: current.snapshot.quality, mode: "shadow", agreement }
      });
    }
    void Promise.allSettled([compareAsset("btc"), compareAsset("eth")]);
    return () => controller.abort();
  }, []);
  return null;
}

function MarketWatchDisclosure() {
  const [opened, setOpened] = useState(false);
  return (
    <details
      className="group border-t border-ui-line pt-3"
      onToggle={(event) => setOpened(event.currentTarget.open)}
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-2 marker:hidden [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-sm font-black text-ui-text">관심코인 시세</span>
          <span className="mt-0.5 block text-xs leading-5 text-ui-muted">다른 거래소와 알트는 시장 관찰용이며 BTC·ETH 유료 판단과 분리됩니다.</span>
        </span>
        <ChevronDown size={18} className="shrink-0 text-ui-subtle transition group-open:rotate-180" aria-hidden />
      </summary>
      {opened ? <HomeInterestCoinPrices /> : null}
    </details>
  );
}

function HomeDecisionHero() {
  const { session } = useSupabaseAuth();
  const [asset, setAsset] = useState<PerpetualAsset>("btc");
  const [state, setState] = useState<LoadState>({ status: "loading", snapshot: null, capabilities: null });
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [journeyId, setJourneyId] = useState<string | null>(null);
  const requestGeneration = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const trackedAssetRef = useRef<PerpetualAsset | null>(null);

  const load = useCallback(async (nextAsset: PerpetualAsset, silent = false) => {
    const generation = ++requestGeneration.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, PERPETUAL_SNAPSHOT_REQUEST_TIMEOUT_MS);
    if (!silent) setState({ status: "loading", snapshot: null, capabilities: null });
    try {
      const result = await requestSnapshot(nextAsset, controller.signal);
      if (controller.signal.aborted || generation !== requestGeneration.current) return null;
      setState({
        status: "ready",
        snapshot: result.snapshot,
        capabilities: result.capabilities
      });
      return result.snapshot;
    } catch (error) {
      if (generation !== requestGeneration.current || (controller.signal.aborted && !timedOut)) return null;
      setState((current) => ({
        status: "error",
        snapshot: current.snapshot,
        capabilities: current.capabilities,
        message: error instanceof Error ? error.message : "선물 판단 스냅샷을 불러오지 못했습니다."
      }));
      return null;
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  const selectAsset = useCallback((nextAsset: PerpetualAsset) => {
    if (nextAsset === asset) return;
    requestGeneration.current += 1;
    abortRef.current?.abort();
    setState({ status: "loading", snapshot: null, capabilities: null });
    setLivePrice(null);
    setEvidenceOpen(false);
    setAsset(nextAsset);
  }, [asset]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    async function refresh(silent: boolean) {
      const nextSnapshot = await load(asset, silent);
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
      requestGeneration.current += 1;
      abortRef.current?.abort();
    };
  }, [asset, load, session?.accessToken]);

  const snapshot = state.snapshot;
  useEffect(() => {
    setJourneyId(session?.accessToken ? crypto.randomUUID() : null);
  }, [asset, session?.accessToken, snapshot?.id]);
  useEffect(() => {
    if (!snapshot || trackedAssetRef.current === snapshot.asset) return;
    trackedAssetRef.current = snapshot.asset;
    void trackProductEvent({
      eventName: "home_snapshot_viewed",
      surface: "home",
      asset: snapshot.asset,
      snapshotId: snapshot.id,
      properties: { quality: snapshot.quality, mode: "on" }
    });
  }, [snapshot]);
  useEffect(() => {
    if (!snapshot) return;
    let cancelled = false;
    async function tick() {
      try {
        const params = new URLSearchParams({ exchange: "binance", symbol: assetCopy[asset].symbol });
        const response = await fetch(`/api/crypto-home-ticker?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json()) as { ticker?: CryptoHomeTicker };
        if (!cancelled && response.ok && payload.ticker?.price) setLivePrice(payload.ticker.price);
      } catch {
        // Snapshot price remains visible when the lightweight ticker is unavailable.
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

  if (!snapshot && state.status === "loading") {
    return (
      <section className="min-h-[330px] bg-ui-panel px-4 py-5" aria-busy="true">
        <div className="flex items-center gap-2 text-sm font-semibold text-ui-muted">
          <Loader2 className="animate-spin text-ui-brand" size={18} aria-hidden />
          BTC·ETH 선물 상태와 위험을 같은 시점으로 묶는 중입니다.
        </div>
      </section>
    );
  }

  if (!snapshot) {
    return (
      <section className="bg-ui-panel px-4 py-5">
        <p className="text-base font-black text-ui-text">선물 판단 스냅샷을 준비하지 못했습니다.</p>
        <p className="mt-2 text-sm leading-6 text-ui-muted">{state.status === "error" ? state.message : "잠시 뒤 다시 확인해 주세요."}</p>
        <ActionButton tone="secondary" className="mt-4" onClick={() => void load(asset)}>
          <RefreshCw size={15} aria-hidden /> 다시 불러오기
        </ActionButton>
      </section>
    );
  }

  const displaySnapshot = state.status === "error"
    ? buildStalePerpetualDecisionFallback(snapshot)
    : snapshot;
  const displayQuality: SnapshotQuality = displaySnapshot.quality;
  const quality = qualityCopy(displayQuality);
  const decision = stateCopy(displaySnapshot.summary.state);
  const capabilities = state.capabilities;
  const detailHref = `/crypto/perpetual?asset=${asset}&timeframe=15m&snapshot=${encodeURIComponent(displaySnapshot.id)}&source=home${journeyId ? `&attribution=${encodeURIComponent(journeyId)}` : ""}`;

  return (
    <section className="bg-ui-panel px-3 py-3 sm:px-4 sm:py-4" aria-labelledby="home-decision-title">
      <div className="flex items-center justify-between gap-2">
        <div className="grid grid-cols-2 gap-1 rounded-ui-sm bg-ui-inset p-1" role="group" aria-label="선물 판단 자산">
          {(["btc", "eth"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => selectAsset(item)}
              aria-pressed={asset === item}
              className={`min-h-9 rounded-ui-sm px-4 text-xs font-black transition ${asset === item ? "bg-ui-brand text-white" : "text-ui-muted hover:text-ui-text"}`}
            >
              {assetCopy[item].label}
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-wrap justify-end gap-1">
          <StatusPill tone={quality.tone} icon={quality.tone === "long" ? ShieldCheck : Database} className="min-h-7 text-[10px]">
            {quality.label}
          </StatusPill>
          <StatusPill tone={decision.tone} icon={Activity} className="min-h-7 text-[10px]">
            {decision.label}
          </StatusPill>
        </div>
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ui-subtle">Binance USDT-M · 15분 확정 기준</p>
          <h1 id="home-decision-title" className="mt-1 text-[1.35rem] font-black leading-7 tracking-tight text-ui-text [word-break:keep-all]">
            {displaySnapshot.summary.headline}
          </h1>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xl font-black tabular-nums text-ui-text">{formatPrice(livePrice ?? displaySnapshot.price)}</p>
          <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-ui-subtle">
            <Clock3 size={11} aria-hidden /> 판단 {formatAsOf(displaySnapshot.generatedAt)}
          </p>
        </div>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="bg-ui-risk/10 px-3 py-2.5">
          <p className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.1em] text-ui-risk">
            <AlertTriangle size={12} aria-hidden /> 가장 큰 위험
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-ui-text [word-break:keep-all]">{displaySnapshot.summary.topRisk}</p>
        </div>
        <div className="bg-ui-inset/65 px-3 py-2.5">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-ui-brand">다음 확인 조건</p>
          <p className="mt-1 text-xs font-black leading-5 text-ui-text [word-break:keep-all]">{displaySnapshot.summary.primaryCondition.label}</p>
        </div>
      </div>

      <ul className="mt-2 grid gap-1 text-[11px] font-semibold leading-4 text-ui-muted sm:grid-cols-2">
        {displaySnapshot.summary.reasons.map((reason) => <li key={reason}>· {reason}</li>)}
      </ul>

      {state.status === "error" ? <p className="mt-2 text-[11px] font-semibold text-ui-risk">최신 갱신 실패 · 마지막 정상 스냅샷은 맥락용으로만 표시합니다.</p> : null}

      <Link
        href={detailHref}
        onClick={() => void trackProductEvent({
          eventName: "home_perpetual_opened",
          surface: "home",
          asset: displaySnapshot.asset,
          snapshotId: displaySnapshot.id,
          attributionId: journeyId ?? undefined,
          properties: { quality: displaySnapshot.quality, source: "home" }
        })}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-ui-sm bg-ui-brand px-4 text-sm font-black text-white transition hover:brightness-110"
      >
        선물 시나리오 자세히 보기 <ArrowRight size={16} aria-hidden />
      </Link>
      <p className="mt-1.5 text-center text-[10.5px] font-semibold leading-4 text-ui-muted">
        {capabilities?.canSeeProDetail
          ? "Pro 상세에는 확인·판단 변경 조건과 시간대별 근거가 함께 표시됩니다."
          : "Pro는 확인·판단 변경 조건을 최대 5분 간격으로 감시하고 알림·복기로 이어집니다."}
      </p>

      <details
        className="group mt-2 border-t border-ui-line pt-2"
        onToggle={(event) => setEvidenceOpen(event.currentTarget.open)}
      >
        <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 text-xs font-black text-ui-muted marker:hidden [&::-webkit-details-marker]:hidden">
          동일 스냅샷 판단 근거
          <ChevronDown size={15} className="transition group-open:rotate-180" aria-hidden />
        </summary>
        {evidenceOpen ? (
          <div className="mt-2">
            <PerpetualDecisionChart snapshot={displaySnapshot} compact />
            <div className="mt-2 grid gap-1 text-[10.5px] leading-4 text-ui-muted sm:grid-cols-3">
              {Object.entries(displaySnapshot.sourceStatus).map(([key, source]) => (
                <p key={key}><span className="font-black text-ui-text">{key}</span> · {source.detail}</p>
              ))}
            </div>
            {displaySnapshot.pro ? (
              <div className="mt-2 space-y-2 border-t border-ui-line pt-2 text-[10.5px] leading-4 text-ui-muted">
                <div className="grid gap-1 sm:grid-cols-3">
                  {displaySnapshot.pro.multiTimeframeEvidence.map((evidence) => (
                    <p key={evidence.timeframe} className="bg-ui-inset/45 px-2 py-2">
                      <span className="font-black text-ui-text">{evidence.label}</span> · 구조 {evidence.structure} · 전환 {evidence.transition}
                    </p>
                  ))}
                </div>
                <div className="grid gap-1 sm:grid-cols-2">
                  <p>{displaySnapshot.pro.pressure?.summary ?? "청산 압력 근거가 부족합니다."}</p>
                  <p>{displaySnapshot.pro.flow?.summary ?? "큰 체결 근거가 부족합니다."}</p>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </details>
    </section>
  );
}

function HomeRevenueCoreExperience() {
  const [priorityMacro, setPriorityMacro] = useState(false);
  const macro = (
    <MacroTicker
      key="home-macro"
      compact
      market="crypto"
      homePriorityAware
      onHomePriorityChange={setPriorityMacro}
    />
  );

  return (
    <div className="flex flex-col gap-2 pt-1">
      {priorityMacro ? macro : null}
      <div key="home-decision"><HomeDecisionHero /></div>
      {!priorityMacro ? macro : null}
      <div key="market-watch"><MarketWatchDisclosure /></div>
    </div>
  );
}

function ShadowHomeCanaryGate() {
  const { session, isLoading } = useSupabaseAuth();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    if (isLoading || !session?.accessToken) {
      setEnabled(false);
      return () => controller.abort();
    }
    void (async () => {
      try {
        const response = await fetch(
          "/api/crypto/perpetual/access",
          await withSupabaseAuth({ cache: "no-store", signal: controller.signal })
        );
        const payload = (await response.json().catch(() => ({}))) as { enabled?: boolean };
        if (!controller.signal.aborted) setEnabled(response.ok && payload.enabled === true);
      } catch {
        if (!controller.signal.aborted) setEnabled(false);
      }
    })();
    return () => controller.abort();
  }, [isLoading, session?.accessToken]);

  if (enabled) return <HomeRevenueCoreExperience />;
  return <><SnapshotShadowProbe /><MacroTicker compact /><CoinRadarHomePanel /></>;
}

export function HomePerpetualDecisionFlow({ mode }: { mode: PerpetualRevenueCoreMode }) {
  if (mode === "off") {
    return <><MacroTicker compact /><CoinRadarHomePanel /></>;
  }
  if (mode === "shadow") {
    return <ShadowHomeCanaryGate />;
  }
  return <HomeRevenueCoreExperience />;
}
