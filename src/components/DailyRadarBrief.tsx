"use client";
// 첫 화면에서 오늘 확인할 코인 시장 흐름과 TOP 감지 후보를 요약한다.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Loader2, Radar, RefreshCw } from "lucide-react";
import type { ScoutSetup } from "@/lib/setupScout";

interface MarketBoardItem {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  quoteVolume: number;
}

type BriefScope = "all" | "major" | "alts";

type BriefState =
  | { status: "loading" }
  | { status: "ready"; board: MarketBoardItem[]; setups: ScoutSetup[]; cachedAt: number }
  | { status: "error"; message: string };

const majorSymbols = new Set(["BTCUSDT.P", "ETHUSDT.P"]);

function compactSymbol(symbol: string) {
  return symbol.replace("USDT.P", "").replace("USDT", "");
}

function formatPrice(price: number) {
  if (!Number.isFinite(price) || price <= 0) return "-";
  const digits = price >= 100 ? 2 : price >= 10 ? 3 : price >= 1 ? 4 : 5;
  return price.toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

function formatCachedAt(ms: number) {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 갱신";
  if (min < 60) return `${min}분 전 갱신`;
  return `${Math.floor(min / 60)}시간 전 갱신`;
}

function inScope(symbol: string, scope: BriefScope) {
  if (scope === "all") return true;
  const normalized = symbol.endsWith(".P") ? symbol : `${symbol}.P`;
  const isMajor = majorSymbols.has(normalized);
  return scope === "major" ? isMajor : !isMajor;
}

function scopeLabel(scope: BriefScope) {
  if (scope === "major") return "BTC/ETH";
  if (scope === "alts") return "알트코인";
  return "코인";
}

function toneFromBoard(board: MarketBoardItem[]) {
  const up = board.filter((item) => item.changePercent > 0).length;
  const down = board.filter((item) => item.changePercent < 0).length;
  if (up >= down + 2) return { label: "상승 우세", tone: "long" as const, up, down };
  if (down >= up + 2) return { label: "하락 우세", tone: "short" as const, up, down };
  return { label: "혼조", tone: "neutral" as const, up, down };
}

function toneClass(tone: "long" | "short" | "neutral") {
  if (tone === "long") return "border-signal-success/35 bg-signal-success/10 text-signal-success";
  if (tone === "short") return "border-signal-danger/35 bg-signal-danger/10 text-signal-danger";
  return "border-signal-warning/35 bg-signal-warning/10 text-signal-warning";
}

function sideClass(side: ScoutSetup["plan"]["side"]) {
  return side === "long" ? "text-signal-success" : "text-signal-danger";
}

function sideLabel(side: ScoutSetup["plan"]["side"]) {
  return side === "long" ? "롱 우세" : "숏 우세";
}

function sortSetups(setups: ScoutSetup[]) {
  return [...setups].sort((a, b) => b.score - a.score);
}

function uniqueTop(setups: ScoutSetup[], limit: number) {
  const used = new Set<string>();
  const picked: ScoutSetup[] = [];
  for (const setup of sortSetups(setups)) {
    if (used.has(setup.symbol)) continue;
    used.add(setup.symbol);
    picked.push(setup);
    if (picked.length >= limit) break;
  }
  return picked;
}

export function DailyRadarBrief({ scope = "all" }: { scope?: BriefScope }) {
  const [state, setState] = useState<BriefState>({ status: "loading" });

  async function load() {
    setState({ status: "loading" });
    try {
      const [boardResponse, scoutResponse] = await Promise.allSettled([
        fetch("/api/market-board", { cache: "no-store" }),
        fetch(`/api/scout?mode=scalp&risk=radar&scope=${scope}`, { cache: "no-store" })
      ]);

      let board: MarketBoardItem[] = [];
      let cachedAt = Date.now();
      if (boardResponse.status === "fulfilled" && boardResponse.value.ok) {
        const payload = (await boardResponse.value.json()) as { items?: MarketBoardItem[]; cachedAt?: number };
        board = (payload.items ?? []).filter((item) => inScope(item.symbol, scope));
        cachedAt = payload.cachedAt ?? cachedAt;
      }

      let setups: ScoutSetup[] = [];
      if (scoutResponse.status === "fulfilled" && scoutResponse.value.ok) {
        const payload = (await scoutResponse.value.json()) as { setups?: ScoutSetup[]; cachedAt?: number };
        setups = (payload.setups ?? []).filter((setup) => inScope(setup.symbol, scope));
        cachedAt = payload.cachedAt ?? cachedAt;
      }

      if (board.length === 0 && setups.length === 0) {
        throw new Error("시장 흐름을 불러오지 못했습니다.");
      }

      setState({ status: "ready", board, setups, cachedAt });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "레이더 브리핑을 불러오지 못했습니다." });
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const summary = useMemo(() => {
    if (state.status !== "ready") return null;
    const tone = toneFromBoard(state.board);
    const top = uniqueTop(state.setups, 3);
    const topSetup = top[0] ?? null;
    return { tone, top, topSetup };
  }, [state]);

  return (
    <section className="border-y border-surface-line py-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-[0.2em] text-accent-blue">{scopeLabel(scope).toUpperCase()} RADAR</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 dark:text-white">오늘의 레이더 브리핑</h2>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-surface-line bg-white/70 px-3 text-xs font-black text-slate-700 dark:bg-black/20 dark:text-slate-200"
        >
          <RefreshCw size={14} aria-hidden className="mr-1" />
          갱신
        </button>
      </div>

      {state.status === "loading" ? (
        <div className="mt-5 flex min-h-32 items-center justify-center border-y border-surface-line text-sm font-bold text-slate-500">
          <Loader2 className="mr-2 animate-spin" size={18} aria-hidden />
          시장 흐름을 확인하고 있습니다.
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="mt-5 border-y border-signal-warning/30 py-4 text-sm font-bold text-signal-warning">
          {state.message}
        </div>
      ) : null}

      {state.status === "ready" && summary ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="border-y border-surface-line py-4">
            <div className={`inline-flex rounded-full border px-3 py-1 text-sm font-black ${toneClass(summary.tone.tone)}`}>
              {summary.tone.label}
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
              상승 {summary.tone.up}개, 하락 {summary.tone.down}개 기준으로 {scopeLabel(scope)} 시장의 짧은 흐름을 정리했습니다.
              {summary.topSetup ? ` 현재 가장 먼저 볼 후보는 ${compactSymbol(summary.topSetup.symbol)} ${summary.topSetup.timeframe}입니다.` : " 강한 감지 후보는 아직 많지 않습니다."}
            </p>
            <p className="mt-3 text-xs font-bold text-slate-500">{formatCachedAt(state.cachedAt)}</p>
          </div>

          <div className="border-y border-surface-line py-4">
            <div className="flex items-center gap-2">
              <Radar size={17} className="text-accent-blue" aria-hidden />
              <h3 className="text-base font-black text-slate-950 dark:text-white">TOP 감지 후보</h3>
            </div>
            <div className="mt-3 grid gap-2">
              {summary.top.length > 0 ? (
                summary.top.map((setup) => {
                  const Icon = setup.plan.side === "long" ? ArrowUpRight : ArrowDownRight;
                  return (
                    <Link
                      key={`${setup.symbol}-${setup.timeframe}`}
                      href={scope === "alts" ? "/crypto/perpetual/alts" : "/crypto/perpetual"}
                      className="flex items-center justify-between gap-3 border-t border-surface-line py-3 transition hover:text-accent-blue first:border-t-0"
                    >
                      <div>
                        <p className="font-black text-slate-950 dark:text-white">
                          {compactSymbol(setup.symbol)} <span className="text-xs text-slate-500">{setup.timeframe}</span>
                        </p>
                        <p className="mt-1 text-xs text-slate-500">현재가 {formatPrice(setup.currentPrice)}</p>
                      </div>
                      <div className={`flex items-center gap-1 text-sm font-black ${sideClass(setup.plan.side)}`}>
                        <Icon size={15} aria-hidden />
                        {sideLabel(setup.plan.side)} · {Math.round(setup.score)}점
                      </div>
                    </Link>
                  );
                })
              ) : (
                <p className="border-y border-surface-line py-3 text-sm text-slate-500">
                  지금은 무리해서 후보를 찾기보다 BTC/ETH 방향과 뉴스 흐름을 먼저 확인하는 편이 좋습니다.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
