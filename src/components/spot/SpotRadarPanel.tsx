"use client";
// 업비트/빗썸 KRW 현물 시장을 주문 기능 없이 관찰 후보 중심으로 보여줍니다.
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, LineChart, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { ActionButton, DataRow, PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";
import { CoinSignalConflictPanel, type CoinSignalConflictItem } from "@/components/coin/CoinSignalConflictPanel";
import { CoinSignalPressurePanel, type CoinSignalPressureItem } from "@/components/coin/CoinSignalPressurePanel";
import type { SpotChartRadarPayload, SpotChartSummary, SpotChartTone, SpotExchange, SpotRadarCategory, SpotRadarItem, SpotRadarPayload } from "@/lib/spotRadarTypes";

const exchanges: Array<{ id: SpotExchange; label: string }> = [
  { id: "upbit", label: "업비트" },
  { id: "bithumb", label: "빗썸" }
];

const categoryFilters: Array<{ id: "all" | SpotRadarCategory; label: string }> = [
  { id: "all", label: "전체" },
  { id: "volume", label: "거래대금" },
  { id: "gainer", label: "상승률" },
  { id: "pullback", label: "눌림" },
  { id: "overheat", label: "과열" },
  { id: "pressure", label: "하락 위험" },
  { id: "watch", label: "기다림" }
];

function formatKrw(value: number) {
  if (!Number.isFinite(value)) return "미확인";
  if (value >= 1_0000_0000_0000) return `${(value / 1_0000_0000_0000).toFixed(1)}조`;
  if (value >= 1_0000_0000) return `${(value / 1_0000_0000).toFixed(0)}억`;
  return value.toLocaleString("ko-KR");
}

function formatPrice(value: number) {
  if (!Number.isFinite(value)) return "미확인";
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: value >= 100 ? 0 : 2 })}원`;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "미확인";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatOptionalPercent(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "확인 중";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function formatRangePosition(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "범위 확인 중";
  return `범위 ${Math.round(value)}%`;
}

function categoryTone(category: SpotRadarCategory) {
  if (category === "overheat" || category === "pressure") return "risk" as const;
  if (category === "gainer" || category === "volume") return "long" as const;
  if (category === "pullback") return "watch" as const;
  return "info" as const;
}

const chartToneClass: Record<SpotChartTone, string> = {
  long: "text-ui-long",
  short: "text-ui-short",
  watch: "text-ui-watch",
  risk: "text-ui-risk",
  info: "text-ui-brand"
};

function chartStatusLabel(tone: SpotChartTone) {
  if (tone === "long") return "유지";
  if (tone === "short") return "압력";
  if (tone === "risk") return "주의";
  return "확인";
}

function changeClass(value: number) {
  if (value > 0) return "text-ui-long";
  if (value < 0) return "text-ui-short";
  return "text-ui-muted";
}

function describeSpotItem(item: SpotRadarItem | null) {
  if (!item) return "해당 후보 없음";
  return `${item.symbol} · ${displaySpotLabel(item.categoryLabel)}`;
}

function displaySpotLabel(value: string) {
  return value
    .replace(/관망/g, "기다림")
    .replace(/추적/g, "관심")
    .replace(/추격/g, "따라가기")
    .replace(/하락압력/g, "하락 위험")
    .replace(/하락 압력/g, "하락 위험");
}

function SpotMarketChecklist({ payload }: { payload: SpotRadarPayload }) {
  const riskItems = payload.items.filter((item) => item.category === "overheat" || item.category === "pressure");
  const avoidItem =
    riskItems.find((item) => item.category === "overheat") ??
    riskItems.find((item) => item.category === "pressure") ??
    null;
  const followItem =
    payload.items.find((item) => item.category === "pullback") ??
    payload.items.find((item) => item.category === "volume") ??
    payload.items.find((item) => item.category === "gainer") ??
    null;
  const marketTone = payload.summary.averageChangePercent > 0.3 ? "long" : payload.summary.averageChangePercent < -0.3 ? "short" : "watch";
  const riskTone = riskItems.length > 0 ? "risk" : "watch";

  const checks: Array<{ label: string; title: string; tone: "risk" | "watch" | "info" | "long" | "short" }> = [
    {
      label: "피할 후보",
      title: avoidItem ? describeSpotItem(avoidItem) : "강한 회피 후보 없음",
      tone: riskTone
    },
    {
      label: "관심 후보",
      title: followItem ? describeSpotItem(followItem) : "관심 후보 대기",
      tone: followItem?.category === "gainer" || followItem?.category === "volume" ? "long" : "watch"
    },
    {
      label: "시장 폭",
      title: `상승 ${payload.summary.gainers} / 하락 ${payload.summary.losers}`,
      tone: marketTone
    }
  ];

  return (
    <div className="grid gap-0 border-t border-ui-line md:grid-cols-3">
      {checks.map((check, index) => (
        <article
          key={check.label}
          className={`min-w-0 py-3 md:px-3 ${index > 0 ? "border-t border-ui-line md:border-t-0 md:border-l" : ""}`}
        >
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{check.label}</p>
              <p className="mt-1 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{check.title}</p>
            </div>
            <StatusPill tone={check.tone} className="shrink-0">
              {check.tone === "risk" ? "주의" : check.tone === "long" ? "관심" : check.tone === "short" ? "하락" : "확인"}
            </StatusPill>
          </div>
        </article>
      ))}
    </div>
  );
}

function buildSpotConflictItems(payload: SpotRadarPayload): CoinSignalConflictItem[] {
  const volumeLeader = payload.items[0] ?? null;
  const overheat = payload.items.find((item) => item.category === "overheat") ?? null;
  const pressure = payload.items.find((item) => item.category === "pressure") ?? null;
  const followCandidate =
    payload.items.find((item) => item.category === "pullback") ??
    payload.items.find((item) => item.category === "volume" && item.changePercent > 0) ??
    payload.items.find((item) => item.category === "gainer") ??
    null;
  const broadSkew = Math.abs(payload.summary.gainers - payload.summary.losers);

  return [
    {
      label: "급등 vs 따라가기",
      title: overheat ? `${overheat.symbol} · 과열 주의` : "과열 후보 약함",
      detail: overheat ? overheat.check : "상승률만으로 보지 않고 거래대금 유지와 첫 눌림 반응을 기다립니다.",
      tone: overheat ? "risk" : "info"
    },
    {
      label: "거래대금 vs 방향",
      title: volumeLeader ? `${volumeLeader.symbol} · ${formatKrw(volumeLeader.quoteVolume24h)}` : "거래대금 확인 중",
      detail: volumeLeader
        ? `거래대금 1위가 ${formatPercent(volumeLeader.changePercent)} 흐름입니다. 거래대금만 크고 방향이 약하면 기다림 후보로 둡니다.`
        : "거래대금 리더가 확인되면 방향과 함께 비교합니다.",
      tone: volumeLeader && volumeLeader.changePercent >= 2.5 ? "long" : volumeLeader && volumeLeader.changePercent <= -2.5 ? "short" : "watch"
    },
    {
      label: "하락 위험 vs 반등",
      title: pressure ? `${pressure.symbol} · 하락 위험` : "강한 하락 위험 후보 없음",
      detail: pressure ? pressure.check : "급락 후보가 약하면 눌림 대기 후보와 시장 폭을 우선 확인합니다.",
      tone: pressure ? "risk" : "info"
    },
    {
      label: "후보 vs 시장 폭",
      title: followCandidate ? `${followCandidate.symbol} · ${displaySpotLabel(followCandidate.categoryLabel)}` : "관심 후보 대기",
      detail: `상승 ${payload.summary.gainers} / 하락 ${payload.summary.losers}. 폭 차이 ${broadSkew}개로, 후보 하나보다 시장 폭을 함께 봅니다.`,
      tone: followCandidate ? "watch" : "info"
    }
  ];
}

function buildSpotPressureItems(payload: SpotRadarPayload): CoinSignalPressureItem[] {
  const counts: Record<SpotRadarCategory, number> = {
    volume: 0,
    gainer: 0,
    pullback: 0,
    overheat: 0,
    pressure: 0,
    watch: 0
  };

  payload.items.forEach((item) => {
    counts[item.category] += 1;
  });

  const maxCount = Math.max(1, ...Object.values(counts));

  return categoryFilters
    .filter((item): item is { id: SpotRadarCategory; label: string } => item.id !== "all")
    .map((item) => ({
      label: item.label,
      title: `${counts[item.id]}개 후보`,
      tone: categoryTone(item.id),
      percent: (counts[item.id] / maxCount) * 100,
      value: `${counts[item.id]}개`
    }));
}

function SpotSparkline({ item }: { item: SpotChartSummary }) {
  const values = item.sparkline.length > 1 ? item.sparkline : [50, 50];
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 100;
      const y = 34 - (Math.min(100, Math.max(0, value)) / 100) * 30;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg className={`h-10 w-full ${chartToneClass[item.tone]}`} viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SpotChartEvidencePanel({
  payload,
  loading,
  error
}: {
  payload: SpotChartRadarPayload | null;
  loading: boolean;
  error: string | null;
}) {
  return (
    <PanelCard variant="report" padding="md" className="space-y-4 border-y border-ui-line">
      <SectionHeader title="현물 차트" />

      {loading ? (
        <div className="flex min-h-24 items-center justify-center border-t border-ui-line text-sm font-semibold text-ui-muted">
          현물 차트를 확인하는 중입니다.
        </div>
      ) : error ? (
        <div className="flex min-h-24 items-center justify-center border-t border-ui-line text-sm font-semibold text-ui-muted">
          {error}
        </div>
      ) : payload && payload.items.length > 0 ? (
        <div className="grid gap-0 md:grid-cols-2">
          {payload.items.map((item, index) => (
            <article
              key={`${item.exchange}-${item.market}`}
              className={`min-w-0 py-3 md:px-3 ${index > 0 ? "border-t border-ui-line md:border-t-0" : ""} ${
                index % 2 === 1 ? "md:border-l md:border-ui-line" : ""
              } ${index > 1 ? "md:border-t md:border-ui-line" : ""}`}
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{item.symbol} · 1H</p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{item.structureLabel}</p>
                </div>
                <StatusPill tone={item.tone} icon={LineChart} className="shrink-0">
                  {chartStatusLabel(item.tone)}
                </StatusPill>
              </div>
              <div className="mt-3">
                <SpotSparkline item={item} />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] font-semibold text-ui-subtle">
                <span>{formatOptionalPercent(item.changePercent)}</span>
                <span className="text-center">{formatRangePosition(item.rangePositionPercent)}</span>
                <span className="text-right">거래 {item.volumeRatio === null ? "-" : `${item.volumeRatio.toFixed(1)}x`}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="flex min-h-24 items-center justify-center border-t border-ui-line text-sm font-semibold text-ui-muted">
          차트를 표시할 후보가 아직 없습니다.
        </div>
      )}
    </PanelCard>
  );
}

type SpotPriorityGroup = {
  label: string;
  title: string;
  tone: SpotChartTone;
  items: Array<{
    item: SpotRadarItem;
    chart: SpotChartSummary | null;
    score: number;
    reason: string;
    tone: SpotChartTone;
  }>;
};

function chartLookup(payload: SpotChartRadarPayload | null) {
  return new Map((payload?.items ?? []).map((item) => [item.market, item]));
}

function chartPriorityBoost(chart: SpotChartSummary | null) {
  if (!chart) return 0;
  const volumeBoost = chart.volumeRatio === null ? 0 : Math.min(chart.volumeRatio * 4, 14);
  const toneBoost = chart.tone === "risk" ? 22 : chart.tone === "long" ? 18 : chart.tone === "short" ? 14 : chart.tone === "watch" ? 8 : 4;
  return toneBoost + volumeBoost;
}

function priorityReason(item: SpotRadarItem, chart: SpotChartSummary | null) {
  const chartText = chart
    ? `${chart.structureLabel} · ${formatRangePosition(chart.rangePositionPercent)} · 거래 ${chart.volumeRatio === null ? "-" : `${chart.volumeRatio.toFixed(1)}x`}`
    : "차트 확인 중";
  return `${displaySpotLabel(item.categoryLabel)} · ${chartText}`;
}

function buildSpotPriorityGroups(payload: SpotRadarPayload, chartPayload: SpotChartRadarPayload | null): SpotPriorityGroup[] {
  const chartByMarket = chartLookup(chartPayload);
  const enriched = payload.items.map((item) => {
    const chart = chartByMarket.get(item.market) ?? null;
    const absChange = Math.abs(item.changePercent);
    const riskBase = item.category === "overheat" ? 44 : item.category === "pressure" ? 38 : 0;
    const followBase = item.category === "volume" ? 36 : item.category === "gainer" ? 30 : item.category === "pullback" ? 26 : 0;
    const chartBoost = chartPriorityBoost(chart);
    const rangeRisk = chart?.rangePositionPercent !== null && chart?.rangePositionPercent !== undefined && (chart.rangePositionPercent >= 82 || chart.rangePositionPercent <= 18) ? 8 : 0;
    const riskScore = riskBase + chartBoost + rangeRisk + absChange;
    const followScore = followBase + (chart?.tone === "long" ? 18 : chart?.tone === "watch" ? 8 : 0) + Math.max(item.changePercent, 0);
    const watchScore = (item.category === "watch" ? 28 : 8) + (chart?.tone === "watch" ? 14 : 0) + (chart ? 4 : 0);

    return {
      item,
      chart,
      riskScore,
      followScore,
      watchScore,
      reason: priorityReason(item, chart)
    };
  });

  const riskItems = enriched
    .filter(({ item, chart }) => item.category === "overheat" || item.category === "pressure" || chart?.tone === "risk" || chart?.tone === "short")
    .sort((left, right) => right.riskScore - left.riskScore)
    .slice(0, 3)
    .map(({ item, chart, riskScore, reason }) => ({ item, chart, score: riskScore, reason, tone: chart?.tone === "short" ? ("short" as const) : ("risk" as const) }));

  const followItems = enriched
    .filter(({ item, chart }) => item.category === "volume" || item.category === "gainer" || item.category === "pullback" || chart?.tone === "long")
    .sort((left, right) => right.followScore - left.followScore)
    .slice(0, 3)
    .map(({ item, chart, followScore, reason }) => ({ item, chart, score: followScore, reason, tone: chart?.tone === "long" ? ("long" as const) : ("watch" as const) }));

  const watchItems = enriched
    .filter(({ item, chart }) => item.category === "watch" || chart?.tone === "watch" || chart === null)
    .sort((left, right) => right.watchScore - left.watchScore)
    .slice(0, 3)
    .map(({ item, chart, watchScore, reason }) => ({ item, chart, score: watchScore, reason, tone: "watch" as const }));

  return [
    {
      label: "위험 먼저",
      title: "주의 후보",
      tone: "risk",
      items: riskItems
    },
    {
      label: "관심 먼저",
      title: "관심 후보",
      tone: "long",
      items: followItems
    },
    {
      label: "기다림",
      title: "기다림 후보",
      tone: "watch",
      items: watchItems
    }
  ];
}

function SpotPriorityPanel({ payload, chartPayload }: { payload: SpotRadarPayload; chartPayload: SpotChartRadarPayload | null }) {
  const groups = buildSpotPriorityGroups(payload, chartPayload);

  return (
    <PanelCard variant="report" padding="md" className="space-y-4 border-y border-ui-line">
      <SectionHeader title="현물 우선순위" />
      <div className="grid gap-0 lg:grid-cols-3">
        {groups.map((group, index) => (
          <article key={group.label} className={`min-w-0 py-3 lg:px-3 ${index > 0 ? "border-t border-ui-line lg:border-l lg:border-t-0" : ""}`}>
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{group.label}</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{group.title}</p>
              </div>
              <StatusPill tone={group.tone} className="shrink-0">
                {group.items.length}개
              </StatusPill>
            </div>
            <div className="mt-3 space-y-3">
              {group.items.length > 0 ? (
                group.items.map(({ item, reason, score, tone }) => (
                  <div key={`${group.label}-${item.market}`} className="border-t border-ui-line pt-3 first:border-t-0 first:pt-0">
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-ui-text">{item.symbol}</p>
                      <span className={`shrink-0 text-xs font-semibold ${chartToneClass[tone]}`}>{Math.round(score)}점</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-ui-muted [word-break:keep-all]">{reason}</p>
                  </div>
                ))
              ) : (
                <p className="border-t border-ui-line pt-3 text-xs leading-5 text-ui-muted">해당 묶음에 우선 표시할 후보가 아직 없습니다.</p>
              )}
            </div>
          </article>
        ))}
      </div>
    </PanelCard>
  );
}

function SpotRow({ item, chart }: { item: SpotRadarItem; chart: SpotChartSummary | null }) {
  const DirectionIcon = item.changePercent >= 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <article className="grid gap-3 border-t border-ui-line py-4 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_11rem] sm:items-start sm:gap-5">
      <div className="min-w-0">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate text-lg font-semibold tracking-tight text-ui-text">{item.symbol}</h3>
              <span className="truncate text-xs font-medium text-ui-muted">{item.koreanName}</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-ui-muted">{item.market}</p>
          </div>
          <StatusPill tone={categoryTone(item.category)}>{displaySpotLabel(item.categoryLabel)}</StatusPill>
        </div>

        {chart ? (
          <div className="mt-3 border-t border-ui-line pt-3">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">차트</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-ui-text [word-break:keep-all]">
                  {chart.structureLabel} · {formatRangePosition(chart.rangePositionPercent)} · 거래 {chart.volumeRatio === null ? "-" : `${chart.volumeRatio.toFixed(1)}x`}
                </p>
              </div>
              <StatusPill tone={chart.tone} icon={LineChart} className="shrink-0">
                {chartStatusLabel(chart.tone)}
              </StatusPill>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-3 text-right sm:grid-cols-1 sm:gap-1.5">
        <div>
          <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">현재가</p>
          <p className="text-sm font-semibold text-ui-text">{formatPrice(item.price)}</p>
        </div>
        <div>
          <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">등락률</p>
          <p className={`inline-flex items-center justify-end gap-1 text-sm font-semibold ${changeClass(item.changePercent)}`}>
            <DirectionIcon size={14} aria-hidden />
            {formatPercent(item.changePercent)}
          </p>
        </div>
        <div>
          <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">24H 거래대금</p>
          <p className="text-sm font-semibold text-ui-text">{formatKrw(item.quoteVolume24h)}</p>
        </div>
      </div>
    </article>
  );
}

export function SpotRadarPanel() {
  const [exchange, setExchange] = useState<SpotExchange>("upbit");
  const [filter, setFilter] = useState<"all" | SpotRadarCategory>("all");
  const [payload, setPayload] = useState<SpotRadarPayload | null>(null);
  const [chartPayload, setChartPayload] = useState<SpotChartRadarPayload | null>(null);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/spot-radar?exchange=${exchange}`, { cache: "no-store" });
        const nextPayload = (await response.json()) as SpotRadarPayload & { error?: string };
        if (!response.ok) throw new Error(nextPayload.error || "현물 데이터를 확인하지 못했습니다.");
        if (!cancelled) setPayload(nextPayload);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "현물 데이터를 확인하지 못했습니다.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [exchange]);

  useEffect(() => {
    let cancelled = false;

    async function loadChartEvidence() {
      if (!payload || payload.items.length === 0) {
        setChartPayload(null);
        setIsChartLoading(false);
        setChartError(null);
        return;
      }

      const markets = payload.items.slice(0, 6).map((item) => item.market);
      setIsChartLoading(true);
      setChartError(null);

      try {
        const params = new URLSearchParams({
          exchange,
          markets: markets.join(","),
          limit: "80"
        });
        const response = await fetch(`/api/spot-chart-radar?${params.toString()}`, { cache: "no-store" });
        const nextPayload = (await response.json()) as SpotChartRadarPayload & { error?: string };
        if (!response.ok) throw new Error(nextPayload.error || "현물 차트를 확인하지 못했습니다.");
        if (!cancelled) setChartPayload(nextPayload);
      } catch (loadError) {
        if (!cancelled) {
          setChartPayload(null);
          setChartError(loadError instanceof Error ? loadError.message : "현물 차트를 확인하지 못했습니다.");
        }
      } finally {
        if (!cancelled) setIsChartLoading(false);
      }
    }

    void loadChartEvidence();
    return () => {
      cancelled = true;
    };
  }, [exchange, payload]);

  const filteredItems = useMemo(() => {
    if (!payload) return [];
    if (filter === "all") return payload.items;
    return payload.items.filter((item) => item.category === filter);
  }, [filter, payload]);
  const categoryCounts = useMemo(() => {
    const counts: Record<"all" | SpotRadarCategory, number> = {
      all: payload?.items.length ?? 0,
      volume: 0,
      gainer: 0,
      pullback: 0,
      overheat: 0,
      pressure: 0,
      watch: 0
    };

    payload?.items.forEach((item) => {
      counts[item.category] += 1;
    });

    return counts;
  }, [payload]);
  const chartByMarketForRows = useMemo(() => chartLookup(chartPayload), [chartPayload]);

  return (
    <div className="flex flex-col gap-4">
      <PanelCard variant="report" padding="lg" className="space-y-5">
        <SectionHeader
          title="현물 레이더"
          action={
            <div className="inline-flex items-center gap-1 border-b border-ui-line pb-1">
              {exchanges.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setExchange(item.id)}
                  className={`min-h-9 px-2 text-xs font-semibold transition ${
                    exchange === item.id ? "text-ui-brand" : "text-ui-muted hover:text-ui-text"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          }
        />

        <div className="grid gap-0 border-t border-ui-line sm:grid-cols-4">
          <DataRow label="거래소" value={payload?.exchangeLabel ?? exchanges.find((item) => item.id === exchange)?.label ?? "-"} />
          <DataRow label="표시 종목" value={payload ? `${payload.summary.displayedMarkets}개` : "-"} />
          <DataRow label="상승/하락" value={payload ? `${payload.summary.gainers}/${payload.summary.losers}` : "-"} />
          <DataRow label="평균 등락" value={payload ? formatPercent(payload.summary.averageChangePercent) : "-"} />
        </div>

        {payload ? <SpotMarketChecklist payload={payload} /> : null}

        <div className="flex flex-wrap gap-1.5 border-t border-ui-line py-1">
          {categoryFilters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`min-h-8 border-b px-2 text-xs font-semibold transition ${
                filter === item.id ? "border-b border-ui-brand text-ui-text" : "text-ui-muted hover:text-ui-text"
              }`}
            >
              <span>{item.label}</span>
              <span className="ml-1 text-[10px] text-ui-subtle">{categoryCounts[item.id]}</span>
            </button>
          ))}
        </div>
      </PanelCard>

      {payload ? <SpotChartEvidencePanel payload={chartPayload} loading={isChartLoading} error={chartError} /> : null}

      {payload ? <SpotPriorityPanel payload={payload} chartPayload={chartPayload} /> : null}

      {payload ? (
        <CoinSignalPressurePanel
          title="현물 후보 압력 분해"
          items={buildSpotPressureItems(payload)}
        />
      ) : null}

      {payload ? <CoinSignalConflictPanel title="현물 신호 충돌" items={buildSpotConflictItems(payload)} /> : null}

      <PanelCard variant="report" padding="lg" className="space-y-4">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
          <SectionHeader title="현물 관찰 후보" />
          <ActionButton tone="ghost" className="whitespace-nowrap px-0" onClick={() => setExchange((current) => (current === "upbit" ? "bithumb" : "upbit"))}>
            <RefreshCw size={14} aria-hidden />
            거래소 전환
          </ActionButton>
        </div>

        {isLoading ? (
          <div className="flex min-h-44 items-center justify-center border-t border-ui-line text-sm font-semibold text-ui-muted">
            현물 시장을 확인하는 중입니다.
          </div>
        ) : error ? (
          <div className="flex min-h-44 flex-col items-center justify-center gap-3 border-t border-ui-line text-center">
            <AlertTriangle size={22} className="text-ui-risk" aria-hidden />
            <p className="text-sm font-semibold text-ui-text">{error}</p>
            <p className="text-xs text-ui-muted">거래소 public API 응답이 늦거나 제한될 수 있습니다.</p>
          </div>
        ) : filteredItems.length > 0 ? (
          <div>
            {filteredItems.map((item) => (
              <SpotRow key={`${item.exchange}-${item.market}`} item={item} chart={chartByMarketForRows.get(item.market) ?? null} />
            ))}
          </div>
        ) : (
          <div className="flex min-h-44 flex-col items-center justify-center gap-3 border-t border-ui-line text-center">
            <Search size={22} className="text-ui-muted" aria-hidden />
            <p className="text-sm font-semibold text-ui-text">해당 조건의 후보가 아직 없습니다.</p>
            <p className="text-xs text-ui-muted">필터를 전체로 바꾸거나 다른 거래소를 확인해 주세요.</p>
          </div>
        )}
      </PanelCard>

      <PanelCard variant="report" padding="md">
        <div className="flex items-start gap-3 text-sm text-ui-muted">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-ui-brand" aria-hidden />
          <p>
            public 시세만 사용합니다. 주문, 계정, API key, 보유 자산 조회는 포함하지 않습니다.
          </p>
        </div>
      </PanelCard>
    </div>
  );
}
