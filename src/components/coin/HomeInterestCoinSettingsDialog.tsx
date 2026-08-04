"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Check, ChevronRight, Loader2, X } from "lucide-react";
import { ActionButton } from "@/components/ui/DesignPrimitives";
import {
  basicHomeInterestChangeStatus,
  defaultHomeInterestCoin,
  homeInterestMaxBasic,
  homeInterestMaxPro,
  recordBasicHomeInterestChange,
  sameHomeCoin,
  type HomeInterestCoin
} from "@/lib/homeInterestCoins";
import type { CryptoExchangeId, CryptoExchangeMarket } from "@/lib/server/cryptoExchangeData";

type MarketLoadState =
  | { status: "idle"; markets: CryptoExchangeMarket[] }
  | { status: "loading"; markets: CryptoExchangeMarket[] }
  | { status: "ready"; markets: CryptoExchangeMarket[] }
  | { status: "error"; markets: CryptoExchangeMarket[]; message: string };

const exchangeOptions: Array<{ id: CryptoExchangeId; label: string }> = [
  { id: "binance", label: "Binance" },
  { id: "okx", label: "OKX" },
  { id: "bingx", label: "BingX" },
  { id: "bitget", label: "Bitget" },
  { id: "gateio", label: "Gate.io" },
  { id: "bybit", label: "Bybit" }
];

const exchangeLabels = new Map(exchangeOptions.map((item) => [item.id, item.label]));
const focusableSelector = "button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex='-1'])";

function formatNumber(value: number, digits = 0) {
  return value.toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

function formatVolume(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "거래량 확인 중";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  return formatNumber(value);
}

function formatNextChangeAt(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "내일";
  return date.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function marketMatches(market: CryptoExchangeMarket, query: string) {
  const normalized = query.trim().toUpperCase();
  if (!normalized) return true;
  return (
    market.base.toUpperCase().includes(normalized) ||
    market.symbol.toUpperCase().includes(normalized) ||
    market.marketId.toUpperCase().includes(normalized)
  );
}

export function HomeInterestCoinSettingsDialog({
  coins,
  isPaid,
  onSave,
  onClose,
  returnFocusRef
}: {
  coins: HomeInterestCoin[];
  isPaid: boolean;
  onSave: (coins: HomeInterestCoin[]) => void;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
}) {
  const [exchangeId, setExchangeId] = useState<CryptoExchangeId>(coins[0]?.exchangeId ?? "binance");
  const [marketState, setMarketState] = useState<MarketLoadState>({ status: "idle", markets: [] });
  const [query, setQuery] = useState("");
  const [draftCoins, setDraftCoins] = useState<HomeInterestCoin[]>(coins);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const basicStatus = basicHomeInterestChangeStatus();
  const limit = isPaid ? homeInterestMaxPro : homeInterestMaxBasic;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const returnFocusTarget = returnFocusRef?.current;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector));
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const focusTarget = returnFocusTarget ?? previousFocusRef.current;
      window.requestAnimationFrame(() => focusTarget?.focus());
    };
  }, [returnFocusRef]);

  useEffect(() => {
    const controller = new AbortController();
    setMarketState((state) => ({ status: "loading", markets: state.markets }));
    void (async () => {
      try {
        const response = await fetch(`/api/crypto-exchange-markets?exchange=${encodeURIComponent(exchangeId)}`, {
          cache: "no-store",
          signal: controller.signal
        });
        const payload = (await response.json().catch(() => ({}))) as { markets?: CryptoExchangeMarket[]; error?: string };
        if (!response.ok || !Array.isArray(payload.markets)) throw new Error(payload.error ?? "코인 목록을 불러오지 못했습니다.");
        if (!controller.signal.aborted) setMarketState({ status: "ready", markets: payload.markets });
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setMarketState((state) => ({
            status: "error",
            markets: state.markets,
            message: loadError instanceof Error ? loadError.message : "코인 목록을 불러오지 못했습니다."
          }));
        }
      }
    })();
    return () => controller.abort();
  }, [exchangeId]);

  const visibleMarkets = useMemo(() => {
    const trimmedQuery = query.trim();
    return marketState.markets.filter((market) => marketMatches(market, query)).slice(0, trimmedQuery ? 120 : 60);
  }, [marketState.markets, query]);

  const toggleMarket = (market: CryptoExchangeMarket) => {
    setError("");
    const selected = draftCoins.some((coin) => sameHomeCoin(coin, market));
    if (selected) {
      if (draftCoins.length === 1) {
        setError("관심코인을 1개 이상 선택해 주세요.");
        return;
      }
      setDraftCoins(draftCoins.filter((coin) => !sameHomeCoin(coin, market)));
      return;
    }
    if (!isPaid) {
      setDraftCoins([market]);
      return;
    }
    if (draftCoins.length >= limit) {
      setError(`Pro는 관심코인을 최대 ${limit}개까지 설정할 수 있습니다.`);
      return;
    }
    setDraftCoins([...draftCoins, market]);
  };

  const save = () => {
    const normalized = draftCoins.slice(0, limit);
    if (!normalized.length) {
      setError("관심코인을 1개 이상 선택해 주세요.");
      return;
    }
    const changed = !isPaid && !sameHomeCoin(normalized[0], coins[0] ?? defaultHomeInterestCoin);
    const latestBasicStatus = basicHomeInterestChangeStatus();
    if (changed && latestBasicStatus.used) {
      setError(`Basic은 이 기기에서 하루 1회만 변경할 수 있습니다. 다음 변경 가능 시간: ${formatNextChangeAt(latestBasicStatus.nextChangeAt)}`);
      return;
    }
    onSave(normalized);
    if (changed) recordBasicHomeInterestChange();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-3 py-5">
      <div
        ref={dialogRef}
        id="home-interest-settings-dialog"
        data-testid="home-interest-settings-dialog"
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-ui-md bg-ui-panel text-ui-text"
        role="dialog"
        aria-modal="true"
        aria-labelledby="interest-settings-title"
        aria-describedby="interest-settings-description"
      >
        <header className="flex items-start justify-between gap-3 border-b border-ui-line px-4 py-4">
          <div className="min-w-0">
            <p id="interest-settings-title" className="text-base font-black">관심코인 설정</p>
            <p id="interest-settings-description" className="mt-1 text-xs font-semibold text-ui-muted">
              {isPaid ? `Pro는 최대 ${homeInterestMaxPro}개, 변경 제한 없음` : `Basic은 ${homeInterestMaxBasic}개, 이 기기에서 하루 1회 변경`}
            </p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center text-ui-muted transition hover:text-ui-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-brand" aria-label="닫기">
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="overflow-y-auto px-4 py-4">
          <div className="rounded-ui-sm border border-ui-watch/35 bg-ui-watch/10 px-3 py-2.5 text-xs font-black leading-5 text-ui-watch [word-break:keep-all]">
            {isPaid ? "Pro는 관심코인 최대 5개, 변경 제한 없음" : "Basic은 관심코인 1개, 이 기기에서 하루 1회 변경"}
          </div>
          <div className="mt-2 rounded-ui-sm bg-ui-inset/40 px-3 py-2 text-xs font-semibold leading-5 text-ui-muted [word-break:keep-all]">
            거래량이 낮거나 파생 데이터가 부족한 거래소·종목은 분석 정확도가 떨어질 수 있습니다.
          </div>

          <div className="mt-4 grid grid-cols-3 gap-1 sm:grid-cols-6" role="group" aria-label="거래소 선택">
            {exchangeOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={exchangeId === option.id}
                onClick={() => setExchangeId(option.id)}
                className={`min-h-10 rounded-ui-sm px-2 text-xs font-black transition ${exchangeId === option.id ? "bg-ui-brand text-white" : "bg-ui-elevated text-ui-muted hover:bg-ui-inset hover:text-ui-text"}`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <label className="mt-4 block">
            <span className="text-xs font-black text-ui-subtle">코인 검색</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="mt-1 h-11 w-full rounded-ui-sm border border-ui-line bg-ui-inset px-3 text-sm font-semibold text-ui-text outline-none placeholder:text-ui-subtle focus:border-ui-brand"
              placeholder="BTC, ETH, SOL..."
            />
          </label>
          <p className="mt-2 text-xs font-semibold leading-5 text-ui-muted [word-break:keep-all]">기본 목록은 거래량 높은 순으로 일부만 보여줍니다. 목록에 없으면 검색하세요.</p>

          <div className="mt-3">
            <p className="text-xs font-black text-ui-subtle">현재 관심코인</p>
            <div className="mt-1 flex min-w-0 flex-wrap gap-1">
              {draftCoins.map((coin) => (
                <span key={`${coin.exchangeId}:${coin.symbol}`} className="inline-flex min-h-8 items-center gap-1 rounded-ui-sm bg-ui-brand/15 px-2.5 text-xs font-black text-ui-text">
                  {coin.exchangeLabel} {coin.base}/{coin.quote}
                </span>
              ))}
            </div>
          </div>

          {marketState.status === "error" ? <p className="mt-3 text-sm font-semibold text-ui-risk" role="alert">{marketState.message}</p> : null}
          {error ? <p className="mt-3 text-sm font-semibold text-ui-risk" role="alert">{error}</p> : null}

          <div className="mt-4 max-h-[42dvh] divide-y divide-ui-line overflow-y-auto rounded-ui-sm bg-ui-inset/25">
            {marketState.status === "loading" && !visibleMarkets.length ? (
              <div className="flex min-h-24 items-center justify-center gap-2 text-sm font-semibold text-ui-muted" role="status">
                <Loader2 className="animate-spin" size={16} aria-hidden />
                {exchangeLabels.get(exchangeId)} USDT 선물 목록 확인 중
              </div>
            ) : null}
            {visibleMarkets.map((market) => {
              const selected = draftCoins.some((coin) => sameHomeCoin(coin, market));
              return (
                <button
                  key={`${market.exchangeId}:${market.symbol}`}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleMarket(market)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 px-3 text-left transition hover:bg-ui-elevated/65"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-ui-text">{market.base}</span>
                    <span className="block truncate text-xs font-semibold text-ui-muted">{market.exchangeLabel} · {market.symbol}</span>
                    <span className="mt-0.5 block text-[11px] font-semibold text-ui-subtle">24h 거래량 {formatVolume(market.quoteVolume)}</span>
                  </span>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-ui-sm ${selected ? "bg-ui-brand text-white" : "bg-ui-elevated text-ui-subtle"}`}>
                    {selected ? <Check size={15} aria-hidden /> : <ChevronRight size={15} aria-hidden />}
                  </span>
                </button>
              );
            })}
            {marketState.status !== "loading" && !visibleMarkets.length ? (
              <div className="flex min-h-24 items-center justify-center text-sm font-semibold text-ui-muted">검색 결과가 없습니다.</div>
            ) : null}
          </div>
        </div>

        <footer className="grid gap-2 border-t border-ui-line px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:grid-cols-[1fr_auto] sm:items-center">
          <p className="text-xs font-semibold text-ui-muted" role="status">
            {isPaid ? `${draftCoins.length}/${homeInterestMaxPro}개 선택` : basicStatus.used ? `오늘 변경 사용 완료 · ${formatNextChangeAt(basicStatus.nextChangeAt)} 이후 가능` : "오늘 1회 변경 가능"}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <ActionButton tone="ghost" onClick={onClose}>취소</ActionButton>
            <ActionButton tone="primary" onClick={save}>저장</ActionButton>
          </div>
        </footer>
      </div>
    </div>
  );
}
