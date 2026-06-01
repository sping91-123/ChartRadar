// Deribit 공개 옵션 요약을 앱에서 읽기 쉬운 시장 온도값으로 변환합니다.
export type OptionsCurrency = "BTC" | "ETH";
export type OptionsMarketSide = "call" | "put" | "balanced";
export type OptionsMarketGrade = "calm" | "normal" | "heated" | "extreme";

export interface DeribitOptionSummaryRow {
  instrument_name?: string;
  open_interest?: number | string | null;
  volume_usd?: number | string | null;
  mark_iv?: number | string | null;
  underlying_price?: number | string | null;
  estimated_delivery_price?: number | string | null;
}

export interface OptionsMarketExpiry {
  label: string;
  totalOpenInterest: number;
  callOpenInterest: number;
  putOpenInterest: number;
}

export interface OptionsMarketStrike {
  strike: number;
  totalOpenInterest: number;
  callOpenInterest: number;
  putOpenInterest: number;
}

export interface OptionsMarketReport {
  currency: OptionsCurrency;
  underlyingPrice: number | null;
  totalOpenInterest: number;
  callOpenInterest: number;
  putOpenInterest: number;
  callPutOpenInterestRatio: number | null;
  callVolumeUsd: number;
  putVolumeUsd: number;
  callPutVolumeRatio: number | null;
  averageMarkIv: number | null;
  dominantSide: OptionsMarketSide;
  grade: OptionsMarketGrade;
  biasPercent: number;
  summary: string;
  trigger: string;
  activeExpiry: OptionsMarketExpiry | null;
  topStrike: OptionsMarketStrike | null;
  updatedAt: number;
  source: "deribit";
}

type OptionType = "C" | "P";

interface ParsedOptionRow {
  optionType: OptionType;
  strike: number;
  expiryKey: string;
  expiryLabel: string;
  openInterest: number;
  volumeUsd: number;
  markIv: number | null;
  underlyingPrice: number | null;
}

const monthIndex: Record<string, number> = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11
};

function toNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function safeRatio(numerator: number, denominator: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return numerator / denominator;
}

function expiryLabel(raw: string) {
  const match = /^(\d{1,2})([A-Z]{3})(\d{2})$/.exec(raw);
  if (!match) return raw;
  const day = Number(match[1]);
  const month = monthIndex[match[2]];
  const year = Number(`20${match[3]}`);
  if (!Number.isFinite(day) || month === undefined || !Number.isFinite(year)) return raw;
  const date = new Date(Date.UTC(year, month, day, 8));
  return `${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일`;
}

function expirySortKey(raw: string) {
  const match = /^(\d{1,2})([A-Z]{3})(\d{2})$/.exec(raw);
  if (!match) return raw;
  const day = Number(match[1]);
  const month = monthIndex[match[2]];
  const year = Number(`20${match[3]}`);
  if (!Number.isFinite(day) || month === undefined || !Number.isFinite(year)) return raw;
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseOptionRow(row: DeribitOptionSummaryRow): ParsedOptionRow | null {
  const parts = String(row.instrument_name ?? "").split("-");
  if (parts.length < 4) return null;
  const optionType = parts[3] === "C" || parts[3] === "P" ? parts[3] : null;
  const strike = toNumber(parts[2]);
  const openInterest = toNumber(row.open_interest) ?? 0;
  if (!optionType || strike === null || strike <= 0 || openInterest <= 0) return null;

  return {
    optionType,
    strike,
    expiryKey: expirySortKey(parts[1]),
    expiryLabel: expiryLabel(parts[1]),
    openInterest,
    volumeUsd: toNumber(row.volume_usd) ?? 0,
    markIv: toNumber(row.mark_iv),
    underlyingPrice: toNumber(row.underlying_price) ?? toNumber(row.estimated_delivery_price)
  };
}

function gradeFor(biasPercent: number, averageMarkIv: number | null): OptionsMarketGrade {
  const ivHeat = averageMarkIv === null ? 0 : Math.max(0, averageMarkIv - 45) * 0.9;
  const score = clamp(Math.abs(biasPercent) * 1.4 + ivHeat);
  if (score >= 70) return "extreme";
  if (score >= 50) return "heated";
  if (score >= 30) return "normal";
  return "calm";
}

function dominantSide(callOpenInterest: number, putOpenInterest: number): OptionsMarketSide {
  const total = callOpenInterest + putOpenInterest;
  if (total <= 0) return "balanced";
  const bias = ((callOpenInterest - putOpenInterest) / total) * 100;
  if (bias >= 8) return "call";
  if (bias <= -8) return "put";
  return "balanced";
}

function sideSummary(side: OptionsMarketSide) {
  if (side === "call") return "콜 우세";
  if (side === "put") return "풋 우세";
  return "콜/풋 균형";
}

function triggerFor(activeExpiry: OptionsMarketExpiry | null, topStrike: OptionsMarketStrike | null) {
  if (activeExpiry) return `${activeExpiry.label} 만기 집중`;
  if (topStrike) return `${Math.round(topStrike.strike).toLocaleString("en-US")} 가격대 집중`;
  return "뚜렷한 집중 구간 없음";
}

export function buildOptionsMarketReport(currency: OptionsCurrency, rows: DeribitOptionSummaryRow[], updatedAt = Date.now()): OptionsMarketReport {
  const parsedRows = rows.map(parseOptionRow).filter((row): row is ParsedOptionRow => row !== null);
  const callRows = parsedRows.filter((row) => row.optionType === "C");
  const putRows = parsedRows.filter((row) => row.optionType === "P");

  const callOpenInterest = callRows.reduce((sum, row) => sum + row.openInterest, 0);
  const putOpenInterest = putRows.reduce((sum, row) => sum + row.openInterest, 0);
  const totalOpenInterest = callOpenInterest + putOpenInterest;
  const callVolumeUsd = callRows.reduce((sum, row) => sum + row.volumeUsd, 0);
  const putVolumeUsd = putRows.reduce((sum, row) => sum + row.volumeUsd, 0);
  const biasPercent = totalOpenInterest > 0 ? ((callOpenInterest - putOpenInterest) / totalOpenInterest) * 100 : 0;

  const ivRows = parsedRows.filter((row) => row.markIv !== null);
  const ivWeight = ivRows.reduce((sum, row) => sum + row.openInterest, 0);
  const weightedIv = ivWeight > 0 ? ivRows.reduce((sum, row) => sum + Number(row.markIv) * row.openInterest, 0) / ivWeight : null;
  const fallbackIv = ivRows.length ? ivRows.reduce((sum, row) => sum + Number(row.markIv), 0) / ivRows.length : null;
  const averageMarkIv = weightedIv ?? fallbackIv;

  const expiryMap = new Map<string, OptionsMarketExpiry>();
  const strikeMap = new Map<number, OptionsMarketStrike>();

  for (const row of parsedRows) {
    const expiry = expiryMap.get(row.expiryKey) ?? {
      label: row.expiryLabel,
      totalOpenInterest: 0,
      callOpenInterest: 0,
      putOpenInterest: 0
    };
    expiry.totalOpenInterest += row.openInterest;
    if (row.optionType === "C") expiry.callOpenInterest += row.openInterest;
    else expiry.putOpenInterest += row.openInterest;
    expiryMap.set(row.expiryKey, expiry);

    const strike = strikeMap.get(row.strike) ?? {
      strike: row.strike,
      totalOpenInterest: 0,
      callOpenInterest: 0,
      putOpenInterest: 0
    };
    strike.totalOpenInterest += row.openInterest;
    if (row.optionType === "C") strike.callOpenInterest += row.openInterest;
    else strike.putOpenInterest += row.openInterest;
    strikeMap.set(row.strike, strike);
  }

  const activeExpiry = Array.from(expiryMap.values()).sort((a, b) => b.totalOpenInterest - a.totalOpenInterest)[0] ?? null;
  const topStrike = Array.from(strikeMap.values()).sort((a, b) => b.totalOpenInterest - a.totalOpenInterest)[0] ?? null;
  const side = dominantSide(callOpenInterest, putOpenInterest);
  const grade = gradeFor(biasPercent, averageMarkIv);
  const underlyingPrice = parsedRows.find((row) => row.underlyingPrice !== null)?.underlyingPrice ?? null;
  const ivText = averageMarkIv === null ? "IV 확인 중" : `IV ${averageMarkIv.toFixed(0)}%`;

  return {
    currency,
    underlyingPrice,
    totalOpenInterest,
    callOpenInterest,
    putOpenInterest,
    callPutOpenInterestRatio: safeRatio(callOpenInterest, putOpenInterest),
    callVolumeUsd,
    putVolumeUsd,
    callPutVolumeRatio: safeRatio(callVolumeUsd, putVolumeUsd),
    averageMarkIv,
    dominantSide: side,
    grade,
    biasPercent,
    summary: `${sideSummary(side)} · ${ivText}`,
    trigger: triggerFor(activeExpiry, topStrike),
    activeExpiry,
    topStrike,
    updatedAt,
    source: "deribit"
  };
}
