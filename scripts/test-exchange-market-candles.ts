import assert from "node:assert/strict";
import {
  ExchangeMarketDataError,
  fetchExchangeTradeQualityCandles,
  normalizeExchangeTradeMarketSymbol,
  parseExchangeTradeCandlePayload
} from "../src/lib/server/exchanges/marketCandles";

const row = ["1700000000000", "100", "110", "90", "105", "12"];

assert.deepEqual(
  parseExchangeTradeCandlePayload("okx", {
    code: "0",
    data: [
      [...row, "0", "0", "1"],
      ["1700000060000", "105", "115", "100", "110", "10", "0", "0", "0"]
    ]
  }).map((candle) => candle.openTimeMs),
  [1700000000000],
  "OKX parser must exclude unconfirmed candles"
);

assert.equal(
  parseExchangeTradeCandlePayload("bybit", {
    retCode: 0,
    result: { list: [row] }
  })[0]?.close,
  105
);

assert.equal(
  parseExchangeTradeCandlePayload("bitget", {
    code: "00000",
    data: [row]
  })[0]?.volume,
  12
);

assert.equal(
  parseExchangeTradeCandlePayload("bingx", {
    code: 0,
    data: [{
      time: "1700000000000",
      open: "100",
      high: "110",
      low: "90",
      close: "105",
      volume: "12"
    }]
  })[0]?.high,
  110
);

assert.equal(normalizeExchangeTradeMarketSymbol("okx", "BTC/USDT:USDT"), "BTC-USDT-SWAP");
assert.equal(normalizeExchangeTradeMarketSymbol("bybit", "BTC/USDT:USDT"), "BTCUSDT");
assert.equal(normalizeExchangeTradeMarketSymbol("bitget", "ETHUSDT"), "ETHUSDT");
assert.equal(normalizeExchangeTradeMarketSymbol("bingx", "SOL/USDT:USDT"), "SOL-USDT");

assert.throws(
  () => parseExchangeTradeCandlePayload("bybit", { retCode: 10001, result: {} }),
  (error) => error instanceof ExchangeMarketDataError && error.code === "response_invalid"
);
for (const [provider, payload] of [
  ["okx", { code: "50011", data: [] }],
  ["bybit", { retCode: 10006, result: { list: [] } }],
  ["bingx", { code: 100410, data: [] }]
] as const) {
  assert.throws(
    () => parseExchangeTradeCandlePayload(provider, payload),
    (error) => error instanceof ExchangeMarketDataError && error.code === "rate_limited"
  );
}
assert.throws(
  () => normalizeExchangeTradeMarketSymbol("okx", "BTC/USD"),
  (error) => error instanceof ExchangeMarketDataError && error.code === "response_invalid"
);

async function runFetchFixtures() {
  const originalFetch = globalThis.fetch;
  try {
  const fourHours = 4 * 60 * 60_000;
  const openedAtMs = Date.UTC(2026, 3, 10, 0, 0, 0);
  const closedAtMs = Date.UTC(2026, 3, 20, 0, 0, 0);
  const nowMs = Date.UTC(2026, 3, 25, 0, 0, 0);
  const historyStart = openedAtMs - 320 * fourHours;
  const historyEnd = closedAtMs + 6 * fourHours;
  const allRows: string[][] = [];
  for (let timestamp = historyStart; timestamp < historyEnd; timestamp += fourHours) {
    allRows.push([
      String(timestamp),
      "100",
      "102",
      "99",
      "101",
      "10",
      "1000"
    ]);
  }
  const requestedUrls: string[] = [];
  globalThis.fetch = (async (input) => {
    const url = new URL(String(input));
    requestedUrls.push(url.toString());
    const endTime = Number(url.searchParams.get("endTime"));
    const page = allRows.filter((item) => Number(item[0]) < endTime).slice(-200);
    return new Response(JSON.stringify({ code: "00000", data: page }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
  const bitgetHistory = await fetchExchangeTradeQualityCandles({
    provider: "bitget",
    symbol: "BTC/USDT:USDT",
    openedAt: new Date(openedAtMs).toISOString(),
    closedAt: new Date(closedAtMs).toISOString(),
    nowMs
  });
  assert.ok(requestedUrls.length >= 2, "Bitget history must paginate beyond 200 candles");
  assert.ok(requestedUrls.every((url) => url.includes("/api/v2/mix/market/history-candles")));
  assert.ok(requestedUrls.every((url) => url.includes("limit=200")));
  assert.equal(bitgetHistory.coverage.ratio, 1);
  assert.equal(bitgetHistory.coverage.maxGapBars, 0);

  const minute = 60_000;
  const shortOpenedAt = Date.UTC(2026, 4, 1, 12, 0, 30);
  const shortClosedAt = shortOpenedAt + 10 * minute;
  const shortNow = shortClosedAt + 10 * minute;
  globalThis.fetch = (async (input) => {
    const url = new URL(String(input));
    const start = Number(url.searchParams.get("start"));
    const end = Number(url.searchParams.get("end"));
    const rows: string[][] = [];
    for (let timestamp = start + 5 * minute; timestamp < end; timestamp += minute) {
      rows.push([String(timestamp), "100", "101", "99", "100.5", "10"]);
    }
    return new Response(JSON.stringify({ retCode: 0, result: { list: rows.reverse() } }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
  const boundaryGap = await fetchExchangeTradeQualityCandles({
    provider: "bybit",
    symbol: "BTC/USDT:USDT",
    openedAt: new Date(shortOpenedAt).toISOString(),
    closedAt: new Date(shortClosedAt).toISOString(),
    nowMs: shortNow
  });
  assert.ok(boundaryGap.coverage.maxGapBars >= 5, "leading and trailing gaps must affect maxGapBars");
  assert.ok(boundaryGap.warnings.includes("market_candle_large_gap"));
  const pendingPostExit = await fetchExchangeTradeQualityCandles({
    provider: "bybit",
    symbol: "BTC/USDT:USDT",
    openedAt: new Date(shortOpenedAt).toISOString(),
    closedAt: new Date(shortClosedAt).toISOString(),
    nowMs: shortClosedAt + 2 * minute
  });
  assert.equal(pendingPostExit.postExitPending, true);
  assert.ok(pendingPostExit.postExitReadyAt);
  assert.ok(pendingPostExit.warnings.includes("post_exit_pending"));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

runFetchFixtures()
  .then(() => {
    console.log("Exchange market candle parsing, rate-limit, pagination, and coverage fixtures passed.");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
