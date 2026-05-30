"use client";
// Coin Radar 홈에서 대표 코인과 BTC 기준 시장 체력을 빠르게 요약합니다.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, RefreshCw, ShieldCheck, TrendingUp, X } from "lucide-react";
import { ActionButton, DataRow, PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";
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
  funding: Partial<Record<"BTC" | "ETH" | "XRP", LiquidationPressureReport>>;
  marketMetrics: CoinMarketMetricsPayload | null;
  analysisUpdatedAt: number;
}

type CoinHomeState =
  | { status: "loading" }
  | { status: "ready"; data: CoinHomeData }
  | { status: "error"; message: string };

const tileSymbols = ["BTC", "ETH", "XRP", "SOL", "DOGE", "BNB"] as const;
const fundingSymbols = ["BTC", "ETH", "XRP"] as const;

type RepresentativeSymbol = (typeof tileSymbols)[number];
type ConclusionSegment = { text: string; tone?: "up" | "down" };
type DirectionTone = "up" | "down";

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
      className={`relative flex h-full min-h-0 w-full flex-col items-center justify-center overflow-hidden border-2 border-ui-canvas px-1.5 py-1.5 text-center transition hover:brightness-110 active:scale-[0.99] ${tileToneClass(
        changePercent
      )}`}
      aria-label={`${symbol} 상세 보기`}
    >
      <span className={`block max-w-full truncate font-black tracking-tight ${primary ? "text-4xl sm:text-5xl" : emphasis ? "text-2xl sm:text-3xl" : "text-base sm:text-xl"}`}>
        {symbol}
      </span>
      <span className={`mt-1 max-w-full truncate font-semibold ${primary ? "block text-2xl sm:text-3xl" : "hidden"}`}>
        {item ? `$${formatPrice(item.price)}` : "-"}
      </span>
      <span className={`mt-1 block max-w-full truncate font-black ${primary ? "text-2xl sm:text-3xl" : emphasis ? "text-base sm:text-xl" : "text-sm sm:text-base"} ${tileAccentClass(changePercent)}`}>
        {formatPercent(item?.changePercent)}
      </span>
      <span className={`mt-1 inline-flex max-w-full items-center justify-center truncate px-1.5 py-0.5 font-black ${primary ? "text-2xl sm:text-3xl" : emphasis ? "text-base sm:text-xl" : "text-sm sm:text-base"} ${scoreToneClass(score)}`}>
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
      const [boardPayload, candlesPayload, marketMetricsPayload, btcFundingPayload, ethFundingPayload, xrpFundingPayload] = await Promise.all([
        jsonOrNull<{ items?: MarketBoardItem[]; cachedAt?: number }>("/api/market-board"),
        jsonOrNull<{ candles?: Candle[] }>("/api/crypto-candles?symbol=BTCUSDT&timeframe=1h&limit=180"),
        jsonOrNull<CoinMarketMetricsPayload>("/api/coin-market-metrics"),
        jsonOrNull<{ report?: LiquidationPressureReport }>("/api/liquidation-pressure?symbol=BTCUSDT&period=1h"),
        jsonOrNull<{ report?: LiquidationPressureReport }>("/api/liquidation-pressure?symbol=ETHUSDT&period=1h"),
        jsonOrNull<{ report?: LiquidationPressureReport }>("/api/liquidation-pressure?symbol=XRPUSDT&period=1h")
      ]);

      const board = boardPayload?.items ?? [];
      const candles = candlesPayload?.candles ?? [];
      const technical = candles.length >= 60 ? analyzeTechnicalRadar(candles) : null;
      const funding: CoinHomeData["funding"] = {
        BTC: btcFundingPayload?.report,
        ETH: ethFundingPayload?.report,
        XRP: xrpFundingPayload?.report
      };

      if (board.length === 0 && !technical) {
        throw new Error("코인 홈 데이터를 확인하지 못했습니다.");
      }

      setState({
        status: "ready",
        data: {
          board,
          technical,
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

    return { report, fearGreed, tone, btc, rsi, stochastic, btcFunding, marketMetrics, decision };
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

      <PanelCard variant="report" padding="lg" className="space-y-4">
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

      <PanelCard variant="report" padding="lg" className="space-y-4">
        <SectionHeader eyebrow="Representative Coins" title="대표 코인 상태" />
        <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-ui-sm bg-ui-line p-px">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(5.6rem,34%)] items-stretch gap-px">
            {(() => {
              const symbol = tileSymbols[0];
              const item = boardItem(state.data.board, symbol);
              const score = scoreFor(item?.changePercent ?? 0, summary?.fearGreed?.score ?? null);
              return (
                <div className="aspect-square min-w-0 self-start">
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
          <div className="mt-px grid h-24 grid-cols-[minmax(0,1fr)_minmax(5.6rem,34%)] gap-px sm:h-32">
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
              <div className="relative w-full max-w-sm border border-ui-line bg-ui-panel p-4 text-ui-text shadow-none">
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

      <PanelCard variant="report" padding="lg" className="space-y-4">
        <SectionHeader eyebrow="BTC Market Strength" title="BTC 기준 시장 체력" description="선택 코인과 분리해 BTC 기준 과열, 추세, 파생 쏠림을 확인합니다." />
        <div className="grid gap-0 sm:grid-cols-2">
          <DataRow label="공포탐욕" value={summary?.fearGreed ? `${summary.fearGreed.score} · ${summary.fearGreed.label}` : "미확인"} />
          <DataRow label="BTC RSI" value={summary?.rsi?.value ?? "미확인"} detail={summary?.rsi?.description} />
          <DataRow label="BTC 스토캐스틱" value={summary?.stochastic?.value ?? "미확인"} detail={summary?.stochastic?.description} />
          <DataRow label="BTC 트렌드" value={summary?.report?.trendLabel ?? "미확인"} detail={summary?.report?.summary} />
          <DataRow label="BTC 도미넌스" value={formatPlainPercent(summary?.marketMetrics?.btcDominancePercent)} detail="CoinGecko global market cap 기준 BTC 비중입니다." />
          <DataRow label="롱숏비율" value={formatRatio(summary?.btcFunding?.globalLongShort.ratio)} detail="BTCUSDT Binance 공개 long/short 비율입니다." />
          <DataRow label="김프" value={formatPercent(summary?.marketMetrics?.kimchiPremiumPercent)} detail="업비트 BTC/KRW와 Binance BTCUSDT, USD/KRW 환율로 계산한 보조값입니다." />
          <DataRow label="환율" value={formatKrwRate(summary?.marketMetrics?.usdKrw)} detail="USD/KRW public source 기준입니다. 국내 현물 해석용 보조값으로만 봅니다." />
        </div>
      </PanelCard>

      <PanelCard variant="report" padding="lg" className="space-y-4">
        <SectionHeader eyebrow="Funding" title="대표 코인 펀딩비" description="펀딩비는 포지션 쏠림을 보는 보조 지표이며 방향 지시가 아닙니다." />
        <div>
          {fundingSymbols.map((symbol) => {
            const report = state.data.funding[symbol] ?? null;
            return (
              <DataRow
                key={symbol}
                label={`${symbol} 펀딩비`}
                value={formatPercent(report?.fundingRatePercent, 4)}
                detail={report?.summary ?? "Binance 공개 데이터 확인 중입니다."}
              />
            );
          })}
        </div>
      </PanelCard>

      <PanelCard variant="report" padding="md">
        <div className="flex items-start gap-3 text-sm text-ui-muted">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-ui-brand" aria-hidden />
          <p>
            홈은 판단 보조용 요약입니다. 세부 조건은 선물/현물/뉴스/복기 화면에서 다시 확인하며, 매수·매도 지시형 문구를 제공하지 않습니다.
          </p>
        </div>
      </PanelCard>
    </div>
  );
}
