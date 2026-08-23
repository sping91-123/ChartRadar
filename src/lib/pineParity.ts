import type { ChartTimeframe, DirectionState } from "@/lib/marketAnalysis";

export type PineDirectionValue = DirectionState | "long" | "short" | 1 | -1 | 0;
export type PineTimeframeDirectionMap = Partial<Record<ChartTimeframe | "1m", PineDirectionValue>>;
export type PineTimeframeReliabilityMap = Partial<Record<ChartTimeframe | "1m", boolean>>;
export type PineOteZone = "long" | "short" | "both" | "none";

export interface PineOtePayload {
  tf?: string;
  tfReliable?: boolean;
  requestMode?: string;
  closedOnly?: boolean;
  rangeLength?: number;
  mode?: "Confirmed Swing Pair" | "Rolling Range (Legacy)" | string;
  zone?: PineOteZone;
  filteredZone?: PineOteZone;
  longValid?: boolean;
  shortValid?: boolean;
  // In the v2.48 payload these compatibility names contain the common dealing
  // range endpoints, not the derived long/short OTE band edges.
  longLow?: number | null;
  longHigh?: number | null;
  longConfirmTime?: number | null;
  shortLow?: number | null;
  shortHigh?: number | null;
  shortConfirmTime?: number | null;
}

export interface PineSnapshot {
  schemaVersion?: string;
  indicatorVersion?: string;
  barConfirmed?: boolean;
  confirmedRequested?: boolean;
  msb?: PineDirectionValue | PineTimeframeDirectionMap;
  choch?: PineDirectionValue | PineTimeframeDirectionMap;
  mtfReliable?: PineTimeframeReliabilityMap;
  market?: 1 | -1 | 0;
  chochDir?: 1 | -1 | 0;
  biasTf?: string;
  biasTfReliable?: boolean;
  emaLength?: number;
  emaSmooth?: "SMA" | "EMA" | "없음" | string;
  emaSide?: "above" | "below" | "unknown";
  ema200SideDeprecated?: boolean;
  ema200Side?: "above" | "below" | "unknown";
  premiumDiscount?: "premium" | "discount" | "equilibrium" | "unknown";
  oteZone?: PineOteZone;
  ote?: PineOtePayload;
  h0?: number | null;
  h1?: number | null;
  l0?: number | null;
  l1?: number | null;
  hiCount?: number;
  loCount?: number;
  latestOb?: {
    direction?: "bullish" | "bearish" | "none";
    top?: number | null;
    bottom?: number | null;
  } | null;
  latestBb?: {
    direction?: "bullish" | "bearish";
    top?: number | null;
    bottom?: number | null;
  } | null;
  latestFvg?: {
    direction?: "bullish" | "bearish";
    state?: "fvg" | "ifvg";
    top?: number | null;
    bottom?: number | null;
  } | null;
  fvgDir?: "bullish" | "bearish" | "none";
  fvgTf?: string;
  fvgIsIfvg?: boolean;
  fvgTop?: number | null;
  fvgBottom?: number | null;
  latestSweep?: {
    direction?: "bullish" | "bearish";
    level?: number | null;
    age?: number | null;
  } | null;
  latestCisd?: {
    direction?: "bullish" | "bearish";
    level?: number | null;
    age?: number | null;
  } | null;
  cisd?: DirectionState | "long" | "short" | "none" | 1 | -1 | 0;
  timeframe?: string;
  chartTf?: string;
  symbol?: string;
}

type ParsedScalar = string | number | boolean | null;
type ParsedValue = ParsedScalar | Record<string, ParsedScalar>;

export function normalizePineDirection(value: PineDirectionValue | "none" | null | undefined) {
  if (value === 1 || value === "long" || value === "bullish") return "bullish";
  if (value === -1 || value === "short" || value === "bearish") return "bearish";
  if (value === "neutral") return "neutral";
  return "unknown";
}

export function pineDirectionForTimeframe(
  value: PineSnapshot["msb"] | PineSnapshot["choch"],
  timeframe: ChartTimeframe,
  reliability?: PineTimeframeReliabilityMap
) {
  return pineDirectionSampleForTimeframe(value, timeframe, reliability).direction;
}

export interface PineDirectionSample {
  direction: DirectionState;
  comparable: boolean;
  reason: "ok" | "missing" | "unreliable" | "basis-mismatch";
}

export function pineDirectionSampleForTimeframe(
  value: PineSnapshot["msb"] | PineSnapshot["choch"],
  timeframe: ChartTimeframe,
  reliability?: PineTimeframeReliabilityMap,
  chartTimeframe?: string
): PineDirectionSample {
  if (reliability?.[timeframe] === false) {
    return { direction: "unknown", comparable: false, reason: "unreliable" };
  }
  if (value && typeof value === "object") {
    const sample = value[timeframe] ?? value[timeframe.toLowerCase() as ChartTimeframe];
    if (sample === undefined) return { direction: "unknown", comparable: false, reason: "missing" };
    const direction = normalizePineDirection(sample);
    return direction === "unknown"
      ? { direction, comparable: false, reason: "missing" }
      : { direction, comparable: true, reason: "ok" };
  }

  if (value === undefined) return { direction: "unknown", comparable: false, reason: "missing" };
  if (chartTimeframe !== undefined && normalizePineTimeframe(chartTimeframe) !== timeframe) {
    return { direction: "unknown", comparable: false, reason: "basis-mismatch" };
  }
  const direction = normalizePineDirection(value);
  return direction === "unknown"
    ? { direction, comparable: false, reason: "missing" }
    : { direction, comparable: true, reason: "ok" };
}

export function pineDirectionComparisonForTimeframe(
  value: PineSnapshot["msb"] | PineSnapshot["choch"],
  legacyFallback: PineDirectionValue | undefined,
  timeframe: ChartTimeframe,
  reliability?: PineTimeframeReliabilityMap,
  chartTimeframe?: string
) {
  const sample = pineDirectionSampleForTimeframe(value, timeframe, reliability, chartTimeframe);
  // A map is an explicit per-timeframe contract. If its requested key is
  // missing, do not silently substitute the chart-timeframe legacy scalar.
  if (value !== undefined || sample.reason === "unreliable") return sample;
  return pineDirectionSampleForTimeframe(legacyFallback, timeframe, reliability, chartTimeframe);
}

export function normalizePineTimeframe(value: string | null | undefined): ChartTimeframe | "1m" | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "1" || normalized === "1m") return "1m";
  if (normalized === "5" || normalized === "5m") return "5m";
  if (normalized === "15" || normalized === "15m") return "15m";
  if (normalized === "60" || normalized === "1h") return "1h";
  if (normalized === "240" || normalized === "4h") return "4h";
  if (normalized === "d" || normalized === "1d") return "1d";
  return null;
}

const timeframeMinutes: Record<ChartTimeframe | "1m", number> = {
  "1m": 1,
  "5m": 5,
  "15m": 15,
  "1h": 60,
  "4h": 240,
  "1d": 1_440
};

export function pineClosedBarBasisComparable(
  snapshot: PineSnapshot,
  analysisMode: "confirmed" | "aggressive"
) {
  if (analysisMode !== "confirmed") return false;
  return snapshot.schemaVersion === undefined
    ? snapshot.barConfirmed !== false
    : snapshot.barConfirmed === true;
}

export function pineSymbolBasisComparable(snapshot: PineSnapshot, appSymbol: string) {
  const expected = `BINANCE:${appSymbol.trim().toUpperCase()}`;
  if (snapshot.symbol === undefined) return snapshot.schemaVersion === undefined;
  return snapshot.symbol.trim().toUpperCase() === expected;
}

export function pineChartBasisComparable(
  snapshot: PineSnapshot,
  activeTimeframe: ChartTimeframe,
  analysisMode: "confirmed" | "aggressive",
  appSymbol: string
) {
  if (!pineClosedBarBasisComparable(snapshot, analysisMode) || !pineSymbolBasisComparable(snapshot, appSymbol)) return false;
  if (snapshot.chartTf === undefined) return snapshot.schemaVersion === undefined;
  return normalizePineTimeframe(snapshot.chartTf) === activeTimeframe;
}

export function pineDirectionBasisComparable(
  snapshot: PineSnapshot,
  activeTimeframe: ChartTimeframe,
  analysisMode: "confirmed" | "aggressive",
  appSymbol: string
) {
  if (!pineClosedBarBasisComparable(snapshot, analysisMode) || !pineSymbolBasisComparable(snapshot, appSymbol)) return false;
  const chartTimeframe = normalizePineTimeframe(snapshot.chartTf);
  if (!chartTimeframe) return snapshot.schemaVersion === undefined;
  const activeMinutes = timeframeMinutes[activeTimeframe];
  const chartMinutes = timeframeMinutes[chartTimeframe];
  if (activeMinutes < chartMinutes) return false;
  if (activeMinutes === chartMinutes) return true;
  return snapshot.schemaVersion === undefined
    ? snapshot.confirmedRequested !== false
    : snapshot.confirmedRequested === true;
}

function isPineEmaSide(value: unknown): value is "above" | "below" | "unknown" {
  return value === "above" || value === "below" || value === "unknown";
}

export function pineEmaComparison(
  snapshot: PineSnapshot,
  activeTimeframe: ChartTimeframe,
  analysisMode: "confirmed" | "aggressive",
  appSymbol: string
) {
  const explicitSide = isPineEmaSide(snapshot.emaSide) ? snapshot.emaSide : null;
  const legacySide = isPineEmaSide(snapshot.ema200Side) ? snapshot.ema200Side : null;
  const side = explicitSide ?? legacySide ?? "unknown";
  const explicitLength = Number.isInteger(snapshot.emaLength) && Number(snapshot.emaLength) > 0
    ? Number(snapshot.emaLength)
    : null;
  const legacyPayload = explicitLength === null && !explicitSide && snapshot.ema200SideDeprecated !== true;
  const length = explicitLength ?? (legacyPayload && legacySide ? 200 : null);
  const sourceTimeframe = normalizePineTimeframe(snapshot.biasTf);
  const chartTimeframe = normalizePineTimeframe(snapshot.chartTf);
  const available = explicitSide !== null || legacySide !== null;
  const confirmedBasis = pineClosedBarBasisComparable(snapshot, analysisMode)
    && pineSymbolBasisComparable(snapshot, appSymbol);
  const comparable = legacyPayload
    ? available && pineChartBasisComparable(snapshot, activeTimeframe, analysisMode, appSymbol)
    : available
      && confirmedBasis
      && snapshot.barConfirmed === true
      && length === 200
      && sourceTimeframe === activeTimeframe
      && chartTimeframe === activeTimeframe
      && snapshot.biasTfReliable === true
      && snapshot.emaSmooth === "없음";

  return {
    side,
    length,
    sourceTimeframe,
    available,
    comparable,
    label: length ? `Pine EMA${length}` : "Pine EMA"
  } as const;
}

export function pineOteComparison(
  snapshot: PineSnapshot,
  activeTimeframe: ChartTimeframe,
  analysisMode: "confirmed" | "aggressive",
  appSymbol: string
) {
  const nestedPayload = snapshot.ote !== undefined;
  const rawZone = snapshot.ote?.zone ?? snapshot.oteZone;
  const zone = rawZone === "long" || rawZone === "short" || rawZone === "both" || rawZone === "none"
    ? rawZone
    : "none";
  const available = rawZone !== undefined && zone === rawZone;
  const reliable = nestedPayload ? snapshot.ote?.tfReliable === true : true;
  const confirmedSwingPair = snapshot.ote?.mode === "Confirmed Swing Pair";
  const legacyComparable = !nestedPayload
    && pineChartBasisComparable(snapshot, activeTimeframe, analysisMode, appSymbol);
  // The app's current rolling short-zone detector requires a full-band cross,
  // while Pine v2.48 uses ordinary wick overlap. A nested v2.48 OTE payload is
  // therefore informational even when its timeframe and range length match.
  const rollingComparable = false;
  const comparable = available
    && reliable
    && zone !== "both"
    && (legacyComparable || rollingComparable);
  return {
    zone,
    available,
    reliable,
    comparable,
    confirmedSwingPair
  } as const;
}

export function calculatePineParityScore(
  rows: ReadonlyArray<{ comparable: boolean; matched: boolean; importance: "core" | "major" | "minor" }>
) {
  const comparableRows = rows.filter((row) => row.comparable);
  if (!comparableRows.length) return null;
  const weighted = comparableRows.reduce(
    (acc, row) => {
      const weight = row.importance === "core" ? 3 : row.importance === "major" ? 2 : 1;
      return {
        total: acc.total + weight,
        matched: acc.matched + (row.matched ? weight : 0)
      };
    },
    { total: 0, matched: 0 }
  );
  return Math.round((weighted.matched / weighted.total) * 100);
}

function splitSnapshotEntry(part: string) {
  const match = part.match(/^([^:=]+)\s*[:=]\s*(.*)$/);
  if (!match) return null;
  return [match[1].trim(), match[2].trim()] as const;
}

function parseSnapshotScalar(rawValue: string): ParsedScalar {
  const lowerValue = rawValue.toLowerCase();
  if (lowerValue === "true") return true;
  if (lowerValue === "false") return false;
  if (lowerValue === "null" || lowerValue === "na") return null;

  const numeric = Number(rawValue);
  return Number.isFinite(numeric) ? numeric : rawValue;
}

export function parsePineSnapshot(value: string): PineSnapshot | null {
  if (!value.trim()) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as PineSnapshot : null;
  } catch {
    const entries = value
      .split(/[\n,]+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map(splitSnapshotEntry)
      .filter((entry): entry is readonly [string, string] => Boolean(entry));

    if (!entries.length) return null;

    const parsed: Record<string, ParsedValue> = {};
    for (const [key, rawValue] of entries) {
      if (!key) continue;
      const parsedValue = parseSnapshotScalar(rawValue);

      if (key.includes(".")) {
        const [parentKey, childKey] = key.split(".");
        if (parentKey && childKey) {
          const parent =
            typeof parsed[parentKey] === "object" && parsed[parentKey] !== null
              ? (parsed[parentKey] as Record<string, ParsedScalar>)
              : {};
          parent[childKey] = parsedValue;
          parsed[parentKey] = parent;
          continue;
        }
      }

      parsed[key] = parsedValue;
    }

    return parsed as PineSnapshot;
  }
}
