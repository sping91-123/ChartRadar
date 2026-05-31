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

        <div className="grid gap-0 border-y border-ui-line sm:grid-cols-4">
          <DataRow label="거래소" value={payload?.exchangeLabel ?? exchanges.find((item) => item.id === exchange)?.label ?? "-"} />
          <DataRow label="표시 종목" value={payload ? `${payload.summary.displayedMarkets}개` : "-"} />
          <DataRow label="상승/하락" value={payload ? `${payload.summary.gainers}/${payload.summary.losers}` : "-"} />
          <DataRow label="평균 등락" value={payload ? formatPercent(payload.summary.averageChangePercent) : "-"} />
        </div>

        <div className="flex flex-wrap gap-1.5 border-y border-ui-line py-1">
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
          <div className="flex min-h-44 items-center justify-center border-y border-ui-line text-sm font-semibold text-ui-muted">
            현물 시장을 확인하는 중입니다.
          </div>
        ) : error ? (
          <div className="flex min-h-44 flex-col items-center justify-center gap-3 border-y border-ui-line text-center">
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
          <div className="flex min-h-44 flex-col items-center justify-center gap-3 border-y border-ui-line text-center">
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
