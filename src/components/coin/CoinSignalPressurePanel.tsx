"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, RefreshCcw, Zap } from "lucide-react";
import type { LiquidationPressureReport, LiquidationPressureSide } from "@/lib/liquidationPressure";
import { ActionButton, AppSurface, PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";
import { CompactHelp } from "@/components/ui/CompactHelp";

export type CoinSignalPressureTone = "long" | "short" | "watch" | "risk" | "info";

export interface CoinSignalPressureItem {
  label: string;
  title: string;
  detail?: string;
  tone: CoinSignalPressureTone;
  percent: number;
  value?: string;
}

type FuturesPressureMode = "major" | "alts";
type LoadStatus = "idle" | "loading" | "ready" | "error";

type FuturesSymbolInfo = {
  symbol: string;
  label: string;
};

type FuturesPressurePayload = {
  report?: LiquidationPressureReport;
  error?: string;
};

const futuresSymbols: Record<FuturesPressureMode, FuturesSymbolInfo[]> = {
  major: [
    { symbol: "BTCUSDT", label: "BTC" },
    { symbol: "ETHUSDT", label: "ETH" },
    { symbol: "SOLUSDT", label: "SOL" },
    { symbol: "BNBUSDT", label: "BNB" }
  ],
  alts: [
    { symbol: "SOLUSDT", label: "SOL" },
    { symbol: "XRPUSDT", label: "XRP" },
    { symbol: "DOGEUSDT", label: "DOGE" },
    { symbol: "BNBUSDT", label: "BNB" }
  ]
};

const barClass: Record<CoinSignalPressureTone, string> = {
  long: "bg-ui-long",
  short: "bg-ui-short",
  watch: "bg-ui-watch",
  risk: "bg-ui-risk",
  info: "bg-ui-brand"
};

const pillLabel: Record<CoinSignalPressureTone, string> = {
  long: "상방",
  short: "하방",
  watch: "보기",
  risk: "위험",
  info: "참고"
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function formatPercent(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

function formatPlainPercent(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${value.toFixed(digits)}%`;
}

function pressureScore(report: LiquidationPressureReport) {
  return Math.max(report.upsideShortPressure, report.downsideLongPressure);
}

function pressureTone(report: LiquidationPressureReport): CoinSignalPressureTone {
  if (report.dominantSide === "upsideShorts") return "long";
  if (report.dominantSide === "downsideLongs") return "short";
  return "watch";
}

function sideTitle(side: LiquidationPressureSide) {
  if (side === "upsideShorts") return "상방 변동성 압력";
  if (side === "downsideLongs") return "하방 변동성 압력";
  return "쏠림 약함";
}

function sideAction(side: LiquidationPressureSide) {
  if (side === "upsideShorts") return "상방 급변 가능성 확인";
  if (side === "downsideLongs") return "하방 급변 가능성 확인";
  return "방향 확인";
}

function gradeLabel(report: LiquidationPressureReport) {
  if (report.grade === "extreme") return "쏠림 매우 강함";
  if (report.grade === "heated") return "쏠림 강함";
  if (report.grade === "normal") return "쏠림 보통";
  return "쏠림 약함";
}

function mainTrigger(report: LiquidationPressureReport) {
  const funding = report.fundingRatePercent;
  const oi = report.openInterestChangePercent;
  const takerBuy = report.takerFlow.buyPercent;
  const takerSell = report.takerFlow.sellPercent;
  const globalLong = report.globalLongShort.longPercent;
  const globalShort = report.globalLongShort.shortPercent;

  if (oi !== null && oi !== undefined && oi > 2) return `선물 계약 ${formatPercent(oi)} 증가`;
  if (oi !== null && oi !== undefined && oi < -1) return `선물 계약 ${formatPercent(oi)} 감소`;
  if (funding !== null && funding !== undefined && Math.abs(funding) >= 0.03) return `펀딩비 ${formatPercent(funding, 4)}`;
  if (takerBuy !== null && takerBuy >= 55) return `시장가 유입 ${formatPlainPercent(takerBuy)}`;
  if (takerSell !== null && takerSell >= 55) return `시장가 이탈 ${formatPlainPercent(takerSell)}`;
  if (globalLong !== null && globalLong !== undefined && globalLong >= 56) return `상방 포지션 ${formatPlainPercent(globalLong)}`;
  if (globalShort !== null && globalShort !== undefined && globalShort >= 56) return `하방 포지션 ${formatPlainPercent(globalShort)}`;
  return "쏠림 크지 않음";
}

async function fetchPressure(symbol: string) {
  const response = await fetch(`/api/liquidation-pressure?symbol=${encodeURIComponent(symbol)}&period=1h`, { cache: "no-store" });
  const payload = (await response.json()) as FuturesPressurePayload;
  if (!response.ok || !payload.report) throw new Error(payload.error ?? "선물 압력 확인 실패");
  return payload.report;
}

const futuresPressureItems: Record<FuturesPressureMode, CoinSignalPressureItem[]> = {
  major: [
    {
      label: "파생 쏠림",
      title: "레버리지·펀딩·포지션",
      detail: "방향보다 과열과 강제 변동성 위험을 먼저 분리합니다.",
      tone: "risk",
      percent: 88,
      value: "우선"
    },
    {
      label: "차트 구조",
      title: "MSB·CHoCH·OB·FVG",
      detail: "구조 신호는 상단 판단을 확인하는 보조값으로만 둡니다.",
      tone: "info",
      percent: 68
    },
    {
      label: "볼 조건",
      title: "가격 조정 후 재상승·반등 실패",
      detail: "가격이 같은 방향을 유지하는지 확인할 조건만 남깁니다.",
      tone: "watch",
      percent: 56
    },
    {
      label: "충돌",
      title: "상승 신호와 과열 동시 발생",
      detail: "신호가 충돌하면 방향보다 기준 이탈과 가격 흔들림부터 봅니다.",
      tone: "risk",
      percent: 74
    }
  ],
  alts: [
    {
      label: "고위험 필터",
      title: "급등·저유동성·언락",
      detail: "좋은 후보를 찾기 전에 회피 후보를 먼저 분리합니다.",
      tone: "risk",
      percent: 86,
      value: "우선"
    },
    {
      label: "유동성",
      title: "거래대금·가격 흔들림",
      detail: "알트 단독 움직임보다 실제 거래가 붙었는지 확인합니다.",
      tone: "watch",
      percent: 72
    },
    {
      label: "BTC 기준",
      title: "방향 동조·분리",
      detail: "BTC 약세와 알트 급등이 겹치면 관심 후보로 바로 보지 않습니다.",
      tone: "info",
      percent: 64
    },
    {
      label: "충돌",
      title: "기회 신호와 회피 조건",
      detail: "상승 후보처럼 보여도 위험 신호가 겹치면 관망하기로 낮춥니다.",
      tone: "risk",
      percent: 78
    }
  ]
};

export function CoinSignalPressurePanel({
  title,
  items
}: {
  title: string;
  description?: string;
  items: CoinSignalPressureItem[];
}) {
  return (
    <PanelCard variant="report" padding="md" className="space-y-4 border-y border-ui-line">
      <SectionHeader title={title} />
      <div className="grid gap-0 md:grid-cols-2">
        {items.map((item, index) => (
          <article
            key={item.label}
            className={`min-w-0 py-3 md:px-3 ${index > 0 ? "border-t border-ui-line md:border-t-0" : ""} ${
              index % 2 === 1 ? "md:border-l md:border-ui-line" : ""
            } ${index > 1 ? "md:border-t md:border-ui-line" : ""}`}
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{item.label}</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{item.title}</p>
              </div>
              <StatusPill tone={item.tone} icon={BarChart3} className="shrink-0">
                {item.value ?? pillLabel[item.tone]}
              </StatusPill>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-ui-line">
              <span className={`block h-full rounded-full ${barClass[item.tone]}`} style={{ width: `${clampPercent(item.percent)}%` }} aria-hidden />
            </div>
            {item.detail ? (
              <div className="mt-2">
                <CompactHelp label={item.label}>{item.detail}</CompactHelp>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </PanelCard>
  );
}

export function CoinFuturesSignalPressurePanel({ mode }: { mode: FuturesPressureMode }) {
  const isAltMode = mode === "alts";
  const symbols = useMemo(() => futuresSymbols[mode], [mode]);
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [reports, setReports] = useState<LiquidationPressureReport[]>([]);
  const [error, setError] = useState("");

  const loadReports = useCallback(async () => {
    setStatus("loading");
    setError("");
    const results = await Promise.allSettled(symbols.map((item) => fetchPressure(item.symbol)));
    const nextReports = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));

    if (nextReports.length) {
      setReports(nextReports);
      setStatus("ready");
      return;
    }

    setStatus("error");
    setError("선물 쏠림 데이터를 잠시 확인하지 못했습니다.");
  }, [symbols]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const cards = useMemo(() => {
    return reports
      .map((report) => {
        const meta = symbols.find((item) => item.symbol === report.symbol);
        return { report, label: meta?.label ?? report.symbol.replace(/USDT$/, "") };
      })
      .sort((a, b) => pressureScore(b.report) - pressureScore(a.report))
      .slice(0, 4);
  }, [reports, symbols]);

  const topCard = cards[0];
  const topSummary = topCard
    ? `${topCard.label} ${sideTitle(topCard.report.dominantSide)} · ${mainTrigger(topCard.report)}`
    : isAltMode
      ? "알트 선물 쏠림을 확인하는 중입니다."
      : "메이저 선물 쏠림을 확인하는 중입니다.";

  return (
    <PanelCard variant="report" padding="md" className="space-y-4 border-y border-ui-line">
      <SectionHeader
        eyebrow="Binance 공개 선물 데이터"
        title={isAltMode ? "알트 선물 쏠림" : "메이저 선물 쏠림"}
        description={topSummary}
        action={
          <ActionButton tone="secondary" onClick={loadReports} disabled={status === "loading"}>
            <RefreshCcw className={status === "loading" ? "animate-spin" : ""} size={15} aria-hidden />
            갱신
          </ActionButton>
        }
      />

      {error ? (
        <AppSurface variant="flat" tone="critical" padding="none" className="border-t border-ui-line py-2 text-sm font-semibold text-ui-risk">
          {error}
        </AppSurface>
      ) : null}

      {status === "loading" && !cards.length ? (
        <AppSurface variant="flat" tone="inset" padding="none" className="border-t border-ui-line py-3 text-sm font-semibold text-ui-muted">
          선물 쏠림 확인 중
        </AppSurface>
      ) : null}

      {cards.length ? (
        <div className="grid gap-0 md:grid-cols-2">
          {cards.map(({ report, label }, index) => {
            const tone = pressureTone(report);
            const score = pressureScore(report);
            return (
              <article
                key={report.symbol}
                className={`min-w-0 py-3 md:px-3 ${index > 0 ? "border-t border-ui-line md:border-t-0" : ""} ${
                  index % 2 === 1 ? "md:border-l md:border-ui-line" : ""
                } ${index > 1 ? "md:border-t md:border-ui-line" : ""}`}
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{label}</p>
                    <p className="mt-1 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{sideTitle(report.dominantSide)}</p>
                  </div>
                  <StatusPill tone={tone} icon={Zap} className="shrink-0">
                    {gradeLabel(report)}
                  </StatusPill>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-ui-line">
                  <span className={`block h-full rounded-full ${barClass[tone]}`} style={{ width: `${clampPercent(score)}%` }} aria-hidden />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-semibold leading-5 text-ui-muted">
                  <span>{sideAction(report.dominantSide)}</span>
                  <span className="text-right text-ui-text">{mainTrigger(report)}</span>
                  <span>상방 포지션 {formatPlainPercent(report.globalLongShort.longPercent)}</span>
                  <span className="text-right">계약 변화 {formatPercent(report.openInterestChangePercent)}</span>
                  <span>하방 압력 {report.downsideLongPressure}점</span>
                  <span className="text-right">상방 압력 {report.upsideShortPressure}점</span>
                </div>
              </article>
            );
          })}
        </div>
      ) : status !== "loading" ? (
        <AppSurface variant="flat" tone="inset" padding="none" className="border-t border-ui-line py-3 text-sm font-semibold text-ui-muted">
          공개 선물 데이터를 불러오지 못해 기본 판단 순서만 확인합니다.
        </AppSurface>
      ) : null}

      <CompactHelp label="데이터 기준">
        Binance 공개 선물 데이터의 미결제약정, 펀딩비, 상방·하방 포지션 비율, 시장가 유입·이탈 쏠림을 묶어 과열과 흔들림 위험만 빠르게 보여줍니다.
      </CompactHelp>
    </PanelCard>
  );
}
