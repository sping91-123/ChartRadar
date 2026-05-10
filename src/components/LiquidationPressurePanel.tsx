"use client";
// 청산 압력 추정치를 레이더 카드로 보여주는 코인 화면 컴포넌트.
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Gauge, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import type { ChartTimeframe } from "@/lib/marketAnalysis";
import type { LiquidationPressureReport, LiquidationPressureSide } from "@/lib/liquidationPressure";

interface LiquidationPressurePanelProps {
  symbol: string;
  timeframe: ChartTimeframe;
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; report: LiquidationPressureReport; cached: boolean }
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
  if (side === "upsideShorts") return "위쪽 숏 청산 압력";
  if (side === "downsideLongs") return "아래쪽 롱 청산 압력";
  return "양방향 균형";
}

function sideDescription(side: LiquidationPressureSide) {
  if (side === "upsideShorts") return "저항 돌파 시 숏 포지션이 밀리며 위쪽 변동성이 커질 수 있습니다.";
  if (side === "downsideLongs") return "지지 이탈 시 롱 포지션이 밀리며 아래쪽 변동성이 커질 수 있습니다.";
  return "한쪽 청산 압력이 압도적이지 않아 구조 반응을 먼저 확인하는 편이 좋습니다.";
}

function gradeLabel(grade: LiquidationPressureReport["grade"]) {
  if (grade === "extreme") return "과열";
  if (grade === "heated") return "높음";
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

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-3">
      <p className="text-[11px] font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
      {sub ? <p className="mt-1 text-[11px] leading-4 text-slate-500">{sub}</p> : null}
    </div>
  );
}

export function LiquidationPressurePanel({ symbol, timeframe }: LiquidationPressurePanelProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    async function load() {
      setState({ status: "loading" });
      try {
        const response = await fetch(`/api/liquidation-pressure?symbol=${encodeURIComponent(symbol)}&period=${timeframe}`, {
          cache: "no-store",
          signal: controller.signal
        });
        const payload = (await response.json().catch(() => ({}))) as {
          report?: LiquidationPressureReport;
          cached?: boolean;
          error?: string;
        };

        if (!response.ok || !payload.report) {
          throw new Error(payload.error ?? "청산 압력 데이터를 불러오지 못했습니다.");
        }

        if (alive) setState({ status: "ready", report: payload.report, cached: Boolean(payload.cached) });
      } catch (error) {
        if (!alive || controller.signal.aborted) return;
        setState({ status: "error", message: error instanceof Error ? error.message : "청산 압력 데이터를 불러오지 못했습니다." });
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
      <section className="rounded-lg border border-accent-blue/20 bg-surface-cardSoft p-4">
        <div className="flex items-center gap-3">
          <div className="radar-mark h-12 w-12 border border-accent-blue/30" />
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-accent-blue">Liquidation Pressure</p>
            <h3 className="mt-1 text-lg font-black text-white">청산 압력 레이더 확인 중</h3>
          </div>
          <Loader2 className="ml-auto animate-spin text-accent-blue" size={18} aria-hidden />
        </div>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="rounded-lg border border-signal-warning/25 bg-signal-warning/10 p-4 text-signal-warning">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} aria-hidden />
          <div>
            <p className="text-sm font-black">청산 압력 레이더를 불러오지 못했습니다</p>
            <p className="mt-1 text-xs leading-5 opacity-80">{state.message}</p>
          </div>
        </div>
      </section>
    );
  }

  if (!report) return null;

  const upsideWidth = `${Math.round((report.upsideShortPressure / pressureTotal) * 100)}%`;
  const downsideWidth = `${Math.round((report.downsideLongPressure / pressureTotal) * 100)}%`;

  return (
    <section className="rounded-lg border border-accent-blue/20 bg-surface-cardSoft p-4 shadow-glow">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="radar-mark h-14 w-14 shrink-0 border border-accent-blue/30" />
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-accent-blue">Liquidation Pressure</p>
            <h3 className="mt-1 text-lg font-black text-white">{compactSymbol(symbol)} 청산 압력 레이더</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400 [word-break:keep-all]">{report.summary}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-black ${dominantClasses(report.dominantSide)}`}>
            {report.dominantSide === "upsideShorts" ? <ArrowUp size={13} aria-hidden /> : report.dominantSide === "downsideLongs" ? <ArrowDown size={13} aria-hidden /> : <Gauge size={13} aria-hidden />}
            {sideLabel(report.dominantSide)}
          </span>
          <span className={`inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-black ${gradeClasses(report.grade)}`}>
            {gradeLabel(report.grade)}
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
        <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-400">
          <span>위쪽 숏 청산</span>
          <span>아래쪽 롱 청산</span>
        </div>
        <div className="mt-2 grid h-4 grid-cols-2 overflow-hidden rounded-full bg-black/35 ring-1 ring-white/10">
          <div className="flex justify-end bg-signal-success/20">
            <div className="h-full rounded-l-full bg-signal-success" style={{ width: upsideWidth }} />
          </div>
          <div className="bg-signal-danger/20">
            <div className="h-full rounded-r-full bg-signal-danger" style={{ width: downsideWidth }} />
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm font-black">
          <span className="text-signal-success">{report.upsideShortPressure}점</span>
          <span className="text-signal-danger">{report.downsideLongPressure}점</span>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500 [word-break:keep-all]">{sideDescription(report.dominantSide)}</p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Metric label="마크 가격" value={formatPrice(report.markPrice)} sub={`${timeframe} 기준`} />
        <Metric label="펀딩비" value={formatPercent(report.fundingRatePercent, 4)} sub="양수는 롱 비용 부담" />
        <Metric label="OI 변화" value={formatPercent(report.openInterestChangePercent)} sub={formatUsd(report.openInterestValue)} />
        <Metric
          label="글로벌 롱/숏"
          value={`${formatPercent(report.globalLongShort.longPercent, 1)} / ${formatPercent(report.globalLongShort.shortPercent, 1)}`}
          sub="계정 비율 기준"
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-black text-white">레버리지 밴드 추정</h4>
            <span className="text-[11px] font-bold text-slate-500">격리·교차·유지증거금은 계정별로 달라질 수 있음</span>
          </div>
          <div className="mt-3 space-y-2">
            {report.bands.map((band) => (
              <div key={band.leverage} className="grid grid-cols-[3.5rem_1fr_1fr] items-center gap-2 text-xs">
                <span className="rounded border border-white/10 bg-black/30 px-2 py-1 text-center font-black text-slate-300">{band.leverage}x</span>
                <span className="rounded border border-signal-danger/20 bg-signal-danger/5 px-2 py-1 font-bold text-signal-danger">
                  롱 {formatPrice(band.longLiquidationPrice)}
                </span>
                <span className="rounded border border-signal-success/20 bg-signal-success/5 px-2 py-1 font-bold text-signal-success">
                  숏 {formatPrice(band.shortLiquidationPrice)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-4">
          <h4 className="text-sm font-black text-white">체결 쏠림</h4>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Metric label="매수 체결" value={formatPercent(report.takerFlow.buyPercent, 1)} sub={report.takerFlow.buyVolume === null ? "-" : report.takerFlow.buyVolume.toLocaleString("ko-KR", { maximumFractionDigits: 2 })} />
            <Metric label="매도 체결" value={formatPercent(report.takerFlow.sellPercent, 1)} sub={report.takerFlow.sellVolume === null ? "-" : report.takerFlow.sellVolume.toLocaleString("ko-KR", { maximumFractionDigits: 2 })} />
          </div>
          <p className="mt-3 rounded-md border border-signal-warning/20 bg-signal-warning/10 px-3 py-2 text-xs leading-5 text-signal-warning [word-break:keep-all]">
            <ShieldAlert className="mr-1 inline" size={13} aria-hidden />
            {report.warning}
          </p>
        </div>
      </div>
    </section>
  );
}
