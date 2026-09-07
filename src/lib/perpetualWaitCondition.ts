import type { HierarchicalPerpetualDecision } from "./hierarchicalPerpetualDecision";
import type { QualifiedMssState } from "./qualifiedMss";
import type { SnapshotQuality, SourceStatus } from "./perpetualDecisionSnapshot";

export function perpetualWaitConditionLabel(input: {
  quality: SnapshotQuality;
  sourceStatus: Record<string, SourceStatus>;
  consensus: HierarchicalPerpetualDecision;
  states: QualifiedMssState[];
  flowConflict: boolean;
}) {
  if (input.quality !== "ready") {
    const names: Record<string, string> = { candles: "확정봉", structure: "시간대 구조", pressure: "포지션 쏠림", flow: "큰 금액 체결" };
    const missing = Object.entries(input.sourceStatus).filter(([, value]) => value.status !== "ready")
      .map(([key]) => names[key] ?? "시장 근거");
    return `${Array.from(new Set(missing)).join("·") || "시장 데이터"} 갱신을 먼저 확인합니다. 최신 데이터가 모두 정상으로 돌아온 뒤 확정 구조를 다시 비교합니다.`;
  }
  const direction = (timeframe: string) => {
    const state = input.states.find((candidate) => candidate.timeframe === timeframe);
    if (!state?.known || state.integrity !== "ready") return "확인 중";
    return state.trend === "bullish" ? "상승" : state.trend === "bearish" ? "하락" : "확인 중";
  };
  if (input.flowConflict) {
    const side = input.consensus.finalDirection === "bullish" ? "상승 구조와 큰 금액 매도" : "하락 구조와 큰 금액 매수";
    return `${side}가 반대입니다. 다음 체결 갱신에서 반대 쏠림이 완화되는지, 다음 확정봉에서 구조가 유지되는지 함께 확인합니다.`;
  }
  if (input.consensus.conflict === "macro") {
    return `1일 ${direction("1d")}·4시간 ${direction("4h")}이 엇갈립니다. 다음 4시간·1일 확정봉에서 두 방향이 모이는지 먼저 확인합니다.`;
  }
  if (input.consensus.conflict === "current") {
    return `1시간 ${direction("1h")}·15분 ${direction("15m")}이 엇갈립니다. 다음 15분·1시간 확정봉에서 두 방향이 모이는지 먼저 확인합니다.`;
  }
  if (input.consensus.conflict === "macro_current") {
    return `1일·4시간 ${direction("4h")}과 1시간·15분 ${direction("15m")}이 반대입니다. 다음 확정봉에서 현재 구조와 큰 흐름의 방향이 같아지는지 확인합니다.`;
  }
  const unconfirmed = [["1d", "1일"], ["4h", "4시간"], ["1h", "1시간"], ["15m", "15분"]]
    .filter(([timeframe]) => direction(timeframe) === "확인 중").map(([, label]) => label);
  return `${unconfirmed.join("·") || "상위 시간대"} 확정 구조가 아직 부족합니다. 해당 시간대 봉이 끝난 뒤 1일·4시간과 1시간·15분 방향이 같은지 다시 확인합니다.`;
}
