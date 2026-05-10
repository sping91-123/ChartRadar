// Chart Radar의 일일 사용량 기준과 브라우저 저장 로직을 관리한다.
export type UsageBucketId = "radarScan" | "aiBriefing" | "watchlistScan" | "stockRadar" | "alertRule";

export interface UsageBucket {
  id: UsageBucketId;
  label: string;
  shortLabel: string;
  description: string;
  freeDailyLimit: number;
  proDailyLimit: number;
}

export interface UsageSnapshot {
  dateKey: string;
  counts: Partial<Record<UsageBucketId, number>>;
}

export interface UsageBucketState extends UsageBucket {
  used: number;
  freeRemaining: number;
  freePercent: number;
  isOverFree: boolean;
}

const STORAGE_KEY = "chart-radar.usage.v1";
export const USAGE_CHANGED_EVENT = "chart-radar:usage";

export const usageBuckets: UsageBucket[] = [
  {
    id: "radarScan",
    label: "코인 레이더",
    shortLabel: "레이더",
    description: "BTC, ETH, 알트 구조와 시장 감지를 불러온 횟수입니다.",
    freeDailyLimit: 10,
    proDailyLimit: 200
  },
  {
    id: "aiBriefing",
    label: "AI 브리핑",
    shortLabel: "AI",
    description: "뉴스와 시장 흐름을 AI로 정리한 횟수입니다.",
    freeDailyLimit: 2,
    proDailyLimit: 30
  },
  {
    id: "watchlistScan",
    label: "관심종목 감시",
    shortLabel: "관심",
    description: "관심 코인 레이더를 갱신한 횟수입니다.",
    freeDailyLimit: 5,
    proDailyLimit: 100
  },
  {
    id: "stockRadar",
    label: "해외주식 레이더",
    shortLabel: "주식",
    description: "미국 주식과 ETF 레이더를 불러온 횟수입니다.",
    freeDailyLimit: 5,
    proDailyLimit: 100
  },
  {
    id: "alertRule",
    label: "알림 설정",
    shortLabel: "알림",
    description: "레이더 알림 조건을 설정하거나 테스트한 횟수입니다.",
    freeDailyLimit: 1,
    proDailyLimit: 20
  }
];

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function emptySnapshot(): UsageSnapshot {
  return { dateKey: getLocalDateKey(), counts: {} };
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readUsageSnapshot(): UsageSnapshot {
  if (!canUseStorage()) return emptySnapshot();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptySnapshot();

    const parsed = JSON.parse(raw) as UsageSnapshot;
    if (parsed.dateKey !== getLocalDateKey()) return emptySnapshot();
    if (!parsed.counts || typeof parsed.counts !== "object") return emptySnapshot();

    return parsed;
  } catch {
    return emptySnapshot();
  }
}

export function writeUsageSnapshot(snapshot: UsageSnapshot) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  window.dispatchEvent(new CustomEvent(USAGE_CHANGED_EVENT));
}

export function recordUsageEvent(bucketId: UsageBucketId, amount = 1) {
  const snapshot = readUsageSnapshot();
  const current = snapshot.counts[bucketId] ?? 0;
  const next: UsageSnapshot = {
    dateKey: snapshot.dateKey,
    counts: {
      ...snapshot.counts,
      [bucketId]: Math.max(0, current + amount)
    }
  };
  writeUsageSnapshot(next);
  return next;
}

export function resetUsageSnapshot() {
  const snapshot = emptySnapshot();
  writeUsageSnapshot(snapshot);
  return snapshot;
}

export function getUsageBucketStates(snapshot: UsageSnapshot): UsageBucketState[] {
  return usageBuckets.map((bucket) => {
    const used = snapshot.counts[bucket.id] ?? 0;
    const freeRemaining = Math.max(0, bucket.freeDailyLimit - used);
    const freePercent = Math.min(100, Math.round((used / bucket.freeDailyLimit) * 100));

    return {
      ...bucket,
      used,
      freeRemaining,
      freePercent,
      isOverFree: used >= bucket.freeDailyLimit
    };
  });
}

export function summarizeUsage(snapshot: UsageSnapshot) {
  const states = getUsageBucketStates(snapshot);
  const usedTotal = states.reduce((sum, state) => sum + state.used, 0);
  const overCount = states.filter((state) => state.isOverFree).length;
  const closest = [...states].sort((a, b) => b.freePercent - a.freePercent)[0] ?? null;

  return {
    states,
    usedTotal,
    overCount,
    closest
  };
}
