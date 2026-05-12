// 진입 전 리스크 점수와 적정 포지션 크기를 계산한다.
import type {
  DiagnosisFormValues,
  DiagnosisResult,
  PositionSizing,
  Verdict
} from "@/types";

function toNumber(value: string): number | null {
  const normalized = value.replaceAll(",", "").trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getRiskPercent(values: DiagnosisFormValues): number | null {
  return values.riskPercentPreset === "직접입력"
    ? toNumber(values.customRiskPercent)
    : toNumber(values.riskPercentPreset);
}

function getVerdict(riskScore: number): Verdict {
  if (riskScore >= 75) return "진입 금지";
  if (riskScore >= 45) return "관찰 필요";
  return "검토 가능";
}

function getAdvice(verdict: Verdict): string {
  if (verdict === "진입 금지") {
    return "지금은 기회를 찾기보다 손실 가능성을 먼저 줄여야 하는 자리입니다. 손절 기준, 상위 추세, 진입 위치가 다시 정리되기 전까지는 무리하게 들어가지 않는 편이 좋습니다.";
  }

  if (verdict === "관찰 필요") {
    return "완전히 나쁜 자리는 아니지만 바로 진입하기에는 흔들릴 수 있는 요소가 남아 있습니다. 손절 위치와 포지션 크기를 먼저 줄이고, 한 번 더 구조를 확인해 보세요.";
  }

  return "기본적인 위험 요소는 비교적 관리되고 있습니다. 다만 진입 자체보다 손절 기준과 포지션 크기를 끝까지 지키는 쪽에 집중해 주세요.";
}

function getLeverageWarning(leverage: number | null): string {
  if (leverage === null) {
    return "레버리지를 입력하면 과도한 배율인지 함께 확인할 수 있습니다.";
  }

  if (leverage >= 10) {
    return "레버리지가 높습니다. 작은 변동에도 계획이 무너질 수 있으니 손절폭과 포지션 크기를 보수적으로 줄이는 편이 좋습니다.";
  }

  if (leverage >= 5) {
    return "레버리지가 다소 높습니다. 손절가와 허용 손실 금액을 반드시 같이 확인해 주세요.";
  }

  return "레버리지는 비교적 안정적인 편입니다. 그래도 손절 기준은 반드시 필요합니다.";
}

function isStopLossDirectionValid(
  direction: DiagnosisFormValues["direction"],
  entryPrice: number | null,
  stopLossPrice: number | null
) {
  if (!entryPrice || !stopLossPrice) return true;
  return direction === "롱" ? stopLossPrice < entryPrice : stopLossPrice > entryPrice;
}

function calculatePositionSizing(values: DiagnosisFormValues): PositionSizing | null {
  if (values.stopLossStatus !== "있음") return null;

  const entryPrice = toNumber(values.entryPrice);
  const stopLossPrice = toNumber(values.stopLossPrice);
  const totalSeed = toNumber(values.totalSeed);
  const riskPercent = getRiskPercent(values);
  const leverage = toNumber(values.leverage);

  if (!entryPrice || !stopLossPrice || !totalSeed || !riskPercent || !leverage) return null;
  if (!isStopLossDirectionValid(values.direction, entryPrice, stopLossPrice)) return null;

  const priceGapRate = Math.abs(entryPrice - stopLossPrice) / entryPrice;
  if (priceGapRate <= 0) return null;

  const allowedLossAmount = (totalSeed * riskPercent) / 100;
  const positionNotional = allowedLossAmount / priceGapRate;
  const requiredMargin = positionNotional / leverage;

  return {
    allowedLossAmount,
    positionNotional,
    requiredMargin,
    expectedLossOnStop: allowedLossAmount,
    seedLossRate: riskPercent,
    priceGapRate
  };
}

export function diagnoseTrade(values: DiagnosisFormValues): DiagnosisResult {
  let riskScore = 0;
  const violations: string[] = [];
  const leverage = toNumber(values.leverage);
  const riskPercent = getRiskPercent(values);
  const needsStopLossPrice = values.stopLossStatus === "있음";
  const entryPrice = toNumber(values.entryPrice);
  const stopLossPrice = toNumber(values.stopLossPrice);

  const missingRequiredValues =
    !entryPrice ||
    (needsStopLossPrice && !stopLossPrice) ||
    !toNumber(values.totalSeed) ||
    !riskPercent ||
    !leverage;

  if (values.stopLossStatus === "없음") {
    riskScore += 30;
    violations.push("손절 기준 없음");
  }

  if (leverage !== null && leverage >= 10) {
    riskScore += 22;
    violations.push("고배율 위험");
  } else if (leverage !== null && leverage >= 5) {
    riskScore += 10;
  }

  if (values.currentLocation === "고점 추격") {
    riskScore += 22;
    violations.push("고점 추격 위험");
  }

  if (values.currentLocation === "저점 추격") {
    riskScore += 22;
    violations.push("저점 추격 위험");
  }

  if (values.currentLocation === "중간값") {
    riskScore += 10;
    violations.push("애매한 자리");
  }

  if (values.higherTrend === "모르겠음") {
    riskScore += 15;
    violations.push("상위 추세 미확인");
  }

  if (values.direction === "롱" && values.higherTrend === "하락") {
    riskScore += 15;
    violations.push("상위 추세 역행 롱");
  }

  if (values.direction === "숏" && values.higherTrend === "상승") {
    riskScore += 15;
    violations.push("상위 추세 역행 숏");
  }

  if (missingRequiredValues) {
    riskScore += 10;
    violations.push("필수 값 부족");
  }

  if (needsStopLossPrice && !isStopLossDirectionValid(values.direction, entryPrice, stopLossPrice)) {
    riskScore += 25;
    violations.push(values.direction === "롱" ? "롱 기준 손절가가 진입가보다 높음" : "숏 기준 손절가가 진입가보다 낮음");
  }

  const cappedRiskScore = Math.min(riskScore, 100);
  const verdict = getVerdict(cappedRiskScore);

  return {
    riskScore: cappedRiskScore,
    verdict,
    violations: Array.from(new Set(violations)),
    advice: getAdvice(verdict),
    leverageWarning: getLeverageWarning(leverage),
    positionSizing: calculatePositionSizing(values),
    missingRequiredValues
  };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 2
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 2
  }).format(value)}%`;
}
