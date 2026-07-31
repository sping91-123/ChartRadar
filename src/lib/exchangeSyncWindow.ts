import type { ActiveExchangeProvider } from "./exchangeJournal";

const overlapMs = 10 * 60 * 1000;
const minimumRetryWindowMs = 1;

export interface ExchangeSyncWindowConnection {
  provider: ActiveExchangeProvider;
  first_sync_from: string;
}

export interface ExchangeSyncWindowCheckpoint {
  cursor: Record<string, unknown>;
  watermark: string;
}

type ResumePhase = "backfill" | "incremental";

interface RetryWindow {
  floor: string;
  spanMs: number;
  targetWatermark: string;
  resumePhase: ResumePhase;
  resumeBackfillBefore: string | null;
}

export interface ExchangeSyncWindow {
  since: string;
  until: string;
  phase: "initial" | "backfill" | "incremental" | "retry";
  watermark: string;
  retry?: RetryWindow;
}

function providerWindowDays(provider: ActiveExchangeProvider) {
  if (provider === "bitget") return 30;
  return 7;
}

function validCursorTime(value: unknown) {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function validWindowMs(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= minimumRetryWindowMs ? Math.floor(parsed) : null;
}

export function buildSyncWindow(
  connection: ExchangeSyncWindowConnection,
  checkpoint: ExchangeSyncWindowCheckpoint | null
): ExchangeSyncWindow {
  const now = Date.now();
  const firstSync = Date.parse(connection.first_sync_from);
  const windowMs = providerWindowDays(connection.provider) * 24 * 60 * 60 * 1000;
  const retryUntil = validCursorTime(checkpoint?.cursor?.retryUntil);
  const retryFloor = validCursorTime(checkpoint?.cursor?.retryFloor);
  const retrySpanMs = validWindowMs(checkpoint?.cursor?.retrySpanMs);
  const retryTargetWatermark = validCursorTime(checkpoint?.cursor?.retryTargetWatermark);
  const retryResumePhase = checkpoint?.cursor?.retryResumePhase === "incremental"
    ? "incremental"
    : checkpoint?.cursor?.retryResumePhase === "backfill"
      ? "backfill"
      : null;
  if (
    retryUntil &&
    retryFloor &&
    retrySpanMs &&
    retryTargetWatermark &&
    retryResumePhase &&
    Date.parse(retryUntil) > Date.parse(retryFloor)
  ) {
    const until = Date.parse(retryUntil);
    const since = Math.max(Date.parse(retryFloor), until - retrySpanMs);
    return {
      since: new Date(since).toISOString(),
      until: new Date(until).toISOString(),
      phase: "retry",
      watermark: retryTargetWatermark,
      retry: {
        floor: retryFloor,
        spanMs: retrySpanMs,
        targetWatermark: retryTargetWatermark,
        resumePhase: retryResumePhase,
        resumeBackfillBefore: validCursorTime(checkpoint?.cursor?.retryResumeBackfillBefore)
      }
    };
  }
  const backfillBefore = validCursorTime(checkpoint?.cursor?.backfillBefore);
  if (backfillBefore && Date.parse(backfillBefore) > firstSync) {
    const until = Date.parse(backfillBefore);
    const since = Math.max(firstSync, until - windowMs);
    return {
      since: new Date(since).toISOString(),
      until: new Date(until).toISOString(),
      phase: "backfill",
      watermark: checkpoint?.watermark ?? new Date(now).toISOString()
    };
  }
  if (checkpoint) {
    return {
      since: new Date(Math.max(firstSync, Date.parse(checkpoint.watermark) - overlapMs)).toISOString(),
      until: new Date(now).toISOString(),
      phase: "incremental",
      watermark: new Date(now).toISOString()
    };
  }
  const since = Math.max(firstSync, now - windowMs);
  return {
    since: new Date(since).toISOString(),
    until: new Date(now).toISOString(),
    phase: "initial",
    watermark: new Date(now).toISOString()
  };
}
