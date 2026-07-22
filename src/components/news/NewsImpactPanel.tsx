"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  Loader2,
  Newspaper,
  RefreshCw,
  ShieldCheck
} from "lucide-react";
import { ActionButton, StatusPill } from "@/components/ui/DesignPrimitives";
import { withSupabaseAuth } from "@/lib/authFetch";
import type { NewsImpactEvent, NewsImpactListResponse, NewsMarket, NewsReactionMetric } from "@/lib/newsImpact";
import { formatNewsImpactTime, newsImpactClassificationLabel, newsImpactTone } from "@/lib/newsImpactPresentation";
import { trackProductEvent } from "@/lib/trackProductEvent";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

type Asset = "btc" | "eth";

function revisionLabel(event: NewsImpactEvent) {
  if (event.status !== "revised") return null;
  return event.category === "macro" ? "공식값 갱신" : "수정 발표";
}

function stageLabel(stage: NonNullable<NewsImpactEvent["reaction"]>["stage"], event: NewsImpactEvent) {
  const revised = event.status === "revised";
  const prefix = event.category === "macro" ? "공식값 갱신 뒤" : "수정 발표 뒤";
  if (stage === "detected") return "반응 확인 중";
  if (stage === "provisional_15m") return revised ? `${prefix} 15분 반응` : "발표 후 15분 반응";
  return revised ? `${prefix} 60분 반응` : "발표 후 60분 반응";
}

function qualityLabel(quality: NewsImpactListResponse["quality"]) {
  if (quality === "ready") return "공식 출처 정상";
  if (quality === "partial") return "일부 출처 지연";
  if (quality === "stale") return "갱신 지연";
  return "확인 준비 중";
}

function impactExplanation(event: NewsImpactEvent) {
  const classification = event.reaction?.classification ?? "pending";
  if (classification === "supports_existing_state") return "발표 이후 시장 흐름이 기존 판단과 같은 방향으로 강해졌습니다.";
  if (classification === "conflicts_with_existing_state") return "발표 이후 시장 흐름이 기존 판단과 반대로 움직여 조건을 다시 확인해야 합니다.";
  if (classification === "decision_state_changed") return "발표 이후 저장된 판단 상태가 달라졌습니다.";
  if (classification === "risk_increase") return "발표 이후 시장 위험이 이전보다 커졌습니다.";
  if (classification === "no_material_reaction") return "발표 이후 판단을 바꿀 만큼 뚜렷한 반응은 관측되지 않았습니다.";
  if (classification === "insufficient_data") return "같은 기준으로 비교할 발표 전후 자료가 부족해 영향을 단정하지 않습니다.";
  return event.status === "revised"
    ? event.category === "macro"
      ? "공식 실제값이나 비교 수치가 갱신되어 갱신 뒤 마감되는 첫 15분 구간을 기다리고 있습니다."
      : "공식 발표 내용이 수정되어 수정 시점 뒤 마감되는 첫 15분 구간을 기다리고 있습니다."
    : "공식 발표 뒤 마감되는 첫 15분 구간을 기다리고 있습니다.";
}

function nextCheckCopy(event: NewsImpactEvent) {
  const reaction = event.reaction;
  if (!reaction) return "발표 뒤 마감되는 첫 15분 구간을 확인합니다.";
  const updatedPrefix = event.category === "macro" ? "공식값 갱신 뒤" : "수정 발표 뒤";
  if (reaction.stage === "detected") return `${formatNewsImpactTime(reaction.nextCheckAt)} 전후 ${event.status === "revised" ? `${updatedPrefix} ` : ""}마감된 15분 반응을 확인합니다.`;
  if (reaction.stage === "provisional_15m") return `${formatNewsImpactTime(reaction.nextCheckAt)} 전후 ${event.status === "revised" ? updatedPrefix : "발표 후"} 60분 반응을 확인합니다.`;
  return reaction.evaluatedAt
    ? `${formatNewsImpactTime(reaction.evaluatedAt)} 기준 ${event.status === "revised" ? updatedPrefix : "발표 후"} 60분 반응 확인을 마쳤습니다. 현재 시장 화면에서 위험과 확인 가격을 다시 보세요.`
    : "최종 반응 평가 시각을 확인하고 있습니다.";
}

function nextCheckHeading(event: NewsImpactEvent) {
  return event.reaction?.stage === "final_60m" ? "반응 확인 완료" : "다음에 확인할 것";
}

function eventCta(event: NewsImpactEvent, market: NewsMarket, asset: Asset, exactContext: boolean, impactEnabled = true) {
  if (market === "global") {
    return impactEnabled
      ? { href: `/global?event=${event.id}&source=news`, label: "글로벌 판단에서 확인" }
      : { href: "/global?source=news", label: "현재 글로벌 판단 보기" };
  }
  const reaction = event.reaction;
  const target = reaction?.target === "eth" ? "eth" : reaction?.target === "btc" ? "btc" : asset;
  const params = new URLSearchParams({ asset: target, timeframe: "15m" });
  const exactCryptoContext = Boolean(exactContext && reaction?.evaluatedSnapshotId && reaction.reactionId);
  if (exactCryptoContext && reaction?.evaluatedSnapshotId && reaction.reactionId) {
    params.set("snapshot", reaction.evaluatedSnapshotId);
    params.set("impact", reaction.reactionId);
    params.set("source", "news");
  }
  return {
    href: `/crypto/perpetual?${params.toString()}`,
    label: exactCryptoContext ? "이 발표 뒤 선물 분석 보기" : "현재 선물 분석 보기"
  };
}

function formatMetricValue(metric: NewsReactionMetric, value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  if (metric.unit === "σ") return `${value >= 0 ? "+" : ""}${value.toFixed(2)}σ`;
  if (metric.unit === "%") return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  if (metric.unit === "USDT") return `${Math.round(value).toLocaleString("ko-KR")} USDT`;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}${metric.unit ? ` ${metric.unit}` : ""}`;
}

function officialRelevanceCopy(event: NewsImpactEvent, market: NewsMarket) {
  if (event.category === "macro") {
    return market === "crypto"
      ? "금리·물가·고용 발표는 달러와 위험자산 변동성을 키울 수 있어 BTC·ETH의 현재 위험과 확인 가격을 다시 볼 이유가 됩니다."
      : "금리·물가·고용 발표는 지수선물·달러·채권금리와 섹터 흐름이 동시에 바뀌는 계기가 될 수 있습니다.";
  }
  if (event.category === "regulation") {
    return market === "crypto"
      ? "디지털자산 규제와 집행 변화는 거래 접근성·유동성·심리에 영향을 줄 수 있어 현재 선물 흐름과 따로 확인해야 합니다."
      : "규제와 집행 변화는 관련 기업·섹터의 비용과 시장 접근 조건을 바꿀 수 있습니다.";
  }
  if (event.category === "corporate_sector") {
    return "주요 기업 공시는 해당 종목뿐 아니라 같은 섹터와 지수의 변동성에도 영향을 줄 수 있습니다.";
  }
  return market === "crypto"
    ? "거래·청산·시장 구조 변화는 유동성과 큰 금액 체결 환경을 바꿀 수 있어 현재 선물 상태와 함께 확인해야 합니다."
    : "시장 구조 변화는 거래 유동성과 지수·섹터의 움직임에 영향을 줄 수 있어 현재 시장 상태와 함께 확인해야 합니다.";
}

function officialNextStepCopy(market: NewsMarket, asset: Asset) {
  return market === "crypto"
    ? `${asset.toUpperCase()} 선물 화면에서 현재 위험과 확인 조건을 먼저 보고, 검증된 발표 전후 반응이 준비되면 다시 비교합니다.`
    : "글로벌 화면에서 현재 시장 모드와 위험지표를 먼저 보고, 검증된 발표 전후 반응이 준비되면 다시 비교합니다.";
}

function EmptyState({ market, quality, warning }: {
  market: NewsMarket;
  quality: NewsImpactListResponse["quality"];
  warning: string | null;
}) {
  const delayed = quality !== "ready";
  return (
    <section className="bg-ui-panel px-4 py-8 text-center" role="status">
      {delayed ? <AlertTriangle className="mx-auto text-ui-watch" size={24} aria-hidden /> : <CheckCircle2 className="mx-auto text-ui-long" size={24} aria-hidden />}
      <h2 className="mt-3 text-lg font-black text-ui-text">{delayed ? "공식 출처 갱신 상태를 확인하고 있습니다" : "지금 시장 판단을 바꿀 새 공식 이슈는 없습니다"}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ui-muted">
        {delayed ? (warning ?? "출처 수집이 정상화되기 전에는 새 사건이 없다고 단정하지 않습니다. 마지막 정상 결과와 다음 일정을 확인해 주세요.") : `${market === "crypto" ? "BTC·ETH" : "글로벌 시장"}은 자극적인 헤드라인보다 실제 가격 반응과 다음 경제 일정을 우선해 확인합니다.`}
      </p>
      <a href={market === "crypto" ? "/schedule?market=crypto" : "/schedule?market=global"} className="mt-3 inline-flex text-xs font-black text-ui-brand underline underline-offset-2">다가오는 공식 경제 일정 보기</a>
    </section>
  );
}

function RolloutState({ mode, warning }: { mode: NewsImpactListResponse["mode"]; warning: string | null }) {
  return (
    <section className="bg-ui-panel px-4 py-8 text-center" role="status">
      <ShieldCheck className="mx-auto text-ui-brand" size={24} aria-hidden />
      <h2 className="mt-3 text-lg font-black text-ui-text">공식 뉴스 분석을 준비하고 있습니다</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ui-muted">
        {warning ?? "검증되지 않은 발표·공시나 시장 반응은 사용자 판단과 알림에 사용하지 않습니다."}
      </p>
    </section>
  );
}

function SupportingEvents({
  events,
  market,
  asset,
  exactContext,
  impactEnabled
}: {
  events: NewsImpactEvent[];
  market: NewsMarket;
  asset: Asset;
  exactContext: boolean;
  impactEnabled: boolean;
}) {
  if (events.length === 0) return null;
  return (
    <section className="bg-ui-panel px-3 py-4 sm:px-5" aria-labelledby="news-impact-history-title">
      <h2 id="news-impact-history-title" className="text-base font-black text-ui-text">최근 공식 발표·공시</h2>
      <div className="mt-2 divide-y divide-ui-line">
        {events.map((event) => {
          const cta = eventCta(event, market, asset, exactContext, impactEnabled);
          return (
            <article key={event.id} className="py-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusPill tone={impactEnabled ? newsImpactTone(event.reaction?.classification ?? "pending") : "watch"}>
                  {impactEnabled ? newsImpactClassificationLabel(event.reaction?.classification ?? "pending") : "공식 발표"}
                </StatusPill>
                <span className="text-[11px] font-semibold text-ui-subtle">{formatNewsImpactTime(event.occurredAt)}</span>
                {revisionLabel(event) ? <span className="text-[11px] font-black text-ui-watch">{revisionLabel(event)}</span> : null}
              </div>
              <h3 className="mt-1.5 text-sm font-black leading-6 text-ui-text [word-break:keep-all]">{event.headline}</h3>
              <p className="mt-1 text-xs leading-5 text-ui-muted [word-break:keep-all]">
                {impactEnabled ? event.reaction?.reactionSummary ?? "발표 이후 시장 반응을 확인 중입니다." : event.factSummary}
              </p>
              <a href={cta.href} className="mt-2 inline-flex text-xs font-black text-ui-brand underline underline-offset-2">{cta.label}</a>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function NewsImpactPanel({ market, initialAsset = "btc", requestedEventId = null, requestedSnapshotId = null }: {
  market: NewsMarket;
  initialAsset?: Asset;
  requestedEventId?: string | null;
  requestedSnapshotId?: string | null;
}) {
  const { session } = useSupabaseAuth();
  const [asset, setAsset] = useState<Asset>(initialAsset);
  const [activeRequestedEventId, setActiveRequestedEventId] = useState<string | null>(requestedEventId);
  const [activeRequestedSnapshotId, setActiveRequestedSnapshotId] = useState<string | null>(requestedSnapshotId);
  const [payload, setPayload] = useState<NewsImpactListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deepLinkError, setDeepLinkError] = useState<string | null>(null);
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [alertSaving, setAlertSaving] = useState(false);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const requestRef = useRef<{ generation: number; controller: AbortController } | null>(null);
  const paginationRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const viewedEventRef = useRef<string | null>(null);

  useEffect(() => {
    setActiveRequestedEventId(requestedEventId);
    setActiveRequestedSnapshotId(requestedSnapshotId);
    setDeepLinkError(null);
    viewedEventRef.current = null;
  }, [requestedEventId, requestedSnapshotId]);

  const load = useCallback(async (silent = false) => {
    const generation = ++generationRef.current;
    requestRef.current?.controller.abort();
    paginationRef.current?.abort();
    setLoadingMore(false);
    const controller = new AbortController();
    requestRef.current = { generation, controller };
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const params = new URLSearchParams({ market, limit: "20" });
      if (market === "crypto") params.set("asset", asset);
      if (market === "crypto" && activeRequestedSnapshotId) params.set("snapshot", activeRequestedSnapshotId);
      const response = await fetch(`/api/news-impact?${params.toString()}`, await withSupabaseAuth({ cache: "no-store", signal: controller.signal }));
      const next = (await response.json().catch(() => ({}))) as NewsImpactListResponse;
      if (!response.ok) throw new Error(next.error ?? next.warning ?? "공식 뉴스 분석을 불러오지 못했습니다.");

      if (
        next.market !== market ||
        next.asset !== (market === "crypto" ? asset : null) ||
        (next.snapshotId ?? null) !== activeRequestedSnapshotId
      ) throw new Error("news_impact_context_mismatch");
      let events = next.events ?? [];
      let requestedError: string | null = null;
      if (activeRequestedEventId && !events.some((event) => event.id === activeRequestedEventId) && next.mode === "on" && activeRequestedSnapshotId) {
        requestedError = "Home에서 본 시장 분석과 같은 시점의 뉴스 반응을 찾지 못했습니다.";
      } else if (activeRequestedEventId && !events.some((event) => event.id === activeRequestedEventId) && next.mode !== "off") {
        const detailParams = new URLSearchParams({ market });
        if (market === "crypto") detailParams.set("asset", asset);
        const detailResponse = await fetch(
          `/api/news-impact/${encodeURIComponent(activeRequestedEventId)}?${detailParams.toString()}`,
          await withSupabaseAuth({ cache: "no-store", signal: controller.signal })
        );
        const detail = (await detailResponse.json().catch(() => ({}))) as { event?: NewsImpactEvent; error?: string };
        if (detailResponse.ok && detail.event) events = [detail.event, ...events];
        else requestedError = detail.error ?? "요청한 공식 발표·공시가 현재 시장 또는 자산과 일치하지 않습니다.";
      }
      if (controller.signal.aborted || generation !== generationRef.current) return;
      setPayload({ ...next, events: Array.from(new Map(events.map((event) => [event.id, event])).values()) });
      setDeepLinkError(requestedError);
      setError(next.warning ?? null);
    } catch (loadError) {
      if (!controller.signal.aborted && generation === generationRef.current) {
        setError(loadError instanceof Error ? loadError.message : "공식 뉴스 분석을 불러오지 못했습니다.");
      }
    } finally {
      if (!controller.signal.aborted && generation === generationRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [activeRequestedEventId, activeRequestedSnapshotId, asset, market]);

  useEffect(() => {
    void load(false);
    const timer = window.setInterval(() => void load(true), 5 * 60_000);
    return () => {
      window.clearInterval(timer);
      requestRef.current?.controller.abort();
      paginationRef.current?.abort();
    };
  }, [load, session?.accessToken]);

  useEffect(() => {
    if (payload?.mode !== "on" || !session) {
      setAlertEnabled(false);
      setPreferenceError(null);
      return;
    }
    const controller = new AbortController();
    setPreferenceError(null);
    void (async () => {
      try {
        const response = await fetch(`/api/news-impact/preferences?market=${market}`, await withSupabaseAuth({ cache: "no-store", signal: controller.signal }));
        const value = (await response.json().catch(() => ({}))) as { enabled?: boolean; error?: string };
        if (!response.ok) throw new Error(value.error ?? "알림 설정을 확인하지 못했습니다.");
        if (!controller.signal.aborted) setAlertEnabled(Boolean(value.enabled));
      } catch (lookupError) {
        if (!controller.signal.aborted) setPreferenceError(lookupError instanceof Error ? lookupError.message : "알림 설정을 확인하지 못했습니다.");
      }
    })();
    return () => controller.abort();
  }, [market, payload?.capabilities.canEnableImpactAlerts, payload?.mode, session]);

  const lead = useMemo(() => {
    const events = payload?.events ?? [];
    return activeRequestedEventId
      ? events.find((event) => event.id === activeRequestedEventId) ?? null
      : events[0] ?? null;
  }, [activeRequestedEventId, payload?.events]);
  const supporting = useMemo(
    () => (payload?.events ?? []).filter((event) => event.id !== lead?.id),
    [lead?.id, payload?.events]
  );

  useEffect(() => {
    if (!lead || viewedEventRef.current === lead.id) return;
    viewedEventRef.current = lead.id;
    void trackProductEvent({
      eventName: "news_impact_viewed",
      surface: "news",
      asset: market === "crypto" ? asset : undefined,
      newsEventId: lead.id,
      newsReactionId: lead.reaction?.reactionId,
      properties: { market, classification: lead.reaction?.classification ?? "pending", source: activeRequestedEventId ? "deep_link" : "news" }
    });
  }, [activeRequestedEventId, asset, lead, market]);

  function changeAsset(next: Asset) {
    if (next === asset) return;
    requestRef.current?.controller.abort();
    paginationRef.current?.abort();
    generationRef.current += 1;
    setLoadingMore(false);
    setAsset(next);
    setPayload(null);
    setError(null);
    setDeepLinkError(null);
    setActiveRequestedEventId(null);
    setActiveRequestedSnapshotId(null);
    viewedEventRef.current = null;
    const url = new URL(window.location.href);
    url.searchParams.set("asset", next);
    url.searchParams.delete("event");
    url.searchParams.delete("snapshot");
    url.searchParams.delete("source");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  async function loadMore() {
    if (!payload?.nextCursor || loadingMore) return;
    const cursor = payload.nextCursor;
    const generation = generationRef.current;
    const requestedAsset = asset;
    const requestedSnapshot = activeRequestedSnapshotId;
    paginationRef.current?.abort();
    const controller = new AbortController();
    paginationRef.current = controller;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ market, limit: "20", cursor });
      if (market === "crypto") params.set("asset", requestedAsset);
      if (market === "crypto" && requestedSnapshot) params.set("snapshot", requestedSnapshot);
      const response = await fetch(`/api/news-impact?${params.toString()}`, await withSupabaseAuth({ cache: "no-store", signal: controller.signal }));
      const next = (await response.json().catch(() => ({}))) as NewsImpactListResponse;
      if (!response.ok) throw new Error(next.error ?? next.warning ?? "이전 발표·공시를 불러오지 못했습니다.");
      if (
        controller.signal.aborted ||
        generation !== generationRef.current ||
        next.market !== market ||
        next.asset !== (market === "crypto" ? requestedAsset : null) ||
        (next.snapshotId ?? null) !== requestedSnapshot
      ) return;
      setPayload((current) => current && current.nextCursor === cursor ? {
          ...current,
          events: Array.from(new Map([...current.events, ...next.events].map((event) => [event.id, event])).values()),
          nextCursor: next.nextCursor
        } : current);
    } catch (moreError) {
      if (!controller.signal.aborted && generation === generationRef.current) {
        setError(moreError instanceof Error ? moreError.message : "이전 발표·공시를 불러오지 못했습니다.");
      }
    } finally {
      if (!controller.signal.aborted && generation === generationRef.current) setLoadingMore(false);
    }
  }

  async function toggleAlert() {
    if (payload?.mode !== "on" || (!payload.capabilities.canEnableImpactAlerts && !alertEnabled)) return;
    const next = !alertEnabled;
    setAlertSaving(true);
    setPreferenceError(null);
    try {
      const response = await fetch("/api/news-impact/preferences", await withSupabaseAuth({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market, enabled: next })
      }));
      const result = (await response.json().catch(() => ({}))) as { enabled?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error ?? "알림 설정을 저장하지 못했습니다.");
      setAlertEnabled(Boolean(result.enabled));
      void trackProductEvent({
        eventName: "news_alert_opted_in",
        surface: "news",
        asset: market === "crypto" ? asset : undefined,
        properties: { market, enabled: Boolean(result.enabled) }
      });
    } catch (saveError) {
      setPreferenceError(saveError instanceof Error ? saveError.message : "알림 설정을 저장하지 못했습니다.");
    } finally {
      setAlertSaving(false);
    }
  }

  if (loading && !payload) {
    return (
      <section className="min-h-[360px] bg-ui-panel px-4 py-8" aria-busy="true">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-ui-muted">
          <Loader2 className="animate-spin text-ui-brand" size={18} aria-hidden /> 공식 발표·공시와 시장 반응을 불러오고 있습니다.
        </p>
      </section>
    );
  }
  if (!payload && error) {
    return (
      <section className="bg-ui-panel px-4 py-8">
        <h2 className="text-lg font-black text-ui-text">공식 뉴스 분석을 불러오지 못했습니다</h2>
        <p className="mt-2 text-sm text-ui-muted" role="alert">{error}</p>
        <ActionButton tone="secondary" className="mt-4" onClick={() => void load(false)}>
          <RefreshCw size={15} aria-hidden /> 다시 시도
        </ActionButton>
      </section>
    );
  }
  if (!payload) return null;
  if (payload.mode === "off") return <RolloutState mode={payload.mode} warning={payload.warning} />;

  const impactEnabled = payload.mode === "on";
  const canUseExactContext = impactEnabled && payload.capabilities.canSeeProEvidence;
  const cta = lead ? eventCta(lead, market, asset, canUseExactContext, impactEnabled) : null;
  const currentNewsPath = market === "crypto"
    ? `/crypto/news?asset=${asset}${lead ? `&event=${encodeURIComponent(lead.id)}` : ""}`
    : `/news?market=global${lead ? `&event=${encodeURIComponent(lead.id)}` : ""}`;
  const newsUpgradeHref = `/pro?market=${market === "crypto" ? "crypto" : "stocks"}&source=news&returnTo=${encodeURIComponent(currentNewsPath)}`;
  const reaction = lead?.reaction;
  const officialSourceCount = payload.sourceHealth.healthy + payload.sourceHealth.degraded;
  const leadIsToday = Boolean(lead && Date.now() - Date.parse(lead.occurredAt) <= 24 * 60 * 60_000);
  return (
    <div className="space-y-3">
      <section className="bg-ui-panel px-3 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <nav aria-label="뉴스 시장" className="flex gap-1">
            <a href="/crypto/news?asset=btc" aria-current={market === "crypto" ? "page" : undefined} className={`min-h-9 px-3 py-2 text-xs font-black ${market === "crypto" ? "bg-ui-brand text-white" : "bg-ui-inset text-ui-muted"}`}>코인</a>
            <a href="/news?market=global" aria-current={market === "global" ? "page" : undefined} className={`min-h-9 px-3 py-2 text-xs font-black ${market === "global" ? "bg-ui-brand text-white" : "bg-ui-inset text-ui-muted"}`}>글로벌</a>
          </nav>
          {market === "crypto" ? (
            <div className="flex gap-1" role="group" aria-label="코인 선택">
              {(["btc", "eth"] as const).map((value) => (
                <button key={value} type="button" aria-pressed={asset === value} onClick={() => changeAsset(value)} className={`min-h-9 px-3 text-xs font-black uppercase ${asset === value ? "border-b-2 border-ui-brand text-ui-text" : "text-ui-muted"}`}>{value}</button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-ui-muted">
          <span className="inline-flex items-center gap-1"><Database size={12} aria-hidden /> {qualityLabel(payload.quality)}</span>
          <span className="inline-flex items-center gap-1"><Clock3 size={12} aria-hidden /> 생성 {formatNewsImpactTime(payload.generatedAt)}</span>
          <span>공식 출처 {officialSourceCount}곳 확인</span>
          {refreshing ? <Loader2 className="animate-spin" size={12} aria-label="갱신 중" /> : null}
        </div>
        {error ? <p role="alert" className="mt-2 flex items-start gap-1.5 bg-ui-watch/10 px-2 py-1.5 text-xs font-semibold leading-5 text-ui-watch"><AlertTriangle className="mt-0.5 shrink-0" size={13} aria-hidden />{error}</p> : null}
        {deepLinkError ? (
          <div role="alert" className="mt-2 bg-ui-risk/10 px-2 py-1.5 text-xs font-semibold leading-5 text-ui-risk">
            <p>{deepLinkError} 다른 발표·공시로 자동 전환하지 않았습니다.</p>
            {activeRequestedSnapshotId ? (
              <button
                type="button"
                className="mt-1 font-black underline underline-offset-2"
                onClick={() => {
                  setActiveRequestedSnapshotId(null);
                  const url = new URL(window.location.href);
                  url.searchParams.delete("snapshot");
                  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
                }}
              >
                이 발표·공시의 최신 반응 확인
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      {!lead ? (deepLinkError ? null : <EmptyState market={market} quality={payload.quality} warning={payload.warning} />) : (
        <section className="bg-ui-panel px-3 py-4 sm:px-5" aria-labelledby="lead-news-impact-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.12em] text-ui-brand"><Newspaper size={12} aria-hidden /> {leadIsToday ? "오늘 확인할 공식 발표" : "최근 확인할 공식 발표"}</p>
            <StatusPill tone={impactEnabled ? newsImpactTone(reaction?.classification ?? "pending") : "watch"}>{impactEnabled ? newsImpactClassificationLabel(reaction?.classification ?? "pending") : "공식 발표"}</StatusPill>
          </div>
          <h2 id="lead-news-impact-title" className="mt-2 line-clamp-2 text-xl font-black leading-7 tracking-tight text-ui-text [word-break:keep-all]">{lead.headline}</h2>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-ui-muted">
            <span>{formatNewsImpactTime(lead.occurredAt)}</span><span>{lead.primarySource.name}</span>{revisionLabel(lead) ? <span className="font-black text-ui-watch">{revisionLabel(lead)}</span> : null}<span>{impactEnabled ? (reaction ? stageLabel(reaction.stage, lead) : "반응 확인 중") : "시장 반응 연결 검증 중"}</span>
          </div>
          {impactEnabled ? (
            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <div className="bg-ui-inset/70 px-3 py-2.5"><p className="text-[10px] font-black uppercase tracking-[0.08em] text-ui-subtle">무슨 일이 있었나</p><p className="mt-1 line-clamp-3 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{lead.factSummary}</p></div>
              <div className="bg-ui-inset/70 px-3 py-2.5"><p className="text-[10px] font-black uppercase tracking-[0.08em] text-ui-subtle">발표 뒤 실제 시장 반응</p><p className="mt-1 line-clamp-3 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{reaction?.reactionSummary ?? "발표 뒤 마감되는 첫 15분 구간을 확인 중입니다."}</p></div>
              <div className="bg-ui-inset/70 px-3 py-2.5"><p className="text-[10px] font-black uppercase tracking-[0.08em] text-ui-subtle">현재 판단과 같은가?</p><p className="mt-1 line-clamp-3 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{impactExplanation(lead)}</p></div>
              <div className="bg-ui-inset/70 px-3 py-2.5"><p className="text-[10px] font-black uppercase tracking-[0.08em] text-ui-subtle">{nextCheckHeading(lead)}</p><p className="mt-1 line-clamp-3 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{nextCheckCopy(lead)}</p></div>
            </div>
          ) : (
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <div className="bg-ui-inset/70 px-3 py-2.5"><p className="text-[10px] font-black uppercase tracking-[0.08em] text-ui-subtle">무슨 일이 있었나</p><p className="mt-1 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{lead.factSummary}</p></div>
              <div className="bg-ui-inset/70 px-3 py-2.5"><p className="text-[10px] font-black uppercase tracking-[0.08em] text-ui-subtle">왜 확인해야 하나</p><p className="mt-1 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{officialRelevanceCopy(lead, market)}</p></div>
              <div className="bg-ui-inset/70 px-3 py-2.5"><p className="text-[10px] font-black uppercase tracking-[0.08em] text-ui-subtle">지금 할 일</p><p className="mt-1 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{officialNextStepCopy(market, asset)}</p></div>
            </div>
          )}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <a href={lead.primarySource.url} target="_blank" rel="noreferrer" onClick={() => void trackProductEvent({ eventName: "news_source_opened", surface: "news", asset: market === "crypto" ? asset : undefined, newsEventId: lead.id, properties: { market, source: lead.primarySource.name } })} className="order-2 inline-flex min-h-9 items-center gap-1 text-xs font-black text-ui-muted underline underline-offset-2 sm:order-1"><ExternalLink size={13} aria-hidden /> 대표 공식 원문</a>
            {cta ? <a href={cta.href} onClick={() => void trackProductEvent({ eventName: "news_to_market_opened", surface: "news", asset: market === "crypto" ? asset : undefined, snapshotId: reaction?.evaluatedSnapshotId, newsEventId: lead.id, newsReactionId: reaction?.reactionId, properties: { market, classification: reaction?.classification ?? "pending", source: "news", exactContext: canUseExactContext } })} className="order-1 inline-flex min-h-10 w-full items-center justify-center bg-ui-brand px-3 text-sm font-semibold text-white transition hover:brightness-110 sm:order-2 sm:w-auto">{cta.label}</a> : null}
          </div>
        </section>
      )}

      {lead?.pro ? (
        <details className="bg-ui-panel px-3 py-4 sm:px-5">
          <summary className="cursor-pointer text-sm font-black text-ui-text">Pro 근거 · 전체 공식 출처와 15분·60분 비교</summary>
          <div className="mt-3 grid gap-3">
            <ul className="space-y-1 text-xs text-ui-muted">{lead.pro.sources.map((source) => <li key={source.id}><a className="underline" href={source.url} target="_blank" rel="noreferrer">{source.name} · {formatNewsImpactTime(source.publishedAt)}</a></li>)}</ul>
            {lead.pro.metrics.length > 0 ? <div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead><tr className="text-ui-subtle"><th className="py-1 pr-3">지표</th><th className="py-1 pr-3">발표 전</th><th className="py-1">발표 후</th></tr></thead><tbody>{lead.pro.metrics.map((metric) => <tr key={metric.key} className="border-t border-ui-line"><th className="py-1.5 pr-3 font-semibold text-ui-text">{metric.label}</th><td className="py-1.5 pr-3 tabular-nums">{formatMetricValue(metric, metric.before)}</td><td className="py-1.5 tabular-nums">{formatMetricValue(metric, metric.after)}</td></tr>)}</tbody></table></div> : null}
            {lead.pro.revisions.length > 0 ? <div><p className="text-xs font-black text-ui-text">공식 개정 이력</p><ul className="mt-1 space-y-1 text-xs text-ui-muted">{lead.pro.revisions.map((revision) => <li key={`${revision.version}-${revision.updatedAt}`}>v{revision.version} · {formatNewsImpactTime(revision.updatedAt)} · {revision.headline}</li>)}</ul></div> : null}
          </div>
        </details>
      ) : null}

      {payload.mode === "on" ? <section className="bg-ui-panel px-3 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="inline-flex items-center gap-1 text-xs font-black text-ui-text"><ShieldCheck size={14} className="text-ui-brand" aria-hidden /> 중요한 공식 뉴스만 알림</p><p className="mt-1 text-xs leading-5 text-ui-muted">Pro는 30일 이력·전체 공식 출처·발표 전후 15분/60분 비교를 열고, 현재 판단과 충돌하거나 위험이 커진 경우만 알립니다. 알림은 기본 OFF입니다.</p>{preferenceError ? <p className="mt-1 text-xs font-semibold text-ui-risk" role="alert">{preferenceError}</p> : null}</div>
          {payload.capabilities.canEnableImpactAlerts || alertEnabled ? <button type="button" aria-pressed={alertEnabled} disabled={alertSaving} onClick={() => void toggleAlert()} className={`inline-flex min-h-10 items-center justify-center gap-1.5 px-4 text-xs font-black ${alertEnabled ? "bg-ui-brand text-white" : "bg-ui-inset text-ui-text"}`}>{alertSaving ? <Loader2 className="animate-spin" size={14} aria-hidden /> : <Bell size={14} aria-hidden />}{alertEnabled ? "알림 끄기" : "알림 켜기"}</button> : <ActionButton href={payload.capabilities.requiresAuth ? `/login?returnTo=${encodeURIComponent(currentNewsPath)}` : newsUpgradeHref} tone="secondary">{payload.capabilities.requiresAuth ? "로그인하고 Pro 기능 확인" : "Pro에서 뉴스 기능 열기"}</ActionButton>}
        </div>
      </section> : null}

      <SupportingEvents events={supporting} market={market} asset={asset} exactContext={canUseExactContext} impactEnabled={impactEnabled} />
      {payload.nextCursor ? <div className="flex justify-center"><ActionButton tone="secondary" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? <Loader2 className="animate-spin" size={15} aria-hidden /> : null} 이전 공식 발표·공시 더 보기</ActionButton></div> : null}
    </div>
  );
}
