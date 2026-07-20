"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Ban, CheckCircle2, Crosshair, RefreshCw } from "lucide-react";
import { ActionButton, PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";
import type { LargeTradeFlowReport, LargeTradeSide } from "@/lib/largeTradeFlow";
import type { LiquidationPressureReport, LiquidationPressureSide } from "@/lib/liquidationPressure";
import { futuresPressureScore, selectFuturesBriefCandidate } from "@/lib/futuresBriefSelection";

type FuturesBriefMode = "major" | "alts";
type PlanTone = "long" | "short" | "watch" | "risk" | "info";
type LoadStatus = "idle" | "loading" | "ready" | "error";

export type FuturesBriefSymbol = {
  symbol: string;
  label: string;
};

type FuturesBriefPayload = {
  report?: LiquidationPressureReport | LargeTradeFlowReport;
  error?: string;
};

type TradePlan = {
  eyebrow: string;
  title: string;
  summary: string;
  badge: string;
  tone: PlanTone;
  primaryAction: string;
  longPlan: string;
  shortPlan: string;
  noTrade: string;
  invalidation: string;
};

const modeSymbols: Record<FuturesBriefMode, FuturesBriefSymbol[]> = {
  major: [
    { symbol: "BTCUSDT", label: "BTC" },
    { symbol: "ETHUSDT", label: "ETH" }
  ],
  alts: [
    { symbol: "SOLUSDT", label: "SOL" },
    { symbol: "XRPUSDT", label: "XRP" },
    { symbol: "DOGEUSDT", label: "DOGE" },
    { symbol: "BNBUSDT", label: "BNB" }
  ]
};

function formatUsd(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return "뚜렷한 큰 체결 없음";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatPercent(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

function pressureScore(report: LiquidationPressureReport) {
  return futuresPressureScore(report);
}

function isHeatedPressure(report?: LiquidationPressureReport) {
  return Boolean(report && (report.grade === "heated" || report.grade === "extreme" || pressureScore(report) >= 55));
}

function sideDirection(side?: LiquidationPressureSide) {
  if (side === "upsideShorts") return "long" as const;
  if (side === "downsideLongs") return "short" as const;
  return "neutral" as const;
}

function flowDirection(side?: LargeTradeSide) {
  if (side === "buy") return "long" as const;
  if (side === "sell") return "short" as const;
  return "neutral" as const;
}

function sideLabel(side?: LiquidationPressureSide) {
  if (side === "upsideShorts") return "숏 쏠림";
  if (side === "downsideLongs") return "롱 쏠림";
  return "균형";
}

function flowLabel(side?: LargeTradeSide) {
  if (side === "buy") return "큰 매수";
  if (side === "sell") return "큰 매도";
  return "균형";
}

function buildTradePlan({
  mode,
  scopeLabel,
  status,
  pressure,
  flow
}: {
  mode: FuturesBriefMode;
  scopeLabel: string;
  status: LoadStatus;
  pressure?: LiquidationPressureReport;
  flow?: LargeTradeFlowReport;
}): TradePlan {
  const scope = mode === "alts" ? `${scopeLabel} 알트 선물` : `${scopeLabel} 선물`;
  const pressureDirection = sideDirection(pressure?.dominantSide);
  const largeFlowDirection = flowDirection(flow?.dominantSide);
  const heated = isHeatedPressure(pressure);
  const hasLargeFlow = Boolean(flow && flow.largeTradeCount > 0 && flow.totalLargeNotionalUsd > 0);
  const alignedLong = pressureDirection === "long" && largeFlowDirection === "long";
  const alignedShort = pressureDirection === "short" && largeFlowDirection === "short";
  const conflicted =
    pressureDirection !== "neutral" &&
    largeFlowDirection !== "neutral" &&
    pressureDirection !== largeFlowDirection;

  if (status === "loading" || status === "idle") {
    return {
      eyebrow: "선물 리스크 스냅샷",
      title: "지금 상태 확인 중",
      summary: `${scope} 쏠림과 큰 체결을 읽는 중입니다. 확인 전 방향 판단을 보류합니다.`,
      badge: "확인 중",
      tone: "info",
      primaryAction: "지금은 대기",
      longPlan: "롱은 쏠림 완화 뒤 큰 매수와 구조 회복이 같이 보일 때만 봅니다.",
      shortPlan: "숏은 지지 이탈 뒤 큰 매도와 구조 약화가 같이 보일 때만 봅니다.",
      noTrade: "데이터 정상화 전 조건 판단 보류",
      invalidation: "쏠림과 체결 방향이 충돌하면 판단 보류"
    };
  }

  if (status === "error" || !pressure) {
    return {
      eyebrow: "선물 리스크 스냅샷",
      title: "데이터 지연 · 판단 보류",
      summary: `${scope} 실시간 압력 확인이 지연되고 있습니다. 차트만 보고 방향을 정하지 않습니다.`,
      badge: "보류",
      tone: "risk",
      primaryAction: "조건 확인 보류",
      longPlan: "롱은 쏠림 데이터가 복구되고 돌파 유지가 확인될 때까지 대기합니다.",
      shortPlan: "숏은 쏠림 데이터가 복구되고 이탈 유지가 확인될 때까지 대기합니다.",
      noTrade: "근거 없는 추격 판단 보류",
      invalidation: "실시간 데이터가 없으면 포지션 크기를 키우지 않습니다."
    };
  }

  if (conflicted) {
    return {
      eyebrow: "선물 리스크 스냅샷",
      title: "방향 충돌 · 지금은 관망",
      summary: `${sideLabel(pressure.dominantSide)}과 ${flowLabel(flow?.dominantSide)}가 엇갈립니다. 한쪽 방향으로 단정하기 어렵습니다.`,
      badge: "관망",
      tone: "watch",
      primaryAction: "방향 확인 보류",
      longPlan: "롱은 큰 매수가 유지되고 가격이 직전 고점을 다시 회복할 때만 검토합니다.",
      shortPlan: "숏은 큰 매도가 유지되고 가격이 직전 저점을 이탈할 때만 검토합니다.",
      noTrade: "상방·하방 신호가 섞인 구간에서는 조건 확인 우선",
      invalidation: "다음 캔들에서 체결 방향이 바뀌면 판단을 다시 계산합니다."
    };
  }

  if (alignedLong || (pressureDirection === "long" && heated)) {
    return {
      eyebrow: "선물 리스크 스냅샷",
      title: alignedLong ? "상방 조건 강화 · 돌파 유지 확인" : "상방 변동성 확인 대기",
      summary: `${sideLabel(pressure.dominantSide)} 압력이 우세합니다. ${hasLargeFlow ? `${flowLabel(flow?.dominantSide)} ${formatUsd(flow?.totalLargeNotionalUsd)}도 같이 봅니다.` : "큰 체결 확인 전에는 대기합니다."}`,
      badge: alignedLong ? "상방 확인" : "대기",
      tone: alignedLong ? "long" : "watch",
      primaryAction: alignedLong ? "재상승 확인 조건 추적" : "돌파 확인 전 대기",
      longPlan: "상방 시나리오는 직전 고점 회복 뒤 재이탈이 없고 큰 매수가 유지되는지 확인합니다.",
      shortPlan: "하방 시나리오는 돌파 실패와 큰 매도 전환이 동시에 나타나는지 확인합니다.",
      noTrade: "급등 직후 추격 판단 보류",
      invalidation: "큰 매수가 사라지거나 직전 돌파 구간을 다시 이탈하면 상방 판단을 변경합니다."
    };
  }

  if (alignedShort || (pressureDirection === "short" && heated)) {
    return {
      eyebrow: "선물 리스크 스냅샷",
      title: alignedShort ? "하방 조건 강화 · 이탈 유지 확인" : "하방 변동성 확인 대기",
      summary: `${sideLabel(pressure.dominantSide)} 압력이 우세합니다. ${hasLargeFlow ? `${flowLabel(flow?.dominantSide)} ${formatUsd(flow?.totalLargeNotionalUsd)}도 같이 봅니다.` : "큰 체결 확인 전에는 대기합니다."}`,
      badge: alignedShort ? "하방 확인" : "대기",
      tone: alignedShort ? "short" : "watch",
      primaryAction: alignedShort ? "반등 실패 확인 조건 추적" : "이탈 확인 전 대기",
      longPlan: "상방 시나리오는 이탈 회복과 큰 매수 전환이 동시에 나타나는지 확인합니다.",
      shortPlan: "하방 시나리오는 직전 저점 이탈 뒤 반등 실패와 큰 매도 유지 여부를 확인합니다.",
      noTrade: "급락 직후 추격 판단 보류",
      invalidation: "큰 매도가 사라지거나 이탈 구간을 회복하면 하방 판단을 변경합니다."
    };
  }

  return {
    eyebrow: "선물 리스크 스냅샷",
    title: "방향 약함 · 박스 안에서는 관망",
    summary: `${scope} 압력이 한쪽으로 강하지 않습니다. 롱/숏 모두 확인 조건이 부족합니다.`,
    badge: "관망",
    tone: "watch",
    primaryAction: "돌파·이탈 전 대기",
    longPlan: "롱은 직전 고점 돌파 후 큰 매수와 미결제약정 증가가 같이 나올 때만 봅니다.",
    shortPlan: "숏은 직전 저점 이탈 후 큰 매도와 미결제약정 증가가 같이 나올 때만 봅니다.",
    noTrade: "박스 중앙에서는 방향 판단 보류",
    invalidation: "돌파·이탈이 바로 되돌려지면 방향 판단을 변경합니다."
  };
}

async function fetchPressure(symbol: string, signal: AbortSignal) {
  const response = await fetch(`/api/liquidation-pressure?symbol=${encodeURIComponent(symbol)}&period=1h`, { cache: "no-store", signal });
  const payload = (await response.json()) as FuturesBriefPayload;
  if (!response.ok || !payload.report) throw new Error(payload.error ?? "선물 압력 확인 실패");
  return payload.report as LiquidationPressureReport;
}

async function fetchLargeTradeFlow(symbol: string, signal: AbortSignal) {
  const response = await fetch(`/api/large-trade-flow?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store", signal });
  const payload = (await response.json()) as FuturesBriefPayload;
  if (!response.ok || !payload.report) throw new Error(payload.error ?? "큰 체결 확인 실패");
  return payload.report as LargeTradeFlowReport;
}

export function CoinFuturesBrief({ mode, symbols: customSymbols }: { mode: FuturesBriefMode; symbols?: FuturesBriefSymbol[] }) {
  const symbols = useMemo(() => (customSymbols?.length ? customSymbols : modeSymbols[mode]), [customSymbols, mode]);
  const scopeLabel = useMemo(() => symbols.map((item) => item.label).join("/"), [symbols]);
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [pressureReports, setPressureReports] = useState<LiquidationPressureReport[]>([]);
  const [flowReports, setFlowReports] = useState<LargeTradeFlowReport[]>([]);
  const requestGeneration = useRef(0);
  const activeController = useRef<AbortController | null>(null);

  const loadPlan = useCallback(async () => {
    const generation = ++requestGeneration.current;
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    setStatus("loading");

    const [pressureResults, flowResults] = await Promise.all([
      Promise.allSettled(symbols.map((item) => fetchPressure(item.symbol, controller.signal))),
      Promise.allSettled(symbols.map((item) => fetchLargeTradeFlow(item.symbol, controller.signal)))
    ]);
    if (controller.signal.aborted || generation !== requestGeneration.current) return;

    const nextPressure = pressureResults.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
    const nextFlow = flowResults.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));

    setPressureReports(nextPressure);
    setFlowReports(nextFlow);
    setStatus(nextPressure.length ? "ready" : "error");
  }, [symbols]);

  useEffect(() => {
    void loadPlan();
    return () => {
      requestGeneration.current += 1;
      activeController.current?.abort();
    };
  }, [loadPlan]);

  const selectedCandidate = useMemo(
    () => selectFuturesBriefCandidate(symbols, pressureReports, flowReports),
    [flowReports, pressureReports, symbols]
  );
  const topPressure = selectedCandidate?.pressure;
  const topFlow = selectedCandidate?.flow;
  const plan = buildTradePlan({ mode, scopeLabel, status, pressure: topPressure, flow: topFlow });
  const pressureLabel = selectedCandidate?.label ?? scopeLabel;
  const flowLabelText = selectedCandidate?.label ?? pressureLabel;

  return (
    <PanelCard variant="report" padding="md" className="space-y-4 rounded-ui-lg">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)]">
        <div className="min-w-0">
          <SectionHeader
            eyebrow={plan.eyebrow}
            title={plan.title}
            description={plan.summary}
            action={
              <ActionButton tone="secondary" onClick={loadPlan} disabled={status === "loading"} className="min-h-9 px-2.5">
                <RefreshCw className={status === "loading" ? "animate-spin" : ""} size={15} aria-hidden />
                갱신
              </ActionButton>
            }
          />

          <article className="mt-4 rounded-ui-md bg-ui-inset/30 p-3">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">지금 할 행동</p>
                <p className="mt-1 text-xl font-semibold leading-7 text-ui-text [word-break:keep-all]">{plan.primaryAction}</p>
              </div>
              <StatusPill tone={plan.tone} icon={Crosshair} className="shrink-0">
                {plan.badge}
              </StatusPill>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <p className="rounded-ui-sm bg-ui-panel/35 px-3 py-2 text-xs font-semibold leading-5 text-ui-muted [word-break:keep-all]">
                압력: {pressureLabel} {sideLabel(topPressure?.dominantSide)} · {topPressure ? `${pressureScore(topPressure)}점` : "확인 중"}
              </p>
              <p className="rounded-ui-sm bg-ui-panel/35 px-3 py-2 text-xs font-semibold leading-5 text-ui-muted [word-break:keep-all]">
                체결: {flowLabelText} {flowLabel(topFlow?.dominantSide)} · {topFlow ? formatUsd(topFlow.totalLargeNotionalUsd) : "확인 중"}
              </p>
            </div>
          </article>
        </div>

        <div className="grid min-w-0 gap-2">
          <article className="min-w-0 rounded-ui-md bg-ui-inset/25 p-3">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">상방 확인 시나리오</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{plan.longPlan}</p>
              </div>
              <StatusPill tone="long" icon={ArrowUp} className="shrink-0">
                상방
              </StatusPill>
            </div>
          </article>

          <article className="min-w-0 rounded-ui-md bg-ui-inset/25 p-3">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">하방 확인 시나리오</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{plan.shortPlan}</p>
              </div>
              <StatusPill tone="short" icon={ArrowDown} className="shrink-0">
                하방
              </StatusPill>
            </div>
          </article>
        </div>
      </div>

      <section className="grid gap-2 md:grid-cols-3">
        <article className="min-w-0 rounded-ui-md bg-ui-inset/25 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">리스크 유의</p>
            <Ban size={15} className="shrink-0 text-ui-risk" aria-hidden />
          </div>
          <p className="mt-2 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{plan.noTrade}</p>
        </article>
        <article className="min-w-0 rounded-ui-md bg-ui-inset/25 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">판단 변경 기준</p>
            <AlertTriangle size={15} className="shrink-0 text-ui-watch" aria-hidden />
          </div>
          <p className="mt-2 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{plan.invalidation}</p>
        </article>
        <article className="min-w-0 rounded-ui-md bg-ui-inset/25 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">보조 수치</p>
            <CheckCircle2 size={15} className="shrink-0 text-ui-subtle" aria-hidden />
          </div>
          <p className="mt-2 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">
            OI {formatPercent(topPressure?.openInterestChangePercent)} · 펀딩 {formatPercent(topPressure?.fundingRatePercent, 4)}
          </p>
        </article>
      </section>
    </PanelCard>
  );
}
