"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Clock3, Inbox, Loader2, RefreshCw, Settings } from "lucide-react";
import { ActionButton, AppSurface, PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";
import { withSupabaseAuth } from "@/lib/authFetch";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

type AlertMarket = "crypto" | "stocks";
type LoadStatus = "idle" | "loading" | "ready" | "error";

interface PushAlertEvent {
  id: string;
  market: AlertMarket;
  rule_id: string;
  event_key: string;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  sent_at: string;
  created_at: string;
}

interface PushAlertEventsResponse {
  events?: PushAlertEvent[];
  error?: string;
}

function formatAlertTime(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "시간 확인 필요";

  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function payloadString(payload: Record<string, unknown> | null, keys: string[]) {
  if (!payload) return null;
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function alertKindLabel(payload: Record<string, unknown> | null, ruleId: string) {
  const kind = payloadString(payload, ["alertKind", "alert_kind", "kind", "type"]);
  if (!kind) return ruleId;
  return kind.replaceAll("_", " ");
}

function alertScoreLabel(payload: Record<string, unknown> | null) {
  const score = payloadString(payload, ["score", "setupScore"]);
  return score ? `${score}점` : null;
}

function marketCopy(market: AlertMarket) {
  if (market === "stocks") {
    return {
      title: "글로벌 알림 기록",
      description: "최근 발송된 글로벌 알림을 시간순으로 확인합니다.",
      settingsHref: "/alerts?market=global"
    };
  }

  return {
    title: "코인 알림 기록",
    description: "여태까지 도착한 코인 알림을 최신순으로 확인합니다.",
    settingsHref: "/crypto/alertset"
  };
}

export function RadarAlertList({ market = "crypto" }: { market?: AlertMarket }) {
  const { session, isLoading: isAuthLoading } = useSupabaseAuth();
  const [events, setEvents] = useState<PushAlertEvent[]>([]);
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [loginHref, setLoginHref] = useState("/login");
  const copy = useMemo(() => marketCopy(market), [market]);

  useEffect(() => {
    const currentPath = `${window.location.pathname}${window.location.search}`;
    setLoginHref(`/login?returnTo=${encodeURIComponent(currentPath)}`);
  }, []);

  const loadEvents = useCallback(async () => {
    if (!session) return;

    setStatus("loading");
    setError(null);
    try {
      const response = await fetch(
        `/api/push-alert-events?market=${market === "stocks" ? "global" : "crypto"}&limit=50`,
        await withSupabaseAuth({ cache: "no-store" })
      );
      const payload = (await response.json().catch(() => ({}))) as PushAlertEventsResponse;
      if (!response.ok) throw new Error(payload.error ?? "알림 기록을 불러오지 못했습니다.");
      setEvents(payload.events ?? []);
      setStatus("ready");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "알림 기록을 불러오지 못했습니다.");
      setStatus("error");
    }
  }, [market, session]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!session) {
      setStatus("idle");
      setEvents([]);
      return;
    }
    void loadEvents();
  }, [isAuthLoading, loadEvents, session]);

  if (isAuthLoading) {
    return (
      <AppSurface className="space-y-4">
        <SectionHeader title={copy.title} description="로그인 상태를 확인하고 있습니다." />
        <PanelCard variant="report" className="flex items-center gap-3">
          <Loader2 className="animate-spin text-ui-brand" size={18} aria-hidden />
          <p className="text-sm text-ui-muted">알림 기록 준비 중</p>
        </PanelCard>
      </AppSurface>
    );
  }

  if (!session) {
    return (
      <AppSurface className="space-y-4">
        <SectionHeader title={copy.title} description="로그인하면 이 계정으로 발송된 알림 기록을 확인할 수 있습니다." />
        <PanelCard variant="report" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ui-text">로그인이 필요합니다.</p>
            <p className="mt-1 text-xs leading-5 text-ui-muted">알림 기록은 계정별 푸시 발송 기록을 기준으로 표시합니다.</p>
          </div>
          <ActionButton href={loginHref} tone="primary" className="w-full sm:w-auto">
            로그인
          </ActionButton>
        </PanelCard>
      </AppSurface>
    );
  }

  return (
    <AppSurface className="space-y-4">
      <SectionHeader
        eyebrow="Alert List"
        title={copy.title}
        description={copy.description}
        action={
          <div className="flex gap-2">
            <ActionButton onClick={() => void loadEvents()} disabled={status === "loading"} tone="secondary" className="min-h-9 px-3 text-xs">
              {status === "loading" ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <RefreshCw size={14} aria-hidden />}
              새로고침
            </ActionButton>
            <ActionButton href={copy.settingsHref} tone="secondary" className="min-h-9 px-3 text-xs">
              <Settings size={14} aria-hidden />
              설정
            </ActionButton>
          </div>
        }
      />

      {status === "error" ? (
        <PanelCard tone="critical" variant="report">
          <p className="text-sm font-semibold">알림 기록을 불러오지 못했습니다.</p>
          <p className="mt-1 text-xs leading-5">{error}</p>
        </PanelCard>
      ) : null}

      {status === "loading" && events.length === 0 ? (
        <PanelCard variant="report" className="flex items-center gap-3">
          <Loader2 className="animate-spin text-ui-brand" size={18} aria-hidden />
          <p className="text-sm text-ui-muted">최근 알림을 불러오는 중입니다.</p>
        </PanelCard>
      ) : null}

      {status === "ready" && events.length === 0 ? (
        <PanelCard variant="report" className="text-center">
          <Inbox className="mx-auto text-ui-subtle" size={24} aria-hidden />
          <p className="mt-3 text-sm font-semibold text-ui-text">아직 도착한 알림이 없습니다.</p>
          <p className="mt-1 text-xs leading-5 text-ui-muted">알림 조건을 켜두면 발송된 내역이 이 화면에 쌓입니다.</p>
          <ActionButton href={copy.settingsHref} tone="primary" className="mt-4 w-full sm:w-auto">
            알림 설정하기
          </ActionButton>
        </PanelCard>
      ) : null}

      {events.length > 0 ? (
        <div className="divide-y divide-ui-line border-y border-ui-line">
          {events.map((event) => {
            const symbol = payloadString(event.payload, ["symbol", "ticker", "asset"]);
            const score = alertScoreLabel(event.payload);
            const kind = alertKindLabel(event.payload, event.rule_id);
            return (
              <article key={event.id} className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusPill tone="info" className="min-h-0 px-2 py-1 text-[11px]">
                        {kind}
                      </StatusPill>
                      {symbol ? (
                        <StatusPill tone="watch" className="min-h-0 px-2 py-1 text-[11px]">
                          {symbol}
                        </StatusPill>
                      ) : null}
                      {score ? (
                        <StatusPill tone="long" className="min-h-0 px-2 py-1 text-[11px]">
                          {score}
                        </StatusPill>
                      ) : null}
                    </div>
                    <h3 className="mt-3 text-sm font-semibold leading-5 text-ui-text">{event.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-ui-muted [word-break:keep-all]">{event.body}</p>
                  </div>
                  <div className="shrink-0 text-right text-ui-label font-semibold text-ui-subtle">
                    <Clock3 className="ml-auto mb-1" size={13} aria-hidden />
                    {formatAlertTime(event.sent_at ?? event.created_at)}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      <PanelCard variant="flat" padding="none" className="flex items-center justify-between gap-3 border-t border-ui-line pt-4">
        <p className="text-xs leading-5 text-ui-muted">수신 조건을 바꾸려면 알림 설정 화면에서 관리합니다.</p>
        <Link href={copy.settingsHref} className="inline-flex shrink-0 items-center gap-1.5 text-xs font-black text-ui-brand">
          <Bell size={13} aria-hidden />
          알림 설정
        </Link>
      </PanelCard>
    </AppSurface>
  );
}
