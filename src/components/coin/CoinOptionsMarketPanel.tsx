"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw, Zap } from "lucide-react";
import type { OptionsCurrency, OptionsMarketReport, OptionsMarketSide } from "@/lib/optionsMarket";
import { ActionButton, AppSurface, PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";
import { CompactHelp } from "@/components/ui/CompactHelp";

type LoadStatus = "idle" | "loading" | "ready" | "error";

type OptionsMarketPayload = {
  report?: OptionsMarketReport;
  error?: string;
};

const currencies: OptionsCurrency[] = ["BTC", "ETH"];

function formatRatio(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${value.toFixed(value >= 10 ? 1 : 2)}배`;
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${value.toFixed(0)}%`;
}

function formatUsd(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "-";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatPrice(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function sideTone(side: OptionsMarketSide) {
  if (side === "call") return "long";
  if (side === "put") return "short";
  return "watch";
}

function sideLabel(side: OptionsMarketSide) {
  if (side === "call") return "콜 우세";
  if (side === "put") return "풋 우세";
  return "균형";
}

function sideAction(side: OptionsMarketSide) {
  if (side === "call") return "위쪽 변동성 대비";
  if (side === "put") return "아래쪽 방어 수요";
  return "방향 쏠림 약함";
}

function gradeLabel(report: OptionsMarketReport) {
  if (report.grade === "extreme") return "매우 뜨거움";
  if (report.grade === "heated") return "뜨거움";
  if (report.grade === "normal") return "보통";
  return "차분";
}

async function fetchOptionsMarket(currency: OptionsCurrency) {
  const response = await fetch(`/api/options-market?currency=${currency}`, { cache: "no-store" });
  const payload = (await response.json()) as OptionsMarketPayload;
  if (!response.ok || !payload.report) throw new Error(payload.error ?? "옵션 시장 확인 실패");
  return payload.report;
}

export function CoinOptionsMarketPanel() {
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [reports, setReports] = useState<OptionsMarketReport[]>([]);
  const [error, setError] = useState("");

  const loadReports = useCallback(async () => {
    setStatus("loading");
    setError("");
    const results = await Promise.allSettled(currencies.map((currency) => fetchOptionsMarket(currency)));
    const nextReports = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));

    if (nextReports.length) {
      setReports(nextReports.sort((a, b) => currencies.indexOf(a.currency) - currencies.indexOf(b.currency)));
      setStatus("ready");
      return;
    }

    setStatus("error");
    setError("옵션 시장 데이터를 잠시 확인하지 못했습니다.");
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const topReport = useMemo(() => {
    return reports
      .slice()
      .sort((a, b) => Math.abs(b.biasPercent) - Math.abs(a.biasPercent))[0];
  }, [reports]);

  const topSummary = topReport ? `${topReport.currency} ${topReport.summary}` : "BTC/ETH 옵션 쏠림을 확인하는 중입니다.";

  return (
    <PanelCard variant="report" padding="md" className="space-y-4 border-y border-ui-line">
      <SectionHeader
        eyebrow="Deribit 공개 옵션 데이터"
        title="옵션 시장 온도"
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

      {status === "loading" && !reports.length ? (
        <AppSurface variant="flat" tone="inset" padding="none" className="border-t border-ui-line py-3 text-sm font-semibold text-ui-muted">
          옵션 쏠림 확인 중
        </AppSurface>
      ) : null}

      {reports.length ? (
        <div className="grid gap-0 md:grid-cols-2">
          {reports.map((report, index) => {
            const tone = sideTone(report.dominantSide);
            return (
              <article
                key={report.currency}
                className={`min-w-0 py-3 md:px-3 ${index > 0 ? "border-t border-ui-line md:border-t-0 md:border-l" : ""}`}
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{report.currency}</p>
                    <p className="mt-1 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{sideLabel(report.dominantSide)}</p>
                  </div>
                  <StatusPill tone={tone} icon={Zap} className="shrink-0">
                    {gradeLabel(report)}
                  </StatusPill>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-semibold leading-5 text-ui-muted">
                  <span>{sideAction(report.dominantSide)}</span>
                  <span className="text-right text-ui-text">{report.trigger}</span>
                  <span>콜/풋 계약 {formatRatio(report.callPutOpenInterestRatio)}</span>
                  <span className="text-right">IV {formatPercent(report.averageMarkIv)}</span>
                  <span>거래대금 {formatUsd(report.callVolumeUsd + report.putVolumeUsd)}</span>
                  <span className="text-right">집중 가격 {formatPrice(report.topStrike?.strike)}</span>
                </div>
              </article>
            );
          })}
        </div>
      ) : status !== "loading" ? (
        <AppSurface variant="flat" tone="inset" padding="none" className="border-t border-ui-line py-3 text-sm font-semibold text-ui-muted">
          공개 옵션 데이터를 불러오지 못했습니다.
        </AppSurface>
      ) : null}

      <CompactHelp label="데이터 기준">
        Deribit 공개 옵션 요약에서 BTC/ETH 옵션의 미결제약정, 거래대금, IV를 묶어 콜과 풋 중 어디에 더 몰렸는지만 보여줍니다.
      </CompactHelp>
    </PanelCard>
  );
}
