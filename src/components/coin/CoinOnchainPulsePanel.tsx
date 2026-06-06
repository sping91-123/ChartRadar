"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, RefreshCcw } from "lucide-react";
import type { OnchainMetricReport, OnchainPulseGrade } from "@/lib/onchainMetrics";
import { ActionButton, AppSurface, PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";
import { CompactHelp } from "@/components/ui/CompactHelp";

type LoadStatus = "idle" | "loading" | "ready" | "error";

type OnchainPayload = {
  report?: OnchainMetricReport;
  error?: string;
};

function gradeTone(grade: OnchainPulseGrade) {
  if (grade === "hot") return "risk";
  if (grade === "busy") return "watch";
  if (grade === "normal") return "info";
  return "long";
}

function gradeLabel(grade: OnchainPulseGrade) {
  if (grade === "hot") return "혼잡";
  if (grade === "busy") return "대기 많음";
  if (grade === "normal") return "보통";
  return "차분";
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatCount(value: number) {
  if (!Number.isFinite(value)) return "-";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1_000)}K`;
  return value.toLocaleString("en-US");
}

async function fetchOnchainReport() {
  const response = await fetch("/api/onchain-metrics?network=btc", { cache: "no-store" });
  const payload = (await response.json()) as OnchainPayload;
  if (!response.ok || !payload.report) throw new Error(payload.error ?? "온체인 데이터 확인 실패");
  return payload.report;
}

export function CoinOnchainPulsePanel() {
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [report, setReport] = useState<OnchainMetricReport | null>(null);
  const [error, setError] = useState("");

  const loadReport = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const nextReport = await fetchOnchainReport();
      setReport(nextReport);
      setStatus("ready");
    } catch (nextError) {
      setStatus("error");
      setError(nextError instanceof Error ? nextError.message : "온체인 데이터를 잠시 확인하지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  return (
    <PanelCard variant="report" padding="md" className="space-y-4 border-y border-ui-line">
      <SectionHeader
        eyebrow="mempool.space 공개 온체인 데이터"
        title="BTC 온체인 체온 참고"
        description={
          report?.summary
            ? `${report.summary} 네트워크 수수료, 대기 거래, 혼잡도를 보는 변동성 참고값입니다.`
            : "BTC 네트워크 수수료, 대기 거래, 혼잡도를 보조 확인하는 중입니다."
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
          온체인 데이터 확인 중
        </AppSurface>
      ) : null}

      {report ? (
        <div className="grid gap-0 md:grid-cols-2">
          <article className="min-w-0 py-3 md:px-3">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">BTC</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{report.trigger}</p>
              </div>
              <StatusPill tone={gradeTone(report.grade)} icon={Activity} className="shrink-0">
                {gradeLabel(report.grade)}
              </StatusPill>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-semibold leading-5 text-ui-muted">
              <span>빠른 수수료</span>
              <span className="text-right text-ui-text">{report.fastestFeeSatVb} sat/vB</span>
              <span>30분 수수료</span>
              <span className="text-right">{report.halfHourFeeSatVb} sat/vB</span>
              <span>대기 거래</span>
              <span className="text-right">{formatCount(report.mempoolTxCount)}건</span>
            </div>
          </article>
          <article className="min-w-0 border-t border-ui-line py-3 md:border-l md:border-t-0 md:px-3">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-semibold leading-5 text-ui-muted">
              <span>대기 용량</span>
              <span className="text-right text-ui-text">{report.mempoolVsizeMb.toFixed(1)} vMB</span>
              <span>난이도 예상</span>
              <span className="text-right">{formatPercent(report.difficultyChangePercent)}</span>
              <span>남은 블록</span>
              <span className="text-right">{report.remainingBlocks === null ? "-" : `${Math.round(report.remainingBlocks)}개`}</span>
              <span>체온 점수</span>
              <span className="text-right">{report.pressureScore}점</span>
            </div>
          </article>
        </div>
      ) : status !== "loading" ? (
        <AppSurface variant="flat" tone="inset" padding="none" className="border-t border-ui-line py-3 text-sm font-semibold text-ui-muted">
          공개 온체인 데이터를 불러오지 못했습니다.
        </AppSurface>
      ) : null}

      <CompactHelp label="데이터 기준">
        mempool.space 공개 API에서 BTC 수수료, 대기 거래, 난이도 예상만 읽습니다. 직접 선물 방향 결론이 아니라 네트워크 혼잡이 변동성 리스크로 이어질 수 있는지 보는 참고값입니다.
      </CompactHelp>
    </PanelCard>
  );
}
