"use client";
// 주요 코인의 상승, 하락, 거래대금 순위를 보여주는 시장 보드 컴포넌트

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, BarChart3, Loader2, RefreshCw } from "lucide-react";

type BoardTab = "gainers" | "losers" | "volume";

interface MarketBoardItem {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  quoteVolume: number;
}

type MarketBoardState =
  | { status: "loading" }
  | { status: "ready"; items: MarketBoardItem[]; cachedAt: number }
  | { status: "error"; message: string };

const boardTabs: Array<{ key: BoardTab; label: string }> = [
  { key: "gainers", label: "상승" },
  { key: "losers", label: "하락" },
  { key: "volume", label: "거래대금" }
];

function formatPrice(price: number) {
  if (!Number.isFinite(price) || price <= 0) return "-";
  let decimals = 2;
  if (price < 0.01) decimals = 6;
  else if (price < 1) decimals = 5;
  else if (price < 10) decimals = 4;
  else if (price < 100) decimals = 3;
  return price.toLocaleString("ko-KR", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function formatVolume(value: number) {
  if (!Number.isFinite(value)) return "-";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  return value.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

function formatCachedAt(ms: number) {
  const min = Math.floor((Date.now() - ms) / 60000);
  if (min < 1) return "방금 갱신";
  if (min < 60) return `${min}분 전 갱신`;
  return `${Math.floor(min / 60)}시간 전 갱신`;
}

function sortBoard(items: MarketBoardItem[], tab: BoardTab) {
  if (tab === "gainers") return [...items].sort((a, b) => b.changePercent - a.changePercent);
  if (tab === "losers") return [...items].sort((a, b) => a.changePercent - b.changePercent);
  return [...items].sort((a, b) => b.quoteVolume - a.quoteVolume);
}

function BoardRow({ item, rank }: { item: MarketBoardItem; rank: number }) {
  const isUp = item.changePercent >= 0;
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="grid grid-cols-[34px_1fr_auto] items-center gap-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2.5">
      <span className="text-xs font-black text-slate-500">#{rank}</span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-black text-white">{item.name}</p>
          <span className="text-xs font-semibold text-slate-500">{formatPrice(item.price)}</span>
        </div>
        <p className="mt-0.5 text-[11px] font-semibold text-slate-500">24h 거래대금 {formatVolume(item.quoteVolume)}</p>
      </div>
      <span
        className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-1 text-xs font-black ${
          isUp
            ? "border-signal-success/30 bg-signal-success/10 text-signal-success"
            : "border-signal-danger/30 bg-signal-danger/10 text-signal-danger"
        }`}
      >
        <Icon size={12} aria-hidden />
        {item.changePercent.toFixed(2)}%
      </span>
    </div>
  );
}

export function MarketBoardPanel() {
  const [tab, setTab] = useState<BoardTab>("gainers");
  const [state, setState] = useState<MarketBoardState>({ status: "loading" });

  const loadBoard = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const response = await fetch("/api/market-board", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as {
        items?: MarketBoardItem[];
        cachedAt?: number;
        error?: string;
      };
      if (!response.ok || !Array.isArray(payload.items)) {
        throw new Error(payload.error ?? "시장 보드를 불러오지 못했습니다.");
      }
      setState({ status: "ready", items: payload.items, cachedAt: payload.cachedAt ?? Date.now() });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "시장 보드를 불러오지 못했습니다." });
    }
  }, []);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  const visibleItems = useMemo(() => {
    if (state.status !== "ready") return [];
    return sortBoard(state.items, tab).slice(0, 5);
  }, [state, tab]);

  return (
    <section className="rounded-lg border border-surface-line bg-surface-card p-4 shadow-glow sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-accent-blue/25 bg-accent-blue/10 text-accent-blue">
            <BarChart3 size={19} aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">시장 보드</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400 [word-break:keep-all]">
              주요 코인의 상승, 하락, 거래대금 변화를 한 번에 확인합니다.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadBoard}
          disabled={state.status === "loading"}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-surface-line bg-surface-cardSoft px-3 text-xs font-bold text-slate-300 hover:border-accent-blue/50 hover:text-white disabled:cursor-wait disabled:opacity-70"
        >
          <RefreshCw size={13} className={state.status === "loading" ? "animate-spin" : ""} aria-hidden />
          갱신
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {boardTabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`min-h-10 rounded-md border px-2 text-sm font-black transition ${
              tab === item.key
                ? "border-accent-blue bg-accent-blue text-slate-950"
                : "border-surface-line bg-surface-cardSoft text-slate-300 hover:border-accent-blue/50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {state.status === "loading" ? (
          <div className="flex min-h-36 items-center justify-center gap-2 rounded-lg border border-surface-line bg-surface-cardSoft text-sm text-slate-400">
            <Loader2 size={16} className="animate-spin text-accent-blue" aria-hidden />
            시장 보드를 불러오는 중입니다.
          </div>
        ) : state.status === "error" ? (
          <div className="rounded-lg border border-signal-danger/30 bg-signal-danger/10 p-4 text-sm text-signal-danger">
            {state.message}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {visibleItems.map((item, index) => (
                <BoardRow key={item.symbol} item={item} rank={index + 1} />
              ))}
            </div>
            <p className="mt-3 text-[11px] font-semibold text-slate-500">{formatCachedAt(state.cachedAt)} · Binance USDT 기준</p>
          </>
        )}
      </div>
    </section>
  );
}
