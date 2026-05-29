import { Activity, AlertTriangle, Gauge, Shield } from "lucide-react";
import type { Candle } from "@/lib/marketAnalysis";
import type { TechnicalRadarReport } from "@/lib/technicalRadar";
import { formatPercent, formatPrice } from "@/components/global/stockRadarDisplay";

export function StockSnapshot({
  report,
  latest,
  changePercent
}: {
  report: TechnicalRadarReport | null;
  latest: Candle | null;
  changePercent: number | null;
}) {
  const support = report?.supportResistance.support ?? null;
  const resistance = report?.supportResistance.resistance ?? null;

  return (
    <div className="grid gap-3 lg:grid-cols-4">
      <div className="border-y border-white/10 py-4 lg:col-span-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] opacity-80">세부 근거 요약</p>
            <h3 className="mt-2 text-2xl font-black text-white">기술지표 근거 분포</h3>
          </div>
          <Gauge size={24} aria-hidden />
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-200">
          상단 판단에 사용된 상승, 하락, 횡보 근거 수와 가까운 가격 기준선을 분리해 확인합니다.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="border-t border-white/10 px-2 py-2 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0">
            <p className="text-lg font-black text-emerald-300">{report?.bullishCount ?? "-"}</p>
            <p className="text-[11px] font-bold text-slate-300">상승 근거</p>
          </div>
          <div className="border-t border-white/10 px-2 py-2 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0">
            <p className="text-lg font-black text-rose-300">{report?.bearishCount ?? "-"}</p>
            <p className="text-[11px] font-bold text-slate-300">하락 근거</p>
          </div>
          <div className="border-t border-white/10 px-2 py-2 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0">
            <p className="text-lg font-black text-slate-200">{report?.neutralCount ?? "-"}</p>
            <p className="text-[11px] font-bold text-slate-300">횡보 근거</p>
          </div>
        </div>
      </div>

      <div className="border-y border-white/10 py-4">
        <Activity className="text-cyan-300" size={20} aria-hidden />
        <p className="mt-3 text-xs font-bold text-slate-400">현재가와 변동</p>
        <p className="mt-1 text-2xl font-black text-white">{latest ? formatPrice(latest.close) : "미확인"}</p>
        <p className={`mt-1 text-sm font-black ${changePercent !== null && changePercent >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
          {formatPercent(changePercent)}
        </p>
      </div>

      <div className="border-y border-white/10 py-4">
        <Shield className="text-cyan-300" size={20} aria-hidden />
        <p className="mt-3 text-xs font-bold text-slate-400">가까운 기준선</p>
        <p className="mt-1 text-sm font-black text-emerald-200">지지 {formatPrice(support)}</p>
        <p className="mt-1 text-sm font-black text-rose-200">저항 {formatPrice(resistance)}</p>
      </div>

      {report && report.fearGreed.score >= 75 ? (
        <div className="border-y border-amber-300/25 py-4 lg:col-span-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-amber-300" size={18} aria-hidden />
            <p className="text-sm leading-6 text-amber-100">
              캔들 기반 심리 참고값이 높은 편입니다. 추세가 강해도 과열 구간에서는 추격보다 눌림, 지지선, 거래량 확인이 더 중요합니다.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
