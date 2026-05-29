import type { Ref } from "react";
import { Loader2 } from "lucide-react";
import type { Candle } from "@/lib/marketAnalysis";
import type { StockSymbolInfo } from "@/lib/stockMarket";
import type { LoadState } from "@/components/global/stockRadarConfig";
import { formatPrice, symbolName } from "@/components/global/stockRadarDisplay";

export function GlobalAssetChartPanel({
  symbol,
  universe,
  latest,
  changePercent,
  chartRef,
  state
}: {
  symbol: string;
  universe: StockSymbolInfo[];
  latest: Candle | null;
  changePercent: number | null;
  chartRef: Ref<HTMLDivElement>;
  state: LoadState;
}) {
  return (
    <div className="mt-5 border-y border-surface-line py-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold text-slate-500">선택 종목</p>
          <h3 className="mt-1 text-2xl font-black text-white">
            {symbol} <span className="text-base text-slate-500">{symbolName(symbol, universe)}</span>
          </h3>
        </div>
        {latest ? (
          <div className="text-left sm:text-right">
            <p className="text-xl font-black text-white">{formatPrice(latest.close)}</p>
            <p className={`text-xs font-bold ${changePercent !== null && changePercent >= 0 ? "text-signal-success" : "text-signal-danger"}`}>
              {changePercent === null ? "변동률 미확인" : `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`}
            </p>
          </div>
        ) : null}
      </div>

      <div className="relative min-h-[320px] overflow-hidden border-y border-white/10 bg-transparent sm:min-h-[360px]">
        <div ref={chartRef} className="h-[320px] w-full sm:h-[360px]" />
        {state.status === "loading" ? (
          <div className="absolute inset-0 grid place-items-center bg-slate-950/70 text-sm text-slate-300">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="animate-spin" size={16} aria-hidden />
              차트 데이터를 불러오는 중입니다.
            </span>
          </div>
        ) : null}
        {state.status === "error" ? (
          <div className="absolute inset-0 grid place-items-center bg-slate-950/80 p-4 text-center text-sm text-signal-danger">
            <div className="max-w-sm border-y border-signal-danger/30 py-4">
              <p className="font-black">차트 데이터를 불러오지 못했습니다.</p>
              <p className="mt-2 text-xs leading-5 text-signal-danger/90">{state.message || "잠시 후 다시 확인해 주세요."}</p>
            </div>
          </div>
        ) : null}
        {state.status === "idle" ? (
          <div className="absolute inset-0 grid place-items-center bg-slate-950/70 text-sm text-slate-400">
            차트 데이터를 준비하고 있습니다.
          </div>
        ) : null}
      </div>
    </div>
  );
}
