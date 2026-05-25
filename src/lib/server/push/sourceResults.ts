// 푸시 optional source 실행 결과를 표준 형태로 감싼다.
import type { OptionalEventSourceResult, PushAlertEvent } from "@/lib/server/push/types";

export async function scanOptionalEventSource(label: string, scan: () => Promise<PushAlertEvent | null>): Promise<OptionalEventSourceResult> {
  try {
    return {
      label,
      event: await scan(),
      warning: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[push-cron] optional event source failed: ${label}`, error);
    return {
      label,
      event: null,
      warning: `${label}: ${message.slice(0, 180)}`
    };
  }
}
