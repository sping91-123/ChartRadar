import { sendFcmMessage } from "@/lib/server/firebaseMessaging";
import { alreadySent, recordSentEvent } from "@/lib/server/push/duplicateGuard";
import { tokenWants } from "@/lib/server/push/preferences";
import type { PushAlertEvent, PushTokenRow } from "@/lib/server/push/types";

export async function sendEventToUser(userId: string, tokens: PushTokenRow[], event: PushAlertEvent) {
  const targetTokens = tokens.filter((token) => tokenWants(token, event));
  const preferenceSkipped = Math.max(0, tokens.length - targetTokens.length);
  if (targetTokens.length === 0) {
    return { sent: 0, skipped: 0, failed: 0, preferenceSkipped, duplicateSkipped: 0, targetTokens: 0 };
  }
  if (await alreadySent(userId, event.eventKey)) {
    return {
      sent: 0,
      skipped: targetTokens.length,
      failed: 0,
      preferenceSkipped,
      duplicateSkipped: targetTokens.length,
      targetTokens: targetTokens.length
    };
  }

  const results = await Promise.allSettled(
    targetTokens.map((token) =>
      sendFcmMessage({
        token: token.token,
        title: event.title,
        body: event.body,
        data: event.data
      })
    )
  );
  const sent = results.filter((result) => result.status === "fulfilled").length;
  const failed = results.length - sent;
  if (sent > 0) await recordSentEvent(userId, event, sent);
  return { sent, skipped: 0, failed, preferenceSkipped, duplicateSkipped: 0, targetTokens: targetTokens.length };
}
