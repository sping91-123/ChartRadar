import type {
  MonitorCondition,
  PerpetualDecisionSnapshot,
  PerpetualTimedLevel
} from "@/lib/perpetualDecisionSnapshot";
import type { ChartViewTimeframe } from "@/lib/chartTimeframeView";

export type PerpetualChartLineStyle = "solid" | "dashed" | "dotted";
export type PerpetualChartLegendGroup = "condition" | "zone" | "signal";

export interface PerpetualChartLineOverlay {
  id: string;
  group: Exclude<PerpetualChartLegendGroup, "signal">;
  label: string;
  detailLabel: string;
  price: number;
  color: string;
  lineWidth: 1 | 2;
  lineStyle: PerpetualChartLineStyle;
  axisLabelVisible: boolean;
}

export interface PerpetualChartMarkerOverlay {
  id: "mss" | "msb" | "choch";
  kind: "mss" | "msb" | "choch";
  label: "MSS" | "MSB" | "CHoCH";
  direction: "bullish" | "bearish";
  level: number;
  occurredAt: string;
  color: string;
}

export interface ResolvedPerpetualChartMarker extends PerpetualChartMarkerOverlay {
  time: number;
  position: "aboveBar" | "belowBar";
  shape: "arrowUp" | "arrowDown" | "circle" | "square";
}

export interface PerpetualChartLegendItem {
  id: string;
  group: PerpetualChartLegendGroup;
  label: string;
  value: string;
  color: string;
  lineWidth?: 1 | 2;
  lineStyle?: PerpetualChartLineStyle;
  markerShape?: ResolvedPerpetualChartMarker["shape"];
  outsideVisibleRange?: boolean;
}

export interface PerpetualChartOverlayModel {
  lines: PerpetualChartLineOverlay[];
  legendItems: PerpetualChartLegendItem[];
  markers: PerpetualChartMarkerOverlay[];
}

const overlayColors = {
  primary: "#fbbf24",
  confirmation: "#60a5fa",
  invalidation: "#fb7185",
  orderBlock: "#2dd4bf",
  fvg: "#38bdf8",
  poc: "#f59e0b",
  bullish: "#34d399",
  bearish: "#fb7185",
  mss: "#fbbf24"
} as const;

function isFinitePrice(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function formatPerpetualChartPrice(value: number) {
  const digits = value >= 10_000 ? 0 : value >= 100 ? 1 : value >= 1 ? 2 : 4;
  return value.toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

function conditionCopy(condition: MonitorCondition) {
  if (condition.role === "confirmation") {
    return { label: "방향 강화 기준", detailLabel: "방향 강화 기준", color: overlayColors.confirmation, lineWidth: 1 as const, lineStyle: "dashed" as const };
  }
  if (condition.role === "invalidation") {
    return { label: "현재 판단 재검토", detailLabel: "현재 판단 재검토", color: overlayColors.invalidation, lineWidth: 1 as const, lineStyle: "dashed" as const };
  }
  return { label: "지금 볼 가격", detailLabel: "가장 먼저 볼 가격", color: overlayColors.primary, lineWidth: 2 as const, lineStyle: "solid" as const };
}

function addCondition(
  condition: MonitorCondition,
  lines: PerpetualChartLineOverlay[],
  legendItems: PerpetualChartLegendItem[]
) {
  if (!isFinitePrice(condition.threshold)) return;
  const copy = conditionCopy(condition);
  const id = `condition-${condition.id}`;
  lines.push({
    id,
    group: "condition",
    label: copy.label,
    detailLabel: copy.detailLabel,
    price: condition.threshold,
    color: copy.color,
    lineWidth: copy.lineWidth,
    lineStyle: copy.lineStyle,
    axisLabelVisible: condition.role === "primary"
  });
  legendItems.push({
    id,
    group: "condition",
    label: copy.label,
    value: `${formatPerpetualChartPrice(condition.threshold)} ${condition.kind === "price_cross_below" ? "아래" : "위"}에서 봉 마감`,
    color: copy.color,
    lineWidth: copy.lineWidth,
    lineStyle: copy.lineStyle
  });
}

function addRange(
  id: string,
  label: string,
  detailLabels: { top: string; bottom: string },
  color: string,
  topValue: unknown,
  bottomValue: unknown,
  lines: PerpetualChartLineOverlay[],
  legendItems: PerpetualChartLegendItem[]
) {
  if (!isFinitePrice(topValue) || !isFinitePrice(bottomValue)) return;
  const top = Math.max(topValue, bottomValue);
  const bottom = Math.min(topValue, bottomValue);
  lines.push({
    id: `${id}-top`,
    group: "zone",
    label,
    detailLabel: detailLabels.top,
    price: top,
    color,
    lineWidth: 1,
    lineStyle: "dotted",
    axisLabelVisible: false
  });
  if (bottom !== top) {
    lines.push({
      id: `${id}-bottom`,
      group: "zone",
      label,
      detailLabel: detailLabels.bottom,
      price: bottom,
      color,
      lineWidth: 1,
      lineStyle: "dotted",
      axisLabelVisible: false
    });
  }
  legendItems.push({
    id,
    group: "zone",
    label,
    value: `${formatPerpetualChartPrice(bottom)}–${formatPerpetualChartPrice(top)}`,
    color,
    lineWidth: 1,
    lineStyle: "dotted"
  });
}

function validMarker(kind: "mss" | "msb" | "choch", event: PerpetualTimedLevel | null | undefined): PerpetualChartMarkerOverlay | null {
  if (!event || !isFinitePrice(event.level) || !event.occurredAt || !Number.isFinite(Date.parse(event.occurredAt))) return null;
  return {
    id: kind,
    kind,
    label: kind === "mss" ? "MSS" : kind === "msb" ? "MSB" : "CHoCH",
    direction: event.direction,
    level: event.level,
    occurredAt: event.occurredAt,
    color: kind === "mss" ? overlayColors.mss : event.direction === "bullish" ? overlayColors.bullish : overlayColors.bearish
  };
}

export function buildPerpetualChartOverlayModel(
  snapshot: PerpetualDecisionSnapshot,
  timeframe: ChartViewTimeframe = "15m"
): PerpetualChartOverlayModel {
  const lines: PerpetualChartLineOverlay[] = [];
  const legendItems: PerpetualChartLegendItem[] = [];
  const conditions = [
    snapshot.summary.primaryCondition,
    ...(snapshot.pro?.confirmationConditions ?? []),
    ...(snapshot.pro?.invalidationConditions ?? [])
  ].filter((condition) => condition.timeframe === timeframe);
  conditions.forEach((condition) => addCondition(condition, lines, legendItems));

  const details = snapshot.pro?.multiTimeframeEvidence.find((item) => item.timeframe === timeframe)?.details;
  addRange(
    "order-block",
    "강한 움직임 시작 가격대 (OB)",
    { top: "강한 움직임 시작 가격대 위", bottom: "강한 움직임 시작 가격대 아래" },
    overlayColors.orderBlock,
    details?.zones.orderBlock?.top,
    details?.zones.orderBlock?.bottom,
    lines,
    legendItems
  );
  addRange(
    "fvg",
    "빠르게 지나간 가격대 (FVG)",
    { top: "빠르게 지나간 가격대 위", bottom: "빠르게 지나간 가격대 아래" },
    overlayColors.fvg,
    details?.zones.fvg?.top,
    details?.zones.fvg?.bottom,
    lines,
    legendItems
  );

  const poc = details?.location.poc?.poc;
  if (isFinitePrice(poc)) {
    lines.push({
      id: "poc",
      group: "zone",
      label: "거래가 가장 많이 쌓인 가격 (POC)",
      detailLabel: "거래가 가장 많이 쌓인 가격",
      price: poc,
      color: overlayColors.poc,
      lineWidth: 1,
      lineStyle: "dotted",
      axisLabelVisible: false
    });
    legendItems.push({
      id: "poc",
      group: "zone",
      label: "거래가 가장 많이 쌓인 가격 (POC)",
      value: formatPerpetualChartPrice(poc),
      color: overlayColors.poc,
      lineWidth: 1,
      lineStyle: "dotted"
    });
  }

  const publicEvents = snapshot.publicEvidence?.timeframe === timeframe ? snapshot.publicEvidence.events : undefined;
  const markers = [
    validMarker("mss", details?.events.mss ?? publicEvents?.mss),
    validMarker("msb", details?.events.msb ?? publicEvents?.msb),
    validMarker("choch", details?.events.choch ?? publicEvents?.choch)
  ].filter((marker): marker is PerpetualChartMarkerOverlay => marker !== null);

  return { lines, legendItems, markers };
}

export function resolvePerpetualChartMarkers(
  markers: PerpetualChartMarkerOverlay[],
  candleTimes: Iterable<number>
): ResolvedPerpetualChartMarker[] {
  const visibleTimes = new Set(candleTimes);
  const occupied = new Set<string>();
  const resolved: ResolvedPerpetualChartMarker[] = [];

  for (const marker of markers) {
    const time = Math.floor(Date.parse(marker.occurredAt) / 1000);
    if (!visibleTimes.has(time)) continue;
    const preferredPosition = marker.direction === "bullish" ? "belowBar" : "aboveBar";
    let position: ResolvedPerpetualChartMarker["position"] = preferredPosition;
    const preferredKey = `${time}:${preferredPosition}`;
    if (marker.kind !== "mss" && occupied.has(preferredKey)) {
      position = preferredPosition === "belowBar" ? "aboveBar" : "belowBar";
    }
    occupied.add(`${time}:${position}`);
    resolved.push({
      ...marker,
      time,
      position,
      shape: marker.kind === "mss" ? "square" : marker.kind === "choch" ? "circle" : marker.direction === "bullish" ? "arrowUp" : "arrowDown"
    });
  }

  return resolved.sort((left, right) => left.time - right.time || left.kind.localeCompare(right.kind));
}

function formatSignalTime(time: number) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(new Date(time * 1000));
}

export function buildPerpetualSignalLegendItems(
  markers: ResolvedPerpetualChartMarker[],
  visibleMarkerIds?: ReadonlySet<PerpetualChartMarkerOverlay["id"]>,
  legacyStructureSemantics = false
): PerpetualChartLegendItem[] {
  return markers.map((marker) => ({
    id: `signal-${marker.id}`,
    group: "signal",
    label: marker.kind === "mss"
      ? "새 추세 확인 (MSS)"
      : marker.kind === "msb"
        ? legacyStructureSemantics ? "저장 당시 가격 구조 (MSB)" : "현재 추세 지속 확인 (MSB)"
        : legacyStructureSemantics ? "저장 당시 전환 신호 (CHoCH)" : "반대 방향 전환 주의 (CHoCH)",
    value: `${marker.direction === "bullish" ? "위쪽" : "아래쪽"} · ${formatPerpetualChartPrice(marker.level)} · ${formatSignalTime(marker.time)}`,
    color: marker.color,
    markerShape: marker.shape,
    outsideVisibleRange: visibleMarkerIds !== undefined && !visibleMarkerIds.has(marker.id)
  }));
}

export function compactPerpetualCandleLimit(containerWidth: number) {
  return containerWidth >= 768 ? 96 : 48;
}
