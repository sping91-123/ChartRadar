"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, ArrowRight, Bell, BookOpen, Clock3, Database, Loader2, Newspaper, RefreshCw, ShieldCheck } from "lucide-react";
import { CoinRadarHomePanel } from "@/components/coin/CoinRadarHomePanel";
import { HomeInterestCoinPrices } from "@/components/coin/HomeInterestCoinPrices";
import { PerpetualDecisionChart } from "@/components/coin/PerpetualDecisionChart";
import { MacroTicker } from "@/components/MacroTicker";
import { ActionButton, StatusPill } from "@/components/ui/DesignPrimitives";
import { withSupabaseAuth } from "@/lib/authFetch";
import { beginnerTerm, decisionStateLabel, flowDirectionLabel, monitorConditionHeading, plainDirection, pressureDirectionLabel, qualityLabel } from "@/lib/perpetualDecisionCopy";
import type { CryptoHomeTicker } from "@/lib/server/cryptoExchangeData";
import type { PerpetualAsset, PerpetualDecisionSnapshot, SnapshotQuality } from "@/lib/perpetualDecisionSnapshot";
import type { PerpetualSnapshotCapabilities, PerpetualSnapshotResponse } from "@/lib/perpetualApi";
import type { NewsImpactListResponse } from "@/lib/newsImpact";
import { newsImpactClassificationLabel, newsImpactTone } from "@/lib/newsImpactPresentation";
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
  if (quality === "ready") return { label: qualityLabel(quality), tone: "long" as const };
  if (quality === "partial") return { label: qualityLabel(quality), tone: "watch" as const };
  return { label: qualityLabel(quality), tone: "risk" as const };
}

function stateCopy(state: PerpetualDecisionSnapshot["summary"]["state"]) {
  if (state === "upside_watch") return { label: decisionStateLabel(state), tone: "long" as const };
  if (state === "downside_watch") return { label: decisionStateLabel(state), tone: "short" as const };
  if (state === "risk") return { label: decisionStateLabel(state), tone: "risk" as const };
  return { label: decisionStateLabel(state), tone: "watch" as const };
}

function formatAsOf(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "시각 확인 필요";
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
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

function HomeMarketWatch() {
  return (
    <section className="border-t border-ui-line pt-3" aria-labelledby="home-market-watch-title">
      <h2 id="home-market-watch-title" className="text-sm font-black text-ui-text">관심코인 시세</h2>
      <p className="mt-0.5 text-xs leading-5 text-ui-muted">다른 거래소와 알트는 시장 관찰용 시세이며, 위의 BTC·ETH 선물 분석과는 분리해 보여드립니다.</p>
      <div className="mt-3"><HomeInterestCoinPrices /></div>
    </section>
  );
}

function HomeNewsImpactStrip({ asset, snapshotId }: {
  asset: PerpetualAsset;
  snapshotId: string;
}) {
  const { session } = useSupabaseAuth();
  const [payload, setPayload] = useState<NewsImpactListResponse | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setPayload(null);
    void (async () => {
      try {
        const params = new URLSearchParams({ market: "crypto", asset, limit: "3", snapshot: snapshotId });
        const response = await fetch(`/api/news-impact?${params.toString()}`, await withSupabaseAuth({ cache: "no-store", signal: controller.signal }));
        const next = (await response.json().catch(() => ({}))) as NewsImpactListResponse;
        if (!controller.signal.aborted && response.ok) {
          setPayload(next);
        }
      } catch {
        // Home decision remains primary when the optional official-event overlay is unavailable.
      }
    })();
    return () => controller.abort();
  }, [asset, session?.accessToken, snapshotId]);

  const event = payload?.events[0];
  if (!payload) return null;
  if (!event) {
    const delayed = payload.quality !== "ready";
    return (
      <Link
        href={`/crypto/news?asset=${asset}&source=home`}
        className="mt-2 flex min-h-9 min-w-0 items-center gap-2 border-l-2 border-ui-line bg-ui-inset/45 px-2.5 py-1.5 text-[11px] font-semibold text-ui-muted transition hover:bg-ui-inset"
      >
        <StatusPill tone={delayed ? "risk" : "watch"} className="min-h-5 shrink-0 px-1.5 text-[10px]">공식 뉴스</StatusPill>
        <span className="min-w-0 flex-1 truncate">{delayed ? "공식 출처 갱신 지연 · 상태 확인" : "현재 분석과 직접 연결된 새 공식 이슈 없음 · 최근 발표 보기"}</span>
        <ArrowRight size={13} className="shrink-0 text-ui-brand" aria-hidden />
      </Link>
    );
  }
  if (payload.mode === "shadow") {
    return (
      <Link
        href={`/crypto/news?asset=${asset}&event=${event.id}&source=home`}
        className="mt-2 flex min-h-9 min-w-0 items-center gap-2 border-l-2 border-ui-brand bg-ui-inset/55 px-2.5 py-1.5 text-[11px] font-semibold text-ui-muted transition hover:bg-ui-inset"
      >
        <StatusPill tone="watch" className="min-h-5 shrink-0 px-1.5 text-[10px]">공식 발표</StatusPill>
        <span className="min-w-0 flex-1 truncate">{event.headline}</span>
        <ArrowRight size={13} className="shrink-0 text-ui-brand" aria-hidden />
      </Link>
    );
  }
  if (!event.reaction || event.reaction.classification === "insufficient_data") {
    return (
      <Link
        href={`/crypto/news?asset=${asset}&event=${event.id}&source=home&snapshot=${encodeURIComponent(snapshotId)}`}
        className="mt-2 flex min-h-9 min-w-0 items-center gap-2 border-l-2 border-ui-watch bg-ui-inset/45 px-2.5 py-1.5 text-[11px] font-semibold text-ui-muted transition hover:bg-ui-inset"
      >
        <StatusPill tone="watch" className="min-h-5 shrink-0 px-1.5 text-[10px]">반응 확인 중</StatusPill>
        <span className="min-w-0 flex-1 truncate">공식 발표 확인 · 발표 전후 시장 자료를 비교 중입니다</span>
        <ArrowRight size={13} className="shrink-0 text-ui-brand" aria-hidden />
      </Link>
    );
  }
  return (
    <Link
      href={`/crypto/news?asset=${asset}&event=${event.id}&source=home&snapshot=${encodeURIComponent(snapshotId)}`}
      className="mt-2 flex min-h-9 min-w-0 items-center gap-2 border-l-2 border-ui-brand bg-ui-inset/55 px-2.5 py-1.5 text-[11px] font-semibold text-ui-muted transition hover:bg-ui-inset"
    >
      <StatusPill tone={newsImpactTone(event.reaction.classification)} className="min-h-5 shrink-0 px-1.5 text-[10px]">{newsImpactClassificationLabel(event.reaction.classification)}</StatusPill>
      <span className="min-w-0 flex-1 truncate">공식 발표·공시 · {event.headline}</span>
      <ArrowRight size={13} className="shrink-0 text-ui-brand" aria-hidden />
    </Link>
  );
}

function HomeEvidenceSummary({ snapshot }: { snapshot: PerpetualDecisionSnapshot }) {
  const evidence = snapshot.publicEvidence;
  if (!evidence) {
    return <p className="mt-3 bg-ui-inset/55 px-3 py-3 text-xs leading-5 text-ui-muted">이전 분석이라 쉬운 근거 카드가 없습니다. 다음 자동 분석부터 표시됩니다.</p>;
  }
  const cards = [
    { label: beginnerTerm("msb"), value: plainDirection(evidence.structure), detail: evidence.events?.msb ? `${formatPrice(evidence.events.msb.level)}에서 최근 추세 확인` : "최근 중요한 고점·저점을 넘은 방향" },
    { label: beginnerTerm("choch"), value: plainDirection(evidence.transition), detail: evidence.events?.choch ? `${formatPrice(evidence.events.choch.level)}에서 전환 신호` : "기존 흐름이 바뀌기 시작한 방향" },
    { label: "몰린 포지션", value: evidence.pressure ? pressureDirectionLabel(evidence.pressure.dominantSide) : "확인 중", detail: "반대 움직임 때 강제 청산이 커질 수 있는 쪽" },
    { label: "큰 금액 체결", value: evidence.flow ? flowDirectionLabel(evidence.flow.dominantSide) : "확인 중", detail: "최근 큰 금액 매수와 매도 중 더 강한 쪽" }
  ];
  return (
    <section className="mt-3 border-t border-ui-line pt-3" aria-labelledby="home-evidence-title">
      <h2 id="home-evidence-title" className="text-sm font-black text-ui-text">왜 이렇게 보나요?</h2>
      <p className="mt-0.5 text-[11px] leading-5 text-ui-muted">결론에 사용한 네 가지 근거를 숨기지 않고 보여드립니다.</p>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {cards.map((card) => (
          <article key={card.label} className="min-w-0 bg-ui-inset/55 px-2.5 py-2.5">
            <p className="text-[10px] font-black leading-4 text-ui-subtle [word-break:keep-all]">{card.label}</p>
            <p className="mt-1 text-xs font-black leading-5 text-ui-text [word-break:keep-all]">{card.value}</p>
            <p className="mt-0.5 text-[10px] leading-4 text-ui-muted [word-break:keep-all]">{card.detail}</p>
          </article>
        ))}
      </div>
      {evidence.context?.length ? (
        <div className="mt-2 grid grid-cols-3 gap-1" aria-label="시간대별 흐름">
          {evidence.context.map((item) => (
            <p key={item.timeframe} className="bg-ui-inset/40 px-2 py-1.5 text-center text-[10px] font-semibold text-ui-muted">
              <span className="block font-black text-ui-text">{item.label}</span>{plainDirection(item.structure)}
            </p>
          ))}
        </div>
      ) : null}
      <p className="mt-2 bg-ui-brand/8 px-2.5 py-2 text-[11px] font-semibold leading-5 text-ui-muted">
        <span className="font-black text-ui-text">지난 분석 이후</span> · {evidence.previousChange
          ? `이전에는 ${decisionStateLabel(evidence.previousChange.from)}, 지금은 ${decisionStateLabel(evidence.previousChange.to)}입니다.`
          : "바로 전 분석과 비교해 큰 방향 변화는 없습니다."}
      </p>
    </section>
  );
}

function HomeDecisionHero({ newsImpactEnabled }: { newsImpactEnabled: boolean }) {
  const { session } = useSupabaseAuth();
  const [asset, setAsset] = useState<PerpetualAsset>("btc");
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

  const selectAsset = useCallback((nextAsset: PerpetualAsset) => {
    if (nextAsset === asset) return;
    requestGeneration.current += 1;
    abortRef.current?.abort();
    setState({ status: "loading", snapshot: null, capabilities: null });
    setLivePrice(null);
    setLiveChange(null);
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
      <section className="bg-ui-panel px-3 py-4 sm:px-4" aria-busy="true" aria-label="BTC와 ETH 선물 시장 분석을 불러오는 중">
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1 rounded-ui-sm bg-ui-inset p-1" aria-hidden>
            <span className="min-w-12 rounded-ui-sm bg-ui-brand/70 px-3 py-2 text-center text-xs font-black text-white">BTC</span>
            <span className="min-w-12 px-3 py-2 text-center text-xs font-black text-ui-subtle">ETH</span>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-black text-ui-brand"><Loader2 className="animate-spin" size={14} aria-hidden /> 분석 중</span>
        </div>
        <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-ui-subtle">바이낸스 만기 없는 선물 · 15분 흐름 기준</p>
        <div className="mt-2 h-7 w-4/5 animate-pulse bg-ui-inset" />
        <div className="mt-2 h-7 w-3/5 animate-pulse bg-ui-inset" />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="min-h-20 animate-pulse bg-ui-risk/10 px-3 py-3 text-[11px] font-bold text-ui-risk">가장 큰 위험 확인 중</div>
          <div className="min-h-20 animate-pulse bg-ui-brand/8 px-3 py-3 text-[11px] font-bold text-ui-brand">확인할 가격 계산 중</div>
        </div>
        <p className="mt-3 text-xs leading-5 text-ui-muted">차트 흐름, 몰린 포지션, 큰 금액 체결을 같은 시각으로 맞추고 있습니다.</p>
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
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ui-subtle">바이낸스 만기 없는 선물 · 15분 흐름 기준</p>
          <h1 id="home-decision-title" className="mt-1 text-[1.35rem] font-black leading-7 tracking-tight text-ui-text [word-break:keep-all]">
            {displaySnapshot.summary.headline}
          </h1>
        </div>
        <div className="shrink-0 text-right">
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
            <AlertTriangle size={12} aria-hidden /> 가장 큰 위험
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-ui-text [word-break:keep-all]">{displaySnapshot.summary.topRisk}</p>
        </div>
        <div className="bg-ui-inset/65 px-3 py-2.5">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-ui-brand">{monitorConditionHeading(displaySnapshot.summary.primaryCondition)}</p>
          <p className="mt-1 text-xs font-black leading-5 text-ui-text [word-break:keep-all]">{displaySnapshot.summary.primaryCondition.label}</p>
        </div>
      </div>

      <ul className="mt-2 grid gap-1 text-[11px] font-semibold leading-4 text-ui-muted sm:grid-cols-2">
        {displaySnapshot.summary.reasons.map((reason) => <li key={reason}>· {reason}</li>)}
      </ul>

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
      {newsImpactEnabled ? <HomeNewsImpactStrip asset={asset} snapshotId={displaySnapshot.id} /> : null}

      <HomeEvidenceSummary snapshot={displaySnapshot} />

      <div className="mt-3 bg-ui-inset/25 px-1 py-2">
        <div className="mb-2 flex items-center justify-between gap-2 px-2">
          <p className="text-[11px] font-black text-ui-text">15분 차트에서 직접 확인</p>
          <span className="text-[10px] font-semibold text-ui-subtle">신호와 확인 가격 표시</span>
        </div>
        <PerpetualDecisionChart snapshot={displaySnapshot} compact />
        <div className="mt-2 grid grid-cols-3 gap-1 px-2 text-[9.5px] leading-4 text-ui-muted">
          {Object.entries(displaySnapshot.sourceStatus).map(([key, source]) => (
            <p key={key} className="min-w-0"><span className="block truncate font-black text-ui-text">{sourceCopy[key as keyof typeof sourceCopy]}</span>{qualityLabel(source.status)}</p>
          ))}
        </div>
      </div>

      <p className="mt-1.5 text-center text-[10.5px] font-semibold leading-4 text-ui-muted">
        {capabilities?.canSeeProDetail
          ? "상세 화면에서 시간대별 신호 가격, 상세 포지션·큰 체결 수치, 고급 가격 구간과 AI 설명을 함께 확인할 수 있습니다."
          : "Pro는 시간대별 신호가 나온 가격·시각과 상세 포지션·큰 체결 수치, AI 설명을 보여주고 중요한 조건을 최대 5분 간격으로 확인합니다."}
      </p>

    </section>
  );
}

function HomeDailyActions({ newsImpactEnabled }: { newsImpactEnabled: boolean }) {
  const { session, isLoading } = useSupabaseAuth();
  const [monitorDetail, setMonitorDetail] = useState("조건 1개 무료 저장");

  useEffect(() => {
    const controller = new AbortController();
    if (isLoading) {
      setMonitorDetail("감시 상태 확인 중");
      return () => controller.abort();
    }
    if (!session?.accessToken) {
      setMonitorDetail("로그인 후 조건 저장");
      return () => controller.abort();
    }
    void (async () => {
      try {
        const response = await fetch(
          "/api/crypto/perpetual/monitors?status=active",
          await withSupabaseAuth({ cache: "no-store", signal: controller.signal })
        );
        const payload = (await response.json().catch(() => ({}))) as {
          capabilities?: { runningMonitorCount?: number };
        };
        if (controller.signal.aborted) return;
        const count = response.ok ? Number(payload.capabilities?.runningMonitorCount ?? 0) : 0;
        setMonitorDetail(count > 0 ? `${count}개 감시 중` : "조건 1개 무료 저장");
      } catch {
        if (!controller.signal.aborted) setMonitorDetail("조건 감시 관리");
      }
    })();
    return () => controller.abort();
  }, [isLoading, session?.accessToken]);

  const actions = [
    ...(newsImpactEnabled ? [{ href: "/crypto/news", label: "공식 뉴스", detail: "BTC·ETH 발표 반응", icon: Newspaper }] : []),
    { href: "/crypto/alertlist", label: "조건 알림", detail: monitorDetail, icon: Bell },
    { href: "/crypto/review", label: "판단 복기", detail: "저장한 분석", icon: BookOpen }
  ];
  return (
    <section className="grid grid-cols-3 gap-1.5" aria-label="매일 쓰는 도구">
      {actions.map(({ href, label, detail, icon: Icon }) => (
        <Link key={href} href={href} className="min-w-0 bg-ui-panel px-2 py-2.5 text-center transition hover:bg-ui-elevated">
          <Icon className="mx-auto text-ui-brand" size={15} aria-hidden />
          <span className="mt-1 block text-[11px] font-black text-ui-text">{label}</span>
          <span className="mt-0.5 block truncate text-[9.5px] text-ui-muted">{detail}</span>
        </Link>
      ))}
    </section>
  );
}

function HomeRevenueCoreExperience({ newsImpactEnabled }: { newsImpactEnabled: boolean }) {
  return (
    <div className="flex flex-col gap-2 pt-1">
      <MacroTicker compact market="crypto" homePriorityAware />
      <HomeDecisionHero newsImpactEnabled={newsImpactEnabled} />
      <HomeDailyActions newsImpactEnabled={newsImpactEnabled} />
      <HomeMarketWatch />
    </div>
  );
}

function ShadowHomeCanaryGate({ newsImpactEnabled }: { newsImpactEnabled: boolean }) {
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

  if (enabled) return <HomeRevenueCoreExperience newsImpactEnabled={newsImpactEnabled} />;
  return <><SnapshotShadowProbe /><MacroTicker compact /><CoinRadarHomePanel /></>;
}

export function HomePerpetualDecisionFlow({ mode, newsImpactEnabled = false }: { mode: PerpetualRevenueCoreMode; newsImpactEnabled?: boolean }) {
  if (mode === "off") {
    return <><MacroTicker compact /><CoinRadarHomePanel /></>;
  }
  if (mode === "shadow") {
    return <ShadowHomeCanaryGate newsImpactEnabled={newsImpactEnabled} />;
  }
  return <HomeRevenueCoreExperience newsImpactEnabled={newsImpactEnabled} />;
}
