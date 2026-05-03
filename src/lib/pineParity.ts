import type { ChartTimeframe, DirectionState } from "@/lib/marketAnalysis";

export type PineDirectionValue = DirectionState | "long" | "short" | 1 | -1 | 0;
export type PineTimeframeDirectionMap = Partial<Record<ChartTimeframe | "1m", PineDirectionValue>>;

export interface PineSnapshot {
  msb?: PineDirectionValue | PineTimeframeDirectionMap;
  choch?: PineDirectionValue | PineTimeframeDirectionMap;
  market?: 1 | -1 | 0;
  chochDir?: 1 | -1 | 0;
  ema200Side?: "above" | "below" | "unknown";
  premiumDiscount?: "premium" | "discount" | "equilibrium" | "unknown";
  oteZone?: "long" | "short" | "none";
  h0?: number | null;
  h1?: number | null;
  l0?: number | null;
  l1?: number | null;
  hiCount?: number;
  loCount?: number;
  latestOb?: {
    direction?: "bullish" | "bearish";
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

type ParsedValue = string | number | null | Record<string, string | number | null>;

export function normalizePineDirection(value: PineDirectionValue | "none" | null | undefined) {
  if (value === 1 || value === "long" || value === "bullish") return "bullish";
  if (value === -1 || value === "short" || value === "bearish") return "bearish";
  if (value === "neutral") return "neutral";
  return "unknown";
}

export function pineDirectionForTimeframe(
  value: PineSnapshot["msb"] | PineSnapshot["choch"],
  timeframe: ChartTimeframe
) {
  if (value && typeof value === "object") {
    return normalizePineDirection(value[timeframe] ?? value[timeframe.toLowerCase() as ChartTimeframe]);
  }

  return normalizePineDirection(value);
}

export function parsePineSnapshot(value: string): PineSnapshot | null {
  if (!value.trim()) return null;

  try {
    return JSON.parse(value) as PineSnapshot;
  } catch {
    const entries = value
      .split(/[\n,]+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.split(/[:=]/).map((piece) => piece.trim()));

    if (!entries.length) return null;

    const parsed: Record<string, ParsedValue> = {};
    for (const [key, rawValue] of entries) {
      if (!key || rawValue === undefined) continue;
      const numeric = Number(rawValue);
      const parsedValue = Number.isFinite(numeric) ? numeric : rawValue;

      if (key.includes(".")) {
        const [parentKey, childKey] = key.split(".");
        if (parentKey && childKey) {
          const parent =
            typeof parsed[parentKey] === "object" && parsed[parentKey] !== null
              ? (parsed[parentKey] as Record<string, string | number | null>)
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
