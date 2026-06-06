import { chartTimeframes, type ChartTimeframe } from "@/lib/marketAnalysis";
import { radarModes, type GlobalRadarMode } from "@/components/global/stockRadarConfig";

export function GlobalRadarControlDock({
  timeframe,
  onTimeframeChange,
  radarMode,
  onRadarModeChange
}: {
  timeframe: ChartTimeframe;
  onTimeframeChange: (value: ChartTimeframe) => void;
  radarMode: GlobalRadarMode;
  onRadarModeChange: (value: GlobalRadarMode) => void;
}) {
  return (
    <div
      className="sticky top-2 z-20 mx-auto mt-4 w-full max-w-5xl rounded-ui-lg border border-ui-line/25 bg-ui-panel/45 p-1.5 backdrop-blur sm:top-3 sm:mt-5"
      aria-label="글로벌 자산레이더 조작 패널"
    >
      <div className="grid grid-cols-5 gap-1">
        {chartTimeframes.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onTimeframeChange(item)}
            className={`min-h-9 rounded-ui-sm px-2 text-xs font-black transition ${
              timeframe === item
                ? "bg-accent-blue/15 text-accent-blue"
                : "bg-transparent text-slate-300 hover:bg-ui-inset/60 hover:text-white"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-1">
        {radarModes.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onRadarModeChange(item.value)}
            className={`min-h-9 rounded-ui-sm px-2 text-xs font-black transition ${
              radarMode === item.value
                ? "bg-ui-text/10 text-white"
                : "bg-transparent text-slate-300 hover:bg-ui-inset/60 hover:text-white"
            }`}
            title={item.caption}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
