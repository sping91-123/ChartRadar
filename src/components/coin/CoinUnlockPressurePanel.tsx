"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, RefreshCcw } from "lucide-react";
import type { TokenUnlockEvent, TokenUnlockPressureLevel, TokenUnlockReport } from "@/lib/tokenUnlocks";
import { ActionButton, AppSurface, PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";
import { CompactHelp } from "@/components/ui/CompactHelp";

type LoadStatus = "idle" | "loading" | "ready" | "error";

type TokenUnlockPayload = {
  report?: TokenUnlockReport;
  error?: string;
};

function formatDate(date: string | null) {
  if (!date) return "날짜 확인 중";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  return `${Number(match[2])}월 ${Number(match[3])}일`;
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

function levelTone(level: TokenUnlockPressureLevel) {
  if (level === "extreme" || level === "high") return "risk";
  if (level === "medium") return "watch";
  return "info";
}

function levelLabel(level: TokenUnlockPressureLevel) {
  if (level === "extreme") return "부담 매우 큼";
  if (level === "high") return "부담 큼";
  if (level === "medium") return "부담 있음";
  return "가볍게 확인";
}

function scoreForSort(item: TokenUnlockEvent) {
  return item.pressureScore * 10_000_000_000 + item.unlockValueUsd;
}

async function fetchTokenUnlocks() {
  const response = await fetch("/api/token-unlocks?limit=6", { cache: "no-store" });
  const payload = (await response.json()) as TokenUnlockPayload;
  if (!response.ok || !payload.report) throw new Error(payload.error ?? "언락 데이터 확인 실패");
  return payload.report;
}

export function CoinUnlockPressurePanel() {
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [report, setReport] = useState<TokenUnlockReport | null>(null);
  const [error, setError] = useState("");

  const loadReport = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const nextReport = await fetchTokenUnlocks();
      setReport(nextReport);
      setStatus("ready");
    } catch (nextError) {
      setStatus("error");
      setError(nextError instanceof Error ? nextError.message : "언락 데이터를 잠시 확인하지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const items = useMemo(() => {
    return (report?.items ?? []).slice().sort((a, b) => scoreForSort(b) - scoreForSort(a)).slice(0, 4);
  }, [report]);

  const top = items[0] ?? null;
  const summary = top ? `${top.symbol} ${top.unlockValueLabel} · ${formatDate(top.unlockDate)}` : "다가오는 알트 언락 부담을 확인하는 중입니다.";

  return (
    <PanelCard variant="report" padding="md" className="space-y-4">
      <SectionHeader
        eyebrow="Tokenomics 공개 언락 페이지"
        title="알트 언락 부담"
        description={summary}
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

      {status === "loading" && !items.length ? (
        <AppSurface variant="flat" tone="inset" padding="none" className="border-t border-ui-line py-3 text-sm font-semibold text-ui-muted">
          언락 부담 확인 중
        </AppSurface>
      ) : null}

      {items.length ? (
        <div className="grid gap-2 md:grid-cols-2">
          {items.map((item, index) => (
            <article
              key={`${item.slug ?? item.symbol}-${item.unlockDate ?? index}`}
              className="min-w-0 rounded-ui-sm bg-ui-elevated px-3 py-3"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{item.symbol}</p>
                  <p className="mt-1 truncate text-sm font-semibold leading-5 text-ui-text">{item.project}</p>
                </div>
                <StatusPill tone={levelTone(item.pressureLevel)} icon={CalendarDays} className="shrink-0">
                  {levelLabel(item.pressureLevel)}
                </StatusPill>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-semibold leading-5 text-ui-muted">
                <span>{formatDate(item.unlockDate)}</span>
                <span className="text-right text-ui-text">{item.unlockValueLabel}</span>
                <span>이번 물량 {item.unlockAmountLabel}</span>
                <span className="text-right">시총 대비 {formatPercent(item.percentOfMarketCap)}</span>
                <span>풀린 비율 {formatPercent(item.tokensReleasedPercent)}</span>
                <span className="text-right">부담 {item.pressureScore}점</span>
              </div>
            </article>
          ))}
        </div>
      ) : status !== "loading" ? (
        <AppSurface variant="flat" tone="inset" padding="none" className="border-t border-ui-line py-3 text-sm font-semibold text-ui-muted">
          공개 언락 데이터를 불러오지 못했습니다.
        </AppSurface>
      ) : null}

      <CompactHelp label="계산 기준">
        Unlock Value와 % of MCAP를 함께 봅니다. 시총 대비 비율이 클수록 단기 공급 부담이 커질 수 있습니다.
      </CompactHelp>
    </PanelCard>
  );
}
