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
      <div className="rounded-ui-lg bg-ui-panel p-3 lg:col-span-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ui-subtle">세부 근거 요약</p>
            <h3 className="mt-2 text-2xl font-semibold text-ui-text">기술지표 근거 분포</h3>
          </div>
          <Gauge size={24} aria-hidden />
        </div>
        <p className="mt-3 text-sm leading-6 text-ui-muted">
          상단 판단에 사용된 상승, 하락, 횡보 근거 수와 가까운 가격 기준선을 분리해 확인합니다.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="border-t border-ui-line/60 px-2 py-2 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0">
            <p className="text-lg font-semibold text-emerald-300">{report?.bullishCount ?? "-"}</p>
            <p className="text-[11px] font-medium text-ui-muted">상승 근거</p>
          </div>
          <div className="border-t border-ui-line/60 px-2 py-2 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0">
            <p className="text-lg font-semibold text-rose-300">{report?.bearishCount ?? "-"}</p>
            <p className="text-[11px] font-medium text-ui-muted">하락 근거</p>
          </div>
          <div className="border-t border-ui-line/60 px-2 py-2 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0">
            <p className="text-lg font-semibold text-ui-text">{report?.neutralCount ?? "-"}</p>
            <p className="text-[11px] font-medium text-ui-muted">횡보 근거</p>
          </div>
        </div>
      </div>

      <div className="rounded-ui-lg bg-ui-panel p-3">
        <Activity className="text-ui-brand" size={20} aria-hidden />
        <p className="mt-3 text-xs font-semibold text-ui-subtle">현재가와 변동</p>
        <p className="mt-1 text-2xl font-semibold text-ui-text">{latest ? formatPrice(latest.close) : "미확인"}</p>
        <p className={`mt-1 text-sm font-semibold ${changePercent !== null && changePercent >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
          {formatPercent(changePercent)}
        </p>
      </div>

      <div className="rounded-ui-lg bg-ui-panel p-3">
        <Shield className="text-ui-brand" size={20} aria-hidden />
        <p className="mt-3 text-xs font-semibold text-ui-subtle">가까운 기준선</p>
        <p className="mt-1 text-sm font-semibold text-emerald-200">지지 {formatPrice(support)}</p>
        <p className="mt-1 text-sm font-semibold text-rose-200">저항 {formatPrice(resistance)}</p>
      </div>

      {report && report.fearGreed.score >= 75 ? (
        <div className="rounded-ui-lg border border-amber-300/25 bg-amber-300/10 p-3 lg:col-span-4">
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
