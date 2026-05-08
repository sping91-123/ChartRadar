"use client";
// 시장 전체 레이더 요약을 첫 화면에 보여주는 지휘판 컴포넌트

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, Loader2, Radar, RefreshCw, ShieldAlert } from "lucide-react";
import type { TradingMode } from "@/lib/marketAnalysis";
import type { ScoutSetup } from "@/lib/setupScout";

type RadarState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; setups: ScoutSetup[]; cachedAt: number }
  | { status: "error"; message: string };

const modes: TradingMode[] = ["scalp", "swing"];

function symbolName(symbol: string) {
  return symbol.replace("USDT.P", "").replace("USDT", "");
}

function formatCachedAt(ms: number) {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 갱신";
  if (min < 60) return `${min}분 전 갱신`;
  return `${Math.floor(min / 60)}시간 전 갱신`;
}

function statusRank(setup: ScoutSetup) {
  if (setup.status === "entry") return 4;
  if (setup.status === "active") return 3;
  if (setup.proximity === "ready") return 2;
  if (setup.proximity === "near") return 1;
  return 0;
}

function qualityRank(setup: ScoutSetup) {
  if (setup.plan.quality === "A") return 3;
  if (setup.plan.quality === "B") return 2;
  return 1;
}

function rankSetups(setups: ScoutSetup[]) {
  return [...setups].sort((a, b) => {
    const statusDelta = statusRank(b) - statusRank(a);
    if (statusDelta !== 0) return statusDelta;
    const qualityDelta = qualityRank(b) - qualityRank(a);
    if (qualityDelta !== 0) return qualityDelta;
    return b.score - a.score;
  });
}

function uniqueTopSetupsBySymbol(setups: ScoutSetup[], limit: number) {
  const picked: ScoutSetup[] = [];
  const usedSymbols = new Set<string>();

  for (const setup of rankSetups(setups)) {
    if (usedSymbols.has(setup.symbol)) continue;
    picked.push(setup);
    usedSymbols.add(setup.symbol);
    if (picked.length >= limit) break;
  }

  return picked;
}

function sideClasses(side: ScoutSetup["plan"]["side"]) {
  return side === "long"
    ? "border-signal-success/30 bg-signal-success/10 text-signal-success"
    : "border-signal-danger/30 bg-signal-danger/10 text-signal-danger";
}

function proximityLabel(setup: ScoutSetup) {
  if (setup.proximity === "ready") return "관찰 구간 내부";
  if (setup.proximity === "near") return `${Math.abs(setup.distancePercent).toFixed(2)}% 근접`;
  if (setup.proximity === "missed") return "이미 지나간 구조";
  return `${Math.abs(setup.distancePercent).toFixed(2)}% 대기`;
}

function buildMarketSentence(setups: ScoutSetup[]) {
  if (setups.length === 0) {
    return "현재 레이더는 무리해서 볼 만한 코인을 강하게 잡지 못했습니다. 지금은 시장이 더 선명해질 때까지 관찰하는 쪽이 자연스럽습니다.";
  }

  const longCount = setups.filter((setup) => setup.plan.side === "long").length;
  const shortCount = setups.filter((setup) => setup.plan.side === "short").length;
  const readyCount = setups.filter((setup) => setup.proximity === "ready" || setup.proximity === "near").length;
  const leader = rankSetups(setups)[0];
  const side = longCount > shortCount ? "롱" : shortCount > longCount ? "숏" : "양방향";
  const focus = leader ? `${symbolName(leader.symbol)} ${leader.timeframe}` : "주요 코인";

  return `${side} 쪽 감지가 더 많고, ${readyCount}개 구조가 관찰 구간 근처에 있습니다. 지금은 ${focus}부터 확인하는 흐름이 가장 선명합니다.`;
}

function RadarSetupCard({ setup, rank }: { setup: ScoutSetup; rank: number }) {
  const isLong = setup.plan.side === "long";
  const SideIcon = isLong ? ArrowUpRight : ArrowDownRight;

  return (
    <article className="rounded-lg border border-white/10 bg-black/25 p-3 [word-break:keep-all]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-black text-slate-500">RADAR {rank}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <h3 className="text-base font-black text-white">{symbolName(setup.symbol)}</h3>
            <span className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
              {setup.timeframe}
            </span>
            <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-black ${sideClasses(setup.plan.side)}`}>
              <SideIcon size={11} aria-hidden />
              {isLong ? "롱 우세" : "숏 우세"}
            </span>
          </div>
        </div>
        <span className="whitespace-nowrap rounded border border-accent-blue/30 bg-accent-blue/10 px-2 py-1 text-[11px] font-black text-accent-blue">
          {setup.score}점
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300">{setup.headline}</p>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-bold">
        <span className="rounded border border-signal-warning/25 bg-signal-warning/10 px-2 py-1 text-signal-warning">
          {proximityLabel(setup)}
        </span>
        <span className="rounded border border-white/10 bg-black/30 px-2 py-1 text-slate-300">
          {setup.plan.quality}급 감지
        </span>
        <span className="rounded border border-white/10 bg-black/30 px-2 py-1 text-slate-300">
          신뢰도 {setup.plan.confidence}%
        </span>
      </div>
    </article>
  );
}

export function RadarCommandCenter() {
  const [state, setState] = useState<RadarState>({ status: "idle" });

  const loadRadar = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const results = await Promise.all(
        modes.map(async (mode) => {
          const response = await fetch(`/api/scout?mode=${mode}&risk=radar`, { cache: "no-store" });
          const payload = (await response.json().catch(() => ({}))) as {
            setups?: ScoutSetup[];
            cachedAt?: number;
            error?: string;
          };
          if (!response.ok || !Array.isArray(payload.setups)) {
            throw new Error(payload.error ?? "시장 레이더를 불러오지 못했습니다.");
          }
          return payload;
        })
      );

      const setups = results.flatMap((item) => item.setups ?? []);
      const cachedAt = Math.max(...results.map((item) => item.cachedAt ?? Date.now()));
      setState({ status: "ready", setups, cachedAt });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "시장 레이더를 불러오지 못했습니다."
      });
    }
  }, []);

  useEffect(() => {
    void loadRadar();
  }, [loadRadar]);

  const rankedSetups = useMemo(() => (state.status === "ready" ? rankSetups(state.setups) : []), [state]);
  const topSetups = useMemo(() => (state.status === "ready" ? uniqueTopSetupsBySymbol(state.setups, 3) : []), [state]);
  const strongCount = rankedSetups.filter((setup) => setup.status === "entry" || setup.status === "active").length;
  const watchCount = rankedSetups.filter((setup) => setup.status === "watch").length;
  const longCount = rankedSetups.filter((setup) => setup.plan.side === "long").length;
  const shortCount = rankedSetups.filter((setup) => setup.plan.side === "short").length;
  const marketSentence = buildMarketSentence(rankedSetups);
  const marketTone =
    longCount > shortCount
      ? "border-signal-success/30 bg-signal-success/10 text-signal-success"
      : shortCount > longCount
        ? "border-signal-danger/30 bg-signal-danger/10 text-signal-danger"
        : "border-signal-warning/30 bg-signal-warning/10 text-signal-warning";

  return (
    <section className="overflow-hidden rounded-lg border border-accent-blue/25 bg-surface-card shadow-glow">
      <div className="relative border-b border-surface-line bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_28rem)] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="radar-mark-lg h-16 w-16 shrink-0 border border-accent-blue/30" />
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-accent-blue">Market Radar Live</p>
              <h2 className="mt-1 text-2xl font-black text-white">오늘 먼저 볼 시장</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 [word-break:keep-all]">
                {state.status === "ready" ? marketSentence : "주요 코인과 타임프레임을 동시에 훑어 오늘 먼저 확인할 구조를 찾고 있습니다."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadRadar}
            disabled={state.status === "loading"}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-accent-blue/35 bg-accent-blue/10 px-3 text-sm font-black text-accent-blue hover:bg-accent-blue hover:text-slate-950 disabled:cursor-wait disabled:opacity-70"
          >
            <RefreshCw size={15} className={state.status === "loading" ? "animate-spin" : ""} aria-hidden />
            레이더 다시 돌리기
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-black/25 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
              <Activity size={13} aria-hidden />
              강한 감지
            </p>
            <p className="mt-1 text-2xl font-black text-white">{state.status === "ready" ? strongCount : "-"}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/25 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
              <Radar size={13} aria-hidden />
              관찰 대기
            </p>
            <p className="mt-1 text-2xl font-black text-white">{state.status === "ready" ? watchCount : "-"}</p>
          </div>
          <div className={`rounded-lg border p-3 ${marketTone}`}>
            <p className="text-[11px] font-bold opacity-80">방향 쏠림</p>
            <p className="mt-1 text-lg font-black">
              {state.status === "ready"
                ? longCount > shortCount
                  ? `롱 ${longCount} : 숏 ${shortCount}`
                  : shortCount > longCount
                    ? `숏 ${shortCount} : 롱 ${longCount}`
                    : `균형 ${longCount} : ${shortCount}`
                : "-"}
            </p>
          </div>
          <div className="rounded-lg border border-signal-warning/25 bg-signal-warning/10 p-3 text-signal-warning">
            <p className="flex items-center gap-1.5 text-[11px] font-bold opacity-80">
              <ShieldAlert size={13} aria-hidden />
              주의
            </p>
            <p className="mt-1 text-sm font-black">신호가 아니라 관찰 리포트</p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {state.status === "loading" ? (
          <div className="flex min-h-32 items-center justify-center gap-2 rounded-lg border border-surface-line bg-surface-cardSoft text-sm text-slate-400">
            <Loader2 size={18} className="animate-spin text-accent-blue" aria-hidden />
            시장 전체 레이더 스캔 중입니다.
          </div>
        ) : state.status === "error" ? (
          <div className="rounded-lg border border-signal-danger/30 bg-signal-danger/10 p-4 text-sm text-signal-danger">
            {state.message}
          </div>
        ) : state.status === "ready" ? (
          topSetups.length > 0 ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-black text-white">지금 먼저 확인할 TOP {topSetups.length}</h3>
                <span className="text-xs font-semibold text-slate-500">{formatCachedAt(state.cachedAt)}</span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {topSetups.map((setup, index) => (
                  <RadarSetupCard key={`${setup.symbol}-${setup.mode}-${setup.timeframe}`} setup={setup} rank={index + 1} />
                ))}
              </div>
            </>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["시장 보드 확인", "급등, 급락, 거래대금이 몰린 코인부터 변동성 위치를 확인하세요."],
                ["상위 TF 대기", "1h, 4h, 1d MSB와 CHoCH가 다시 같은 쪽으로 정렬되는지 보세요."],
                ["관심 코인 등록", "자주 보는 알트는 관심 코인에 넣어두면 레이더가 따로 훑어줍니다."]
              ].map(([title, text], index) => (
                <div key={title} className="rounded-lg border border-signal-warning/25 bg-signal-warning/10 p-3">
                  <p className="text-[11px] font-black text-signal-warning">대기 플랜 {index + 1}</p>
                  <p className="mt-1 text-sm font-black text-white">{title}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-300 [word-break:keep-all]">{text}</p>
                </div>
              ))}
            </div>
          )
        ) : null}
      </div>
    </section>
  );
}
