"use client";
// 업비트/빗썸 KRW 현물 시장을 주문 기능 없이 관찰 후보 중심으로 보여줍니다.
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { ActionButton, DataRow, PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";
import type { SpotExchange, SpotRadarCategory, SpotRadarItem, SpotRadarPayload } from "@/lib/spotRadarTypes";

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
  { id: "pressure", label: "하락압력" },
  { id: "watch", label: "관망" }
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

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function categoryTone(category: SpotRadarCategory) {
  if (category === "overheat" || category === "pressure") return "risk" as const;
  if (category === "gainer" || category === "volume") return "long" as const;
  if (category === "pullback") return "watch" as const;
  return "info" as const;
}

function changeClass(value: number) {
  if (value > 0) return "text-ui-long";
  if (value < 0) return "text-ui-short";
  return "text-ui-muted";
}

function describeSpotItem(item: SpotRadarItem | null) {
  if (!item) return "해당 후보 없음";
  return `${item.symbol} · ${item.categoryLabel}`;
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

  const checks: Array<{ label: string; title: string; detail: string; tone: "risk" | "watch" | "info" | "long" | "short" }> = [
    {
      label: "피할 후보",
      title: avoidItem ? describeSpotItem(avoidItem) : "강한 회피 후보 없음",
      detail: avoidItem ? `${avoidItem.risk} ${avoidItem.check}` : "과열·하락압력 후보가 약하면 거래대금과 눌림 확인으로 넘어갑니다.",
      tone: riskTone
    },
    {
      label: "추적 후보",
      title: followItem ? describeSpotItem(followItem) : "추적 후보 대기",
      detail: followItem ? `${followItem.check}` : "거래대금이 붙거나 눌림 후 지지 반응이 보일 때 후보로 올립니다.",
      tone: followItem?.category === "gainer" || followItem?.category === "volume" ? "long" : "watch"
    },
    {
      label: "시장 폭",
      title: `상승 ${payload.summary.gainers} / 하락 ${payload.summary.losers}`,
      detail: `평균 등락 ${formatPercent(payload.summary.averageChangePercent)} · 거래대금 1위 ${payload.summary.leaderSymbol}.`,
      tone: marketTone
    },
    {
      label: "데이터 상태",
      title: `${formatTime(new Date(payload.cachedAt).toISOString())} 갱신`,
      detail: `${payload.exchangeLabel} public 시세 기준입니다. ${payload.cached ? "최근 응답 캐시를 사용 중입니다." : "방금 새로 확인한 응답입니다."}`,
      tone: "info"
    }
  ];

  return (
    <div className="grid gap-0 border-t border-ui-line md:grid-cols-2">
      {checks.map((check, index) => (
        <article
          key={check.label}
          className={`min-w-0 py-3 md:px-3 ${index > 0 ? "border-t border-ui-line md:border-t-0" : ""} ${
            index % 2 === 1 ? "md:border-l md:border-ui-line" : ""
          } ${index > 1 ? "md:border-t md:border-ui-line" : ""}`}
        >
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{check.label}</p>
              <p className="mt-1 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{check.title}</p>
            </div>
            <StatusPill tone={check.tone} className="shrink-0">
              {check.tone === "risk" ? "주의" : check.tone === "long" ? "추적" : check.tone === "short" ? "압력" : "확인"}
            </StatusPill>
          </div>
          <p className="mt-2 text-xs leading-5 text-ui-muted [word-break:keep-all]">{check.detail}</p>
        </article>
      ))}
    </div>
  );
}

function SpotRow({ item }: { item: SpotRadarItem }) {
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
            <p className="mt-1 text-xs leading-5 text-ui-muted">{item.market} · {formatTime(item.updatedAt)} 갱신</p>
          </div>
          <StatusPill tone={categoryTone(item.category)}>{item.categoryLabel}</StatusPill>
        </div>

        <div className="mt-3 grid gap-2 text-sm text-ui-muted sm:grid-cols-2">
          <p>
            <span className="font-semibold text-ui-text">리스크</span> {item.risk}
          </p>
          <p>
            <span className="font-semibold text-ui-text">확인</span> {item.check}
          </p>
        </div>
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

  const filteredItems = useMemo(() => {
    if (!payload) return [];
    if (filter === "all") return payload.items;
    return payload.items.filter((item) => item.category === filter);
  }, [filter, payload]);

  return (
    <div className="flex flex-col gap-4">
      <PanelCard variant="report" padding="lg" className="space-y-5">
        <SectionHeader
          eyebrow="Coin Spot"
          title="현물 레이더"
          description="업비트와 빗썸 KRW 시장에서 거래대금, 등락률, 과열·눌림 후보를 읽기 전용으로 정리합니다."
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
              {item.label}
            </button>
          ))}
        </div>
      </PanelCard>

      <PanelCard variant="report" padding="lg" className="space-y-4">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
          <SectionHeader eyebrow="Watchlist Candidates" title="현물 관찰 후보" description="표시는 판단 보조용입니다. 매수 추천이나 진입 지시가 아닙니다." />
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
              <SpotRow key={`${item.exchange}-${item.market}`} item={item} />
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
            현물 레이더는 public 시세만 사용합니다. 주문, 계정 연동, API key, 보유 자산 조회는 포함하지 않으며
            관심 후보, 과열 주의, 눌림 대기, 확인 조건 중심으로 표시합니다.
          </p>
        </div>
      </PanelCard>
    </div>
  );
}
