import {
  chartViewTimeframeLabels,
  chartViewTimeframes,
  type ChartViewTimeframe
} from "@/lib/chartTimeframeView";

export function ChartTimeframeSelector({
  value,
  onChange,
  className = "",
  compact = false
}: {
  value: ChartViewTimeframe;
  onChange: (timeframe: ChartViewTimeframe) => void;
  className?: string;
  compact?: boolean;
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
            className="group flex min-h-11 items-center justify-center rounded-ui-sm text-[11px] font-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-brand"
          >
            <span className={`flex w-full items-center justify-center rounded-ui-sm px-2 transition ${compact ? "h-9" : "min-h-11"} ${
              active
                ? "bg-ui-brand text-white"
                : "bg-ui-inset text-ui-muted group-hover:bg-ui-elevated group-hover:text-ui-text"
            }`}>
              {chartViewTimeframeLabels[timeframe]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
