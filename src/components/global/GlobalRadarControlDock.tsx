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
      className="sticky top-2 z-20 mx-auto mt-4 w-full max-w-5xl rounded-ui-lg bg-ui-panel p-1.5 backdrop-blur sm:top-3 sm:mt-5"
      aria-label="글로벌 자산레이더 조작 패널"
    >
      <div className="grid grid-cols-5 gap-1">
        {chartTimeframes.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onTimeframeChange(item)}
            className={`min-h-9 rounded-ui-sm px-2 text-xs font-semibold transition ${
              timeframe === item
                ? "bg-ui-brand/15 text-ui-brand"
                : "bg-transparent text-ui-muted hover:bg-ui-inset/60 hover:text-ui-text"
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
            className={`min-h-9 rounded-ui-sm px-2 text-xs font-semibold transition ${
              radarMode === item.value
                ? "bg-ui-text/10 text-ui-text"
                : "bg-transparent text-ui-muted hover:bg-ui-inset/60 hover:text-ui-text"
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
