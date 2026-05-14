"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Radar,
  Save,
  Target
} from "lucide-react";
import {
  readScoutCache,
  writeScoutCache,
  type ScoutRiskProfile,
  type ScoutScope,
  type ScoutSetup
} from "@/lib/setupScout";
import { appendJournalEntry, type ScoutSnapshot } from "@/lib/journal";
import { createRemoteJournalEntry } from "@/lib/remoteJournal";
import { getActiveSupabaseSession } from "@/lib/supabase";
import type { CommentaryInput } from "@/lib/ai/types";
import type { TradingMode } from "@/lib/marketAnalysis";
import { getUsageGate, recordUsageEvent } from "@/lib/usageMeter";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { hasMarketEntitlement } from "@/lib/billing";

type ScanState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; setups: ScoutSetup[]; cachedAt: number }
  | { status: "error"; message: string };

type CommentaryState =
  | { status: "loading" }
  | { status: "ready"; text: string; cached: boolean }
  | { status: "error" };

const numberFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 4,
  minimumFractionDigits: 2
});
const scoutRiskProfileStorageKey = "chartRadar.scoutRiskProfile.v1";
const legacyScoutRiskProfileStorageKeys = ["untitledRisk.scoutRiskProfile.v1", `${"position"}${"guard"}.scoutRiskProfile.v1`];

function readStoredScoutRiskProfile(): ScoutRiskProfile {
  if (typeof window === "undefined") return "radar";
  const stored =
    window.localStorage.getItem(scoutRiskProfileStorageKey) ??
    legacyScoutRiskProfileStorageKeys.map((key) => window.localStorage.getItem(key)).find((value): value is string => value !== null);
  if (stored) {
    window.localStorage.setItem(scoutRiskProfileStorageKey, stored);
    legacyScoutRiskProfileStorageKeys.forEach((key) => window.localStorage.removeItem(key));
  }
  return stored === "guard" ? "guard" : "radar";
}

function formatCachedAt(ms: number) {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  return `${hr}시간 전`;
}

function formatPriceWithSymbol(price: number) {
  if (!Number.isFinite(price) || price <= 0) return "-";
  let decimals = 2;
  if (price < 0.01) decimals = 6;
  else if (price < 1) decimals = 5;
  else if (price < 10) decimals = 4;
  else if (price < 100) decimals = 3;

  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(price);
}

function formatDistance(value: number) {
  return numberFormatter.format(Math.abs(value));
}

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 80
      ? "border-signal-success/40 bg-signal-success/15 text-signal-success"
      : score >= 65
        ? "border-accent-blue/40 bg-accent-blue/15 text-accent-blue"
        : "border-signal-warning/40 bg-signal-warning/15 text-signal-warning";

  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-1 text-xs font-black ${tone}`}>
      {score}점
    </span>
  );
}

function StatusBadge({ setup, riskProfile }: { setup: ScoutSetup; riskProfile: ScoutRiskProfile }) {
  if (setup.status === "active") {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-orange-400/40 bg-orange-400/15 px-2 py-1 text-[11px] font-black text-orange-300">
        강한 감지
      </span>
    );
  }

  if (setup.status === "watch" && setup.watchKind === "counter") {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-orange-400/40 bg-orange-400/15 px-2 py-1 text-[11px] font-black text-orange-300">
        반대 구간 감시
      </span>
    );
  }

  if (setup.status === "watch") {
    if (riskProfile === "radar") {
      return (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-accent-blue/40 bg-accent-blue/15 px-2 py-1 text-[11px] font-black text-accent-blue">
          공격적 관찰
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-signal-warning/40 bg-signal-warning/15 px-2 py-1 text-[11px] font-black text-signal-warning">
        관찰 대기
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-signal-success/40 bg-signal-success/15 px-2 py-1 text-[11px] font-black text-signal-success">
      레이더 감지
    </span>
  );
}

function ProximityBadge({ setup }: { setup: ScoutSetup }) {
  if (setup.proximity === "ready") {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-signal-warning/40 bg-signal-warning/15 px-2 py-1 text-[11px] font-black text-signal-warning">
        구간 내부 · 신호 아님
      </span>
    );
  }

  if (setup.proximity === "near") {
    const direction = setup.plan.side === "long" ? "내려오면" : "올라오면";
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-accent-blue/40 bg-accent-blue/10 px-2 py-1 text-[11px] font-black text-accent-blue">
        {formatDistance(setup.distancePercent)}% {direction} 관찰 구간
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-slate-600/40 bg-slate-600/10 px-2 py-1 text-[11px] font-bold text-slate-400">
      대기 · 관찰 구간까지 {formatDistance(setup.distancePercent)}%
    </span>
  );
}

function killzoneLabel(value: ScoutSetup["analysis"]["killzone"]) {
  if (value === "asia") return "아시아 세션";
  if (value === "london") return "런던 세션";
  if (value === "newyork") return "뉴욕 세션";
  return "세션 외";
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
      pocPosition: active?.volumeProfile?.position ?? "unknown",
      quality: setup.plan.quality,
      riskFlags: setup.analysis.riskFlags ?? [],
      opportunityFlags: setup.analysis.opportunityFlags ?? []
    }
  };
}

function useCommentary(setup: ScoutSetup): CommentaryState {
  const [state, setState] = useState<CommentaryState>({ status: "loading" });
  const cacheKey = `${setup.symbol}|${setup.mode}|${setup.timeframe}|${setup.scannedAt}|${Math.round(setup.currentPrice * 100)}`;

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    fetch("/api/ai/commentary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildCommentaryInput(setup))
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ commentary: string; cached: boolean }>;
      })
      .then((payload) => {
        if (!cancelled) setState({ status: "ready", text: payload.commentary, cached: payload.cached });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
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
        <span>AI 레이더 코멘트 생성 중...</span>
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
    `상위 추세 정렬 ${higherAlignedCount}/2`,
    `${setup.plan.quality}급 감지`,
    killzoneLabel(setup.analysis.killzone)
  ];

  if (active?.oteZone === setup.plan.side) evidence.push("OTE 영역 일치");
  if (active?.inOb) evidence.push("OB 내부");
  if (active?.inFvg) evidence.push("FVG 내부");
  if (active?.volumeProfile?.position === "near") evidence.push("POC 근접");
  if (active?.volumeProfile?.position === "above" && setup.plan.side === "long") {
    evidence.push("POC 위 롱 우위");
  }
  if (active?.volumeProfile?.position === "below" && setup.plan.side === "short") {
    evidence.push("POC 아래 숏 우위");
  }

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
              className="rounded-md border border-signal-danger/20 bg-signal-danger/10 px-2 py-1 text-[11px] font-bold text-signal-danger"
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
    `Chart Radar 저장: ${setup.headline}`,
    `현재가: ${formatPriceWithSymbol(setup.currentPrice)}`,
    `관찰 구간: ${formatPriceWithSymbol(setup.plan.entryLow)} ~ ${formatPriceWithSymbol(setup.plan.entryHigh)}`,
    `깨지면 무효 기준: ${formatPriceWithSymbol(setup.plan.invalidation)}`,
    `다음 레벨: ${formatPriceWithSymbol(setup.plan.target1)} / ${formatPriceWithSymbol(setup.plan.target2)}`,
    "",
    "검토 근거:",
    ...evidence.map((item) => `- ${item}`),
    "",
    "위험 신호:",
    ...(risks.length ? risks.map((item) => `- ${item}`) : ["- 별도 위험 신호 없음"]),
    "",
    "기회 신호:",
    ...(opportunities.length ? opportunities.map((item) => `- ${item}`) : ["- 별도 기회 신호 없음"]),
    "",
    "주의: 이 기록은 매수·매도 추천이 아니라, 시장 구조 관찰 기록입니다."
  ].join("\n");
}

function SetupCard({
  setup,
  rank,
  riskProfile
}: {
  setup: ScoutSetup;
  rank: number;
  riskProfile: ScoutRiskProfile;
}) {
  const isLong = setup.plan.side === "long";
  const sideColor = isLong ? "text-signal-success" : "text-signal-danger";
  const SideIcon = isLong ? ArrowUpRight : ArrowDownRight;
  const symbol = setup.symbol.replace("USDT.P", "");
  const modeCardClass =
    setup.timeframe === "5m" || setup.timeframe === "15m"
      ? "border-accent-blue/25 bg-accent-blue/5 hover:border-accent-blue/50"
      : setup.timeframe === "1h"
        ? "border-cyan-300/25 bg-cyan-300/5 hover:border-cyan-300/50"
        : setup.timeframe === "4h"
          ? "border-violet-400/25 bg-violet-400/5 hover:border-violet-400/50"
          : "border-emerald-300/25 bg-emerald-300/5 hover:border-emerald-300/50";
  const modeBadgeClass =
    setup.timeframe === "5m" || setup.timeframe === "15m"
      ? "border-accent-blue/25 bg-accent-blue/10 text-accent-blue"
      : setup.timeframe === "1h"
        ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-200"
        : setup.timeframe === "4h"
          ? "border-violet-400/25 bg-violet-400/10 text-violet-200"
          : "border-emerald-300/25 bg-emerald-300/10 text-emerald-200";
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function saveSetup() {
    setSaveState("saving");
    const snapshot: ScoutSnapshot = {
      entryLow: setup.plan.entryLow,
      entryHigh: setup.plan.entryHigh,
      invalidation: setup.plan.invalidation,
      target1: setup.plan.target1,
      target2: setup.plan.target2,
      side: setup.plan.side,
      score: setup.score,
      quality: setup.plan.quality,
      scannedAt: setup.scannedAt
    };

    const payload = {
      title: setup.headline,
      bias: isLong ? "롱" : "숏",
      note: buildJournalNote(setup),
      source: "scout" as const,
      symbol: setup.symbol,
      timeframe: setup.timeframe,
      verdict: `${setup.score}점 · ${setup.plan.quality}급 · ${setup.proximity === "ready" ? "관찰 구간 내부" : "대기 감지"}`,
      scoutSnapshot: snapshot
    };

    const session = await getActiveSupabaseSession();
    try {
      if (session) {
        await createRemoteJournalEntry(session.accessToken, payload);
      } else {
        appendJournalEntry(payload);
      }
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1800);
    } catch {
      try {
        appendJournalEntry(payload);
        setSaveState("saved");
        window.setTimeout(() => setSaveState("idle"), 1800);
      } catch {
        setSaveState("error");
        window.setTimeout(() => setSaveState("idle"), 2200);
      }
    }
  }

  return (
    <article className={`rounded-lg border p-4 [word-break:keep-all] transition ${modeCardClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-500">TOP {rank}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h3 className="text-base font-black text-white">{symbol}</h3>
            <span className="whitespace-nowrap rounded border border-white/10 bg-black/20 px-1.5 py-0.5 text-xs font-bold text-slate-300">
              {setup.timeframe}
            </span>
            <SideIcon className={sideColor} size={16} aria-hidden />
            <span className={`whitespace-nowrap text-xs font-bold ${sideColor}`}>{isLong ? "롱 우세" : "숏 우세"}</span>
            <span className={`whitespace-nowrap rounded border px-1.5 py-0.5 text-xs font-bold ${modeBadgeClass}`}>
              {setup.plan.quality}급
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge setup={setup} riskProfile={riskProfile} />
          <ScoreBadge score={setup.score} />
        </div>
      </div>

      <div className="mt-3">
        <ProximityBadge setup={setup} />
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-300">{setup.plan.entryLabel}</p>
      {setup.status === "watch" && setup.watchReason ? (
        <p className="mt-3 line-clamp-2 rounded-md border border-signal-warning/25 bg-signal-warning/10 px-3 py-2 text-[11px] leading-5 text-signal-warning">
          <span className="font-black">관찰 사유.</span> {setup.watchReason}
          {setup.watchKind === "counter" ? " 반대 방향 구간 감시." : ""}
        </p>
      ) : null}
      <EvidenceChips setup={setup} />

      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded border border-white/10 bg-black/30 px-2 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">현재가</p>
          <p className="mt-1 text-xs font-bold text-white">{formatPriceWithSymbol(setup.currentPrice)}</p>
        </div>
        <div className="rounded border border-accent-blue/20 bg-accent-blue/5 px-2 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-accent-blue">관찰 구간</p>
          <p className="mt-1 text-xs font-bold text-white">
            {formatPriceWithSymbol(setup.plan.entryLow)} ~ {formatPriceWithSymbol(setup.plan.entryHigh)}
          </p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-center">
        <div className="rounded border border-signal-danger/20 bg-signal-danger/10 px-2 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-signal-danger">무효 기준</p>
          <p className="mt-1 text-xs font-bold text-white">{formatPriceWithSymbol(setup.plan.invalidation)}</p>
        </div>
        <div className="rounded border border-signal-success/20 bg-signal-success/10 px-2 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-signal-success">다음 레벨</p>
          <p className="mt-1 text-xs font-bold text-white">{formatPriceWithSymbol(setup.plan.target1)}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <Target size={12} aria-hidden /> 구조 신뢰도 {setup.plan.confidence}%
        </span>
        <span className="font-bold text-slate-400">다음 레벨 2 {formatPriceWithSymbol(setup.plan.target2)}</span>
      </div>

      <CommentaryLine setup={setup} />

      <button
        type="button"
        onClick={saveSetup}
        disabled={saveState === "saving"}
        className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-accent-blue/30 bg-accent-blue/10 px-3 text-xs font-black text-accent-blue transition hover:bg-accent-blue hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saveState === "saving" ? (
          <Loader2 size={14} className="animate-spin" aria-hidden />
        ) : saveState === "saved" ? (
          <CheckCircle2 size={14} aria-hidden />
        ) : (
          <Save size={14} aria-hidden />
        )}
        {saveState === "saving"
          ? "저장 중"
          : saveState === "saved"
            ? "복기에 저장됨"
            : saveState === "error"
              ? "기기 저장"
              : "레이더 저장"}
      </button>

      {setup.plan.cautions.length > 0 ? (
        <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-slate-500">
          주의: {setup.plan.cautions[0]}
        </p>
      ) : null}
    </article>
  );
}

function EmptyState({
  excludeMajor,
  riskProfile,
  onUseRadar
}: {
  excludeMajor: boolean;
  riskProfile: ScoutRiskProfile;
  onUseRadar: () => void;
}) {
  const marketLabel = excludeMajor ? "알트코인" : "코인";

  return (
    <div className="rounded-lg border border-signal-warning/25 bg-signal-warning/10 p-5">
      <p className="text-sm font-black text-signal-warning">현재 강하게 감지된 {marketLabel}이 없습니다.</p>
      <p className="mt-2 text-xs leading-5 text-slate-300">
        지금은 구조가 애매하거나 관찰 구간에서 너무 멀어진 상태입니다.
        무리해서 자리를 찾기보다 다음 레이더 판독을 기다리는 편이 낫습니다.
      </p>
      {riskProfile === "guard" ? (
        <button
          type="button"
          onClick={onUseRadar}
          className="mt-4 inline-flex min-h-10 items-center justify-center rounded-md border border-signal-danger/30 bg-signal-danger/15 px-3 text-xs font-black text-signal-danger transition hover:bg-signal-danger hover:text-white"
        >
          공격적 분석으로 더 넓게 보기
        </button>
      ) : null}
      <div className="mt-3 grid gap-2 text-left text-[11px] leading-5 text-slate-400 sm:grid-cols-3">
        <span className="rounded-md border border-surface-line bg-black/20 px-3 py-2">1. 킬존/세션 재진입 대기</span>
        <span className="rounded-md border border-surface-line bg-black/20 px-3 py-2">2. MSB·CHoCH 재정렬 대기</span>
        <span className="rounded-md border border-surface-line bg-black/20 px-3 py-2">3. OB/FVG/OTE 근처 재접근 대기</span>
      </div>
    </div>
  );
}

function ScanSummary({
  setups,
  riskProfile
}: {
  setups: ScoutSetup[];
  riskProfile: ScoutRiskProfile;
}) {
  const entryCount = setups.filter((setup) => setup.status === "entry").length;
  const activeCount = setups.filter((setup) => setup.status === "active").length;
  const watchCount = setups.filter((setup) => setup.status === "watch").length;
  const isRadar = riskProfile === "radar";

  if (entryCount > 0 || activeCount > 0) {
    return (
      <div
        className={`mb-3 rounded-lg border px-4 py-3 ${
          isRadar ? "border-signal-danger/25 bg-signal-danger/10" : "border-accent-blue/25 bg-accent-blue/10"
        }`}
      >
        <p className={`text-sm font-black ${isRadar ? "text-signal-danger" : "text-accent-blue"}`}>
          전체 TF 점수순 · {isRadar ? "공격적 분석" : "보수적 분석"} · 강한 감지 {entryCount + activeCount}개 · 관찰 {watchCount}개
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-300 [word-break:keep-all]">
          {isRadar
            ? "공격적 분석은 정확도가 조금 떨어질 수 있지만 완화된 조건으로 더 많은 감지 결과를 보고 싶은 사용자를 위한 모드입니다."
            : "강한 감지도 자동 매수·매도 신호가 아닙니다. 관찰 구간, 무효 기준, 포지션 크기를 확인한 뒤에만 판단하세요."}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`mb-3 rounded-lg border px-4 py-3 ${
        isRadar ? "border-signal-danger/25 bg-signal-danger/10" : "border-accent-blue/25 bg-accent-blue/10"
      }`}
    >
      <p className={`text-sm font-black ${isRadar ? "text-signal-danger" : "text-accent-blue"}`}>
        {isRadar ? "공격적 분석" : "보수적 분석"} · 강한 감지 없음 · 관찰 {watchCount}개
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-300 [word-break:keep-all]">
        전체 타임프레임을 통틀어 바로 검토할 조건은 부족합니다.
        {isRadar
          ? " 대신 공격적 분석은 완화된 조건으로 움직임 감지를 더 넓게 보여주며, 실제 진입 전에는 보수적 분석 기준으로 다시 걸러야 합니다."
          : " 이 카드는 “매수·매도 자리”가 아니라 가격이 다시 올 때 확인할 체크포인트입니다."}
      </p>
    </div>
  );
}

function setupStatusRank(setup: ScoutSetup) {
  if (setup.status === "entry") return 3;
  if (setup.status === "active") return 2;
  return 1;
}

function setupQualityRank(setup: ScoutSetup) {
  if (setup.plan.quality === "A") return 3;
  if (setup.plan.quality === "B") return 2;
  return 1;
}

function rankScoutSetups(setups: ScoutSetup[]) {
  return [...setups].sort((a, b) => {
    const statusDiff = setupStatusRank(b) - setupStatusRank(a);
    if (statusDiff !== 0) return statusDiff;
    const qualityDiff = setupQualityRank(b) - setupQualityRank(a);
    if (qualityDiff !== 0) return qualityDiff;
    return b.score - a.score;
  });
}

function uniqueTopSetupsBySymbol(setups: ScoutSetup[], limit: number) {
  const picked: ScoutSetup[] = [];
  const usedSymbols = new Set<string>();

  for (const setup of rankScoutSetups(setups)) {
    if (usedSymbols.has(setup.symbol)) continue;
    picked.push(setup);
    usedSymbols.add(setup.symbol);
    if (picked.length >= limit) break;
  }

  return picked;
}

const majorSetupSymbols = new Set(["BTCUSDT.P", "ETHUSDT.P"]);

function filterSetupsByScope(setups: ScoutSetup[], excludeMajor: boolean) {
  return excludeMajor ? setups.filter((setup) => !majorSetupSymbols.has(setup.symbol)) : setups;
}

export function SetupScoutPanel({ excludeMajor = false }: { excludeMajor?: boolean } = {}) {
  const [state, setState] = useState<ScanState>({ status: "idle" });
  const [riskProfile, setRiskProfile] = useState<ScoutRiskProfile>("radar");
  const [hasLoadedPreferences, setHasLoadedPreferences] = useState(false);
  const { profile } = useSupabaseAuth();
  const isPaid = hasMarketEntitlement(profile?.plan, "crypto");
  const scoutScope: ScoutScope = excludeMajor ? "alts" : "all";

  useEffect(() => {
    setRiskProfile(excludeMajor ? "radar" : readStoredScoutRiskProfile());
    setHasLoadedPreferences(true);
  }, [excludeMajor]);

  const runScan = useCallback(async (force = false) => {
    if (!excludeMajor) {
      window.localStorage.setItem(scoutRiskProfileStorageKey, riskProfile);
    }
    if (!force) {
      const cachedScalp = readScoutCache("scalp", riskProfile, scoutScope);
      const cachedSwing = readScoutCache("swing", riskProfile, scoutScope);
      if (cachedScalp && cachedSwing) {
        const scopedSetups = filterSetupsByScope([...cachedScalp.setups, ...cachedSwing.setups], excludeMajor);
        setState({
          status: "ready",
          setups: scopedSetups,
          cachedAt: Math.max(cachedScalp.cachedAt, cachedSwing.cachedAt)
        });
        return;
      }
    }

    const usageGate = getUsageGate("radarScan", isPaid);
    if (!usageGate.allowed) {
      setState({ status: "error", message: usageGate.message });
      return;
    }

    setState({ status: "loading" });
    try {
      const fetchMode = async (mode: TradingMode) => {
        const res = await fetch(`/api/scout?mode=${mode}&risk=${riskProfile}&scope=${scoutScope}`, { cache: "no-store" });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `요청을 처리하지 못했습니다. 잠시 뒤 다시 확인해 주세요. (${res.status})`);
        }
        const data = (await res.json()) as { setups: ScoutSetup[]; cachedAt: number };
        writeScoutCache(data.setups, mode, riskProfile, scoutScope);
        return data;
      };
      const [scalp, swing] = await Promise.all([fetchMode("scalp"), fetchMode("swing")]);
      const scopedSetups = filterSetupsByScope([...scalp.setups, ...swing.setups], excludeMajor);
      setState({
        status: "ready",
        setups: scopedSetups,
        cachedAt: Math.max(scalp.cachedAt, swing.cachedAt)
      });
      recordUsageEvent("radarScan");
    } catch (error) {
      const message = error instanceof Error ? error.message : "레이더 판독을 불러오지 못했습니다. 잠시 뒤 다시 확인해 주세요.";
      setState({ status: "error", message });
    }
  }, [excludeMajor, isPaid, riskProfile, scoutScope]);

  useEffect(() => {
    if (!hasLoadedPreferences) return;
    runScan(false);
  }, [hasLoadedPreferences, runScan]);

  const cacheLabel = useMemo(() => {
    if (state.status !== "ready") return null;
    return formatCachedAt(state.cachedAt);
  }, [state]);

  const visibleLimit = riskProfile === "radar" ? 6 : 3;
  const rankedSetups = state.status === "ready" ? rankScoutSetups(state.setups) : [];
  const visibleSetups = state.status === "ready" ? uniqueTopSetupsBySymbol(state.setups, visibleLimit) : [];

  return (
    <section className="rounded-lg border border-accent-blue/25 bg-surface-card p-4 shadow-glow sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-accent-blue/30 bg-accent-blue/15 text-accent-blue">
            <Radar size={21} aria-hidden />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white">시장 레이더 TOP</h2>
              <span className="rounded border border-accent-blue/30 bg-accent-blue/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-blue">
                Live
              </span>
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-400 [word-break:keep-all]">
              전체 타임프레임에서 구조 변화가 선명한 코인만 추립니다. 신호가 아니라 시장 관찰용입니다.
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-slate-300">
              <span className="whitespace-nowrap rounded-md border border-signal-warning/25 bg-signal-warning/10 px-2 py-1 text-signal-warning">
                매수·매도 신호 아님
              </span>
              <span className="whitespace-nowrap rounded-md border border-surface-line bg-black/20 px-2 py-1">
                관찰은 대기 조건
              </span>
              <span className="whitespace-nowrap rounded-md border border-orange-400/20 bg-orange-400/10 px-2 py-1 text-orange-200">
                공격적 분석은 감지 범위를 넓힘
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-start gap-3 sm:justify-end">
          <div className="inline-flex overflow-hidden rounded-md border border-surface-line bg-black/30 p-1">
          {(["guard", "radar"] as ScoutRiskProfile[]).map((profile) => (
            <button
              key={profile}
              type="button"
              onClick={() => {
                setRiskProfile(profile);
                setState({ status: "idle" });
              }}
              className={`inline-flex min-h-9 items-center rounded-md border px-3 text-xs font-black transition ${
                riskProfile === profile
                  ? profile === "radar"
                    ? "border-signal-danger bg-signal-danger text-white"
                    : "border-accent-blue bg-accent-blue text-slate-950"
                  : "border-transparent text-slate-300 hover:bg-surface-cardSoft hover:text-white"
              }`}
            >
              {profile === "guard" ? "보수적 분석" : "공격적 분석"}
            </button>
          ))}
          </div>
          <span className="rounded-md border border-surface-line bg-surface-cardSoft px-3 py-2 text-xs font-bold text-slate-400">
            전체 TF 점수순
          </span>
          {cacheLabel ? <span className="text-xs text-slate-500">{cacheLabel} 레이더</span> : null}
          <button
            type="button"
            onClick={() => runScan(true)}
            disabled={state.status === "loading"}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-surface-line bg-surface-cardSoft px-3 text-xs font-bold text-slate-200 hover:border-accent-blue/50 hover:text-white disabled:opacity-50"
          >
            <RefreshCw size={13} className={state.status === "loading" ? "animate-spin" : ""} aria-hidden />
            다시 돌리기
          </button>
        </div>
      </div>

      <div className="mt-4">
        {state.status === "loading" ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-surface-line bg-surface-cardSoft p-8 text-sm text-slate-400">
            <Loader2 size={18} className="animate-spin" aria-hidden />
            레이더가 시장 구조를 훑는 중...
          </div>
        ) : state.status === "error" ? (
          <div className="rounded-lg border border-signal-danger/30 bg-signal-danger/10 p-4 text-sm text-signal-danger">
            {state.message}
          </div>
        ) : state.status === "ready" ? (
          visibleSetups.length === 0 ? (
            <EmptyState
              excludeMajor={excludeMajor}
              riskProfile={riskProfile}
              onUseRadar={() => {
                setRiskProfile("radar");
                setState({ status: "idle" });
              }}
            />
          ) : (
            <>
              <ScanSummary setups={rankedSetups} riskProfile={riskProfile} />
              <div className="grid gap-3 sm:grid-cols-3">
                {visibleSetups.map((setup, idx) => (
                  <SetupCard
                    key={`${setup.symbol}-${setup.mode}-${setup.timeframe}`}
                    setup={setup}
                    rank={idx + 1}
                    riskProfile={riskProfile}
                  />
                ))}
              </div>
            </>
          )
        ) : null}
      </div>

      <p className="mt-3 text-[11px] leading-5 text-slate-500">
        레이더 결과는 5분 단위로 갱신됩니다. 표시되는 감지는 구조 기반 분석 결과이며 매수·매도
        추천이 아닙니다. 관찰 구간과 무효 기준은 반드시 본인의 차트 판독, 손절 원칙,
        포지션 크기 기준으로 다시 확인하세요.
      </p>
    </section>
  );
}
