import type { DirectionState, MarketRegime } from "@/lib/marketAnalysis";
import type { LargeTradeSide } from "@/lib/largeTradeFlow";
import type { LiquidationPressureSide } from "@/lib/liquidationPressure";
import type { DecisionState, MonitorCondition, SnapshotQuality } from "@/lib/perpetualDecisionSnapshot";

export function plainDirection(direction: DirectionState) {
  if (direction === "bullish") return "위쪽";
  if (direction === "bearish") return "아래쪽";
  if (direction === "neutral") return "뚜렷하지 않음";
  return "확인 중";
}

export function structureExplanation(direction: DirectionState) {
  if (direction === "bullish") return "확정된 상승 구조 안에서 중요한 고점을 다시 넘어 흐름이 이어지고 있어요.";
  if (direction === "bearish") return "확정된 하락 구조 안에서 중요한 저점을 다시 내려가 흐름이 이어지고 있어요.";
  if (direction === "neutral") return "확정 구조를 이어갈 추가 돌파는 아직 뚜렷하지 않아요.";
  return "추세 지속 신호를 판단할 데이터가 아직 충분하지 않아요.";
}

export function confirmedStructureExplanation(direction: DirectionState) {
  if (direction === "bullish") return "강한 종가 돌파가 품질 조건을 통과해 상승 구조로 확정됐어요.";
  if (direction === "bearish") return "강한 종가 돌파가 품질 조건을 통과해 하락 구조로 확정됐어요.";
  return "강한 종가 돌파가 확인되기 전이라 구조 방향을 정하지 않아요.";
}

export function transitionExplanation(direction: DirectionState) {
  if (direction === "bullish") return "내리던 흐름이 위쪽으로 바뀔 가능성이 나타났어요.";
  if (direction === "bearish") return "오르던 흐름이 아래쪽으로 바뀔 가능성이 나타났어요.";
  if (direction === "neutral") return "기존 흐름을 바꿀 만한 신호는 아직 뚜렷하지 않아요.";
  return "방향 전환 신호를 확인하는 중이에요.";
}

export function regimeLabel(regime: MarketRegime) {
  if (regime === "trendUp") return "오르는 추세";
  if (regime === "trendDown") return "내리는 추세";
  if (regime === "range") return "횡보 구간";
  if (regime === "compression") return "움직임 축소";
  if (regime === "expansion") return "움직임 확대";
  if (regime === "mixed") return "신호 혼재";
  return "확인 중";
}

export function pressureDirectionLabel(side: LiquidationPressureSide) {
  if (side === "upsideShorts") return "가격이 오르면 숏(하락에 건 포지션) 청산이 커질 수 있음";
  if (side === "downsideLongs") return "가격이 내리면 롱(상승에 건 포지션) 청산이 커질 수 있음";
  return "롱·숏 쏠림이 비슷함";
}

export function flowDirectionLabel(side: LargeTradeSide) {
  if (side === "buy") return "큰 금액 매수가 더 많음";
  if (side === "sell") return "큰 금액 매도가 더 많음";
  return "큰 금액 매수·매도가 비슷함";
}

export function decisionStateLabel(state: DecisionState) {
  if (state === "upside_watch") return "오르는 힘 우세";
  if (state === "downside_watch") return "내리는 힘 우세";
  if (state === "risk") return "신호 엇갈림";
  return "방향 대기";
}

export function qualityLabel(quality: SnapshotQuality) {
  if (quality === "ready") return "분석 가능";
  if (quality === "partial") return "일부 데이터 부족";
  if (quality === "stale") return "업데이트 지연";
  return "데이터 확인 필요";
}

export function monitorConditionHeading(condition: MonitorCondition) {
  void condition;
  return "다음에 확인할 것";
}

const conditionTimeframeCopy: Record<MonitorCondition["timeframe"], string> = {
  "15m": "15분",
  "1h": "1시간",
  "4h": "4시간"
};

export function plainConditionBasis(basis: string | undefined) {
  if (!basis) return "저장된 가격 기준";
  return basis
    .replace(/확정 구조\(MSS\) 돌파선/g, "새 추세 확인선 (MSS)")
    .replace(/추세 지속\(MSB\) 돌파선/g, "현재 추세 지속선 (MSB)")
    .replace(/전환 경고\(CHoCH\) 돌파선/g, "반대 방향 전환 주의선 (CHoCH)")
    .replace(/위쪽 유동성 가격/g, "이전 고점 주변 반응 가격")
    .replace(/아래쪽 유동성 가격/g, "이전 저점 주변 반응 가격")
    .replace(/최근 구조 돌파선/g, "최근 중요 가격 돌파선")
    .replace(/최근 전환 돌파선/g, "최근 반대 방향 움직임 기준선");
}

export function monitorConditionDisplayLabel(condition: MonitorCondition) {
  const isPriceCondition = condition.kind === "price_cross_above" || condition.kind === "price_cross_below";
  if (isPriceCondition && typeof condition.threshold === "number" && Number.isFinite(condition.threshold)) {
    const price = condition.threshold.toLocaleString("ko-KR", { maximumFractionDigits: condition.id.includes(":user-price:") ? 8 : 4 });
    const side = condition.kind === "price_cross_above" ? "이상으로" : "이하로";
    return `${conditionTimeframeCopy[condition.timeframe]}봉이 ${price} ${side} 마감하는지 확인`;
  }
  return condition.label
    .replace(/확인(?:할)?\s+가격/g, "다음에 확인할 것")
    .replace(/다음\s+확인\s+조건/g, "다음에 확인할 것");
}

export function monitorAlertCopy(condition: MonitorCondition) {
  if ((condition.kind === "price_cross_above" || condition.kind === "price_cross_below") &&
      typeof condition.threshold === "number" && Number.isFinite(condition.threshold)) {
    const price = condition.threshold.toLocaleString("ko-KR", { maximumFractionDigits: condition.id.includes(":user-price:") ? 8 : 4 });
    const side = condition.kind === "price_cross_above" ? "이상으로" : "이하로";
    const closing = `${conditionTimeframeCopy[condition.timeframe]}봉이 ${price} ${side} 마감하면`;
    return {
      trigger: `${closing} 알려드립니다.`,
      action: `${closing} 알림 받기`,
      waiting: "가격이 잠깐 닿는 것만으로는 알리지 않습니다."
    };
  }
  if (condition.kind === "decision_state_change") {
    // Match the evaluator: without an explicit target, only a new directional state triggers.
    const target = condition.targetState ?? (condition.baselineState === "upside_watch" ? "downside_watch"
      : condition.baselineState === "downside_watch" ? "upside_watch" : null);
    return {
      trigger: target ? `종합 판단이 ‘${decisionStateLabel(target)}’로 바뀌면 알려드립니다.`
        : "종합 판단이 ‘오르는 힘 우세’ 또는 ‘내리는 힘 우세’가 되면 알려드립니다.",
      action: target ? `${decisionStateLabel(target)}로 바뀌면 알림 받기` : "방향이 뚜렷해지면 알림 받기",
      waiting: condition.targetState ? "지정한 판단이 될 때까지 기다립니다."
        : "‘신호 엇갈림’이나 ‘방향 대기’로 바뀌는 것만으로는 알리지 않습니다."
    };
  }
  const pressureLabels = { upsideShorts: "숏 청산 압력 우세", downsideLongs: "롱 청산 압력 우세", balanced: "롱·숏 압력 균형" };
  return {
    trigger: condition.targetPressure ? `청산 압력이 ‘${pressureLabels[condition.targetPressure]}’ 상태가 되면 알려드립니다.`
      : `청산 압력의 쏠림이 저장 당시${condition.baselinePressure ? ` ‘${pressureLabels[condition.baselinePressure]}’` : ""}와 달라지면 알려드립니다.`,
    action: "청산 압력 조건을 충족하면 알림 받기",
    waiting: "청산 압력은 가격이 움직일 때 강제 정리가 몰릴 수 있는 방향입니다."
  };
}

export function monitorAlertExpiry(expiresAt: string) {
  const date = new Date(expiresAt);
  return Number.isFinite(date.getTime())
    ? `${new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(date)} KST까지`
    : "감시 종료 시각 확인 필요";
}

export function monitorConditionOutcomeCopy(condition: MonitorCondition) {
  const threshold = condition.threshold;
  const isPriceCondition =
    (condition.kind === "price_cross_above" || condition.kind === "price_cross_below") &&
    typeof threshold === "number" &&
    Number.isFinite(threshold);
  if (isPriceCondition) {
    const price = threshold.toLocaleString("ko-KR", { maximumFractionDigits: 4 });
    const side = condition.kind === "price_cross_above" ? "이상으로" : "이하로";
    const direction = condition.kind === "price_cross_above" ? "오르는" : "내리는";
    return {
      met: condition.role === "invalidation"
        ? `${price} ${side} 마감하면 → 현재 해석을 유지하지 않고 최신 분석으로 다시 판단합니다.`
        : `${price} ${side} 마감하면 → ${direction} 근거가 계속되는지 최신 분석으로 다시 확인합니다.`,
      unmet: monitorAlertCopy(condition).waiting,
      note: `전문 기준 · ${plainConditionBasis(condition.basis)} · 봉 마감 기준 · 자동 주문 아님`
    };
  }
  return {
    met: "조건 확인 후 → 당시 근거와 남은 위험을 확인해 다시 판단합니다.",
    unmet: monitorAlertCopy(condition).waiting,
    note: "상태가 바뀌어도 자동 주문이나 진입 지시로 사용하지 않습니다."
  };
}

export const perpetualTermCopy = {
  mss: {
    easyLabel: "새 추세 확인",
    technicalLabel: "MSS",
    description: "중요한 가격을 강한 종가로 넘어 새 방향이 확인된 상태입니다."
  },
  msb: {
    easyLabel: "현재 추세 지속 확인",
    technicalLabel: "MSB",
    description: "새 추세가 확인된 뒤 같은 방향의 중요 가격을 한 번 더 넘어선 상태입니다."
  },
  choch: {
    easyLabel: "반대 방향 전환 주의",
    technicalLabel: "CHoCH",
    description: "기존 흐름의 반대 움직임이 나타난 초기 경고이며, 전환 확정은 아닙니다."
  },
  ob: {
    easyLabel: "강한 움직임이 시작된 가격대",
    technicalLabel: "OB",
    description: "과거에 강한 움직임이 시작된 곳으로, 다시 반응할 수 있는 후보 가격대입니다. 실제 주문 잔량을 뜻하지는 않습니다."
  },
  fvg: {
    easyLabel: "가격이 빠르게 지나간 구간",
    technicalLabel: "FVG",
    description: "거래가 성기게 지나간 곳으로, 되돌림 때 반응할 수 있지만 반드시 채워지는 것은 아닙니다."
  },
  sweep: {
    easyLabel: "고점·저점을 잠깐 넘었다가 돌아온 움직임",
    technicalLabel: "Sweep",
    description: "이전 고점이나 저점을 잠깐 벗어난 뒤 다시 범위 안으로 돌아온 움직임입니다."
  },
  cisd: {
    easyLabel: "단기 매수·매도 주도권 변화",
    technicalLabel: "CISD",
    description: "짧은 흐름에서 매수와 매도 중 우세한 쪽이 바뀐 보조 근거입니다."
  },
  poc: {
    easyLabel: "선택 구간에서 거래가 가장 많이 쌓인 가격",
    technicalLabel: "POC",
    description: "선택한 시간대와 계산 범위 안에서 거래량이 가장 많이 모인 가격입니다."
  },
  pd: {
    easyLabel: "최근 가격 범위에서 현재 위치",
    technicalLabel: "PD",
    description: "현재 가격이 최근 범위의 위쪽·가운데·아래쪽 중 어디에 있는지 보여줍니다."
  },
  ote: {
    easyLabel: "되돌림 반응 후보 구간",
    technicalLabel: "OTE",
    description: "최근 가격 범위로 계산한 되돌림 후보이며, 진입 지시가 아닙니다."
  }
} as const;

export type PerpetualBeginnerTerm = keyof typeof perpetualTermCopy;

export function beginnerTerm(term: PerpetualBeginnerTerm) {
  const copy = perpetualTermCopy[term];
  return `${copy.easyLabel} (${copy.technicalLabel})`;
}

export function legacyStructureTerm(kind: "msb" | "choch") {
  return kind === "msb" ? "저장 당시 가격 구조 (MSB)" : "저장 당시 전환 신호 (CHoCH)";
}

export function plainDecisionText(value: string) {
  return value
    .replace(/다음 판단 기준/g, "다음에 확인할 조건")
    .replace(/여러 시간대 구조/g, "여러 시간대 가격 흐름")
    .replace(/시간대 구조/g, "시간대 방향")
    .replace(/현재 구조가/g, "현재 방향이")
    .replace(/현재 구조와/g, "현재 방향과")
    .replace(/현재 구조를/g, "현재 방향을")
    .replace(/현재 구조/g, "현재 방향")
    .replace(/CHoCH 전환 경고가/g, "반대 방향으로 바뀔 가능성이")
    .replace(/확정 구조\(MSS\)가/g, "확인된 가격 흐름이")
    .replace(/확정 구조\(MSS\)를/g, "확인된 가격 흐름을")
    .replace(/확정 구조\(MSS\)/g, "확인된 가격 흐름")
    .replace(/확정 구조와/g, "확인된 가격 흐름과")
    .replace(/확정 구조가/g, "확인된 가격 흐름이")
    .replace(/확정 구조를/g, "확인된 가격 흐름을")
    .replace(/확정 구조/g, "확인된 가격 흐름");
}
