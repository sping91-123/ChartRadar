import type { PerpetualChartLegendGroup, PerpetualChartLegendItem } from "@/lib/perpetualDecisionChartOverlays";

const groupCopy: Record<PerpetualChartLegendGroup, string> = {
  condition: "조건선",
  zone: "가격대",
  signal: "구조 신호"
};

function MarkerGlyph({ item }: { item: PerpetualChartLegendItem }) {
  if (item.markerShape === "arrowUp") return <span aria-hidden>↑</span>;
  if (item.markerShape === "arrowDown") return <span aria-hidden>↓</span>;
  if (item.markerShape === "square") return <span aria-hidden>■</span>;
  return <span aria-hidden>●</span>;
}

export function PerpetualChartLegend({ id, items, timeframeLabel }: { id: string; items: PerpetualChartLegendItem[]; timeframeLabel: string }) {
  const groups = (["condition", "zone", "signal"] as const)
    .map((group) => ({ group, items: items.filter((item) => item.group === group) }))
    .filter((entry) => entry.items.length > 0);

  if (!groups.length) return null;

  return (
    <section id={id} className="mt-1.5 space-y-1.5 overflow-x-hidden px-2" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="sr-only">{timeframeLabel} 차트 범례</h2>
      {groups.map(({ group, items: groupItems }) => (
        <div key={group} className="min-w-0">
          <h3 className="text-[11px] font-black tracking-[0.04em] text-ui-subtle">{groupCopy[group]}</h3>
          <ul className="mt-0.5 grid min-w-0 grid-cols-2 gap-1 sm:flex sm:flex-wrap">
            {groupItems.map((item) => (
              <li key={item.id} className="flex min-w-0 items-center gap-1.5 rounded-ui-sm bg-ui-inset/55 px-1.5 py-1 text-[11px] leading-4">
                {item.group === "signal" ? (
                  <span className="grid h-4 w-4 shrink-0 place-items-center text-xs font-black" style={{ color: item.color }}>
                    <MarkerGlyph item={item} />
                  </span>
                ) : (
                  <span
                    className="w-5 shrink-0 border-t"
                    style={{
                      borderTopColor: item.color,
                      borderTopStyle: item.lineStyle,
                      borderTopWidth: item.lineWidth
                    }}
                    aria-hidden
                  />
                )}
                <span className="min-w-0">
                  <span className="font-black text-ui-text">{item.label}</span>
                  <span className="ml-1 break-words font-semibold tabular-nums text-ui-muted">{item.value}</span>
                  {item.outsideVisibleRange ? <span className="ml-1 font-semibold text-ui-subtle">현재 차트 범위 밖</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
