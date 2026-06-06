export type OnchainNetwork = "btc";
export type OnchainPulseGrade = "calm" | "normal" | "busy" | "hot";

export interface MempoolFeesResponse {
  fastestFee?: number;
  halfHourFee?: number;
  hourFee?: number;
  economyFee?: number;
  minimumFee?: number;
}

export interface MempoolStatsResponse {
  count?: number;
  vsize?: number;
  total_fee?: number;
}

export interface DifficultyAdjustmentResponse {
  progressPercent?: number;
  difficultyChange?: number;
  estimatedRetargetDate?: number;
  remainingBlocks?: number;
}

export interface OnchainMetricReport {
  network: OnchainNetwork;
  fastestFeeSatVb: number;
  halfHourFeeSatVb: number;
  hourFeeSatVb: number;
  mempoolTxCount: number;
  mempoolVsizeVb: number;
  mempoolVsizeMb: number;
  difficultyChangePercent: number | null;
  remainingBlocks: number | null;
  estimatedRetargetAt: string | null;
  grade: OnchainPulseGrade;
  pressureScore: number;
  summary: string;
  trigger: string;
  updatedAt: number;
  source: "mempool-space";
}

function toNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function toNullableNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function formatCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1_000)}K`;
  return value.toLocaleString("en-US");
}

function toIsoFromEpoch(value: number | null) {
  if (value === null || value <= 0) return null;
  const millis = value > 1_000_000_000_000 ? value : value * 1000;
  const date = new Date(millis);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function gradeFor(score: number): OnchainPulseGrade {
  if (score >= 70) return "hot";
  if (score >= 48) return "busy";
  if (score >= 26) return "normal";
  return "calm";
}

function scoreFor(fastestFeeSatVb: number, mempoolVsizeMb: number, difficultyChangePercent: number | null) {
  const feeScore = fastestFeeSatVb >= 80 ? 42 : fastestFeeSatVb >= 30 ? 32 : fastestFeeSatVb >= 10 ? 20 : fastestFeeSatVb >= 3 ? 10 : 4;
  const mempoolScore = mempoolVsizeMb >= 300 ? 38 : mempoolVsizeMb >= 150 ? 30 : mempoolVsizeMb >= 75 ? 20 : mempoolVsizeMb >= 25 ? 12 : 4;
  const difficultyScore = difficultyChangePercent === null ? 0 : Math.abs(difficultyChangePercent) >= 5 ? 12 : Math.abs(difficultyChangePercent) >= 2 ? 8 : 3;
  return Math.min(100, Math.round(feeScore + mempoolScore + difficultyScore));
}

function triggerFor(fastestFeeSatVb: number, mempoolVsizeMb: number, difficultyChangePercent: number | null) {
  if (fastestFeeSatVb >= 30) return "수수료 상승";
  if (mempoolVsizeMb >= 150) return "대기 거래 많음";
  if (difficultyChangePercent !== null && difficultyChangePercent >= 3) return "난이도 상승 예상";
  if (difficultyChangePercent !== null && difficultyChangePercent <= -3) return "난이도 하락 예상";
  return "네트워크 차분";
}

export function buildBitcoinOnchainMetricReport(
  fees: MempoolFeesResponse,
  mempool: MempoolStatsResponse,
  difficulty: DifficultyAdjustmentResponse,
  updatedAt = Date.now()
): OnchainMetricReport {
  const fastestFeeSatVb = toNumber(fees.fastestFee);
  const halfHourFeeSatVb = toNumber(fees.halfHourFee);
  const hourFeeSatVb = toNumber(fees.hourFee);
  const mempoolTxCount = toNumber(mempool.count);
  const mempoolVsizeVb = toNumber(mempool.vsize);
  const mempoolVsizeMb = mempoolVsizeVb / 1_000_000;
  const difficultyChangePercent = toNullableNumber(difficulty.difficultyChange);
  const remainingBlocks = toNullableNumber(difficulty.remainingBlocks);
  const pressureScore = scoreFor(fastestFeeSatVb, mempoolVsizeMb, difficultyChangePercent);

  return {
    network: "btc",
    fastestFeeSatVb,
    halfHourFeeSatVb,
    hourFeeSatVb,
    mempoolTxCount,
    mempoolVsizeVb,
    mempoolVsizeMb,
    difficultyChangePercent,
    remainingBlocks,
    estimatedRetargetAt: toIsoFromEpoch(toNullableNumber(difficulty.estimatedRetargetDate)),
    grade: gradeFor(pressureScore),
    pressureScore,
    summary: `수수료 ${fastestFeeSatVb} sat/vB · 대기 ${formatCount(mempoolTxCount)}건`,
    trigger: triggerFor(fastestFeeSatVb, mempoolVsizeMb, difficultyChangePercent),
    updatedAt,
    source: "mempool-space"
  };
}
