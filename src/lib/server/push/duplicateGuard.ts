// 푸시 이벤트 중복 방지와 전송 기록 helper를 분리한다.
import { supabaseAdminRest } from "@/lib/server/supabaseAdmin";
import type { PushAlertEvent } from "@/lib/server/push/types";

export function eventBucket(minutes: number) {
  return Math.floor(Date.now() / (minutes * 60 * 1000));
}

export function duplicateBucket(eventKey: string) {
  const parts = eventKey.split(":");
  return parts[parts.length - 1] ?? null;
}

export async function alreadySent(userId: string, eventKey: string) {
  const rows = await supabaseAdminRest<Array<{ id: string }>>(
    `push_alert_events?select=id&user_id=eq.${encodeURIComponent(userId)}&event_key=eq.${encodeURIComponent(eventKey)}&limit=1`
  );
  return rows.length > 0;
}

export async function recordSentEvent(userId: string, event: PushAlertEvent, sentCount: number) {
  await supabaseAdminRest("push_alert_events", {
    method: "POST",
    body: {
      user_id: userId,
      market: event.market,
      rule_id: event.ruleId,
      event_key: event.eventKey,
      title: event.title,
      body: event.body,
      payload: {
        ...event.data,
        sentCount
      }
    }
  });
}
