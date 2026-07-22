"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BadgePercent, Globe2, RefreshCcw, ShieldAlert } from "lucide-react";
import type {
  CoinMarketMetricsPayload,
  MarketMetricCadence,
  MarketMetricFreshness,
  UsdKrwSource
} from "@/lib/coinMarketMetrics";
import { ActionButton, AppSurface, PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";
import { CompactHelp } from "@/components/ui/CompactHelp";

type LoadStatus = "idle" | "loading" | "ready" | "error";
type MarketEnvironmentMode = "major" | "alts";

type CoinMarketMetricsResponse = Partial<CoinMarketMetricsPayload> & {
  error?: string;
};

const AUTO_REFRESH_MS = 60_000;
const USD_KRW_SOURCES = new Set<UsdKrwSource>(["tradingview-scanner", "exchangerate-dev", "exchangerate-fun", "frankfurter"]);
const FRESHNESS_VALUES = new Set<MarketMetricFreshness>(["live", "hourly", "daily", "stale", "unavailable"]);
const CADENCE_VALUES = new Set<MarketMetricCadence>(["live", "hourly", "daily"]);
const KST_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

function normalizedNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatPercent(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

function formatKrw(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function formatUsd(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `$${value.toFixed(4)}`;
}

function formatObservedAt(value: string | null | undefined) {
  if (!value) return "시각 확인 중";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "시각 확인 중";
  return KST_DATE_TIME_FORMATTER.format(new Date(timestamp));
}

function formatReference(observedAt: string | null | undefined, referenceDate: string | null | undefined) {
  const parts = referenceDate?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (parts) return `${Number(parts[2])}.${Number(parts[3])} 기준`;
  return formatObservedAt(observedAt);
}

function cadenceLabel(value: MarketMetricCadence | null | undefined) {
  if (value === "live") return "실시간";
  if (value === "hourly") return "시간 단위";
  if (value === "daily") return "일 단위";
  return "";
}

function freshnessLabel(value: MarketMetricFreshness, cadence?: MarketMetricCadence | null) {
  if (value === "live") return "실시간 참고";
  if (value === "hourly") return "시간 단위 갱신";
  if (value === "daily") return "전일 기준";
  if (value === "stale") return `마지막 정상값${cadence ? ` · ${cadenceLabel(cadence)}` : ""}`;
  return "확인 중";
}

function fxSourceLabel(value: UsdKrwSource | null | undefined) {
  if (value === "tradingview-scanner") return "TradingView USDKRW";
  if (value === "exchangerate-dev") return "exchangerate.dev";
  if (value === "exchangerate-fun") return "ExchangeRate.fun";
  if (value === "frankfurter") return "Frankfurter";
  return "환율 공급자 확인 중";
}

function metricChangeLabel(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "등락률 확인 중";
  return `등락 ${formatPercent(value, 2)}`;
}

function metricChangeClass(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value) || value === 0) return "text-ui-subtle";
  return value > 0 ? "text-ui-long" : "text-ui-short";
}

function metricReference({
  source,
  retrievedAt,
  observedAt,
  referenceDate,
  freshness,
  cadence
}: {
  source: UsdKrwSource | null | undefined;
  retrievedAt: string | null | undefined;
  observedAt: string | null | undefined;
  referenceDate: string | null | undefined;
  freshness: MarketMetricFreshness;
  cadence?: MarketMetricCadence | null;
}) {
  if (source === "tradingview-scanner") {
    return `${freshness === "stale" ? "마지막 정상값 · " : ""}서버 확인 ${formatObservedAt(retrievedAt)}`;
  }
  return `${freshnessLabel(freshness, cadence)} · ${formatReference(observedAt, referenceDate)}`;
}

function dominanceDetail(value: number | null | undefined, changePercent: number | null | undefined) {
  if (value === null || value === undefined) return "전체 코인 시가총액에서 BTC가 차지하는 비중을 확인하는 중입니다.";
  if (changePercent === null || changePercent === undefined) return "BTC 시가총액 비중은 확인됐지만 등락률은 다시 확인하는 중입니다.";
  if (changePercent !== null && changePercent !== undefined && changePercent > 0.1) {
    return "BTC 시가총액 비중이 전일보다 높아져 알트의 상대 강도를 보수적으로 확인할 구간입니다.";
  }
  if (changePercent !== null && changePercent !== undefined && changePercent < -0.1) {
    return "BTC 시가총액 비중이 전일보다 낮아져 알트의 상대 강도 변화를 함께 확인할 구간입니다.";
  }
  return "BTC 시가총액 비중의 하루 변화가 크지 않은 구간입니다.";
}

function fxDetail(changePercent: number | null | undefined) {
  if (changePercent === null || changePercent === undefined) return "현재 원·달러 값은 확인됐지만 등락률은 다시 확인하는 중입니다.";
  if (changePercent !== null && changePercent !== undefined && changePercent > 0.1) {
    return "달러가 원화 대비 강해져 같은 달러 가격도 원화로는 더 비싸진 구간입니다.";
  }
  if (changePercent !== null && changePercent !== undefined && changePercent < -0.1) {
    return "달러가 원화 대비 약해져 같은 달러 가격의 원화 환산 부담이 낮아진 구간입니다.";
  }
  return "원·달러 환율의 하루 변화가 크지 않은 구간입니다.";
}

function kimchiMeta(value: number | null | undefined, stale = false) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return { label: "확인 중", tone: "info" as const, detail: "국내외 BTC 현물 가격을 다시 맞춰 보는 중입니다." };
  }
  if (stale) {
    return { label: "마지막 참고값", tone: "watch" as const, detail: "일부 원천이 지연되어 마지막으로 검증된 계산값을 보여줍니다." };
  }
  if (value >= 1.5) {
    return { label: "프리미엄 높음", tone: "risk" as const, detail: "국내 BTC가 해외 현물 환산가보다 비싼 구간입니다." };
  }
  if (value <= -1.5) {
    return { label: "역프리미엄", tone: "watch" as const, detail: "국내 BTC가 해외 현물 환산가보다 싼 구간입니다." };
  }
  return { label: "차이 작음", tone: "info" as const, detail: "국내외 BTC 현물 가격 차이가 크지 않은 구간입니다." };
}

async function fetchCoinMarketMetrics(signal: AbortSignal) {
  const response = await fetch("/api/coin-market-metrics", { cache: "no-store", signal });
  const payload = (await response.json()) as CoinMarketMetricsResponse;
  if (!response.ok) throw new Error(payload.error ?? "시장 환경 확인 실패");

  const usdKrwSource = payload.usdKrwSource && USD_KRW_SOURCES.has(payload.usdKrwSource) ? payload.usdKrwSource : null;
  const usdKrwFreshness = payload.usdKrwFreshness && FRESHNESS_VALUES.has(payload.usdKrwFreshness)
    ? payload.usdKrwFreshness
    : "unavailable";
  const usdKrwCadence = payload.usdKrwCadence && CADENCE_VALUES.has(payload.usdKrwCadence)
    ? payload.usdKrwCadence
    : null;
  const kimchiFxFreshness = payload.kimchiFxFreshness && FRESHNESS_VALUES.has(payload.kimchiFxFreshness)
    ? payload.kimchiFxFreshness
    : "unavailable";
  const kimchiFxCadence = payload.kimchiFxCadence && CADENCE_VALUES.has(payload.kimchiFxCadence)
    ? payload.kimchiFxCadence
    : null;
  const kimchiFxSource = payload.kimchiFxSource && USD_KRW_SOURCES.has(payload.kimchiFxSource)
    ? payload.kimchiFxSource
    : null;

  return {
    btcDominancePercent: normalizedNumber(payload.btcDominancePercent),
    btcDominanceChangePercent: normalizedNumber(payload.btcDominanceChangePercent),
    btcDominanceSource: payload.btcDominanceSource === "tradingview-scanner" ? payload.btcDominanceSource : null,
    btcDominanceSymbol: "CRYPTOCAP:BTC.D",
    btcDominanceRetrievedAt: typeof payload.btcDominanceRetrievedAt === "string" ? payload.btcDominanceRetrievedAt : null,
    btcDominanceStale: Boolean(payload.btcDominanceStale),
    usdKrw: normalizedNumber(payload.usdKrw),
    usdKrwChangePercent: normalizedNumber(payload.usdKrwChangePercent),
    usdKrwSource,
    usdKrwObservedAt: typeof payload.usdKrwObservedAt === "string" ? payload.usdKrwObservedAt : null,
    usdKrwRetrievedAt: typeof payload.usdKrwRetrievedAt === "string" ? payload.usdKrwRetrievedAt : null,
    usdKrwReferenceDate: typeof payload.usdKrwReferenceDate === "string" ? payload.usdKrwReferenceDate : null,
    usdKrwFreshness,
    usdKrwCadence,
    kimchiPremiumPercent: normalizedNumber(payload.kimchiPremiumPercent),
    kimchiSource: payload.kimchiSource === "upbit-binance-spot-coinbase-usdt-usd" ? payload.kimchiSource : null,
    kimchiStale: Boolean(payload.kimchiStale),
    kimchiObservedAt: typeof payload.kimchiObservedAt === "string" ? payload.kimchiObservedAt : null,
    kimchiCalculatedAt: typeof payload.kimchiCalculatedAt === "string" ? payload.kimchiCalculatedAt : null,
    kimchiFxRate: normalizedNumber(payload.kimchiFxRate),
    kimchiFxSource,
    kimchiFxObservedAt: typeof payload.kimchiFxObservedAt === "string" ? payload.kimchiFxObservedAt : null,
    kimchiFxRetrievedAt: typeof payload.kimchiFxRetrievedAt === "string" ? payload.kimchiFxRetrievedAt : null,
    kimchiFxReferenceDate: typeof payload.kimchiFxReferenceDate === "string" ? payload.kimchiFxReferenceDate : null,
    kimchiFxFreshness,
    kimchiFxCadence,
    kimchiUsdtUsdRate: normalizedNumber(payload.kimchiUsdtUsdRate),
    kimchiUsdtUsdObservedAt: typeof payload.kimchiUsdtUsdObservedAt === "string" ? payload.kimchiUsdtUsdObservedAt : null,
    upbitBtcObservedAt: typeof payload.upbitBtcObservedAt === "string" ? payload.upbitBtcObservedAt : null,
    binanceBtcObservedAt: typeof payload.binanceBtcObservedAt === "string" ? payload.binanceBtcObservedAt : null,
    cachedAt: typeof payload.cachedAt === "number" ? payload.cachedAt : Date.now(),
    cached: Boolean(payload.cached),
    stale: Boolean(payload.stale),
    warnings: Array.isArray(payload.warnings) ? payload.warnings.filter((warning): warning is string => typeof warning === "string") : []
  } satisfies CoinMarketMetricsPayload;
}

export function CoinMarketEnvironmentPanel({ mode }: { mode: MarketEnvironmentMode }) {
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [metrics, setMetrics] = useState<CoinMarketMetricsPayload | null>(null);
  const [error, setError] = useState("");
  const requestControllerRef = useRef<AbortController | null>(null);
  const requestGenerationRef = useRef(0);
  const lastRequestedAtRef = useRef(0);

  const loadMetrics = useCallback(async (silent = false) => {
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    const generation = requestGenerationRef.current + 1;
    requestControllerRef.current = controller;
    requestGenerationRef.current = generation;
    lastRequestedAtRef.current = Date.now();
    if (!silent) setStatus("loading");
    setError("");

    try {
      const nextMetrics = await fetchCoinMarketMetrics(controller.signal);
      if (requestGenerationRef.current !== generation) return;
      setMetrics(nextMetrics);
      setStatus("ready");
    } catch (nextError) {
      if (controller.signal.aborted || requestGenerationRef.current !== generation) return;
      setMetrics((current) => current ? {
        ...current,
        stale: true,
        btcDominanceStale: current.btcDominancePercent !== null || current.btcDominanceStale,
        usdKrwFreshness: current.usdKrw === null ? current.usdKrwFreshness : "stale",
        kimchiStale: current.kimchiPremiumPercent !== null || current.kimchiStale,
        kimchiFxFreshness: current.kimchiFxRate === null ? current.kimchiFxFreshness : "stale"
      } : current);
      setStatus("error");
      setError(nextError instanceof Error ? nextError.message : "시장 환경을 잠시 확인하지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    void loadMetrics();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadMetrics(true);
    }, AUTO_REFRESH_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRequestedAtRef.current >= AUTO_REFRESH_MS) void loadMetrics(true);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      requestControllerRef.current?.abort();
    };
  }, [loadMetrics]);

  const summary = useMemo(() => {
    if (!metrics) {
      return mode === "alts"
        ? "BTC 쏠림, 국내외 가격 차이, 환율을 알트 선물의 배경 위험으로 확인하는 중입니다."
        : "BTC 쏠림, 국내외 가격 차이, 환율을 BTC/ETH 선물의 배경 위험으로 확인하는 중입니다.";
    }

    const riskHints: string[] = [];
    if (metrics.kimchiPremiumPercent !== null && Math.abs(metrics.kimchiPremiumPercent) >= 1.5) riskHints.push("국내외 BTC 가격 차이");
    if (metrics.stale) riskHints.push("일부 데이터 지연");

    if (riskHints.length) return `${riskHints.join(" · ")}을 가격 방향과 따로 확인하세요.`;
    if (metrics.btcDominanceChangePercent !== null && Math.abs(metrics.btcDominanceChangePercent) >= 0.1) {
      return `BTC 비중이 전일보다 ${metrics.btcDominanceChangePercent > 0 ? "높아진" : "낮아진"} 흐름과 국내외 현물 가격 차이를 함께 확인합니다.`;
    }
    return "BTC 비중의 하루 변화와 국내외 현물 가격 차이를 함께 보면 시장 쏠림을 더 쉽게 구분할 수 있습니다.";
  }, [metrics, mode]);

  const kimchi = kimchiMeta(metrics?.kimchiPremiumPercent, metrics?.kimchiStale);

  return (
    <PanelCard variant="report" padding="md" className="space-y-4">
      <SectionHeader
        eyebrow="시장 전체 보조값"
        title={mode === "alts" ? "알트 선물 시장 환경" : "BTC/ETH 시장 환경"}
        description={summary}
        action={
          <ActionButton tone="secondary" onClick={() => void loadMetrics()} disabled={status === "loading"}>
            <RefreshCcw className={status === "loading" ? "animate-spin" : ""} size={15} aria-hidden />
            갱신
          </ActionButton>
        }
      />

      {error ? (
        <AppSurface variant="flat" tone="critical" padding="none" className="border-t border-ui-line py-2 text-sm font-semibold text-ui-risk">
          {metrics ? `갱신 실패 · 마지막 정상값을 유지합니다. ${error}` : error}
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
            <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">BTC 도미넌스</p>
            <StatusPill tone={metrics?.btcDominanceStale ? "watch" : "info"} icon={BadgePercent} className="shrink-0">
              {metrics?.btcDominanceStale ? "마지막 정상값" : "BTC.D"}
            </StatusPill>
          </div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="text-2xl font-black tabular-nums tracking-tight text-ui-text">
              {metrics?.btcDominancePercent === null || metrics?.btcDominancePercent === undefined ? "-" : `${metrics.btcDominancePercent.toFixed(2)}%`}
            </p>
            <p className={`pb-0.5 text-xs font-bold tabular-nums ${metricChangeClass(metrics?.btcDominanceChangePercent)}`}>
              {metricChangeLabel(metrics?.btcDominanceChangePercent)}
            </p>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-ui-line pt-2 text-[11px] text-ui-subtle">
            <span>{metrics?.btcDominanceStale ? "마지막 확인" : "서버 확인"} {formatObservedAt(metrics?.btcDominanceRetrievedAt)}</span>
            <a className="shrink-0 font-semibold text-ui-muted underline decoration-ui-line underline-offset-4" href="https://www.tradingview.com/symbols/BTC.D/" target="_blank" rel="noreferrer">원문</a>
          </div>
          <p className="mt-2 text-xs leading-5 text-ui-muted [word-break:keep-all]">
            {dominanceDetail(metrics?.btcDominancePercent, metrics?.btcDominanceChangePercent)}
          </p>
        </article>

        <article className="min-w-0 rounded-ui-sm bg-ui-elevated px-3 py-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">BTC 김프 · 현물</p>
            <StatusPill tone={kimchi.tone} icon={ShieldAlert} className="shrink-0">
              {kimchi.label}
            </StatusPill>
          </div>
          <p className="mt-3 text-xl font-semibold leading-7 text-ui-text">{formatPercent(metrics?.kimchiPremiumPercent, 2)}</p>
          <p className="mt-2 text-xs leading-5 text-ui-muted [word-break:keep-all]">{kimchi.detail}</p>
          <p className="mt-2 border-t border-ui-line pt-2 text-[11px] leading-4 text-ui-subtle [word-break:keep-all]">
            Upbit BTC/KRW ↔ Binance BTC/USDT 현물 · {formatObservedAt(metrics?.kimchiObservedAt)}
            <br />
            USDT/USD {formatUsd(metrics?.kimchiUsdtUsdRate)} · Coinbase 체결가 · {formatObservedAt(metrics?.kimchiUsdtUsdObservedAt)}
            <br />
            계산 환율 {formatKrw(metrics?.kimchiFxRate)} · {fxSourceLabel(metrics?.kimchiFxSource)} · {metricReference({ source: metrics?.kimchiFxSource, retrievedAt: metrics?.kimchiFxRetrievedAt, observedAt: metrics?.kimchiFxObservedAt, referenceDate: metrics?.kimchiFxReferenceDate, freshness: metrics?.kimchiFxFreshness ?? "unavailable", cadence: metrics?.kimchiFxCadence })}
          </p>
        </article>

        <article className="min-w-0 rounded-ui-sm bg-ui-elevated px-3 py-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">원·달러 환율</p>
            <StatusPill tone={metrics?.usdKrwFreshness === "stale" ? "watch" : "info"} icon={Globe2} className="shrink-0">
              {metrics?.usdKrwFreshness === "stale" ? "마지막 정상값" : metrics?.usdKrwSource === "tradingview-scanner" ? "USDKRW" : fxSourceLabel(metrics?.usdKrwSource)}
            </StatusPill>
          </div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="text-2xl font-black tabular-nums tracking-tight text-ui-text">{formatKrw(metrics?.usdKrw)}</p>
            <p className={`pb-0.5 text-xs font-bold tabular-nums ${metricChangeClass(metrics?.usdKrwChangePercent)}`}>
              {metricChangeLabel(metrics?.usdKrwChangePercent)}
            </p>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-ui-line pt-2 text-[11px] text-ui-subtle">
            <span>{metricReference({ source: metrics?.usdKrwSource, retrievedAt: metrics?.usdKrwRetrievedAt, observedAt: metrics?.usdKrwObservedAt, referenceDate: metrics?.usdKrwReferenceDate, freshness: metrics?.usdKrwFreshness ?? "unavailable", cadence: metrics?.usdKrwCadence })}</span>
            {metrics?.usdKrwSource === "tradingview-scanner" ? <a className="shrink-0 font-semibold text-ui-muted underline decoration-ui-line underline-offset-4" href="https://www.tradingview.com/symbols/USDKRW/" target="_blank" rel="noreferrer">원문</a> : null}
          </div>
          <p className="mt-2 text-xs leading-5 text-ui-muted [word-break:keep-all]">
            {fxDetail(metrics?.usdKrwChangePercent)}
          </p>
        </article>
      </div>

      {metrics?.warnings.length ? (
        <AppSurface variant="flat" tone="inset" padding="none" className="border-t border-ui-line pt-3 text-xs font-semibold leading-5 text-ui-muted">
          일부 공개 데이터 확인 제한: {metrics.warnings.join(", ")}
        </AppSurface>
      ) : null}

      <p className="text-[11px] leading-4 text-ui-subtle">
        자동 갱신 1분 · 김프 계산 {formatObservedAt(metrics?.kimchiCalculatedAt)}
      </p>

      <CompactHelp label="데이터 기준">
        BTC 도미넌스와 원·달러 환율은 TradingView 화면이 사용하는 비공식 시세 응답에서 서버가 확인한 숫자를 ChartRadar 형식으로 표시합니다. 원천 관측시각은 제공되지 않아 서버 확인 시각을 표기하며, 실시간 상태가 아니거나 응답이 막히면 마지막 정상값과 기존 환율 공급자로 전환합니다. BTC 김프는 같은 시점의 Upbit BTC/KRW 현물, Binance BTC/USDT 현물, Coinbase USDT/USD 체결가와 화면에 표시한 USD/KRW를 사용합니다. 이 값들은 매수·매도 지시가 아니라 선물 판단의 배경 위험입니다.
      </CompactHelp>
    </PanelCard>
  );
}
