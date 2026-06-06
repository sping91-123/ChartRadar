export type StablecoinLiquidityGrade = "drying" | "flat" | "building" | "strong";

export interface DefiLlamaStablecoinChartRow {
  date?: number | string;
  totalCirculatingUSD?: Record<string, number | string | null | undefined>;
  totalCirculating?: Record<string, number | string | null | undefined>;
}

export interface StablecoinLiquidityReport {
  totalUsd: number;
  change1dUsd: number | null;
  change7dUsd: number | null;
  change30dUsd: number | null;
  change1dPercent: number | null;
  change7dPercent: number | null;
  change30dPercent: number | null;
  grade: StablecoinLiquidityGrade;
  flowScore: number;
  summary: string;
  trigger: string;
  latestDataAt: string | null;
  updatedAt: number;
  source: "defillama-stablecoins";
}

interface LiquidityPoint {
  time: number;
  totalUsd: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function totalUsdFromRow(row: DefiLlamaStablecoinChartRow) {
  const usdTotals = row.totalCirculatingUSD;
  const peggedUsd = toNumber(usdTotals?.peggedUSD);
  if (peggedUsd !== null && peggedUsd > 0) return peggedUsd;

  if (usdTotals) {
    const total = Object.values(usdTotals).reduce<number>((sum, value) => sum + (toNumber(value) ?? 0), 0);
    if (total > 0) return total;
  }

  const circulatingUsd = toNumber(row.totalCirculating?.peggedUSD);
  return circulatingUsd !== null && circulatingUsd > 0 ? circulatingUsd : null;
}

function timeFromRow(row: DefiLlamaStablecoinChartRow) {
  const raw = toNumber(row.date);
  if (raw === null || raw <= 0) return null;
  const time = raw > 1_000_000_000_000 ? raw : raw * 1000;
  return Number.isFinite(time) ? time : null;
}

function percentChange(current: number, base: number | null) {
  if (base === null || base <= 0) return null;
  return ((current - base) / base) * 100;
}

function usdChange(current: number, base: number | null) {
  if (base === null) return null;
  return current - base;
}

function pointAtOrBefore(points: LiquidityPoint[], targetTime: number) {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index].time <= targetTime) return points[index];
  }
  return null;
}

function formatUsd(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000_000) return `${sign}$${(abs / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(0)}M`;
  return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function gradeFor(change7dPercent: number | null, change30dPercent: number | null): StablecoinLiquidityGrade {
  const seven = change7dPercent ?? 0;
  const thirty = change30dPercent ?? 0;
  if (seven <= -1 || thirty <= -2) return "drying";
  if (seven >= 1 || thirty >= 3) return "strong";
  if (seven >= 0.2 || thirty >= 1) return "building";
  return "flat";
}

function flowScoreFor(change7dPercent: number | null, change30dPercent: number | null) {
  const seven = change7dPercent ?? 0;
  const thirty = change30dPercent ?? 0;
  return Math.round(clamp(50 + seven * 9 + thirty * 2.5));
}

function triggerFor(grade: StablecoinLiquidityGrade, change7dUsd: number | null, change30dUsd: number | null) {
  if (grade === "strong") return "유동성 유입";
  if (grade === "building") return "유입 우세";
  if (grade === "drying") return "유동성 유출";
  if ((change7dUsd ?? 0) > 0 || (change30dUsd ?? 0) > 0) return "소폭 유입";
  return "큰 변화 없음";
}

export function buildStablecoinLiquidityReport(rows: DefiLlamaStablecoinChartRow[], updatedAt = Date.now()): StablecoinLiquidityReport {
  const points = rows
    .map((row) => {
      const time = timeFromRow(row);
      const totalUsd = totalUsdFromRow(row);
      return time !== null && totalUsd !== null ? { time, totalUsd } : null;
    })
    .filter((point): point is LiquidityPoint => point !== null)
    .sort((a, b) => a.time - b.time);

  if (points.length === 0) {
    throw new Error("Stablecoin liquidity data unavailable");
  }

  const latest = points[points.length - 1];
  const oneDay = pointAtOrBefore(points, latest.time - DAY_MS);
  const sevenDay = pointAtOrBefore(points, latest.time - 7 * DAY_MS);
  const thirtyDay = pointAtOrBefore(points, latest.time - 30 * DAY_MS);

  const change1dUsd = usdChange(latest.totalUsd, oneDay?.totalUsd ?? null);
  const change7dUsd = usdChange(latest.totalUsd, sevenDay?.totalUsd ?? null);
  const change30dUsd = usdChange(latest.totalUsd, thirtyDay?.totalUsd ?? null);
  const change1dPercent = percentChange(latest.totalUsd, oneDay?.totalUsd ?? null);
  const change7dPercent = percentChange(latest.totalUsd, sevenDay?.totalUsd ?? null);
  const change30dPercent = percentChange(latest.totalUsd, thirtyDay?.totalUsd ?? null);
  const grade = gradeFor(change7dPercent, change30dPercent);

  return {
    totalUsd: latest.totalUsd,
    change1dUsd,
    change7dUsd,
    change30dUsd,
    change1dPercent,
    change7dPercent,
    change30dPercent,
    grade,
    flowScore: flowScoreFor(change7dPercent, change30dPercent),
    summary: `달러 스테이블 ${formatUsd(latest.totalUsd)} · 7일 ${formatPercent(change7dPercent)}`,
    trigger: triggerFor(grade, change7dUsd, change30dUsd),
    latestDataAt: new Date(latest.time).toISOString(),
    updatedAt,
    source: "defillama-stablecoins"
  };
}
