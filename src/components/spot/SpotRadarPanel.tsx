"use client";
// 업비트/빗썸 KRW 현물 시장을 주문 기능 없이 관찰 후보 중심으로 보여줍니다.
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, LineChart, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { ActionButton, DataRow, PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";
import type { SpotChartRadarPayload, SpotChartSummary, SpotChartTone, SpotExchange, SpotRadarCategory, SpotRadarItem, SpotRadarPayload } from "@/lib/spotRadarTypes";

type BuySpotCategory = Extract<SpotRadarCategory, "volume" | "gainer" | "pullback">;

const buyCategories = new Set<SpotRadarCategory>(["volume", "gainer", "pullback"]);

const exchanges: Array<{ id: SpotExchange; label: string; logo: string }> = [
  { id: "upbit", label: "업비트", logo: "/brand/upbit-logo.svg" },
  { id: "bithumb", label: "빗썸", logo: "/brand/bithumb-logo.svg" }
];

const categoryFilters: Array<{ id: "all" | BuySpotCategory; label: string }> = [
  { id: "all", label: "전체" },
  { id: "volume", label: "거래대금" },
  { id: "gainer", label: "상승률" },
  { id: "pullback", label: "눌림" }
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
  if (value === null || value === undefined || !Number.isFinite(value)) return "범위 확인 중";
  return `범위 ${Math.round(value)}%`;
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

function buyCandidateItems(payload: SpotRadarPayload) {
  return payload.items.filter((item) => buyCategories.has(item.category));
}

function safeBuyCandidateItems(payload: SpotRadarPayload | null) {
  return payload ? buyCandidateItems(payload) : [];
}

function displaySpotLabel(value: string) {
  return value
    .replace(/관망/g, "관망하기")
    .replace(/추적/g, "관심")
    .replace(/추격/g, "따라가기")
    .replace(/하락압력/g, "하락 위험")
    .replace(/하락 압력/g, "하락 위험");
}

function SpotMarketChecklist({ payload }: { payload: SpotRadarPayload }) {
  const buyItems = buyCandidateItems(payload);
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
      label: "살펴볼 후보",
      title: followItem ? describeSpotItem(followItem) : "후보 대기",
      tone: followItem?.category === "gainer" || followItem?.category === "volume" ? "long" : "watch"
    },
    {
      label: "거래 붙은 후보",
      title: volumeItem ? describeSpotItem(volumeItem) : "거래대금 후보 대기",
      tone: volumeItem ? "long" : "watch"
    },
    {
      label: "오르는 후보",
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
              {check.tone === "risk" ? "주의" : check.tone === "long" ? "관심" : check.tone === "short" ? "하락" : "확인"}
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

function normalizeSpotSearch(value: string) {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9-]/g, "").replace(/^KRW-?/, "");
  if (!cleaned || cleaned.length > 20) return null;
  return `KRW-${cleaned}`;
}

function personalSpotTitle(market: string | null) {
  return market ? market.replace("KRW-", "") : "코인 선택";
}

function chartPriorityBoost(chart: SpotChartSummary | null) {
  if (!chart) return 0;
  const volumeBoost = chart.volumeRatio === null ? 0 : Math.min(chart.volumeRatio * 4, 14);
  const toneBoost = chart.tone === "long" ? 18 : chart.tone === "watch" ? 8 : 4;
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
  const enriched = buyCandidateItems(payload).map((item) => {
    const chart = chartByMarket.get(item.market) ?? null;
    const followBase = item.category === "volume" ? 36 : item.category === "gainer" ? 30 : item.category === "pullback" ? 26 : 0;
    const chartBoost = chartPriorityBoost(chart);
    const followScore = followBase + (chart?.tone === "long" ? 18 : chart?.tone === "watch" ? 8 : 0) + Math.max(item.changePercent, 0);
    const watchScore = (item.category === "pullback" ? 32 : 12) + (chart?.tone === "watch" ? 14 : 0) + chartBoost;

    return {
      item,
      chart,
      followScore,
      watchScore,
      reason: priorityReason(item, chart)
    };
  });

  const followItems = enriched
    .filter(({ item, chart }) => item.category === "volume" || item.category === "gainer" || chart?.tone === "long")
    .sort((left, right) => right.followScore - left.followScore)
    .slice(0, 3)
    .map(({ item, chart, followScore, reason }) => ({ item, chart, score: followScore, reason, tone: chart?.tone === "long" ? ("long" as const) : ("watch" as const) }));

  const watchItems = enriched
    .filter(({ item, chart }) => item.category === "pullback" || chart?.tone === "watch" || chart === null)
    .sort((left, right) => right.watchScore - left.watchScore)
    .slice(0, 3)
    .map(({ item, chart, watchScore, reason }) => ({ item, chart, score: watchScore, reason, tone: "watch" as const }));

  return [
    {
      label: "살 만한 후보",
      title: "거래와 상승이 같이 보이는 후보",
      tone: "long",
      items: followItems
    },
    {
      label: "지켜볼 후보",
      title: "눌림 뒤 다시 볼 후보",
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
      <div className="grid gap-0 lg:grid-cols-2">
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

function PersonalSpotPanel({
  exchange,
  payload,
  selectedMarket,
  query,
  suggestions,
  chart,
  loading,
  error,
  onQueryChange,
  onSelectMarket,
  onSubmit
}: {
  exchange: SpotExchange;
  payload: SpotRadarPayload | null;
  selectedMarket: string | null;
  query: string;
  suggestions: SpotRadarItem[];
  chart: SpotChartSummary | null;
  loading: boolean;
  error: string | null;
  onQueryChange: (value: string) => void;
  onSelectMarket: (market: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const selectedItem = payload?.items.find((item) => item.market === selectedMarket) ?? null;

  return (
    <PanelCard variant="report" padding="md" className="space-y-4 border-y border-ui-line">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeader title="내 관심 알트" />
        <form onSubmit={onSubmit} className="flex w-full min-w-0 gap-2 sm:max-w-sm">
          <label className="sr-only" htmlFor="spot-watch-symbol">관심 코인 검색</label>
          <input
            id="spot-watch-symbol"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="예: SOL, XRP"
            className="min-h-9 min-w-0 flex-1 border border-ui-line bg-ui-canvas px-3 text-sm font-semibold text-ui-text outline-none transition placeholder:text-ui-subtle focus:border-ui-brand"
          />
          <ActionButton type="submit" tone="primary" className="min-h-9 shrink-0 px-3">
            <Search size={14} aria-hidden />
            보기
          </ActionButton>
        </form>
      </div>

      {suggestions.length > 0 ? (
        <div className="flex gap-1.5 overflow-x-auto border-t border-ui-line pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
      ) : null}

      <div className="border-t border-ui-line pt-3">
        {!selectedMarket ? (
          <div className="flex min-h-28 items-center justify-center text-sm font-semibold text-ui-muted">
            관심 코인을 검색하면 1H 현물 차트 상태를 따로 보여줍니다.
          </div>
        ) : loading ? (
          <div className="flex min-h-28 items-center justify-center text-sm font-semibold text-ui-muted">
            {personalSpotTitle(selectedMarket)} 차트를 확인하는 중입니다.
          </div>
        ) : error ? (
          <div className="flex min-h-28 flex-col items-center justify-center gap-2 text-center">
            <AlertTriangle size={20} className="text-ui-risk" aria-hidden />
            <p className="text-sm font-semibold text-ui-text">{error}</p>
          </div>
        ) : chart ? (
          <article className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-start">
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
              <div className="mt-3">
                <SpotSparkline item={chart} />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] font-semibold text-ui-subtle">
                <span>{formatOptionalPercent(chart.changePercent)}</span>
                <span className="text-center">{formatRangePosition(chart.rangePositionPercent)}</span>
                <span className="text-right">거래 {chart.volumeRatio === null ? "-" : `${chart.volumeRatio.toFixed(1)}x`}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-right sm:grid-cols-1 sm:gap-2">
              <DataRow label="지지" value={formatOptionalPrice(chart.supportPrice)} />
              <DataRow label="저항" value={formatOptionalPrice(chart.resistancePrice)} />
              <DataRow label="레이더 후보" value={selectedItem ? displaySpotLabel(selectedItem.categoryLabel) : "직접 선택"} />
            </div>
          </article>
        ) : (
          <div className="flex min-h-28 items-center justify-center text-sm font-semibold text-ui-muted">
            {personalSpotTitle(selectedMarket)} 차트를 아직 표시할 수 없습니다.
          </div>
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
  const [filter, setFilter] = useState<"all" | BuySpotCategory>("all");
  const [payload, setPayload] = useState<SpotRadarPayload | null>(null);
  const [chartPayload, setChartPayload] = useState<SpotChartRadarPayload | null>(null);
  const [watchQuery, setWatchQuery] = useState("");
  const [watchMarket, setWatchMarket] = useState<string | null>(null);
  const [watchChartPayload, setWatchChartPayload] = useState<SpotChartRadarPayload | null>(null);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [isWatchChartLoading, setIsWatchChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [watchChartError, setWatchChartError] = useState<string | null>(null);
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

      const markets = buyCandidateItems(payload).slice(0, 6).map((item) => item.market);
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

  const filteredItems = useMemo(() => {
    if (!payload) return [];
    const candidates = buyCandidateItems(payload);
    if (filter === "all") return candidates;
    return candidates.filter((item) => item.category === filter);
  }, [filter, payload]);
  const categoryCounts = useMemo(() => {
    const candidates = safeBuyCandidateItems(payload);
    const counts: Record<"all" | BuySpotCategory, number> = {
      all: candidates.length,
      volume: 0,
      gainer: 0,
      pullback: 0
    };

    candidates.forEach((item) => {
      counts[item.category as BuySpotCategory] += 1;
    });

    return counts;
  }, [payload]);
  const chartByMarketForRows = useMemo(() => chartLookup(chartPayload), [chartPayload]);
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

  function selectWatchMarket(market: string) {
    setWatchMarket(market);
    setWatchQuery(market.replace("KRW-", ""));
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
                  className={`inline-flex min-h-10 items-center gap-2 border px-2 text-xs font-semibold transition ${
                    exchange === item.id ? "border-ui-brand bg-ui-brand/15 text-ui-text" : "border-transparent text-ui-muted hover:border-ui-line hover:text-ui-text"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.logo} alt="" className="h-5 w-auto shrink-0 rounded-sm bg-white" loading="lazy" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          }
        />

        <div className="grid gap-0 border-t border-ui-line sm:grid-cols-4">
          <DataRow label="거래소" value={payload?.exchangeLabel ?? exchanges.find((item) => item.id === exchange)?.label ?? "-"} />
          <DataRow label="살펴볼 후보" value={payload ? `${buyCandidateItems(payload).length}개` : "-"} />
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

      <PersonalSpotPanel
        exchange={exchange}
        payload={payload}
        selectedMarket={watchMarket}
        query={watchQuery}
        suggestions={watchSuggestions}
        chart={watchChart}
        loading={isWatchChartLoading}
        error={watchChartError}
        onQueryChange={setWatchQuery}
        onSelectMarket={selectWatchMarket}
        onSubmit={submitWatchSearch}
      />

      {payload ? <SpotPriorityPanel payload={payload} chartPayload={chartPayload} /> : null}

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
            <p className="text-xs text-ui-muted">필터를 전체로 바꾸거나 관심 알트 검색을 사용해 주세요.</p>
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
