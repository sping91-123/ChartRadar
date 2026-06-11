"use client";
// 업비트/빗썸 KRW 현물 시장을 주문 기능 없이 관찰 후보 중심으로 보여줍니다.
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, HelpCircle, LineChart, Search, X } from "lucide-react";
import { ActionButton, DataRow, PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";
import type { SpotChartRadarPayload, SpotChartSummary, SpotChartTone, SpotExchange, SpotRadarCategory, SpotRadarItem, SpotRadarPayload } from "@/lib/spotRadarTypes";

type BuySpotCategory = Extract<SpotRadarCategory, "volume" | "gainer" | "pullback">;

const buyCategories = new Set<SpotRadarCategory>(["volume", "gainer", "pullback"]);

const exchanges: Array<{ id: SpotExchange; label: string; logo: string }> = [
  { id: "upbit", label: "업비트", logo: "/brand/upbit-app-icon.png" },
  { id: "bithumb", label: "빗썸", logo: "/brand/bithumb-app-icon.jpg" }
];

const categoryFilters: Array<{ id: "all" | BuySpotCategory; label: string }> = [
  { id: "all", label: "전체" },
  { id: "volume", label: "거래대금 관찰 후보" },
  { id: "gainer", label: "강한 관찰 후보" },
  { id: "pullback", label: "조건 대기 후보" }
];

const spotExchangeStorageKey = "chart-radar.spot.exchange";
const spotWatchMarketStorageKey = "chart-radar.spot.watch-market";

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

function formatOptionalPrice(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "확인 중";
  return formatPrice(value);
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
  if (value === null || value === undefined || !Number.isFinite(value)) return "가격 위치 확인 중";
  return `가격 위치 ${Math.round(value)}%`;
}

function formatVolumeRatio(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "거래대금 확인 중";
  return `거래대금 ${value.toFixed(1)}배`;
}

function buildSpotPricePlan(item: SpotRadarItem | null | undefined, chart: SpotChartSummary | null | undefined) {
  const current = item?.price ?? chart?.currentPrice ?? null;
  if (current === null || !Number.isFinite(current) || current <= 0) {
    return {
      firstPrice: null,
      secondPrice: null,
      invalidationPrice: null,
      resistancePrice: null,
      summaryLabel: "가격 확인 중",
      roomLabel: "저항 확인 중"
    };
  }

  const rawSupport = chart?.supportPrice ?? item?.lowPrice ?? null;
  const support = rawSupport !== null && Number.isFinite(rawSupport) && rawSupport > 0 ? Math.min(rawSupport, current * 0.998) : current * 0.975;
  const rawResistance = chart?.resistancePrice ?? item?.highPrice ?? null;
  const resistance =
    rawResistance !== null && Number.isFinite(rawResistance) && rawResistance > current ? rawResistance : current + Math.max(current - support, current * 0.012);
  const distance = Math.max(current - support, current * 0.008);
  const rangePosition = chart?.rangePositionPercent ?? (item?.rangePosition === null || item?.rangePosition === undefined ? null : item.rangePosition * 100);
  const firstWeight = item?.category === "pullback" || (rangePosition !== null && rangePosition <= 45) ? 0.45 : 0.28;
  const firstPrice = current - distance * firstWeight;
  const secondPrice = support;
  const invalidationPrice = support * 0.985;
  const firstGapPercent = ((current - firstPrice) / current) * 100;
  const resistanceRoomPercent = ((resistance - current) / current) * 100;
  const summaryLabel =
    current <= firstPrice * 1.006 || firstGapPercent <= 0.6
      ? "현재 확인가 구간"
      : `${firstGapPercent.toFixed(1)}% 내려오면 1차 확인가`;

  return {
    firstPrice,
    secondPrice,
    invalidationPrice,
    resistancePrice: resistance,
    summaryLabel,
    roomLabel: `저항까지 +${Math.max(0, resistanceRoomPercent).toFixed(1)}%`
  };
}

function chartCurrentPrice(item: SpotRadarItem | null | undefined, chart: SpotChartSummary | null | undefined) {
  return item?.price ?? chart?.currentPrice ?? null;
}

function SpotPlanGrid({
  item,
  chart,
  className
}: {
  item: SpotRadarItem | null | undefined;
  chart: SpotChartSummary | null | undefined;
  className?: string;
}) {
  const plan = buildSpotPricePlan(item, chart);

  return (
    <div className={className ?? ""}>
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2 text-[10px] font-semibold text-ui-muted">
        <span className="truncate text-ui-text">{plan.summaryLabel}</span>
        <span className="shrink-0 text-ui-subtle">{plan.roomLabel}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-ui-subtle">1차 확인가</p>
          <p className="mt-1 truncate text-xs font-semibold text-ui-text">{formatOptionalPrice(plan.firstPrice)}</p>
        </div>
        <div className="min-w-0 text-center">
          <p className="text-[10px] font-semibold text-ui-subtle">2차 확인가</p>
          <p className="mt-1 truncate text-xs font-semibold text-ui-text">{formatOptionalPrice(plan.secondPrice)}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[10px] font-semibold text-ui-subtle">무효화 기준</p>
          <p className="mt-1 truncate text-xs font-semibold text-ui-short">{formatOptionalPrice(plan.invalidationPrice)}</p>
        </div>
      </div>
    </div>
  );
}

function categoryTone(category: SpotRadarCategory) {
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
  if (tone === "long") return "관찰 후보";
  if (tone === "short") return "관찰 보류";
  if (tone === "risk") return "추격 금지";
  return "조건 대기";
}

function changeClass(value: number) {
  if (value > 0) return "text-ui-long";
  if (value < 0) return "text-ui-short";
  return "text-ui-muted";
}

function describeSpotItem(item: SpotRadarItem | null) {
  if (!item) return "관찰 후보 없음";
  return `${item.symbol} · ${displaySpotLabel(item.categoryLabel)}`;
}

function buyCandidateItems(payload: SpotRadarPayload) {
  return payload.items.filter((item) => buyCategories.has(item.category));
}

function rangePositionPercent(item: SpotRadarItem | null | undefined) {
  return item?.rangePosition === null || item?.rangePosition === undefined ? null : item.rangePosition * 100;
}

function candidateChangePercent(item: SpotRadarItem | null | undefined, chart: SpotChartSummary | null | undefined) {
  return chart?.changePercent ?? item?.changePercent ?? null;
}

function candidateRangePosition(item: SpotRadarItem | null | undefined, chart: SpotChartSummary | null | undefined) {
  return chart?.rangePositionPercent ?? rangePositionPercent(item);
}

function isReasonableBuyCandidate(item: SpotRadarItem | null | undefined, chart: SpotChartSummary | null | undefined = null) {
  if (!item || !buyCategories.has(item.category)) return false;
  if (item.category === "volume" && item.changePercent <= 0) return false;
  if (chart?.tone === "risk" || chart?.tone === "short") return false;

  const changePercent = candidateChangePercent(item, chart);
  const position = candidateRangePosition(item, chart);
  const tooExtended = changePercent !== null && Number.isFinite(changePercent) && changePercent >= 7.5;
  const nearTopExtended =
    changePercent !== null &&
    Number.isFinite(changePercent) &&
    changePercent >= 5 &&
    position !== null &&
    Number.isFinite(position) &&
    position >= 70;

  return !tooExtended && !nearTopExtended;
}

function safeBuyCandidateItems(payload: SpotRadarPayload | null) {
  return payload ? buyCandidateItems(payload).filter((item) => isReasonableBuyCandidate(item)) : [];
}

function filteredBuyCandidateItems(payload: SpotRadarPayload | null, filter: "all" | BuySpotCategory) {
  const candidates = safeBuyCandidateItems(payload);
  if (filter === "all") return candidates;
  return candidates.filter((item) => item.category === filter);
}

function spotMarketMood(payload: SpotRadarPayload | null) {
  if (!payload || payload.summary.displayedMarkets === 0) return "-";
  const { displayedMarkets, gainers, losers } = payload.summary;
  const difference = gainers - losers;
  const threshold = Math.max(5, Math.round(displayedMarkets * 0.12));

  if (difference >= threshold) return "상승 우세";
  if (difference <= -threshold) return "하락 우세";
  return "혼조";
}

function spotMarketMoodClass(payload: SpotRadarPayload | null) {
  const mood = spotMarketMood(payload);
  if (mood.startsWith("상승")) return "text-ui-long";
  if (mood.startsWith("하락")) return "text-ui-short";
  return "text-ui-text";
}

function displaySpotLabel(value: string) {
  return value
    .replace(/눌림 대기/g, "확인가 도달 전 대기")
    .replace(/눌림/g, "조건 대기")
    .replace(/관망/g, "관찰 보류")
    .replace(/추적/g, "관찰 후보")
    .replace(/추격/g, "추격 금지")
    .replace(/하락압력/g, "하락 위험")
    .replace(/하락 압력/g, "하락 위험");
}

function SpotMarketChecklist({ payload }: { payload: SpotRadarPayload }) {
  const buyItems = safeBuyCandidateItems(payload);
  const followItem =
    buyItems.find((item) => item.category === "pullback") ??
    buyItems.find((item) => item.category === "volume") ??
    buyItems.find((item) => item.category === "gainer") ??
    null;
  const volumeItem = buyItems.find((item) => item.category === "volume") ?? null;
  const gainerItem = buyItems.find((item) => item.category === "gainer") ?? null;
  const marketTone = payload.summary.averageChangePercent > 0.3 ? "long" : payload.summary.averageChangePercent < -0.3 ? "short" : "watch";

  const checks: Array<{ label: string; title: string; tone: "risk" | "watch" | "info" | "long" | "short" }> = [
    {
      label: "관찰 후보",
      title: followItem ? describeSpotItem(followItem) : "관찰 후보 대기",
      tone: followItem?.category === "gainer" || followItem?.category === "volume" ? "long" : "watch"
    },
    {
      label: "거래대금 관찰 후보",
      title: volumeItem ? describeSpotItem(volumeItem) : "거래대금 관찰 후보 대기",
      tone: volumeItem ? "long" : "watch"
    },
    {
      label: "강한 관찰 후보",
      title: gainerItem ? describeSpotItem(gainerItem) : `상승 ${payload.summary.gainers}개`,
      tone: gainerItem ? "long" : marketTone
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
              {check.tone === "risk" ? "추격 금지" : check.tone === "long" ? "관찰 후보" : check.tone === "short" ? "관찰 보류" : "조건 대기"}
            </StatusPill>
          </div>
        </article>
      ))}
    </div>
  );
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
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function CompactSpotState({
  icon,
  title,
  body,
  action
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-ui-sm bg-ui-inset/25 px-3 py-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {icon ? <span className="mt-0.5 shrink-0 text-ui-muted">{icon}</span> : null}
          <div className="min-w-0">
            <p className="text-sm font-medium leading-5 text-ui-text [word-break:keep-all]">{title}</p>
            {body ? <p className="mt-1 text-xs leading-5 text-ui-muted [word-break:keep-all]">{body}</p> : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

function SpotChartEvidencePanel({
  payload,
  loading,
  error,
  itemsByMarket
}: {
  payload: SpotChartRadarPayload | null;
  loading: boolean;
  error: string | null;
  itemsByMarket: Map<string, SpotRadarItem>;
}) {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const visibleItems = (payload?.items ?? []).filter((item) => isReasonableBuyCandidate(itemsByMarket.get(item.market) ?? null, item));

  return (
    <section className="space-y-4 border-t border-ui-line pt-4">
      <SectionHeader
        title="선택 후보 차트"
        action={
          <ActionButton tone="ghost" className="px-0" onClick={() => setIsHelpOpen(true)} aria-label="차트 기준 보기">
            <HelpCircle size={15} aria-hidden />
            기준
          </ActionButton>
        }
      />

      {isHelpOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm border border-ui-line bg-ui-panel p-4 shadow-ui-elevated">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-ui-text">차트 기준</p>
                <p className="mt-1 text-xs leading-5 text-ui-muted">짧은 현물 흐름을 빠르게 보기 위한 압축 표시입니다.</p>
              </div>
              <ActionButton tone="ghost" className="min-h-7 px-0" onClick={() => setIsHelpOpen(false)} aria-label="닫기">
                <X size={16} aria-hidden />
              </ActionButton>
            </div>
            <div className="mt-4 space-y-3 text-xs leading-5 text-ui-muted">
              <p>
                <span className="font-semibold text-ui-text">1H 차트</span>는 최근 1시간봉 흐름을 압축해서 보여줍니다.
              </p>
              <p>
                <span className="font-semibold text-ui-text">가격 위치</span>는 최근 80시간 저점 0%, 고점 100% 기준 현재 위치입니다.
              </p>
              <p>
                <span className="font-semibold text-ui-text">거래대금</span>은 최근 6시간 거래대금이 직전 평균보다 몇 배인지입니다.
              </p>
              <p>
                <span className="font-semibold text-ui-text">1차/2차 확인가</span>는 현재가와 가까운 지지 구간을 기준으로 다시 볼 가격대입니다.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <CompactSpotState title="차트 로딩 중" body="선택 후보의 1H 흐름을 불러옵니다." />
      ) : error ? (
        <CompactSpotState icon={<AlertTriangle size={15} aria-hidden />} title="차트 대기" body={error} />
      ) : visibleItems.length > 0 ? (
        <div className="grid gap-0 md:grid-cols-2">
          {visibleItems.map((item, index) => {
            const spotItem = itemsByMarket.get(item.market) ?? null;

            return (
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
                    <p className="mt-1 text-xs font-semibold text-ui-muted">현재가 {formatOptionalPrice(chartCurrentPrice(spotItem, item))}</p>
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
                  <span className="text-right">{formatVolumeRatio(item.volumeRatio)}</span>
                </div>
                <SpotPlanGrid item={spotItem} chart={item} className="mt-3 border-t border-ui-line pt-3" />
              </article>
            );
          })}
        </div>
      ) : (
        <CompactSpotState title="관찰 후보 차트 대기" body="시장 요약을 먼저 보고 전체 필터로 넓혀보세요." />
      )}
    </section>
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

function normalizeSpotSearch(value: string) {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9-]/g, "").replace(/^KRW-?/, "");
  if (!cleaned || cleaned.length > 20) return null;
  return `KRW-${cleaned}`;
}

function personalSpotTitle(market: string | null) {
  return market ? market.replace("KRW-", "") : "코인 선택";
}

function isSpotExchange(value: string | null): value is SpotExchange {
  return value === "upbit" || value === "bithumb";
}

function chartPriorityBoost(chart: SpotChartSummary | null) {
  if (!chart) return 0;
  const volumeBoost = chart.volumeRatio === null ? 0 : Math.min(chart.volumeRatio * 4, 14);
  const toneBoost = chart.tone === "long" ? 18 : chart.tone === "watch" ? 8 : 4;
  return toneBoost + volumeBoost;
}

function positiveMoveScore(changePercent: number) {
  if (!Number.isFinite(changePercent) || changePercent <= 0) return 0;
  return Math.min(changePercent, 6);
}

function priorityReason(item: SpotRadarItem, chart: SpotChartSummary | null) {
  const chartText = chart
    ? `${chart.structureLabel} · ${formatRangePosition(chart.rangePositionPercent)} · ${formatVolumeRatio(chart.volumeRatio)}`
    : "차트 확인 중";
  return `${displaySpotLabel(item.categoryLabel)} · ${chartText}`;
}

function buildSpotPriorityGroups(payload: SpotRadarPayload, chartPayload: SpotChartRadarPayload | null): SpotPriorityGroup[] {
  const chartByMarket = chartLookup(chartPayload);
  const enriched = safeBuyCandidateItems(payload)
    .map((item) => {
      const chart = chartByMarket.get(item.market) ?? null;
      const followBase = item.category === "volume" ? 36 : item.category === "gainer" ? 30 : item.category === "pullback" ? 26 : 0;
      const chartBoost = chartPriorityBoost(chart);
      const followScore = followBase + (chart?.tone === "long" ? 18 : chart?.tone === "watch" ? 8 : 0) + positiveMoveScore(item.changePercent);
      const watchScore = (item.category === "pullback" ? 32 : 12) + (chart?.tone === "watch" ? 14 : 0) + chartBoost;

      return {
        item,
        chart,
        followScore,
        watchScore,
        reason: priorityReason(item, chart)
      };
    })
    .filter(({ item, chart }) => isReasonableBuyCandidate(item, chart));

  const followItems = enriched
    .filter(({ item, chart }) => item.category === "volume" || item.category === "gainer" || chart?.tone === "long")
    .sort((left, right) => right.followScore - left.followScore)
    .slice(0, 3)
    .map(({ item, chart, followScore, reason }) => ({ item, chart, score: followScore, reason, tone: chart?.tone === "long" ? ("long" as const) : ("watch" as const) }));
  const followMarkets = new Set(followItems.map(({ item }) => item.market));

  const watchItems = enriched
    .filter(({ item, chart }) => !followMarkets.has(item.market) && (item.category === "pullback" || chart?.tone === "watch" || chart === null))
    .sort((left, right) => right.watchScore - left.watchScore)
    .slice(0, 3)
    .map(({ item, chart, watchScore, reason }) => ({ item, chart, score: watchScore, reason, tone: "watch" as const }));

  return [
    {
      label: "오늘 관찰 후보",
      title: "거래대금과 1H 구조를 같이 볼 관찰 후보",
      tone: "long",
      items: followItems
    },
    {
      label: "조건 대기 후보",
      title: "확인가 도달 전 대기",
      tone: "watch",
      items: watchItems
    }
  ];
}

function SpotPriorityPanel({
  payload,
  chartPayload,
  loading,
  error,
  action
}: {
  payload: SpotRadarPayload | null;
  chartPayload: SpotChartRadarPayload | null;
  loading: boolean;
  error: string | null;
  action?: ReactNode;
}) {
  const groups = payload ? buildSpotPriorityGroups(payload, chartPayload) : [];
  const invalidationItems = groups.flatMap((group) => group.items).slice(0, 3);

  return (
    <PanelCard variant="report" padding="md" className="space-y-4 rounded-ui-lg bg-ui-panel">
      <SectionHeader title="오늘 관찰 후보" action={action} />

      {loading ? (
        <CompactSpotState title="관찰 후보 로딩 중" body="거래대금과 1H 구조를 함께 정리합니다." />
      ) : error ? (
        <CompactSpotState icon={<AlertTriangle size={15} aria-hidden />} title={error} body="거래소 public API 응답이 늦거나 제한될 수 있습니다." />
      ) : (
        <>
          <div className="grid gap-0 lg:grid-cols-2">
            {groups.map((group, index) => (
              <article key={group.label} className="min-w-0 border-t border-ui-line/70 py-3 first:border-t-0 lg:border-l lg:border-t-0 lg:px-4 lg:first:border-l-0">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{group.label}</p>
                    <p className="mt-1 text-[15px] font-semibold leading-6 text-ui-text [word-break:keep-all]">{group.title}</p>
                  </div>
                  <StatusPill tone={group.tone} className="shrink-0">
                    {group.items.length}개
                  </StatusPill>
                </div>
                <div className="mt-3 space-y-3">
                  {group.items.length > 0 ? (
                    group.items.map(({ item, chart, reason, score, tone }) => {
                      const plan = buildSpotPricePlan(item, chart);
                      return (
                        <div key={`${group.label}-${item.market}`} className="border-t border-ui-line pt-3 first:border-t-0 first:pt-0">
                          <div className="flex min-w-0 items-center justify-between gap-3">
                            <p className="truncate text-base font-semibold text-ui-text">{item.symbol}</p>
                            <span className={`shrink-0 text-sm font-semibold ${chartToneClass[tone]}`}>{Math.round(score)}점</span>
                          </div>
                          <p className="mt-1 text-sm leading-6 text-ui-muted [overflow-wrap:anywhere] [word-break:keep-all]">{reason}</p>
                          <p className="mt-1 text-sm leading-6 text-ui-muted [overflow-wrap:anywhere] [word-break:keep-all]">다시 볼 기준: {plan.summaryLabel}</p>
                          <p className="mt-1 text-sm leading-6 text-ui-muted [overflow-wrap:anywhere] [word-break:keep-all]">확인 필요: {item.check}</p>
                        </div>
                      );
                    })
                  ) : (
                    <p className="border-t border-ui-line pt-3 text-sm leading-6 text-ui-muted">관찰 후보 대기 중입니다.</p>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="border-t border-ui-line pt-3">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">무효화/리스크 기준</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">아래 가격과 리스크 조건이 흔들리면 관찰 강도를 낮춥니다.</p>
              </div>
              <StatusPill tone="risk" className="shrink-0">
                기준
              </StatusPill>
            </div>
            <div className="mt-3 grid gap-0 md:grid-cols-3">
              {invalidationItems.length > 0 ? (
                invalidationItems.map(({ item, chart }, index) => {
                  const plan = buildSpotPricePlan(item, chart);
                  return (
                    <article key={`risk-${item.market}`} className="min-w-0 border-t border-ui-line/70 py-3 first:border-t-0 md:border-l md:border-t-0 md:px-3 md:first:border-l-0">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-ui-text">{item.symbol}</p>
                          <p className="mt-1 text-xs font-semibold text-ui-short">무효화 {formatOptionalPrice(plan.invalidationPrice)}</p>
                        </div>
                        <StatusPill tone="watch" className="shrink-0">
                          조건 대기
                        </StatusPill>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-ui-muted [overflow-wrap:anywhere] [word-break:keep-all]">{item.risk}</p>
                    </article>
                  );
                })
              ) : (
                <p className="border-t border-ui-line pt-3 text-sm leading-6 text-ui-muted">무효화 요약은 관찰 후보가 잡히면 표시합니다.</p>
              )}
            </div>
          </div>
        </>
      )}
    </PanelCard>
  );
}

function SpotExchangeToggle({ exchange, onSelectExchange }: { exchange: SpotExchange; onSelectExchange: (exchange: SpotExchange) => void }) {
  return (
    <div className="inline-flex items-center gap-1">
      {exchanges.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelectExchange(item.id)}
          className={`inline-flex min-h-10 items-center gap-2 border px-2 text-xs font-semibold transition ${
            exchange === item.id ? "border-white bg-ui-brand/15 text-ui-text" : "border-transparent text-ui-muted hover:border-ui-line hover:text-ui-text"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.logo} alt="" className="h-6 w-6 shrink-0 rounded-[0.45rem] bg-white object-cover" loading="lazy" />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

function PersonalSpotPanel({
  exchange,
  payload,
  selectedMarket,
  query,
  suggestions,
  chart,
  loading,
  error,
  isPickerOpen,
  onQueryChange,
  onSelectMarket,
  onSubmit,
  onOpenPicker,
  onClosePicker
}: {
  exchange: SpotExchange;
  payload: SpotRadarPayload | null;
  selectedMarket: string | null;
  query: string;
  suggestions: SpotRadarItem[];
  chart: SpotChartSummary | null;
  loading: boolean;
  error: string | null;
  isPickerOpen: boolean;
  onQueryChange: (value: string) => void;
  onSelectMarket: (market: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onOpenPicker: () => void;
  onClosePicker: () => void;
}) {
  const selectedItem = payload?.items.find((item) => item.market === selectedMarket) ?? null;

  return (
    <PanelCard variant="report" padding="md" className="space-y-2 rounded-ui-lg bg-ui-panel">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <SectionHeader title="내 관심 알트" className="min-w-0 flex-1" />
        <ActionButton tone={selectedMarket ? "ghost" : "primary"} className={`shrink-0 ${selectedMarket ? "min-h-8 px-0" : "min-h-8 px-2"}`} onClick={onOpenPicker}>
          <Search size={14} aria-hidden />
          {selectedMarket ? "변경" : "관심 알트 등록"}
        </ActionButton>
      </div>

      {isPickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md border border-ui-line bg-ui-panel p-4 shadow-ui-elevated">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-ui-text">관심 알트 등록</p>
                <p className="mt-1 text-xs leading-5 text-ui-muted">티커를 검색해서 계속 볼 코인 하나를 고릅니다.</p>
              </div>
              <ActionButton tone="ghost" className="min-h-7 px-0" onClick={onClosePicker} aria-label="닫기">
                <X size={16} aria-hidden />
              </ActionButton>
            </div>

            <form onSubmit={onSubmit} className="mt-4 flex w-full min-w-0 gap-2">
              <label className="sr-only" htmlFor="spot-watch-symbol">관심 코인 검색</label>
              <input
                id="spot-watch-symbol"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="예: SOL, XRP"
                autoFocus
                className="min-h-10 min-w-0 flex-1 border border-ui-line bg-ui-canvas px-3 text-sm font-semibold text-ui-text outline-none transition placeholder:text-ui-subtle focus:border-ui-brand"
              />
              <ActionButton type="submit" tone="primary" className="min-h-10 shrink-0 px-3">
                보기
              </ActionButton>
            </form>

            {suggestions.length > 0 ? (
              <div className="mt-3 flex gap-1.5 overflow-x-auto border-t border-ui-line pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {suggestions.map((item) => (
                  <button
                    key={`${item.exchange}-${item.market}`}
                    type="button"
                    onClick={() => onSelectMarket(item.market)}
                    className={`min-h-8 shrink-0 border px-2 text-xs font-semibold transition ${
                      selectedMarket === item.market ? "border-ui-brand bg-ui-brand/15 text-ui-text" : "border-ui-line text-ui-muted hover:text-ui-text"
                    }`}
                  >
                    {item.symbol}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-3 border-t border-ui-line pt-3 text-xs leading-5 text-ui-muted">티커를 입력하면 후보가 표시됩니다.</p>
            )}
          </div>
        </div>
      ) : null}

      <div className="border-t border-ui-line pt-2">
        {!selectedMarket ? (
          <CompactSpotState
            title="관심 알트 조건 대기"
            body="계속 볼 코인 하나를 등록하면 관찰 후보 여부를 따로 봅니다."
            action={
              <ActionButton tone="primary" className="min-h-8 px-2 text-xs" onClick={onOpenPicker}>
                <Search size={14} aria-hidden />
                등록
              </ActionButton>
            }
          />
        ) : loading ? (
          <CompactSpotState title={`${personalSpotTitle(selectedMarket)} 차트 로딩`} body="관심 알트의 1H 흐름을 불러옵니다." />
        ) : error ? (
          <CompactSpotState icon={<AlertTriangle size={15} aria-hidden />} title="관심 알트 조건 대기" body={error} />
        ) : chart ? (
          <article className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-start">
            <div className="min-w-0">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">
                    {exchange === "upbit" ? "업비트" : "빗썸"} · {chart.symbol} · 1H
                  </p>
                  <p className="mt-1 text-base font-semibold leading-5 text-ui-text [word-break:keep-all]">{chart.structureLabel}</p>
                </div>
                <StatusPill tone={chart.tone} icon={LineChart} className="shrink-0">
                  {chartStatusLabel(chart.tone)}
                </StatusPill>
              </div>
              <div className="mt-2">
                <SpotSparkline item={chart} />
              </div>
              <div className="mt-1.5 grid grid-cols-3 gap-2 text-[10px] font-semibold text-ui-subtle">
                <span>{formatOptionalPercent(chart.changePercent)}</span>
                <span className="text-center">{formatRangePosition(chart.rangePositionPercent)}</span>
                <span className="text-right">{formatVolumeRatio(chart.volumeRatio)}</span>
              </div>
              <SpotPlanGrid item={selectedItem} chart={chart} className="mt-2 border-t border-ui-line pt-2" />
            </div>
            <div className="grid grid-cols-2 gap-3 text-right sm:grid-cols-1 sm:gap-2">
              <DataRow label="현재가" value={formatOptionalPrice(chartCurrentPrice(selectedItem, chart))} />
              <DataRow label="저항" value={formatOptionalPrice(chart.resistancePrice)} />
              <DataRow label="관찰 판단" value={selectedItem ? displaySpotLabel(selectedItem.categoryLabel) : "직접 선택"} />
            </div>
          </article>
        ) : (
          <CompactSpotState title="관찰 판단 대기" body={`${personalSpotTitle(selectedMarket)} 흐름은 아직 표시할 수 없습니다.`} />
        )}
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
                <p className="mt-1 text-xs font-semibold leading-5 text-ui-text [overflow-wrap:anywhere] [word-break:keep-all]">
                  {chart.structureLabel} · {formatRangePosition(chart.rangePositionPercent)} · {formatVolumeRatio(chart.volumeRatio)}
                </p>
              </div>
              <StatusPill tone={chart.tone} icon={LineChart} className="shrink-0">
                {chartStatusLabel(chart.tone)}
              </StatusPill>
            </div>
            <SpotPlanGrid item={item} chart={chart} className="mt-3" />
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
  const [filter, setFilter] = useState<"all" | BuySpotCategory>("all");
  const [payload, setPayload] = useState<SpotRadarPayload | null>(null);
  const [chartPayload, setChartPayload] = useState<SpotChartRadarPayload | null>(null);
  const [watchQuery, setWatchQuery] = useState("");
  const [watchMarket, setWatchMarket] = useState<string | null>(null);
  const [watchChartPayload, setWatchChartPayload] = useState<SpotChartRadarPayload | null>(null);
  const [isWatchPickerOpen, setIsWatchPickerOpen] = useState(false);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [isWatchChartLoading, setIsWatchChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [watchChartError, setWatchChartError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const storedExchange = window.localStorage.getItem(spotExchangeStorageKey);
      if (isSpotExchange(storedExchange)) setExchange(storedExchange);

      const storedMarket = normalizeSpotSearch(window.localStorage.getItem(spotWatchMarketStorageKey) ?? "");
      if (storedMarket) {
        setWatchMarket(storedMarket);
        setWatchQuery(storedMarket.replace("KRW-", ""));
      }
    } catch {
      // localStorage가 막힌 환경에서는 기본값으로 동작합니다.
    }
  }, []);

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

      const markets = filteredBuyCandidateItems(payload, filter)
        .slice(0, 6)
        .map((item) => item.market);
      if (markets.length === 0) {
        setChartPayload(null);
        setIsChartLoading(false);
        setChartError(null);
        return;
      }

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
  }, [exchange, filter, payload]);

  useEffect(() => {
    let cancelled = false;

    async function loadWatchChart() {
      if (!watchMarket) {
        setWatchChartPayload(null);
        setIsWatchChartLoading(false);
        setWatchChartError(null);
        return;
      }

      setIsWatchChartLoading(true);
      setWatchChartError(null);

      try {
        const params = new URLSearchParams({
          exchange,
          markets: watchMarket,
          limit: "100"
        });
        const response = await fetch(`/api/spot-chart-radar?${params.toString()}`, { cache: "no-store" });
        const nextPayload = (await response.json()) as SpotChartRadarPayload & { error?: string };
        if (!response.ok) throw new Error(nextPayload.error || "관심 코인 차트를 확인하지 못했습니다.");
        if (!cancelled) {
          setWatchChartPayload(nextPayload);
          setWatchChartError(nextPayload.items.length > 0 ? null : `${personalSpotTitle(watchMarket)} 차트를 찾지 못했습니다.`);
        }
      } catch (loadError) {
        if (!cancelled) {
          setWatchChartPayload(null);
          setWatchChartError(loadError instanceof Error ? loadError.message : "관심 코인 차트를 확인하지 못했습니다.");
        }
      } finally {
        if (!cancelled) setIsWatchChartLoading(false);
      }
    }

    void loadWatchChart();
    return () => {
      cancelled = true;
    };
  }, [exchange, watchMarket]);

  const chartByMarketForRows = useMemo(() => chartLookup(chartPayload), [chartPayload]);
  const visibleCandidateItems = useMemo(() => {
    return safeBuyCandidateItems(payload).filter((item) => isReasonableBuyCandidate(item, chartByMarketForRows.get(item.market) ?? null));
  }, [chartByMarketForRows, payload]);
  const visibleFilteredItems = useMemo(() => {
    if (filter === "all") return visibleCandidateItems;
    return visibleCandidateItems.filter((item) => item.category === filter);
  }, [filter, visibleCandidateItems]);
  const categoryCounts = useMemo(() => {
    const counts: Record<"all" | BuySpotCategory, number> = {
      all: visibleCandidateItems.length,
      volume: 0,
      gainer: 0,
      pullback: 0
    };

    visibleCandidateItems.forEach((item) => {
      counts[item.category as BuySpotCategory] += 1;
    });

    return counts;
  }, [visibleCandidateItems]);
  const spotItemsByMarket = useMemo(() => new Map((payload?.items ?? []).map((item) => [item.market, item])), [payload]);
  const watchSuggestions = useMemo(() => {
    if (!payload) return [];
    const normalizedQuery = watchQuery.trim().toUpperCase().replace(/^KRW-?/, "");
    const source = normalizedQuery
      ? payload.items.filter(
          (item) =>
            item.symbol.includes(normalizedQuery) ||
            item.koreanName.includes(watchQuery.trim()) ||
            item.englishName.toUpperCase().includes(normalizedQuery)
        )
      : payload.items;
    return source.slice(0, 8);
  }, [payload, watchQuery]);
  const watchChart = watchChartPayload?.items[0] ?? null;

  function selectExchange(nextExchange: SpotExchange) {
    setExchange(nextExchange);
    try {
      window.localStorage.setItem(spotExchangeStorageKey, nextExchange);
    } catch {
      // 저장이 막힌 환경에서는 현재 세션에서만 유지합니다.
    }
  }

  function openWatchPicker() {
    setWatchQuery(watchMarket ? watchMarket.replace("KRW-", "") : "");
    setIsWatchPickerOpen(true);
  }

  function closeWatchPicker() {
    setIsWatchPickerOpen(false);
  }

  function selectWatchMarket(market: string) {
    setWatchMarket(market);
    setWatchQuery(market.replace("KRW-", ""));
    setIsWatchPickerOpen(false);
    try {
      window.localStorage.setItem(spotWatchMarketStorageKey, market);
    } catch {
      // 저장이 막힌 환경에서는 현재 세션에서만 유지합니다.
    }
  }

  function submitWatchSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const market = normalizeSpotSearch(watchQuery);
    if (!market) {
      setWatchChartPayload(null);
      setWatchChartError("코인 티커를 입력해 주세요.");
      return;
    }
    selectWatchMarket(market);
  }

  const personalSpotPanel = (
    <PersonalSpotPanel
      exchange={exchange}
      payload={payload}
      selectedMarket={watchMarket}
      query={watchQuery}
      suggestions={watchSuggestions}
      chart={watchChart}
      loading={isWatchChartLoading}
      error={watchChartError}
      isPickerOpen={isWatchPickerOpen}
      onQueryChange={setWatchQuery}
      onSelectMarket={selectWatchMarket}
      onSubmit={submitWatchSearch}
      onOpenPicker={openWatchPicker}
      onClosePicker={closeWatchPicker}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {watchMarket ? personalSpotPanel : null}

      <SpotPriorityPanel
        payload={payload}
        chartPayload={chartPayload}
        loading={isLoading}
        error={error}
        action={<SpotExchangeToggle exchange={exchange} onSelectExchange={selectExchange} />}
      />

      <PanelCard variant="report" padding="lg" className="space-y-2">
        <SectionHeader title="시장 요약" />

        <div className="grid gap-0 sm:grid-cols-2">
          <DataRow label="관찰 후보" value={payload ? `${visibleCandidateItems.length}개` : "-"} className="py-1" />
          <DataRow label="오늘 분위기" value={<span className={spotMarketMoodClass(payload)}>{spotMarketMood(payload)}</span>} className="py-1" />
        </div>

        {payload ? <SpotMarketChecklist payload={payload} /> : null}

        <div className="flex flex-wrap gap-1.5 border-t border-ui-line py-1">
          {categoryFilters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`min-h-8 border-b px-2 text-xs font-semibold transition ${
                filter === item.id ? "rounded-ui-sm bg-ui-active text-ui-text" : "text-ui-muted hover:bg-ui-inset/60 hover:text-ui-text"
              }`}
            >
              <span>{item.label}</span>
              <span className="ml-1 text-[10px] text-ui-subtle">{categoryCounts[item.id]}</span>
            </button>
          ))}
        </div>
      </PanelCard>

      <PanelCard variant="report" padding="lg" className="space-y-4">
        <SectionHeader title="세부 관찰 후보와 차트 근거" />

        {payload ? <SpotChartEvidencePanel payload={chartPayload} loading={isChartLoading} error={chartError} itemsByMarket={spotItemsByMarket} /> : null}

        {isLoading ? (
          <CompactSpotState title="현물 시장 로딩" body="관찰 후보와 차트 근거를 함께 정리합니다." />
        ) : error ? (
          <CompactSpotState icon={<AlertTriangle size={15} aria-hidden />} title={error} body="거래소 public API 응답이 늦거나 제한될 수 있습니다." />
        ) : visibleFilteredItems.length > 0 ? (
          <div>
            {visibleFilteredItems.map((item) => (
              <SpotRow key={`${item.exchange}-${item.market}`} item={item} chart={chartByMarketForRows.get(item.market) ?? null} />
            ))}
          </div>
        ) : (
          <CompactSpotState
            icon={<Search size={15} aria-hidden />}
            title="관찰 후보 없음"
            body="전체 필터로 넓히거나 관심 알트를 등록해 따로 보세요."
          />
        )}
      </PanelCard>

      {watchMarket ? null : personalSpotPanel}
    </div>
  );
}
