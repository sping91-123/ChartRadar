import {
  chartViewTimeframeLabels,
  chartViewTimeframes,
  type ChartViewTimeframe
} from "@/lib/chartTimeframeView";

export function ChartTimeframeSelector({
  value,
  onChange,
  className = ""
}: {
  value: ChartViewTimeframe;
  onChange: (timeframe: ChartViewTimeframe) => void;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-3 gap-1 ${className}`} role="group" aria-label="차트 시간대 선택">
      {chartViewTimeframes.map((timeframe) => {
        const active = timeframe === value;
        return (
          <button
            key={timeframe}
            type="button"
            aria-pressed={active}
            aria-label={`${chartViewTimeframeLabels[timeframe]} 차트 보기`}
            onClick={() => onChange(timeframe)}
            className={`min-h-11 rounded-ui-sm px-2 text-[11px] font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-brand ${
              active
                ? "bg-ui-brand text-white"
                : "bg-ui-inset text-ui-muted hover:bg-ui-elevated hover:text-ui-text"
            }`}
          >
            {chartViewTimeframeLabels[timeframe]}
          </button>
        );
      })}
    </div>
  );
}
