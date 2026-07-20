// 서버에서 Binance 공개 선물 체결을 읽어 큰 체결 흐름 리포트를 만듭니다.
import { buildLargeTradeFlowReport, type BinanceAggregateTradeRow, type LargeTradeFlowReport } from "@/lib/largeTradeFlow";

const FETCH_TIMEOUT_MS = 4500;
const BINANCE_FAPI = "https://fapi.binance.com";

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

export async function fetchLargeTradeFlowReport(symbol: string): Promise<LargeTradeFlowReport> {
  const params = new URLSearchParams({
    symbol,
    limit: "1000"
  });
  const rows = await fetchJson<BinanceAggregateTradeRow[]>(`${BINANCE_FAPI}/fapi/v1/aggTrades?${params.toString()}`);
  const safeRows = Array.isArray(rows) ? rows : [];
  const latestTradeAt = safeRows.reduce((latest, row) => {
    const timestamp = Number(row.T);
    return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest;
  }, 0);
  return buildLargeTradeFlowReport(symbol, safeRows, latestTradeAt || Date.now());
}
