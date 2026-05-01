export type ChartTimeframe = "5m" | "15m" | "1h" | "4h" | "1d";
export type DirectionState = "bullish" | "bearish" | "neutral" | "unknown";
export type BiasSide = "long" | "short" | "neutral";
export type ReasonTone = "bullish" | "bearish" | "neutral";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PivotPoint {
  price: number;
  index: number;
  confirmedIndex: number;
}

export interface FvgZone {
  timeframe: ChartTimeframe;
  direction: "bullish" | "bearish";
  state: "fvg" | "ifvg";
  top: number;
  bottom: number;
  age: number;
  isInside: boolean;
}

export interface OrderBlockZone {
  timeframe: ChartTimeframe;
  direction: "bullish" | "bearish";
  top: number;
  bottom: number;
  age: number;
  isInside: boolean;
}

export interface SweepZone {
  timeframe: ChartTimeframe;
  direction: "bullish" | "bearish";
  level: number;
  age: number;
  kind: "wick";
}

export interface CisdSignal {
  timeframe: ChartTimeframe;
  direction: "bullish" | "bearish";
  age: number;
}

export interface StructureDebug {
  h0: number | null;
  h1: number | null;
  l0: number | null;
  l1: number | null;
  hiCount: number;
  loCount: number;
  market: 1 | -1 | 0;
  choch: 1 | -1 | 0;
}

export interface TimeframeAnalysis {
  timeframe: ChartTimeframe;
  msb: DirectionState;
  choch: DirectionState;
  ema200Side: "above" | "below" | "unknown";
  ema200Value: number | null;
  latestFvg: FvgZone | null;
  inFvg: boolean;
  latestOb: OrderBlockZone | null;
  inOb: boolean;
  latestBb: OrderBlockZone | null;
  inBb: boolean;
  latestSweep: SweepZone | null;
  latestCisd: CisdSignal | null;
  oteZone: "long" | "short" | "none";
  premiumDiscount: "premium" | "discount" | "equilibrium" | "unknown";
  score: number;
  debug: StructureDebug;
}

export interface AnalysisReason {
  text: string;
  tone: ReasonTone;
}

export interface ScenarioCard {
  title: string;
  summary: string;
  blockers: string[];
}

export interface TradePlanCandidate {
  side: Exclude<BiasSide, "neutral">;
  quality: "A" | "B" | "C";
  title: string;
  entryLabel: string;
  entryLow: number;
  entryHigh: number;
  invalidation: number;
  target1: number;
  target2: number;
  rr1: number;
  rr2: number;
  confidence: number;
  reason: string;
  cautions: string[];
}

export interface MarketAnalysis {
  symbol: string;
  activeTimeframe: ChartTimeframe;
  price: number;
  bias: BiasSide;
  killzone: "asia" | "london" | "newyork" | "off";
  biasScore: number;
  readiness: "high" | "medium" | "low";
  verdict: string;
  summaryLine: string;
  actionGuide: string;
  currentLocationLabel: string;
  checkpoints: string[];
  longScenario: ScenarioCard;
  shortScenario: ScenarioCard;
  proPlan: TradePlanCandidate | null;
  opportunityFlags: string[];
  riskFlags: string[];
  reasons: AnalysisReason[];
  warnings: string[];
  timeframeAnalyses: TimeframeAnalysis[];
  updatedAt: string;
}

interface StructureState {
  market: 1 | -1;
  chochDir: 1 | -1;
  h0: PivotPoint | null;
  h1: PivotPoint | null;
  l0: PivotPoint | null;
  l1: PivotPoint | null;
  hiPoints: PivotPoint[];
  loPoints: PivotPoint[];
  latestOb: OrderBlockZone | null;
  latestBb: OrderBlockZone | null;
  latestCisd: CisdSignal | null;
}

interface AnalysisContext {
  oteAnchorCandles?: Candle[];
  useCloseForMsb?: boolean;
}

export const chartTimeframes: ChartTimeframe[] = ["5m", "15m", "1h", "4h", "1d"];

const intervalMap: Record<ChartTimeframe, string> = {
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d"
};

export async function fetchBinanceCandles(
  symbol: string,
  timeframe: ChartTimeframe,
  limit = 320
): Promise<Candle[]> {
  const normalizedSymbol = symbol.toUpperCase().replace(".P", "");
  const params = new URLSearchParams({
    symbol: normalizedSymbol,
    interval: intervalMap[timeframe],
    limit: String(limit)
  });

  const response = await fetch(`https://fapi.binance.com/fapi/v1/klines?${params.toString()}`);
  if (!response.ok) {
    throw new Error("캔들 데이터를 불러오지 못했습니다.");
  }

  const rows = (await response.json()) as Array<
    [
      number,
      string,
      string,
      string,
      string,
      string,
      number,
      string,
      number,
      string,
      string,
      string
    ]
  >;

  return rows.map((row) => ({
    time: Math.floor(row[0] / 1000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5])
  }));
}

function ema(values: number[], length: number): number | null {
  if (values.length < length) return null;

  const multiplier = 2 / (length + 1);
  let result = values.slice(0, length).reduce((sum, value) => sum + value, 0) / length;

  for (let index = length; index < values.length; index += 1) {
    result = (values[index] - result) * multiplier + result;
  }

  return result;
}

function highestClose(candles: Candle[], start: number, end: number) {
  let value = -Infinity;
  for (let index = start; index <= end; index += 1) {
    value = Math.max(value, candles[index].close);
  }
  return value;
}

function lowestClose(candles: Candle[], start: number, end: number) {
  let value = Infinity;
  for (let index = start; index <= end; index += 1) {
    value = Math.min(value, candles[index].close);
  }
  return value;
}

function pointFromEnd(points: PivotPoint[], offset: number) {
  const index = points.length - 1 - offset;
  return index >= 0 ? points[index] : null;
}

function formatBarsAgo(age: number) {
  if (age <= 0) return "방금";
  return `${age}봉 전`;
}

function directionKorean(direction: DirectionState) {
  if (direction === "bullish") return "상승";
  if (direction === "bearish") return "하락";
  if (direction === "neutral") return "중립";
  return "미확인";
}

function getCurrentKillzone(): "asia" | "london" | "newyork" | "off" {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  const parts = formatter.formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const totalMinutes = hour * 60 + minute;

  if (totalMinutes >= 20 * 60 && totalMinutes < 22 * 60) return "asia";
  if (totalMinutes >= 2 * 60 && totalMinutes < 5 * 60) return "london";
  if (totalMinutes >= 7 * 60 && totalMinutes < 12 * 60) return "newyork";
  return "off";
}

function buildPivotArrays(candles: Candle[], zigLen = 5) {
  const hiPoints: PivotPoint[] = [];
  const loPoints: PivotPoint[] = [];

  let trend: 1 | -1 = 1;
  let trendUpBar: number | null = null;
  let trendDownBar: number | null = null;

  for (let index = zigLen - 1; index < candles.length; index += 1) {
    const windowStart = Math.max(0, index - zigLen + 1);
    const toUp = candles[index].close >= highestClose(candles, windowStart, index);
    const toDown = candles[index].close <= lowestClose(candles, windowStart, index);
    const nextTrend: 1 | -1 =
      trend === 1 && toDown ? -1 : trend === -1 && toUp ? 1 : trend;

    if (nextTrend !== trend) {
      if (nextTrend === 1) {
        const downLen = trendDownBar === null ? zigLen : Math.min(index - trendDownBar + 1, 500);
        let lowValue = candles[index].low;
        let lowIndex = index;

        for (let offset = 0; offset < downLen && index - offset >= 0; offset += 1) {
          const candle = candles[index - offset];
          if (candle.low < lowValue) {
            lowValue = candle.low;
            lowIndex = index - offset;
          }
        }

        loPoints.push({ price: lowValue, index: lowIndex, confirmedIndex: index });
        if (loPoints.length > 50) loPoints.shift();
        trendUpBar = index;
      }

      if (nextTrend === -1) {
        const upLen = trendUpBar === null ? zigLen : Math.min(index - trendUpBar + 1, 500);
        let highValue = candles[index].high;
        let highIndex = index;

        for (let offset = 0; offset < upLen && index - offset >= 0; offset += 1) {
          const candle = candles[index - offset];
          if (candle.high > highValue) {
            highValue = candle.high;
            highIndex = index - offset;
          }
        }

        hiPoints.push({ price: highValue, index: highIndex, confirmedIndex: index });
        if (hiPoints.length > 50) hiPoints.shift();
        trendDownBar = index;
      }

      trend = nextTrend;
    }
  }

  return { hiPoints, loPoints };
}

function findBullishOb(candles: Candle[], fromIndex: number, toIndex: number) {
  let originIndex = toIndex;
  for (let index = toIndex; index >= fromIndex; index -= 1) {
    if (candles[index].open > candles[index].close) {
      originIndex = index;
      break;
    }
  }
  return originIndex;
}

function findBearishOb(candles: Candle[], fromIndex: number, toIndex: number) {
  let originIndex = toIndex;
  for (let index = toIndex; index >= fromIndex; index -= 1) {
    if (candles[index].open < candles[index].close) {
      originIndex = index;
      break;
    }
  }
  return originIndex;
}

function findInstantBullishOb(candles: Candle[], fromIndex: number, toIndex: number) {
  const safeFrom = Math.max(0, fromIndex);
  const safeTo = Math.max(safeFrom, toIndex);

  let lowestPrice = candles[safeFrom].low;
  let lowestIndex = safeFrom;

  for (let index = safeFrom; index <= safeTo; index += 1) {
    if (candles[index].low < lowestPrice) {
      lowestPrice = candles[index].low;
      lowestIndex = index;
    }
  }

  let originIndex = lowestIndex;
  const searchTo = Math.min(lowestIndex + 10, safeTo);

  for (let index = lowestIndex; index <= searchTo; index += 1) {
    if (candles[index].open > candles[index].close) {
      originIndex = index;
      break;
    }
  }

  return originIndex;
}

function findInstantBearishOb(candles: Candle[], fromIndex: number, toIndex: number) {
  const safeFrom = Math.max(0, fromIndex);
  const safeTo = Math.max(safeFrom, toIndex);

  let highestPrice = candles[safeFrom].high;
  let highestIndex = safeFrom;

  for (let index = safeFrom; index <= safeTo; index += 1) {
    if (candles[index].high > highestPrice) {
      highestPrice = candles[index].high;
      highestIndex = index;
    }
  }

  let originIndex = highestIndex;
  const searchTo = Math.min(highestIndex + 10, safeTo);

  for (let index = highestIndex; index <= searchTo; index += 1) {
    if (candles[index].open < candles[index].close) {
      originIndex = index;
      break;
    }
  }

  return originIndex;
}

function buildBreakerBlock(
  candles: Candle[],
  timeframe: ChartTimeframe,
  market: 1 | -1,
  h1: PivotPoint | null,
  l1: PivotPoint | null
): OrderBlockZone | null {
  if (!h1 || !l1) return null;

  const fromIndex = Math.max(0, Math.min(h1.index, l1.index));
  const toIndex = Math.max(fromIndex, Math.max(h1.index, l1.index));

  let originIndex = toIndex;

  if (market === 1) {
    for (let index = toIndex; index >= fromIndex; index -= 1) {
      if (candles[index].open < candles[index].close) {
        originIndex = index;
        break;
      }
    }
  } else {
    for (let index = toIndex; index >= fromIndex; index -= 1) {
      if (candles[index].open > candles[index].close) {
        originIndex = index;
        break;
      }
    }
  }

  const latestPrice = candles[candles.length - 1]?.close ?? 0;
  return {
    timeframe,
    direction: market === 1 ? "bullish" : "bearish",
    top: candles[originIndex].high,
    bottom: candles[originIndex].low,
    age: candles.length - 1 - originIndex,
    isInside: latestPrice <= candles[originIndex].high && latestPrice >= candles[originIndex].low
  };
}

function buildStructureState(
  candles: Candle[],
  timeframe: ChartTimeframe,
  zigLen = 5,
  useCloseForMsb = true
): StructureState {
  const { hiPoints, loPoints } = buildPivotArrays(candles, zigLen);

  let market: 1 | -1 = 1;
  let chochDir: 1 | -1 = 1;
  let latestOb: OrderBlockZone | null = null;
  let latestBb: OrderBlockZone | null = null;
  let latestCisd: CisdSignal | null = null;

  for (let index = 0; index < candles.length; index += 1) {
    const validHighs = hiPoints.filter((point) => point.confirmedIndex <= index);
    const validLows = loPoints.filter((point) => point.confirmedIndex <= index);
    const h0 = pointFromEnd(validHighs, 0);
    const h1 = pointFromEnd(validHighs, 1);
    const l0 = pointFromEnd(validLows, 0);
    const l1 = pointFromEnd(validLows, 1);

    const bullBreakSource = useCloseForMsb ? candles[index].close : candles[index].high;
    const bearBreakSource = useCloseForMsb ? candles[index].close : candles[index].low;

    const bullBreak = market === -1 && h0 && bullBreakSource > h0.price;
    const bearBreak = market === 1 && l0 && bearBreakSource < l0.price;

    if (bullBreak) {
      market = 1;
      chochDir = 1;

      if (h1 && l0) {
        const fromIndex = Math.max(0, h1.index);
        const toIndex = index;
        const originIndex = findInstantBullishOb(candles, fromIndex, toIndex);
        latestOb = {
          timeframe,
          direction: "bullish",
          top: candles[originIndex].high,
          bottom: candles[originIndex].low,
          age: candles.length - 1 - originIndex,
          isInside: false
        };
      }

      continue;
    }

    if (bearBreak) {
      market = -1;
      chochDir = -1;

      if (l1 && h0) {
        const fromIndex = Math.max(0, l1.index);
        const toIndex = index;
        const originIndex = findInstantBearishOb(candles, fromIndex, toIndex);
        latestOb = {
          timeframe,
          direction: "bearish",
          top: candles[originIndex].high,
          bottom: candles[originIndex].low,
          age: candles.length - 1 - originIndex,
          isInside: false
        };
      }

      continue;
    }

    const previousChoch: 1 | -1 = chochDir;
    const instantBearChoch = Boolean(chochDir === 1 && l0 && candles[index].low < l0.price);
    const instantBullChoch = Boolean(chochDir === -1 && h0 && candles[index].high > h0.price);

    if (instantBearChoch) {
      chochDir = -1;
    } else if (instantBullChoch) {
      chochDir = 1;
    }

    if (chochDir !== previousChoch && latestOb) {
      const isInsideOb =
        candles[index].close <= latestOb.top && candles[index].close >= latestOb.bottom;

      if (isInsideOb) {
        if (chochDir === 1 && latestOb.direction === "bullish") {
          latestCisd = {
            timeframe,
            direction: "bullish",
            age: candles.length - 1 - index
          };
        }

        if (chochDir === -1 && latestOb.direction === "bearish") {
          latestCisd = {
            timeframe,
            direction: "bearish",
            age: candles.length - 1 - index
          };
        }
      }
    }
  }

  const h0 = pointFromEnd(hiPoints, 0);
  const h1 = pointFromEnd(hiPoints, 1);
  const l0 = pointFromEnd(loPoints, 0);
  const l1 = pointFromEnd(loPoints, 1);

  if (latestOb) {
    const latestPrice = candles[candles.length - 1]?.close ?? 0;
    latestOb = {
      ...latestOb,
      isInside: latestPrice <= latestOb.top && latestPrice >= latestOb.bottom
    };
  }

  latestBb = buildBreakerBlock(candles, timeframe, market, h1, l1);

  return {
    market,
    chochDir,
    h0,
    h1,
    l0,
    l1,
    hiPoints,
    loPoints,
    latestOb,
    latestBb,
    latestCisd
  };
}

function detectLatestSweep(
  candles: Candle[],
  timeframe: ChartTimeframe,
  hiPoints: PivotPoint[],
  loPoints: PivotPoint[]
): SweepZone | null {
  const latestIndex = candles.length - 1;
  let best: SweepZone | null = null;

  for (const point of hiPoints.slice(-10)) {
    for (let index = point.confirmedIndex; index < candles.length; index += 1) {
      const candle = candles[index];
      if (candle.high > point.price && candle.close < point.price) {
        const candidate: SweepZone = {
          timeframe,
          direction: "bearish",
          level: point.price,
          age: latestIndex - index,
          kind: "wick"
        };

        if (!best || candidate.age < best.age) {
          best = candidate;
        }
      }
    }
  }

  for (const point of loPoints.slice(-10)) {
    for (let index = point.confirmedIndex; index < candles.length; index += 1) {
      const candle = candles[index];
      if (candle.low < point.price && candle.close > point.price) {
        const candidate: SweepZone = {
          timeframe,
          direction: "bullish",
          level: point.price,
          age: latestIndex - index,
          kind: "wick"
        };

        if (!best || candidate.age < best.age) {
          best = candidate;
        }
      }
    }
  }

  return best;
}

function detectLatestFvg(candles: Candle[], timeframe: ChartTimeframe): FvgZone | null {
  const latestPrice = candles[candles.length - 1]?.close;
  if (!latestPrice || candles.length < 5) return null;

  for (let index = candles.length - 1; index >= 2; index -= 1) {
    const current = candles[index];
    const middle = candles[index - 1];
    const previous = candles[index - 2];

    const bullish = current.low > previous.high && middle.close > previous.high;
    if (bullish) {
      const top = current.low;
      const bottom = previous.high;
      const fullyBroken = candles
        .slice(index + 1)
        .some((candle) => candle.low < bottom);

      return {
        timeframe,
        direction: fullyBroken ? "bearish" : "bullish",
        state: fullyBroken ? "ifvg" : "fvg",
        top,
        bottom,
        age: candles.length - 1 - index,
        isInside: latestPrice <= top && latestPrice >= bottom
      };
    }

    const bearish = current.high < previous.low && middle.close < previous.low;
    if (bearish) {
      const top = previous.low;
      const bottom = current.high;
      const fullyBroken = candles
        .slice(index + 1)
        .some((candle) => candle.high > top);

      return {
        timeframe,
        direction: fullyBroken ? "bullish" : "bearish",
        state: fullyBroken ? "ifvg" : "fvg",
        top,
        bottom,
        age: candles.length - 1 - index,
        isInside: latestPrice <= top && latestPrice >= bottom
      };
    }
  }

  return null;
}

function detectOteAndPd(candles: Candle[], anchorCandles?: Candle[]) {
  const latest = candles[candles.length - 1];
  const range = (anchorCandles && anchorCandles.length >= 20 ? anchorCandles : candles).slice(-20);

  if (!latest || range.length < 20) {
    return {
      oteZone: "none" as const,
      premiumDiscount: "unknown" as const
    };
  }

  const high = Math.max(...range.map((candle) => candle.high));
  const low = Math.min(...range.map((candle) => candle.low));
  const span = high - low;

  if (span <= 0) {
    return {
      oteZone: "none" as const,
      premiumDiscount: "unknown" as const
    };
  }

  const position = (latest.close - low) / span;
  const premiumDiscount =
    position > 0.55
      ? ("premium" as const)
      : position < 0.45
        ? ("discount" as const)
        : ("equilibrium" as const);

  const longLower = low + span * 0.21;
  const longUpper = low + span * 0.38;
  const shortLower = low + span * 0.62;
  const shortUpper = low + span * 0.79;

  const touchesLongOte = latest.low <= longUpper && latest.high >= longLower;
  const touchesShortOte = latest.high >= shortUpper && latest.low <= shortLower;

  const oteZone = touchesLongOte
    ? ("long" as const)
    : touchesShortOte
      ? ("short" as const)
      : ("none" as const);

  return { oteZone, premiumDiscount };
}

function appendReason(reasons: AnalysisReason[], text: string, tone: ReasonTone) {
  reasons.push({ text, tone });
}

function buildSummaryLine(
  bias: BiasSide,
  active: TimeframeAnalysis | undefined,
  htf: TimeframeAnalysis[],
  killzone: "asia" | "london" | "newyork" | "off"
) {
  const htfBullish = htf.filter((item) => item.msb === "bullish").length;
  const htfBearish = htf.filter((item) => item.msb === "bearish").length;

  if (!active) {
    return "데이터를 불러오는 중입니다.";
  }

  const killzoneText =
    killzone === "asia" ? "아시아" : killzone === "london" ? "런던" : killzone === "newyork" ? "뉴욕" : "비킬존";

  if (bias === "long") {
    if (active.choch === "bearish") {
      return "큰 방향은 롱 쪽이지만 단기 구조가 먼저 흔들리고 있어서, 추격보다 재정렬 확인이 먼저입니다.";
    }
    if (active.inFvg && active.latestFvg?.state === "ifvg" && active.latestFvg.direction === "bullish") {
      return "최근 하락 FVG가 뒤집혀 상승 iFVG로 작동하는 구간이라면, 지지 반응 확인이 더 중요합니다.";
    }
    if (active.premiumDiscount === "premium") {
      return "롱 우세지만 프리미엄 구간이라 지금 바로 올려잡기보다 눌림 확인이 더 자연스럽습니다.";
    }
    if (active.inOb && active.latestOb?.direction === "bullish") {
      return "현재가가 상승 OB 안에 있어, 롱 관찰 구간으로 보기 좋은 자리입니다.";
    }
    if (active.inFvg && active.latestFvg?.direction === "bullish") {
      return "상승 FVG 내부라면 눌림 이후 반응을 보는 쪽이 더 깔끔합니다.";
    }
    if (htfBullish >= 2) {
      return killzone === "off"
        ? "상위 구조가 롱 쪽으로 정렬돼 있습니다. 다만 지금은 킬존 밖이라 타이밍은 조금 더 가려보는 편이 좋습니다."
        : `상위 구조가 롱 쪽으로 정렬돼 있고 현재 ${killzoneText} 킬존이라 롱 시나리오를 볼 시간대입니다.`;
    }
    return "롱 쪽이 조금 더 우세하지만, 자리와 반응 확인이 아직 더 필요합니다.";
  }

  if (bias === "short") {
    if (active.choch === "bullish") {
      return "큰 방향은 숏 쪽이지만 단기 구조가 먼저 들리고 있어서, 바로 누르기보다 재차 꺾이는지 보는 편이 좋습니다.";
    }
    if (active.inFvg && active.latestFvg?.state === "ifvg" && active.latestFvg.direction === "bearish") {
      return "최근 상승 FVG가 뒤집혀 하락 iFVG로 작동하는 구간이라면, 저항 반응 확인이 더 중요합니다.";
    }
    if (active.premiumDiscount === "discount") {
      return "숏 우세지만 디스카운트 구간이라 아래에서 무리하게 누르기보다 되돌림을 기다리는 편이 낫습니다.";
    }
    if (active.inOb && active.latestOb?.direction === "bearish") {
      return "현재가가 하락 OB 안에 있어, 숏 관찰 구간으로 보기 좋은 자리입니다.";
    }
    if (active.inFvg && active.latestFvg?.direction === "bearish") {
      return "하락 FVG 내부라면 되돌림 이후 저항 반응을 보는 쪽이 더 깔끔합니다.";
    }
    if (htfBearish >= 2) {
      return killzone === "off"
        ? "상위 구조가 숏 쪽으로 정렬돼 있습니다. 다만 지금은 킬존 밖이라 타이밍은 조금 더 가려보는 편이 좋습니다."
        : `상위 구조가 숏 쪽으로 정렬돼 있고 현재 ${killzoneText} 킬존이라 숏 시나리오를 볼 시간대입니다.`;
    }
    return "숏 쪽이 조금 더 우세하지만, 자리와 반응 확인이 아직 더 필요합니다.";
  }

  if (active.msb !== "unknown") {
    return `현재 ${active.timeframe} 구조는 ${directionKorean(active.msb)} 쪽 힌트가 있지만, 상위 구조 정렬은 아직 애매합니다.`;
  }

  return "아직 방향을 단정하기보다 상위 구조와 현재 위치가 맞아떨어지는지 더 보는 편이 좋습니다.";
}

function buildActionGuide(bias: BiasSide, active: TimeframeAnalysis | undefined, readiness: MarketAnalysis["readiness"]) {
  if (!active) return "데이터를 불러오는 중입니다.";

  if (readiness === "high") {
    if (bias === "long") {
      return "롱 우세와 타이밍 조건이 비교적 같이 맞고 있습니다. 다만 추격보다 OB, FVG/iFVG, 눌림 반응 확인 후 들어가는 편이 안전합니다.";
    }
    if (bias === "short") {
      return "숏 우세와 타이밍 조건이 비교적 같이 맞고 있습니다. 다만 아래에서 누르기보다 되돌림과 iFVG 저항 반응을 확인하는 편이 안전합니다.";
    }
  }

  if (readiness === "medium") {
    if (bias === "long") {
      return "롱 쪽 그림은 살아 있지만 아직 한두 가지가 덜 맞습니다. 추격보다 눌림, 재확인, 손절 기준이 먼저입니다.";
    }
    if (bias === "short") {
      return "숏 쪽 그림은 살아 있지만 아직 한두 가지가 덜 맞습니다. 바로 누르기보다 되돌림과 재차 꺾임 확인이 먼저입니다.";
    }
  }

  if (bias === "neutral") {
    return "지금은 방향보다 관찰이 우선입니다. 억지로 롱이나 숏을 정하기보다 구조가 더 또렷해질 때까지 기다리는 편이 낫습니다.";
  }

  return "구조는 보이지만 바로 진입하기엔 아직 성급할 수 있습니다. 자리, 반응, 무효화 기준을 먼저 확인하세요.";
}

function buildCheckpoints(active: TimeframeAnalysis | undefined) {
  if (!active) return ["데이터를 불러오는 중입니다."];

  const checkpoints: string[] = [];

  if (active.latestOb) {
    checkpoints.push(
      `${active.timeframe} ${active.latestOb.direction === "bullish" ? "상승" : "하락"} OB: ${active.latestOb.bottom.toLocaleString("ko-KR", { maximumFractionDigits: 5 })} - ${active.latestOb.top.toLocaleString("ko-KR", { maximumFractionDigits: 5 })} (${formatBarsAgo(active.latestOb.age)})`
    );
  }

  if (active.latestBb) {
    checkpoints.push(
      `${active.timeframe} ${active.latestBb.direction === "bullish" ? "상승" : "하락"} BB 후보: ${active.latestBb.bottom.toLocaleString("ko-KR", { maximumFractionDigits: 5 })} - ${active.latestBb.top.toLocaleString("ko-KR", { maximumFractionDigits: 5 })} (${formatBarsAgo(active.latestBb.age)})`
    );
  }

  if (active.latestFvg) {
    checkpoints.push(
      `${active.timeframe} ${active.latestFvg.direction === "bullish" ? "상승" : "하락"} ${active.latestFvg.state === "ifvg" ? "iFVG" : "FVG"}: ${active.latestFvg.bottom.toLocaleString("ko-KR", { maximumFractionDigits: 5 })} - ${active.latestFvg.top.toLocaleString("ko-KR", { maximumFractionDigits: 5 })} (${formatBarsAgo(active.latestFvg.age)})`
    );
  }

  if (active.latestSweep) {
    checkpoints.push(
      `${active.timeframe} ${active.latestSweep.direction === "bullish" ? "저점 스윕" : "고점 스윕"}: ${active.latestSweep.level.toLocaleString("ko-KR", { maximumFractionDigits: 5 })} (${formatBarsAgo(active.latestSweep.age)})`
    );
  }

  if (active.latestCisd) {
    checkpoints.push(
      `${active.timeframe} ${active.latestCisd.direction === "bullish" ? "상승" : "하락"} CISD: ${formatBarsAgo(active.latestCisd.age)}`
    );
  }

  if (active.oteZone !== "none") {
    checkpoints.push(`${active.timeframe} 현재 ${active.oteZone === "long" ? "롱" : "숏"} OTE 구간`);
  }

  if (!checkpoints.length) {
    checkpoints.push("아직 강하게 눈에 띄는 관찰 구간은 없습니다. 추격보다 구조가 더 모일 때까지 기다리는 편이 좋습니다.");
  }

  return checkpoints.slice(0, 6);
}

function buildCurrentLocationLabel(active: TimeframeAnalysis | undefined, bias: BiasSide) {
  if (!active) return "판독 준비 중";

  if (active.inOb && active.latestOb?.direction === "bullish") {
    return "상승 OB 반응 구간";
  }

  if (active.inOb && active.latestOb?.direction === "bearish") {
    return "하락 OB 저항 구간";
  }

  if (active.inBb && active.latestBb?.direction === "bullish") {
    return "상승 BB 후보 구간";
  }

  if (active.inBb && active.latestBb?.direction === "bearish") {
    return "하락 BB 후보 구간";
  }

  if (active.inFvg && active.latestFvg?.state === "ifvg") {
    return `${active.latestFvg.direction === "bullish" ? "상승" : "하락"} iFVG 구간`;
  }

  if (active.inFvg && active.latestFvg?.state === "fvg") {
    return `${active.latestFvg.direction === "bullish" ? "상승" : "하락"} FVG 구간`;
  }

  if (active.oteZone === "long") {
    return "롱 OTE 구간";
  }

  if (active.oteZone === "short") {
    return "숏 OTE 구간";
  }

  if (active.premiumDiscount === "premium" && bias === "long") {
    return "프리미엄 추격 주의 구간";
  }

  if (active.premiumDiscount === "discount" && bias === "short") {
    return "디스카운트 추격 주의 구간";
  }

  if (active.premiumDiscount === "premium") {
    return "프리미엄 구간";
  }

  if (active.premiumDiscount === "discount") {
    return "디스카운트 구간";
  }

  return "중간 구간 / 관찰 우선";
}

function buildScenarioCard(
  side: "long" | "short",
  active: TimeframeAnalysis | undefined,
  analyses: TimeframeAnalysis[],
  killzone: MarketAnalysis["killzone"]
): ScenarioCard {
  const direction: DirectionState = side === "long" ? "bullish" : "bearish";
  const opposite: DirectionState = side === "long" ? "bearish" : "bullish";
  const higher = analyses.filter((item) => item.timeframe === "4h" || item.timeframe === "1d");
  const blockers: string[] = [];

  if (!active) {
    return {
      title: side === "long" ? "롱 시나리오" : "숏 시나리오",
      summary: "데이터를 불러오는 중입니다.",
      blockers: []
    };
  }

  if (higher.some((item) => item.msb === opposite)) {
    blockers.push(`상위 MSB가 ${side === "long" ? "하락" : "상승"} 쪽으로 섞여 있습니다.`);
  }

  if (active.choch === opposite) {
    blockers.push(`현재 ${active.timeframe} CHoCH가 ${side === "long" ? "하락" : "상승"}으로 먼저 꺾였습니다.`);
  }

  if (active.premiumDiscount === "premium" && side === "long") {
    blockers.push("프리미엄 구간이라 롱 추격은 불리합니다.");
  }

  if (active.premiumDiscount === "discount" && side === "short") {
    blockers.push("디스카운트 구간이라 숏 추격은 불리합니다.");
  }

  if (killzone === "off") {
    blockers.push("현재는 주요 킬존 밖이라 타이밍이 둔할 수 있습니다.");
  }

  if (active.latestCisd?.direction === opposite) {
    blockers.push(`${side === "long" ? "하락" : "상승"} CISD가 최근에 감지됐습니다.`);
  }

  if (active.latestSweep?.direction === opposite && active.latestSweep.age <= 8) {
    blockers.push(`최근 ${side === "long" ? "고점 스윕" : "저점 스윕"} 반대 신호가 가까이 있습니다.`);
  }

  let summary = "";
  if (side === "long") {
    if (active.inOb && active.latestOb?.direction === "bullish") {
      summary = "상승 OB 반응을 확인하는 롱 시나리오가 가장 자연스럽습니다.";
    } else if (active.inFvg && active.latestFvg?.direction === "bullish") {
      summary = `${active.latestFvg.state === "ifvg" ? "iFVG" : "FVG"} 지지 반응을 보는 롱 시나리오가 가능합니다.`;
    } else if (active.oteZone === "long") {
      summary = "롱 OTE 구간이라 구조가 다시 붙는지 보는 시나리오가 유효합니다.";
    } else {
      summary = "롱 쪽 구조가 살아 있다면 눌림 뒤 재상승을 보는 시나리오가 기본입니다.";
    }
  } else {
    if (active.inOb && active.latestOb?.direction === "bearish") {
      summary = "하락 OB 저항을 확인하는 숏 시나리오가 가장 자연스럽습니다.";
    } else if (active.inFvg && active.latestFvg?.direction === "bearish") {
      summary = `${active.latestFvg.state === "ifvg" ? "iFVG" : "FVG"} 저항 반응을 보는 숏 시나리오가 가능합니다.`;
    } else if (active.oteZone === "short") {
      summary = "숏 OTE 구간이라 구조가 다시 눌리는지 보는 시나리오가 유효합니다.";
    } else {
      summary = "숏 쪽 구조가 살아 있다면 되돌림 뒤 재하락을 보는 시나리오가 기본입니다.";
    }
  }

  return {
    title: side === "long" ? "롱 시나리오" : "숏 시나리오",
    summary,
    blockers: blockers.slice(0, 4)
  };
}

function zoneMid(zone: { top: number; bottom: number }) {
  return (zone.top + zone.bottom) / 2;
}

function clampZoneAroundPrice(price: number, side: "long" | "short") {
  const width = price * 0.0025;
  return side === "long"
    ? { bottom: price - width, top: price }
    : { bottom: price, top: price + width };
}

function pickPlanZone(side: "long" | "short", active: TimeframeAnalysis, price: number) {
  const direction: DirectionState = side === "long" ? "bullish" : "bearish";

  if (active.inOb && active.latestOb?.direction === direction) {
    return { label: `${active.timeframe} ${side === "long" ? "상승" : "하락"} OB`, top: active.latestOb.top, bottom: active.latestOb.bottom };
  }

  if (active.inFvg && active.latestFvg?.direction === direction) {
    return {
      label: `${active.timeframe} ${active.latestFvg.state === "ifvg" ? "iFVG" : "FVG"}`,
      top: active.latestFvg.top,
      bottom: active.latestFvg.bottom
    };
  }

  if (active.latestOb?.direction === direction) {
    return { label: `${active.timeframe} ${side === "long" ? "상승" : "하락"} OB 재방문`, top: active.latestOb.top, bottom: active.latestOb.bottom };
  }

  if (active.latestFvg?.direction === direction) {
    return {
      label: `${active.timeframe} ${active.latestFvg.state === "ifvg" ? "iFVG" : "FVG"} 재방문`,
      top: active.latestFvg.top,
      bottom: active.latestFvg.bottom
    };
  }

  const hasStructureRange = Boolean(active.debug.h0 && active.debug.l0);
  const fallbackBase = hasStructureRange
    ? zoneMid({ top: Number(active.debug.h0), bottom: Number(active.debug.l0) })
    : price;
  const fallback = clampZoneAroundPrice(fallbackBase, side);
  return {
    label: `${active.timeframe} 현재가 근처 관찰`,
    top: fallback.top,
    bottom: fallback.bottom
  };
}

function buildTradePlanCandidate(
  bias: BiasSide,
  active: TimeframeAnalysis | undefined,
  analyses: TimeframeAnalysis[],
  price: number,
  readiness: MarketAnalysis["readiness"],
  killzone: MarketAnalysis["killzone"],
  riskFlags: string[]
): TradePlanCandidate | null {
  if (!active || bias === "neutral" || price <= 0) return null;

  const side = bias;
  const direction: DirectionState = side === "long" ? "bullish" : "bearish";
  const zone = pickPlanZone(side, active, price);
  const entryLow = Math.min(zone.bottom, zone.top);
  const entryHigh = Math.max(zone.bottom, zone.top);
  const entry = side === "long" ? entryHigh : entryLow;
  const zoneSize = Math.max(entryHigh - entryLow, price * 0.0015);
  const structureLevel =
    side === "long"
      ? Math.min(active.debug.l0 ?? entryLow, entryLow)
      : Math.max(active.debug.h0 ?? entryHigh, entryHigh);
  const buffer = Math.max(zoneSize * 0.25, price * 0.001);
  const invalidation = side === "long" ? structureLevel - buffer : structureLevel + buffer;
  const risk = Math.abs(entry - invalidation);

  if (!Number.isFinite(risk) || risk <= 0) return null;

  const target1 = side === "long" ? entry + risk * 1.5 : entry - risk * 1.5;
  const target2 = side === "long" ? entry + risk * 2.5 : entry - risk * 2.5;
  const alignedHigher = analyses
    .filter((item) => item.timeframe === "4h" || item.timeframe === "1d")
    .filter((item) => item.msb === direction).length;
  const confirmationCount = [
    active.msb === direction,
    active.choch === direction,
    active.latestSweep?.direction === direction && active.latestSweep.age <= 12,
    active.latestCisd?.direction === direction && active.latestCisd.age <= 12,
    active.inOb && active.latestOb?.direction === direction,
    active.inFvg && active.latestFvg?.direction === direction,
    side === "long" ? active.premiumDiscount === "discount" : active.premiumDiscount === "premium",
    killzone !== "off"
  ].filter(Boolean).length;
  const confidence = Math.max(
    35,
    Math.min(92, 38 + confirmationCount * 6 + alignedHigher * 7 + (readiness === "high" ? 10 : readiness === "medium" ? 4 : -4) - riskFlags.length * 4)
  );
  const quality: TradePlanCandidate["quality"] = confidence >= 78 ? "A" : confidence >= 62 ? "B" : "C";
  const cautions = [
    ...riskFlags.slice(0, 3),
    "시장가 추격이 아니라 해당 구간 반응 확인 후 판단",
    "이 값은 교육용 시나리오 후보이며 매수·매도 지시가 아닙니다"
  ];

  return {
    side,
    quality,
    title: `${side === "long" ? "롱" : "숏"} PRO 시나리오 후보`,
    entryLabel: zone.label,
    entryLow,
    entryHigh,
    invalidation,
    target1,
    target2,
    rr1: 1.5,
    rr2: 2.5,
    confidence,
    reason: `${zone.label}을 기준으로 무효화 가격과 1차/2차 목표 후보를 계산했습니다.`,
    cautions: Array.from(new Set(cautions)).slice(0, 5)
  };
}

function buildOpportunityFlags(
  bias: BiasSide,
  active: TimeframeAnalysis | undefined,
  analyses: TimeframeAnalysis[],
  killzone: MarketAnalysis["killzone"]
) {
  const flags: string[] = [];
  if (!active || bias === "neutral") return flags;

  const direction: DirectionState = bias === "long" ? "bullish" : "bearish";
  const alignedHigher = analyses
    .filter((item) => item.timeframe === "4h" || item.timeframe === "1d")
    .every((item) => item.msb === direction);

  if (alignedHigher) flags.push("상위 시간대 구조 정렬");
  if (active.inOb && active.latestOb?.direction === direction) flags.push("현재가가 같은 방향 OB 안에 있음");
  if (active.inBb && active.latestBb?.direction === direction) flags.push("현재가가 같은 방향 BB 후보 안에 있음");
  if (active.inFvg && active.latestFvg?.direction === direction) {
    flags.push(active.latestFvg.state === "ifvg" ? "iFVG 반응 구간 안에 있음" : "FVG 반응 구간 안에 있음");
  }
  if ((bias === "long" && active.oteZone === "long") || (bias === "short" && active.oteZone === "short")) {
    flags.push(`${bias === "long" ? "롱" : "숏"} OTE 구간`);
  }
  if ((bias === "long" && active.premiumDiscount === "discount") || (bias === "short" && active.premiumDiscount === "premium")) {
    flags.push(`${bias === "long" ? "디스카운트" : "프리미엄"} 위치`);
  }
  if (active.latestSweep?.direction === direction && active.latestSweep.age <= 8) flags.push("최근 같은 방향 스윕 발생");
  if (active.latestCisd?.direction === direction && active.latestCisd.age <= 8) flags.push("최근 같은 방향 CISD 발생");
  if (killzone !== "off") {
    flags.push(`${killzone === "asia" ? "아시아" : killzone === "london" ? "런던" : "뉴욕"} 킬존 진행 중`);
  }

  return flags.slice(0, 6);
}

function buildRiskFlags(
  bias: BiasSide,
  active: TimeframeAnalysis | undefined,
  analyses: TimeframeAnalysis[],
  killzone: MarketAnalysis["killzone"]
) {
  const flags: string[] = [];
  if (!active) return flags;

  if (bias === "neutral") flags.push("뚜렷한 방향 우세가 아직 약함");

  const opposite: DirectionState = bias === "long" ? "bearish" : "bullish";

  if (bias !== "neutral" && analyses.some((item) => (item.timeframe === "4h" || item.timeframe === "1d") && item.msb === opposite)) {
    flags.push("상위 시간대 구조가 반대 방향");
  }
  if (bias !== "neutral" && active.choch === opposite) flags.push("현재 TF CHoCH가 반대로 먼저 꺾임");
  if (bias === "long" && active.premiumDiscount === "premium") flags.push("롱 기준 프리미엄 추격 구간");
  if (bias === "short" && active.premiumDiscount === "discount") flags.push("숏 기준 디스카운트 추격 구간");
  if (killzone === "off") flags.push("킬존 바깥 시간대");
  if (bias !== "neutral" && active.latestSweep?.direction === opposite && active.latestSweep.age <= 8) flags.push("최근 반대 방향 스윕 발생");
  if (bias !== "neutral" && active.latestCisd?.direction === opposite && active.latestCisd.age <= 8) flags.push("최근 반대 방향 CISD 발생");
  if (bias === "long" && active.inOb && active.latestOb?.direction === "bearish") flags.push("현재가가 하락 OB 안에 있음");
  if (bias === "short" && active.inOb && active.latestOb?.direction === "bullish") flags.push("현재가가 상승 OB 안에 있음");

  return flags.slice(0, 6);
}

export function analyzeTimeframe(
  timeframe: ChartTimeframe,
  candles: Candle[],
  context?: AnalysisContext
): TimeframeAnalysis {
  const latest = candles[candles.length - 1];
  const closes = candles.map((candle) => candle.close);
  const ema200 = ema(closes, 200);
  const structure = buildStructureState(candles, timeframe, 5, context?.useCloseForMsb ?? true);
  const latestSweep = detectLatestSweep(candles, timeframe, structure.hiPoints, structure.loPoints);
  const latestFvg = detectLatestFvg(candles, timeframe);
  const latestOb = structure.latestOb;
  const latestBb = structure.latestBb;
  const latestCisd = structure.latestCisd;
  const { oteZone, premiumDiscount } = detectOteAndPd(candles, context?.oteAnchorCandles);

  const msb: DirectionState = structure.market === 1 ? "bullish" : "bearish";
  const choch: DirectionState = structure.chochDir === 1 ? "bullish" : "bearish";

  let score = 0;
  if (msb === "bullish") score += 1;
  if (msb === "bearish") score -= 1;
  if (choch === "bullish") score += 0.35;
  if (choch === "bearish") score -= 0.35;
  if (ema200 && latest.close > ema200) score += 1;
  if (ema200 && latest.close < ema200) score -= 1;
  if (latestFvg?.isInside && latestFvg.direction === "bullish") score += 0.75;
  if (latestFvg?.isInside && latestFvg.direction === "bearish") score -= 0.75;
  if (latestOb?.isInside && latestOb.direction === "bullish") score += 0.9;
  if (latestOb?.isInside && latestOb.direction === "bearish") score -= 0.9;
  if (latestBb?.isInside && latestBb.direction === "bullish") score += 0.35;
  if (latestBb?.isInside && latestBb.direction === "bearish") score -= 0.35;
  if (latestSweep?.direction === "bullish" && latestSweep.age <= 20) score += 0.6;
  if (latestSweep?.direction === "bearish" && latestSweep.age <= 20) score -= 0.6;
  if (latestCisd?.direction === "bullish" && latestCisd.age <= 12) score += 0.8;
  if (latestCisd?.direction === "bearish" && latestCisd.age <= 12) score -= 0.8;
  if (oteZone === "long") score += 0.5;
  if (oteZone === "short") score -= 0.5;

  return {
    timeframe,
    msb,
    choch,
    ema200Side: ema200 ? (latest.close >= ema200 ? "above" : "below") : "unknown",
    ema200Value: ema200,
    latestFvg,
    inFvg: Boolean(latestFvg?.isInside),
    latestOb,
    inOb: Boolean(latestOb?.isInside),
    latestBb,
    inBb: Boolean(latestBb?.isInside),
    latestSweep,
    latestCisd,
    oteZone,
    premiumDiscount,
    score: Number(score.toFixed(2)),
    debug: {
      h0: structure.h0?.price ?? null,
      h1: structure.h1?.price ?? null,
      l0: structure.l0?.price ?? null,
      l1: structure.l1?.price ?? null,
      hiCount: structure.hiPoints.length,
      loCount: structure.loPoints.length,
      market: structure.market,
      choch: structure.chochDir
    }
  };
}

export function summarizeMarket(
  symbol: string,
  activeTimeframe: ChartTimeframe,
  analyses: TimeframeAnalysis[],
  price: number
): MarketAnalysis {
  const killzone = getCurrentKillzone();
  const weightedScore = analyses.reduce((sum, item) => {
    const weight =
      item.timeframe === "4h" || item.timeframe === "1d" ? 1.4 : item.timeframe === activeTimeframe ? 1.2 : 1;
    return sum + item.score * weight;
  }, 0);

  const bias: BiasSide = weightedScore >= 2 ? "long" : weightedScore <= -2 ? "short" : "neutral";
  const biasDirection = bias === "long" ? "bullish" : bias === "short" ? "bearish" : "neutral";
  const reasons: AnalysisReason[] = [];
  const warnings: string[] = [];
  const active = analyses.find((item) => item.timeframe === activeTimeframe);
  const htf = analyses.filter((item) => item.timeframe === "4h" || item.timeframe === "1d");
  const fastTf = analyses.filter((item) => item.timeframe === "5m" || item.timeframe === "15m");

  for (const item of fastTf) {
    appendReason(
      reasons,
      `${item.timeframe} MSB ${directionKorean(item.msb)}`,
      item.msb === "bullish" ? "bullish" : "bearish"
    );
    appendReason(
      reasons,
      `${item.timeframe} CHoCH ${directionKorean(item.choch)}`,
      item.choch === "bullish" ? "bullish" : "bearish"
    );
  }

  for (const item of htf) {
    appendReason(
      reasons,
      `${item.timeframe} MSB ${directionKorean(item.msb)}`,
      item.msb === "bullish" ? "bullish" : "bearish"
    );
    appendReason(
      reasons,
      `${item.timeframe} CHoCH ${directionKorean(item.choch)}`,
      item.choch === "bullish" ? "bullish" : "bearish"
    );

    if (item.ema200Side !== "unknown") {
      appendReason(
        reasons,
        `${item.timeframe} EMA200 ${item.ema200Side === "above" ? "위" : "아래"}`,
        item.ema200Side === "above" ? "bullish" : "bearish"
      );
    }
  }

  if (active?.inFvg && active.latestFvg) {
    appendReason(
      reasons,
      `${active.timeframe} ${active.latestFvg.direction === "bullish" ? "상승" : "하락"} ${active.latestFvg.state === "ifvg" ? "iFVG" : "FVG"} 내부`,
      active.latestFvg.direction === "bullish" ? "bullish" : "bearish"
    );
  }

  if (active?.inOb && active.latestOb) {
    appendReason(
      reasons,
      `${active.timeframe} ${active.latestOb.direction === "bullish" ? "상승" : "하락"} OB 내부`,
      active.latestOb.direction === "bullish" ? "bullish" : "bearish"
    );
  }

  if (active?.inBb && active.latestBb) {
    appendReason(
      reasons,
      `${active.timeframe} ${active.latestBb.direction === "bullish" ? "상승" : "하락"} BB 후보 내부`,
      active.latestBb.direction === "bullish" ? "bullish" : "bearish"
    );
  }

  if (active?.latestSweep) {
    appendReason(
      reasons,
      `${active.timeframe} ${active.latestSweep.direction === "bullish" ? "저점 스윕" : "고점 스윕"} ${formatBarsAgo(active.latestSweep.age)}`,
      active.latestSweep.direction === "bullish" ? "bullish" : "bearish"
    );
  }

  if (active?.latestCisd) {
    appendReason(
      reasons,
      `${active.timeframe} ${active.latestCisd.direction === "bullish" ? "상승" : "하락"} CISD ${formatBarsAgo(active.latestCisd.age)}`,
      active.latestCisd.direction === "bullish" ? "bullish" : "bearish"
    );
  }

  if (active && active.oteZone !== "none") {
    appendReason(
      reasons,
      `${active.timeframe} ${active.oteZone === "long" ? "롱" : "숏"} OTE`,
      active.oteZone === "long" ? "bullish" : "bearish"
    );
  }

  if (active?.premiumDiscount === "premium") {
    appendReason(
      reasons,
      `${active.timeframe} 프리미엄 구간`,
      bias === "short" ? "bullish" : "bearish"
    );
  }

  if (active?.premiumDiscount === "discount") {
    appendReason(
      reasons,
      `${active.timeframe} 디스카운트 구간`,
      bias === "long" ? "bullish" : "bearish"
    );
  }

  if (killzone !== "off") {
    appendReason(
      reasons,
      `${killzone === "asia" ? "아시아" : killzone === "london" ? "런던" : "뉴욕"} 킬존`,
      "neutral"
    );
  } else {
    warnings.push("현재는 주요 킬존 밖입니다. 구조가 좋아 보여도 타이밍은 조금 더 조심해서 보는 편이 좋습니다.");
  }

  if (active?.premiumDiscount === "premium" && bias === "long") {
    warnings.push("프리미엄 구간이라 롱 추격은 조심하는 편이 좋습니다.");
  }

  if (active?.premiumDiscount === "discount" && bias === "short") {
    warnings.push("디스카운트 구간이라 숏 추격은 조심하는 편이 좋습니다.");
  }

  if (bias === "neutral") {
    warnings.push("방향이 아직 충분히 정리되지 않았습니다. 지금은 진입보다 관찰이 우선입니다.");
  }

  if (active?.latestCisd?.direction === "bullish" && bias === "short") {
    warnings.push("OB 내부에서 상승 CISD가 보입니다. 숏 확신은 한 번 줄여서 보는 편이 좋습니다.");
  }

  if (active?.latestCisd?.direction === "bearish" && bias === "long") {
    warnings.push("OB 내부에서 하락 CISD가 보입니다. 롱 확신은 한 번 줄여서 보는 편이 좋습니다.");
  }

  let readinessScore = 0;

  if (bias !== "neutral") readinessScore += 1;
  if (active && active.msb === biasDirection) readinessScore += 1;
  if (active && active.choch === biasDirection) readinessScore += 0.5;
  if (biasDirection !== "neutral" && htf.every((item) => item.msb === biasDirection)) readinessScore += 1;
  if (killzone !== "off") readinessScore += 0.5;

  if (active?.latestSweep && active.latestSweep.age <= 8 && active.latestSweep.direction === biasDirection) {
    readinessScore += 0.5;
  }

  if (active?.latestCisd && active.latestCisd.age <= 8 && active.latestCisd.direction === biasDirection) {
    readinessScore += 0.5;
  }

  if (active?.premiumDiscount === "discount" && bias === "long") readinessScore += 0.5;
  if (active?.premiumDiscount === "premium" && bias === "short") readinessScore += 0.5;
  if (active?.premiumDiscount === "premium" && bias === "long") readinessScore -= 0.5;
  if (active?.premiumDiscount === "discount" && bias === "short") readinessScore -= 0.5;

  const readiness: MarketAnalysis["readiness"] =
    readinessScore >= 3.5 ? "high" : readinessScore >= 2 ? "medium" : "low";
  const opportunityFlags = buildOpportunityFlags(bias, active, analyses, killzone);
  const riskFlags = buildRiskFlags(bias, active, analyses, killzone);
  const proPlan = buildTradePlanCandidate(bias, active, analyses, price, readiness, killzone, riskFlags);

  return {
    symbol,
    activeTimeframe,
    price,
    bias,
    killzone,
    biasScore: Number(weightedScore.toFixed(2)),
    readiness,
    verdict: bias === "long" ? "롱 시나리오 우세" : bias === "short" ? "숏 시나리오 우세" : "중립 / 관찰",
    summaryLine: buildSummaryLine(bias, active, htf, killzone),
    actionGuide: buildActionGuide(bias, active, readiness),
    currentLocationLabel: buildCurrentLocationLabel(active, bias),
    checkpoints: buildCheckpoints(active),
    longScenario: buildScenarioCard("long", active, analyses, killzone),
    shortScenario: buildScenarioCard("short", active, analyses, killzone),
    proPlan,
    opportunityFlags,
    riskFlags,
    reasons: reasons.slice(0, 12),
    warnings,
    timeframeAnalyses: analyses,
    updatedAt: new Date().toISOString()
  };
}
