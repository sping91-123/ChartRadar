"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw, Waves } from "lucide-react";
import type { LargeTradeAnomalyLevel, LargeTradeFlowReport, LargeTradeSide } from "@/lib/largeTradeFlow";
import { ActionButton, AppSurface, PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";
import { CompactHelp } from "@/components/ui/CompactHelp";

export type LargeTradeMode = "major" | "alts";
type LoadStatus = "idle" | "loading" | "ready" | "error";

export type LargeTradeSymbolInfo = {
  symbol: string;
  label: string;
};

type LargeTradePayload = {
  report?: LargeTradeFlowReport;
  error?: string;
};

const flowSymbols: Record<LargeTradeMode, LargeTradeSymbolInfo[]> = {
  major: [
    { symbol: "BTCUSDT", label: "BTC" },
    { symbol: "ETHUSDT", label: "ETH" }
  ],
  alts: [
    { symbol: "SOLUSDT", label: "SOL" },
    { symbol: "XRPUSDT", label: "XRP" },
    { symbol: "DOGEUSDT", label: "DOGE" },
    { symbol: "BNBUSDT", label: "BNB" }
  ]
};

function formatUsd(value: number, emptyLabel = "-") {
  if (!Number.isFinite(value) || value <= 0) return emptyLabel;
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatFlowNotional(value: number) {
  return formatUsd(value, "최근 특이 신호 제한적");
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(0)}%`;
}

function sideTone(side: LargeTradeSide) {
  if (side === "buy") return "long";
  if (side === "sell") return "short";
  return "watch";
}

function sideLabel(side: LargeTradeSide) {
  if (side === "buy") return "큰 매수 체결 우세";
  if (side === "sell") return "큰 매도 체결 우세";
  return "큰 체결 균형";
}

function flowTitle(report: LargeTradeFlowReport) {
  if (report.largeTradeCount <= 0 || report.totalLargeNotionalUsd <= 0) return "최근 특이 신호 없음";
  return sideLabel(report.dominantSide);
}

function displayTrigger(value: string) {
  return value.replace(/\uB9E4\uC218/g, "큰 매수").replace(/\uB9E4\uB3C4/g, "큰 매도");
}

function gradeLabel(report: LargeTradeFlowReport) {
  if (report.grade === "extreme") return "매우 강함";
  if (report.grade === "heated") return "강함";
  if (report.grade === "normal") return "보통";
  return "약함";
}

function anomalyLabel(level: LargeTradeAnomalyLevel) {
  if (level === "high") return "높음";
  if (level === "watch") return "주의";
  return "낮음";
}

function anomalyClass(level: LargeTradeAnomalyLevel) {
  if (level === "high") return "text-ui-risk";
  if (level === "watch") return "text-ui-watch";
  return "text-ui-muted";
}

function flowScore(report: LargeTradeFlowReport) {
  return report.totalLargeNotionalUsd * (1 + Math.abs(report.imbalancePercent) / 100);
}

async function fetchLargeTradeFlow(symbol: string) {
  const response = await fetch(`/api/large-trade-flow?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store" });
  const payload = (await response.json()) as LargeTradePayload;
  if (!response.ok || !payload.report) throw new Error(payload.error ?? "큰 매수/매도 체결 확인 실패");
  return payload.report;
}

export function CoinLargeTradeFlowPanel({ mode, symbols: customSymbols }: { mode: LargeTradeMode; symbols?: LargeTradeSymbolInfo[] }) {
  const isAltMode = mode === "alts";
  const symbols = useMemo(() => (customSymbols?.length ? customSymbols : flowSymbols[mode]), [customSymbols, mode]);
  const symbolLabelText = useMemo(() => symbols.map((item) => item.label).join(", "), [symbols]);
  const hasSingleMajorSymbol = !isAltMode && symbols.length === 1;
  const panelTitle = isAltMode ? "알트 큰 매수/매도 체결" : hasSingleMajorSymbol ? `${symbolLabelText} 큰 매수/매도 체결` : "BTC/ETH 큰 매수/매도 체결";
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [reports, setReports] = useState<LargeTradeFlowReport[]>([]);
  const [error, setError] = useState("");

  const loadReports = useCallback(async () => {
    setStatus("loading");
    setError("");
    setReports([]);
    const results = await Promise.allSettled(symbols.map((item) => fetchLargeTradeFlow(item.symbol)));
    const nextReports = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));

    if (nextReports.length) {
      setReports(nextReports);
      setStatus("ready");
      return;
    }

    setStatus("error");
    setError("큰 매수/매도 체결 데이터 응답 지연입니다. 추가 판단 기준으로 남겨 둡니다.");
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
      .sort((a, b) => flowScore(b.report) - flowScore(a.report))
      .slice(0, 4);
  }, [reports, symbols]);

  const topCard = cards[0];
  const topSummary = topCard
    ? `${topCard.label} ${flowTitle(topCard.report)} · ${formatFlowNotional(topCard.report.totalLargeNotionalUsd)}`
    : isAltMode
      ? "알트 큰 매수/매도 체결 판단 중입니다."
      : hasSingleMajorSymbol
        ? `${symbolLabelText} 큰 매수/매도 체결 판단 중입니다.`
        : "BTC/ETH 큰 매수/매도 체결 판단 중입니다.";

  return (
    <PanelCard variant="report" padding="md" className="space-y-4">
      <SectionHeader
        eyebrow="Binance 공개 선물 체결"
        title={panelTitle}
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
          큰 매수/매도 체결 판단 중
        </AppSurface>
      ) : null}

      {cards.length ? (
        <div className={`grid gap-2 ${cards.length > 1 ? "md:grid-cols-2" : ""}`}>
          {cards.map(({ report, label }) => {
            const tone = sideTone(report.dominantSide);
            return (
              <article
                key={report.symbol}
                className="min-w-0 rounded-ui-sm bg-ui-elevated px-3 py-3"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{label}</p>
                    <p className="mt-1 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{flowTitle(report)}</p>
                  </div>
                  <StatusPill tone={tone} icon={Waves} className="shrink-0">
                    {gradeLabel(report)}
                  </StatusPill>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-semibold leading-5 text-ui-muted">
                  <span>큰 체결 {report.largeTradeCount}건</span>
                  <span className="text-right text-ui-text">{displayTrigger(report.trigger)}</span>
                  <span>큰 매수 {formatUsd(report.buyNotionalUsd, "신호 제한적")}</span>
                  <span className="text-right">큰 매도 {formatUsd(report.sellNotionalUsd, "신호 제한적")}</span>
                  <span>매수/매도 쏠림 {formatPercent(report.imbalancePercent)}</span>
                  <span className="text-right">{report.windowMinutes ? `${report.windowMinutes}분 범위` : "최근 체결"}</span>
                  <span>반복 체결</span>
                  <span className={`text-right ${anomalyClass(report.anomalyLevel)}`}>{anomalyLabel(report.anomalyLevel)}</span>
                </div>
              </article>
            );
          })}
        </div>
      ) : status !== "loading" ? (
        <AppSurface variant="flat" tone="inset" padding="none" className="border-t border-ui-line py-3 text-sm font-semibold text-ui-muted">
          공개 체결 데이터 응답이 지연되고 있습니다. 최근 특이 신호는 추가 판단 기준으로 남겨 둡니다.
        </AppSurface>
      ) : null}

      <CompactHelp label="데이터 기준">
        {isAltMode
          ? `Binance 공개 선물 체결에서 ${symbolLabelText}의 최근 aggregate trades를 읽어 큰 체결 방향과 반복·교대 체결 징후를 함께 봅니다. 계정 식별은 없으므로 이상 체결 가능성만 표시합니다.`
          : `Binance 공개 선물 체결에서 ${symbolLabelText}의 최근 aggregate trades를 읽어 큰 체결 방향과 반복·교대 체결 징후를 함께 봅니다. 계정 식별은 없으므로 이상 체결 가능성만 표시합니다.`}
      </CompactHelp>
    </PanelCard>
  );
}
