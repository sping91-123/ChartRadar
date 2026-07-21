import type { PerpetualAsset, PerpetualDecisionSnapshot } from "@/lib/perpetualDecisionSnapshot";

const SNAPSHOT_REFRESH_MAX_DELAY_MS = 60_000;
const SNAPSHOT_REFRESH_RETRY_DELAY_MS = 15_000;
const SNAPSHOT_REFRESH_EXPIRY_BUFFER_MS = 500;
export const PERPETUAL_SNAPSHOT_REQUEST_TIMEOUT_MS = 12_000;

export function perpetualSnapshotRefreshDelay(expiresAt: string | null | undefined, now = Date.now()) {
  const expiry = Date.parse(expiresAt ?? "");
  if (!Number.isFinite(expiry)) return SNAPSHOT_REFRESH_RETRY_DELAY_MS;
  if (expiry <= now) return SNAPSHOT_REFRESH_RETRY_DELAY_MS;
  return Math.min(
    SNAPSHOT_REFRESH_MAX_DELAY_MS,
    Math.max(SNAPSHOT_REFRESH_EXPIRY_BUFFER_MS, expiry - now + SNAPSHOT_REFRESH_EXPIRY_BUFFER_MS)
  );
}

export function shouldContinuePerpetualSnapshotRefresh(
  expiresAt: string | null | undefined,
  preserveExpiredSnapshot: boolean,
  now = Date.now()
) {
  if (!preserveExpiredSnapshot) return true;
  const expiry = Date.parse(expiresAt ?? "");
  return !Number.isFinite(expiry) || expiry > now;
}

export function choosePersistedSnapshotWinner<T>(insertedRows: readonly T[], conflictRows: readonly T[]) {
  const winner = insertedRows[0] ?? conflictRows[0];
  if (!winner) throw new Error("Perpetual snapshot persistence returned no canonical bucket winner.");
  return winner;
}

export function canReuseRequestedPerpetualSnapshot({
  snapshot,
  asset,
  asOf,
  allowExpired = false
}: {
  snapshot: PerpetualDecisionSnapshot | null;
  asset: PerpetualAsset;
  asOf: Date;
  allowExpired?: boolean;
}) {
  return Boolean(
    snapshot &&
    snapshot.asset === asset &&
    (allowExpired || new Date(snapshot.expiresAt).getTime() > asOf.getTime())
  );
}

export function buildStalePerpetualDecisionFallback(snapshot: PerpetualDecisionSnapshot): PerpetualDecisionSnapshot {
  const fallback: PerpetualDecisionSnapshot = {
    ...snapshot,
    quality: "stale",
    summary: {
      state: "risk",
      headline: "최신 데이터 확인이 지연되어 방향 판단을 보류합니다.",
      topRisk: "마지막 정상 분석 이후 필수 데이터가 갱신되지 않았습니다.",
      reasons: [
        "이전 분석은 맥락 확인용이며 현재 방향 근거로 사용할 수 없습니다.",
        "캔들·청산 압력·대형 체결이 다시 정상화된 뒤 조건을 확인합니다."
      ],
      primaryCondition: {
        id: `${snapshot.engineVersion}:${snapshot.asset}:15m:primary:decision_state_change:stale`,
        kind: "decision_state_change",
        role: "primary",
        timeframe: "15m",
        label: "필수 데이터가 다시 정상화됐는지 확인",
        threshold: null,
        baselineState: "risk",
        expiresAt: snapshot.expiresAt
      }
    },
    sourceStatus: {
      candles: { ...snapshot.sourceStatus.candles, status: "stale", detail: "최신 갱신 실패로 마지막 정상 판단을 맥락용으로만 표시합니다." },
      pressure: { ...snapshot.sourceStatus.pressure, status: "stale", detail: "최신 갱신 실패로 마지막 청산 압력 관측값을 맥락용으로만 표시합니다." },
      flow: { ...snapshot.sourceStatus.flow, status: "stale", detail: "최신 갱신 실패로 마지막 대형 체결 관측값을 맥락용으로만 표시합니다." }
    }
  };
  if (fallback.pro) {
    fallback.pro = {
      ...fallback.pro,
      confirmationConditions: [],
      invalidationConditions: []
    };
  }
  return fallback;
}
