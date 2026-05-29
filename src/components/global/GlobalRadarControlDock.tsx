import { chartTimeframes, type ChartTimeframe } from "@/lib/marketAnalysis";
import { radarModes, type GlobalRadarMode } from "@/components/global/stockRadarConfig";

export function GlobalRadarControlDock({
  timeframe,
  onTimeframeChange,
  radarMode,
  onRadarModeChange,
  showMobileDock
}: {
  timeframe: ChartTimeframe;
  onTimeframeChange: (value: ChartTimeframe) => void;
  radarMode: GlobalRadarMode;
  onRadarModeChange: (value: GlobalRadarMode) => void;
  showMobileDock: boolean;
}) {
  const renderContent = () => (
    <>
      <div className="grid grid-cols-5 gap-1.5">
        {chartTimeframes.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onTimeframeChange(item)}
            className={`min-h-10 border-b-2 px-2 text-xs font-black transition ${
              timeframe === item
                ? "border-accent-blue text-accent-blue"
                : "border-transparent bg-transparent text-slate-300 hover:text-white"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {radarModes.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onRadarModeChange(item.value)}
            className={`min-h-9 border-b-2 px-2 text-xs font-black transition ${
              radarMode === item.value
                ? "border-white text-white"
                : "border-transparent bg-transparent text-slate-300 hover:text-white"
            }`}
            title={item.caption}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );

  return (
    <>
      <div
        className={`fixed inset-x-0 bottom-0 z-40 mx-auto border-t border-surface-line bg-ui-canvas/95 px-3 pb-[calc(0.35rem+env(safe-area-inset-bottom))] pt-1.5 shadow-none sm:hidden ${showMobileDock ? "block" : "hidden"}`}
        aria-label="글로벌 자산레이더 모바일 조작 패널"
      >
        {renderContent()}
      </div>
      <div
        className="sticky top-3 z-20 mx-auto hidden max-w-5xl border-b border-surface-line bg-ui-canvas/95 py-2 sm:block"
        aria-label="글로벌 자산레이더 조작 패널"
      >
        {renderContent()}
      </div>
    </>
  );
}
