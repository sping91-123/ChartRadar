// 푸시 크론용 공식 매크로 일정 리마인더를 생성한다.
import type { SetupAlertMarket } from "@/lib/setupAlertPresets";
import { readOptionalJson } from "@/lib/server/push/optionalJson";
import type { PushAlertEvent } from "@/lib/server/push/types";

function reminderLabel(label: string) {
  const lower = label.toLowerCase();
  if (lower.includes("core ppi")) return "근원 생산자물가";
  if (lower.includes("ppi")) return "생산자물가";
  if (lower.includes("core cpi")) return "근원 소비자물가";
  if (lower.includes("cpi")) return "소비자물가";
  if (/continuing|continued/.test(lower) && lower.includes("claims")) return "계속 실업수당 청구";
  if (/initial.*claims|jobless claims/.test(lower)) return "신규 실업수당 청구";
  if (lower.includes("existing home sales")) return "기존주택판매";
  if (lower.includes("new home sales")) return "신규주택판매";
  if (lower.includes("core") && lower.includes("pce")) return "근원 PCE 물가";
  if (lower.includes("pce")) return "PCE 물가";
  if (lower.includes("nonfarm") || lower.includes("non-farm")) return "비농업 고용";
  if (lower.includes("unemployment rate")) return "실업률";
  if (lower.includes("retail sales")) return "소매판매";
  if (lower.includes("fomc")) return lower.includes("minutes") ? "FOMC 의사록" : "FOMC";
  return label.trim();
}

export async function scanMacroCalendarEvent(origin: string, market: SetupAlertMarket = "stocks"): Promise<PushAlertEvent | null> {
  const response = await fetch(`${origin}/api/macro-calendar`, { cache: "no-store" });
  const payload = await readOptionalJson<{
    isStale?: boolean;
    sourceUpdatedAt?: string | number | null;
    items?: Array<{
      label?: string;
      releaseAt?: string;
      dateKst?: string;
      importance?: number;
      state?: string;
    }>;
  }>(response, "macro-calendar");
  if (!payload || payload.isStale) return null;
  const now = Date.now();
  const upcoming = (payload.items ?? [])
    .filter((item) => {
      const releaseTime = Date.parse(item.releaseAt ?? "");
      return Boolean(item.label?.trim()) && item.importance === 3 && releaseTime > now && releaseTime - now <= 60 * 60 * 1000;
    })
    .sort((a, b) => Date.parse(a.releaseAt ?? "") - Date.parse(b.releaseAt ?? ""));
  const nextEvent = upcoming[0];
  if (!nextEvent?.label || !nextEvent.releaseAt) return null;
  const releaseMinute = Math.floor(Date.parse(nextEvent.releaseAt) / 60000);
  const labels = Array.from(new Set(upcoming
    .filter((item) => Math.floor(Date.parse(item.releaseAt ?? "") / 60000) === releaseMinute)
    .map((item) => reminderLabel(item.label!)))).sort();
  const releaseAt = new Date(releaseMinute * 60000).toISOString();
  const timeKst = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).format(new Date(releaseAt));
  const eventLabel = `${labels.slice(0, 3).join("·")}${labels.length > 3 ? ` 외 ${labels.length - 3}개` : ""}`;

  return {
    market,
    ruleId: "macro-event-reminder",
    alertKind: "macro",
    eventKey: `macro-event-reminder:release:${releaseMinute}`,
    title: `${timeKst} 주요 일정 · 발표 전 확인`,
    body: `${eventLabel} 발표 예정(한국시간). 일정에서 발표 내용과 예상치를 확인하고 가격 반응을 함께 보세요.`,
    auditEvidence: {
      version: 1,
      capturedAt: new Date(now).toISOString(),
      source: "macro_calendar",
      snapshot: {
        releaseAt,
        sourceUpdatedAt: payload.sourceUpdatedAt ?? null,
        sourceIsStale: payload.isStale ?? null,
        leadMinutes: (releaseMinute * 60000 - now) / 60000,
        // Preserve bounded source labels, not the complete calendar response.
        items: upcoming
          .filter((item) => Math.floor(Date.parse(item.releaseAt ?? "") / 60000) === releaseMinute)
          .slice(0, 12)
          .map((item) => ({ label: item.label, releaseAt: item.releaseAt, importance: item.importance, state: item.state ?? null }))
      }
    },
    data: {
      type: "macro_event",
      market,
      alert_kind: "macro",
      alertKind: "macro",
      signal: "시장 이벤트 리마인더",
      target: "/schedule",
      targetPath: "/schedule",
      eventLabel,
      releaseAt
    },
    system: true
  };
}
