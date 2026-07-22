// 매크로 공식 소스 확인 결과를 캐시 저장소와 API 응답에 맞게 동기화합니다.
import { getMacroCalendarPayload } from "@/lib/macroCalendar";
import { writeMacroSyncRun, writeStoredMacroCalendarPayload } from "@/lib/macro/server/macroStore";

export async function runMacroSync() {
  const startedAt = new Date().toISOString();
  const payload = await getMacroCalendarPayload({ bypassCache: true });
  const isFallback = payload.cacheMode === "fallback";
  const storeResult = isFallback
    ? { stored: false, updatedCount: 0, reason: "공식·공개 일정 수집 실패로 마지막 정상 원장을 유지합니다." }
    : await writeStoredMacroCalendarPayload(payload).catch((error) => ({
        stored: false,
        updatedCount: 0,
        reason: error instanceof Error && /macro_events|schema cache|PGRST/i.test(error.message) ? "macro_events 테이블 적용이 필요합니다." : "매크로 일정 저장 실패"
      }));
  const finishedAt = new Date().toISOString();
  const status = isFallback ? "degraded" : storeResult.stored ? "stored" : "checked";
  await writeMacroSyncRun({
    source: payload.source,
    startedAt,
    finishedAt,
    status,
    fetchedCount: payload.items.length,
    updatedCount: storeResult.updatedCount,
    error: storeResult.stored ? undefined : storeResult.reason
  });

  return {
    startedAt,
    finishedAt,
    status,
    fetchedCount: payload.items.length,
    updatedCount: storeResult.updatedCount,
    nextRefreshMs: payload.nextRefreshMs,
    source: payload.source,
    warning: payload.warning,
    storage: storeResult
  };
}
