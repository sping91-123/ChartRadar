// 푸시 크론용 뉴스와 매크로 일정 optional source 이벤트를 생성한다.
import type { SetupAlertMarket } from "@/lib/setupAlertPresets";
import { eventBucket } from "@/lib/server/push/duplicateGuard";
import type { PushAlertEvent } from "@/lib/server/push/types";

export async function scanNewsEvent(origin: string, market: SetupAlertMarket): Promise<PushAlertEvent | null> {
  const response = await fetch(`${origin}/api/radar-news?market=${market}`, { cache: "no-store" });
  if (!response.ok) return null;
  const payload = (await response.json()) as { briefing?: { headline?: string; keyIssues?: Array<{ title?: string }> } };
  const headline = payload.briefing?.headline;
  const firstIssue = payload.briefing?.keyIssues?.[0]?.title;
  if (!headline && !firstIssue) return null;

  return {
    market,
    ruleId: "macro-news",
    alertKind: "macro",
    eventKey: `macro-news:${market}:${firstIssue ?? headline}:${eventBucket(180)}`,
    title: market === "stocks" ? "Chart Radar 시장 이벤트 리마인더" : "Chart Radar 코인 뉴스",
    body: firstIssue ?? headline ?? "주요 뉴스 브리핑이 갱신되었습니다.",
    data: {
      type: "macro-news",
      market,
      alert_kind: "macro",
      alertKind: "macro",
      target: market === "stocks" ? "/news?market=global" : "/news?market=crypto",
      targetPath: market === "stocks" ? "/news?market=global" : "/news?market=crypto"
    },
    system: true
  };
}

export async function scanMacroCalendarEvent(origin: string): Promise<PushAlertEvent | null> {
  const response = await fetch(`${origin}/api/macro-calendar`, { cache: "no-store" });
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    items?: Array<{
      label?: string;
      releaseAt?: string;
      dateKst?: string;
      importance?: number;
      state?: string;
    }>;
  };
  const now = Date.now();
  const upcoming = (payload.items ?? [])
    .filter((item) => {
      const releaseTime = Date.parse(item.releaseAt ?? "");
      return item.importance === 3 && releaseTime > now && releaseTime - now <= 24 * 60 * 60 * 1000;
    })
    .sort((a, b) => Date.parse(a.releaseAt ?? "") - Date.parse(b.releaseAt ?? ""));
  const nextEvent = upcoming[0];
  if (!nextEvent?.label || !nextEvent.releaseAt) return null;

  return {
    market: "stocks",
    ruleId: "macro-news",
    alertKind: "macro",
    eventKey: `macro-event-reminder:stocks:${nextEvent.label}:${nextEvent.releaseAt}:${eventBucket(360)}`,
    title: "Chart Radar 시장 이벤트 리마인더",
    body: `${nextEvent.dateKst ?? "곧"} ${nextEvent.label} 예정입니다. 발표 전후 변동성 확대 가능성을 확인하세요.`,
    data: {
      type: "macro-news",
      market: "stocks",
      alert_kind: "macro",
      alertKind: "macro",
      signal: "시장 이벤트 리마인더",
      target: "/news?market=global",
      targetPath: "/news?market=global",
      eventLabel: nextEvent.label,
      releaseAt: nextEvent.releaseAt
    },
    system: true
  };
}
