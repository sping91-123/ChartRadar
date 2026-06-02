"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleDollarSign, RefreshCcw } from "lucide-react";
import type { StablecoinLiquidityGrade, StablecoinLiquidityReport } from "@/lib/stablecoinLiquidity";
import { ActionButton, AppSurface, PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";
import { CompactHelp } from "@/components/ui/CompactHelp";

type LoadStatus = "idle" | "loading" | "ready" | "error";

type StablecoinLiquidityPayload = {
  report?: StablecoinLiquidityReport;
  error?: string;
};

function gradeTone(grade: StablecoinLiquidityGrade) {
  if (grade === "strong") return "long";
  if (grade === "building") return "info";
  if (grade === "drying") return "risk";
  return "watch";
}

function gradeLabel(grade: StablecoinLiquidityGrade) {
  if (grade === "strong") return "유입 강함";
  if (grade === "building") return "유입 우세";
  if (grade === "drying") return "유출 부담";
  return "중립";
}

function formatUsd(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000_000) return `${sign}$${(abs / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(0)}M`;
  return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
}

function formatUsdChange(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatUsd(value)}`;
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

async function fetchStablecoinLiquidity() {
  const response = await fetch("/api/stablecoin-liquidity", { cache: "no-store" });
  const payload = (await response.json()) as StablecoinLiquidityPayload;
  if (!response.ok || !payload.report) throw new Error(payload.error ?? "스테이블코인 유동성 확인 실패");
  return payload.report;
}

export function CoinStablecoinLiquidityPanel() {
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [report, setReport] = useState<StablecoinLiquidityReport | null>(null);
  const [error, setError] = useState("");

  const loadReport = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const nextReport = await fetchStablecoinLiquidity();
      setReport(nextReport);
      setStatus("ready");
    } catch (nextError) {
      setStatus("error");
      setError(nextError instanceof Error ? nextError.message : "스테이블코인 유동성을 잠시 확인하지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  return (
    <PanelCard variant="report" padding="md" className="space-y-4 border-y border-ui-line">
      <SectionHeader
        eyebrow="DeFiLlama 공개 스테이블코인 데이터"
        title="스테이블코인 유동성 참고"
        description={
          report?.summary
            ? `${report.summary} 선물 직접 신호가 아니라 시장 전체 환경 참고값입니다.`
            : "시장 전체 유동성 배경을 보조 확인하는 중입니다."
        }
        action={
          <ActionButton tone="secondary" onClick={loadReport} disabled={status === "loading"}>
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

      {status === "loading" && !report ? (
        <AppSurface variant="flat" tone="inset" padding="none" className="border-t border-ui-line py-3 text-sm font-semibold text-ui-muted">
          유동성 확인 중
        </AppSurface>
      ) : null}

      {report ? (
        <div className="grid gap-0 md:grid-cols-2">
          <article className="min-w-0 py-3 md:px-3">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">USD STABLE</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{report.trigger}</p>
              </div>
              <StatusPill tone={gradeTone(report.grade)} icon={CircleDollarSign} className="shrink-0">
                {gradeLabel(report.grade)}
              </StatusPill>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-semibold leading-5 text-ui-muted">
              <span>전체 규모</span>
              <span className="text-right text-ui-text">{formatUsd(report.totalUsd)}</span>
              <span>1일 변화</span>
              <span className="text-right">{formatUsdChange(report.change1dUsd)}</span>
              <span>7일 변화</span>
              <span className="text-right">{formatUsdChange(report.change7dUsd)}</span>
            </div>
          </article>
          <article className="min-w-0 border-t border-ui-line py-3 md:border-l md:border-t-0 md:px-3">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-semibold leading-5 text-ui-muted">
              <span>1일 비율</span>
              <span className="text-right text-ui-text">{formatPercent(report.change1dPercent)}</span>
              <span>7일 비율</span>
              <span className="text-right">{formatPercent(report.change7dPercent)}</span>
              <span>30일 비율</span>
              <span className="text-right">{formatPercent(report.change30dPercent)}</span>
              <span>유입 점수</span>
              <span className="text-right">{report.flowScore}점</span>
            </div>
          </article>
        </div>
      ) : status !== "loading" ? (
        <AppSurface variant="flat" tone="inset" padding="none" className="border-t border-ui-line py-3 text-sm font-semibold text-ui-muted">
          공개 스테이블코인 데이터를 불러오지 못했습니다.
        </AppSurface>
      ) : null}

      <CompactHelp label="데이터 기준">
        DeFiLlama stablecoincharts/all 공개 데이터에서 달러 스테이블코인 유통량만 봅니다. BTC/ETH 또는 알트 선물 방향 결론이 아니라 시장 전체 환경을 보조 확인하는 값입니다.
      </CompactHelp>
    </PanelCard>
  );
}
