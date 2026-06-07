"use client";
// Binance 공개 데이터로 변동성 압력과 고배율 위험 거리를 설명하는 코인 전용 패널입니다.
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Gauge, Loader2 } from "lucide-react";
import { RadarScanLoader } from "@/components/RadarScanLoader";
import { CompactHelp } from "@/components/ui/CompactHelp";
import type { ChartTimeframe } from "@/lib/marketAnalysis";
import type { LiquidationPressureReport, LiquidationPressureSide } from "@/lib/liquidationPressure";

interface LiquidationPressurePanelProps {
  symbol: string;
  timeframe: ChartTimeframe;
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; report: LiquidationPressureReport; cached: boolean; isRefreshing?: boolean; stale?: boolean }
  | { status: "error"; message: string };

function compactSymbol(symbol: string) {
  return symbol.replace("USDT.P", "").replace("USDT", "");
}

function formatPrice(value: number | null | undefined) {
  if (!Number.isFinite(value) || !value) return "-";
  const digits = value >= 100 ? 2 : value >= 10 ? 3 : value >= 1 ? 4 : 5;
  return value.toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

function formatPercent(value: number | null | undefined, digits = 2) {
  if (!Number.isFinite(value)) return "-";
  return `${Number(value).toFixed(digits)}%`;
}

function formatUsd(value: number | null | undefined) {
  if (!Number.isFinite(value) || value === null || value === undefined) return "-";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}`;
}

function sideLabel(side: LiquidationPressureSide) {
  if (side === "upsideShorts") return "롱 우세 압력";
  if (side === "downsideLongs") return "숏 우세 압력";
  return "롱/숏 압력 균형";
}

function sideDescription(side: LiquidationPressureSide) {
  if (side === "upsideShorts") return "상방 급변 시 숏 포지션 정리가 겹쳐 롱 우세 압력이 커질 수 있다는 뜻입니다.";
  if (side === "downsideLongs") return "하방 급변 시 롱 포지션 정리가 겹쳐 숏 우세 압력이 커질 수 있다는 뜻입니다.";
  return "한쪽 압력이 압도적이지 않습니다. 롱/숏 방향보다 구조 반응을 먼저 봅니다.";
}

function gradeLabel(grade: LiquidationPressureReport["grade"]) {
  if (grade === "extreme") return "매우 과열";
  if (grade === "heated") return "과열";
  if (grade === "normal") return "보통";
  return "차분";
}

function gradeClasses(grade: LiquidationPressureReport["grade"]) {
  if (grade === "extreme") return "border-signal-danger/35 bg-signal-danger/10 text-signal-danger";
  if (grade === "heated") return "border-signal-warning/35 bg-signal-warning/10 text-signal-warning";
  if (grade === "normal") return "border-accent-blue/35 bg-accent-blue/10 text-accent-blue";
  return "border-signal-success/35 bg-signal-success/10 text-signal-success";
}

function dominantClasses(side: LiquidationPressureSide) {
  if (side === "upsideShorts") return "border-signal-success/35 bg-signal-success/10 text-signal-success";
  if (side === "downsideLongs") return "border-signal-danger/35 bg-signal-danger/10 text-signal-danger";
  return "border-slate-500/25 bg-slate-500/10 text-slate-300";
}

function oiInterpretation(report: LiquidationPressureReport) {
  const change = report.openInterestChangePercent;
  if (change === null) return "미결제약정 흐름은 아직 확인되지 않았습니다.";
  if (change > 2) return "미결제약정이 빠르게 늘어 롱/숏 진입 위험이 커진 구간입니다.";
  if (change > 0.3) return "미결제약정이 소폭 늘고 있습니다. 롱/숏 체결 쏠림을 같이 봅니다.";
  if (change < -1) return "미결제약정이 줄어 포지션 정리가 진행 중입니다. 추격 매수보다 진입 대기 쪽입니다.";
  return "미결제약정 변화가 크지 않아 롱/숏 쏠림은 제한적입니다.";
}

function takerInterpretation(report: LiquidationPressureReport) {
  const buy = report.takerFlow.buyPercent;
  const sell = report.takerFlow.sellPercent;
  if (buy === null || sell === null) return "큰 매수/매도 체결 쏠림은 아직 확인되지 않았습니다.";
  if (buy >= sell + 8) return "큰 매수 체결이 우세합니다. 과열 구간에서는 추격 매수 금지 기준도 같이 봅니다.";
  if (sell >= buy + 8) return "큰 매도 체결이 우세합니다. 지지 구간 근처에서는 손절/무효화 기준을 먼저 봅니다.";
  return "큰 매수/매도 체결이 한쪽으로 크게 기울지 않았습니다.";
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold text-slate-500">{label}</p>
        {sub ? <CompactHelp label={label}>{sub}</CompactHelp> : null}
      </div>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}

export function LiquidationPressurePanel({ symbol, timeframe }: LiquidationPressurePanelProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    async function load() {
      setState((current) => (current.status === "ready" ? { ...current, isRefreshing: true } : { status: "loading" }));
      try {
        const response = await fetch(`/api/liquidation-pressure?symbol=${encodeURIComponent(symbol)}&period=${timeframe}`, {
          cache: "no-store",
          signal: controller.signal
        });
        const payload = (await response.json().catch(() => ({}))) as {
          report?: LiquidationPressureReport;
          cached?: boolean;
          stale?: boolean;
          error?: string;
        };

        if (!response.ok || !payload.report) {
          throw new Error(payload.error ?? "변동성 압력 흐름을 잠시 확인하지 못했습니다.");
        }

        if (alive) setState({ status: "ready", report: payload.report, cached: Boolean(payload.cached), stale: Boolean(payload.stale) });
      } catch (error) {
        if (!alive || controller.signal.aborted) return;
        setState((current) =>
          current.status === "ready"
            ? { ...current, isRefreshing: false, stale: true }
            : { status: "error", message: error instanceof Error ? error.message : "변동성 압력 흐름을 잠시 확인하지 못했습니다." }
        );
      }
    }

    void load();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [symbol, timeframe]);

  const report = state.status === "ready" ? state.report : null;
  const pressureTotal = useMemo(() => {
    if (!report) return 100;
    return Math.max(1, report.upsideShortPressure + report.downsideLongPressure);
  }, [report]);

  if (state.status === "loading") {
    return (
      <section className="border-y border-accent-blue/20 py-4">
        <div className="flex items-center gap-3">
          <RadarScanLoader size="sm" />
          <div>
            <p className="text-xs font-black tracking-widest text-accent-blue">롱/숏 압력</p>
            <h3 className="mt-1 text-lg font-black text-white">롱/숏 위험 판단 중</h3>
          </div>
          <Loader2 className="ml-auto animate-spin text-accent-blue" size={18} aria-hidden />
        </div>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="border-y border-signal-warning/25 py-4 text-signal-warning">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} aria-hidden />
          <div>
            <p className="text-sm font-black">롱/숏 압력 흐름을 잠시 판단하지 못했습니다.</p>
            <p className="mt-1 text-xs leading-5 opacity-80">{state.message}</p>
          </div>
        </div>
      </section>
    );
  }

  if (!report) return null;

  const upsideWidth = `${Math.round((report.upsideShortPressure / pressureTotal) * 100)}%`;
  const downsideWidth = `${Math.round((report.downsideLongPressure / pressureTotal) * 100)}%`;
  const dataStatusLabel = state.isRefreshing ? "갱신 중" : state.stale ? "최근 저장값" : state.cached ? "캐시" : "실시간";

  return (
    <section className="border-y border-accent-blue/20 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <RadarScanLoader size="sm" className="shrink-0" />
          <div>
            <p className="text-xs font-black tracking-widest text-accent-blue">롱/숏 압력</p>
            <div className="mt-1 flex items-center gap-2">
              <h3 className="text-lg font-black text-white">{compactSymbol(symbol)} 롱/숏 위험 레이더</h3>
              <CompactHelp label="롱/숏 압력">{sideDescription(report.dominantSide)}</CompactHelp>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-black text-slate-400">
            {dataStatusLabel}
          </span>
          <span className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-black ${dominantClasses(report.dominantSide)}`}>
            {report.dominantSide === "upsideShorts" ? <ArrowUp size={13} aria-hidden /> : report.dominantSide === "downsideLongs" ? <ArrowDown size={13} aria-hidden /> : <Gauge size={13} aria-hidden />}
            {sideLabel(report.dominantSide)}
          </span>
          <span className={`inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-black ${gradeClasses(report.grade)}`}>
            {gradeLabel(report.grade)}
          </span>
        </div>
      </div>

      <div className="mt-4 border-y border-white/10 py-4">
        <div className="flex items-center justify-between gap-3 text-xs font-bold">
          <span className="text-signal-success">롱 우세 압력 {report.upsideShortPressure}점</span>
          <span className="text-signal-danger">숏 우세 압력 {report.downsideLongPressure}점</span>
        </div>
        <div className="mt-2 grid h-4 grid-cols-2 overflow-hidden rounded-full bg-black/35 ring-1 ring-white/10">
          <div className="flex justify-end bg-signal-success/20">
            <div className="h-full rounded-l-full bg-signal-success" style={{ width: upsideWidth }} />
          </div>
          <div className="bg-signal-danger/20">
            <div className="h-full rounded-r-full bg-signal-danger" style={{ width: downsideWidth }} />
          </div>
        </div>
        <div className="mt-3">
          <CompactHelp label="압력 점수">공개 시장 데이터로 롱/숏 압력을 추정합니다. 한쪽 압력이 높을수록 진입 위험이 커집니다.</CompactHelp>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Metric label="현재 기준가" value={formatPrice(report.markPrice)} sub="선물 시장에서 손익과 청산 계산에 쓰이는 기준 가격입니다." />
        <Metric label="펀딩비" value={formatPercent(report.fundingRatePercent, 4)} sub="한쪽 포지션 비용 부담입니다." />
        <Metric label="OI 변화" value={formatPercent(report.openInterestChangePercent)} sub={oiInterpretation(report)} />
        <Metric label="미결제약정" value={formatUsd(report.openInterestValue)} sub="시장에 남아 있는 포지션 규모입니다." />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="border-y border-white/10 py-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-black text-white">글로벌 롱/숏 비율</h4>
            <CompactHelp label="롱/숏 비율">Binance 기준 롱과 숏 포지션 비율입니다. 한쪽으로 몰릴수록 반대 방향 변동성도 같이 커질 수 있습니다.</CompactHelp>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs font-black">
              <span className="text-signal-success">롱 {formatPercent(report.globalLongShort.longPercent, 1)}</span>
              <span className="text-signal-danger">숏 {formatPercent(report.globalLongShort.shortPercent, 1)}</span>
            </div>
            <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
              <div
                className="h-full bg-signal-success"
                style={{ width: `${Math.max(0, Math.min(100, report.globalLongShort.longPercent ?? 0))}%` }}
              />
              <div
                className="h-full bg-signal-danger"
                style={{ width: `${Math.max(0, Math.min(100, report.globalLongShort.shortPercent ?? 0))}%` }}
              />
            </div>
          </div>
        </div>

        <div className="border-y border-white/10 py-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-black text-white">큰 매수/매도 체결</h4>
            <CompactHelp label="큰 체결">최근 시장가 매수와 시장가 매도 중 어느 쪽 체결이 더 강했는지 보는 값입니다. 한쪽으로 치우치면 진입 위험이 커질 수 있습니다.</CompactHelp>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Metric label="시장가 유입" value={formatPercent(report.takerFlow.buyPercent, 1)} sub={report.takerFlow.buyVolume === null ? "-" : report.takerFlow.buyVolume.toLocaleString("ko-KR", { maximumFractionDigits: 2 })} />
            <Metric label="시장가 이탈" value={formatPercent(report.takerFlow.sellPercent, 1)} sub={report.takerFlow.sellVolume === null ? "-" : report.takerFlow.sellVolume.toLocaleString("ko-KR", { maximumFractionDigits: 2 })} />
          </div>
          <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-5 text-slate-400 [word-break:keep-all]">
            {takerInterpretation(report)}
          </p>
        </div>
      </div>

    </section>
  );
}
