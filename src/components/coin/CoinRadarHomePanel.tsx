"use client";
// Coin Radar 홈에서 대표 코인과 BTC 기준 시장 체력을 빠르게 요약합니다.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, RefreshCw, ShieldCheck, TrendingUp } from "lucide-react";
import { ActionButton, DataRow, PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";
import type { CoinMarketMetricsPayload } from "@/lib/coinMarketMetrics";
import type { Candle } from "@/lib/marketAnalysis";
import type { LiquidationPressureReport } from "@/lib/liquidationPressure";
import { analyzeTechnicalRadar, type IndicatorReading, type TechnicalRadarReport } from "@/lib/technicalRadar";

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
  cachedAt: number;
}

type CoinHomeState =
  | { status: "loading" }
  | { status: "ready"; data: CoinHomeData }
  | { status: "error"; message: string };

const representativeSymbols = ["BTC", "ETH", "XRP"] as const;
const fundingSymbols = ["BTC", "ETH", "XRP"] as const;

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

function formatCachedAt(ms: number) {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 갱신";
  if (min < 60) return `${min}분 전 갱신`;
  return `${Math.floor(min / 60)}시간 전 갱신`;
}

function boardItem(board: MarketBoardItem[], symbol: (typeof representativeSymbols)[number]) {
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

function riskFor(changePercent: number) {
  if (changePercent >= 6) return "추격 주의";
  if (changePercent <= -6) return "변동성 확대";
  if (changePercent >= 2.5) return "눌림 확인";
  if (changePercent <= -2.5) return "지지 반응 확인";
  return "방향 확인 대기";
}

function checkFor(changePercent: number) {
  if (changePercent >= 2.5) return "BTC 추세 유지와 거래대금 동반 여부를 확인합니다.";
  if (changePercent <= -2.5) return "저점 이탈이 멈추는지, 반등 거래량이 붙는지 확인합니다.";
  return "BTC 1시간 추세와 주요 이벤트 전후 변동성을 함께 봅니다.";
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
          cachedAt: boardPayload?.cachedAt ?? Date.now()
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

    return { report, fearGreed, tone, btc, rsi, stochastic, btcFunding, marketMetrics };
  }, [state]);

  if (state.status === "loading") {
    return (
      <PanelCard variant="report" padding="lg" className="flex min-h-56 items-center justify-center text-sm font-semibold text-ui-muted">
        Coin Radar 홈을 정리하는 중입니다.
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
    <div className="flex flex-col gap-3">
      <PanelCard variant="flat" padding="none" className="space-y-3 py-2">
        <SectionHeader
          eyebrow="Coin Radar Home"
          title="코인 홈"
          description="대표 코인과 BTC 기준 시장 체력을 먼저 보고, 세부 차트는 선물·현물 탭에서 확인합니다."
          action={
            <ActionButton tone="ghost" className="px-0" onClick={() => void load()}>
              <RefreshCw size={14} aria-hidden />
              {formatCachedAt(state.data.cachedAt)}
            </ActionButton>
          }
        />

        <div className="py-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <StatusPill tone={summary?.tone.tone ?? "info"}>{summary?.tone.label ?? "확인 대기"}</StatusPill>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-ui-text">{summary?.report?.trendLabel ?? "BTC 기준 확인 중"}</p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-ui-muted">
                RSI, 스토캐스틱, 트렌드는 선택 코인이 아니라 BTC 1시간 기준으로 해석합니다. 코인별 상태는 대표 카드에서 방향과 리스크만 압축합니다.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-right sm:min-w-56">
              <div>
                <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">Fear/Greed</p>
                <p className="text-xl font-semibold text-ui-text">{summary?.fearGreed ? `${summary.fearGreed.score}` : "-"}</p>
                <p className="text-xs text-ui-muted">{summary?.fearGreed?.label ?? "데이터 확인 중"}</p>
              </div>
              <div>
                <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">BTC</p>
                <p className="text-xl font-semibold text-ui-text">{summary?.btc ? `$${formatPrice(summary.btc.price)}` : "-"}</p>
                <p className="text-xs text-ui-muted">{formatPercent(summary?.btc?.changePercent)}</p>
              </div>
            </div>
          </div>
        </div>
      </PanelCard>

      <PanelCard variant="flat" padding="none" className="space-y-3 py-2">
        <SectionHeader eyebrow="Representative Coins" title="대표 코인 상태" description="BTC, ETH, XRP를 기본 대표 코인으로 보고 방향, 점수, 리스크, 다음 확인 조건만 압축합니다." />
        <div>
          {representativeSymbols.map((symbol) => {
            const item = boardItem(state.data.board, symbol);
            const direction = directionFor(item?.changePercent ?? 0);
            const Icon = direction.icon;
            const score = scoreFor(item?.changePercent ?? 0, summary?.fearGreed?.score ?? null);

            return (
              <article key={symbol} className="grid gap-3 py-3 sm:grid-cols-[7rem_minmax(0,1fr)_8rem] sm:items-start">
                <div>
                  <p className="text-2xl font-semibold tracking-tight text-ui-text">{symbol}</p>
                  <p className="mt-1 text-xs font-medium text-ui-muted">{item ? `$${formatPrice(item.price)}` : "가격 확인 중"}</p>
                </div>
                <div className="min-w-0">
                  <StatusPill tone={direction.tone} icon={Icon}>
                    {direction.label}
                  </StatusPill>
                  <p className="mt-2 text-sm leading-6 text-ui-muted">
                    <span className="font-semibold text-ui-text">리스크</span> {riskFor(item?.changePercent ?? 0)} · <span className="font-semibold text-ui-text">확인</span> {checkFor(item?.changePercent ?? 0)}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">신호 정렬도</p>
                  <p className="text-2xl font-semibold text-ui-text">{score}점</p>
                  <p className="text-xs text-ui-muted">{formatPercent(item?.changePercent)}</p>
                </div>
              </article>
            );
          })}
        </div>
      </PanelCard>

      <PanelCard variant="flat" padding="none" className="space-y-3 py-2">
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

      <PanelCard variant="flat" padding="none" className="space-y-3 py-2">
        <SectionHeader eyebrow="Funding" title="대표 코인 펀딩비" description="펀딩비는 포지션 쏠림을 보는 보조 지표이며 방향 지시가 아닙니다." />
        <div className="divide-y divide-ui-line">
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

      <PanelCard variant="flat" padding="none" className="py-3">
        <div className="flex items-start gap-3 text-sm text-ui-muted">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-ui-brand" aria-hidden />
          <p>
            홈은 판단 보조용 요약입니다. 세부 조건은 선물/현물/매크로/복기 화면에서 다시 확인하며, 매수·매도 지시형 문구를 제공하지 않습니다.
          </p>
        </div>
      </PanelCard>
    </div>
  );
}
