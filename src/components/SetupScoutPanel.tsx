"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Bot, CheckCircle2, Loader2, RefreshCw, Save, Sparkles, Target } from "lucide-react";
import {
  readScoutCache,
  scanAllSetups,
  topSetups,
  writeScoutCache,
  type ScoutSetup
} from "@/lib/setupScout";
import { appendJournalEntry } from "@/lib/journal";
import { createRemoteJournalEntry } from "@/lib/remoteJournal";
import { getSupabaseSession } from "@/lib/supabase";
import type { CommentaryInput } from "@/lib/ai/types";

type ScanState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; setups: ScoutSetup[]; cachedAt: number }
  | { status: "error"; message: string };

const numberFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 4,
  minimumFractionDigits: 2
});

function formatPrice(value: number) {
  if (!Number.isFinite(value)) return "-";
  if (value >= 100) return numberFormatter.format(Math.round(value * 100) / 100);
  return numberFormatter.format(value);
}

function formatCachedAt(ms: number) {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  return `${hr}시간 전`;
}

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 80
      ? "border-signal-success/40 bg-signal-success/15 text-signal-success"
      : score >= 65
        ? "border-accent-blue/40 bg-accent-blue/15 text-accent-blue"
        : "border-signal-warning/40 bg-signal-warning/15 text-signal-warning";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-black ${tone}`}>
      {score}점
    </span>
  );
}

function ProximityBadge({ setup }: { setup: ScoutSetup }) {
  if (setup.proximity === "ready") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-signal-success/40 bg-signal-success/15 px-2 py-1 text-[11px] font-black text-signal-success">
        진입 영역 내부
      </span>
    );
  }
  if (setup.proximity === "near") {
    const direction = setup.plan.side === "long" ? "내려오면" : "올라오면";
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-accent-blue/40 bg-accent-blue/10 px-2 py-1 text-[11px] font-black text-accent-blue">
        {Math.abs(setup.distancePercent).toFixed(2)}% {direction} 검토
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-slate-600/40 bg-slate-600/10 px-2 py-1 text-[11px] font-bold text-slate-400">
      대기 — {Math.abs(setup.distancePercent).toFixed(2)}% 차이
    </span>
  );
}

function killzoneLabel(value: ScoutSetup["analysis"]["killzone"]) {
  if (value === "asia") return "아시아 킬존";
  if (value === "london") return "런던 킬존";
  if (value === "newyork") return "뉴욕 킬존";
  return "킬존 외";
}

function formatPriceWithSymbol(price: number) {
  // 가격 크기에 따라 소수점 자리 자동 조정 (XRP/DOGE 같은 저가 코인 위해)
  if (!Number.isFinite(price) || price <= 0) return "-";
  let decimals = 2;
  if (price < 0.01) decimals = 6;
  else if (price < 1) decimals = 5;
  else if (price < 10) decimals = 4;
  else if (price < 100) decimals = 3;
  else decimals = 2;

  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(price);
}

function buildCommentaryInput(setup: ScoutSetup): CommentaryInput {
  const active = setup.analysis.timeframeAnalyses.find((a) => a.timeframe === setup.timeframe);
  const direction = setup.plan.side === "long" ? "bullish" : "bearish";
  const higherTfAlignedCount = setup.analysis.timeframeAnalyses
    .filter((a) => a.timeframe === "4h" || a.timeframe === "1d")
    .filter((a) => a.msb === direction).length;
  return {
    symbol: setup.symbol,
    timeframe: setup.timeframe,
    side: setup.plan.side,
    score: setup.score,
    currentPrice: setup.currentPrice,
    entryLow: setup.plan.entryLow,
    entryHigh: setup.plan.entryHigh,
    invalidation: setup.plan.invalidation,
    target1: setup.plan.target1,
    target2: setup.plan.target2,
    proximity: setup.proximity === "missed" ? "wait" : setup.proximity,
    distancePercent: setup.distancePercent,
    context: {
      killzone: setup.analysis.killzone,
      higherTfAlignedCount,
      inOte: active?.oteZone === setup.plan.side,
      inOb: active?.inOb === true,
      inFvg: active?.inFvg === true,
      quality: setup.plan.quality,
      riskFlags: setup.analysis.riskFlags ?? [],
      opportunityFlags: setup.analysis.opportunityFlags ?? []
    }
  };
}

type CommentaryState =
  | { status: "loading" }
  | { status: "ready"; text: string; cached: boolean }
  | { status: "error" };

function useCommentary(setup: ScoutSetup): CommentaryState {
  const [state, setState] = useState<CommentaryState>({ status: "loading" });
  const cacheKey = `${setup.symbol}|${setup.timeframe}|${setup.scannedAt}|${Math.round(setup.currentPrice * 100)}`;

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    const input = buildCommentaryInput(setup);
    fetch("/api/ai/commentary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ commentary: string; cached: boolean }>;
      })
      .then((payload) => {
        if (cancelled) return;
        setState({ status: "ready", text: payload.commentary, cached: payload.cached });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  return state;
}

function CommentaryLine({ setup }: { setup: ScoutSetup }) {
  const state = useCommentary(setup);

  if (state.status === "loading") {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-md border border-accent-blue/20 bg-accent-blue/5 px-3 py-2 text-[11px] leading-5 text-slate-400">
        <Loader2 size={12} className="animate-spin text-accent-blue" aria-hidden />
        <span>AI 코멘트 생성 중...</span>
      </div>
    );
  }
  if (state.status === "error") return null;

  return (
    <div className="mt-3 flex items-start gap-2 rounded-md border border-accent-blue/20 bg-accent-blue/5 px-3 py-2 text-[12px] leading-5 text-slate-200">
      <Bot size={13} className="mt-0.5 shrink-0 text-accent-blue" aria-hidden />
      <p className="font-medium">{state.text}</p>
    </div>
  );
}

function buildEvidence(setup: ScoutSetup) {
  const active = setup.analysis.timeframeAnalyses.find((a) => a.timeframe === setup.timeframe);
  const direction = setup.plan.side === "long" ? "bullish" : "bearish";
  const higherAlignedCount = setup.analysis.timeframeAnalyses
    .filter((a) => a.timeframe === "4h" || a.timeframe === "1d")
    .filter((a) => a.msb === direction).length;

  const evidence = [
    `상위 TF 정합 ${higherAlignedCount}/2`,
    `${setup.plan.quality}급 후보`,
    killzoneLabel(setup.analysis.killzone)
  ];

  if (active?.oteZone === setup.plan.side) evidence.push("OTE 일치");
  if (active?.inOb) evidence.push("OB 내부");
  if (active?.inFvg) evidence.push("FVG 내부");

  return evidence;
}

function EvidenceChips({ setup }: { setup: ScoutSetup }) {
  const evidence = buildEvidence(setup);
  const risks = setup.analysis.riskFlags.slice(0, 2);

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {evidence.map((item) => (
          <span
            key={item}
            className="rounded-md border border-signal-success/20 bg-signal-success/10 px-2 py-1 text-[11px] font-bold text-signal-success"
          >
            {item}
          </span>
        ))}
      </div>
      {risks.length ? (
        <div className="flex flex-wrap gap-1.5">
          {risks.map((item) => (
            <span
              key={item}
              className="rounded-md border border-signal-warning/20 bg-signal-warning/10 px-2 py-1 text-[11px] font-bold text-signal-warning"
            >
              {item}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function buildJournalNote(setup: ScoutSetup) {
  const evidence = buildEvidence(setup);
  const risks = setup.analysis.riskFlags.slice(0, 5);
  const opportunities = setup.analysis.opportunityFlags.slice(0, 5);

  return [
    `Setup Scout 저장: ${setup.headline}`,
    `현재가: ${formatPriceWithSymbol(setup.currentPrice)}`,
    `검토 영역: ${formatPriceWithSymbol(setup.plan.entryLow)} ~ ${formatPriceWithSymbol(setup.plan.entryHigh)}`,
    `무효화 기준 후보: ${formatPriceWithSymbol(setup.plan.invalidation)}`,
    `목표 후보: ${formatPriceWithSymbol(setup.plan.target1)} / ${formatPriceWithSymbol(setup.plan.target2)}`,
    "",
    "체크포인트:",
    ...evidence.map((item) => `- ${item}`),
    "",
    "위험 신호:",
    ...(risks.length ? risks.map((item) => `- ${item}`) : ["- 별도 위험 신호 없음"]),
    "",
    "기회 신호:",
    ...(opportunities.length ? opportunities.map((item) => `- ${item}`) : ["- 별도 기회 신호 없음"])
  ].join("\n");
}

function SetupCard({ setup, rank }: { setup: ScoutSetup; rank: number }) {
  const isLong = setup.plan.side === "long";
  const sideColor = isLong ? "text-signal-success" : "text-signal-danger";
  const SideIcon = isLong ? ArrowUpRight : ArrowDownRight;
  const sym = setup.symbol.replace("USDT.P", "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function saveSetup() {
    setSaveState("saving");
    const payload = {
      title: setup.headline,
      bias: isLong ? "롱" : "숏",
      note: buildJournalNote(setup),
      source: "chart" as const,
      symbol: setup.symbol,
      timeframe: setup.timeframe,
      verdict: `${setup.score}점 · ${setup.plan.quality}급 · ${setup.proximity === "ready" ? "영역 내부" : "검토 대기"}`
    };

    const session = getSupabaseSession();
    try {
      if (session) {
        await createRemoteJournalEntry(session.accessToken, payload);
      } else {
        appendJournalEntry(payload);
      }
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1800);
    } catch {
      setSaveState("error");
      window.setTimeout(() => setSaveState("idle"), 2200);
    }
  }

  return (
    <article className="rounded-lg border border-surface-line bg-surface-cardSoft p-4 transition hover:border-accent-blue/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-500">TOP {rank}</p>
          <div className="mt-1 flex items-center gap-2">
            <h3 className="text-base font-black text-white">{sym}</h3>
            <span className="rounded border border-white/10 bg-black/20 px-1.5 py-0.5 text-xs font-bold text-slate-300">
              {setup.timeframe}
            </span>
            <SideIcon className={sideColor} size={16} aria-hidden />
            <span className={`text-xs font-bold ${sideColor}`}>{isLong ? "롱" : "숏"}</span>
            <span className="rounded border border-accent-blue/30 bg-accent-blue/10 px-1.5 py-0.5 text-xs font-bold text-accent-blue">
              {setup.plan.quality}급
            </span>
          </div>
        </div>
        <ScoreBadge score={setup.score} />
      </div>

      <div className="mt-3">
        <ProximityBadge setup={setup} />
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-300">{setup.plan.entryLabel}</p>

      <EvidenceChips setup={setup} />

      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded border border-white/10 bg-black/30 px-2 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">현재가</p>
          <p className="mt-1 text-xs font-bold text-white">{formatPriceWithSymbol(setup.currentPrice)}</p>
        </div>
        <div className="rounded border border-accent-blue/20 bg-accent-blue/5 px-2 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-accent-blue">검토 영역</p>
          <p className="mt-1 text-xs font-bold text-white">
            {formatPriceWithSymbol(setup.plan.entryLow)} ~ {formatPriceWithSymbol(setup.plan.entryHigh)}
          </p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-center">
        <div className="rounded border border-signal-danger/20 bg-signal-danger/10 px-2 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-signal-danger">무효화 기준 후보</p>
          <p className="mt-1 text-xs font-bold text-white">{formatPriceWithSymbol(setup.plan.invalidation)}</p>
        </div>
        <div className="rounded border border-signal-success/20 bg-signal-success/10 px-2 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-signal-success">1차 목표 후보</p>
          <p className="mt-1 text-xs font-bold text-white">{formatPriceWithSymbol(setup.plan.target1)}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Target size={12} aria-hidden /> 신뢰도 {setup.plan.confidence}%
        </span>
        <span className="font-bold text-slate-400">2차 후보 {formatPriceWithSymbol(setup.plan.target2)}</span>
      </div>

      <CommentaryLine setup={setup} />

      <button
        type="button"
        onClick={saveSetup}
        disabled={saveState === "saving"}
        className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-accent-blue/30 bg-accent-blue/10 px-3 text-xs font-black text-accent-blue transition hover:bg-accent-blue hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saveState === "saving" ? <Loader2 size={14} className="animate-spin" aria-hidden /> : saveState === "saved" ? <CheckCircle2 size={14} aria-hidden /> : <Save size={14} aria-hidden />}
        {saveState === "saving" ? "저장 중" : saveState === "saved" ? "복기에 저장됨" : saveState === "error" ? "저장 실패" : "이 셋업 복기 저장"}
      </button>

      {setup.plan.cautions.length > 0 ? (
        <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-slate-500">
          ⚠ {setup.plan.cautions[0]}
        </p>
      ) : null}
    </article>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-surface-line bg-surface-cardSoft p-5 text-center">
      <p className="text-sm font-bold text-slate-300">현재 검토할 셋업이 없습니다.</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        시장이 관망 구간이거나 구조가 명확하지 않은 시점입니다. 잠시 후 다시 스캔해보세요.
      </p>
    </div>
  );
}

export function SetupScoutPanel() {
  const [state, setState] = useState<ScanState>({ status: "idle" });

  const runScan = useCallback(async (force = false) => {
    if (!force) {
      const cached = readScoutCache();
      if (cached) {
        setState({ status: "ready", setups: cached.setups, cachedAt: cached.cachedAt });
        return;
      }
    }

    setState({ status: "loading" });
    try {
      const setups = await scanAllSetups();
      const top = topSetups(setups, 3);
      writeScoutCache(top);
      setState({ status: "ready", setups: top, cachedAt: Date.now() });
    } catch (error) {
      const message = error instanceof Error ? error.message : "스캔에 실패했습니다.";
      setState({ status: "error", message });
    }
  }, []);

  useEffect(() => {
    runScan(false);
  }, [runScan]);

  const cacheLabel = useMemo(() => {
    if (state.status !== "ready") return null;
    return formatCachedAt(state.cachedAt);
  }, [state]);

  return (
    <section className="rounded-lg border border-accent-blue/25 bg-surface-card p-4 shadow-glow sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-accent-blue/30 bg-accent-blue/15 text-accent-blue">
            <Sparkles size={21} aria-hidden />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white">AI Setup Scout</h2>
              <span className="rounded border border-accent-blue/30 bg-accent-blue/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-blue">
                Beta
              </span>
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              주요 종목 × 활성 TF를 자동 스캔해 오늘 검토할 만한 셋업 TOP 3를 보여줍니다.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {cacheLabel ? <span className="text-xs text-slate-500">{cacheLabel} 갱신</span> : null}
          <button
            type="button"
            onClick={() => runScan(true)}
            disabled={state.status === "loading"}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-surface-line bg-surface-cardSoft px-3 text-xs font-bold text-slate-200 hover:border-accent-blue/50 hover:text-white disabled:opacity-50"
          >
            <RefreshCw size={13} className={state.status === "loading" ? "animate-spin" : ""} aria-hidden />
            새로 스캔
          </button>
        </div>
      </div>

      <div className="mt-4">
        {state.status === "loading" ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-surface-line bg-surface-cardSoft p-8 text-sm text-slate-400">
            <Loader2 size={18} className="animate-spin" aria-hidden />
            15개 조합 분석 중...
          </div>
        ) : state.status === "error" ? (
          <div className="rounded-lg border border-signal-danger/30 bg-signal-danger/10 p-4 text-sm text-signal-danger">
            {state.message}
          </div>
        ) : state.status === "ready" ? (
          state.setups.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {state.setups.map((setup, idx) => (
                <SetupCard key={`${setup.symbol}-${setup.timeframe}`} setup={setup} rank={idx + 1} />
              ))}
            </div>
          )
        ) : null}
      </div>

      <p className="mt-3 text-[11px] leading-5 text-slate-500">
        스캔 결과는 5분 단위 캐시됩니다. 이 값은 매수·매도 신호가 아니며, 검토 영역과 무효화 기준 후보는 반드시 본인의 차트 판독과 매매 원칙으로 다시 확인하세요.
      </p>
    </section>
  );
}
