// 바이낸스 24시간 티커로 코인 시장 보드 데이터를 제공하는 API 라우트.
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 60 * 1000;
const boardSymbols = new Set([
  "BTCUSDT",
  "ETHUSDT",
  "XRPUSDT",
  "SOLUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "LINKUSDT",
  "AVAXUSDT",
  "SUIUSDT",
  "LTCUSDT",
  "DOTUSDT",
  "NEARUSDT",
  "APTUSDT",
  "TRXUSDT",
  "TONUSDT"
]);

interface BinanceTicker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
}

interface MarketBoardItem {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  quoteVolume: number;
}

let cachedAt = 0;
let cachedItems: MarketBoardItem[] = [];

function toItem(ticker: BinanceTicker): MarketBoardItem {
  const name = ticker.symbol.replace("USDT", "");
  return {
    symbol: `${ticker.symbol}.P`,
    name,
    price: Number(ticker.lastPrice),
    changePercent: Number(ticker.priceChangePercent),
    quoteVolume: Number(ticker.quoteVolume)
  };
}

export async function GET(request: Request) {
  const limit = await rateLimit(request, { key: "market-board", limit: 45, windowMs: 5 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "?쒖옣 蹂대뱶 ?붿껌???덈Т 留롮뒿?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄?섏꽭??" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const now = Date.now();
  if (cachedItems.length > 0 && now - cachedAt < CACHE_TTL_MS) {
    return NextResponse.json({ items: cachedItems, cachedAt, cached: true });
  }

  try {
    const response = await fetch("https://fapi.binance.com/fapi/v1/ticker/24hr", {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`Binance ${response.status}`);
    const payload = (await response.json()) as BinanceTicker[];
    const items = payload
      .filter((ticker) => boardSymbols.has(ticker.symbol))
      .map(toItem)
      .filter((item) => Number.isFinite(item.price) && Number.isFinite(item.changePercent) && Number.isFinite(item.quoteVolume));

    cachedItems = items;
    cachedAt = Date.now();
    return NextResponse.json({ items, cachedAt, cached: false });
  } catch (error) {
    console.error("[api/market-board] ?ㅻ쪟:", error);
    if (cachedItems.length > 0) {
      return NextResponse.json({ items: cachedItems, cachedAt, cached: true, stale: true });
    }
    return NextResponse.json({ error: "?쒖옣 蹂대뱶瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??" }, { status: 500 });
  }
}
