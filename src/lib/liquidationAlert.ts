import type { Candle } from "@/lib/marketAnalysis";
import type { LiquidationPressureReport, LiquidationPressureSide } from "@/lib/liquidationPressure";

const minute = 60_000;
export const liquidationCandleMs = 15 * minute;
export type LiquidationAlertSide = Exclude<LiquidationPressureSide, "balanced">;
export interface LiquidationPriceContext {
  closedAt: string;
  close: number;
  low: number;
  high: number;
  candles: Candle[];
}
export interface LiquidationChange {
  reason: "first" | "direction_confirmed" | "side_changed" | "extreme" | "increase" | "unchanged";
  previousPressure: number | null;
  previousSide: string | null;
  previousAt: string | null;
}
export interface LiquidationAlertSnapshot {
  version: 2;
  symbol: "BTCUSDT";
  observedAt: string;
  side: LiquidationAlertSide;
  pressure: number;
  longAccountPercent: number;
  shortAccountPercent: number;
  prices: LiquidationPriceContext;
  change?: LiquidationChange;
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const percent = (v: unknown) => finite(v) && v >= 0 && v <= 100;
function fresh(value: unknown, now: number, maxAge: number) {
  return finite(value) && value > 0 && value <= now && now - value <= maxAge;
}

/** Different observations have different cadences. Missing or stale input is not zero risk. */
export function liquidationInputsReady(report: LiquidationPressureReport, now = Date.now()) {
  const observed = report.evidenceObservedAt;
  if (report.symbol !== "BTCUSDT" || report.period !== "15m" || !observed ||
    !["downsideLongs", "upsideShorts"].includes(report.dominantSide) ||
    !["heated", "extreme"].includes(report.grade) ||
    !percent(report.upsideShortPressure) || !percent(report.downsideLongPressure) ||
    !finite(report.fundingRatePercent) || report.fundingRateSource !== "Binance" ||
    !fresh(observed.fundingRate, now, 9 * 60 * minute) ||
    !finite(report.openInterestChangePercent)) return false;
  for (const key of ["openInterest", "globalLongShort", "topAccountLongShort", "topPositionLongShort", "takerFlow"] as const) {
    if (!fresh(observed[key], now, 35 * minute)) return false;
  }
  for (const row of [report.globalLongShort, report.topAccountLongShort, report.topPositionLongShort]) {
    if (!row || !percent(row.longPercent) || !percent(row.shortPercent) ||
      Math.abs(row.longPercent! + row.shortPercent! - 100) > 0.2) return false;
  }
  return Boolean(report.takerFlow && percent(report.takerFlow.buyPercent) && percent(report.takerFlow.sellPercent) &&
    Math.abs(report.takerFlow.buyPercent! + report.takerFlow.sellPercent! - 100) <= 0.2);
}

/** The last closed candle is compared with the four preceding closed candles, never itself. */
export function liquidationPriceContext(candles: Candle[], now = Date.now()): LiquidationPriceContext | null {
  const rows = candles.slice(-5);
  if (rows.length !== 5 || rows.some((c, i) => !c ||
    ![c.time, c.open, c.high, c.low, c.close, c.volume].every(finite) ||
    c.time % 900 !== 0 || c.low <= 0 || c.high < Math.max(c.open, c.close) ||
    c.low > Math.min(c.open, c.close) || c.volume < 0 ||
    (i > 0 && c.time - rows[i - 1].time !== 900))) return null;
  const latest = rows[4];
  const closedAt = latest.time * 1000 + liquidationCandleMs;
  if (closedAt > now - 1000 || now - closedAt > 20 * minute) return null;
  return { closedAt: new Date(closedAt).toISOString(), close: latest.close,
    low: Math.min(...rows.slice(0, 4).map(c => c.low)),
    high: Math.max(...rows.slice(0, 4).map(c => c.high)), candles: rows };
}

export function liquidationAlertKey(snapshot: Pick<LiquidationAlertSnapshot, "side" | "prices">) {
  return "liquidation-pressure:v2:BTCUSDT:" + snapshot.side + ":" + Math.floor(Date.parse(snapshot.prices.closedAt) / 1000);
}
export function isLiquidationAlertKey(value: unknown): value is string {
  return typeof value === "string" && /^liquidation-pressure:v2:BTCUSDT:(downsideLongs|upsideShorts):\d{10}$/.test(value);
}
export const liquidationPrice = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });
export function liquidationNextCheck(snapshot: Pick<LiquidationAlertSnapshot, "side" | "prices">) {
  const { prices, side } = snapshot;
  if (side === "downsideLongs") return prices.close < prices.low
    ? "직전 1시간 저가 " + liquidationPrice(prices.low) + " 아래 마감. 다음 15분봉이 이 가격을 회복하는지 확인하세요."
    : "다음 15분봉이 직전 1시간 저가 " + liquidationPrice(prices.low) + " 아래에서 마감하는지 확인하세요.";
  return prices.close > prices.high
    ? "직전 1시간 고가 " + liquidationPrice(prices.high) + " 위 마감. 다음 15분봉도 이 가격 위에서 마감하는지 확인하세요."
    : "다음 15분봉이 직전 1시간 고가 " + liquidationPrice(prices.high) + " 위에서 마감하는지 확인하세요.";
}
export function liquidationChangeText(pressure: number, change?: LiquidationChange) {
  if (!change || change.previousPressure === null) return "청산 압력 추정 " + pressure + "/100 · 첫 감지";
  const label = change.reason === "direction_confirmed" ? "위험 방향 확인" : change.reason === "side_changed" ? "위험 방향 전환" : change.reason === "extreme" ? "매우 높음 구간 진입" : "청산 압력 증가";
  return label + " · 직전 알림 " + change.previousPressure + " → " + pressure + "/100";
}

/** Validate saved, untrusted JSON without replacing its historical clock with today's data. */
export function readLiquidationAlertSnapshot(value: unknown): LiquidationAlertSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const s = value as LiquidationAlertSnapshot;
  const observed = Date.parse(s.observedAt);
  if (s.version !== 2 || s.symbol !== "BTCUSDT" || !["downsideLongs", "upsideShorts"].includes(s.side) ||
    !percent(s.pressure) || !percent(s.longAccountPercent) || !percent(s.shortAccountPercent) ||
    !Number.isFinite(observed) || !s.prices || !Array.isArray(s.prices.candles)) return null;
  const prices = liquidationPriceContext(s.prices.candles, observed);
  if (!prices || prices.closedAt !== s.prices.closedAt || prices.close !== s.prices.close ||
    prices.high !== s.prices.high || prices.low !== s.prices.low) return null;
  const c = s.change;
  if (c && (!["first", "direction_confirmed", "side_changed", "extreme", "increase", "unchanged"].includes(c.reason) ||
    (c.previousPressure !== null && !percent(c.previousPressure)) ||
    (c.previousSide !== null && !["downsideLongs", "upsideShorts", "balanced"].includes(c.previousSide)) ||
    (c.previousAt !== null && (!Number.isFinite(Date.parse(c.previousAt)) || Date.parse(c.previousAt) > observed)))) return null;
  return { ...s, prices };
}
