import type { DirectionState, MarketRegime } from "@/lib/marketAnalysis";
import type { LargeTradeSide } from "@/lib/largeTradeFlow";
import type { LiquidationPressureSide } from "@/lib/liquidationPressure";
import type { DecisionState, SnapshotQuality } from "@/lib/perpetualDecisionSnapshot";

export function plainDirection(direction: DirectionState) {
  if (direction === "bullish") return "위쪽";
  if (direction === "bearish") return "아래쪽";
  if (direction === "neutral") return "뚜렷하지 않음";
  return "확인 중";
}

export function structureExplanation(direction: DirectionState) {
  if (direction === "bullish") return "최근 중요한 고점을 넘어 오르는 흐름이 이어지고 있어요.";
  if (direction === "bearish") return "최근 중요한 저점을 내려가 내리는 흐름이 이어지고 있어요.";
  if (direction === "neutral") return "최근 고점과 저점 사이에 있어 한쪽 방향이 뚜렷하지 않아요.";
  return "추세 방향을 판단할 데이터가 아직 충분하지 않아요.";
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

export function beginnerTerm(term: "msb" | "choch" | "ob" | "fvg" | "sweep" | "cisd" | "poc" | "pd") {
  const labels = {
    msb: "추세 방향 확인 (MSB)",
    choch: "추세 전환 가능성 (CHoCH)",
    ob: "큰 주문이 반응했던 구간 (OB)",
    fvg: "가격이 빠르게 지나간 구간 (FVG)",
    sweep: "고점·저점을 잠깐 넘긴 흔들기 (Sweep)",
    cisd: "매수·매도 주도권 변화 (CISD)",
    poc: "거래가 가장 많이 쌓인 가격 (POC)",
    pd: "최근 가격 범위에서의 현재 위치 (PD)"
  } as const;
  return labels[term];
}
