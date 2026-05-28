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
  originalTitle?: string;
  tone: PressureTone;
  summary: string;
};

type ThermometerAxis = {
  key: string;
  label: string;
  status: "강함" | "중립" | "약함" | "부담" | "확인 필요";
  tone: PressureTone;
  detail: string;
  symbols: string[];
};

type FocusAsset = {
  symbol: string;
  label: string;
  reason: string;
  tone: PressureTone;
};

type RelationshipCheck = {
  title: string;
  status: "우호" | "중립" | "부담" | "확인 필요";
  tone: PressureTone;
  detail: string;
  symbols: string[];
};

type DashboardPayload = {
  updatedAt: string;
  headline: string;
  marketMode: MarketMode;
  strength: number;
  topRisk: string;
  decisionLabel?: string;
  strengthLabel?: string;
  chaseWarning?: string;
  dataWarning?: string | null;
  corePressures: PressureItem[];
  marketThermometer?: ThermometerAxis[];
  focusAssets?: FocusAsset[];
  relationshipChecks?: RelationshipCheck[];
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

const fallbackChecklist = ["QQQ와 SPY 방향 확인", "VIX 변동성 확인", "NVDA/SMH 반도체 주도력 확인", "GLD/CL 원자재·안전자산 흐름 확인", "오늘 주요 일정 확인"];

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
      className={`inline-flex items-center justify-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300/10 text-center font-black leading-4 text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-300/15 ${
        compact ? "min-h-8 px-2.5 text-[11px]" : "min-h-10 px-3 text-xs"
      }`}
    >
      <Lock size={13} aria-hidden />
      {compact ? "Global Pro 상세 판단 열기" : "Global Pro로 미국장 상세 판단 열기"}
    </Link>
  );
}

function LockedDetail({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-cyan-300/20 pt-3">
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
    <article className="border-t border-white/10 py-3 first:border-t-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-black text-white">{item.symbol}</p>
          <p className="mt-1 truncate text-[11px] font-bold opacity-75">{item.label}</p>
        </div>
        <span className="shrink-0 text-xs font-black text-slate-300">
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
    <article className="border-y border-white/10 py-4">
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

function FallbackChecklist({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "py-3" : "py-4"}>
      <p className="text-xs font-black text-white">기본 체크리스트</p>
      <div className="mt-3 grid divide-y divide-white/10 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-5">
        {fallbackChecklist.map((item) => (
          <div key={item} className="px-3 py-2 text-[11px] font-bold leading-5 text-slate-300 [word-break:keep-all]">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function MarketThermometerBlock({ items }: { items: ThermometerAxis[] }) {
  return (
    <article className="border-y border-white/10 py-4">
      <div className="flex items-start gap-3">
        <Gauge className="mt-0.5 shrink-0 text-cyan-300" size={18} aria-hidden />
        <div>
          <h3 className="text-sm font-black text-white">시장 온도계</h3>
          <p className="mt-1 text-xs font-bold leading-5 text-slate-400 [word-break:keep-all]">지수, 변동성, 반도체, 원자재, 금리/달러 축이 같은 방향인지 먼저 점검합니다.</p>
        </div>
      </div>
      <div className="mt-3 grid divide-y divide-white/10 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5">
        {items.map((item) => (
          <div key={item.key} className="px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-black text-white">{item.label}</p>
              <span className="shrink-0 text-[10px] font-black text-slate-300">{item.status}</span>
            </div>
            <p className="mt-2 text-[11px] font-bold leading-5 opacity-80 [word-break:keep-all]">{item.detail}</p>
            <p className="mt-2 text-[10px] font-bold text-slate-500">{item.symbols.join(" · ")}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function FocusAssetsBlock({ items }: { items: FocusAsset[] }) {
  return (
    <article className="border-y border-white/10 py-4">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 shrink-0 text-cyan-300" size={18} aria-hidden />
        <div>
          <h3 className="text-sm font-black text-white">오늘 먼저 볼 글로벌 자산 TOP 3</h3>
          <p className="mt-1 text-xs font-bold leading-5 text-slate-400 [word-break:keep-all]">흐름을 좁혀 보기 위한 우선 확인 자산입니다.</p>
        </div>
      </div>
      <div className="mt-3 grid divide-y divide-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {items.map((item, index) => (
          <div key={`${item.symbol}-${index}`} className="px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black text-slate-400">TOP {index + 1}</span>
              {itemToneBadge({ tone: item.tone })}
            </div>
            <p className="mt-3 text-lg font-black text-white">{item.symbol}</p>
            <p className="mt-1 text-[11px] font-bold text-slate-400">{item.label}</p>
            <p className="mt-2 text-xs font-bold leading-5 text-slate-200 [word-break:keep-all]">{item.reason}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function RelationshipChecksBlock({ items }: { items: RelationshipCheck[] }) {
  return (
    <article className="border-y border-white/10 py-4">
      <div className="flex items-start gap-3">
        <LineChart className="mt-0.5 shrink-0 text-cyan-300" size={18} aria-hidden />
        <div>
          <h3 className="text-sm font-black text-white">자산 간 관계성 체크</h3>
          <p className="mt-1 text-xs font-bold leading-5 text-slate-400 [word-break:keep-all]">개별 자산보다 지수, VIX, 반도체, 원자재가 서로 맞물리는지 확인합니다.</p>
        </div>
      </div>
      <div className="mt-3 grid divide-y divide-white/10 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        {items.map((item) => (
          <div key={item.title} className="px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-black text-white">{item.title}</p>
              <span className="text-[10px] font-black text-slate-300">{item.status}</span>
            </div>
            <p className="mt-2 text-[11px] font-bold leading-5 opacity-80 [word-break:keep-all]">{item.detail}</p>
            <p className="mt-2 text-[10px] font-bold text-slate-500">{item.symbols.join(" · ")}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function EventRiskBlock({ payload, isPaid }: { payload: DashboardPayload; isPaid: boolean }) {
  const items = isPaid ? payload.eventRisk.items.slice(0, 3) : payload.eventRisk.nextEvent ? [payload.eventRisk.nextEvent] : [];

  return (
    <SectionShell icon={CalendarClock} title="오늘 일정 리스크" summary={payload.eventRisk.summary}>
      {items.length ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={`${item.label}-${item.releaseAt}`} className="border-t border-white/10 py-3 first:border-t-0">
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
        <p className="border-t border-white/10 py-3 text-xs font-bold text-slate-500">이벤트 데이터 일부 확인 제한입니다.</p>
      )}
      {!isPaid ? <LockedDetail title="이벤트 리스크 상세">Global Pro에서는 이벤트 타임라인과 관련 자산 영향을 함께 확인합니다.</LockedDetail> : null}
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
        <div className="border-t border-white/10 py-3">
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
        <p className="border-t border-white/10 py-3 text-xs font-bold text-slate-500">지수선물 데이터 일부 확인 제한입니다.</p>
      )}
      {!isPaid ? <LockedDetail title="NQ / ES / YM / RTY 상세">Global Pro에서는 지수선물 전체, 지수선물 엇갈림, 조건과 무효화 기준을 확인합니다.</LockedDetail> : null}
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
      <p className="mt-3 border-t border-white/10 pt-3 text-[11px] font-bold leading-5 text-slate-500 [word-break:keep-all]">
        {payload.proxyDisclosure}
      </p>
      {!isPaid ? <LockedDetail title="매크로 압력 전체">Global Pro에서는 VIX, UUP 달러 프록시, TLT/ZN=F/IEF/SHY 금리 프록시, 유가와 금 압력을 함께 봅니다.</LockedDetail> : null}
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
          {strong ? <MiniItem item={strong} /> : <p className="border-t border-white/10 py-3 text-xs font-bold text-slate-500">강한 섹터 확인 제한</p>}
          {weak ? <MiniItem item={weak} /> : <p className="border-t border-white/10 py-3 text-xs font-bold text-slate-500">약한 섹터 확인 제한</p>}
        </div>
      )}
      {!isPaid ? <LockedDetail title="섹터 전체 로테이션">Global Pro에서는 성장, 방어, 금융, 에너지, 반도체 전체 로테이션과 시장 폭 해석을 봅니다.</LockedDetail> : null}
    </SectionShell>
  );
}

function LeaderBlock({ payload, isPaid }: { payload: DashboardPayload; isPaid: boolean }) {
  const visibleItems = isPaid ? payload.leaders.items : [...payload.leaders.supportive, ...payload.leaders.burden].slice(0, 2);

  return (
    <SectionShell icon={Sparkles} title="대장주 레이더" summary={payload.leaders.summary}>
      <div className="grid gap-2 sm:grid-cols-2">
        {visibleItems.length ? visibleItems.map((item) => <MiniItem key={item.symbol} item={item} />) : <p className="border-t border-white/10 py-3 text-xs font-bold text-slate-500">대장주 데이터 일부 확인 제한입니다.</p>}
      </div>
      {!isPaid ? <LockedDetail title="대장주 레이더 상세">Global Pro에서는 NVDA, TSLA, AAPL, MSFT, AMZN, META, GOOGL, AVGO가 지수를 지지하는지 방해하는지 확인합니다.</LockedDetail> : null}
    </SectionShell>
  );
}

function NewsBlock({ payload, isPaid }: { payload: DashboardPayload; isPaid: boolean }) {
  const items = isPaid ? payload.newsPressure.items : payload.newsPressure.items.slice(0, 1);

  return (
    <SectionShell icon={Newspaper} title="오늘의 이벤트 압력" summary={payload.newsPressure.summary}>
      {items.length ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={`${item.source}-${item.title}`} className="border-t border-white/10 py-3 first:border-t-0">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-xs font-black text-white">{item.title}</p>
                {itemToneBadge({ tone: item.tone })}
              </div>
              <p className="mt-1 text-[11px] font-bold opacity-75">{item.source}</p>
              {isPaid && item.originalTitle && item.originalTitle !== item.title ? (
                <p className="mt-1 text-[10px] font-bold leading-4 text-slate-500 [word-break:break-word]">원문: {item.originalTitle}</p>
              ) : null}
              {isPaid ? <p className="mt-2 text-[11px] font-bold leading-5 opacity-80 [word-break:keep-all]">{item.summary}</p> : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="border-t border-white/10 py-3 text-xs font-bold text-slate-500">강한 이벤트 압력은 아직 제한적입니다.</p>
      )}
      {!isPaid ? <LockedDetail title="이벤트 압력 상세">Global Pro에서는 핵심 일정과 뉴스 1~3개를 Risk-On, Risk-Off, 변동성 확대 요인으로 나눠 봅니다.</LockedDetail> : null}
    </SectionShell>
  );
}

export function GlobalMarketPulse() {
  const { profile } = useSupabaseAuth();
  const isPaid = hasMarketEntitlement(profile?.plan, "stocks");
  const [state, setState] = useState<PulseState>({ status: "loading" });

  async function load(silent = false) {
    if (!silent) setState({ status: "loading" });
    try {
      const response = await fetch(`/api/stocks/market-board?ts=${Date.now()}`, await withSupabaseAuth({ cache: "no-store" }));
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
    const refresh = () => void load(true);
    const interval = window.setInterval(refresh, 60_000);
    const handleFocusRefresh = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", handleFocusRefresh);
    document.addEventListener("visibilitychange", handleFocusRefresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocusRefresh);
      document.removeEventListener("visibilitychange", handleFocusRefresh);
    };
  }, []);

  const payload = state.status === "ready" ? state.payload : null;
  const corePressures = useMemo(() => payload?.corePressures.slice(0, 3) ?? [], [payload]);

  return (
    <section className="min-w-0 overflow-hidden border-y border-white/10 py-5 sm:py-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center text-cyan-300">
            <Activity size={20} aria-hidden />
          </div>
          <div>
            <p className="text-xs font-black text-cyan-300">미국장 30초 체크 · 장전/장중 판단 루틴</p>
            <h2 className="mt-1 text-xl font-black text-white">오늘의 글로벌 레이더</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400 [word-break:keep-all]">
              오늘의 판정, 시장 온도계, 먼저 볼 자산, 관계성 체크를 한 화면에서 판단 보조 자료로 정리합니다.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
          <Link
            href="/global/assets"
            className="inline-flex min-h-10 items-center justify-center gap-2 border-b border-cyan-300/40 bg-transparent px-1 text-xs font-black text-cyan-100 transition hover:border-cyan-300 hover:text-cyan-200"
          >
            <BarChart3 size={13} aria-hidden />
            자산레이더 보기
          </Link>
          {!isPaid ? <ProCta /> : null}
          <button
            type="button"
            onClick={() => load()}
            className="inline-flex min-h-10 items-center justify-center gap-2 border-b border-white/15 bg-transparent px-1 text-xs font-black text-slate-200 transition hover:border-cyan-300/50 hover:text-cyan-200"
          >
            <RefreshCw size={13} aria-hidden />
            다시 확인
          </button>
        </div>
      </div>

      {state.status === "loading" ? (
        <div className="mt-4 border-y border-white/10 py-4">
          <div className="flex items-center text-sm text-slate-400">
            <Loader2 className="mr-2 animate-spin" size={16} aria-hidden />
            글로벌 시장 흐름을 불러오는 중입니다. 지연되면 아래 기본 체크리스트부터 확인하세요.
          </div>
          <div className="mt-4">
            <FallbackChecklist compact />
          </div>
        </div>
      ) : state.status === "error" ? (
        <div className="mt-4 border-y border-amber-300/25 py-4 text-sm leading-6 text-amber-100">
          <div className="flex items-center gap-2 font-black">
            <AlertTriangle size={16} aria-hidden />
            시장 흐름을 불러오지 못했습니다.
          </div>
          <p className="mt-2 text-xs text-amber-100/80">{state.message} 선택 자산 레이더를 먼저 확인하거나 잠시 후 다시 시도해 주세요.</p>
          <div className="mt-4">
            <FallbackChecklist compact />
          </div>
        </div>
      ) : payload ? (
        <>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1.15fr_1.85fr]">
            <article className="border-y border-white/10 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black opacity-80">오늘의 글로벌 레이더 결론</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 border-b border-white/20 px-1 py-1.5 text-lg font-black text-white">
                      {modeIcon(payload.marketMode)}
                      {payload.decisionLabel ?? payload.marketMode}
                    </span>
                    <span className="border-b border-white/15 px-1 py-1.5 text-xs font-black">
                      {payload.marketMode}
                    </span>
                    <span className="border-b border-white/15 px-1 py-1.5 text-xs font-black">
                      판단 강도 {payload.strengthLabel ?? "중간"} · {payload.strength}/100
                    </span>
                  </div>
                </div>
                <Gauge size={24} aria-hidden />
              </div>
              <p className="mt-4 text-sm font-bold leading-6 text-slate-100 [word-break:keep-all]">{payload.headline}</p>
              {payload.chaseWarning ? <p className="mt-2 text-xs font-bold leading-5 text-slate-200 [word-break:keep-all]">{payload.chaseWarning}</p> : null}
              {payload.dataWarning ? (
                <p className="mt-3 border-y border-amber-400/20 py-2 text-xs font-bold leading-5 text-amber-100 [word-break:keep-all]">{payload.dataWarning}</p>
              ) : null}
              <div className="mt-4 border-t border-white/10 pt-3">
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
                <article key={`${pressure.title}-${pressure.detail}`} className="border-t border-white/10 py-3 first:border-t-0">
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
            <div className="mt-3 border-y border-cyan-300/20 py-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
              <p className="text-xs font-bold leading-5 text-cyan-100 [word-break:keep-all]">
                Basic에서는 방향 요약만 제공합니다. 상세 조건, 무효화 기준, 세부 리스크는 Global Pro에서 확인할 수 있습니다. 이 정보는 투자 권유가 아니라 판단 보조용입니다.
              </p>
              <div className="mt-3 shrink-0 sm:mt-0">
                <ProCta compact />
              </div>
            </div>
          ) : null}

          {payload.marketThermometer?.length || payload.focusAssets?.length || payload.relationshipChecks?.length ? (
            <div className="mt-4 grid gap-3">
              {payload.marketThermometer?.length ? <MarketThermometerBlock items={payload.marketThermometer} /> : null}
              {payload.focusAssets?.length ? <FocusAssetsBlock items={payload.focusAssets} /> : null}
              {payload.relationshipChecks?.length ? <RelationshipChecksBlock items={payload.relationshipChecks} /> : null}
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
