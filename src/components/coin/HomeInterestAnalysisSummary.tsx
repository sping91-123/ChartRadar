"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Clock3, Loader2, RefreshCw } from "lucide-react";
import { HomeInterestMiniChart } from "@/components/coin/HomeInterestMiniChart";
import { HomeTimeframeDirection } from "@/components/coin/HomeTimeframeDirection";
import { usePullToRefreshRegistration } from "@/components/PullToRefresh";
import { ActionButton } from "@/components/ui/DesignPrimitives";
import { withSupabaseAuth } from "@/lib/authFetch";
import type { HomeInterestAnalysisResponse, HomeInterestAnalysisSummary } from "@/lib/homeInterestAnalysis";
import type { HomeInterestCoin } from "@/lib/homeInterestCoins";
import { homeInterestDetailTarget } from "@/lib/homeInterestRouting";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

type SummaryState =
  | { status: "loading"; snapshot: null }
  | { status: "ready"; snapshot: HomeInterestAnalysisSummary }
  | { status: "refreshing"; snapshot: HomeInterestAnalysisSummary }
  | { status: "error"; snapshot: HomeInterestAnalysisSummary | null; message: string };

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
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

async function requestInterestSummary(coin: HomeInterestCoin, signal?: AbortSignal) {
  const params = new URLSearchParams({ exchange: coin.exchangeId, symbol: coin.symbol });
  const response = await fetch(
    `/api/crypto/home-interest-summary?${params.toString()}`,
    await withSupabaseAuth({ cache: "no-store", signal })
  );
  const payload = (await response.json().catch(() => ({}))) as HomeInterestAnalysisResponse;
  if (!response.ok || !payload.snapshot) throw new Error(payload.error ?? "관심코인 분석을 불러오지 못했습니다.");
  return payload.snapshot;
}

export function HomeInterestAnalysisSummary({ coin }: { coin: HomeInterestCoin }) {
  const { session } = useSupabaseAuth();
  const [state, setState] = useState<SummaryState>({ status: "loading", snapshot: null });
  const [refreshKey, setRefreshKey] = useState(0);
  const requestGeneration = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

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
      setState({ status: "ready", snapshot });
      return snapshot;
    } catch (error) {
      if (generation !== requestGeneration.current || (controller.signal.aborted && !timedOut)) return null;
      setState((current) => ({
        status: "error",
        snapshot: current.snapshot,
        message: error instanceof Error ? error.message : "관심코인 분석을 불러오지 못했습니다."
      }));
      return null;
    } finally {
      window.clearTimeout(timeout);
    }
  }, [coin]);

  const refreshFromPull = useCallback(async () => {
    const snapshot = await load(true);
    if (!snapshot) {
      setState((current) => current.status === "refreshing"
        ? { status: "ready", snapshot: current.snapshot }
        : current);
      throw new Error("관심코인 분석을 새로고침하지 못했습니다.");
    }
  }, [load]);
  usePullToRefreshRegistration(refreshFromPull);

  useEffect(() => {
    void load();
    return () => {
      requestGeneration.current += 1;
      abortRef.current?.abort();
    };
  }, [load, refreshKey, session?.accessToken]);

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
      <section className="bg-ui-panel px-4 py-5">
        <p className="text-base font-black text-ui-text">{coin.base} 분석을 준비하지 못했습니다.</p>
        <p className="mt-2 text-sm leading-6 text-ui-muted">{state.message}</p>
        <ActionButton tone="secondary" className="mt-4" onClick={() => setRefreshKey((value) => value + 1)}><RefreshCw size={15} aria-hidden /> 다시 불러오기</ActionButton>
      </section>
    );
  }

  const snapshot = state.snapshot;
  if (!snapshot) return null;
  const target = homeInterestDetailTarget(coin);
  const changeTone = snapshot.changePercent === null
    ? "text-ui-subtle"
    : snapshot.changePercent > 0
      ? "text-ui-long"
      : snapshot.changePercent < 0
        ? "text-ui-short"
        : "text-ui-muted";

  return (
    <section className="bg-ui-panel px-3 py-3 sm:px-4 sm:py-4" aria-labelledby="home-interest-decision-title">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-black text-ui-text">{snapshot.selection.base}/{snapshot.selection.quote}</p>
          <p className="truncate text-[10px] font-semibold text-ui-subtle">{snapshot.selection.exchangeLabel} 만기 없는 선물</p>
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <h1 id="home-interest-decision-title" className="min-w-0 text-[1.35rem] font-black leading-7 tracking-tight text-ui-text [word-break:keep-all]">
          {snapshot.summary.headline}
        </h1>
        <div className="shrink-0 text-right">
          <p className="text-xl font-black tabular-nums text-ui-text">{formatPrice(snapshot.price)}</p>
          <p className={`mt-0.5 text-[10px] font-black tabular-nums ${changeTone}`}>{formatChange(snapshot.changePercent)}</p>
          <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-ui-subtle"><Clock3 size={11} aria-hidden /> {formatAsOf(snapshot.updatedAt)} 기준</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="bg-ui-risk/10 px-3 py-2.5">
          <p className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.1em] text-ui-risk"><AlertTriangle size={12} aria-hidden /> 가장 큰 위험</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-ui-text [word-break:keep-all]">{snapshot.summary.topRisk}</p>
        </div>
        <div className="bg-ui-inset/65 px-3 py-2.5">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-ui-brand">다음 확인</p>
          <p className="mt-1 text-xs font-black leading-5 text-ui-text [word-break:keep-all]">{snapshot.summary.nextCheck}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1" aria-label="시간대별 흐름">
        {snapshot.timeframes.map((item) => (
          <p key={item.timeframe} className="bg-ui-inset/40 px-2 py-1.5 text-center text-[10px] font-semibold text-ui-muted">
            <span className="block font-black text-ui-text">{item.label}</span>
            <HomeTimeframeDirection direction={item.structure} />
          </p>
        ))}
      </div>

      {snapshot.pro ? (
        <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[10px]">
          {snapshot.pro.timeframes.map((item) => (
            <p key={item.timeframe} className="bg-ui-inset/35 px-1.5 py-2 text-ui-muted"><span className="block font-black text-ui-text">{item.label} 점수</span>{item.score > 0 ? "+" : ""}{item.score.toFixed(2)}</p>
          ))}
          <p className="bg-ui-inset/35 px-1.5 py-2 text-ui-muted"><span className="block font-black text-ui-text">롱/숏 압력</span>{snapshot.pro.pressure ? `${snapshot.pro.pressure.longScore}/${snapshot.pro.pressure.shortScore}` : "확인 중"}</p>
        </div>
      ) : null}

      <Link href={target.href} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-ui-sm bg-ui-brand px-4 text-sm font-black text-white transition hover:brightness-110">
        {target.label} <ArrowRight size={16} aria-hidden />
      </Link>
      {!target.exact ? <p className="mt-1.5 text-center text-[10px] font-semibold leading-4 text-ui-muted">선택한 거래소·종목의 홈 요약입니다. 상세 화면은 지원 중인 알트 레이더 전체를 엽니다.</p> : null}

      <div className="mt-3 bg-ui-inset/25 px-1 py-2">
        <div className="mb-2 flex items-center justify-between gap-2 px-2">
          <p className="text-[11px] font-black text-ui-text">시간대별 가격 흐름</p>
          <span className="text-[10px] font-semibold text-ui-subtle">확정 봉 비교</span>
        </div>
        <HomeInterestMiniChart
          candles={snapshot.chart.candles}
          candlesByTimeframe={snapshot.chart.candlesByTimeframe}
          symbol={`${snapshot.selection.base}/${snapshot.selection.quote}`}
          asOf={snapshot.updatedAt}
        />
      </div>
      {state.status === "error" ? (
        <div role="alert" className="mt-2 flex items-center justify-between gap-3 bg-ui-risk/10 px-3 py-2 text-xs font-semibold text-ui-risk">
          <span>최신 갱신에 실패해 마지막 정상 분석을 보여드립니다.</span>
          <button type="button" onClick={() => setRefreshKey((value) => value + 1)} className="min-h-11 shrink-0 underline">다시 시도</button>
        </div>
      ) : null}
    </section>
  );
}
