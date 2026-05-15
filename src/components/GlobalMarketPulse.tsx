"use client";
// 글로벌 주요 자산의 당일 시장 온도를 요약해 보여주는 관제 카드입니다.
import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Loader2, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { withSupabaseAuth } from "@/lib/authFetch";

type PulseItem = {
  symbol: string;
  name: string;
  group: string;
  price: number;
  changePercent: number;
  state: "strong_up" | "up" | "flat" | "down" | "strong_down";
};

type PulseState =
  | { status: "loading" }
  | { status: "ready"; headline: string; updatedAt: string; counts: { up: number; down: number; flat: number }; items: PulseItem[] }
  | { status: "error"; message: string };

const groupLabel: Record<string, string> = {
  futures: "선물",
  index_etf: "지수·채권",
  mega_cap: "빅테크",
  ai_chip: "반도체",
  growth: "성장주",
  finance: "금융",
  commodity: "원자재"
};

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "업데이트 확인 중";
  return date.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul"
  });
}

function toneClass(changePercent: number) {
  if (changePercent >= 0.25) return "border-emerald-300/20 bg-emerald-400/10 text-emerald-200";
  if (changePercent <= -0.25) return "border-rose-300/20 bg-rose-400/10 text-rose-200";
  return "border-slate-300/15 bg-white/[0.04] text-slate-200";
}

export function GlobalMarketPulse() {
  const [state, setState] = useState<PulseState>({ status: "loading" });

  async function load() {
    setState({ status: "loading" });
    try {
      const response = await fetch("/api/stocks/market-board", await withSupabaseAuth({ cache: "no-store" }));
      const data = (await response.json().catch(() => ({}))) as Partial<Extract<PulseState, { status: "ready" }>> & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "글로벌 시장 온도를 잠시 확인하지 못했습니다.");
      if (!Array.isArray(data.items)) throw new Error("글로벌 시장 온도 데이터가 아직 준비되지 않았습니다.");
      setState({
        status: "ready",
        headline: data.headline ?? "글로벌 시장 흐름을 정리하고 있습니다.",
        updatedAt: data.updatedAt ?? new Date().toISOString(),
        counts: data.counts ?? { up: 0, down: 0, flat: 0 },
        items: data.items
      });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "글로벌 시장 온도를 잠시 확인하지 못했습니다." });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const sortedItems = useMemo(() => {
    if (state.status !== "ready") return [];
    return [...state.items].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)).slice(0, 8);
  }, [state]);

  return (
    <section className="enterprise-panel p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-300/10 text-cyan-300">
            <Activity size={20} aria-hidden />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Global Pulse</p>
            <h2 className="mt-1 text-xl font-black text-white">글로벌 시장 온도</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400 [word-break:keep-all]">
              지수선물, 변동성, 채권, 달러, 원자재, 반도체 ETF를 먼저 훑어 오늘 시장의 압력이 어디에 있는지 정리합니다.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-slate-200 transition hover:border-cyan-300/50 hover:text-cyan-200"
        >
          <RefreshCw size={13} aria-hidden />
          다시 확인
        </button>
      </div>

      {state.status === "loading" ? (
        <div className="mt-4 flex min-h-32 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-sm text-slate-400">
          <Loader2 className="mr-2 animate-spin" size={16} aria-hidden />
          시장 온도를 불러오는 중입니다.
        </div>
      ) : state.status === "error" ? (
        <div className="mt-4 rounded-lg border border-amber-300/25 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
          <div className="flex items-center gap-2 font-black">
            <AlertTriangle size={16} aria-hidden />
            잠시 확인하지 못했습니다.
          </div>
          <p className="mt-2 text-xs text-amber-100/80">{state.message}</p>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_1.6fr]">
            <article className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-bold text-slate-500">최근 업데이트. {formatTime(state.updatedAt)} KST</p>
              <h3 className="mt-3 text-xl font-black leading-7 text-white [word-break:keep-all]">{state.headline}</h3>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-md border border-emerald-300/20 bg-emerald-400/10 p-3 text-center">
                  <TrendingUp className="mx-auto text-emerald-200" size={18} aria-hidden />
                  <p className="mt-2 text-lg font-black text-emerald-200">{state.counts.up}</p>
                  <p className="text-[11px] font-bold text-emerald-100/80">상승</p>
                </div>
                <div className="rounded-md border border-slate-300/15 bg-white/[0.04] p-3 text-center">
                  <p className="mt-1 text-lg font-black text-slate-200">{state.counts.flat}</p>
                  <p className="text-[11px] font-bold text-slate-400">횡보</p>
                </div>
                <div className="rounded-md border border-rose-300/20 bg-rose-400/10 p-3 text-center">
                  <TrendingDown className="mx-auto text-rose-200" size={18} aria-hidden />
                  <p className="mt-2 text-lg font-black text-rose-200">{state.counts.down}</p>
                  <p className="text-[11px] font-bold text-rose-100/80">하락</p>
                </div>
              </div>
            </article>
            <div className="grid gap-2 sm:grid-cols-2">
              {sortedItems.map((item) => (
                <article key={item.symbol} className={`rounded-lg border p-3 ${toneClass(item.changePercent)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white">{item.symbol}</p>
                      <p className="mt-1 truncate text-[11px] font-bold opacity-75">{item.name}</p>
                    </div>
                    <span className="shrink-0 rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs font-black">
                      {formatPercent(item.changePercent)}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] font-bold opacity-70">{groupLabel[item.group] ?? "글로벌"}</p>
                </article>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
