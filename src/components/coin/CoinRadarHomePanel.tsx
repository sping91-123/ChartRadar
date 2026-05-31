"use client";
// Coin Radar 홈에서 대표 코인과 BTC 기준 시장 체력을 빠르게 요약합니다.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, RefreshCw, TrendingUp, X } from "lucide-react";
import { ActionButton, PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";
import type { CoinMarketMetricsPayload } from "@/lib/coinMarketMetrics";
import type { Candle } from "@/lib/marketAnalysis";
import type { LiquidationPressureReport } from "@/lib/liquidationPressure";
import { analyzeTechnicalRadar, type IndicatorReading, type TechnicalRadarReport } from "@/lib/technicalRadar";
import { buildCoinHomeDecision, type CoinHomeDecisionSummary } from "@/components/coin/coinHomeDecisionModel";

interface MarketBoardItem {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  quoteVolume: number;
}

interface CoinHomeData {
  board: MarketBoardItem[];
  technical: TechnicalRadarReport | null;
  technical4h: TechnicalRadarReport | null;
  funding: Partial<Record<RepresentativeSymbol, LiquidationPressureReport>>;
  marketMetrics: CoinMarketMetricsPayload | null;
  analysisUpdatedAt: number;
}

type CoinHomeState =
  | { status: "loading" }
  | { status: "ready"; data: CoinHomeData }
  | { status: "error"; message: string };

const tileSymbols = ["BTC", "ETH", "XRP", "SOL", "DOGE", "BNB"] as const;

type RepresentativeSymbol = (typeof tileSymbols)[number];
type ConclusionSegment = { text: string; tone?: "up" | "down" };
type DirectionTone = "up" | "down";
type VisualTone = "long" | "short" | "watch" | "risk" | "info";

const tradingViewLogoIds: Record<RepresentativeSymbol, string> = {
  BTC: "XTVCBTC",
  ETH: "XTVCETH",
  XRP: "XTVCXRP",
  SOL: "XTVCSOL",
  DOGE: "XTVCDOGE",
  BNB: "XTVCBNB"
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function compactSymbol(symbol: string) {
  return symbol.replace("USDT.P", "").replace("USDT", "");
}

function formatPrice(price: number) {
  if (!Number.isFinite(price) || price <= 0) return "-";
  const digits = price >= 100 ? 2 : price >= 10 ? 3 : price >= 1 ? 4 : 5;
  return price.toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

function formatPercent(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "미확인";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function formatPlainPercent(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "미확인";
  return `${value.toFixed(digits)}%`;
}

function formatRatio(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "미확인";
  return value.toFixed(2);
}

function formatKrwRate(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "미확인";
  return `₩${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}`;
}

function parseReadingNumber(value: string | undefined) {
  const match = value?.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function toneFromPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "info" as const;
  if (value >= 65) return "long" as const;
  if (value <= 35) return "short" as const;
  return "watch" as const;
}

function toneFromPremium(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "info" as const;
  if (Math.abs(value) < 0.5) return "watch" as const;
  return value > 0 ? "risk" as const : "info" as const;
}

const visualToneClass: Record<VisualTone, { text: string; bar: string }> = {
  long: { text: "text-ui-long", bar: "bg-ui-long" },
  short: { text: "text-ui-short", bar: "bg-ui-short" },
  watch: { text: "text-ui-watch", bar: "bg-ui-watch" },
  risk: { text: "text-ui-risk", bar: "bg-ui-risk" },
  info: { text: "text-ui-brand", bar: "bg-ui-brand" }
};

function formatAnalysisUpdatedAt(ms: number) {
  const date = new Date(ms);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours().toString().padStart(2, "0");
  const minute = date.getMinutes().toString().padStart(2, "0");
  return `${month}월 ${day}일 ${hour}:${minute} 갱신`;
}

function symbolLogoUrl(symbol: RepresentativeSymbol) {
  return `https://s3-symbol-logo.tradingview.com/crypto/${tradingViewLogoIds[symbol]}.svg`;
}

function boardItem(board: MarketBoardItem[], symbol: RepresentativeSymbol) {
  return board.find((item) => compactSymbol(item.symbol) === symbol) ?? null;
}

function directionFor(changePercent: number) {
  if (changePercent >= 2.5) return { label: "상방 우세", tone: "long" as const, icon: ArrowUpRight };
  if (changePercent <= -2.5) return { label: "하방 압력", tone: "short" as const, icon: ArrowDownRight };
  return { label: "관망", tone: "watch" as const, icon: TrendingUp };
}

function scoreFor(changePercent: number, marketScore: number | null) {
  const marketBias = marketScore === null ? 0 : (marketScore - 50) * 0.18;
  return Math.round(clamp(50 + changePercent * 4.5 + marketBias, 8, 92));
}

function tileToneClass(changePercent: number) {
  if (changePercent >= 3) return "bg-emerald-500 text-white";
  if (changePercent >= 2) return "bg-emerald-600 text-white";
  if (changePercent >= 1) return "bg-emerald-700 text-white";
  if (changePercent >= 0) return "bg-emerald-950 text-emerald-50";
  if (changePercent <= -3) return "bg-red-600 text-white";
  if (changePercent <= -2) return "bg-red-700 text-white";
  if (changePercent <= -1) return "bg-red-800 text-red-50";
  return "bg-red-950 text-red-50";
}

function tileAccentClass(changePercent: number) {
  if (changePercent >= 0) return changePercent >= 3 ? "text-white" : "text-emerald-100";
  return changePercent <= -3 ? "text-white" : "text-red-100";
}

function scoreToneClass(score: number) {
  if (score >= 80) return "bg-emerald-300 text-emerald-950";
  if (score >= 70) return "bg-emerald-500 text-white";
  if (score >= 60) return "bg-emerald-800 text-emerald-50";
  if (score >= 50) return "bg-slate-600 text-slate-50";
  if (score >= 40) return "bg-red-900 text-red-50";
  if (score >= 30) return "bg-red-700 text-white";
  return "bg-red-500 text-white";
}

function riskFor(changePercent: number) {
  if (changePercent >= 6) return "추격 주의";
  if (changePercent <= -6) return "변동성 확대";
  if (changePercent >= 2.5) return "눌림 확인";
  if (changePercent <= -2.5) return "지지 반응 확인";
  return "방향 확인 대기";
}

function checkFor(changePercent: number) {
  if (changePercent >= 2.5) return "상방 추세 유지와 거래대금 동반 여부를 확인합니다.";
  if (changePercent <= -2.5) return "하방 추세가 이어지는지, 반등 실패 여부를 확인합니다.";
  return "BTC 1시간 추세와 주요 이벤트 전후 변동성을 함께 봅니다.";
}

function conclusionSegments(decision: CoinHomeDecisionSummary | undefined): ConclusionSegment[] {
  if (!decision) return [{ text: "시장 데이터를 확인하는 중입니다." }];
  if (decision.state === "하방 압력 우세") {
    return [
      { text: "하방 압력", tone: "down" },
      { text: "이 우세합니다. 숏 관점은 반등 실패와 추세 유지 확인이 먼저입니다." }
    ];
  }
  if (decision.state === "변동성 경계") {
    return [{ text: "변동성이 커져 롱/숏 모두 기준선 확인이 우선입니다." }];
  }
  if (decision.state === "상방 추적 가능") {
    return [
      { text: "상방 조건", tone: "up" },
      { text: "이 우세합니다. 롱 관점은 눌림 후 추세 유지 확인이 먼저입니다." }
    ];
  }
  if (decision.state === "조건 대기") {
    return [{ text: "방향은 열렸지만 BTC 추세와 알트 참여 확인이 더 필요합니다." }];
  }
  return [{ text: "방향 근거가 부족해 관망이 우선입니다." }];
}

function conclusionToneClass(tone?: DirectionTone) {
  if (tone === "up") return "text-emerald-400";
  if (tone === "down") return "text-rose-400";
  return "";
}

function directionalTone(value: string): DirectionTone | null {
  if (/상승|상방|반등|회복|돌파|롱/.test(value)) return "up";
  if (/하락|하방|약세|이탈|실패|숏/.test(value)) return "down";
  return null;
}

function HighlightDirectionalText({ text }: { text: string | undefined }) {
  if (!text) return null;
  const parts = text.split(/(상승|상방|반등|회복|돌파|롱|하락|하방|약세|이탈|실패|숏)/g);
  return (
    <>
      {parts.map((part, index) => {
        const tone = directionalTone(part);
        return (
          <span key={`${part}-${index}`} className={tone ? conclusionToneClass(tone) : undefined}>
            {part}
          </span>
        );
      })}
    </>
  );
}

function MarketStrengthGauge({
  label,
  value,
  display,
  min = 0,
  max = 100,
  detail,
  tone = "info",
  leftLabel,
  rightLabel,
  showCenter = false,
  showBar = true
}: {
  label: string;
  value: number | null | undefined;
  display: string;
  min?: number;
  max?: number;
  detail?: string;
  tone?: VisualTone;
  leftLabel?: string;
  rightLabel?: string;
  showCenter?: boolean;
  showBar?: boolean;
}) {
  const hasValue = value !== null && value !== undefined && Number.isFinite(value);
  const percent = hasValue ? clamp(((value - min) / (max - min)) * 100) : 0;
  const centerPercent = clamp(((0 - min) / (max - min)) * 100);
  const toneClass = visualToneClass[tone];

  return (
    <article className="min-w-0 border-t border-ui-line py-3 first:border-t-0 md:[&:nth-child(-n+2)]:border-t-0">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{label}</p>
          {detail ? <p className="mt-1 truncate whitespace-nowrap text-xs leading-4 text-ui-muted">{detail}</p> : null}
        </div>
        <p className={`shrink-0 text-right text-base font-semibold leading-5 ${toneClass.text}`}>{display}</p>
      </div>
      {showBar ? (
        <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-ui-line">
          {showCenter ? <span className="absolute top-0 z-10 h-full w-px bg-ui-text/45" style={{ left: `${centerPercent}%` }} aria-hidden /> : null}
          <span className={`block h-full rounded-full ${toneClass.bar}`} style={{ width: `${percent}%` }} aria-hidden />
        </div>
      ) : null}
      {showBar && (leftLabel || rightLabel) ? (
        <div className="mt-1.5 flex justify-between gap-3 text-[10px] font-semibold text-ui-subtle">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      ) : null}
    </article>
  );
}

function TrendBreadthVisual({ report, label = "BTC 트렌드" }: { report: TechnicalRadarReport | null | undefined; label?: string }) {
  const bullish = report?.bullishCount ?? 0;
  const bearish = report?.bearishCount ?? 0;
  const neutral = report?.neutralCount ?? 0;
  const total = bullish + bearish + neutral;
  const bullishWidth = total ? (bullish / total) * 100 : 0;
  const neutralWidth = total ? (neutral / total) * 100 : 0;
  const bearishWidth = total ? (bearish / total) * 100 : 0;

  return (
    <article className="min-w-0 border-t border-ui-line py-3 md:[&:nth-child(-n+2)]:border-t-0">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{label}</p>
        </div>
        <p className="shrink-0 text-right text-sm font-semibold leading-5 text-ui-text">{report?.trendLabel ?? "미확인"}</p>
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-ui-line">
        <span className="h-full bg-ui-long" style={{ width: `${bullishWidth}%` }} aria-hidden />
        <span className="h-full bg-ui-watch" style={{ width: `${neutralWidth}%` }} aria-hidden />
        <span className="h-full bg-ui-short" style={{ width: `${bearishWidth}%` }} aria-hidden />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] font-semibold text-ui-muted">
        <span className="text-ui-long">상승 {bullish}</span>
        <span className="text-center text-ui-watch">중립 {neutral}</span>
        <span className="text-right text-ui-short">하락 {bearish}</span>
      </div>
    </article>
  );
}

function LongShortVisual({ report }: { report: LiquidationPressureReport | null | undefined }) {
  const longPercent = report?.globalLongShort.longPercent ?? null;
  const shortPercent = report?.globalLongShort.shortPercent ?? null;
  const ratio = report?.globalLongShort.ratio ?? null;
  const longWidth = longPercent !== null && Number.isFinite(longPercent) ? clamp(longPercent) : 50;
  const shortWidth = shortPercent !== null && Number.isFinite(shortPercent) ? clamp(shortPercent) : 50;

  return (
    <article className="min-w-0 border-t border-ui-line py-3 md:[&:nth-child(-n+2)]:border-t-0">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">롱숏비율</p>
        </div>
        <p className="shrink-0 text-right text-base font-semibold leading-5 text-ui-text">{formatRatio(ratio)}</p>
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-ui-line">
        <span className="h-full bg-ui-long" style={{ width: `${longWidth}%` }} aria-hidden />
        <span className="h-full bg-ui-short" style={{ width: `${shortWidth}%` }} aria-hidden />
      </div>
      <div className="mt-2 flex justify-between gap-3 text-[10px] font-semibold">
        <span className="text-ui-long">롱 {formatPlainPercent(longPercent, 1)}</span>
        <span className="text-ui-short">숏 {formatPlainPercent(shortPercent, 1)}</span>
      </div>
    </article>
  );
}

function fundingToneClass(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "text-ui-muted";
  if (value > 0.01) return "text-ui-long";
  if (value < -0.01) return "text-ui-short";
  return "text-ui-watch";
}

function fundingSkewDescription(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "펀딩비 확인 중";
  if (value > 0.001) return "롱 포지션 쏠림";
  if (value < -0.001) return "숏 포지션 쏠림";
  return "쏠림 낮음";
}

function FundingRateRow({ symbol, report }: { symbol: RepresentativeSymbol; report: LiquidationPressureReport | null | undefined }) {
  return (
    <article className="border-t border-ui-line py-3 first:border-t-0">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <p className="min-w-0 text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{symbol} 펀딩비</p>
        <p className={`shrink-0 text-right text-sm font-semibold leading-5 ${fundingToneClass(report?.fundingRatePercent)}`}>
          {formatPercent(report?.fundingRatePercent, 4)}
        </p>
      </div>
      <p className="mt-1 text-xs leading-5 text-ui-muted [word-break:keep-all]">
        {fundingSkewDescription(report?.fundingRatePercent)}
      </p>
    </article>
  );
}

function CoinStatusTile({
  symbol,
  item,
  score,
  primary,
  emphasis,
  onClick
}: {
  symbol: RepresentativeSymbol;
  item: MarketBoardItem | null;
  score: number;
  primary?: boolean;
  emphasis?: boolean;
  onClick: () => void;
}) {
  const changePercent = item?.changePercent ?? 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-full min-h-0 w-full flex-col items-center justify-center gap-1 overflow-hidden border border-ui-canvas px-1.5 py-2 text-center transition hover:brightness-110 active:scale-[0.99] ${tileToneClass(
        changePercent
      )}`}
      aria-label={`${symbol} 상세 보기`}
    >
      <span className="pointer-events-none absolute right-1 top-1 text-[9px] font-black leading-none text-white/60 sm:right-1.5 sm:top-1.5">
        클릭상세
      </span>
      <span
        className={`block max-w-full truncate font-black leading-none tracking-tight ${
          primary ? "text-[2.55rem] sm:text-5xl" : emphasis ? "text-[1.7rem] sm:text-3xl" : "text-[1.35rem] sm:text-xl"
        }`}
      >
        {symbol}
      </span>
      <span className={`max-w-full truncate font-semibold leading-none ${primary ? "block text-[1.7rem] sm:text-3xl" : "hidden"}`}>
        {item ? `$${formatPrice(item.price)}` : "-"}
      </span>
      <span
        className={`block max-w-full truncate font-black leading-none ${
          primary ? "text-[1.65rem] sm:text-3xl" : emphasis ? "text-[1.05rem] sm:text-xl" : "text-[0.95rem] sm:text-base"
        } ${tileAccentClass(changePercent)}`}
      >
        {formatPercent(item?.changePercent)}
      </span>
      <span
        className={`inline-flex max-w-full items-center justify-center truncate px-1.5 py-0.5 font-black leading-none ${
          primary ? "text-[1.45rem] sm:text-3xl" : emphasis ? "text-[0.95rem] sm:text-xl" : "text-[0.85rem] sm:text-base"
        } ${scoreToneClass(score)}`}
      >
        {score}점
      </span>
    </button>
  );
}

function toneForMarket(score: number | null) {
  if (score === null) return { label: "확인 대기", tone: "info" as const };
  if (score >= 62) return { label: "추적 가능", tone: "long" as const };
  if (score <= 38) return { label: "리스크 우위", tone: "risk" as const };
  return { label: "관망 우위", tone: "watch" as const };
}

function findReading(report: TechnicalRadarReport | null, label: string): IndicatorReading | null {
  if (!report) return null;
  return [...report.momentumIndicators, ...report.trendIndicators, ...report.volatilityIndicators].find((item) => item.label === label) ?? null;
}

async function jsonOrNull<T>(input: RequestInfo | URL) {
  const response = await fetch(input, { cache: "no-store" });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

export function CoinRadarHomePanel() {
  const [state, setState] = useState<CoinHomeState>({ status: "loading" });
  const [selectedSymbol, setSelectedSymbol] = useState<RepresentativeSymbol | null>(null);

  async function load() {
    setState({ status: "loading" });

    try {
      const [
        boardPayload,
        candlesPayload,
        candles4hPayload,
        marketMetricsPayload,
        btcFundingPayload,
        ethFundingPayload,
        xrpFundingPayload,
        solFundingPayload,
        dogeFundingPayload,
        bnbFundingPayload
      ] = await Promise.all([
        jsonOrNull<{ items?: MarketBoardItem[]; cachedAt?: number }>("/api/market-board"),
        jsonOrNull<{ candles?: Candle[] }>("/api/crypto-candles?symbol=BTCUSDT&timeframe=1h&limit=180"),
        jsonOrNull<{ candles?: Candle[] }>("/api/crypto-candles?symbol=BTCUSDT&timeframe=4h&limit=180"),
        jsonOrNull<CoinMarketMetricsPayload>("/api/coin-market-metrics"),
        jsonOrNull<{ report?: LiquidationPressureReport }>("/api/liquidation-pressure?symbol=BTCUSDT&period=1h"),
        jsonOrNull<{ report?: LiquidationPressureReport }>("/api/liquidation-pressure?symbol=ETHUSDT&period=1h"),
        jsonOrNull<{ report?: LiquidationPressureReport }>("/api/liquidation-pressure?symbol=XRPUSDT&period=1h"),
        jsonOrNull<{ report?: LiquidationPressureReport }>("/api/liquidation-pressure?symbol=SOLUSDT&period=1h"),
        jsonOrNull<{ report?: LiquidationPressureReport }>("/api/liquidation-pressure?symbol=DOGEUSDT&period=1h"),
        jsonOrNull<{ report?: LiquidationPressureReport }>("/api/liquidation-pressure?symbol=BNBUSDT&period=1h")
      ]);

      const board = boardPayload?.items ?? [];
      const candles = candlesPayload?.candles ?? [];
      const candles4h = candles4hPayload?.candles ?? [];
      const technical = candles.length >= 60 ? analyzeTechnicalRadar(candles) : null;
      const technical4h = candles4h.length >= 60 ? analyzeTechnicalRadar(candles4h) : null;
      const funding: CoinHomeData["funding"] = {
        BTC: btcFundingPayload?.report,
        ETH: ethFundingPayload?.report,
        XRP: xrpFundingPayload?.report,
        SOL: solFundingPayload?.report,
        DOGE: dogeFundingPayload?.report,
        BNB: bnbFundingPayload?.report
      };

      if (board.length === 0 && !technical) {
        throw new Error("코인 홈 데이터를 확인하지 못했습니다.");
      }

      setState({
        status: "ready",
        data: {
          board,
          technical,
          technical4h,
          funding,
          marketMetrics: marketMetricsPayload,
          analysisUpdatedAt: Date.now()
        }
      });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "코인 홈 데이터를 확인하지 못했습니다." });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(() => {
    if (state.status !== "ready") return null;
    const report = state.data.technical;
    const report4h = state.data.technical4h;
    const fearGreed = report?.fearGreed ?? null;
    const tone = toneForMarket(fearGreed?.score ?? null);
    const btc = boardItem(state.data.board, "BTC");
    const rsi = findReading(report, "RSI 14");
    const stochastic = findReading(report, "Stochastic");
    const btcFunding = state.data.funding.BTC ?? null;
    const marketMetrics = state.data.marketMetrics;
    const decision = buildCoinHomeDecision({
      board: state.data.board,
      technical: report,
      marketMetrics,
      btcFunding
    });

    return { report, report4h, fearGreed, tone, btc, rsi, stochastic, btcFunding, marketMetrics, decision };
  }, [state]);

  if (state.status === "loading") {
    return (
      <PanelCard variant="report" padding="lg" className="flex min-h-56 items-center justify-center text-sm font-semibold text-ui-muted">
        코인 시장을 분석하고 있습니다.
      </PanelCard>
    );
  }

  if (state.status === "error") {
    return (
      <PanelCard variant="report" padding="lg" tone="critical" className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
        <AlertTriangle size={22} aria-hidden />
        <p className="text-sm font-semibold">{state.message}</p>
        <ActionButton tone="ghost" onClick={() => void load()}>
          <RefreshCw size={14} aria-hidden />
          다시 확인
        </ActionButton>
      </PanelCard>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <div className="flex items-center justify-between gap-2 px-1 text-[11px] font-semibold text-ui-muted">
        <span className="min-w-0 truncate">{formatAnalysisUpdatedAt(state.data.analysisUpdatedAt)}</span>
        <ActionButton tone="ghost" className="min-h-7 shrink-0 px-0" onClick={() => void load()}>
          <RefreshCw size={12} aria-hidden />
          새로고침
        </ActionButton>
      </div>

      <PanelCard variant="flat" padding="none" className="space-y-4">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-ui-label font-semibold uppercase tracking-[0.12em] text-ui-subtle">오늘의 결론</p>
            <h2 className="text-ui-heading font-semibold tracking-tight text-ui-text">{summary?.decision.state}</h2>
            <p className="mt-1 max-w-3xl text-ui-body text-ui-muted [word-break:keep-all]">
              {conclusionSegments(summary?.decision).map((part, index) => (
                <span key={`${part.text}-${index}`} className={conclusionToneClass(part.tone)}>
                  {part.text}
                </span>
              ))}
            </p>
          </div>
        </div>

        <div className="grid gap-5 border-t border-ui-line pt-4 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
          <div className="min-w-0">
            <div>
              <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{summary?.decision.scoreLabel}</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-ui-text sm:text-4xl">{summary?.decision.readinessScore ?? "-"}점</p>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-ui-muted [word-break:keep-all]">{summary?.decision.scoreDetail}</p>
            </div>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div>
              <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">가장 큰 리스크</p>
              <p className="mt-1 text-base font-semibold text-ui-text">
                <HighlightDirectionalText text={summary?.decision.topRisk} />
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">다음 확인 조건</p>
              <p className="mt-1 min-w-0 text-sm font-semibold leading-5 text-ui-text [overflow-wrap:anywhere] [word-break:keep-all]">
                <HighlightDirectionalText text={summary?.decision.nextCondition} />
              </p>
            </div>
          </div>
        </div>
      </PanelCard>

      <PanelCard variant="flat" padding="none" className="space-y-4">
        <SectionHeader eyebrow="Representative Coins" title="대표 코인 상태" />
        <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-ui-sm bg-ui-line p-px">
          <div className="grid h-[clamp(10.5rem,42vw,18rem)] grid-cols-[minmax(0,1fr)_minmax(5.6rem,34%)] items-stretch gap-px">
            {(() => {
              const symbol = tileSymbols[0];
              const item = boardItem(state.data.board, symbol);
              const score = scoreFor(item?.changePercent ?? 0, summary?.fearGreed?.score ?? null);
              return (
                <div className="min-w-0">
                  <CoinStatusTile symbol={symbol} item={item} score={score} primary onClick={() => setSelectedSymbol(symbol)} />
                </div>
              );
            })()}
            <div className="grid min-w-0 grid-rows-2 gap-px self-stretch">
              {tileSymbols.slice(1, 3).map((symbol) => {
                const item = boardItem(state.data.board, symbol);
                const score = scoreFor(item?.changePercent ?? 0, summary?.fearGreed?.score ?? null);
                return <CoinStatusTile key={symbol} symbol={symbol} item={item} score={score} emphasis onClick={() => setSelectedSymbol(symbol)} />;
              })}
            </div>
          </div>
          <div className="mt-px grid h-[clamp(5.5rem,22vw,8rem)] grid-cols-[minmax(0,1fr)_minmax(5.6rem,34%)] gap-px">
            <div className="grid min-w-0 grid-cols-2 gap-px">
              {tileSymbols.slice(3, 5).map((symbol) => {
                const item = boardItem(state.data.board, symbol);
                const score = scoreFor(item?.changePercent ?? 0, summary?.fearGreed?.score ?? null);
                return <CoinStatusTile key={symbol} symbol={symbol} item={item} score={score} onClick={() => setSelectedSymbol(symbol)} />;
              })}
            </div>
            {(() => {
              const symbol = tileSymbols[5];
              const item = boardItem(state.data.board, symbol);
              const score = scoreFor(item?.changePercent ?? 0, summary?.fearGreed?.score ?? null);
              return <CoinStatusTile symbol={symbol} item={item} score={score} onClick={() => setSelectedSymbol(symbol)} />;
            })()}
          </div>
        </div>
      </PanelCard>

      {selectedSymbol ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4" role="dialog" aria-modal="true">
          {(() => {
            const item = boardItem(state.data.board, selectedSymbol);
            const direction = directionFor(item?.changePercent ?? 0);
            const Icon = direction.icon;
            const score = scoreFor(item?.changePercent ?? 0, summary?.fearGreed?.score ?? null);

            return (
              <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto border border-ui-line bg-ui-panel p-4 text-ui-text shadow-none">
                <button
                  type="button"
                  onClick={() => setSelectedSymbol(null)}
                  className="absolute left-2 top-2 grid h-7 w-7 place-items-center text-ui-muted transition hover:text-ui-text"
                  aria-label="상세 카드 닫기"
                >
                  <X size={15} aria-hidden />
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={symbolLogoUrl(selectedSymbol)}
                  alt={`${selectedSymbol} symbol`}
                  className="absolute right-4 top-3 h-10 w-10 rounded-full bg-white/95 p-1"
                  loading="lazy"
                />
                <div className="pl-7 pr-14">
                  <p className="text-3xl font-semibold tracking-tight">{selectedSymbol}</p>
                  <p className="mt-1 text-sm font-medium text-ui-muted">{item ? `$${formatPrice(item.price)} · ${formatPercent(item.changePercent)}` : "가격 확인 중"}</p>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <StatusPill tone={direction.tone} icon={Icon}>
                    {direction.label}
                  </StatusPill>
                  <div className="text-right">
                    <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">신호 정렬도</p>
                    <p className="text-2xl font-semibold">{score}점</p>
                  </div>
                </div>
                <div className="mt-4 border-y border-ui-line">
                  <FundingRateRow symbol={selectedSymbol} report={state.data.funding[selectedSymbol] ?? null} />
                </div>
                <div className="mt-4 space-y-3 text-sm leading-6 text-ui-muted">
                  <div>
                    <p className="font-semibold text-ui-text">리스크</p>
                    <p className="mt-1">
                      <HighlightDirectionalText text={riskFor(item?.changePercent ?? 0)} />
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-ui-text">확인</p>
                    <p className="mt-1">
                      <HighlightDirectionalText text={checkFor(item?.changePercent ?? 0)} />
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      ) : null}

      <PanelCard variant="flat" padding="none" className="space-y-4">
        <SectionHeader eyebrow="BTC Market Strength" title="BTC 기준 시장 체력" description="선택 코인과 분리해 BTC 기준 과열, 추세, 파생 쏠림을 확인합니다." />
        <div className="grid gap-3 md:grid-cols-2">
          <MarketStrengthGauge
            label="공포탐욕"
            value={summary?.fearGreed?.score}
            display={summary?.fearGreed ? `${summary.fearGreed.score} · ${summary.fearGreed.label}` : "미확인"}
            tone={toneFromPercent(summary?.fearGreed?.score)}
            leftLabel="공포"
            rightLabel="탐욕"
          />
          <MarketStrengthGauge
            label="BTC RSI"
            value={parseReadingNumber(summary?.rsi?.value)}
            display={summary?.rsi?.value ?? "미확인"}
            tone={summary?.rsi?.tone === "warning" ? "risk" : toneFromPercent(parseReadingNumber(summary?.rsi?.value))}
            leftLabel="과매도"
            rightLabel="과열"
          />
          <MarketStrengthGauge
            label="BTC 스토캐스틱"
            value={parseReadingNumber(summary?.stochastic?.value)}
            display={summary?.stochastic?.value ?? "미확인"}
            tone={summary?.stochastic?.tone === "warning" ? "risk" : toneFromPercent(parseReadingNumber(summary?.stochastic?.value))}
            leftLabel="하방 과열"
            rightLabel="상방 과열"
          />
          <TrendBreadthVisual report={summary?.report} label="BTC 1H 트렌드" />
          <TrendBreadthVisual report={summary?.report4h} label="BTC 4H 트렌드" />
          <MarketStrengthGauge
            label="BTC 도미넌스"
            value={summary?.marketMetrics?.btcDominancePercent}
            display={formatPlainPercent(summary?.marketMetrics?.btcDominancePercent)}
            tone="info"
            leftLabel="낮음"
            rightLabel="높음"
          />
          <LongShortVisual report={summary?.btcFunding} />
          <MarketStrengthGauge
            label="김프"
            value={summary?.marketMetrics?.kimchiPremiumPercent}
            display={formatPercent(summary?.marketMetrics?.kimchiPremiumPercent)}
            min={-5}
            max={5}
            tone={toneFromPremium(summary?.marketMetrics?.kimchiPremiumPercent)}
            showBar={false}
          />
          <article className="min-w-0 border-t border-ui-line py-3">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">환율</p>
              </div>
              <p className="shrink-0 text-right text-base font-semibold leading-5 text-ui-text">{formatKrwRate(summary?.marketMetrics?.usdKrw)}</p>
            </div>
          </article>
        </div>
      </PanelCard>

    </div>
  );
}
