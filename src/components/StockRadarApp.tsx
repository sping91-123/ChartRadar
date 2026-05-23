"use client";
// 글로벌 시장 주요 종목을 차트와 기술지표 레이더로 보여주는 화면.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CandlestickSeries, createChart, type IChartApi, type ISeriesApi, type Time } from "lightweight-charts";
import { Activity, AlertTriangle, BarChart3, Bookmark, BookmarkCheck, Clock3, Compass, Gauge, Loader2, RefreshCw, Search, Shield, Sparkles, Target } from "lucide-react";
import { BeginnerActionGuide, type BeginnerGuideStep, type BeginnerGuideTone } from "@/components/BeginnerActionGuide";
import { RadarInsightPanel } from "@/components/RadarInsightPanel";
import { TechnicalRadarPanel } from "@/components/TechnicalRadarPanel";
import { analyzeTimeframe, chartTimeframes, type Candle, type ChartTimeframe, type DirectionState, type TimeframeAnalysis } from "@/lib/marketAnalysis";
import { analyzeTechnicalRadar, type TechnicalRadarReport } from "@/lib/technicalRadar";
import type { StockSymbolInfo } from "@/lib/stockMarket";
import { getUsageGate, recordUsageEvent } from "@/lib/usageMeter";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { hasMarketEntitlement } from "@/lib/billing";
import { getWatchlistLimit } from "@/lib/watchlist";
import { withSupabaseAuth } from "@/lib/authFetch";
import { getChartThemeOptions, observeChartThemeChange } from "@/lib/chartTheme";
import { technicalRadarReportToRadarInsight, visibleRadarInsightForPlan } from "@/lib/radarInsight";

const fallbackUniverse: StockSymbolInfo[] = [
  { symbol: "NQ=F", name: "Nasdaq 100 Futures", group: "futures" },
  { symbol: "ES=F", name: "S&P 500 Futures", group: "futures" },
  { symbol: "GC=F", name: "Gold Futures", group: "futures" },
  { symbol: "CL=F", name: "Crude Oil Futures", group: "futures" },
  { symbol: "ZN=F", name: "10Y Treasury Note Futures", group: "futures" },
  { symbol: "SPY", name: "S&P 500 ETF", group: "index_etf" },
  { symbol: "QQQ", name: "Nasdaq 100 ETF", group: "index_etf" },
  { symbol: "^VIX", name: "CBOE Volatility Index", group: "macro_proxy" },
  { symbol: "UUP", name: "US Dollar ETF", group: "macro_proxy" },
  { symbol: "TLT", name: "20Y Treasury ETF", group: "macro_proxy" },
  { symbol: "NVDA", name: "Nvidia", group: "mega_cap" },
  { symbol: "AAPL", name: "Apple", group: "mega_cap" },
  { symbol: "SMH", name: "Semiconductor ETF", group: "ai_chip" },
  { symbol: "AMD", name: "AMD", group: "ai_chip" },
  { symbol: "TSLA", name: "Tesla", group: "growth" },
  { symbol: "JPM", name: "JPMorgan", group: "finance" },
  { symbol: "GLD", name: "Gold ETF", group: "commodity" }
];

const groupLabels: Record<StockSymbolInfo["group"], string> = {
  futures: "해외선물",
  index_etf: "지수 ETF",
  macro_proxy: "매크로 프록시",
  sector_etf: "섹터 ETF",
  mega_cap: "빅테크",
  ai_chip: "AI·반도체",
  growth: "성장주",
  finance: "금융·섹터",
  commodity: "원자재 ETF"
};

const groupOrder: StockSymbolInfo["group"][] = ["futures", "index_etf", "macro_proxy", "sector_etf", "mega_cap", "ai_chip", "growth", "finance", "commodity"];
const featuredSymbols = ["NQ=F", "ES=F", "QQQ", "SPY", "^VIX", "TLT", "NVDA", "SMH", "GLD", "CL=F"];
const globalWatchlistStorageKey = "chart-radar.globalWatchlist.v1";
const globalWatchlistMaxItems = 150;
type GlobalRadarMode = "combined" | "ict" | "technical";

const radarModes: Array<{ value: GlobalRadarMode; label: string; caption: string }> = [
  { value: "combined", label: "종합", caption: "ICT와 기술지표를 함께 봅니다." },
  { value: "ict", label: "ICT", caption: "구조와 구간만 봅니다." },
  { value: "technical", label: "기술지표", caption: "기술지표만 봅니다." }
];

const timeframeMinutes: Record<ChartTimeframe, number> = {
  "5m": 5,
  "15m": 15,
  "1h": 60,
  "4h": 240,
  "1d": 1440
};

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; candles: Candle[]; dataSource: string; cachedAt: number }
  | { status: "error"; message: string };

function formatPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "미확인";
  return value.toLocaleString("ko-KR", { maximumFractionDigits: value >= 100 ? 2 : 4 });
}

function symbolName(symbol: string, universe: StockSymbolInfo[]) {
  const found = universe.find((item) => item.symbol === symbol);
  return found ? found.name : symbol;
}

function readGlobalWatchlist() {
  if (typeof window === "undefined") return ["SPY", "QQQ", "NVDA"];

  try {
    const raw = window.localStorage.getItem(globalWatchlistStorageKey);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!Array.isArray(parsed)) return ["SPY", "QQQ", "NVDA"];
    const symbols = parsed.filter((item): item is string => typeof item === "string").slice(0, globalWatchlistMaxItems);
    return symbols.length ? symbols : ["SPY", "QQQ", "NVDA"];
  } catch {
    return ["SPY", "QQQ", "NVDA"];
  }
}

function writeGlobalWatchlist(symbols: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(globalWatchlistStorageKey, JSON.stringify(symbols.slice(0, globalWatchlistMaxItems)));
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "미확인";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function directionLabel(value: DirectionState) {
  if (value === "bullish") return "상승";
  if (value === "bearish") return "하락";
  if (value === "neutral") return "횡보";
  return "미확인";
}

function directionClass(value: DirectionState) {
  if (value === "bullish") return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  if (value === "bearish") return "border-rose-300/25 bg-rose-400/10 text-rose-100";
  return "border-slate-300/15 bg-white/[0.04] text-slate-200";
}

function formatAgeByTimeframe(age: number | undefined, timeframe: ChartTimeframe) {
  if (age === undefined || age < 0) return "시간 미확인";
  if (age === 0) return "현재 캔들";
  const minutes = age * timeframeMinutes[timeframe];
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours}시간 ${rest}분 전` : `${hours}시간 전`;
  }
  const days = Math.floor(minutes / 1440);
  const restHours = Math.floor((minutes % 1440) / 60);
  return restHours ? `${days}일 ${restHours}시간 전` : `${days}일 전`;
}

function formatIndexAge(index: number | undefined, candlesLength: number, timeframe: ChartTimeframe) {
  if (index === undefined) return "시간 미확인";
  return formatAgeByTimeframe(Math.max(0, candlesLength - 1 - index), timeframe);
}

function formatKstChartTime(time: Time, timeframe: ChartTimeframe) {
  const seconds =
    typeof time === "number"
      ? time
      : typeof time === "string"
        ? Date.parse(`${time}T00:00:00Z`) / 1000
        : Date.UTC(time.year, time.month - 1, time.day) / 1000;
  const date = new Date(seconds * 1000 + 9 * 60 * 60 * 1000);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  if (timeframe === "1d") return `${month}/${day}`;
  return `${month}/${day} ${hour}:${minute}`;
}

function formatZonePrice(low: number | null | undefined, high: number | null | undefined) {
  if (typeof low !== "number" || typeof high !== "number") return "미확인";
  return `${formatPrice(low)} - ${formatPrice(high)}`;
}

function directionTone(report: TechnicalRadarReport | null) {
  if (!report) return "neutral";
  if (report.bullishCount >= report.bearishCount + 3) return "bullish";
  if (report.bearishCount >= report.bullishCount + 3) return "bearish";
  return "neutral";
}

function toneBadgeClass(tone: "bullish" | "bearish" | "neutral") {
  if (tone === "bullish") return "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";
  if (tone === "bearish") return "border-rose-400/25 bg-rose-500/10 text-rose-200";
  return "border-sky-300/25 bg-sky-400/10 text-sky-100";
}

function isOvernightRange(minutes: number, start: number, end: number) {
  return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

function getGlobalSessionState(now = new Date()) {
  const kstMinutes = ((now.getUTCHours() + 9) % 24) * 60 + now.getUTCMinutes();
  const isUsDst = now.getUTCMonth() >= 2 && now.getUTCMonth() <= 10;
  const regularStart = isUsDst ? 22 * 60 + 30 : 23 * 60 + 30;
  const regularEnd = isUsDst ? 5 * 60 : 6 * 60;
  const preStart = isUsDst ? 17 * 60 : 18 * 60;
  const afterEnd = isUsDst ? 9 * 60 : 10 * 60;

  if (isOvernightRange(kstMinutes, regularStart, regularEnd)) {
    return {
      title: "미국 정규장 진행 중",
      detail: "가격 반응과 거래량이 가장 잘 살아나는 구간입니다. 돌파 후 지지 전환과 장중 변동성을 함께 보세요.",
      tone: "bullish" as const
    };
  }

  if (kstMinutes >= preStart && kstMinutes < regularStart) {
    return {
      title: "프리마켓 관찰 구간",
      detail: "정규장 전에 갭 방향과 주요 뉴스 반응을 먼저 확인하는 시간입니다. 확정은 정규장 초반 거래량까지 보는 편이 좋습니다.",
      tone: "neutral" as const
    };
  }

  if (isOvernightRange(kstMinutes, regularEnd, afterEnd)) {
    return {
      title: "애프터마켓 확인 구간",
      detail: "실적과 장마감 뉴스가 가격에 반영되는 구간입니다. 다음 정규장 기준선을 미리 정리하기 좋습니다.",
      tone: "neutral" as const
    };
  }

  return {
    title: "장 마감·장전 점검 구간",
    detail: "새 캔들이 적은 시간대입니다. 지금은 후보 선별과 지지·저항 기준선 정리에 더 적합합니다.",
    tone: "neutral" as const
  };
}

function groupPlaybook(group: StockSymbolInfo["group"] | undefined) {
  if (group === "futures") return "해외선물은 본장 전후에도 민감하게 움직입니다. 지수와 달러, 금리, 원자재 뉴스를 함께 보며 과한 레버리지 추격을 조심하세요.";
  if (group === "index_etf") return "지수 ETF는 전체 시장 방향의 기준선입니다. SPY와 QQQ가 같은 방향이면 개별 종목 신뢰도가 올라갑니다.";
  if (group === "macro_proxy") return "매크로 프록시는 실제 DXY나 10Y yield 대신 달러, 채권, 변동성 압력을 간접 확인하는 기준입니다. 방향보다 본장 반응과 함께 해석하세요.";
  if (group === "sector_etf") return "섹터 ETF는 시장 폭과 로테이션을 확인하는 기준입니다. 기술주만 강한지, 방어주가 앞서는지부터 확인하세요.";
  if (group === "mega_cap") return "빅테크는 실적, 금리, 나스닥 흐름에 민감합니다. 지수보다 강한지 약한지를 먼저 비교하세요.";
  if (group === "ai_chip") return "AI·반도체는 변동성이 큽니다. 강한 추세에서는 좋지만 과열 구간 추격은 위험도가 빠르게 올라갑니다.";
  if (group === "growth") return "성장주는 금리와 리스크온 심리에 민감합니다. 반등이 빨라도 지수와 거래량 확인이 중요합니다.";
  if (group === "finance") return "금융·섹터주는 금리와 경기 기대를 같이 봐야 합니다. 지수와 다른 움직임이면 섹터 이슈를 확인하세요.";
  if (group === "commodity") return "원자재 ETF는 달러, 금리, 지정학 이슈 영향을 크게 받습니다. 차트와 매크로 캘린더를 같이 보세요.";
  return "선택한 자산의 그룹 특성을 확인하고, 지수 흐름과 비교해 상대 강도를 판단하세요.";
}

function groupChecklist(group: StockSymbolInfo["group"] | undefined) {
  if (group === "futures") {
    return {
      compare: "같이 볼 시장. 달러, 금리, VIX, 관련 ETF",
      risk: "위험 포인트. 지표 발표 직후 급반전과 장 초반 휩쏘",
      action: "확인 순서. 1분 방향보다 15분과 1시간 기준선 안착을 먼저 봅니다."
    };
  }

  if (group === "index_etf") {
    return {
      compare: "같이 볼 시장. QQQ, SPY, VIX, TLT, 섹터 ETF",
      risk: "위험 포인트. 지수는 강한데 폭이 좁은 상승이면 추격 신뢰도가 낮아집니다.",
      action: "확인 순서. 지수 ETF와 선물이 같은 방향인지 먼저 맞춥니다."
    };
  }

  if (group === "macro_proxy") {
    return {
      compare: "같이 볼 시장. NQ, ES, QQQ, SPY, VIX, UUP",
      risk: "위험 포인트. 프록시는 실제 DXY와 10Y yield가 아니므로 방향 확인용으로만 봅니다.",
      action: "확인 순서. 프록시 방향과 지수선물 반응이 같은지 먼저 맞춥니다."
    };
  }

  if (group === "sector_etf") {
    return {
      compare: "같이 볼 시장. QQQ, SPY, SMH, 방어 섹터",
      risk: "위험 포인트. 지수는 강한데 섹터 확산이 좁으면 추격 신뢰도가 낮아집니다.",
      action: "확인 순서. 성장, 방어, 금융, 에너지 중 어느 축이 강한지 봅니다."
    };
  }

  if (group === "mega_cap") {
    return {
      compare: "같이 볼 시장. QQQ, XLK, 실적 일정, 옵션 만기 구간",
      risk: "위험 포인트. 개별 호재보다 지수와 섹터가 약하면 상승이 오래 버티기 어렵습니다.",
      action: "확인 순서. 선택 종목이 QQQ보다 강한지 상대 강도를 봅니다."
    };
  }

  if (group === "ai_chip") {
    return {
      compare: "같이 볼 시장. SMH, SOXX, NVDA, 금리, 달러",
      risk: "위험 포인트. 반도체는 좋은 자리도 변동폭이 커서 손절 기준이 좁으면 흔들립니다.",
      action: "확인 순서. SMH와 선택 종목이 같은 방향이면 후보 신뢰도가 올라갑니다."
    };
  }

  if (group === "growth") {
    return {
      compare: "같이 볼 시장. QQQ, ARKK, TLT, VIX",
      risk: "위험 포인트. 금리 상승과 위험회피 구간에서는 반등이 짧게 끝날 수 있습니다.",
      action: "확인 순서. 기술지표 과열보다 거래량과 지지선 회복을 먼저 봅니다."
    };
  }

  if (group === "finance") {
    return {
      compare: "같이 볼 시장. XLF, 금리, 은행주, 달러",
      risk: "위험 포인트. 금리 반응과 경기 우려가 엇갈리면 방향성이 갑자기 흐려집니다.",
      action: "확인 순서. XLF와 대형 금융주가 같은 방향인지 확인합니다."
    };
  }

  if (group === "commodity") {
    return {
      compare: "같이 볼 시장. 달러, 금리, 원자재 선물, 관련 ETF",
      risk: "위험 포인트. 원자재는 뉴스 한 줄에 갭과 긴 꼬리가 자주 나옵니다.",
      action: "확인 순서. 차트 기준선과 매크로 이벤트 시간을 함께 확인합니다."
    };
  }

  return {
    compare: "같이 볼 시장. QQQ, SPY, VIX, 금리",
    risk: "위험 포인트. 단독 종목보다 시장 전체 방향을 먼저 확인해야 합니다.",
    action: "확인 순서. 지수, 섹터, 선택 종목 순서로 좁혀갑니다."
  };
}

function GlobalAssetChecklist({ selectedInfo }: { selectedInfo: StockSymbolInfo | null }) {
  const checklist = groupChecklist(selectedInfo?.group);
  const items = [
    { icon: Compass, title: "동반 체크", body: checklist.compare },
    { icon: Shield, title: "위험 체크", body: checklist.risk },
    { icon: Target, title: "판단 순서", body: checklist.action }
  ];

  return (
    <div className="mt-3 grid gap-2 md:grid-cols-3">
      {items.map(({ icon: Icon, title, body }) => (
        <article key={title} className="rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="flex items-center gap-2">
            <Icon className="text-cyan-300" size={15} aria-hidden />
            <p className="text-xs font-black text-white">{title}</p>
          </div>
          <p className="mt-2 text-[11px] font-bold leading-5 text-slate-400 [word-break:keep-all]">{body}</p>
        </article>
      ))}
    </div>
  );
}

function GlobalPlaybook({
  report,
  latest,
  changePercent,
  selectedInfo,
  sessionState
}: {
  report: TechnicalRadarReport | null;
  latest: Candle | null;
  changePercent: number | null;
  selectedInfo: StockSymbolInfo | null;
  sessionState: ReturnType<typeof getGlobalSessionState> | null;
}) {
  const supportDistance = report?.supportResistance.supportDistancePercent ?? null;
  const resistanceDistance = report?.supportResistance.resistanceDistancePercent ?? null;
  const tone = directionTone(report);
  const riskScore = report ? Math.min(100, Math.max(0, report.fearGreed.score + Math.max(0, report.bearishCount - report.bullishCount) * 6)) : null;
  const focus =
    tone === "bullish"
      ? "상승 추세 유지 여부"
      : tone === "bearish"
        ? "하락 압력 방어 여부"
        : "방향 확정 전 기준선 반응";
  const basis =
    resistanceDistance !== null && resistanceDistance <= 1.2
      ? "저항선이 가깝습니다. 돌파 후 안착하지 못하면 단기 되돌림을 먼저 의심하세요."
      : supportDistance !== null && supportDistance <= 1.2
        ? "지지선이 가깝습니다. 지지 반응과 거래량 회복이 같이 나오는지 보세요."
        : "지지와 저항 사이 중간 구간입니다. 추격보다 다음 기준선까지의 여유를 먼저 확인하세요.";

  return (
    <div className="mt-5 grid gap-3 lg:grid-cols-4">
      <article className={`rounded-lg border p-4 ${toneBadgeClass(sessionState?.tone ?? "neutral")}`}>
        <Clock3 size={20} aria-hidden />
        <p className="mt-3 text-xs font-black opacity-80">미국장 구간</p>
        <h3 className="mt-2 text-base font-black text-white">{sessionState?.title ?? "미국장 시간 확인 중"}</h3>
        <p className="mt-2 text-xs leading-5 text-slate-300">{sessionState?.detail ?? "현재 한국 시간 기준 미국장 구간을 확인하고 있습니다."}</p>
      </article>

      <article className={`rounded-lg border p-4 ${toneBadgeClass(tone)}`}>
        <Compass size={20} aria-hidden />
        <p className="mt-3 text-xs font-black opacity-80">먼저 볼 것</p>
        <h3 className="mt-2 text-base font-black text-white">{focus}</h3>
        <p className="mt-2 text-xs leading-5 text-slate-300">
          {selectedInfo?.symbol ?? "선택 자산"} {latest ? formatPrice(latest.close) : "가격 확인 중"} · {formatPercent(changePercent)}
        </p>
      </article>

      <article className="rounded-lg border border-white/10 bg-black/20 p-4">
        <Target className="text-cyan-300" size={20} aria-hidden />
        <p className="mt-3 text-xs font-black text-slate-400">기준선</p>
        <h3 className="mt-2 text-base font-black text-white">기준선 행동</h3>
        <p className="mt-2 text-xs leading-5 text-slate-300">{basis}</p>
      </article>

      <article className="rounded-lg border border-white/10 bg-black/20 p-4">
        <Shield className="text-cyan-300" size={20} aria-hidden />
        <p className="mt-3 text-xs font-black text-slate-400">위험 메모</p>
        <h3 className="mt-2 text-base font-black text-white">위험도 {riskScore === null ? "확인 중" : `${Math.round(riskScore)}%`}</h3>
        <p className="mt-2 text-xs leading-5 text-slate-300">{groupPlaybook(selectedInfo?.group)}</p>
      </article>
    </div>
  );
}

function beginnerToneFromTechnical(tone: DirectionState): BeginnerGuideTone {
  if (tone === "bullish") return "success";
  if (tone === "bearish") return "danger";
  if (tone === "neutral") return "warning";
  return "neutral";
}

function buildGlobalBeginnerSteps(
  report: TechnicalRadarReport | null,
  selectedInfo: StockSymbolInfo | null,
  sessionState: ReturnType<typeof getGlobalSessionState> | null
): BeginnerGuideStep[] {
  const tone = directionTone(report);
  const checklist = groupChecklist(selectedInfo?.group);
  const selectedLabel = selectedInfo ? `${selectedInfo.symbol} ${selectedInfo.name}` : "선택 자산";
  const supportDistance = report?.supportResistance.supportDistancePercent ?? null;
  const resistanceDistance = report?.supportResistance.resistanceDistancePercent ?? null;
  const distanceMemo =
    resistanceDistance !== null && resistanceDistance <= 1.2
      ? "저항선이 가까우면 돌파 후 안착 여부를 먼저 봅니다."
      : supportDistance !== null && supportDistance <= 1.2
        ? "지지선이 가까우면 반등과 거래량 회복이 같이 나오는지 확인합니다."
        : "지지와 저항 사이 중간 구간이면 기준선까지 기다리는 편이 더 명확합니다.";

  return [
    {
      label: "1. 시장 시간",
      title: sessionState?.title ?? "미국장 시간 확인",
      body: sessionState?.detail ?? "현재 한국 시간 기준 미국장 구간을 확인하고 있습니다.",
      tone: "info"
    },
    {
      label: "2. 방향 압축",
      title: tone === "bullish" ? "상승 우위 유지 확인" : tone === "bearish" ? "하락 압력 방어 확인" : "방향 확정 대기",
      body: report?.summary ?? `${selectedLabel} 캔들이 충분히 쌓이면 추세, 모멘텀, 변동성을 요약합니다.`,
      tone: beginnerToneFromTechnical(tone)
    },
    {
      label: "3. 실행 전 차단",
      title: "지수, 섹터, 종목 순서",
      body: `${checklist.action} ${distanceMemo}`,
      tone: "warning"
    }
  ];
}

function GlobalBeginnerGuide({
  report,
  selectedInfo,
  sessionState
}: {
  report: TechnicalRadarReport | null;
  selectedInfo: StockSymbolInfo | null;
  sessionState: ReturnType<typeof getGlobalSessionState> | null;
}) {
  return (
    <div className="mt-5">
      <BeginnerActionGuide
        eyebrow="글로벌 초보자용"
        title="글로벌은 이 순서로 좁혀가면 됩니다"
        summary="해외 종목은 단독 차트보다 시장 시간, 지수 방향, 섹터 흐름을 같이 봐야 판단이 단순해집니다. 아래 3단계를 먼저 보고 세부 지표로 내려가세요."
        steps={buildGlobalBeginnerSteps(report, selectedInfo, sessionState)}
        checklist={[
          "지수와 선택 종목 방향이 같은지 확인",
          "가까운 지지·저항까지 남은 폭 확인",
          "지표 발표나 개장 직후 급변 구간인지 확인"
        ]}
        help="글로벌 레이더는 미국장 시간대, 기술지표 방향, 선택 자산의 그룹 특성을 합쳐 확인 순서를 정리합니다. 종목만 강하고 지수나 섹터가 약하면 판단 신뢰도가 낮아집니다."
      />
    </div>
  );
}

function StockSnapshot({
  report,
  latest,
  changePercent
}: {
  report: TechnicalRadarReport | null;
  latest: Candle | null;
  changePercent: number | null;
}) {
  const tone = directionTone(report);
  const support = report?.supportResistance.support ?? null;
  const resistance = report?.supportResistance.resistance ?? null;

  return (
    <div className="grid gap-3 lg:grid-cols-4">
      <div className={`rounded-lg border p-4 lg:col-span-2 ${toneBadgeClass(tone)}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] opacity-80">세부 근거 요약</p>
            <h3 className="mt-2 text-2xl font-black text-white">기술지표 근거 분포</h3>
          </div>
          <Gauge size={24} aria-hidden />
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-200">
          상단 판단에 사용된 상승, 하락, 횡보 근거 수와 가까운 가격 기준선을 분리해 확인합니다.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md bg-black/20 p-2">
            <p className="text-lg font-black text-emerald-300">{report?.bullishCount ?? "-"}</p>
            <p className="text-[11px] font-bold text-slate-300">상승 근거</p>
          </div>
          <div className="rounded-md bg-black/20 p-2">
            <p className="text-lg font-black text-rose-300">{report?.bearishCount ?? "-"}</p>
            <p className="text-[11px] font-bold text-slate-300">하락 근거</p>
          </div>
          <div className="rounded-md bg-black/20 p-2">
            <p className="text-lg font-black text-slate-200">{report?.neutralCount ?? "-"}</p>
            <p className="text-[11px] font-bold text-slate-300">횡보 근거</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-surface-line bg-black/20 p-4">
        <Activity className="text-cyan-300" size={20} aria-hidden />
        <p className="mt-3 text-xs font-bold text-slate-400">현재가와 변동</p>
        <p className="mt-1 text-2xl font-black text-white">{latest ? formatPrice(latest.close) : "미확인"}</p>
        <p className={`mt-1 text-sm font-black ${changePercent !== null && changePercent >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
          {formatPercent(changePercent)}
        </p>
      </div>

      <div className="rounded-lg border border-surface-line bg-black/20 p-4">
        <Shield className="text-cyan-300" size={20} aria-hidden />
        <p className="mt-3 text-xs font-bold text-slate-400">가까운 기준선</p>
        <p className="mt-1 text-sm font-black text-emerald-200">지지 {formatPrice(support)}</p>
        <p className="mt-1 text-sm font-black text-rose-200">저항 {formatPrice(resistance)}</p>
      </div>

      {report && report.fearGreed.score >= 75 ? (
        <div className="rounded-lg border border-amber-300/25 bg-amber-500/10 p-4 lg:col-span-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-amber-300" size={18} aria-hidden />
            <p className="text-sm leading-6 text-amber-100">
              캔들 기반 심리 참고값이 높은 편입니다. 추세가 강해도 과열 구간에서는 추격보다 눌림, 지지선, 거래량 확인이 더 중요합니다.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ictDirectionLabel(direction: "bullish" | "bearish") {
  return direction === "bullish" ? "상승" : "하락";
}

function premiumDiscountLabel(value: TimeframeAnalysis["premiumDiscount"]) {
  if (value === "premium") return "프리미엄";
  if (value === "discount") return "디스카운트";
  if (value === "equilibrium") return "균형가";
  return "미확인";
}

function oteZoneLabel(value: TimeframeAnalysis["oteZone"]) {
  if (value === "long") return "롱 OTE";
  if (value === "short") return "숏 OTE";
  return "OTE 밖";
}

function pocPositionLabel(value: TimeframeAnalysis["volumeProfile"]) {
  if (!value) return "POC 미확인";
  if (value.position === "above") return "POC 위";
  if (value.position === "below") return "POC 아래";
  return "POC 근처";
}

function IctStatusCard({
  title,
  value,
  detail,
  tone = "neutral"
}: {
  title: string;
  value: string;
  detail: string;
  tone?: DirectionState;
}) {
  return (
    <article className={`rounded-lg border p-3 ${directionClass(tone)}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.16em] opacity-75">{title}</p>
      <h4 className="mt-2 text-base font-black text-white">{value}</h4>
      <p className="mt-2 text-xs leading-5 text-slate-300">{detail}</p>
    </article>
  );
}

function GlobalIctPanel({ analysis, timeframe, candlesLength }: { analysis: TimeframeAnalysis; timeframe: ChartTimeframe; candlesLength: number }) {
  const scoreTone: DirectionState = analysis.score >= 1.2 ? "bullish" : analysis.score <= -1.2 ? "bearish" : "neutral";
  const scoreLabel = analysis.score >= 1.2 ? "상승 구조 우세" : analysis.score <= -1.2 ? "하락 구조 우세" : "구조 관찰";
  const latestOb = analysis.latestOb;
  const latestFvg = analysis.latestFvg;
  const latestSweep = analysis.latestSweep;
  const latestCisd = analysis.latestCisd;
  const latestDisplacement = analysis.latestDisplacement;

  return (
    <section className="rounded-lg border border-surface-line bg-black/20 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-accent-blue">ICT Radar</p>
          <h3 className="mt-1 text-xl font-black text-white">{timeframe} 구조 판독</h3>
        </div>
        <span className={`inline-flex min-h-8 items-center rounded-md border px-3 text-xs font-black ${directionClass(scoreTone)}`}>
          {scoreLabel} · {analysis.score > 0 ? "+" : ""}
          {analysis.score.toFixed(2)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <IctStatusCard
          title="MSB"
          value={directionLabel(analysis.msb)}
          detail={
            analysis.latestMsbEvent
              ? `${formatPrice(analysis.latestMsbEvent.level)} 기준 · ${formatIndexAge(analysis.latestMsbEvent.index, candlesLength, timeframe)}`
              : "현재 구조 방향을 기준으로 표시합니다."
          }
          tone={analysis.msb}
        />
        <IctStatusCard
          title="CHoCH"
          value={directionLabel(analysis.choch)}
          detail={
            analysis.latestChochEvent
              ? `${formatPrice(analysis.latestChochEvent.level)} 기준 · ${formatIndexAge(analysis.latestChochEvent.index, candlesLength, timeframe)}`
              : "최근 단기 구조 전환을 기준으로 표시합니다."
          }
          tone={analysis.choch}
        />
        <IctStatusCard
          title="OB"
          value={latestOb ? `${ictDirectionLabel(latestOb.direction)} OB ${analysis.inOb ? "내부" : "외부"}` : "최근 OB 미확인"}
          detail={latestOb ? `${formatZonePrice(latestOb.bottom, latestOb.top)} · ${formatAgeByTimeframe(latestOb.age, timeframe)}` : "유효한 오더블록이 아직 선명하지 않습니다."}
          tone={latestOb?.direction ?? "neutral"}
        />
        <IctStatusCard
          title="FVG"
          value={latestFvg ? `${ictDirectionLabel(latestFvg.direction)} ${latestFvg.state === "ifvg" ? "iFVG" : "FVG"} ${analysis.inFvg ? "내부" : "외부"}` : "최근 FVG 미확인"}
          detail={latestFvg ? `${formatZonePrice(latestFvg.bottom, latestFvg.top)} · ${formatAgeByTimeframe(latestFvg.age, timeframe)}` : "강한 가격 불균형 구간이 아직 선명하지 않습니다."}
          tone={latestFvg?.direction ?? "neutral"}
        />
        <IctStatusCard
          title="Sweep"
          value={latestSweep ? `${latestSweep.direction === "bullish" ? "저점 스윕" : "고점 스윕"}` : "스윕 미확인"}
          detail={latestSweep ? `${formatPrice(latestSweep.level)} · ${formatAgeByTimeframe(latestSweep.age, timeframe)}` : "최근 유동성 스윕이 뚜렷하지 않습니다."}
          tone={latestSweep?.direction ?? "neutral"}
        />
        <IctStatusCard
          title="CISD"
          value={latestCisd ? `${ictDirectionLabel(latestCisd.direction)} CISD` : "CISD 미확인"}
          detail={latestCisd ? `${formatPrice(latestCisd.level)} · ${formatAgeByTimeframe(latestCisd.age, timeframe)}` : "OB 반응 이후 상태 변화가 아직 확인되지 않았습니다."}
          tone={latestCisd?.direction ?? "neutral"}
        />
        <IctStatusCard
          title="PD / OTE"
          value={`${premiumDiscountLabel(analysis.premiumDiscount)} · ${oteZoneLabel(analysis.oteZone)}`}
          detail={
            analysis.oteLevels
              ? `롱 ${formatZonePrice(analysis.oteLevels.longLow, analysis.oteLevels.longHigh)} · 숏 ${formatZonePrice(analysis.oteLevels.shortLow, analysis.oteLevels.shortHigh)}`
              : "최근 딜링레인지 기준을 확인 중입니다."
          }
          tone={analysis.oteZone === "long" ? "bullish" : analysis.oteZone === "short" ? "bearish" : "neutral"}
        />
        <IctStatusCard
          title="POC / EMA"
          value={`${pocPositionLabel(analysis.volumeProfile)} · EMA200 ${analysis.ema200Side === "above" ? "위" : analysis.ema200Side === "below" ? "아래" : "미확인"}`}
          detail={`POC ${analysis.volumeProfile ? formatPrice(analysis.volumeProfile.poc) : "미확인"} · EMA200 ${formatPrice(analysis.ema200Value)}`}
          tone={analysis.ema200Side === "above" ? "bullish" : analysis.ema200Side === "below" ? "bearish" : "neutral"}
        />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <IctStatusCard
          title="Displacement"
          value={latestDisplacement ? `${ictDirectionLabel(latestDisplacement.direction)} 변위` : "변위 미확인"}
          detail={latestDisplacement ? `강도 ${latestDisplacement.strength}점 · ${formatAgeByTimeframe(latestDisplacement.age, timeframe)}` : "강한 몸통 변위 캔들이 최근 구간에 뚜렷하지 않습니다."}
          tone={latestDisplacement?.direction ?? "neutral"}
        />
        <IctStatusCard
          title="Buy-side"
          value={analysis.buySideLiquidity ? formatPrice(analysis.buySideLiquidity.level) : "미확인"}
          detail={analysis.buySideLiquidity ? `${formatAgeByTimeframe(analysis.buySideLiquidity.age, timeframe)} · 거리 ${analysis.buySideLiquidity.distancePercent.toFixed(2)}%` : "가까운 매수 유동성 풀을 찾지 못했습니다."}
          tone="neutral"
        />
        <IctStatusCard
          title="Sell-side"
          value={analysis.sellSideLiquidity ? formatPrice(analysis.sellSideLiquidity.level) : "미확인"}
          detail={analysis.sellSideLiquidity ? `${formatAgeByTimeframe(analysis.sellSideLiquidity.age, timeframe)} · 거리 ${analysis.sellSideLiquidity.distancePercent.toFixed(2)}%` : "가까운 매도 유동성 풀을 찾지 못했습니다."}
          tone="neutral"
        />
      </div>
    </section>
  );
}

function GlobalRadarControlDock({
  timeframe,
  onTimeframeChange,
  radarMode,
  onRadarModeChange,
  showMobileDock
}: {
  timeframe: ChartTimeframe;
  onTimeframeChange: (value: ChartTimeframe) => void;
  radarMode: GlobalRadarMode;
  onRadarModeChange: (value: GlobalRadarMode) => void;
  showMobileDock: boolean;
}) {
  const renderContent = () => (
    <>
      <div className="grid grid-cols-5 gap-1.5">
        {chartTimeframes.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onTimeframeChange(item)}
            className={`min-h-10 rounded-md border px-2 text-xs font-black transition ${
              timeframe === item
                ? "border-accent-blue bg-accent-blue text-slate-950"
                : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-accent-blue/60"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {radarModes.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onRadarModeChange(item.value)}
            className={`min-h-9 rounded-md border px-2 text-xs font-black transition ${
              radarMode === item.value
                ? "border-white/20 bg-white text-slate-950"
                : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/25"
            }`}
            title={item.caption}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );

  return (
    <>
      <div
        className={`fixed inset-x-2 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-40 mx-auto rounded-lg border border-surface-line bg-slate-950/94 p-2 shadow-2xl shadow-black/50 backdrop-blur sm:hidden ${showMobileDock ? "block" : "hidden"}`}
        aria-label="글로벌 자산레이더 모바일 조작 패널"
      >
        {renderContent()}
      </div>
      <div
        className="sticky top-3 z-20 mx-auto hidden max-w-5xl rounded-lg border border-surface-line bg-slate-950/92 p-2 shadow-2xl shadow-black/40 backdrop-blur sm:block"
        aria-label="글로벌 자산레이더 조작 패널"
      >
        {renderContent()}
      </div>
    </>
  );
}

export function StockRadarApp() {
  const { profile } = useSupabaseAuth();
  const pathname = usePathname();
  const isPaid = hasMarketEntitlement(profile?.plan, "stocks");
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [symbol, setSymbol] = useState("QQQ");
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("1d");
  const [radarMode, setRadarMode] = useState<GlobalRadarMode>("combined");
  const [universe, setUniverse] = useState<StockSymbolInfo[]>(fallbackUniverse);
  const [selectedGroup, setSelectedGroup] = useState<StockSymbolInfo["group"] | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const [sessionState, setSessionState] = useState<ReturnType<typeof getGlobalSessionState> | null>(null);
  const [savedSymbols, setSavedSymbols] = useState<string[]>([]);
  const watchlistLimit = getWatchlistLimit(profile?.plan ?? "free");
  const showMobileDock = pathname === "/global/assets";

  const selectedInfo = useMemo(() => universe.find((item) => item.symbol === symbol) ?? null, [symbol, universe]);
  const featuredItems = useMemo(
    () => featuredSymbols.map((featuredSymbol) => universe.find((item) => item.symbol === featuredSymbol)).filter(Boolean) as StockSymbolInfo[],
    [universe]
  );
  const visibleUniverse = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return universe
      .filter((item) => selectedGroup === "all" || item.group === selectedGroup)
      .filter((item) => !query || item.symbol.toLowerCase().includes(query) || item.name.toLowerCase().includes(query))
      .slice(0, 48);
  }, [searchQuery, selectedGroup, universe]);
  const savedItems = useMemo(
    () => savedSymbols.map((savedSymbol) => universe.find((item) => item.symbol === savedSymbol)).filter(Boolean) as StockSymbolInfo[],
    [savedSymbols, universe]
  );
  const visibleSavedItems = useMemo(() => savedItems.slice(0, watchlistLimit), [savedItems, watchlistLimit]);
  const isSavedSymbol = savedSymbols.includes(symbol);
  const canSaveSelectedSymbol = isSavedSymbol || savedSymbols.length < watchlistLimit;

  const toggleSavedSymbol = useCallback((targetSymbol: string) => {
    setSavedSymbols((current) => {
      const normalized = targetSymbol.toUpperCase();
      if (!current.includes(normalized) && current.length >= watchlistLimit) return current;
      const next = current.includes(normalized)
        ? current.filter((item) => item !== normalized)
        : [normalized, ...current].slice(0, globalWatchlistMaxItems);
      writeGlobalWatchlist(next);
      return next;
    });
  }, [watchlistLimit]);

  const load = useCallback(async () => {
    const usageGate = getUsageGate("stockRadar", isPaid);
    if (!usageGate.allowed) {
      setState({ status: "error", message: usageGate.message });
      return;
    }

    setState({ status: "loading" });
    try {
      const response = await fetch(
        `/api/stocks/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`,
        await withSupabaseAuth({ cache: "no-store" })
      );
      const data = (await response.json().catch(() => ({}))) as {
        candles?: Candle[];
        dataSource?: string;
        cachedAt?: number;
        universe?: StockSymbolInfo[];
        error?: string;
      };

      if (Array.isArray(data.universe) && data.universe.length) setUniverse(data.universe);
      if (!response.ok) throw new Error("글로벌 시장 흐름을 잠시 확인하지 못했습니다. 잠시 뒤 다시 확인해 주세요.");
      if (!Array.isArray(data.candles) || data.candles.length === 0) {
        throw new Error("이 자산의 최근 가격 흐름을 잠시 확인하지 못했습니다. 다른 자산을 먼저 확인해 주세요.");
      }

      setState({
        status: "ready",
        candles: data.candles,
        dataSource: data.dataSource ?? "글로벌 시장 데이터",
        cachedAt: data.cachedAt ?? Date.now()
      });
      recordUsageEvent("stockRadar");
    } catch (error) {
      const message = error instanceof Error ? error.message : "글로벌 시장 흐름을 잠시 확인하지 못했습니다.";
      setState({ status: "error", message });
    }
  }, [isPaid, symbol, timeframe]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSessionState(getGlobalSessionState());
    const timer = window.setInterval(() => setSessionState(getGlobalSessionState()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setSavedSymbols(readGlobalWatchlist());
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    const chartThemeOptions = getChartThemeOptions();

    const chart = createChart(chartRef.current, {
      height: 360,
      ...chartThemeOptions,
      localization: {
        timeFormatter: (time: Time) => formatKstChartTime(time, timeframe)
      },
      timeScale: {
        ...chartThemeOptions.timeScale,
        timeVisible: timeframe !== "1d",
        tickMarkFormatter: (time: Time) => formatKstChartTime(time, timeframe)
      }
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444"
    });

    chartApiRef.current = chart;
    candleSeriesRef.current = series;
    const stopObservingTheme = observeChartThemeChange(() => {
      const nextThemeOptions = getChartThemeOptions();
      chart.applyOptions({
        ...nextThemeOptions,
        timeScale: {
          ...nextThemeOptions.timeScale,
          timeVisible: timeframe !== "1d",
          tickMarkFormatter: (time: Time) => formatKstChartTime(time, timeframe)
        }
      });
    });

    const resizeObserver = new ResizeObserver(() => {
      if (!chartRef.current) return;
      chart.applyOptions({ width: chartRef.current.clientWidth });
    });
    resizeObserver.observe(chartRef.current);

    return () => {
      stopObservingTheme();
      resizeObserver.disconnect();
      chart.remove();
      chartApiRef.current = null;
      candleSeriesRef.current = null;
    };
  }, [timeframe]);

  useEffect(() => {
    if (state.status !== "ready" || !candleSeriesRef.current || !chartApiRef.current) return;
    candleSeriesRef.current.setData(
      state.candles.map((candle) => ({
        time: candle.time as Time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close
      }))
    );
    chartApiRef.current.timeScale().fitContent();
  }, [state]);

  const latest = state.status === "ready" ? state.candles[state.candles.length - 1] : null;
  const previous = state.status === "ready" ? state.candles[state.candles.length - 2] : null;
  const changePercent = latest && previous ? ((latest.close - previous.close) / previous.close) * 100 : null;
  const technicalReport = useMemo(() => (state.status === "ready" ? analyzeTechnicalRadar(state.candles) : null), [state]);
  const radarInsight = useMemo(
    () =>
      technicalReport
        ? technicalRadarReportToRadarInsight(technicalReport, {
            market: "global",
            symbol,
            timeframe,
            sessionNote: sessionState?.detail ?? undefined,
            groupNote: groupPlaybook(selectedInfo?.group)
          })
        : null,
    [selectedInfo?.group, sessionState?.detail, symbol, technicalReport, timeframe]
  );
  const visibleRadarInsight = useMemo(
    () => (radarInsight ? visibleRadarInsightForPlan(radarInsight, isPaid) : null),
    [isPaid, radarInsight]
  );
  const ictAnalysis = useMemo(
    () => (state.status === "ready" ? analyzeTimeframe(timeframe, state.candles, { zigLen: 5, useCloseForMsb: true }) : null),
    [state, timeframe]
  );

  return (
    <section
      id="asset-radar"
      className="scroll-mt-24 rounded-lg border border-surface-line bg-surface-card p-4 pb-40 shadow-glow sm:p-5 sm:pb-36"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-accent-blue/30 bg-accent-blue/15 text-accent-blue">
            <BarChart3 size={21} aria-hidden />
          </div>
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-accent-blue">자산레이더</p>
            <h2 className="mt-1 text-xl font-black text-white">선택 자산 상세 판단</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              글로벌 전체 판단 이후 개별 종목을 확인하는 심화 영역입니다.
              상단 대시보드의 시장 모드, 매크로 압력, 섹터 로테이션과 함께 해석하세요.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-accent-blue/30 bg-accent-blue/10 px-3 text-xs font-black text-accent-blue transition hover:bg-accent-blue hover:text-slate-950"
        >
          <RefreshCw size={14} aria-hidden />
          새로고침
        </button>
      </div>

      <div className="mt-5 rounded-lg border border-accent-blue/20 bg-accent-blue/[0.06] p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.18em] text-accent-blue">
              <Sparkles size={13} aria-hidden />
              상세 확인할 글로벌 자산
            </p>
            <h3 className="mt-2 break-words text-2xl font-black text-white">
              {symbol}{" "}
              <span className="ml-2 text-base font-bold text-slate-400">{selectedInfo?.name ?? symbol}</span>
            </h3>
            <p className="mt-1 text-xs font-bold text-slate-500">
              {selectedInfo ? groupLabels[selectedInfo.group] : "관심 시장"} · {timeframe} · {radarModes.find((item) => item.value === radarMode)?.label ?? "종합"} 분석
            </p>
          </div>
          <label className="relative block lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} aria-hidden />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="종목 검색"
              className="h-11 w-full rounded-md border border-surface-line bg-surface-cardSoft pl-9 pr-3 text-sm font-bold text-white outline-none transition placeholder:text-slate-600 focus:border-accent-blue/70"
            />
          </label>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {featuredItems.map((item) => (
            <button
              key={item.symbol}
              type="button"
              onClick={() => {
                setSymbol(item.symbol);
                setSearchQuery("");
              }}
              className={`min-h-11 shrink-0 rounded-md border px-3 text-left transition ${
                symbol === item.symbol
                  ? "border-accent-blue bg-accent-blue text-slate-950"
                  : "border-surface-line bg-surface-cardSoft text-slate-200 hover:border-accent-blue/60"
              }`}
            >
              <span className="block text-sm font-black">{item.symbol}</span>
              <span className={`block text-[10px] font-bold ${symbol === item.symbol ? "text-slate-800" : "text-slate-500"}`}>
                {groupLabels[item.group]}
              </span>
            </button>
          ))}
        </div>

        <GlobalAssetChecklist selectedInfo={selectedInfo} />

        <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black text-white">관심 글로벌 종목</p>
              <p className="mt-1 text-[11px] font-bold text-slate-500">
                매일 보는 ETF와 종목을 저장하면 이곳에 고정됩니다. 미국장 30초 체크 이후 개별 판단을 이어가세요.
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleSavedSymbol(symbol)}
              disabled={!canSaveSelectedSymbol}
              className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:border-slate-500/30 disabled:bg-slate-500/10 disabled:text-slate-500 ${
                isSavedSymbol
                  ? "border-emerald-300/35 bg-emerald-300/15 text-emerald-200"
                  : "border-accent-blue/30 bg-accent-blue/10 text-accent-blue hover:bg-accent-blue hover:text-slate-950"
              }`}
            >
              {isSavedSymbol ? <BookmarkCheck size={13} aria-hidden /> : <Bookmark size={13} aria-hidden />}
              {isSavedSymbol ? "저장됨" : canSaveSelectedSymbol ? "관심 추가" : "한도 도달"}
            </button>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {visibleSavedItems.map((item) => (
              <button
                key={item.symbol}
                type="button"
                onClick={() => {
                  setSymbol(item.symbol);
                  setSearchQuery("");
                }}
                className={`min-h-10 shrink-0 rounded-md border px-3 text-left transition ${
                  symbol === item.symbol
                    ? "border-emerald-300 bg-emerald-300 text-slate-950"
                    : "border-white/10 bg-surface-cardSoft text-slate-200 hover:border-emerald-300/60"
                }`}
              >
                <span className="block text-xs font-black">{item.symbol}</span>
                <span className={`block max-w-[110px] truncate text-[10px] font-bold ${symbol === item.symbol ? "text-slate-800" : "text-slate-500"}`}>
                  {item.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(["all", ...groupOrder] as Array<StockSymbolInfo["group"] | "all">).map((group) => (
            <button
              key={group}
              type="button"
              onClick={() => setSelectedGroup(group)}
              className={`min-h-8 rounded-md border px-2.5 text-[11px] font-black transition ${
                selectedGroup === group
                  ? "border-white/20 bg-white text-slate-950"
                  : "border-white/10 bg-black/20 text-slate-300 hover:border-accent-blue/60"
              }`}
            >
              {group === "all" ? "전체" : groupLabels[group]}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {visibleUniverse.map((item) => (
            <button
              key={item.symbol}
              type="button"
              onClick={() => setSymbol(item.symbol)}
              className={`min-h-12 rounded-md border px-2.5 text-left transition ${
                symbol === item.symbol
                  ? "border-accent-blue bg-accent-blue/90 text-slate-950"
                  : "border-white/10 bg-black/20 text-slate-200 hover:border-accent-blue/60"
              }`}
            >
              <span className="block text-sm font-black">{item.symbol}</span>
              <span className={`block truncate text-[11px] font-bold ${symbol === item.symbol ? "text-slate-800" : "text-slate-500"}`}>
                {item.name}
              </span>
            </button>
          ))}
        </div>
        {visibleUniverse.length === 0 ? (
          <p className="mt-3 rounded-md border border-white/10 bg-black/20 p-3 text-xs font-bold text-slate-500">
            검색 결과가 없습니다. 종목명이나 심볼을 조금 짧게 입력해 보세요.
          </p>
        ) : null}
      </div>

      {state.status === "ready" && radarMode !== "ict" && visibleRadarInsight ? (
        <div className="mt-5">
          <RadarInsightPanel insight={visibleRadarInsight} isPro={isPaid} />
          <div className="mt-5">
            <StockSnapshot report={technicalReport} latest={latest} changePercent={changePercent} />
          </div>
        </div>
      ) : null}

      <div className="mt-5 rounded-lg border border-surface-line bg-black/20 p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">선택 종목</p>
            <h3 className="mt-1 text-2xl font-black text-white">
              {symbol} <span className="text-base text-slate-500">{symbolName(symbol, universe)}</span>
            </h3>
          </div>
          {latest ? (
            <div className="text-left sm:text-right">
              <p className="text-xl font-black text-white">{formatPrice(latest.close)}</p>
              <p className={`text-xs font-bold ${changePercent !== null && changePercent >= 0 ? "text-signal-success" : "text-signal-danger"}`}>
                {changePercent === null ? "변동률 미확인" : `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`}
              </p>
            </div>
          ) : null}
        </div>

        {state.status === "loading" ? (
          <div className="grid h-[360px] place-items-center rounded-md border border-white/10 bg-white/[0.02] text-sm text-slate-400">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="animate-spin" size={16} aria-hidden />
              글로벌 시장 데이터를 불러오는 중입니다.
            </span>
          </div>
        ) : state.status === "error" ? (
          <div className="rounded-md border border-signal-danger/30 bg-signal-danger/10 p-4 text-sm text-signal-danger">
            {state.message}
          </div>
        ) : (
          <div ref={chartRef} className="h-[360px] w-full" />
        )}
      </div>

      {state.status === "ready" ? (
        <>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            현재 화면은 {state.dataSource} 가격 흐름을 한국 시간 기준으로 정리합니다.
          </p>
          {radarMode !== "technical" && ictAnalysis ? (
            <div className="mt-5">
              <GlobalIctPanel analysis={ictAnalysis} timeframe={timeframe} candlesLength={state.candles.length} />
            </div>
          ) : null}
          {radarMode !== "ict" ? (
            <div className="mt-5">
              <TechnicalRadarPanel
                candles={state.candles}
                timeframe={timeframe}
                assetLabel={selectedInfo?.name ? `${selectedInfo.name}(${symbol})` : symbol}
                intro="이동평균, MACD, RSI, 일목균형표, Supertrend, 거래량, 변동성 지표로 글로벌 자산의 방향과 과열도를 확인합니다."
              />
            </div>
          ) : null}
        </>
      ) : null}
      <GlobalRadarControlDock
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        radarMode={radarMode}
        onRadarModeChange={setRadarMode}
        showMobileDock={showMobileDock}
      />
    </section>
  );
}
