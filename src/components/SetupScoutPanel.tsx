"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Crown,
  Loader2,
  RefreshCw,
  Radar,
  Save,
  Target
} from "lucide-react";
import Link from "next/link";
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
import { withSupabaseAuth } from "@/lib/authFetch";

type ScanState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; setups: ScoutSetup[]; cachedAt: number }
  | { status: "error"; message: string };

type CommentaryState =
  | { status: "loading" }
  | { status: "ready"; text: string; cached: boolean }
  | { status: "error" };

type AltFilterBucket = "candidate" | "watch" | "danger";

interface AltFilterMeta {
  bucket: AltFilterBucket;
  label: string;
  description: string;
  className: string;
}

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

function uniqueItems(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function activeSetupAnalysis(setup: ScoutSetup) {
  return setup.analysis.timeframeAnalyses.find((item) => item.timeframe === setup.timeframe);
}

function buildAltRiskSignals(setup: ScoutSetup) {
  const active = activeSetupAnalysis(setup);
  const signals: string[] = [];

  if (setup.status === "active" || setup.proximity === "ready") signals.push("급등 추격 주의");
  if (setup.watchKind === "counter" || active?.condition.regime === "mixed") {
    signals.push("상승/하락 근거 혼재");
    signals.push("BTC 방향성 의존");
  }
  if (active?.condition.volatilityState === "expanded") {
    signals.push("변동성 확대");
    signals.push("BTC 방향성 의존");
  }
  if (active?.condition.volumeState === "low") {
    signals.push("거래량 부족");
    signals.push("저유동성 리스크");
  }
  if (setup.distancePercent > 3 || setup.proximity === "wait") signals.push("추적 대기");
  if (setup.analysis.readiness !== "high") signals.push("리스크 점검");

  return uniqueItems([...signals, ...setup.analysis.riskFlags]).slice(0, 6);
}

function summarizeAltRisk(setup: ScoutSetup) {
  return buildAltRiskSignals(setup)[0] ?? "리스크 점검";
}

function classifyAltSetup(setup: ScoutSetup): AltFilterMeta {
  const riskSignals = buildAltRiskSignals(setup);
  const highRisk =
    setup.status === "active" ||
    setup.watchKind === "counter" ||
    riskSignals.includes("급등 추격 주의") ||
    riskSignals.includes("변동성 확대") ||
    riskSignals.length >= 3;

  if (highRisk) {
    return {
      bucket: "danger",
      label: "고위험",
      description: "추격, 변동성, 유동성 리스크를 먼저 걸러야 하는 구간입니다.",
      className: "text-signal-danger"
    };
  }

  if (setup.status === "watch" || setup.proximity === "wait") {
    return {
      bucket: "watch",
      label: "관망",
      description: "구조 확인 전까지 추적 대기 성격이 강한 구간입니다.",
      className: "text-signal-warning"
    };
  }

  return {
    bucket: "candidate",
    label: "추적 후보",
    description: "위험 신호를 확인하면서 우선순위에 올려볼 수 있는 후보입니다.",
    className: "text-accent-blue"
  };
}

function altJudgmentLabel(setup: ScoutSetup, meta: AltFilterMeta) {
  if (meta.bucket === "danger") return "고위험";
  if (meta.bucket === "watch") return "관망 우위";
  return setup.plan.side === "long" ? "상방 환경" : "하방 환경";
}

function buildAltBtcInfluence(setup: ScoutSetup) {
  const active = activeSetupAnalysis(setup);
  if (setup.watchKind === "counter" || active?.condition.regime === "mixed") {
    return "BTC 방향성 확인 전까지 알트 단독 신호를 보수적으로 봅니다.";
  }
  if (active?.condition.volatilityState === "expanded") {
    return "BTC 변동이 커지면 알트 변동성이 먼저 확대될 수 있습니다.";
  }
  return "BTC/ETH 방향이 같은 쪽으로 유지되는지 함께 확인합니다.";
}

function AltProCta({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`border-y border-cyan-300/25 ${compact ? "py-3" : "py-4"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black text-cyan-100">Coin Pro 알트 상세 판단</p>
          <p className="mt-1 text-sm leading-6 text-slate-300 [word-break:keep-all]">
            BTC/ETH·알트 리스크, 추적 조건, 무효화 기준, 세부 리스크는 Coin Pro에서 확인할 수 있습니다.
          </p>
        </div>
        <Link
          href="/pro?market=crypto"
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-cyan-300 px-3 text-xs font-black text-slate-950 transition hover:bg-cyan-200"
        >
          <Crown size={14} aria-hidden />
          Coin Pro로 코인 상세 판단 열기
        </Link>
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 80
      ? "text-signal-success"
      : score >= 65
        ? "text-accent-blue"
        : "text-signal-warning";

  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap text-xs font-black ${tone}`}>
      {score}점
    </span>
  );
}

function StatusBadge({ setup, riskProfile }: { setup: ScoutSetup; riskProfile: ScoutRiskProfile }) {
  if (setup.status === "active") {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-black text-orange-300">
        강한 감지
      </span>
    );
  }

  if (setup.status === "watch" && setup.watchKind === "counter") {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-black text-orange-300">
        반대 구간 감시
      </span>
    );
  }

  if (setup.status === "watch") {
    if (riskProfile === "radar") {
      return (
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-black text-accent-blue">
          확장 관찰
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-black text-signal-warning">
        관찰 대기
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-black text-signal-success">
      레이더 감지
    </span>
  );
}

function ProximityBadge({ setup }: { setup: ScoutSetup }) {
  if (setup.proximity === "ready") {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-black text-signal-warning">
        관찰 구간 내부
      </span>
    );
  }

  if (setup.proximity === "near") {
    const direction = setup.plan.side === "long" ? "내려오면" : "올라오면";
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-black text-accent-blue">
        {formatDistance(setup.distancePercent)}% {direction} 관찰 구간
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-bold text-slate-400">
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

    withSupabaseAuth({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildCommentaryInput(setup))
    })
      .then((init) => fetch("/api/ai/commentary", init))
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
      <div className="mt-3 flex items-center gap-2 border-t border-ui-line pt-2 text-[11px] leading-5 text-slate-400">
        <Loader2 size={12} className="animate-spin text-accent-blue" aria-hidden />
        <span>AI 레이더 코멘트 생성 중...</span>
      </div>
    );
  }

  if (state.status === "error") return null;

  return (
    <div className="mt-3 flex items-start gap-2 border-t border-ui-line pt-2 text-[12px] leading-5 text-slate-200">
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
    evidence.push("POC 위 상방 우위");
  }
  if (active?.volumeProfile?.position === "below" && setup.plan.side === "short") {
    evidence.push("POC 아래 하방 우위");
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
            className="text-[11px] font-bold text-signal-success"
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
              className="text-[11px] font-bold text-signal-danger"
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
    "추적 후보:",
    ...(opportunities.length ? opportunities.map((item) => `- ${item}`) : ["- 별도 추적 후보 없음"]),
    "",
    "주의: 이 기록은 투자 권유가 아니라, 시장 구조 관찰 기록입니다."
  ].join("\n");
}

function SetupCard({
  setup,
  rank,
  riskProfile,
  isAltFilterMode,
  canShowAltProDetails
}: {
  setup: ScoutSetup;
  rank: number;
  riskProfile: ScoutRiskProfile;
  isAltFilterMode: boolean;
  canShowAltProDetails: boolean;
}) {
  const isLong = setup.plan.side === "long";
  const sideColor = isLong ? "text-signal-success" : "text-signal-danger";
  const SideIcon = isLong ? ArrowUpRight : ArrowDownRight;
  const symbol = setup.symbol.replace("USDT.P", "");
  const altMeta = isAltFilterMode ? classifyAltSetup(setup) : null;
  const altRiskSignals = isAltFilterMode ? buildAltRiskSignals(setup) : [];
  const altSummaryRisk = isAltFilterMode ? summarizeAltRisk(setup) : null;
  const shouldShowProDetails = !isAltFilterMode || canShowAltProDetails;
  const modeCardClass =
    isAltFilterMode && altMeta?.bucket === "danger"
      ? "border-signal-danger/30 bg-signal-danger/5 hover:border-signal-danger/50"
      : isAltFilterMode && altMeta?.bucket === "watch"
        ? "border-signal-warning/30 bg-signal-warning/5 hover:border-signal-warning/50"
        : setup.timeframe === "5m" || setup.timeframe === "15m"
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
      market: "crypto" as const,
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
    <article
      className={
        isAltFilterMode
          ? "border-t border-ui-line py-4 [word-break:keep-all] transition first:border-t-0"
          : `border-t border-ui-line py-4 [word-break:keep-all] transition first:border-t-0 ${modeCardClass.replace(/bg-[^ ]+/g, "").replace(/border-[^ ]+/g, "")}`
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-500">{isAltFilterMode ? "ALT FILTER" : "TOP"} {rank}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h3 className="text-base font-black text-white">{symbol}</h3>
            <span className="whitespace-nowrap text-xs font-bold text-slate-300">
              {setup.timeframe}
            </span>
            <SideIcon className={sideColor} size={16} aria-hidden />
            <span className={`whitespace-nowrap text-xs font-bold ${isAltFilterMode && altMeta?.bucket !== "candidate" ? "text-slate-300" : sideColor}`}>
              {isAltFilterMode && altMeta ? altJudgmentLabel(setup, altMeta) : isLong ? "상방 환경" : "하방 환경"}
            </span>
            {shouldShowProDetails ? (
              <span className={`whitespace-nowrap text-xs font-bold ${modeBadgeClass.replace(/bg-[^ ]+/g, "").replace(/border-[^ ]+/g, "")}`}>
                {setup.plan.quality}급
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isAltFilterMode && altMeta ? (
            <span className={`inline-flex items-center whitespace-nowrap text-[11px] font-black ${altMeta.className.replace(/bg-[^ ]+/g, "").replace(/border-[^ ]+/g, "")}`}>
              {altMeta.label}
            </span>
          ) : (
            <StatusBadge setup={setup} riskProfile={riskProfile} />
          )}
          {shouldShowProDetails ? <ScoreBadge score={setup.score} /> : null}
        </div>
      </div>

      {isAltFilterMode ? (
        <div className="mt-3 grid gap-2 border-y border-white/10 py-2 text-xs sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold uppercase tracking-wider text-slate-500">현재가</p>
            <p className="font-bold text-white">{formatPriceWithSymbol(setup.currentPrice)}</p>
          </div>
          <div className="flex items-center justify-between gap-3 text-slate-300">
            <p className="font-bold uppercase tracking-wider opacity-80">분류</p>
            <p className="font-black">{altMeta?.label ?? "리스크 점검"}</p>
          </div>
        </div>
      ) : null}

      {isAltFilterMode && !shouldShowProDetails ? (
        <div className="mt-3 border-t border-white/10 pt-3">
          <p className="text-[11px] font-bold text-slate-400">요약 리스크</p>
          <p className="mt-1 text-sm font-black text-white">{altSummaryRisk}</p>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            Basic에서는 방향 요약만 제공합니다. 상세 조건, 무효화 기준, 세부 리스크는 Pro에서 확인할 수 있습니다.
          </p>
        </div>
      ) : null}

      {shouldShowProDetails ? (
        <div className="mt-3">
          <ProximityBadge setup={setup} />
        </div>
      ) : null}

      {shouldShowProDetails ? (
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-300">{setup.plan.entryLabel}</p>
      ) : null}
      {shouldShowProDetails && setup.status === "watch" && setup.watchReason ? (
        <p className="mt-3 line-clamp-2 border-y border-signal-warning/25 py-2 text-[11px] leading-5 text-signal-warning">
          <span className="font-black">관찰 사유.</span> {setup.watchReason}
          {setup.watchKind === "counter" ? " 반대 방향 구간 감시." : ""}
        </p>
      ) : null}
      {shouldShowProDetails ? <EvidenceChips setup={setup} /> : null}

      {shouldShowProDetails && isAltFilterMode ? (
        <div className="mt-3 border-t border-orange-400/20 pt-2 text-[11px] leading-5 text-orange-100">
          <span className="font-black">BTC 영향.</span> {buildAltBtcInfluence(setup)}
        </div>
      ) : null}

      {shouldShowProDetails && altRiskSignals.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {altRiskSignals.slice(0, 4).map((item) => (
            <span
              key={item}
              className="text-[11px] font-bold text-signal-warning"
            >
              {item}
            </span>
          ))}
        </div>
      ) : null}

      {!isAltFilterMode ? (
        <div className="mt-3 grid grid-cols-2 divide-x divide-white/10 border-y border-white/10 text-center">
          <div className="px-2 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">현재가</p>
            <p className="mt-1 text-xs font-bold text-white">{formatPriceWithSymbol(setup.currentPrice)}</p>
          </div>
          <div className="px-2 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-accent-blue">관찰 구간</p>
            <p className="mt-1 text-xs font-bold text-white">
              {formatPriceWithSymbol(setup.plan.entryLow)} ~ {formatPriceWithSymbol(setup.plan.entryHigh)}
            </p>
          </div>
        </div>
      ) : null}

      {shouldShowProDetails ? (
        <>
          <div className="mt-2 grid gap-2 border-y border-white/10 py-2 text-xs sm:grid-cols-2">
            {isAltFilterMode ? (
              <div className="flex items-start justify-between gap-3">
                <p className="font-bold uppercase tracking-wider text-accent-blue">관찰 구간</p>
                <p className="text-right font-bold text-white">
                  {formatPriceWithSymbol(setup.plan.entryLow)} ~ {formatPriceWithSymbol(setup.plan.entryHigh)}
                </p>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold uppercase tracking-wider text-signal-danger">무효 기준</p>
              <p className="font-bold text-white">{formatPriceWithSymbol(setup.plan.invalidation)}</p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold uppercase tracking-wider text-signal-success">다음 레벨</p>
              <p className="font-bold text-white">{formatPriceWithSymbol(setup.plan.target1)}</p>
            </div>
            {isAltFilterMode ? (
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold uppercase tracking-wider text-signal-success">다음 레벨 2</p>
                <p className="font-bold text-white">{formatPriceWithSymbol(setup.plan.target2)}</p>
              </div>
            ) : null}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <Target size={12} aria-hidden /> 구조 신뢰도 {setup.plan.confidence}%
            </span>
            {!isAltFilterMode ? (
              <span className="font-bold text-slate-400">다음 레벨 2 {formatPriceWithSymbol(setup.plan.target2)}</span>
            ) : null}
          </div>
        </>
      ) : null}

      {shouldShowProDetails ? <CommentaryLine setup={setup} /> : null}

      {shouldShowProDetails ? (
        <button
          type="button"
          onClick={saveSetup}
          disabled={saveState === "saving"}
          className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 bg-accent-blue px-3 text-xs font-black text-slate-950 transition hover:bg-accent-blue/90 disabled:cursor-not-allowed disabled:opacity-60"
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
      ) : null}

      {shouldShowProDetails && setup.plan.cautions.length > 0 ? (
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
  onUseRadar,
  hiddenDangerCount = 0
}: {
  excludeMajor: boolean;
  riskProfile: ScoutRiskProfile;
  onUseRadar: () => void;
  hiddenDangerCount?: number;
}) {
  const marketLabel = excludeMajor ? "알트코인" : "코인";
  const dangerOnly = excludeMajor && hiddenDangerCount > 0;

  return (
    <div className="border-y border-signal-warning/25 py-5">
      <p className="text-sm font-black text-signal-warning">
        {dangerOnly ? "지금은 고위험 알트만 감지됐습니다." : `현재 강하게 감지된 ${marketLabel}이 없습니다.`}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-300">
        {dangerOnly
          ? `급등 추격, 저유동성, 변동성 확대가 겹친 후보 ${hiddenDangerCount}개는 목록에서 제외했습니다.`
          : "지금은 구조가 애매하거나 관찰 구간에서 너무 멀어진 상태입니다."}
        {" "}
        무리해서 자리를 찾기보다 다음 레이더 판독을 기다리는 편이 낫습니다.
      </p>
      {riskProfile === "guard" ? (
        <button
          type="button"
          onClick={onUseRadar}
          className="mt-4 inline-flex min-h-10 items-center justify-center border-b border-signal-danger/40 px-0 text-xs font-black text-signal-danger transition hover:text-white"
        >
          확장 감지로 더 넓게 보기
        </button>
      ) : null}
      <div className="mt-3 grid gap-2 text-left text-[11px] leading-5 text-slate-400 sm:grid-cols-3">
        <span className="border-t border-surface-line py-2 sm:border-t-0">1. 킬존/세션 재접근 대기</span>
        <span className="border-t border-surface-line py-2 sm:border-t-0">2. MSB·CHoCH 재정렬 대기</span>
        <span className="border-t border-surface-line py-2 sm:border-t-0">3. OB/FVG/OTE 근처 재접근 대기</span>
      </div>
    </div>
  );
}

function ScanSummary({
  setups,
  riskProfile,
  excludeMajor,
  hiddenDangerCount = 0
}: {
  setups: ScoutSetup[];
  riskProfile: ScoutRiskProfile;
  excludeMajor: boolean;
  hiddenDangerCount?: number;
}) {
  const entryCount = setups.filter((setup) => setup.status === "entry").length;
  const activeCount = setups.filter((setup) => setup.status === "active").length;
  const watchCount = setups.filter((setup) => setup.status === "watch").length;
  const isRadar = riskProfile === "radar";

  if (excludeMajor) {
    const summary = setups.reduce(
      (acc, setup) => {
        const bucket = classifyAltSetup(setup).bucket;
        acc[bucket] += 1;
        return acc;
      },
      { candidate: 0, watch: 0, danger: 0 } as Record<AltFilterBucket, number>
    );

    return (
      <div className="mb-3 border-y border-accent-blue/25 py-3">
        <p className="text-sm font-black text-accent-blue">
          오늘의 알트 필터 · 추적 후보 {summary.candidate}개 · 관망 {summary.watch}개 · 고위험 제외 {hiddenDangerCount}개
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-300 [word-break:keep-all]">
          급등 추격, 저유동성, 변동성 확대가 겹친 코인은 목록에서 빼고 볼 만한 후보만 남깁니다.
        </p>
      </div>
    );
  }

  if (entryCount > 0 || activeCount > 0) {
    return (
      <div className={`mb-3 border-y py-3 ${isRadar ? "border-signal-danger/25" : "border-accent-blue/25"}`}>
        <p className={`text-sm font-black ${isRadar ? "text-signal-danger" : "text-accent-blue"}`}>
          전체 TF 점수순 · {isRadar ? "확장 감지" : "보수적 분석"} · 강한 감지 {entryCount + activeCount}개 · 관찰 {watchCount}개
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-300 [word-break:keep-all]">
          {isRadar
            ? "확장 감지는 완화된 조건으로 움직임을 더 넓게 정리합니다. 빠른 변화를 먼저 점검할 때 적합합니다."
            : "보수적 분석은 구조가 더 분명한 감지만 남깁니다. 관찰 구간, 무효 기준, 포지션 크기까지 함께 확인하세요."}
        </p>
      </div>
    );
  }

  return (
    <div className={`mb-3 border-y py-3 ${isRadar ? "border-signal-danger/25" : "border-accent-blue/25"}`}>
      <p className={`text-sm font-black ${isRadar ? "text-signal-danger" : "text-accent-blue"}`}>
        {isRadar ? "확장 감지" : "보수적 분석"} · 강한 감지 없음 · 관찰 {watchCount}개
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-300 [word-break:keep-all]">
        전체 타임프레임을 통틀어 바로 검토할 조건은 부족합니다.
        {isRadar
          ? " 확장 감지는 작은 움직임까지 넓게 보여주므로, 다시 돌려서 새로 올라오는 감지를 확인해 보세요."
          : " 가격이 다시 관찰 구간에 접근할 때 확인할 체크포인트만 남겨두는 흐름입니다."}
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

function getVisibleSetupLimit(excludeMajor: boolean, riskProfile: ScoutRiskProfile, isPaid: boolean) {
  if (excludeMajor) {
    if (!isPaid) return 3;
    return riskProfile === "radar" ? 5 : 3;
  }
  return isPaid ? (riskProfile === "radar" ? 12 : 6) : riskProfile === "radar" ? 6 : 3;
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
    if (!force && !isPaid) {
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
        const res = await fetch(
          `/api/scout?mode=${mode}&risk=${riskProfile}&scope=${scoutScope}`,
          await withSupabaseAuth({ cache: "no-store" })
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "레이더 후보를 잠시 확인하지 못했습니다. 잠시 뒤 다시 확인해 주세요.");
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
      const message = error instanceof Error ? error.message : "레이더 판독을 잠시 확인하지 못했습니다. 잠시 뒤 다시 확인해 주세요.";
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

  const visibleLimit = getVisibleSetupLimit(excludeMajor, riskProfile, isPaid);
  const displayableSetups =
    state.status === "ready" && excludeMajor
      ? state.setups.filter((setup) => classifyAltSetup(setup).bucket !== "danger")
      : state.status === "ready"
        ? state.setups
        : [];
  const hiddenDangerCount =
    state.status === "ready" && excludeMajor
      ? uniqueTopSetupsBySymbol(state.setups.filter((setup) => classifyAltSetup(setup).bucket === "danger"), state.setups.length).length
      : 0;
  const visibleSetups = state.status === "ready" ? uniqueTopSetupsBySymbol(displayableSetups, visibleLimit) : [];
  const isAltFilterMode = excludeMajor;
  const canShowAltProDetails = !isAltFilterMode || isPaid;

  return (
    <section className="border-y border-ui-line py-4 sm:py-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center text-accent-blue">
            <Radar size={21} aria-hidden />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white">{excludeMajor ? "알트 기회/위험 필터" : "시장 레이더 TOP"}</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent-blue">
                Live
              </span>
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-400 [word-break:keep-all]">
              {excludeMajor
                ? "알트를 추적 후보와 관망으로 나누고, 고위험 후보는 목록에서 제외합니다."
                : "전체 타임프레임에서 구조 변화가 선명한 코인을 먼저 추립니다. 오늘 무엇부터 볼지 줄여주는 레이더입니다."}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-slate-300">
              <span className="whitespace-nowrap text-signal-warning">
                {excludeMajor ? "리스크 우선 필터" : "확인 순서 정리"}
              </span>
              <span className="whitespace-nowrap border-b border-surface-line px-0 py-1">
                {excludeMajor ? "추적 후보 / 관망 / 고위험 제외" : "관찰 구간 표시"}
              </span>
              <span className="whitespace-nowrap text-orange-200">
                {excludeMajor ? "BTC 방향성 의존 확인" : "확장 감지는 더 넓게 확인"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-start gap-3 sm:justify-end">
          <div className="inline-flex overflow-hidden border-b border-ui-line">
          {(["guard", "radar"] as ScoutRiskProfile[]).map((profile) => (
            <button
              key={profile}
              type="button"
              onClick={() => {
                setRiskProfile(profile);
                setState({ status: "idle" });
              }}
              className={`inline-flex min-h-9 items-center border-b-2 px-3 text-xs font-black transition ${
                riskProfile === profile
                  ? profile === "radar"
                    ? "border-signal-danger bg-transparent text-signal-danger"
                    : "border-accent-blue bg-transparent text-accent-blue"
                  : "border-transparent text-slate-300 hover:text-white"
              }`}
            >
              {profile === "guard" ? "보수적 분석" : "확장 감지"}
            </button>
          ))}
          </div>
          <span className="border-b border-ui-line px-0 py-2 text-xs font-bold text-slate-400">
            전체 TF 점수순
          </span>
          {cacheLabel ? <span className="text-xs text-slate-500">{cacheLabel} 레이더</span> : null}
          <button
            type="button"
            onClick={() => runScan(true)}
            disabled={state.status === "loading"}
            className="inline-flex min-h-8 items-center gap-1.5 border-b border-ui-line px-0 text-xs font-bold text-slate-200 hover:text-white disabled:opacity-50"
          >
            <RefreshCw size={13} className={state.status === "loading" ? "animate-spin" : ""} aria-hidden />
            다시 돌리기
          </button>
        </div>
      </div>

      <div className="mt-4">
        {state.status === "loading" ? (
          <div className="flex items-center justify-center gap-2 border-y border-ui-line py-8 text-sm text-slate-400">
            <Loader2 size={18} className="animate-spin" aria-hidden />
            레이더가 시장 구조를 훑는 중...
          </div>
        ) : state.status === "error" ? (
          <div className="border-y border-signal-danger/30 py-4 text-sm text-signal-danger">
            {state.message}
          </div>
        ) : state.status === "ready" ? (
          visibleSetups.length === 0 ? (
            <EmptyState
              excludeMajor={excludeMajor}
              riskProfile={riskProfile}
              hiddenDangerCount={hiddenDangerCount}
              onUseRadar={() => {
                setRiskProfile("radar");
                setState({ status: "idle" });
              }}
            />
          ) : (
            <>
              <ScanSummary setups={visibleSetups} riskProfile={riskProfile} excludeMajor={excludeMajor} hiddenDangerCount={hiddenDangerCount} />
              <div className={isAltFilterMode ? "divide-y divide-ui-line" : "grid gap-3 sm:grid-cols-3"}>
                {visibleSetups.map((setup, idx) => (
                  <SetupCard
                    key={`${setup.symbol}-${setup.mode}-${setup.timeframe}`}
                    setup={setup}
                    rank={idx + 1}
                    riskProfile={riskProfile}
                    isAltFilterMode={isAltFilterMode}
                    canShowAltProDetails={canShowAltProDetails}
                  />
                ))}
              </div>
              {isAltFilterMode && !isPaid ? (
                <div className="mt-3">
                  <AltProCta />
                </div>
              ) : null}
            </>
          )
        ) : null}
      </div>

      <p className="mt-3 text-[11px] leading-5 text-slate-500">
        {excludeMajor
          ? "레이더 결과는 5분 단위로 갱신됩니다. Basic에서는 방향 요약만 제공합니다. 추적 조건, 무효화 기준, 세부 리스크는 Coin Pro에서 확인할 수 있습니다."
          : "레이더 결과는 5분 단위로 갱신됩니다. 감지 카드는 오늘 먼저 확인할 순서를 줄여주는 기준이며, 관찰 구간과 무효 기준은 본인의 손절 원칙과 포지션 크기에 맞춰 다시 확인하세요."}
      </p>
    </section>
  );
}
