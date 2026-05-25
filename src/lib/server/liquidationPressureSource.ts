// 서버에서 Binance 공개 데이터를 읽어 청산 압력 리포트를 만드는 공통 소스입니다.
import { buildLiquidationPressureReport, type LiquidationPressureReport, type LongShortSnapshot, type TakerFlowSnapshot } from "@/lib/liquidationPressure";

const FETCH_TIMEOUT_MS = 4500;
const BINANCE_FAPI = "https://fapi.binance.com";
const BINANCE_SPOT_DATA_API = "https://data-api.binance.vision";

interface PremiumIndexPayload {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
}

interface OpenInterestHistRow {
  symbol: string;
  sumOpenInterest: string;
  sumOpenInterestValue: string;
  timestamp: number;
}

interface LongShortRow {
  symbol: string;
  longAccount: string;
  shortAccount: string;
  longShortRatio: string;
  timestamp: number;
}

interface TakerLongShortRow {
  buySellRatio: string;
  buyVol: string;
  sellVol: string;
  timestamp: number;
}

type KlineRow = [
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
];

function toNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function unwrapRows<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { value?: unknown }).value)) {
    return (payload as { value: T[] }).value;
  }
  return [];
}

async function fetchJson<T>(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Binance ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function parseLongShort(row: LongShortRow | null): LongShortSnapshot {
  if (!row) return { longPercent: null, shortPercent: null, ratio: null };
  const long = toNumber(row.longAccount);
  const short = toNumber(row.shortAccount);

  return {
    longPercent: long === null ? null : long * 100,
    shortPercent: short === null ? null : short * 100,
    ratio: toNumber(row.longShortRatio)
  };
}

function parseTakerFlow(row: TakerLongShortRow | null): TakerFlowSnapshot {
  if (!row) return { buyVolume: null, sellVolume: null, buyPercent: null, sellPercent: null };
  const buyVolume = toNumber(row.buyVol);
  const sellVolume = toNumber(row.sellVol);
  const total = (buyVolume ?? 0) + (sellVolume ?? 0);

  return {
    buyVolume,
    sellVolume,
    buyPercent: total > 0 && buyVolume !== null ? (buyVolume / total) * 100 : null,
    sellPercent: total > 0 && sellVolume !== null ? (sellVolume / total) * 100 : null
  };
}

function openInterestChange(rows: OpenInterestHistRow[]) {
  const sortedRows = rows
    .filter((row) => Number.isFinite(Number(row.timestamp)))
    .sort((a, b) => a.timestamp - b.timestamp);
  if (sortedRows.length < 2) return { value: null as number | null, changePercent: null as number | null };

  const firstRow = sortedRows[0];
  const lastRow = sortedRows[sortedRows.length - 1];
  const firstContracts = toNumber(firstRow?.sumOpenInterest);
  const lastContracts = toNumber(lastRow?.sumOpenInterest);
  const firstValue = toNumber(firstRow?.sumOpenInterestValue);
  const lastValue = toNumber(lastRow?.sumOpenInterestValue);
  const first = firstContracts ?? firstValue;
  const last = lastContracts ?? lastValue;
  if (!first || first <= 0 || last === null) return { value: lastValue, changePercent: null };

  return {
    value: lastValue,
    changePercent: ((last - first) / first) * 100
  };
}

function settledValue<T>(result: PromiseSettledResult<T>, label: string) {
  if (result.status === "fulfilled") return result.value;
  console.warn(`[liquidation-pressure-source] optional Binance source failed: ${label}`, result.reason);
  return null;
}

function latestClose(rows: unknown) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const last = rows[rows.length - 1] as Partial<KlineRow>;
  return toNumber(last[4]);
}

async function fetchFallbackMarkPrice(symbol: string, period: string) {
  const params = new URLSearchParams({
    symbol,
    interval: period,
    limit: "2"
  });
  const endpoints = [
    `${BINANCE_FAPI}/fapi/v1/klines?${params.toString()}`,
    `${BINANCE_SPOT_DATA_API}/api/v3/klines?${params.toString()}`
  ];

  for (const endpoint of endpoints) {
    try {
      const close = latestClose(await fetchJson<KlineRow[]>(endpoint));
      if (close !== null && close > 0) return close;
    } catch (error) {
      console.warn("[liquidation-pressure-source] fallback mark source failed:", error);
    }
  }

  return null;
}

export async function fetchLiquidationPressureReport(symbol: string, period: string): Promise<LiquidationPressureReport> {
  const [
    premiumIndexResult,
    openInterestResult,
    globalLongShortResult,
    topAccountResult,
    topPositionResult,
    takerResult
  ] = await Promise.allSettled([
    fetchJson<PremiumIndexPayload>(`${BINANCE_FAPI}/fapi/v1/premiumIndex?symbol=${symbol}`),
    fetchJson<OpenInterestHistRow[]>(`${BINANCE_FAPI}/futures/data/openInterestHist?symbol=${symbol}&period=${period}&limit=12`),
    fetchJson<LongShortRow[]>(`${BINANCE_FAPI}/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=${period}&limit=1`),
    fetchJson<LongShortRow[]>(`${BINANCE_FAPI}/futures/data/topLongShortAccountRatio?symbol=${symbol}&period=${period}&limit=1`),
    fetchJson<LongShortRow[]>(`${BINANCE_FAPI}/futures/data/topLongShortPositionRatio?symbol=${symbol}&period=${period}&limit=1`),
    fetchJson<TakerLongShortRow[]>(`${BINANCE_FAPI}/futures/data/takerlongshortRatio?symbol=${symbol}&period=${period}&limit=1`)
  ]);

  const premiumIndexPayload = settledValue(premiumIndexResult, "premiumIndex");
  const openInterestPayload = settledValue(openInterestResult, "openInterestHist");
  const globalLongShortPayload = settledValue(globalLongShortResult, "globalLongShortAccountRatio");
  const topAccountPayload = settledValue(topAccountResult, "topLongShortAccountRatio");
  const topPositionPayload = settledValue(topPositionResult, "topLongShortPositionRatio");
  const takerPayload = settledValue(takerResult, "takerlongshortRatio");
  const oi = openInterestChange(unwrapRows<OpenInterestHistRow>(openInterestPayload));
  const premiumMarkPrice = toNumber(premiumIndexPayload?.markPrice);
  const fallbackMarkPrice = premiumMarkPrice === null ? await fetchFallbackMarkPrice(symbol, period) : null;
  const markPrice = premiumMarkPrice ?? fallbackMarkPrice;
  if (markPrice === null || markPrice <= 0) {
    throw new Error("Liquidation pressure mark price unavailable");
  }

  return buildLiquidationPressureReport({
    symbol,
    period,
    markPrice,
    indexPrice: toNumber(premiumIndexPayload?.indexPrice),
    fundingRate: toNumber(premiumIndexPayload?.lastFundingRate),
    nextFundingTime: premiumIndexPayload?.nextFundingTime ?? null,
    openInterestValue: oi.value,
    openInterestChangePercent: oi.changePercent,
    globalLongShort: parseLongShort(unwrapRows<LongShortRow>(globalLongShortPayload)[0] ?? null),
    topAccountLongShort: parseLongShort(unwrapRows<LongShortRow>(topAccountPayload)[0] ?? null),
    topPositionLongShort: parseLongShort(unwrapRows<LongShortRow>(topPositionPayload)[0] ?? null),
    takerFlow: parseTakerFlow(unwrapRows<TakerLongShortRow>(takerPayload)[0] ?? null),
    updatedAt: Date.now()
  });
}
