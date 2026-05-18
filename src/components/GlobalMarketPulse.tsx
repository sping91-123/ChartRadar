"use client";
// 글로벌 주요 자산의 미국장 30초 체크 판단을 보여주는 대시보드입니다.
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, CalendarClock, Gauge, LineChart, Loader2, Lock, Newspaper, RefreshCw, ShieldAlert, Sparkles, type LucideIcon } from "lucide-react";
import { hasMarketEntitlement } from "@/lib/billing";
import { withSupabaseAuth } from "@/lib/authFetch";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

type MarketMode = "Risk-On" | "Neutral" | "Risk-Off";
type PressureTone = "supportive" | "burden" | "mixed";
type DashboardRole = "index_future" | "macro_proxy" | "sector" | "leader" | "core";

type DashboardItem = {
  symbol: string;
  name: string;
  group: string;
  role: DashboardRole;
  label: string;
  price: number;
  changePercent: number;
  pressure: PressureTone;
  interpretation: string;
  proxyNote?: string;
};

type PressureItem = {
  title: string;
  detail: string;
  tone: PressureTone;
};

type EventRiskItem = {
  label: string;
  releaseAt: string;
  dateKst: string;
  state: "upcoming" | "released" | "watch";
  importance: 1 | 2 | 3;
  actual?: string;
  forecast?: string;
  previous?: string;
  marketImpact: string;
  sourceUrl: string;
};

type NewsPressureItem = {
  source: string;
  title: string;
  tone: PressureTone;
  summary: string;
};

type DashboardPayload = {
  updatedAt: string;
  headline: string;
  marketMode: MarketMode;
  strength: number;
  topRisk: string;
  dataWarning?: string | null;
  corePressures: PressureItem[];
  basicIndexSummary: {
    symbol: string;
    label: string;
    changePercent: number;
    interpretation: string;
    tone: PressureTone;
  } | null;
  futures: {
    title: string;
    summary: string;
    tone: PressureTone;
    isDivergent: boolean;
    items: DashboardItem[];
  };
  macro: {
    title: string;
    summary: string;
    tone: PressureTone;
    items: DashboardItem[];
  };
  sectors: {
    title: string;
    summary: string;
    tone: PressureTone;
    breadth: string;
    strong: DashboardItem[];
    weak: DashboardItem[];
    items: DashboardItem[];
  };
  leaders: {
    title: string;
    summary: string;
    tone: PressureTone;
    supportive: DashboardItem[];
    burden: DashboardItem[];
    items: DashboardItem[];
  };
  eventRisk: {
    title: string;
    summary: string;
    nextEvent: EventRiskItem | null;
    items: EventRiskItem[];
    sourceNote: string;
    warning?: string;
  };
  newsPressure: {
    title: string;
    summary: string;
    tone: PressureTone;
    items: NewsPressureItem[];
  };
  proxyDisclosure: string;
};

type PulseState =
  | { status: "loading" }
  | { status: "ready"; payload: DashboardPayload }
  | { status: "error"; message: string };

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "미확인";
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

function modeClass(mode: MarketMode) {
  if (mode === "Risk-On") return "border-emerald-300/30 bg-emerald-400/12 text-emerald-100";
  if (mode === "Risk-Off") return "border-rose-300/30 bg-rose-400/12 text-rose-100";
  return "border-cyan-300/30 bg-cyan-400/12 text-cyan-100";
}

function toneClass(tone: PressureTone) {
  if (tone === "supportive") return "border-emerald-300/20 bg-emerald-400/10 text-emerald-100";
  if (tone === "burden") return "border-rose-300/20 bg-rose-400/10 text-rose-100";
  return "border-slate-300/15 bg-white/[0.04] text-slate-200";
}

function toneLabel(tone: PressureTone) {
  if (tone === "supportive") return "우호";
  if (tone === "burden") return "부담";
  return "중립";
}

function modeIcon(mode: MarketMode) {
  if (mode === "Risk-On") return <ArrowUpRight size={18} aria-hidden />;
  if (mode === "Risk-Off") return <ArrowDownRight size={18} aria-hidden />;
  return <Gauge size={18} aria-hidden />;
}

function itemToneBadge(item: { pressure?: PressureTone; tone?: PressureTone }) {
  const tone = item.pressure ?? item.tone ?? "mixed";
  return (
    <span className={`shrink-0 rounded border px-2 py-1 text-[10px] font-black ${toneClass(tone)}`}>
      {toneLabel(tone)}
    </span>
  );
}

function ProCta({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/pro?market=stocks"
      className={`inline-flex items-center justify-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300/10 font-black text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-300/15 ${
        compact ? "min-h-8 px-2.5 text-[11px]" : "min-h-10 px-3 text-xs"
      }`}
    >
      <Lock size={13} aria-hidden />
      Pro 상세 확인
    </Link>
  );
}

function LockedDetail({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-cyan-300/15 bg-cyan-300/[0.06] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black text-cyan-100">{title}</p>
        <Lock size={14} className="shrink-0 text-cyan-200" aria-hidden />
      </div>
      <p className="mt-2 text-[11px] font-bold leading-5 text-slate-400 [word-break:keep-all]">{children}</p>
      <div className="mt-3">
        <ProCta compact />
      </div>
    </div>
  );
}

function MiniItem({ item }: { item: DashboardItem }) {
  return (
    <article className={`rounded-lg border p-3 ${toneClass(item.pressure)}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-black text-white">{item.symbol}</p>
          <p className="mt-1 truncate text-[11px] font-bold opacity-75">{item.label}</p>
        </div>
        <span className="shrink-0 rounded border border-white/10 bg-black/20 px-2 py-1 text-xs font-black">
          {formatPercent(item.changePercent)}
        </span>
      </div>
      <p className="mt-2 text-[11px] font-bold leading-5 opacity-80 [word-break:keep-all]">{item.interpretation}</p>
      {item.proxyNote ? <p className="mt-2 text-[10px] font-bold leading-4 opacity-70 [word-break:keep-all]">{item.proxyNote}</p> : null}
    </article>
  );
}

function SectionShell({
  icon: Icon,
  title,
  summary,
  children
}: {
  icon: LucideIcon;
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 shrink-0 text-cyan-300" size={18} aria-hidden />
        <div className="min-w-0">
          <h3 className="text-sm font-black text-white">{title}</h3>
          <p className="mt-1 text-xs font-bold leading-5 text-slate-400 [word-break:keep-all]">{summary}</p>
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </article>
  );
}

function EventRiskBlock({ payload, isPaid }: { payload: DashboardPayload; isPaid: boolean }) {
  const items = isPaid ? payload.eventRisk.items.slice(0, 3) : payload.eventRisk.nextEvent ? [payload.eventRisk.nextEvent] : [];

  return (
    <SectionShell icon={CalendarClock} title="오늘 이벤트 리스크" summary={payload.eventRisk.summary}>
      {items.length ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={`${item.label}-${item.releaseAt}`} className="rounded-md border border-white/10 bg-white/[0.03] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-[10px] font-black text-amber-100">
                  {item.importance >= 3 ? "중요" : "참고"}
                </span>
                <p className="text-xs font-black text-white">{item.label}</p>
              </div>
              <p className="mt-1 text-[11px] font-bold text-slate-500">한국시간 {item.dateKst}</p>
              {isPaid ? <p className="mt-2 text-[11px] leading-5 text-slate-400 [word-break:keep-all]">{item.marketImpact}</p> : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-xs font-bold text-slate-500">이벤트 데이터 일부 확인 제한입니다.</p>
      )}
      {!isPaid ? <LockedDetail title="이벤트 타임라인">Pro에서는 이벤트 타임라인과 관련 자산 영향을 함께 확인합니다.</LockedDetail> : null}
    </SectionShell>
  );
}

function FuturesBlock({ payload, isPaid }: { payload: DashboardPayload; isPaid: boolean }) {
  return (
    <SectionShell icon={LineChart} title="지수선물 판단" summary={payload.futures.summary}>
      {isPaid ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {payload.futures.items.map((item) => <MiniItem key={item.symbol} item={item} />)}
        </div>
      ) : payload.basicIndexSummary ? (
        <div className={`rounded-lg border p-3 ${toneClass(payload.basicIndexSummary.tone)}`}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-black text-white">{payload.basicIndexSummary.label}</p>
              <p className="mt-1 text-lg font-black text-white">{formatPercent(payload.basicIndexSummary.changePercent)}</p>
            </div>
            {itemToneBadge({ tone: payload.basicIndexSummary.tone })}
          </div>
          <p className="mt-2 text-[11px] font-bold leading-5 text-slate-300 [word-break:keep-all]">{payload.basicIndexSummary.interpretation}</p>
        </div>
      ) : (
        <p className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-xs font-bold text-slate-500">지수선물 데이터 일부 확인 제한입니다.</p>
      )}
      {!isPaid ? <LockedDetail title="NQ / ES / YM / RTY 상세">Pro에서는 지수선물 전체, 지수선물 엇갈림, 조건과 무효화 기준을 확인합니다.</LockedDetail> : null}
    </SectionShell>
  );
}

function MacroBlock({ payload, isPaid }: { payload: DashboardPayload; isPaid: boolean }) {
  const visibleItems = isPaid ? payload.macro.items : payload.macro.items.slice(0, 2);

  return (
    <SectionShell icon={ShieldAlert} title="매크로 압력" summary={payload.macro.summary}>
      <div className="grid gap-2 sm:grid-cols-2">
        {visibleItems.map((item) => <MiniItem key={item.symbol} item={item} />)}
      </div>
      <p className="mt-3 rounded-md border border-white/10 bg-white/[0.03] p-3 text-[11px] font-bold leading-5 text-slate-500 [word-break:keep-all]">
        {payload.proxyDisclosure}
      </p>
      {!isPaid ? <LockedDetail title="매크로 프록시 전체">Pro에서는 VIX, UUP 달러 프록시, TLT/ZN=F/IEF/SHY 금리 프록시, 유가와 금 압력을 함께 봅니다.</LockedDetail> : null}
    </SectionShell>
  );
}

function SectorBlock({ payload, isPaid }: { payload: DashboardPayload; isPaid: boolean }) {
  const strong = payload.sectors.strong[0] ?? null;
  const weak = payload.sectors.weak[0] ?? null;

  return (
    <SectionShell icon={BarChart3} title="섹터 로테이션" summary={payload.sectors.summary}>
      {isPaid ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {payload.sectors.items.map((item) => <MiniItem key={item.symbol} item={item} />)}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {strong ? <MiniItem item={strong} /> : <p className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-xs font-bold text-slate-500">강한 섹터 확인 제한</p>}
          {weak ? <MiniItem item={weak} /> : <p className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-xs font-bold text-slate-500">약한 섹터 확인 제한</p>}
        </div>
      )}
      {!isPaid ? <LockedDetail title="섹터 전체 로테이션">Pro에서는 성장, 방어, 금융, 에너지, 반도체 전체 로테이션과 시장 폭 해석을 봅니다.</LockedDetail> : null}
    </SectionShell>
  );
}

function LeaderBlock({ payload, isPaid }: { payload: DashboardPayload; isPaid: boolean }) {
  const visibleItems = isPaid ? payload.leaders.items : [...payload.leaders.supportive, ...payload.leaders.burden].slice(0, 2);

  return (
    <SectionShell icon={Sparkles} title="대장주 레이더" summary={payload.leaders.summary}>
      <div className="grid gap-2 sm:grid-cols-2">
        {visibleItems.length ? visibleItems.map((item) => <MiniItem key={item.symbol} item={item} />) : <p className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-xs font-bold text-slate-500">대장주 데이터 일부 확인 제한입니다.</p>}
      </div>
      {!isPaid ? <LockedDetail title="대장주 전체 상세">Pro에서는 NVDA, TSLA, AAPL, MSFT, AMZN, META, GOOGL, AVGO가 지수를 지지하는지 방해하는지 확인합니다.</LockedDetail> : null}
    </SectionShell>
  );
}

function NewsBlock({ payload, isPaid }: { payload: DashboardPayload; isPaid: boolean }) {
  const items = isPaid ? payload.newsPressure.items : payload.newsPressure.items.slice(0, 1);

  return (
    <SectionShell icon={Newspaper} title="뉴스 압력" summary={payload.newsPressure.summary}>
      {items.length ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={`${item.source}-${item.title}`} className={`rounded-lg border p-3 ${toneClass(item.tone)}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-xs font-black text-white">{item.title}</p>
                {itemToneBadge({ tone: item.tone })}
              </div>
              <p className="mt-1 text-[11px] font-bold opacity-75">{item.source}</p>
              {isPaid ? <p className="mt-2 text-[11px] font-bold leading-5 opacity-80 [word-break:keep-all]">{item.summary}</p> : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-xs font-bold text-slate-500">강한 뉴스 압력은 아직 제한적입니다.</p>
      )}
      {!isPaid ? <LockedDetail title="뉴스 압력 상세">Pro에서는 핵심 뉴스 1~3개를 Risk-On, Risk-Off, 변동성 확대 요인으로 나눠 봅니다.</LockedDetail> : null}
    </SectionShell>
  );
}

export function GlobalMarketPulse() {
  const { profile } = useSupabaseAuth();
  const isPaid = hasMarketEntitlement(profile?.plan, "stocks");
  const [state, setState] = useState<PulseState>({ status: "loading" });

  async function load() {
    setState({ status: "loading" });
    try {
      const response = await fetch("/api/stocks/market-board", await withSupabaseAuth({ cache: "no-store" }));
      const data = (await response.json().catch(() => ({}))) as Partial<DashboardPayload> & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "글로벌 시장 흐름을 잠시 확인하지 못했습니다.");
      if (!data.marketMode || !Array.isArray(data.corePressures)) throw new Error("글로벌 시장 흐름 데이터가 아직 준비되지 않았습니다.");
      setState({ status: "ready", payload: data as DashboardPayload });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "글로벌 시장 흐름을 잠시 확인하지 못했습니다." });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const payload = state.status === "ready" ? state.payload : null;
  const corePressures = useMemo(() => payload?.corePressures.slice(0, 3) ?? [], [payload]);

  return (
    <section className="enterprise-panel p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-300/10 text-cyan-300">
            <Activity size={20} aria-hidden />
          </div>
          <div>
            <p className="text-xs font-black text-cyan-300">미국장 30초 체크</p>
            <h2 className="mt-1 text-xl font-black text-white">개장 전 시장 판단 대시보드</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400 [word-break:keep-all]">
              지수선물, 매크로 압력, 섹터 로테이션, 대장주, 이벤트와 뉴스 압력을 한 화면에서 판단 보조 자료로 정리합니다.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
          {!isPaid ? <ProCta /> : null}
          <button
            type="button"
            onClick={() => load()}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-slate-200 transition hover:border-cyan-300/50 hover:text-cyan-200"
          >
            <RefreshCw size={13} aria-hidden />
            다시 확인
          </button>
        </div>
      </div>

      {state.status === "loading" ? (
        <div className="mt-4 flex min-h-40 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-sm text-slate-400">
          <Loader2 className="mr-2 animate-spin" size={16} aria-hidden />
          미국장 30초 체크 데이터를 불러오는 중입니다.
        </div>
      ) : state.status === "error" ? (
        <div className="mt-4 rounded-lg border border-amber-300/25 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
          <div className="flex items-center gap-2 font-black">
            <AlertTriangle size={16} aria-hidden />
            일부 데이터 확인 제한.
          </div>
          <p className="mt-2 text-xs text-amber-100/80">{state.message}</p>
        </div>
      ) : payload ? (
        <>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1.15fr_1.85fr]">
            <article className={`rounded-lg border p-4 ${modeClass(payload.marketMode)}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black opacity-80">오늘 미국장 최종 판단</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-black/20 px-3 py-1.5 text-lg font-black text-white">
                      {modeIcon(payload.marketMode)}
                      {payload.marketMode}
                    </span>
                    <span className="rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-black">
                      판단 강도 {payload.strength}/100
                    </span>
                  </div>
                </div>
                <Gauge size={24} aria-hidden />
              </div>
              <p className="mt-4 text-sm font-bold leading-6 text-slate-100 [word-break:keep-all]">{payload.headline}</p>
              {payload.dataWarning ? (
                <p className="mt-3 rounded-md border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-bold leading-5 text-amber-100 [word-break:keep-all]">{payload.dataWarning}</p>
              ) : null}
              <div className="mt-4 rounded-md border border-white/10 bg-black/20 p-3">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 shrink-0 text-amber-200" size={16} aria-hidden />
                  <div>
                    <p className="text-xs font-black text-white">오늘 가장 중요한 리스크</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-slate-300 [word-break:keep-all]">{payload.topRisk}</p>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-[11px] font-bold text-slate-400">최근 업데이트. {formatTime(payload.updatedAt)} KST</p>
            </article>

            <div className="grid gap-2 sm:grid-cols-3">
              {corePressures.map((pressure) => (
                <article key={`${pressure.title}-${pressure.detail}`} className={`rounded-lg border p-3 ${toneClass(pressure.tone)}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-black text-white">{pressure.title}</p>
                    {itemToneBadge({ tone: pressure.tone })}
                  </div>
                  <p className="mt-2 text-[11px] font-bold leading-5 opacity-80 [word-break:keep-all]">{pressure.detail}</p>
                </article>
              ))}
            </div>
          </div>

          {!isPaid ? (
            <div className="mt-3 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.06] p-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
              <p className="text-xs font-bold leading-5 text-cyan-100 [word-break:keep-all]">
                Basic은 최종 라벨과 핵심 압력만 보여줍니다. Pro에서는 조건, 무효화 조건, 세부 리스크와 전체 로테이션을 확인합니다.
              </p>
              <div className="mt-3 shrink-0 sm:mt-0">
                <ProCta compact />
              </div>
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            <EventRiskBlock payload={payload} isPaid={isPaid} />
            <FuturesBlock payload={payload} isPaid={isPaid} />
            <MacroBlock payload={payload} isPaid={isPaid} />
            <SectorBlock payload={payload} isPaid={isPaid} />
            <LeaderBlock payload={payload} isPaid={isPaid} />
            <NewsBlock payload={payload} isPaid={isPaid} />
          </div>
        </>
      ) : null}
    </section>
  );
}
