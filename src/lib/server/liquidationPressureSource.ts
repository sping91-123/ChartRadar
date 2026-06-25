// 서버에서 Binance 공개 데이터를 읽어 청산 압력 리포트를 만드는 공통 소스입니다.
import { buildLiquidationPressureReport, type LiquidationPressureReport, type LongShortSnapshot, type TakerFlowSnapshot } from "@/lib/liquidationPressure";

const FETCH_TIMEOUT_MS = 4500;
const BINANCE_FAPI = "https://fapi.binance.com";
const BINANCE_WEB = "https://www.binance.com";
const BINANCE_INFO = "https://www.binance.info";
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

interface FundingRateRow {
  symbol: string;
  fundingTime: number;
  fundingRate: string;
  markPrice?: string;
}

interface SupplementalFundingRate {
  fundingRate: number;
  nextFundingTime: number | null;
  source: string;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unwrapRows<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (isRecord(payload) && Array.isArray(payload.value)) {
    return payload.value as T[];
  }
  if (isRecord(payload) && Array.isArray(payload.data)) {
    return payload.data as T[];
  }
  return [];
}

function unwrapObject<T>(payload: unknown): T | null {
  if (!isRecord(payload)) return null;
  if (isRecord(payload.data)) return payload.data as T;
  if (isRecord(payload.value)) return payload.value as T;
  return payload as T;
}

async function fetchJson<T>(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 ChartRadar/1.0" },
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

async function fetchFirstJson<T>(urls: string[]) {
  let lastError: unknown = null;

  for (const url of urls) {
    try {
      return await fetchJson<T>(url);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Binance data unavailable");
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

function latestFundingRate(rows: FundingRateRow[]) {
  const sortedRows = rows
    .filter((row) => Number.isFinite(Number(row.fundingTime)))
    .sort((a, b) => Number(a.fundingTime) - Number(b.fundingTime));
  return sortedRows[sortedRows.length - 1] ?? rows[0] ?? null;
}

function baseFromUsdtSymbol(symbol: string) {
  return symbol.toUpperCase().replace(/USDT$/, "");
}

async function fetchOkxFundingRate(symbol: string): Promise<SupplementalFundingRate | null> {
  const base = baseFromUsdtSymbol(symbol);
  if (!base || base === symbol) return null;
  const payload = await fetchJson<unknown>(`https://www.okx.com/api/v5/public/funding-rate?instId=${base}-USDT-SWAP`);
  const row = isRecord(payload) && Array.isArray(payload.data) && isRecord(payload.data[0]) ? payload.data[0] : null;
  const fundingRate = toNumber(row?.fundingRate);
  if (fundingRate === null) return null;
  return {
    fundingRate,
    nextFundingTime: toNumber(row?.nextFundingTime ?? row?.fundingTime),
    source: "OKX"
  };
}

async function fetchBybitFundingRate(symbol: string): Promise<SupplementalFundingRate | null> {
  const payload = await fetchJson<unknown>(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`);
  const result = isRecord(payload) && isRecord(payload.result) ? payload.result : null;
  const row = result && Array.isArray(result.list) && isRecord(result.list[0]) ? result.list[0] : null;
  const fundingRate = toNumber(row?.fundingRate);
  if (fundingRate === null) return null;
  return {
    fundingRate,
    nextFundingTime: toNumber(row?.nextFundingTime),
    source: "Bybit"
  };
}

async function fetchBitgetFundingRate(symbol: string): Promise<SupplementalFundingRate | null> {
  const payload = await fetchJson<unknown>(`https://api.bitget.com/api/v2/mix/market/current-fund-rate?symbol=${symbol}&productType=USDT-FUTURES`);
  const row = isRecord(payload) && Array.isArray(payload.data) && isRecord(payload.data[0]) ? payload.data[0] : null;
  const fundingRate = toNumber(row?.fundingRate);
  if (fundingRate === null) return null;
  return {
    fundingRate,
    nextFundingTime: toNumber(row?.nextUpdate),
    source: "Bitget"
  };
}

async function fetchGateFundingRate(symbol: string): Promise<SupplementalFundingRate | null> {
  const base = baseFromUsdtSymbol(symbol);
  if (!base || base === symbol) return null;
  const payload = await fetchJson<unknown>(`https://api.gateio.ws/api/v4/futures/usdt/contracts/${base}_USDT`);
  const row = isRecord(payload) ? payload : null;
  const fundingRate = toNumber(row?.funding_rate ?? row?.funding_rate_indicative);
  if (fundingRate === null) return null;
  const nextApplySeconds = toNumber(row?.funding_next_apply);
  return {
    fundingRate,
    nextFundingTime: nextApplySeconds === null ? null : nextApplySeconds * 1000,
    source: "Gate.io"
  };
}

async function fetchSupplementalFundingRate(symbol: string): Promise<SupplementalFundingRate | null> {
  const results = await Promise.allSettled([
    fetchOkxFundingRate(symbol),
    fetchBybitFundingRate(symbol),
    fetchBitgetFundingRate(symbol),
    fetchGateFundingRate(symbol)
  ]);
  const rows = results
    .map((result) => (result.status === "fulfilled" ? result.value : null))
    .filter((row): row is SupplementalFundingRate => row !== null && Number.isFinite(row.fundingRate));

  if (!rows.length) return null;

  const fundingRate = rows.reduce((sum, row) => sum + row.fundingRate, 0) / rows.length;
  const nextFundingTime = rows.find((row) => row.nextFundingTime !== null)?.nextFundingTime ?? null;
  return {
    fundingRate,
    nextFundingTime,
    source: rows.length === 1 ? `${rows[0].source} 참고값` : "주요 선물시장 참고 평균"
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
  const premiumIndexUrls = [
    `${BINANCE_FAPI}/fapi/v1/premiumIndex?symbol=${symbol}`,
    `${BINANCE_WEB}/fapi/v1/premiumIndex?symbol=${symbol}`,
    `${BINANCE_INFO}/fapi/v1/premiumIndex?symbol=${symbol}`
  ];
  const fundingRateUrls = [
    `${BINANCE_FAPI}/fapi/v1/fundingRate?symbol=${symbol}&limit=1`,
    `${BINANCE_WEB}/fapi/v1/fundingRate?symbol=${symbol}&limit=1`,
    `${BINANCE_INFO}/fapi/v1/fundingRate?symbol=${symbol}&limit=1`
  ];
  const openInterestUrls = [
    `${BINANCE_FAPI}/futures/data/openInterestHist?symbol=${symbol}&period=${period}&limit=12`,
    `${BINANCE_WEB}/futures/data/openInterestHist?symbol=${symbol}&period=${period}&limit=12`,
    `${BINANCE_INFO}/futures/data/openInterestHist?symbol=${symbol}&period=${period}&limit=12`
  ];
  const globalLongShortUrls = [
    `${BINANCE_FAPI}/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=${period}&limit=1`,
    `${BINANCE_WEB}/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=${period}&limit=1`,
    `${BINANCE_INFO}/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=${period}&limit=1`
  ];
  const topAccountUrls = [
    `${BINANCE_FAPI}/futures/data/topLongShortAccountRatio?symbol=${symbol}&period=${period}&limit=1`,
    `${BINANCE_WEB}/futures/data/topLongShortAccountRatio?symbol=${symbol}&period=${period}&limit=1`,
    `${BINANCE_INFO}/futures/data/topLongShortAccountRatio?symbol=${symbol}&period=${period}&limit=1`
  ];
  const topPositionUrls = [
    `${BINANCE_FAPI}/futures/data/topLongShortPositionRatio?symbol=${symbol}&period=${period}&limit=1`,
    `${BINANCE_WEB}/futures/data/topLongShortPositionRatio?symbol=${symbol}&period=${period}&limit=1`,
    `${BINANCE_INFO}/futures/data/topLongShortPositionRatio?symbol=${symbol}&period=${period}&limit=1`
  ];
  const takerUrls = [
    `${BINANCE_FAPI}/futures/data/takerlongshortRatio?symbol=${symbol}&period=${period}&limit=1`,
    `${BINANCE_WEB}/futures/data/takerlongshortRatio?symbol=${symbol}&period=${period}&limit=1`,
    `${BINANCE_INFO}/futures/data/takerlongshortRatio?symbol=${symbol}&period=${period}&limit=1`
  ];
  const [
    premiumIndexResult,
    fundingRateResult,
    openInterestResult,
    globalLongShortResult,
    topAccountResult,
    topPositionResult,
    takerResult
  ] = await Promise.allSettled([
    fetchFirstJson<PremiumIndexPayload>(premiumIndexUrls),
    fetchFirstJson<FundingRateRow[]>(fundingRateUrls),
    fetchFirstJson<OpenInterestHistRow[]>(openInterestUrls),
    fetchFirstJson<LongShortRow[]>(globalLongShortUrls),
    fetchFirstJson<LongShortRow[]>(topAccountUrls),
    fetchFirstJson<LongShortRow[]>(topPositionUrls),
    fetchFirstJson<TakerLongShortRow[]>(takerUrls)
  ]);

  const premiumIndexPayload = unwrapObject<PremiumIndexPayload>(settledValue(premiumIndexResult, "premiumIndex"));
  const fundingRatePayload = settledValue(fundingRateResult, "fundingRate");
  const openInterestPayload = settledValue(openInterestResult, "openInterestHist");
  const globalLongShortPayload = settledValue(globalLongShortResult, "globalLongShortAccountRatio");
  const topAccountPayload = settledValue(topAccountResult, "topLongShortAccountRatio");
  const topPositionPayload = settledValue(topPositionResult, "topLongShortPositionRatio");
  const takerPayload = settledValue(takerResult, "takerlongshortRatio");
  const oi = openInterestChange(unwrapRows<OpenInterestHistRow>(openInterestPayload));
  const latestFunding = latestFundingRate(unwrapRows<FundingRateRow>(fundingRatePayload));
  const premiumMarkPrice = toNumber(premiumIndexPayload?.markPrice);
  const fundingMarkPrice = toNumber(latestFunding?.markPrice);
  const fallbackMarkPrice = premiumMarkPrice === null && fundingMarkPrice === null ? await fetchFallbackMarkPrice(symbol, period) : null;
  const markPrice = premiumMarkPrice ?? fundingMarkPrice ?? fallbackMarkPrice;
  if (markPrice === null || markPrice <= 0) {
    throw new Error("Liquidation pressure mark price unavailable");
  }
  const binanceFundingRate = toNumber(premiumIndexPayload?.lastFundingRate) ?? toNumber(latestFunding?.fundingRate);
  const supplementalFundingRate = binanceFundingRate === null ? await fetchSupplementalFundingRate(symbol) : null;

  return buildLiquidationPressureReport({
    symbol,
    period,
    markPrice,
    indexPrice: toNumber(premiumIndexPayload?.indexPrice),
    fundingRate: binanceFundingRate ?? supplementalFundingRate?.fundingRate ?? null,
    fundingRateSource: binanceFundingRate !== null ? "Binance" : supplementalFundingRate?.source ?? null,
    nextFundingTime: premiumIndexPayload?.nextFundingTime ?? supplementalFundingRate?.nextFundingTime ?? null,
    openInterestValue: oi.value,
    openInterestChangePercent: oi.changePercent,
    globalLongShort: parseLongShort(unwrapRows<LongShortRow>(globalLongShortPayload)[0] ?? null),
    topAccountLongShort: parseLongShort(unwrapRows<LongShortRow>(topAccountPayload)[0] ?? null),
    topPositionLongShort: parseLongShort(unwrapRows<LongShortRow>(topPositionPayload)[0] ?? null),
    takerFlow: parseTakerFlow(unwrapRows<TakerLongShortRow>(takerPayload)[0] ?? null),
    updatedAt: Date.now()
  });
}
