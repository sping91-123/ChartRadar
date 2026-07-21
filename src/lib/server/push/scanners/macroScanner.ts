// 푸시 크론용 공식 매크로 일정 리마인더를 생성한다.
import type { SetupAlertMarket } from "@/lib/setupAlertPresets";
import { readOptionalJson } from "@/lib/server/push/optionalJson";
import type { PushAlertEvent } from "@/lib/server/push/types";

export async function scanMacroCalendarEvent(origin: string, market: SetupAlertMarket = "stocks"): Promise<PushAlertEvent | null> {
  const response = await fetch(`${origin}/api/macro-calendar`, { cache: "no-store" });
  const payload = await readOptionalJson<{
    items?: Array<{
      label?: string;
      releaseAt?: string;
      dateKst?: string;
      importance?: number;
      state?: string;
    }>;
  }>(response, "macro-calendar");
  if (!payload) return null;
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
    market,
    ruleId: "macro-event-reminder",
    alertKind: "macro",
    eventKey: `macro-event-reminder:${nextEvent.label}:${nextEvent.releaseAt}`,
    title: "Chart Radar 시장 이벤트 리마인더",
    body: `${nextEvent.dateKst ?? "곧"} ${nextEvent.label} 예정입니다. 발표 전후 변동성 확대 가능성을 확인하세요.`,
    data: {
      type: "macro_event",
      market,
      alert_kind: "macro",
      alertKind: "macro",
      signal: "시장 이벤트 리마인더",
      target: "/schedule",
      targetPath: "/schedule",
      eventLabel: nextEvent.label,
      releaseAt: nextEvent.releaseAt
    },
    system: true
  };
}
