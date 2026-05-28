"use client";
// 시장 보드와 레이더 감지를 합쳐 짧은 브리핑과 질문 카드를 보여주는 컴포넌트

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Brain, HelpCircle, Loader2, Newspaper, Radar, Sparkles } from "lucide-react";
import type { ScoutSetup } from "@/lib/setupScout";
import type { TradingMode } from "@/lib/marketAnalysis";
import { withSupabaseAuth } from "@/lib/authFetch";

interface MarketBoardItem {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  quoteVolume: number;
}

type DigestState =
  | { status: "loading" }
  | { status: "ready"; board: MarketBoardItem[]; setups: ScoutSetup[]; cachedAt: number }
  | { status: "error"; message: string };

const scanModes: TradingMode[] = ["scalp", "swing"];

function compactSymbol(symbol: string) {
  return symbol.replace("USDT.P", "").replace("USDT", "");
}

function formatPrice(price: number) {
  if (!Number.isFinite(price) || price <= 0) return "-";
  const digits = price >= 100 ? 2 : price >= 10 ? 3 : price >= 1 ? 4 : 5;
  return price.toLocaleString("ko-KR", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function formatVolume(value: number) {
  if (!Number.isFinite(value)) return "-";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  return value.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

function statusRank(setup: ScoutSetup) {
  if (setup.status === "entry") return 4;
  if (setup.status === "active") return 3;
  if (setup.proximity === "ready") return 2;
  if (setup.proximity === "near") return 1;
  return 0;
}

function rankSetups(setups: ScoutSetup[]) {
  return [...setups].sort((a, b) => {
    const statusDiff = statusRank(b) - statusRank(a);
    if (statusDiff !== 0) return statusDiff;
    return b.score - a.score;
  });
}

function uniqueSetupsBySymbol(setups: ScoutSetup[]) {
  const picked: ScoutSetup[] = [];
  const usedSymbols = new Set<string>();

  for (const setup of rankSetups(setups)) {
    if (usedSymbols.has(setup.symbol)) continue;
    picked.push(setup);
    usedSymbols.add(setup.symbol);
  }

  return picked;
}

function marketTone(board: MarketBoardItem[]) {
  const up = board.filter((item) => item.changePercent > 0).length;
  const down = board.filter((item) => item.changePercent < 0).length;
  if (up >= down + 3) return { label: "상승 우위", tone: "long" as const, up, down };
  if (down >= up + 3) return { label: "하락 우위", tone: "short" as const, up, down };
  return { label: "혼조", tone: "neutral" as const, up, down };
}

function toneClasses(tone: "long" | "short" | "neutral") {
  if (tone === "long") return "border-signal-success/30 bg-signal-success/10 text-signal-success";
  if (tone === "short") return "border-signal-danger/30 bg-signal-danger/10 text-signal-danger";
  return "border-signal-warning/30 bg-signal-warning/10 text-signal-warning";
}

function sideText(side: ScoutSetup["plan"]["side"]) {
  return side === "long" ? "롱 우세" : "숏 우세";
}

function sideClasses(side: ScoutSetup["plan"]["side"]) {
  return side === "long"
    ? "border-signal-success/30 bg-signal-success/10 text-signal-success"
    : "border-signal-danger/30 bg-signal-danger/10 text-signal-danger";
}

export function RadarDigestPanel() {
  const [state, setState] = useState<DigestState>({ status: "loading" });
  const [selectedQuestion, setSelectedQuestion] = useState(0);

  const loadDigest = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const [boardResponse, ...scanResponses] = await Promise.all([
        fetch("/api/market-board", { cache: "no-store" }),
        ...scanModes.map(async (mode) => fetch(`/api/scout?mode=${mode}&risk=radar`, await withSupabaseAuth({ cache: "no-store" })))
      ]);

      const boardPayload = (await boardResponse.json().catch(() => ({}))) as {
        items?: MarketBoardItem[];
        cachedAt?: number;
        error?: string;
      };
      if (!boardResponse.ok || !Array.isArray(boardPayload.items)) {
        throw new Error(boardPayload.error ?? "시장 흐름을 잠시 확인하지 못했습니다.");
      }

      const scanPayloads = await Promise.all(
        scanResponses.map(async (response) => {
          const payload = (await response.json().catch(() => ({}))) as {
            setups?: ScoutSetup[];
            cachedAt?: number;
            error?: string;
          };
          if (!response.ok || !Array.isArray(payload.setups)) {
            throw new Error(payload.error ?? "레이더 감지값을 잠시 확인하지 못했습니다.");
          }
          return payload;
        })
      );

      setState({
        status: "ready",
        board: boardPayload.items,
        setups: scanPayloads.flatMap((item) => item.setups ?? []),
        cachedAt: Math.max(boardPayload.cachedAt ?? Date.now(), ...scanPayloads.map((item) => item.cachedAt ?? Date.now()))
      });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "레이더 노트를 잠시 확인하지 못했습니다."
      });
    }
  }, []);

  useEffect(() => {
    void loadDigest();
  }, [loadDigest]);

  const digest = useMemo(() => {
    if (state.status !== "ready") return null;
    const ranked = uniqueSetupsBySymbol(state.setups);
    const tone = marketTone(state.board);
    const volumeLeader = [...state.board].sort((a, b) => b.quoteVolume - a.quoteVolume)[0] ?? null;
    const gainer = [...state.board].sort((a, b) => b.changePercent - a.changePercent)[0] ?? null;
    const loser = [...state.board].sort((a, b) => a.changePercent - b.changePercent)[0] ?? null;
    const leader = ranked[0] ?? null;
    const longCount = ranked.filter((item) => item.plan.side === "long").length;
    const shortCount = ranked.filter((item) => item.plan.side === "short").length;

    return { ranked, tone, volumeLeader, gainer, loser, leader, longCount, shortCount };
  }, [state]);

  const questions = useMemo(() => {
    if (!digest) return [];
    const leaderName = digest.leader ? compactSymbol(digest.leader.symbol) : "BTC";
    return [
      {
        title: "지금 먼저 볼 코인은?",
        body: digest.leader
          ? `${leaderName} ${digest.leader.timeframe}에서 ${sideText(digest.leader.plan.side)} 감지가 가장 위에 있습니다. 지금 먼저 확인할 관찰 우선순위입니다.`
          : "현재는 강한 감지가 적습니다. 이럴 때는 급등률보다 거래대금과 상위 타임프레임 정렬을 먼저 보는 편이 좋습니다."
      },
      {
        title: "시장이 한쪽으로 쏠렸나?",
        body: `${digest.tone.label}입니다. 주요 코인 중 상승 ${digest.tone.up}개, 하락 ${digest.tone.down}개로 잡히며, 레이더 감지는 롱 ${digest.longCount}개, 숏 ${digest.shortCount}개입니다.`
      },
      {
        title: "추격 위험은 어디서 보나?",
        body: digest.gainer
          ? `${digest.gainer.name}이 24시간 기준 ${digest.gainer.changePercent.toFixed(2)}%로 가장 강합니다. 강한 코인일수록 바로 따라가기보다 OB, FVG, POC 재접촉 여부를 확인해야 합니다.`
          : "급등 코인이 뚜렷하지 않습니다. 추격보다 횡보 상단과 하단에서 스윕이 나오는지 확인하세요."
      },
      {
        title: "거래대금은 어디에 몰렸나?",
        body: digest.volumeLeader
          ? `${digest.volumeLeader.name} 거래대금이 ${formatVolume(digest.volumeLeader.quoteVolume)}로 가장 큽니다. 레이더는 거래대금이 몰린 코인부터 구조 변화를 확인하는 흐름으로 쓰는 편이 좋습니다.`
          : "거래대금 데이터를 아직 읽지 못했습니다. 잠시 후 다시 갱신해보세요."
      }
    ];
  }, [digest]);

  const activeQuestion = questions[selectedQuestion] ?? questions[0];

  return (
    <section id="market-digest" className="scroll-mt-24 border-y border-accent-blue/25 py-4 sm:py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center text-accent-blue">
            <Newspaper size={19} aria-hidden />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-accent-blue">Radar Note</p>
            <h2 className="mt-1 text-lg font-black text-white">오늘의 레이더 노트</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400 [word-break:keep-all]">
              시장 보드와 구조 감지를 합쳐서 지금 무엇을 먼저 확인할지 짧게 정리합니다.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadDigest}
          disabled={state.status === "loading"}
          className="inline-flex min-h-9 items-center justify-center rounded-md border border-surface-line bg-surface-cardSoft px-3 text-xs font-bold text-slate-300 hover:border-accent-blue/50 hover:text-white disabled:cursor-wait disabled:opacity-70"
        >
          다시 요약
        </button>
      </div>

      {state.status === "loading" ? (
        <div className="mt-4 flex min-h-32 items-center justify-center gap-2 border-y border-surface-line text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin text-accent-blue" aria-hidden />
          레이더 노트를 정리하는 중입니다.
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="mt-4 border-y border-signal-danger/30 py-4 text-sm text-signal-danger">
          {state.message}
        </div>
      ) : null}

      {digest && activeQuestion ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.1fr]">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <div className={`border-y py-3 ${toneClasses(digest.tone.tone)}`}>
              <p className="text-[11px] font-bold opacity-80">시장 흐름</p>
              <p className="mt-1 text-xl font-black">{digest.tone.label}</p>
              <p className="mt-1 text-xs font-semibold opacity-80">상승 {digest.tone.up} · 하락 {digest.tone.down}</p>
            </div>
            <div className="border-y border-white/10 py-3">
              <p className="text-[11px] font-bold text-slate-400">거래대금 1위</p>
              <p className="mt-1 text-xl font-black text-white">{digest.volumeLeader?.name ?? "-"}</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                {digest.volumeLeader ? `${formatVolume(digest.volumeLeader.quoteVolume)} · ${formatPrice(digest.volumeLeader.price)}` : "데이터 대기"}
              </p>
            </div>
            <div className="border-y border-white/10 py-3 sm:col-span-2 lg:col-span-1">
              <p className="text-[11px] font-bold text-slate-400">레이더 최상단</p>
              {digest.leader ? (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-xl font-black text-white">{compactSymbol(digest.leader.symbol)}</span>
                  <span className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs font-bold text-slate-300">
                    {digest.leader.timeframe}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-black ${sideClasses(digest.leader.plan.side)}`}>
                    {digest.leader.plan.side === "long" ? <ArrowUpRight size={12} aria-hidden /> : <ArrowDownRight size={12} aria-hidden />}
                    {sideText(digest.leader.plan.side)}
                  </span>
                  <span className="rounded border border-accent-blue/30 bg-accent-blue/10 px-2 py-1 text-xs font-black text-accent-blue">
                    {digest.leader.score}점
                  </span>
                </div>
              ) : (
                <p className="mt-1 text-sm font-semibold text-slate-400">강한 감지 없음</p>
              )}
            </div>
          </div>

          <div className="border-y border-white/10 py-3">
            <div className="flex items-start gap-2">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-accent-blue/25 bg-accent-blue/10 text-accent-blue">
                <Brain size={17} aria-hidden />
              </div>
              <div>
                <p className="text-xs font-bold text-accent-blue">오늘 바로 물어볼 질문</p>
                <h3 className="mt-1 text-base font-black text-white">{activeQuestion.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300 [word-break:keep-all]">{activeQuestion.body}</p>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {questions.map((question, index) => (
                <button
                  key={question.title}
                  type="button"
                  onClick={() => setSelectedQuestion(index)}
                  className={`min-h-10 rounded-md border px-3 text-left text-xs font-black transition [word-break:keep-all] ${
                    selectedQuestion === index
                      ? "border-accent-blue bg-accent-blue text-slate-950"
                      : "border-white/10 bg-black/20 text-slate-300 hover:border-accent-blue/50 hover:text-white"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {index === 0 ? <Sparkles size={13} aria-hidden /> : <HelpCircle size={13} aria-hidden />}
                    {question.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
