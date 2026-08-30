"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Clock3, Loader2, RefreshCw } from "lucide-react";
import { HomeInterestMiniChart } from "@/components/coin/HomeInterestMiniChart";
import { HomeTimeframeDirection } from "@/components/coin/HomeTimeframeDirection";
import { usePullToRefreshRegistration } from "@/components/PullToRefresh";
import { ActionButton } from "@/components/ui/DesignPrimitives";
import { withSupabaseAuth } from "@/lib/authFetch";
import {
  homeInterestRefreshDelay,
  type HomeInterestAnalysisResponse,
  type HomeInterestAnalysisSummary,
  type HomeInterestSummaryTimeframe
} from "@/lib/homeInterestAnalysis";
import type { HomeInterestCoin } from "@/lib/homeInterestCoins";
import { homeInterestDetailTarget } from "@/lib/homeInterestRouting";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

type SummaryState =
  | { status: "loading"; snapshot: null }
  | { status: "ready"; snapshot: HomeInterestAnalysisSummary }
  | { status: "refreshing"; snapshot: HomeInterestAnalysisSummary }
  | { status: "error"; snapshot: HomeInterestAnalysisSummary | null; message: string };

const evidenceGroups = [
  { label: "큰 흐름", detail: "1일·4시간", timeframes: ["1d", "4h"] as const },
  { label: "현재 방향", detail: "1시간·15분", timeframes: ["1h", "15m"] as const },
  { label: "단기 반응", detail: "5분", timeframes: ["5m"] as const }
] satisfies Array<{
  label: string;
  detail: string;
  timeframes: readonly HomeInterestSummaryTimeframe[];
}>;

function formatPrice(value: number) {
  const digits = value >= 100 ? 2 : value >= 10 ? 3 : value >= 1 ? 4 : 6;
  return `$${value.toLocaleString("ko-KR", { maximumFractionDigits: digits })}`;
}

function formatChange(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "24시간 변동 확인 중";
  return `24시간 ${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatAsOf(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "시각 확인 필요";
  const formatted = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(date);
  return `${formatted} KST`;
}

class HomeInterestRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterMs: number | null
  ) {
    super(message);
    this.name = "HomeInterestRequestError";
  }
}

function responseRetryAfterMs(response: Response) {
  const value = response.headers.get("Retry-After");
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const at = Date.parse(value);
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : null;
}

async function requestInterestSummary(coin: HomeInterestCoin, signal?: AbortSignal) {
  const params = new URLSearchParams({ exchange: coin.exchangeId, symbol: coin.symbol });
  const response = await fetch(
    `/api/crypto/home-interest-summary?${params.toString()}`,
    await withSupabaseAuth({ cache: "no-store", signal })
  );
  const payload = (await response.json().catch(() => ({}))) as HomeInterestAnalysisResponse;
  if (!response.ok || !payload.snapshot) {
    throw new HomeInterestRequestError(
      payload.error ?? "관심코인 분석을 불러오지 못했습니다.",
      response.status,
      responseRetryAfterMs(response)
    );
  }
  return payload.snapshot;
}

export function HomeInterestAnalysisSummary({ coin }: { coin: HomeInterestCoin }) {
  const { session } = useSupabaseAuth();
  const [state, setState] = useState<SummaryState>({ status: "loading", snapshot: null });
  const requestGeneration = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const nextRefreshAtRef = useRef(0);
  const refreshCycleRef = useRef(0);
  const refreshInFlightRef = useRef<{
    cycle: number;
    promise: Promise<HomeInterestAnalysisSummary | null>;
  } | null>(null);
  const retryDelayRef = useRef<number | null>(null);
  const autoRefreshStoppedRef = useRef(false);
  const refreshCoordinatorRef = useRef<(
    silent: boolean,
    manual?: boolean
  ) => Promise<HomeInterestAnalysisSummary | null>>(null);

  const load = useCallback(async (silent = false) => {
    const generation = ++requestGeneration.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 12_000);
    setState((current) => silent && current.snapshot
      ? { status: "refreshing", snapshot: current.snapshot }
      : { status: "loading", snapshot: null });
    try {
      const snapshot = await requestInterestSummary(coin, controller.signal);
      if (controller.signal.aborted || generation !== requestGeneration.current) return null;
      retryDelayRef.current = null;
      autoRefreshStoppedRef.current = false;
      setState({ status: "ready", snapshot });
      return snapshot;
    } catch (error) {
      if (generation !== requestGeneration.current || (controller.signal.aborted && !timedOut)) return null;
      if (error instanceof HomeInterestRequestError) {
        retryDelayRef.current = error.status === 429
          ? Math.max(1_000, error.retryAfterMs ?? 15_000)
          : null;
        autoRefreshStoppedRef.current = error.status >= 400 && error.status < 500 && error.status !== 429;
      } else {
        retryDelayRef.current = null;
        autoRefreshStoppedRef.current = false;
      }
      const message = timedOut
        ? "분석 요청 시간이 길어지고 있습니다. 잠시 후 다시 확인해 주세요."
        : error instanceof Error
          ? error.message
          : "관심코인 분석을 불러오지 못했습니다.";
      setState((current) => ({
        status: "error",
        snapshot: current.snapshot,
        message
      }));
      return null;
    } finally {
      window.clearTimeout(timeout);
    }
  }, [coin]);

  const scheduleRefresh = useCallback((expiresAt: string | null | undefined, cycle: number) => {
    if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = null;
    if (autoRefreshStoppedRef.current || cycle !== refreshCycleRef.current) return;

    const delay = retryDelayRef.current ?? homeInterestRefreshDelay(expiresAt);
    nextRefreshAtRef.current = Date.now() + delay;
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      if (cycle !== refreshCycleRef.current || document.visibilityState === "hidden") return;
      void refreshCoordinatorRef.current?.(true);
    }, delay);
  }, []);

  const refreshCoordinator = useCallback((silent: boolean, manual = false) => {
    const cycle = refreshCycleRef.current;
    if (manual) autoRefreshStoppedRef.current = false;
    if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = null;

    const active = refreshInFlightRef.current;
    if (active?.cycle === cycle) return active.promise;

    let promise: Promise<HomeInterestAnalysisSummary | null>;
    promise = load(silent)
      .then((snapshot) => {
        if (cycle === refreshCycleRef.current && !autoRefreshStoppedRef.current) {
          scheduleRefresh(snapshot?.expiresAt, cycle);
        }
        return snapshot;
      })
      .finally(() => {
        if (refreshInFlightRef.current?.promise === promise) refreshInFlightRef.current = null;
      });
    refreshInFlightRef.current = { cycle, promise };
    return promise;
  }, [load, scheduleRefresh]);

  useEffect(() => {
    refreshCoordinatorRef.current = refreshCoordinator;
    return () => {
      if (refreshCoordinatorRef.current === refreshCoordinator) refreshCoordinatorRef.current = null;
    };
  }, [refreshCoordinator]);

  const refreshFromPull = useCallback(async () => {
    const snapshot = await refreshCoordinator(true, true);
    if (!snapshot) throw new Error("관심코인 분석을 새로고침하지 못했습니다.");
  }, [refreshCoordinator]);
  usePullToRefreshRegistration(refreshFromPull);

  useEffect(() => {
    const cycle = ++refreshCycleRef.current;
    retryDelayRef.current = null;
    autoRefreshStoppedRef.current = false;
    nextRefreshAtRef.current = 0;

    function handleVisibilityChange() {
      if (
        autoRefreshStoppedRef.current ||
        document.visibilityState !== "visible" ||
        Date.now() < nextRefreshAtRef.current
      ) return;
      void refreshCoordinator(true);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    void refreshCoordinator(false, true);
    return () => {
      if (refreshCycleRef.current === cycle) refreshCycleRef.current += 1;
      if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      requestGeneration.current += 1;
      abortRef.current?.abort();
      if (refreshInFlightRef.current?.cycle === cycle) refreshInFlightRef.current = null;
    };
  }, [refreshCoordinator, session?.accessToken]);

  if (state.status === "loading") {
    return (
      <section className="bg-ui-panel px-3 py-5 sm:px-4" aria-busy="true">
        <p className="inline-flex items-center gap-2 text-sm font-black text-ui-brand"><Loader2 size={15} className="animate-spin" aria-hidden /> {coin.base} 분석 중</p>
        <div className="mt-3 h-7 w-4/5 animate-pulse bg-ui-inset" />
        <div className="mt-2 h-20 animate-pulse bg-ui-inset" />
      </section>
    );
  }

  if (state.status === "error" && !state.snapshot) {
    return (
      <section role="alert" className="bg-ui-panel px-4 py-5">
        <p className="text-base font-black text-ui-text">{coin.base} 분석을 준비하지 못했습니다.</p>
        <p className="mt-2 text-sm leading-6 text-ui-muted">{state.message}</p>
        <ActionButton tone="secondary" className="mt-4 min-h-11" onClick={() => void refreshCoordinator(false, true)}><RefreshCw size={15} aria-hidden /> 다시 불러오기</ActionButton>
      </section>
    );
  }

  const snapshot = state.snapshot;
  if (!snapshot) return null;
  const target = homeInterestDetailTarget(snapshot.selection);
  const changeTone = snapshot.changePercent === null
    ? "text-ui-subtle"
    : snapshot.changePercent > 0
      ? "text-ui-long"
      : snapshot.changePercent < 0
        ? "text-ui-short"
        : "text-ui-muted";
  const expiresAtMs = Date.parse(snapshot.expiresAt);
  const expired = Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now();
  const freshnessWarning = state.status === "error"
    ? "최신 갱신에 실패해 마지막 정상 분석을 보여드립니다."
    : snapshot.quality === "stale"
      ? snapshot.qualityDetail
      : expired
        ? "분석 유효시간이 지나 최신 확정봉을 다시 확인하고 있습니다."
        : snapshot.quality === "partial"
          ? snapshot.qualityDetail
          : null;
  const warningTone = state.status === "error" || snapshot.quality === "stale" || expired
    ? "bg-ui-risk/10 text-ui-risk"
    : "bg-ui-watch/10 text-ui-watch";

  return (
    <section className="bg-ui-panel px-3 py-3 sm:px-4 sm:py-4" aria-labelledby="home-interest-decision-title">
      {freshnessWarning ? (
        <div role={state.status === "error" || snapshot.quality === "stale" ? "alert" : "status"} className={`mb-3 flex items-center justify-between gap-3 px-3 py-2.5 text-[11px] font-semibold leading-4 ${warningTone}`}>
          <span className="inline-flex min-w-0 items-start gap-1.5"><AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden /> {freshnessWarning}</span>
          <button type="button" disabled={state.status === "refreshing"} onClick={() => void refreshCoordinator(true, true)} className="min-h-11 shrink-0 px-1 font-black underline disabled:opacity-60">
            {state.status === "refreshing" ? "확인 중" : "다시 확인"}
          </button>
        </div>
      ) : null}

      <h1 id="home-interest-decision-title" className="text-[1.35rem] font-black leading-7 tracking-tight text-ui-text [word-break:keep-all]">
        {snapshot.summary.headline}
      </h1>
      <div className="mt-2">
        <p className="text-xl font-black tabular-nums text-ui-text">{formatPrice(snapshot.price)}</p>
        <p className={`mt-0.5 text-[10px] font-black tabular-nums ${changeTone}`}>{formatChange(snapshot.changePercent)}</p>
        <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-ui-subtle">
          <Clock3 size={11} aria-hidden /> {formatAsOf(snapshot.generatedAt)} 분석
          {state.status === "refreshing" ? <Loader2 size={11} className="ml-1 animate-spin" aria-label="최신 분석 갱신 중" /> : null}
        </p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="bg-ui-risk/10 px-3 py-2.5">
          <p className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.1em] text-ui-risk"><AlertTriangle size={12} aria-hidden /> 지금 주의할 점</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-ui-text [word-break:keep-all]">{snapshot.summary.topRisk}</p>
        </div>
        <div className="bg-ui-inset/65 px-3 py-2.5">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-ui-brand">다음에 확인할 것</p>
          <p className="mt-1 text-xs font-black leading-5 text-ui-text [word-break:keep-all]">{snapshot.summary.nextCondition.label}</p>
          <p className="mt-1.5 text-[10.5px] font-semibold leading-4 text-ui-muted [word-break:keep-all]">{snapshot.summary.nextCondition.met}</p>
          <p className="mt-0.5 text-[10.5px] leading-4 text-ui-subtle [word-break:keep-all]">{snapshot.summary.nextCondition.unmet}</p>
          <p className="mt-1 text-[10.5px] leading-4 text-ui-subtle [word-break:keep-all]">{snapshot.summary.nextCondition.note}</p>
        </div>
      </div>

      <p className={target.exact
        ? "mt-2 px-1 text-[10px] font-semibold leading-4 text-ui-muted [word-break:keep-all]"
        : "mt-3 bg-ui-inset/45 px-3 py-2.5 text-[11px] font-semibold leading-4 text-ui-muted [word-break:keep-all]"}>{target.notice}</p>
      <Link href={target.href} className={`${target.exact ? "mt-2" : "mt-3"} flex min-h-11 w-full items-center justify-center gap-2 rounded-ui-sm bg-ui-brand px-4 text-sm font-black text-white transition hover:brightness-110`}>
        {target.label} <ArrowRight size={16} aria-hidden />
      </Link>

      <div className="mt-3 bg-ui-inset/25 px-1 py-2">
        <div className="mb-2 flex items-center justify-between gap-2 px-2">
          <p className="text-[11px] font-black text-ui-text">시간대별 가격 흐름</p>
          <span className="text-[10px] font-semibold text-ui-subtle">확정봉 · 한국 시간(KST)</span>
        </div>
        <HomeInterestMiniChart
          candles={snapshot.chart.candles}
          candlesByTimeframe={snapshot.chart.candlesByTimeframe}
          symbol={`${snapshot.selection.base}/${snapshot.selection.quote}`}
          asOf={snapshot.observedAt}
        />
      </div>

      <section className="mt-3 border-t border-ui-line pt-3" aria-labelledby="home-interest-evidence-title">
        <h2 id="home-interest-evidence-title" className="text-sm font-black text-ui-text">근거</h2>
        <p className="mt-1 text-[11px] font-semibold leading-4 text-ui-muted">판단은 5분부터 1일까지의 확정봉을 종합하고, 차트는 15분·1시간·4시간을 비교합니다.</p>
        <p className="mt-0.5 text-[10px] font-semibold text-ui-subtle">{formatAsOf(snapshot.observedAt)} 최신 15분 확정봉 기준</p>
        <div className="mt-2 grid gap-1.5">
          {evidenceGroups.map((group) => {
            const items = group.timeframes.map((timeframe) => snapshot.timeframes.find((item) => item.timeframe === timeframe));
            const trends = items.map((item) => item?.structure ?? "unknown");
            const groupState = trends.every((trend) => trend === "bullish")
              ? group.timeframes.length > 1 ? "모두 위쪽" : "위쪽 반응"
              : trends.every((trend) => trend === "bearish")
                ? group.timeframes.length > 1 ? "모두 아래쪽" : "아래쪽 반응"
                : trends.some((trend) => trend === "unknown")
                  ? "일부 확인 중"
                  : trends.includes("bullish") && trends.includes("bearish")
                    ? "방향 엇갈림"
                    : "방향이 뚜렷하지 않음";
            return (
              <div key={group.label} role="group" aria-label={`${group.label} ${group.detail}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 bg-ui-inset/55 px-2.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-black text-ui-text">{group.label}</p>
                  <p className="mt-0.5 text-[11px] font-semibold leading-4 text-ui-muted">{group.detail} · {groupState}</p>
                </div>
                <div className="flex gap-1" aria-label={`${group.label} 시간대별 방향`}>
                  {group.timeframes.map((timeframe, index) => (
                    <p key={timeframe} className="min-w-[4.5rem] bg-ui-panel/70 px-1.5 py-1 text-center text-[11px] font-semibold text-ui-muted">
                      <span className="block font-black text-ui-subtle">{items[index]?.label ?? timeframe}</span>
                      <HomeTimeframeDirection direction={items[index]?.structure ?? "unknown"} />
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 bg-ui-inset/35 px-2.5 py-2 text-[10.5px] font-semibold leading-4 text-ui-muted [word-break:keep-all]">
          파생 데이터 참고 · {snapshot.pressure.summary} · {snapshot.pressure.sourceLabel}
        </p>
        {snapshot.pro ? (
          <div className="mt-2 bg-ui-brand/8 px-3 py-2.5">
            <p className="text-[10px] font-black uppercase tracking-[0.1em] text-ui-brand">심화 교차확인</p>
            <p className="mt-1 text-[11px] font-black leading-4 text-ui-text [word-break:keep-all]">{snapshot.pro.insight.structure}</p>
            <p className="mt-1 text-[10.5px] font-semibold leading-4 text-ui-muted [word-break:keep-all]">{snapshot.pro.insight.transition}</p>
            <p className="mt-1 text-[10.5px] leading-4 text-ui-subtle [word-break:keep-all]">{snapshot.pro.insight.pressure}</p>
          </div>
        ) : null}
      </section>
    </section>
  );
}
