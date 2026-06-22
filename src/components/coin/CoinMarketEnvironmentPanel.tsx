"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgePercent, Globe2, RefreshCcw, ShieldAlert } from "lucide-react";
import type { CoinMarketMetricsPayload } from "@/lib/coinMarketMetrics";
import { ActionButton, AppSurface, PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";
import { CompactHelp } from "@/components/ui/CompactHelp";

type LoadStatus = "idle" | "loading" | "ready" | "error";
type MarketEnvironmentMode = "major" | "alts";

type CoinMarketMetricsResponse = Partial<CoinMarketMetricsPayload> & {
  error?: string;
};

function formatPercent(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

function formatKrw(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function dominanceMeta(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return { label: "확인 중", tone: "info" as const, detail: "BTC 비중 확인 대기" };
  }
  if (value >= 58) {
    return { label: "BTC 쏠림", tone: "watch" as const, detail: "알트보다 BTC 영향이 커질 수 있는 구간" };
  }
  if (value <= 48) {
    return { label: "알트 분산", tone: "long" as const, detail: "알트까지 자금이 퍼지는지 확인할 구간" };
  }
  return { label: "중립", tone: "info" as const, detail: "BTC와 알트 쏠림이 과하지 않은 구간" };
}

function kimchiMeta(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return { label: "확인 중", tone: "info" as const, detail: "국내 프리미엄 확인 대기" };
  }
  if (value >= 1.5) {
    return { label: "프리미엄 높음", tone: "risk" as const, detail: "국내 가격 과열이 섞였는지 분리 확인" };
  }
  if (value <= -2) {
    return { label: "역프리미엄", tone: "watch" as const, detail: "국내 수요가 약한 구간으로 분리 확인" };
  }
  return { label: "중립", tone: "info" as const, detail: "국내외 가격 차이가 크지 않은 구간" };
}

function fxMeta(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return { label: "확인 중", tone: "info" as const, detail: "USD/KRW 확인 대기" };
  }
  if (value >= 1500) {
    return { label: "환율 부담 큼", tone: "risk" as const, detail: "달러 강세 부담을 시장 배경으로 분리" };
  }
  if (value >= 1450) {
    return { label: "환율 부담", tone: "watch" as const, detail: "위험 회피 흐름과 함께 확인" };
  }
  return { label: "보통", tone: "info" as const, detail: "환율 부담이 과도한 구간은 아님" };
}

async function fetchCoinMarketMetrics() {
  const response = await fetch("/api/coin-market-metrics", { cache: "no-store" });
  const payload = (await response.json()) as CoinMarketMetricsResponse;
  if (!response.ok) throw new Error(payload.error ?? "시장 환경 확인 실패");

  return {
    btcDominancePercent: payload.btcDominancePercent ?? null,
    usdKrw: payload.usdKrw ?? null,
    kimchiPremiumPercent: payload.kimchiPremiumPercent ?? null,
    kimchiSource: payload.kimchiSource ?? null,
    cachedAt: payload.cachedAt ?? Date.now(),
    cached: Boolean(payload.cached),
    stale: payload.stale,
    warnings: payload.warnings ?? []
  } satisfies CoinMarketMetricsPayload;
}

export function CoinMarketEnvironmentPanel({ mode }: { mode: MarketEnvironmentMode }) {
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [metrics, setMetrics] = useState<CoinMarketMetricsPayload | null>(null);
  const [error, setError] = useState("");

  const loadMetrics = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const nextMetrics = await fetchCoinMarketMetrics();
      setMetrics(nextMetrics);
      setStatus("ready");
    } catch (nextError) {
      setStatus("error");
      setError(nextError instanceof Error ? nextError.message : "시장 환경을 잠시 확인하지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  const summary = useMemo(() => {
    if (!metrics) {
      return mode === "alts"
        ? "BTC 도미넌스, 김치 프리미엄, 환율을 알트 선물의 배경 리스크로 확인하는 중입니다."
        : "BTC 도미넌스, 김치 프리미엄, 환율을 BTC/ETH 선물의 배경 리스크로 확인하는 중입니다.";
    }

    const riskHints: string[] = [];
    if (metrics.btcDominancePercent !== null && metrics.btcDominancePercent >= 58) riskHints.push("BTC 쏠림");
    if (metrics.kimchiPremiumPercent !== null && Math.abs(metrics.kimchiPremiumPercent) >= 1.5) riskHints.push("국내 프리미엄");
    if (metrics.usdKrw !== null && metrics.usdKrw >= 1450) riskHints.push("환율 부담");

    if (riskHints.length) {
      return `${riskHints.join(" · ")}을 방향 신호와 분리해서 봅니다.`;
    }

    return "BTC 쏠림, 국내 프리미엄, 환율 부담이 과도한 구간은 아닙니다.";
  }, [metrics, mode]);

  const dominance = dominanceMeta(metrics?.btcDominancePercent);
  const kimchi = kimchiMeta(metrics?.kimchiPremiumPercent);
  const fx = fxMeta(metrics?.usdKrw);

  return (
    <PanelCard variant="report" padding="md" className="space-y-4">
      <SectionHeader
        eyebrow="시장 전체 보조값"
        title={mode === "alts" ? "알트 선물 시장 환경" : "BTC/ETH 시장 환경"}
        description={summary}
        action={
          <ActionButton tone="secondary" onClick={loadMetrics} disabled={status === "loading"}>
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

      {status === "loading" && !metrics ? (
        <AppSurface variant="flat" tone="inset" padding="none" className="border-t border-ui-line py-3 text-sm font-semibold text-ui-muted">
          시장 환경 확인 중
        </AppSurface>
      ) : null}

      <div className="grid gap-2 md:grid-cols-3">
        <article className="min-w-0 rounded-ui-sm bg-ui-elevated px-3 py-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">BTC DOMINANCE</p>
              <p className="mt-1 text-xl font-semibold leading-7 text-ui-text">{formatPercent(metrics?.btcDominancePercent)}</p>
            </div>
            <StatusPill tone={dominance.tone} icon={BadgePercent} className="shrink-0">
              {dominance.label}
            </StatusPill>
          </div>
          <p className="mt-2 text-xs leading-5 text-ui-muted [word-break:keep-all]">{dominance.detail}</p>
        </article>

        <article className="min-w-0 rounded-ui-sm bg-ui-elevated px-3 py-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">KIMCHI PREMIUM</p>
              <p className="mt-1 text-xl font-semibold leading-7 text-ui-text">{formatPercent(metrics?.kimchiPremiumPercent, 2)}</p>
            </div>
            <StatusPill tone={kimchi.tone} icon={ShieldAlert} className="shrink-0">
              {kimchi.label}
            </StatusPill>
          </div>
          <p className="mt-2 text-xs leading-5 text-ui-muted [word-break:keep-all]">{kimchi.detail}</p>
        </article>

        <article className="min-w-0 rounded-ui-sm bg-ui-elevated px-3 py-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">USD/KRW</p>
              <p className="mt-1 text-xl font-semibold leading-7 text-ui-text">{formatKrw(metrics?.usdKrw)}</p>
            </div>
            <StatusPill tone={fx.tone} icon={Globe2} className="shrink-0">
              {fx.label}
            </StatusPill>
          </div>
          <p className="mt-2 text-xs leading-5 text-ui-muted [word-break:keep-all]">{fx.detail}</p>
        </article>
      </div>

      {metrics?.warnings.length ? (
        <AppSurface variant="flat" tone="inset" padding="none" className="border-t border-ui-line pt-3 text-xs font-semibold leading-5 text-ui-muted">
          일부 공개 데이터 확인 제한: {metrics.warnings.join(", ")}
        </AppSurface>
      ) : null}

      <CompactHelp label="데이터 기준">
        BTC 도미넌스는 CoinGecko global 공개값, USD/KRW는 Frankfurter 공개 환율, 김치 프리미엄은 Upbit BTC와 Binance BTC 가격 차이를 기준으로 계산합니다. 이 값들은 직접 방향 결론이 아니라 선물 신호를 해석할 때의 배경 리스크입니다.
      </CompactHelp>
    </PanelCard>
  );
}
