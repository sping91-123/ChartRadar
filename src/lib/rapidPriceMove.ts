import type { Candle } from "@/lib/marketAnalysis";

export type RapidMoveSymbol = "BTCUSDT" | "ETHUSDT";
export const rapidMoveThresholds = {
  BTCUSDT: { 5: 1, 15: 2 },
  ETHUSDT: { 5: 1.5, 15: 3 }
} as const;

export interface RapidMoveSnapshot {
  version: 1;
  symbol: RapidMoveSymbol;
  windowMinutes: 5 | 15;
  direction: "up" | "down";
  changePercent: number;
  thresholdPercent: number;
  startPrice: number;
  endPrice: number;
  windowStartedAt: string;
  observedAt: string;
  detectedAt: string;
  priorHigh: number;
  priorLow: number;
  volumeRatio: number | null;
  candles: Candle[];
}

export function isRapidMoveEventKey(value: unknown): value is string {
  return typeof value === "string" && /^rapid-price-move:(BTCUSDT|ETHUSDT):(up|down):\d{10}$/.test(value);
}

export function rapidMoveEventKey(snapshot: RapidMoveSnapshot) {
  return `rapid-price-move:${snapshot.symbol}:${snapshot.direction}:${Date.parse(snapshot.observedAt) / 1000}`;
}

export function detectRapidPriceMove(symbol: RapidMoveSymbol, input: Candle[], now = Date.now()): RapidMoveSnapshot | null {
  const candles = input.filter((candle) => (candle.time + 60) * 1000 <= now - 1000).slice(-61);
  if (candles.length < 46) return null;
  if (candles.some((candle, i) =>
    ![candle.time, candle.open, candle.high, candle.low, candle.close, candle.volume].every(Number.isFinite) ||
    candle.time % 60 !== 0 || candle.low <= 0 || candle.volume < 0 ||
    candle.high < Math.max(candle.open, candle.close) || candle.low > Math.min(candle.open, candle.close) ||
    (i > 0 && candle.time !== candles[i - 1].time + 60)
  )) return null;
  const end = candles[candles.length - 1];
  const observedMs = (end.time + 60) * 1000;
  if (now - observedMs > 120_000) return null;
  const candidates = ([5, 15] as const).map((windowMinutes) => {
    const start = candles[candles.length - 1 - windowMinutes];
    const changePercent = (end.close / start.close - 1) * 100;
    const thresholdPercent = rapidMoveThresholds[symbol][windowMinutes];
    return { windowMinutes, start, changePercent, thresholdPercent };
  }).filter((candidate) => Math.abs(candidate.changePercent) + 1e-9 >= candidate.thresholdPercent)
    .sort((a, b) => Math.abs(b.changePercent) / b.thresholdPercent - Math.abs(a.changePercent) / a.thresholdPercent);
  const candidate = candidates[0];
  if (!candidate) return null;
  const prior = candles.slice(-candidate.windowMinutes - 30, -candidate.windowMinutes);
  const move = candles.slice(-candidate.windowMinutes);
  const priorVolume = prior.reduce((sum, candle) => sum + candle.volume, 0) / prior.length;
  const moveVolume = move.reduce((sum, candle) => sum + candle.volume, 0) / move.length;
  return {
    version: 1, symbol, windowMinutes: candidate.windowMinutes,
    direction: candidate.changePercent > 0 ? "up" : "down",
    changePercent: candidate.changePercent, thresholdPercent: candidate.thresholdPercent,
    startPrice: candidate.start.close, endPrice: end.close,
    windowStartedAt: new Date((candidate.start.time + 60) * 1000).toISOString(),
    observedAt: new Date(observedMs).toISOString(), detectedAt: new Date(now).toISOString(),
    priorHigh: Math.max(...prior.map((candle) => candle.high)), priorLow: Math.min(...prior.map((candle) => candle.low)),
    volumeRatio: priorVolume > 0 ? moveVolume / priorVolume : null,
    candles: candles.map(({ time, open, high, low, close, volume }) => ({ time, open, high, low, close, volume }))
  };
}

// Recalculate exclusively from the preserved candles, never from today's feed.
export function readRapidMoveSnapshot(value: unknown): RapidMoveSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<RapidMoveSnapshot>;
  if (raw.version !== 1 || (raw.symbol !== "BTCUSDT" && raw.symbol !== "ETHUSDT") ||
    !Array.isArray(raw.candles) || raw.candles.length > 61 ||
    raw.candles.some((candle) => !candle || typeof candle !== "object") ||
    typeof raw.detectedAt !== "string" || !Number.isFinite(Date.parse(raw.detectedAt))) return null;
  const computed = detectRapidPriceMove(raw.symbol, raw.candles, Date.parse(raw.detectedAt));
  if (!computed) return null;
  for (const key of ["windowMinutes", "direction", "changePercent", "thresholdPercent", "startPrice", "endPrice", "windowStartedAt", "observedAt", "priorHigh", "priorLow", "volumeRatio"] as const) {
    if (raw[key] !== computed[key]) return null;
  }
  return computed;
}

export function rapidMoveNextCheck(snapshot: RapidMoveSnapshot) {
  const price = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (snapshot.direction === "up" && snapshot.endPrice > snapshot.priorHigh) return `변동 전 고가 ${price(snapshot.priorHigh)} 위에서 유지되는지 확인하세요.`;
  if (snapshot.direction === "down" && snapshot.endPrice < snapshot.priorLow) return `변동 전 저가 ${price(snapshot.priorLow)}를 회복하는지 확인하세요.`;
  return `변동 전 범위 ${price(snapshot.priorLow)}–${price(snapshot.priorHigh)} 안에서 움직이는지 확인하세요.`;
}
