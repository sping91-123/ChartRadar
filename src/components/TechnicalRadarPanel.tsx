"use client";
// 기술지표 레이더 결과를 모바일 카드 형태로 보여주는 패널입니다.
import { useMemo } from "react";
import type { Candle, ChartTimeframe } from "@/lib/marketAnalysis";
import { analyzeTechnicalRadar, type IndicatorReading, type TechnicalTone } from "@/lib/technicalRadar";

function toneClass(tone: TechnicalTone) {
  if (tone === "bullish") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
  if (tone === "bearish") return "border-rose-500/25 bg-rose-500/10 text-rose-200";
  if (tone === "warning") return "border-amber-500/25 bg-amber-500/10 text-amber-200";
  return "border-white/10 bg-black/20 text-slate-200";
}

function barClass(tone: TechnicalTone) {
  if (tone === "bullish") return "bg-emerald-400";
  if (tone === "bearish") return "bg-rose-400";
  if (tone === "warning") return "bg-amber-400";
  return "bg-sky-400";
}

function formatPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "미확인";
  return value.toLocaleString("ko-KR", { maximumFractionDigits: value > 100 ? 2 : 5 });
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "미확인";
  return `${value.toFixed(2)}%`;
}

function HelpTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle" tabIndex={0} aria-label="상세 기준">
      <span className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-black text-cyan-100">상세 기준</span>
      <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-[11px] font-bold leading-5 text-slate-300 shadow-xl group-hover:block group-focus:block">
        {text}
      </span>
    </span>
  );
}

function IndicatorRow({ item }: { item: IndicatorReading }) {
  return (
    <div className={`rounded-md border p-3 ${toneClass(item.tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-white">{item.label}</p>
          <p className="mt-1 break-words text-xs font-semibold opacity-85">{item.value}</p>
        </div>
        <span className="shrink-0 rounded bg-black/25 px-2 py-1 text-xs font-black">{Math.round(item.score)}점</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-300">{item.description}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${barClass(item.tone)}`} style={{ width: `${Math.min(100, Math.max(0, item.score))}%` }} />
      </div>
    </div>
  );
}

function IndicatorSection({ title, items }: { title: string; items: IndicatorReading[] }) {
  return (
    <section className="rounded-lg border border-surface-line/60 bg-surface-cardSoft/45 p-3">
      <h4 className="text-base font-black text-white">{title}</h4>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <IndicatorRow key={item.label} item={item} />
        ))}
      </div>
    </section>
  );
}

export function TechnicalRadarPanel({
  candles,
  timeframe,
  assetLabel = "선택 코인",
  intro = "상단 판단을 보조하는 세부 근거입니다. 이동평균, MACD, RSI, 일목균형표, Supertrend, 거래량, 변동성 지표를 한 번에 확인합니다."
}: {
  candles: Candle[];
  timeframe: ChartTimeframe;
  assetLabel?: string;
  intro?: string;
}) {
  const report = useMemo(() => analyzeTechnicalRadar(candles), [candles]);

  return (
    <div id="technical-radar" className="scroll-mt-24 rounded-lg border border-surface-line/60 bg-surface-cardSoft/45 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-accent-blue">Technical Evidence</p>
          <h3 className="mt-1 flex items-center gap-2 text-lg font-black text-white">
            기술지표 세부 근거
            <HelpTip text="상단 공통 판단을 보조하는 세부 지표 영역입니다. 상승, 하락, 관망 개수와 설명을 보고 판단 근거가 충분한지 확인하세요." />
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">{intro}</p>
        </div>
        <span className="inline-flex w-fit rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-bold text-slate-300">
          {timeframe} 기준
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-accent-blue/20 bg-black/15 p-4 lg:col-span-2">
          <p className="text-xs font-bold text-slate-400">현재 추세</p>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-3xl font-black text-white">{report.trendLabel}</p>
              <p className="mt-2 text-base font-bold text-accent-blue">{report.momentumLabel}</p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{report.summary}</p>
            </div>
            <div className="grid min-w-48 grid-cols-3 gap-2 text-center">
              <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3">
                <p className="text-lg font-black text-emerald-300">{report.bullishCount}</p>
                <p className="text-[11px] font-bold text-emerald-200">상승</p>
              </div>
              <div className="rounded-md border border-rose-500/20 bg-rose-500/10 p-3">
                <p className="text-lg font-black text-rose-300">{report.bearishCount}</p>
                <p className="text-[11px] font-bold text-rose-200">하락</p>
              </div>
              <div className="rounded-md border border-white/10 bg-white/5 p-3">
                <p className="text-lg font-black text-slate-200">{report.neutralCount}</p>
                <p className="text-[11px] font-bold text-slate-400">관망</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/15 p-4">
          <p className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
            심리 참고값
            <HelpTip text="캔들 흐름을 기준으로 과열과 침체 정도를 숫자로 읽는 값입니다. 높으면 추세가 강할 수 있지만 추격 위험도 같이 봐야 합니다." />
          </p>
          <div className="mt-5">
            <div className="relative h-5 rounded-full border border-surface-line bg-ui-inset">
              <span
                className="absolute top-1/2 h-8 w-1.5 -translate-y-1/2 rounded-full bg-white shadow-none"
                style={{ left: `calc(${report.fearGreed.score}% - 3px)` }}
              />
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
              <p className="text-4xl font-black text-white">{report.fearGreed.score}</p>
              <p className="pb-1 text-sm font-black text-accent-blue">{report.fearGreed.label}</p>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">
              {report.fearGreed.description} {assetLabel}의 캔들 흐름으로 과열과 침체 정도를 읽어낸 레이더 값입니다.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-black/15 p-4">
        <h4 className="flex items-center gap-2 text-base font-black text-white">
          차트 기준선
          <HelpTip text="현재가와 가까운 지지선, 저항선을 보여줍니다. 초보자는 방향보다 먼저 가격이 어느 기준선에 가까운지 확인하는 편이 안전합니다." />
        </h4>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3">
            <p className="text-xs font-bold text-emerald-200">가까운 지지선</p>
            <p className="mt-1 text-lg font-black text-white">{formatPrice(report.supportResistance.support)}</p>
            <p className="mt-1 text-xs text-emerald-200">현재가 대비 {formatPercent(report.supportResistance.supportDistancePercent)}</p>
          </div>
          <div className="rounded-md border border-rose-500/20 bg-rose-500/10 p-3">
            <p className="text-xs font-bold text-rose-200">가까운 저항선</p>
            <p className="mt-1 text-lg font-black text-white">{formatPrice(report.supportResistance.resistance)}</p>
            <p className="mt-1 text-xs text-rose-200">현재가 대비 {formatPercent(report.supportResistance.resistanceDistancePercent)}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-black/15 p-4">
        <h4 className="text-base font-black text-white">캔들스틱 패턴</h4>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {report.candlestickPatterns.length ? (
            report.candlestickPatterns.map((pattern) => (
              <div key={`${pattern.name}-${pattern.detectedAt}`} className={`rounded-md border p-3 ${toneClass(pattern.tone)}`}>
                <p className="text-sm font-black text-white">{pattern.name}</p>
                <p className="mt-1 text-xs font-bold">신뢰도 {pattern.confidence}%</p>
                <p className="mt-2 text-xs leading-5 text-slate-300">{pattern.description}</p>
              </div>
            ))
          ) : (
            <p className="rounded-md border border-white/10 bg-black/20 px-3 py-3 text-sm text-slate-400 sm:col-span-2 xl:col-span-4">
              현재 캔들에서는 뚜렷한 패턴이 확인되지 않았습니다.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <IndicatorSection title="추세지표" items={report.trendIndicators} />
        <IndicatorSection title="모멘텀지표" items={report.momentumIndicators} />
        <IndicatorSection title="변동성지표" items={report.volatilityIndicators} />
        <IndicatorSection title="거래량지표" items={report.volumeIndicators} />
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-black/15 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-base font-black text-white">피보나치 되돌림</h4>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              최근 160개 캔들의 고점과 저점을 기준으로 현재 위치를 표시합니다.
            </p>
          </div>
          <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold text-slate-300">
            위치 {formatPercent(report.fibonacci.positionPercent)}
          </span>
        </div>
        <div className="relative mt-5 h-16 rounded-md border border-white/10 bg-white/[0.03]">
          {report.fibonacci.levels.map((level) => (
            <div
              key={level.label}
              className="absolute top-0 h-full border-l border-accent-blue/35"
              style={{ left: `${Math.min(100, Math.max(0, level.ratio * 100))}%` }}
            >
              <span className="absolute left-1 top-2 whitespace-nowrap text-[10px] font-bold text-slate-400">{level.label}</span>
              <span className="absolute bottom-2 left-1 whitespace-nowrap text-[10px] text-slate-500">{formatPrice(level.price)}</span>
            </div>
          ))}
          {report.fibonacci.positionPercent !== null ? (
            <span
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent-blue shadow-none"
              style={{ left: `${report.fibonacci.positionPercent}%` }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
