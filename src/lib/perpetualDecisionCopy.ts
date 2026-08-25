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
  return "다음 판단 기준";
}

export function monitorConditionDisplayLabel(condition: MonitorCondition) {
  const isPriceCondition = condition.kind === "price_cross_above" || condition.kind === "price_cross_below";
  if (isPriceCondition && typeof condition.threshold === "number" && Number.isFinite(condition.threshold)) {
    const price = condition.threshold.toLocaleString("ko-KR", { maximumFractionDigits: 4 });
    const side = condition.kind === "price_cross_above" ? "위" : "아래";
    return `${condition.basis ?? "저장된 기준선"} ${price} ${side}에서 ${condition.timeframe}봉 마감`;
  }
  return condition.label
    .replace(/확인(?:할)?\s+가격/g, "다음 판단 기준")
    .replace(/다음\s+확인\s+조건/g, "다음 판단 기준");
}

export function monitorConditionOutcomeCopy(condition: MonitorCondition) {
  const isPriceCondition =
    (condition.kind === "price_cross_above" || condition.kind === "price_cross_below") &&
    typeof condition.threshold === "number" &&
    Number.isFinite(condition.threshold);
  if (isPriceCondition) {
    return {
      met: condition.role === "invalidation"
        ? "충족하면 · 현재 해석을 그대로 유지하지 않고 최신 분석에서 다시 판단합니다."
        : "충족하면 · 최신 분석을 불러와 현재 방향 근거가 유지되는지 다시 판단합니다.",
      unmet: "아직 아니면 · 현재 결론을 확정으로 보지 않고 가격을 따라가지 않습니다.",
      note: `${condition.basis ? `기준 출처 · ${condition.basis} · ` : ""}봉 마감 기준이며 자동 주문이나 진입 지시가 아닙니다.`
    };
  }
  if (condition.baselineState === "upside_watch" || condition.baselineState === "downside_watch") {
    return {
      met: "현재 방향 판단이 달라지면 · 최신 분석에서 새 근거와 위험을 다시 봅니다.",
      unmet: "방향 판단이 유지되면 · 기존 결론도 확정이나 진입 지시로 보지 않습니다.",
      note: "상태가 바뀌어도 자동 주문이나 진입 지시로 사용하지 않습니다."
    };
  }
  return {
    met: "근거가 한쪽으로 모이면 · 최신 분석에서 방향을 다시 판단합니다.",
    unmet: "계속 섞여 있으면 · 결론을 서두르지 않고 기다립니다.",
    note: "상태가 바뀌어도 자동 주문이나 진입 지시로 사용하지 않습니다."
  };
}

export function beginnerTerm(term: "mss" | "msb" | "choch" | "ob" | "fvg" | "sweep" | "cisd" | "poc" | "pd") {
  const labels = {
    mss: "확정 구조 추세 (MSS)",
    msb: "추세 지속 (MSB)",
    choch: "전환 경고 (CHoCH)",
    ob: "큰 주문이 반응했던 구간 (OB)",
    fvg: "가격이 빠르게 지나간 구간 (FVG)",
    sweep: "고점·저점을 잠깐 넘긴 흔들기 (Sweep)",
    cisd: "매수·매도 주도권 변화 (CISD)",
    poc: "거래가 가장 많이 쌓인 가격 (POC)",
    pd: "최근 가격 범위에서의 현재 위치 (PD)"
  } as const;
  return labels[term];
}
