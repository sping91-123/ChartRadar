import type { SpotExchange, SpotRadarCategory, SpotRadarItem, SpotRadarPayload, SpotRadarSummary } from "@/lib/spotRadarTypes";

interface MarketPair {
  market: string;
  korean_name?: string;
  english_name?: string;
}

interface SpotTicker {
  market: string;
  trade_price: number;
  signed_change_price: number;
  signed_change_rate: number;
  acc_trade_price_24h: number;
  high_price: number;
  low_price: number;
  timestamp?: number;
}

const exchangeConfig: Record<SpotExchange, { label: string; baseUrl: string }> = {
  upbit: {
    label: "업비트",
    baseUrl: "https://api.upbit.com"
  },
  bithumb: {
    label: "빗썸",
    baseUrl: "https://api.bithumb.com"
  }
};

const CACHE_TTL_MS = 30 * 1000;
const MAX_DISPLAY_ITEMS = 45;
const TICKER_CHUNK_SIZE = 70;

const cache = new Map<SpotExchange, { cachedAt: number; payload: SpotRadarPayload }>();

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function assertArrayPayload<T>(payload: unknown, source: string): T[] {
  if (!Array.isArray(payload)) throw new Error(`${source} payload is not an array`);
  return payload as T[];
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });

  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return (await response.json()) as T;
}

async function fetchMarkets(exchange: SpotExchange) {
  const config = exchangeConfig[exchange];
  const payload = await fetchJson<unknown>(`${config.baseUrl}/v1/market/all`);
  return assertArrayPayload<MarketPair>(payload, `${config.label} market/all`)
    .filter((item) => typeof item.market === "string" && item.market.startsWith("KRW-"))
    .map((item) => ({
      market: item.market,
      koreanName: item.korean_name || item.market.replace("KRW-", ""),
      englishName: item.english_name || item.market.replace("KRW-", "")
    }));
}

async function fetchTickers(exchange: SpotExchange, markets: string[]) {
  const config = exchangeConfig[exchange];
  const tickerPayloads = await Promise.all(
    chunk(markets, TICKER_CHUNK_SIZE).map(async (marketChunk) => {
      const marketsParam = encodeURIComponent(marketChunk.join(","));
      const payload = await fetchJson<unknown>(`${config.baseUrl}/v1/ticker?markets=${marketsParam}`);
      return assertArrayPayload<SpotTicker>(payload, `${config.label} ticker`);
    })
  );

  return tickerPayloads.flat();
}

function rangePosition(ticker: SpotTicker) {
  const range = ticker.high_price - ticker.low_price;
  if (!Number.isFinite(range) || range <= 0) return null;
  return Math.min(1, Math.max(0, (ticker.trade_price - ticker.low_price) / range));
}

function categoryFor(ticker: SpotTicker, volumeRank: number): { category: SpotRadarCategory; label: string; risk: string; check: string } {
  const changePercent = ticker.signed_change_rate * 100;
  const position = rangePosition(ticker);

  if (changePercent >= 9 || (changePercent >= 6 && position !== null && position >= 0.82)) {
    return {
      category: "overheat",
      label: "과열 주의",
      risk: "추격 리스크가 커질 수 있습니다.",
      check: "고점 부근 거래량 유지와 눌림 후 재확인을 봅니다."
    };
  }

  if (volumeRank <= 10 && Math.abs(changePercent) >= 2.5) {
    return {
      category: "volume",
      label: "거래대금 집중",
      risk: "뉴스성 변동이나 단기 쏠림 가능성이 있습니다.",
      check: "거래대금이 유지되는지, 첫 눌림에서 가격이 버티는지 확인합니다."
    };
  }

  if (changePercent >= 4) {
    return {
      category: "gainer",
      label: "상승률 상위",
      risk: "이미 많이 오른 구간이면 변동성이 커질 수 있습니다.",
      check: "직전 고점 돌파 후 지지 전환 여부를 확인합니다."
    };
  }

  if (changePercent >= 1.2 && position !== null && position <= 0.45) {
    return {
      category: "pullback",
      label: "눌림 대기",
      risk: "반등이 약하면 횡보로 길어질 수 있습니다.",
      check: "저점 이탈 없이 거래대금이 다시 붙는지 확인합니다."
    };
  }

  if (changePercent <= -5) {
    return {
      category: "pressure",
      label: "하락 압력",
      risk: "반등보다 추가 변동성 확인이 먼저입니다.",
      check: "저점 갱신이 멈추는지, 거래대금이 줄어드는지 봅니다."
    };
  }

  return {
    category: "watch",
    label: "관망",
    risk: "방향이 아직 뚜렷하지 않습니다.",
    check: "거래대금 확대와 전일 기준선 돌파 여부를 기다립니다."
  };
}

function toSpotItem(exchange: SpotExchange, ticker: SpotTicker, market: Awaited<ReturnType<typeof fetchMarkets>>[number], volumeRank: number): SpotRadarItem | null {
  const price = Number(ticker.trade_price);
  const changePercent = Number(ticker.signed_change_rate) * 100;
  const quoteVolume24h = Number(ticker.acc_trade_price_24h);
  const highPrice = Number(ticker.high_price);
  const lowPrice = Number(ticker.low_price);

  if (![price, changePercent, quoteVolume24h, highPrice, lowPrice].every(Number.isFinite)) return null;

  const category = categoryFor(ticker, volumeRank);

  return {
    exchange,
    market: ticker.market,
    symbol: ticker.market.replace("KRW-", ""),
    koreanName: market.koreanName,
    englishName: market.englishName,
    price,
    changePercent,
    changePrice: Number(ticker.signed_change_price),
    quoteVolume24h,
    highPrice,
    lowPrice,
    rangePosition: rangePosition(ticker),
    category: category.category,
    categoryLabel: category.label,
    risk: category.risk,
    check: category.check,
    updatedAt: new Date(Number(ticker.timestamp ?? Date.now())).toISOString()
  };
}

function buildSummary(exchange: SpotExchange, items: SpotRadarItem[], totalMarkets: number): SpotRadarSummary {
  const leader = items[0];
  const averageChangePercent = items.length > 0 ? items.reduce((sum, item) => sum + item.changePercent, 0) / items.length : 0;

  return {
    exchange,
    exchangeLabel: exchangeConfig[exchange].label,
    totalMarkets,
    displayedMarkets: items.length,
    gainers: items.filter((item) => item.changePercent > 0).length,
    losers: items.filter((item) => item.changePercent < 0).length,
    averageChangePercent,
    leaderSymbol: leader?.symbol ?? "-",
    leaderVolume: leader?.quoteVolume24h ?? 0
  };
}

export async function getSpotRadar(exchange: SpotExchange): Promise<SpotRadarPayload> {
  const now = Date.now();
  const cached = cache.get(exchange);
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return { ...cached.payload, cached: true };
  }

  const markets = await fetchMarkets(exchange);
  const marketMap = new Map(markets.map((item) => [item.market, item]));
  const tickers = await fetchTickers(
    exchange,
    markets.map((item) => item.market)
  );

  const sortedTickers = tickers
    .filter((ticker) => ticker.market.startsWith("KRW-") && Number.isFinite(Number(ticker.acc_trade_price_24h)))
    .sort((a, b) => Number(b.acc_trade_price_24h) - Number(a.acc_trade_price_24h));

  const items = sortedTickers
    .map((ticker, index) => {
      const market = marketMap.get(ticker.market);
      return market ? toSpotItem(exchange, ticker, market, index + 1) : null;
    })
    .filter((item): item is SpotRadarItem => Boolean(item))
    .slice(0, MAX_DISPLAY_ITEMS);

  const payload: SpotRadarPayload = {
    exchange,
    exchangeLabel: exchangeConfig[exchange].label,
    summary: buildSummary(exchange, items, markets.length),
    items,
    cachedAt: Date.now(),
    cached: false
  };

  cache.set(exchange, { cachedAt: payload.cachedAt, payload });
  return payload;
}

export function normalizeSpotExchange(value: string | null): SpotExchange {
  return value === "bithumb" ? "bithumb" : "upbit";
}
