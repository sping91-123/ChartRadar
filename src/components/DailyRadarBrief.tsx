"use client";
// 첫 화면에서 시장 온도와 다음 확인 루틴을 압축해 보여주는 관제실 카드.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BellRing,
  CheckCircle2,
  Gauge,
  Loader2,
  Newspaper,
  Radar,
  RefreshCw,
  ShieldAlert,
  Star
} from "lucide-react";
import type { TradingMode } from "@/lib/marketAnalysis";
import type { ScoutSetup } from "@/lib/setupScout";
import {
  buildSetupAlertPreset,
  getSetupAlertPresetId,
  readSetupAlertPresets,
  writeSetupAlertPresets
} from "@/lib/setupAlertPresets";
import { getUsageGate, recordUsageEvent } from "@/lib/usageMeter";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { hasMarketEntitlement } from "@/lib/billing";
import { withSupabaseAuth } from "@/lib/authFetch";

interface MarketBoardItem {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  quoteVolume: number;
}

type DailyBriefState =
  | { status: "loading" }
  | { status: "ready"; board: MarketBoardItem[]; setups: ScoutSetup[]; cachedAt: number }
  | { status: "error"; message: string };

const scanModes: TradingMode[] = ["scalp", "swing"];
const majorSymbols = new Set(["BTCUSDT.P", "ETHUSDT.P"]);

type BriefScope = "all" | "major" | "alts";

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
    const statusDiff = statusRank(b) - statusRank(a);
    if (statusDiff !== 0) return statusDiff;
    const qualityDiff = qualityRank(b) - qualityRank(a);
    if (qualityDiff !== 0) return qualityDiff;
    return b.score - a.score;
  });
}

function uniqueTopSetups(setups: ScoutSetup[], limit: number) {
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

function isInScope(symbol: string, scope: BriefScope) {
  if (scope === "all") return true;
  const normalized = symbol.endsWith(".P") ? symbol : `${symbol}.P`;
  const isMajor = majorSymbols.has(normalized);
  return scope === "major" ? isMajor : !isMajor;
}

function scopeLabel(scope: BriefScope) {
  if (scope === "major") return "BTC와 ETH";
  if (scope === "alts") return "알트코인";
  return "주요 코인";
}

function getMarketTone(board: MarketBoardItem[], scope: BriefScope) {
  const up = board.filter((item) => item.changePercent > 0).length;
  const down = board.filter((item) => item.changePercent < 0).length;
  const threshold = board.length <= 3 ? 1 : 3;
  const label = scopeLabel(scope);

  if (up >= down + threshold) {
    return {
      label: "상승 우세",
      description: `${label} 중 ${up}개가 상승, ${down}개가 하락 중입니다.`,
      tone: "long" as const,
      up,
      down
    };
  }

  if (down >= up + threshold) {
    return {
      label: "하락 우세",
      description: `${label} 중 ${down}개가 하락, ${up}개가 상승 중입니다.`,
      tone: "short" as const,
      up,
      down
    };
  }

  return {
    label: "혼조",
    description: `상승 ${up}개, 하락 ${down}개로 방향이 갈리고 있습니다.`,
    tone: "neutral" as const,
    up,
    down
  };
}

function toneClasses(tone: "long" | "short" | "neutral") {
  if (tone === "long") return "border-signal-success/35 bg-signal-success/10 text-signal-success";
  if (tone === "short") return "border-signal-danger/35 bg-signal-danger/10 text-signal-danger";
  return "border-signal-warning/35 bg-signal-warning/10 text-signal-warning";
}

function sideClasses(side: ScoutSetup["plan"]["side"]) {
  return side === "long"
    ? "border-signal-success/35 bg-signal-success/10 text-signal-success"
    : "border-signal-danger/35 bg-signal-danger/10 text-signal-danger";
}

function sideLabel(side: ScoutSetup["plan"]["side"]) {
  return side === "long" ? "롱 우세" : "숏 우세";
}

function setupStateLabel(setup: ScoutSetup) {
  if (setup.status === "entry") return "구간 내부";
  if (setup.status === "active") return "활성 감지";
  if (setup.proximity === "near") return "근접 관찰";
  return "관찰";
}

function getMainSentence(board: MarketBoardItem[], setups: ScoutSetup[], scope: BriefScope) {
  const tone = getMarketTone(board, scope);
  const top = uniqueTopSetups(setups, 1)[0] ?? null;
  const readyCount = setups.filter((setup) => setup.proximity === "ready" || setup.proximity === "near").length;

  if (!top) {
    if (scope === "major") {
      return `${tone.label} 흐름이지만 BTC와 ETH의 구조 감지는 아직 강하지 않습니다. 지금은 1h와 4h 방향을 먼저 확인하고, 알트코인은 별도 레이더에서만 좁혀보는 편이 좋습니다.`;
    }
    return `${tone.label} 흐름이지만 구조 감지는 아직 강하지 않습니다. 지금은 거래대금 상위와 뉴스 이슈가 겹치는 코인 위주로만 좁혀보는 편이 좋습니다.`;
  }

  if (scope === "major") {
    return `${tone.label} 흐름 속에서 ${compactSymbol(top.symbol)} ${top.timeframe}가 먼저 볼 레이더 감지로 올라왔습니다. BTC와 ETH는 시장 기준선 역할이 크기 때문에, 이 화면에서는 알트코인보다 큰 방향과 위험 구간을 먼저 정리합니다.`;
  }

  return `${tone.label} 흐름 속에서 ${compactSymbol(top.symbol)} ${top.timeframe}가 가장 먼저 볼 레이더 감지로 올라왔습니다. 감지 코인이 ${readyCount}개라서 무작정 넓게 보기보다 TOP 감지와 뉴스 이슈를 함께 확인하는 흐름이 좋습니다.`;
}

function getNextAction(setups: ScoutSetup[], scope: BriefScope) {
  const top = uniqueTopSetups(setups, 1)[0] ?? null;
  if (!top) {
    if (scope === "major") {
      return "BTC와 ETH의 1h, 4h 방향부터 확인하고 알트코인은 아직 넓게 보지 마세요.";
    }
    return "오늘은 억지로 후보를 찾기보다 BTC, ETH, 레이더뉴스 순서로 시장 방향만 정리해보세요.";
  }

  return `${compactSymbol(top.symbol)} ${top.timeframe}를 먼저 열고, 가격이 구조 구간에 가까워지는지와 반대 방향 스윕이 새로 나오는지만 확인하세요.`;
}

function MiniSetupCard({
  setup,
  isSaved,
  onToggleAlert
}: {
  setup: ScoutSetup;
  isSaved: boolean;
  onToggleAlert: (setup: ScoutSetup) => void;
}) {
  const isLong = setup.plan.side === "long";
  const Icon = isLong ? ArrowUpRight : ArrowDownRight;

  return (
    <article className="rounded-md border border-white/10 bg-black/25 p-3 [word-break:keep-all]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-base font-black text-white">{compactSymbol(setup.symbol)}</span>
            <span className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
              {setup.timeframe}
            </span>
            <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-black ${sideClasses(setup.plan.side)}`}>
              <Icon size={11} aria-hidden />
              {sideLabel(setup.plan.side)}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300">{setup.headline}</p>
        </div>
        <span className="shrink-0 rounded border border-accent-blue/35 bg-accent-blue/10 px-2 py-1 text-[11px] font-black text-accent-blue">
          {setup.score}점
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-bold">
        <span className="rounded border border-white/10 bg-black/30 px-2 py-1 text-slate-300">{setupStateLabel(setup)}</span>
        <span className="rounded border border-white/10 bg-black/30 px-2 py-1 text-slate-300">{setup.plan.quality}급</span>
        <span className="rounded border border-white/10 bg-black/30 px-2 py-1 text-slate-300">신뢰 {setup.plan.confidence}%</span>
      </div>
      <button
        type="button"
        onClick={() => onToggleAlert(setup)}
        className={`mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-md border px-3 text-xs font-black transition ${
          isSaved
            ? "border-emerald-300/35 bg-emerald-300/15 text-emerald-200 hover:bg-emerald-300/25"
            : "border-accent-blue/35 bg-accent-blue/10 text-accent-blue hover:bg-accent-blue hover:text-slate-950"
        }`}
      >
        {isSaved ? <CheckCircle2 size={14} aria-hidden /> : <BellRing size={14} aria-hidden />}
        {isSaved ? "감시 중" : "감시 저장"}
      </button>
    </article>
  );
}

export function DailyRadarBrief({ scope = "all" }: { scope?: BriefScope }) {
  const { profile } = useSupabaseAuth();
  const isPaid = hasMarketEntitlement(profile?.plan, "crypto");
  const [state, setState] = useState<DailyBriefState>({ status: "loading" });
  const [savedPresetIds, setSavedPresetIds] = useState<Set<string>>(() => new Set());
  const [alertToast, setAlertToast] = useState<string | null>(null);

  const loadBrief = useCallback(async () => {
    const usageGate = getUsageGate("radarScan", isPaid);
    if (!usageGate.allowed) {
      setState({ status: "error", message: usageGate.message });
      return;
    }

    setState({ status: "loading" });
    try {
      const boardResponse = await fetch("/api/market-board", { cache: "no-store" });
      const scanResults = await Promise.allSettled(
        scanModes.map(async (mode) => {
          const response = await fetch(
            `/api/scout?mode=${mode}&risk=radar&scope=${scope}`,
            await withSupabaseAuth({ cache: "no-store" })
          );
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

      const boardPayload = (await boardResponse.json().catch(() => ({}))) as {
        items?: MarketBoardItem[];
        cachedAt?: number;
        error?: string;
      };

      if (!boardResponse.ok || !Array.isArray(boardPayload.items)) {
        throw new Error(boardPayload.error ?? "시장 흐름을 잠시 확인하지 못했습니다.");
      }

      const scanPayloads = scanResults
        .filter((result): result is PromiseFulfilledResult<{ setups?: ScoutSetup[]; cachedAt?: number }> => result.status === "fulfilled")
        .map((result) => result.value);

      setState({
        status: "ready",
        board: boardPayload.items.filter((item) => isInScope(item.symbol, scope)),
        setups: scanPayloads.flatMap((payload) => payload.setups ?? []).filter((setup) => isInScope(setup.symbol, scope)),
        cachedAt: Math.max(boardPayload.cachedAt ?? Date.now(), ...scanPayloads.map((payload) => payload.cachedAt ?? Date.now()))
      });
      recordUsageEvent("radarScan");
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "오늘의 레이더 브리핑을 잠시 확인하지 못했습니다."
      });
    }
  }, [isPaid, scope]);

  useEffect(() => {
    void loadBrief();
  }, [loadBrief]);

  useEffect(() => {
    setSavedPresetIds(new Set(readSetupAlertPresets("crypto").map((preset) => preset.id)));
  }, []);

  function toggleSetupAlert(setup: ScoutSetup) {
    const preset = buildSetupAlertPreset(setup, "crypto");
    const current = readSetupAlertPresets("crypto");
    const exists = current.some((item) => item.id === preset.id);
    const next = exists ? current.filter((item) => item.id !== preset.id) : [preset, ...current.filter((item) => item.id !== preset.id)];

    if (!exists) {
      const usageGate = getUsageGate("cryptoAlertRule", isPaid);
      if (!usageGate.allowed) {
        setAlertToast(usageGate.message);
        return;
      }
    }

    writeSetupAlertPresets(next, "crypto");
    setSavedPresetIds(new Set(next.map((item) => item.id)));
    if (!exists) {
      recordUsageEvent("cryptoAlertRule");
      setAlertToast(`${compactSymbol(setup.symbol)} ${setup.timeframe} ${sideLabel(setup.plan.side)} 조건을 감시 목록에 저장했습니다.`);
    } else {
      setAlertToast(`${compactSymbol(setup.symbol)} ${setup.timeframe} 감시 조건을 해제했습니다.`);
    }
  }

  const summary = useMemo(() => {
    if (state.status !== "ready") return null;

    const topSetups = uniqueTopSetups(state.setups, 3);
    const tone = getMarketTone(state.board, scope);
    const volumeLeader = [...state.board].sort((a, b) => b.quoteVolume - a.quoteVolume)[0] ?? null;
    const strongestMove = [...state.board].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))[0] ?? null;
    const strongCount = state.setups.filter((setup) => setup.status === "entry" || setup.status === "active").length;
    const watchCount = state.setups.filter((setup) => setup.status === "watch").length;

    return {
      tone,
      topSetups,
      volumeLeader,
      strongestMove,
      strongCount,
      watchCount,
      sentence: getMainSentence(state.board, state.setups, scope),
      nextAction: getNextAction(state.setups, scope)
    };
  }, [scope, state]);

  return (
    <section className="overflow-hidden rounded-xl border border-surface-line bg-surface-card shadow-[0_18px_58px_rgba(0,0,0,0.2)]">
      <div className="relative border-b border-surface-line bg-[linear-gradient(135deg,rgba(15,23,42,0.9),rgba(8,13,23,0.72))] p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="radar-mark-lg h-14 w-14 shrink-0 border border-accent-blue/25" />
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-accent-blue">Daily Radar</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-white">오늘의 레이더 브리핑</h2>
              <p className="mt-1 text-xs font-bold text-slate-500">Binance 기준 거래 흐름을 참고합니다.</p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300 [word-break:keep-all]">
                {summary?.sentence ?? (scope === "major" ? "BTC와 ETH 흐름을 먼저 훑어서 오늘 시장의 기준선을 정리하고 있습니다." : "주요 코인과 뉴스 흐름을 한 번에 훑어서 오늘 먼저 확인할 순서를 정리하고 있습니다.")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadBrief}
            disabled={state.status === "loading"}
            className="enterprise-button inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-accent-blue/30 bg-accent-blue/10 px-3 text-sm font-black text-accent-blue hover:bg-accent-blue hover:text-slate-950 disabled:cursor-wait disabled:opacity-70"
          >
            <RefreshCw size={15} className={state.status === "loading" ? "animate-spin" : ""} aria-hidden />
            레이더 새로고침
          </button>
        </div>

        {state.status === "ready" && summary ? (
          <div className="mt-4 grid gap-2 md:grid-cols-4">
            <div className={`rounded-xl border p-3 ${toneClasses(summary.tone.tone)}`}>
              <p className="flex items-center gap-1.5 text-[11px] font-bold opacity-80">
                <Gauge size={13} aria-hidden />
                시장 흐름
              </p>
              <p className="mt-1 text-lg font-black">{summary.tone.label}</p>
              <p className="mt-1 text-xs font-semibold opacity-80">{summary.tone.description}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                <Activity size={13} aria-hidden />
                거래대금 중심
              </p>
              <p className="mt-1 text-lg font-black text-white">{summary.volumeLeader?.name ?? "-"}</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                {summary.volumeLeader
                  ? `${formatVolume(summary.volumeLeader.quoteVolume)} · ${formatPrice(summary.volumeLeader.price)}`
                  : "데이터 대기"}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                <Star size={13} aria-hidden />
                가장 큰 변동
              </p>
              <p className="mt-1 text-lg font-black text-white">{summary.strongestMove?.name ?? "-"}</p>
              <p className={summary.strongestMove && summary.strongestMove.changePercent >= 0 ? "mt-1 text-xs font-black text-signal-success" : "mt-1 text-xs font-black text-signal-danger"}>
                {summary.strongestMove ? `${summary.strongestMove.changePercent.toFixed(2)}%` : "-"}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-signal-warning">
              <p className="flex items-center gap-1.5 text-[11px] font-bold opacity-80">
                <ShieldAlert size={13} aria-hidden />
                지금 확인할 것
              </p>
              <p className="mt-1 text-xs font-bold leading-5 [word-break:keep-all]">{summary.nextAction}</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="p-4 sm:p-5">
        {state.status === "loading" ? (
          <div className="flex min-h-32 items-center justify-center gap-2 rounded-xl border border-surface-line bg-surface-cardSoft text-sm text-slate-400">
            <Loader2 size={18} className="animate-spin text-accent-blue" aria-hidden />
            오늘의 시장 레이더를 정리하는 중입니다.
          </div>
        ) : null}

        {state.status === "error" ? (
          <div className="rounded-xl border border-signal-danger/30 bg-signal-danger/10 p-4 text-sm text-signal-danger">
            {state.message}
          </div>
        ) : null}

        {state.status === "ready" && summary ? (
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-black text-white">레이더 TOP 감지</h3>
                <span className="text-xs font-semibold text-slate-500">{formatCachedAt(state.cachedAt)}</span>
              </div>
              {summary.topSetups.length > 0 ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {summary.topSetups.map((setup) => (
                    <MiniSetupCard
                      key={`${setup.symbol}-${setup.timeframe}-${setup.mode}`}
                      setup={setup}
                      isSaved={savedPresetIds.has(getSetupAlertPresetId(setup, "crypto"))}
                      onToggleAlert={toggleSetupAlert}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-300 [word-break:keep-all]">
                  지금은 강한 레이더 감지가 많지 않습니다. 억지로 후보를 찾기보다 BTC와 ETH의 큰 흐름, 그리고 뉴스 이슈를 먼저 확인하는 장이 좋아 보입니다.
                </div>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-black text-white">오늘 확인 루틴</p>
              <div className="mt-3 grid gap-2">
                <Link
                  href="/majors"
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm font-bold text-slate-200 hover:border-accent-blue/40 hover:text-white"
                >
                  BTC/ETH 큰 흐름 확인
                  <Radar size={15} aria-hidden />
                </Link>
                <Link
                  href="/alts"
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm font-bold text-slate-200 hover:border-accent-blue/40 hover:text-white"
                >
                  알트코인 레이더에서 확산 확인
                  <ArrowUpRight size={15} aria-hidden />
                </Link>
                <Link
                  href="/news"
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm font-bold text-slate-200 hover:border-accent-blue/40 hover:text-white"
                >
                  레이더뉴스로 변동성 이슈 확인
                  <Newspaper size={15} aria-hidden />
                </Link>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500 [word-break:keep-all]">
                이 화면은 오늘 시장에서 먼저 확인할 순서를 줄여주는 관제실입니다. 중요해 보이는 감지는 저장해두면 알림 센터에서 다시 확인할 수 있습니다.
              </p>
            </div>
          </div>
        ) : null}

        {alertToast ? (
          <p className="mt-4 rounded-md border border-accent-blue/25 bg-accent-blue/10 px-3 py-2 text-xs font-bold leading-5 text-accent-blue">
            {alertToast}
          </p>
        ) : null}
      </div>
    </section>
  );
}
