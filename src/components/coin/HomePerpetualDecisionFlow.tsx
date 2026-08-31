"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { AlertTriangle, ArrowRight, Clock3, Database, Loader2, RefreshCw, Settings2 } from "lucide-react";
import { CoinRadarHomePanel } from "@/components/coin/CoinRadarHomePanel";
import { HomeInterestAnalysisSummary } from "@/components/coin/HomeInterestAnalysisSummary";
import { HomeInterestCoinSettingsDialog } from "@/components/coin/HomeInterestCoinSettingsDialog";
import { HomeTimeframeDirection } from "@/components/coin/HomeTimeframeDirection";
import { PerpetualDecisionChart } from "@/components/coin/PerpetualDecisionChart";
import { MacroTicker } from "@/components/MacroTicker";
import { PullToRefresh, usePullToRefreshRegistration } from "@/components/PullToRefresh";
import { ActionButton, StatusPill } from "@/components/ui/DesignPrimitives";
import { withSupabaseAuth } from "@/lib/authFetch";
import { hasMarketEntitlement } from "@/lib/billing";
import type { DirectionState } from "@/lib/marketAnalysis";
import {
  defaultHomeInterestCoin,
  homeInterestCoinsStorageKey,
  readHomeInterestCoins,
  sameHomeCoin,
  writeHomeInterestCoins,
  type HomeInterestCoin
} from "@/lib/homeInterestCoins";
import { canonicalAssetForHomeCoin } from "@/lib/homeInterestRouting";
import { monitorConditionDisplayLabel, monitorConditionHeading, monitorConditionOutcomeCopy, plainDecisionText, qualityLabel } from "@/lib/perpetualDecisionCopy";
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

const sourceCopy: Record<keyof PerpetualDecisionSnapshot["sourceStatus"], string> = {
  candles: "차트 흐름",
  pressure: "몰린 포지션",
  flow: "큰 금액 체결"
};

function qualityCopy(quality: SnapshotQuality) {
  if (quality === "ready") return { label: qualityLabel(quality), tone: "info" as const };
  if (quality === "partial") return { label: qualityLabel(quality), tone: "watch" as const };
  return { label: qualityLabel(quality), tone: "risk" as const };
}

function formatAsOf(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "시각 확인 필요";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function formatPrice(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: value >= 10_000 ? 0 : 2 });
}

function formatChange(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "24시간 변동 확인 중";
  return `24시간 ${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

async function requestSnapshot(asset: PerpetualAsset, signal?: AbortSignal) {
  const response = await fetch(
    `/api/crypto/perpetual/snapshot?asset=${asset}`,
    await withSupabaseAuth({ cache: "no-store", signal })
  );
  const payload = (await response.json().catch(() => ({}))) as PerpetualSnapshotResponse;
  if (!response.ok || !payload.snapshot || !payload.capabilities) {
    throw new Error(payload.error ?? "선물 시장 분석을 불러오지 못했습니다.");
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

function homeCoinDomKey(coin: HomeInterestCoin) {
  return `${coin.exchangeId}-${coin.symbol}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function homeCoinTabId(coin: HomeInterestCoin) {
  return `home-analysis-coin-${homeCoinDomKey(coin)}`;
}

function HomeInterestTabs({
  coins,
  activeCoin,
  isPaid,
  onSelect,
  onOpenSettings,
  settingsOpen,
  settingsButtonRef
}: {
  coins: HomeInterestCoin[];
  activeCoin: HomeInterestCoin;
  isPaid: boolean;
  onSelect: (coin: HomeInterestCoin) => void;
  onOpenSettings: () => void;
  settingsOpen: boolean;
  settingsButtonRef: RefObject<HTMLButtonElement | null>;
}) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % coins.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + coins.length) % coins.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = coins.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    onSelect(coins[nextIndex]);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <section className="bg-ui-panel px-3 py-2.5" aria-labelledby="home-analysis-coins-title">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="home-analysis-coins-title" className="text-xs font-black text-ui-text">내 분석 코인</h2>
          <p className="mt-0.5 text-[10px] font-semibold text-ui-muted">{isPaid ? "Coin Pro · 최대 5개를 눌러 비교" : "Basic · 1개, 이 기기에서 하루 1회 변경"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-[10px] font-black text-ui-subtle">{coins.length}개</span>
          <button
            ref={settingsButtonRef}
            type="button"
            onClick={onOpenSettings}
            className="grid h-11 w-11 place-items-center rounded-ui-sm bg-ui-inset text-ui-muted transition hover:text-ui-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-brand"
            aria-label="홈 분석 코인 설정"
            aria-expanded={settingsOpen}
            aria-controls="home-interest-settings-dialog"
            title="관심코인 설정"
          >
            <Settings2 size={16} aria-hidden />
          </button>
        </div>
      </div>
      <div className="mt-2 flex gap-1 overflow-x-auto pb-0.5" role="tablist" aria-label="홈 분석 코인 선택">
        {coins.map((coin, index) => {
          const active = sameHomeCoin(coin, activeCoin);
          return (
            <button
              ref={(node) => { tabRefs.current[index] = node; }}
              key={`${coin.exchangeId}:${coin.symbol}`}
              id={homeCoinTabId(coin)}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="home-analysis-panel"
              aria-label={`${coin.base}/${coin.quote} · ${coin.exchangeLabel}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onSelect(coin)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className="group inline-flex min-h-11 shrink-0 items-center rounded-ui-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-brand"
            >
              <span className={`inline-flex h-9 items-center rounded-ui-sm px-3 text-xs font-black transition ${active ? "bg-ui-brand text-white" : "bg-ui-inset text-ui-muted group-hover:text-ui-text"}`}>
                {coin.base}/{coin.quote}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function HomeEvidenceSummary({ snapshot }: { snapshot: PerpetualDecisionSnapshot }) {
  const evidence = snapshot.publicEvidence;
  if (!evidence) {
    return <p className="mt-3 bg-ui-inset/55 px-3 py-3 text-xs leading-5 text-ui-muted">이전 분석이라 쉬운 근거 카드가 없습니다. 다음 자동 분석부터 표시됩니다.</p>;
  }
  const context = evidence.context ?? [];
  const groups = [
    { label: "큰 흐름", detail: "1일·4시간", timeframes: ["1d", "4h"] as const },
    { label: "현재 방향", detail: "1시간·15분", timeframes: ["1h", "15m"] as const },
    { label: "단기 반응", detail: "5분·1분", timeframes: ["5m", "1m"] as const }
  ];
  return (
    <section className="mt-3 border-t border-ui-line pt-3" aria-labelledby="home-evidence-title">
      <h2 id="home-evidence-title" className="text-sm font-black text-ui-text">근거</h2>
      <div className="mt-2 grid gap-1.5">
        {groups.map((group) => {
          const items = group.timeframes.map((timeframe) => context.find((entry) => entry.timeframe === timeframe));
          const trends: DirectionState[] = items.map((item) => item?.trend ?? "unknown");
          const groupState = trends.every((trend) => trend === "bullish")
            ? "둘 다 위쪽"
            : trends.every((trend) => trend === "bearish")
              ? "둘 다 아래쪽"
              : trends.some((trend) => trend === "unknown")
                ? "일부 확인 중"
                : trends.includes("bullish") && trends.includes("bearish")
                  ? "방향 엇갈림"
                  : trends.every((trend) => trend === "neutral")
                    ? "둘 다 뚜렷하지 않음"
                    : "한쪽만 방향 확인";
          return (
            <article key={group.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 bg-ui-inset/55 px-2.5 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-black text-ui-text">{group.label}</p>
                <p className="mt-0.5 text-[11px] font-semibold leading-4 text-ui-muted">{group.detail} · {groupState}</p>
              </div>
              <div className="grid grid-cols-2 gap-1" aria-label={`${group.label} 시간대별 방향`}>
                {group.timeframes.map((timeframe, index) => (
                  <p key={timeframe} className="min-w-[4.5rem] bg-ui-panel/70 px-1.5 py-1 text-center text-[11px] font-semibold text-ui-muted">
                    <span className="block font-black text-ui-subtle">{items[index]?.label ?? timeframe}</span>
                    <HomeTimeframeDirection direction={items[index]?.trend ?? "unknown"} />
                  </p>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function HomeDecisionHero({ asset }: { asset: PerpetualAsset }) {
  const { session } = useSupabaseAuth();
  const [state, setState] = useState<LoadState>({ status: "loading", snapshot: null, capabilities: null });
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [liveChange, setLiveChange] = useState<number | null>(null);
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
        message: error instanceof Error ? error.message : "선물 시장 분석을 불러오지 못했습니다."
      }));
      return null;
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  const refreshFromPull = useCallback(async () => {
    const nextSnapshot = await load(asset, true);
    if (!nextSnapshot) throw new Error("선물 시장 분석을 새로고침하지 못했습니다.");
  }, [asset, load]);
  usePullToRefreshRegistration(refreshFromPull);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    setLivePrice(null);
    setLiveChange(null);
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
        if (!cancelled && response.ok && payload.ticker?.price) {
          setLivePrice(payload.ticker.price);
          setLiveChange(typeof payload.ticker.changePercent === "number" ? payload.ticker.changePercent : null);
        }
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
      <section className="bg-ui-panel px-3 py-4 sm:px-4" aria-busy="true" aria-label={`${assetCopy[asset].label} 선물 시장 분석을 불러오는 중`}>
        <p className="inline-flex items-center gap-1 text-xs font-black text-ui-brand"><Loader2 className="animate-spin" size={14} aria-hidden /> {assetCopy[asset].label} 분석 중</p>
        <div className="mt-4 h-7 w-4/5 animate-pulse bg-ui-inset" />
        <div className="mt-2 h-7 w-3/5 animate-pulse bg-ui-inset" />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="min-h-20 animate-pulse bg-ui-risk/10 px-3 py-3 text-[11px] font-bold text-ui-risk">지금 주의할 점 확인 중</div>
          <div className="min-h-20 animate-pulse bg-ui-brand/8 px-3 py-3 text-[11px] font-bold text-ui-brand">다음에 확인할 것 계산 중</div>
        </div>
        <p className="mt-3 text-xs leading-5 text-ui-muted">현재 가격과 방향 판단 근거를 같은 시각으로 맞추고 있습니다.</p>
      </section>
    );
  }

  if (!snapshot) {
    return (
      <section className="bg-ui-panel px-4 py-5">
        <p className="text-base font-black text-ui-text">선물 시장 분석을 준비하지 못했습니다.</p>
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
  const degradedSources = Object.entries(displaySnapshot.sourceStatus).filter(([, source]) => source.status !== "ready");
  const detailHref = `/crypto/perpetual?asset=${asset}&timeframe=15m&snapshot=${encodeURIComponent(displaySnapshot.id)}&source=home${journeyId ? `&attribution=${encodeURIComponent(journeyId)}` : ""}`;
  const conditionOutcome = monitorConditionOutcomeCopy(displaySnapshot.summary.primaryCondition);
  const showConditionNote = displaySnapshot.summary.primaryCondition.kind === "price_cross_above" ||
    displaySnapshot.summary.primaryCondition.kind === "price_cross_below";
  return (
    <section className="bg-ui-panel px-3 py-3 sm:px-4 sm:py-4" aria-labelledby="home-decision-title">
      {displayQuality !== "ready" ? <div className="flex items-center justify-end gap-2">
        <div className="flex min-w-0 flex-wrap justify-end gap-1">
          <StatusPill tone={quality.tone} icon={Database} className="min-h-7 text-[10px]">
            {quality.label}
          </StatusPill>
        </div>
      </div> : null}

      <div className={`${displayQuality !== "ready" ? "mt-2" : ""} flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3`}>
        <div className="min-w-0">
          <h1 id="home-decision-title" className="text-[1.35rem] font-black leading-7 tracking-tight text-ui-text [word-break:keep-all]">
            {plainDecisionText(displaySnapshot.summary.headline)}
          </h1>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="text-xl font-black tabular-nums text-ui-text">{formatPrice(livePrice ?? displaySnapshot.price)}</p>
          <p className={`mt-0.5 text-[10px] font-black tabular-nums ${liveChange === null ? "text-ui-subtle" : liveChange > 0 ? "text-ui-long" : liveChange < 0 ? "text-ui-short" : "text-ui-muted"}`}>{formatChange(liveChange)}</p>
          <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-ui-subtle">
            <Clock3 size={11} aria-hidden /> {formatAsOf(displaySnapshot.generatedAt)} 기준 분석
          </p>
        </div>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="bg-ui-risk/10 px-3 py-2.5">
          <p className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.1em] text-ui-risk">
            <AlertTriangle size={12} aria-hidden /> 지금 주의할 점
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-ui-text [word-break:keep-all]">{plainDecisionText(displaySnapshot.summary.topRisk)}</p>
        </div>
        <div className="bg-ui-inset/65 px-3 py-2.5">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-ui-brand">{monitorConditionHeading(displaySnapshot.summary.primaryCondition)}</p>
          <p className="mt-1 text-xs font-black leading-5 text-ui-text [word-break:keep-all]">{monitorConditionDisplayLabel(displaySnapshot.summary.primaryCondition)}</p>
          <p className="mt-1.5 text-[10.5px] font-semibold leading-4 text-ui-muted [word-break:keep-all]">{conditionOutcome.met}</p>
          <p className="mt-0.5 text-[10.5px] leading-4 text-ui-subtle [word-break:keep-all]">{conditionOutcome.unmet}</p>
          {showConditionNote ? <p className="mt-1 text-[10.5px] leading-4 text-ui-subtle [word-break:keep-all]">{conditionOutcome.note}</p> : null}
        </div>
      </div>

      {state.status === "error" ? <p className="mt-2 text-[11px] font-semibold text-ui-risk">최신 갱신 실패 · 마지막 정상 분석을 참고용으로 보여드립니다.</p> : null}

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
        전체 선물 분석과 조건 알림 보기 <ArrowRight size={16} aria-hidden />
      </Link>

      <div className="mt-3 bg-ui-inset/25 px-1 py-2">
        <PerpetualDecisionChart snapshot={displaySnapshot} compact />
        {degradedSources.length ? (
          <div className="mt-2 grid grid-cols-3 gap-1 px-2 text-[9.5px] leading-4 text-ui-muted">
            {degradedSources.map(([key, source]) => (
              <p key={key} className="min-w-0"><span className="block truncate font-black text-ui-text">{sourceCopy[key as keyof typeof sourceCopy]}</span>{qualityLabel(source.status)}</p>
            ))}
          </div>
        ) : null}
      </div>

      <HomeEvidenceSummary snapshot={displaySnapshot} />

    </section>
  );
}

function HomeRevenueCoreExperience() {
  const { profile, isLoading } = useSupabaseAuth();
  const isPaid = hasMarketEntitlement(profile?.plan, "crypto");
  const [coins, setCoins] = useState<HomeInterestCoin[]>([defaultHomeInterestCoin]);
  const [activeCoin, setActiveCoin] = useState<HomeInterestCoin>(defaultHomeInterestCoin);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isLoading) return;
    const stored = readHomeInterestCoins(isPaid);
    setCoins(stored);
    setActiveCoin((current) => stored.find((coin) => sameHomeCoin(coin, current)) ?? stored[0] ?? defaultHomeInterestCoin);
  }, [isLoading, isPaid]);

  useEffect(() => {
    if (isLoading) return;
    const syncAcrossTabs = (event: StorageEvent) => {
      if (event.key !== homeInterestCoinsStorageKey) return;
      const stored = readHomeInterestCoins(isPaid);
      setCoins(stored);
      setActiveCoin((current) => stored.find((coin) => sameHomeCoin(coin, current)) ?? stored[0] ?? defaultHomeInterestCoin);
    };
    window.addEventListener("storage", syncAcrossTabs);
    return () => window.removeEventListener("storage", syncAcrossTabs);
  }, [isLoading, isPaid]);

  const saveCoins = useCallback((nextCoins: HomeInterestCoin[]) => {
    const stored = writeHomeInterestCoins(nextCoins, isPaid);
    setCoins(stored);
    setActiveCoin((current) => stored.find((coin) => sameHomeCoin(coin, current)) ?? stored[0] ?? defaultHomeInterestCoin);
    setSettingsOpen(false);
  }, [isPaid]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 pt-1">
        <MacroTicker compact market="crypto" homePriorityAware />
        <section className="bg-ui-panel px-3 py-4" aria-busy="true">
          <p className="inline-flex items-center gap-2 text-xs font-black text-ui-brand"><Loader2 size={14} className="animate-spin" aria-hidden /> 내 분석 코인 확인 중</p>
          <div className="mt-3 h-10 animate-pulse bg-ui-inset" />
        </section>
      </div>
    );
  }

  const canonicalAsset = canonicalAssetForHomeCoin(activeCoin);
  return (
    <div className="flex flex-col gap-2 pt-1">
      <MacroTicker compact market="crypto" homePriorityAware />
      <HomeInterestTabs
        coins={coins}
        activeCoin={activeCoin}
        isPaid={isPaid}
        onSelect={setActiveCoin}
        onOpenSettings={() => setSettingsOpen(true)}
        settingsOpen={settingsOpen}
        settingsButtonRef={settingsButtonRef}
      />
      <div
        id="home-analysis-panel"
        role="tabpanel"
        aria-labelledby={homeCoinTabId(activeCoin)}
        tabIndex={0}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-brand"
      >
        {canonicalAsset
          ? <HomeDecisionHero key={canonicalAsset} asset={canonicalAsset} />
          : <HomeInterestAnalysisSummary key={`${activeCoin.exchangeId}:${activeCoin.symbol}`} coin={activeCoin} />}
      </div>
      {settingsOpen ? (
        <HomeInterestCoinSettingsDialog
          coins={coins}
          isPaid={isPaid}
          onSave={saveCoins}
          onClose={() => setSettingsOpen(false)}
          returnFocusRef={settingsButtonRef}
        />
      ) : null}
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
  return <><SnapshotShadowProbe /><MacroTicker compact market="crypto" homePriorityAware /><CoinRadarHomePanel /></>;
}

export function HomePerpetualDecisionFlow({ mode }: { mode: PerpetualRevenueCoreMode }) {
  return (
    <PullToRefresh>
      {mode === "off" ? (
        <><MacroTicker compact market="crypto" homePriorityAware /><CoinRadarHomePanel /></>
      ) : mode === "shadow" ? (
        <ShadowHomeCanaryGate />
      ) : (
        <HomeRevenueCoreExperience />
      )}
    </PullToRefresh>
  );
}
