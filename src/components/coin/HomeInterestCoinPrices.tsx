"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, RefreshCw, Settings2 } from "lucide-react";
import { hasMarketEntitlement } from "@/lib/billing";
import {
  basicHomeInterestChangeStatus,
  defaultHomeInterestCoin,
  homeInterestMaxBasic,
  homeInterestMaxPro,
  readHomeInterestCoins,
  recordBasicHomeInterestChange,
  sameHomeCoin,
  writeHomeInterestCoins,
  type HomeInterestCoin
} from "@/lib/homeInterestCoins";
import type { CryptoExchangeId, CryptoExchangeMarket, CryptoHomeTicker } from "@/lib/server/cryptoExchangeData";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

const exchangeOptions: Array<{ id: CryptoExchangeId; label: string }> = [
  { id: "binance", label: "Binance" },
  { id: "okx", label: "OKX" },
  { id: "bingx", label: "BingX" },
  { id: "bitget", label: "Bitget" },
  { id: "gateio", label: "Gate.io" },
  { id: "bybit", label: "Bybit" }
];

function coinKey(coin: Pick<HomeInterestCoin, "exchangeId" | "symbol">) {
  return `${coin.exchangeId}:${coin.symbol}`;
}

function priceCopy(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "가격 확인 중";
  const digits = value >= 100 ? 2 : value >= 10 ? 3 : value >= 1 ? 4 : 6;
  return `$${value.toLocaleString("ko-KR", { maximumFractionDigits: digits })}`;
}

function changeCopy(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "24시간 변동 확인 중";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function HomeInterestCoinPrices() {
  const { profile } = useSupabaseAuth();
  const isPaid = hasMarketEntitlement(profile?.plan, "crypto");
  const limit = isPaid ? homeInterestMaxPro : homeInterestMaxBasic;
  const [coins, setCoins] = useState<HomeInterestCoin[]>([defaultHomeInterestCoin]);
  const [tickers, setTickers] = useState<Record<string, CryptoHomeTicker>>({});
  const [priceError, setPriceError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [exchangeId, setExchangeId] = useState<CryptoExchangeId>("binance");
  const [markets, setMarkets] = useState<CryptoExchangeMarket[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
  const priceGeneration = useRef(0);

  useEffect(() => {
    setCoins(readHomeInterestCoins(isPaid));
  }, [isPaid]);

  const loadPrices = useCallback(async (signal?: AbortSignal) => {
    const generation = ++priceGeneration.current;
    const results = await Promise.allSettled(coins.map(async (coin) => {
      const params = new URLSearchParams({ exchange: coin.exchangeId, symbol: coin.symbol });
      const response = await fetch(`/api/crypto-home-ticker?${params.toString()}`, { cache: "no-store", signal });
      const payload = (await response.json().catch(() => ({}))) as { ticker?: CryptoHomeTicker; error?: string };
      if (!response.ok || !payload.ticker) throw new Error(payload.error ?? `${coin.base} 시세를 불러오지 못했습니다.`);
      return [coinKey(coin), payload.ticker] as const;
    }));
    if (signal?.aborted || generation !== priceGeneration.current) return;
    const next = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    if (next.length) setTickers((current) => ({ ...current, ...Object.fromEntries(next) }));
    setPriceError(next.length === coins.length ? null : "일부 관심코인 시세 갱신이 지연되고 있습니다.");
  }, [coins]);

  useEffect(() => {
    const controller = new AbortController();
    void loadPrices(controller.signal);
    const timer = window.setInterval(() => void loadPrices(controller.signal), 15_000);
    return () => {
      priceGeneration.current += 1;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [loadPrices]);

  useEffect(() => {
    if (!editorOpen) return;
    const controller = new AbortController();
    setMarketLoading(true);
    setMarketError(null);
    fetch(`/api/crypto-exchange-markets?exchange=${exchangeId}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as { markets?: CryptoExchangeMarket[]; error?: string };
        if (!response.ok || !payload.markets) throw new Error(payload.error ?? "관심코인 목록을 불러오지 못했습니다.");
        setMarkets(payload.markets);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setMarketError(error instanceof Error ? error.message : "관심코인 목록을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setMarketLoading(false);
      });
    return () => controller.abort();
  }, [editorOpen, exchangeId]);

  const visibleMarkets = useMemo(() => {
    const normalized = query.trim().toUpperCase();
    return markets
      .filter((market) => !normalized || market.base.toUpperCase().includes(normalized) || market.symbol.toUpperCase().includes(normalized))
      .slice(0, 30);
  }, [markets, query]);

  const chooseMarket = useCallback((market: CryptoExchangeMarket) => {
    const alreadySelected = coins.some((coin) => sameHomeCoin(coin, market));
    let next: HomeInterestCoin[];
    if (isPaid) {
      if (alreadySelected) {
        if (coins.length === 1) {
          setSelectionMessage("관심코인은 1개 이상 유지해 주세요.");
          return;
        }
        next = coins.filter((coin) => !sameHomeCoin(coin, market));
      } else {
        if (coins.length >= limit) {
          setSelectionMessage(`Coin Pro는 관심 시세를 최대 ${limit}개까지 저장할 수 있습니다.`);
          return;
        }
        next = [...coins, market];
      }
    } else {
      if (alreadySelected) return;
      const change = basicHomeInterestChangeStatus();
      if (change.used) {
        setSelectionMessage("Basic 관심코인은 하루 1회 변경할 수 있습니다.");
        return;
      }
      recordBasicHomeInterestChange();
      next = [market];
    }
    const saved = writeHomeInterestCoins(next, isPaid);
    setCoins(saved);
    setSelectionMessage("관심 시세 목록을 저장했습니다.");
  }, [coins, isPaid, limit]);

  return (
    <section className="space-y-3 pb-3" aria-label="관심코인 시세 목록">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {coins.map((coin) => {
          const ticker = tickers[coinKey(coin)];
          const change = ticker?.changePercent;
          const base = coin.base.toLowerCase();
          const isMajor = base === "btc" || base === "eth";
          const analysisHref = isMajor
            ? `/crypto/perpetual?asset=${base}&source=home-interest`
            : `/crypto/perpetual/alts?focus=${encodeURIComponent(base)}&source=home`;
          const changeTone = typeof change === "number" && change > 0
            ? "text-ui-long"
            : typeof change === "number" && change < 0
              ? "text-ui-short"
              : "text-ui-muted";
          return (
            <article key={coinKey(coin)} className="bg-ui-inset/55 px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black text-ui-text">{coin.base.toUpperCase()}/{coin.quote.toUpperCase()}</p>
                <span className="text-[10px] font-semibold text-ui-subtle">{coin.exchangeLabel}</span>
              </div>
              <div className="mt-1 flex items-end justify-between gap-2">
                <p className="text-base font-black tabular-nums text-ui-text">{priceCopy(ticker?.price)}</p>
                <p className={`text-xs font-black tabular-nums ${changeTone}`}>{changeCopy(change)}</p>
              </div>
              <Link href={analysisHref} className="mt-2 inline-flex text-[10.5px] font-black text-ui-brand underline underline-offset-2">
                {isMajor ? "BTC·ETH 선물 분석에서 확인" : "알트 선물 분석에서 확인"}
              </Link>
            </article>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] leading-5 text-ui-muted">
        <span>시장 관찰용 공개 시세이며 선물 판단 근거에는 사용하지 않습니다.</span>
        <button type="button" onClick={() => void loadPrices()} className="inline-flex items-center gap-1 font-black text-ui-brand">
          <RefreshCw size={12} aria-hidden /> 시세 새로고침
        </button>
      </div>
      {priceError ? <p role="status" className="text-xs font-semibold text-ui-watch">{priceError}</p> : null}

      <details className="border-t border-ui-line pt-2" onToggle={(event) => setEditorOpen(event.currentTarget.open)}>
        <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 text-xs font-black text-ui-muted marker:hidden [&::-webkit-details-marker]:hidden">
          <Settings2 size={14} aria-hidden /> 관심 시세 변경 · {coins.length}/{limit}
        </summary>
        <div className="mt-2 space-y-3">
          <div className="flex gap-1 overflow-x-auto pb-1" role="group" aria-label="관심 시세 거래소">
            {exchangeOptions.map((exchange) => (
              <button
                key={exchange.id}
                type="button"
                aria-pressed={exchangeId === exchange.id}
                onClick={() => setExchangeId(exchange.id)}
                className={`min-h-9 shrink-0 rounded-ui-sm px-3 text-xs font-black ${exchangeId === exchange.id ? "bg-ui-brand text-white" : "bg-ui-inset text-ui-muted"}`}
              >
                {exchange.label}
              </button>
            ))}
          </div>
          <label className="block text-xs font-bold text-ui-muted">
            종목 검색
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="BTC, ETH, SOL"
              className="mt-1 min-h-10 w-full rounded-ui-sm bg-ui-inset px-3 text-sm text-ui-text outline-none ring-ui-brand focus:ring-1"
            />
          </label>
          {marketLoading ? <p className="inline-flex items-center gap-2 text-xs text-ui-muted"><Loader2 size={14} className="animate-spin" aria-hidden /> 종목을 불러오는 중입니다.</p> : null}
          {marketError ? <p role="alert" className="text-xs font-semibold text-ui-risk">{marketError}</p> : null}
          {!marketLoading && !marketError ? (
            <div className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
              {visibleMarkets.map((market) => {
                const selected = coins.some((coin) => sameHomeCoin(coin, market));
                return (
                  <button
                    key={coinKey(market)}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => chooseMarket(market)}
                    className="flex min-h-10 items-center justify-between gap-2 bg-ui-inset/55 px-3 text-left text-xs font-bold text-ui-text"
                  >
                    <span>{market.base}/{market.quote}</span>
                    {selected ? <Check size={14} className="text-ui-long" aria-label="선택됨" /> : <span className="text-ui-subtle">추가</span>}
                  </button>
                );
              })}
            </div>
          ) : null}
          {selectionMessage ? <p role="status" className="text-xs font-semibold text-ui-muted">{selectionMessage}</p> : null}
        </div>
      </details>
    </section>
  );
}
