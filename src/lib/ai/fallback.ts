// AI 호출 실패 시 실제 판독 데이터로 대체 문장을 만드는 유틸리티
import type { CommentaryInput, MarketBriefingInput } from "./types";

export function generateFallbackCommentary(input: CommentaryInput): string {
  const parts: string[] = [];

  if (input.proximity === "ready") {
    parts.push("현재가가 검토 구간 안에 있습니다");
  } else if (input.proximity === "near") {
    parts.push(`검토 구간까지 ${Math.abs(input.distancePercent).toFixed(2)}% 차이입니다`);
  } else {
    parts.push(`검토 구간과 ${Math.abs(input.distancePercent).toFixed(2)}% 떨어져 있습니다`);
  }

  if (input.context.higherTfAlignedCount >= 2) {
    parts.push("상위 시간대 정렬은 양호합니다");
  } else if (input.context.higherTfAlignedCount === 1) {
    parts.push("상위 시간대 정렬은 일부만 맞습니다");
  } else {
    parts.push("상위 시간대 정렬은 약합니다");
  }

  if (input.context.inOte) parts.push("OTE와 겹칩니다");
  else if (input.context.inOb) parts.push("OB 반응 구간입니다");
  else if (input.context.inFvg) parts.push("FVG 반응 구간입니다");

  if (input.context.riskFlags.length > 0) {
    parts.push(input.context.riskFlags[0]);
  }

  let text = `${parts.slice(0, 4).join(", ")}.`;
  if (text.length > 90) text = text.slice(0, 87) + "...";
  return text;
}

export function generateFallbackMarketBriefing(input: MarketBriefingInput): string {
  const direction =
    input.bias === "long" ? "롱 쪽 구조가 조금 더 우세합니다" : input.bias === "short" ? "숏 쪽 구조가 조금 더 우세합니다" : "방향은 아직 횡보에 가깝습니다";
  const active = input.active;
  const opportunityFlags = input.opportunityFlags.slice(0, 3);
  const riskFlags = input.riskFlags.slice(0, 3);
  const opportunity = opportunityFlags.length ? `${opportunityFlags.join(", ")}가 확인됩니다` : "뚜렷한 강점 신호는 제한적입니다";
  const risk = riskFlags.length ? `${riskFlags.join(", ")}입니다` : "큰 리스크 플래그는 많지 않습니다";
  const keySignals = input.aggregate?.keySignals.slice(0, 3).join(", ") ?? "";
  const scope = input.analysisScope ?? `${input.activeTimeframe} 기준`;
  const pressureSummary = input.pressure
    ? `${input.pressure.summary} ${input.pressure.structurePressureRead}`
    : "롱/숏 압력 데이터는 아직 함께 확인되지 않았습니다.";
  const pressureEvidence = input.pressure?.evidence.length ? ` 압력 근거는 ${input.pressure.evidence.slice(0, 2).join(", ")}입니다.` : "";

  const first =
    input.aggregate
      ? `${input.symbol.replace("USDT.P", "")} ${scope} 현재 판독은 ${input.verdict}이며, 종합 점수는 ${input.aggregate.compositeScore}점입니다. ` +
        `${direction}. ${input.aggregate.alignment} 단기 구조는 ${input.aggregate.shortTimeframeSummary}, 상위 구조는 ${input.aggregate.higherTimeframeSummary}입니다. ${pressureSummary} ` +
        `${keySignals ? `핵심 신호는 ${keySignals}입니다.` : "다중 시간대 정렬은 아직 강하게 확인되지 않습니다."}`
      : `${input.symbol.replace("USDT.P", "")} ${scope} 현재 판독은 ${input.verdict}이며, 구조 기울기값은 ${input.biasScore}입니다. ` +
        `${direction}. 대표 세부 구조는 확정 구조 ${active.msb}, 전환 신호 ${active.choch}입니다. ${pressureSummary} 수급 구간은 ${active.ob}, 가격 공백은 ${active.fvg}입니다. 핵심 매물대 기준은 ${active.poc}, 가격 위치는 ${active.pd}입니다.`;

  const second =
    `강점 신호는 ${opportunity}. 주의할 점은 ${risk}.${pressureEvidence} ${input.aggregate ? `전체 변동성은 ${input.aggregate.volatility}, 거래량은 ${input.aggregate.volume}입니다. 대표 ` : ""}보조지표는 RSI ${active.rsi}, MACD ${active.macd} 상태라 방향 신호보다 추세 과열과 변동성 확인용으로 참고하는 편이 좋습니다. ` +
    `${input.scenario ? `현재 분석 시나리오는 ${input.scenario.title}이며 관찰 구간은 ${input.scenario.entry}, 리스크 기준은 ${input.scenario.invalidation}입니다. ` : "아직 명확한 분석 시나리오는 생성되지 않았습니다. "}` +
    `다음 캔들에서 확정 구조와 전환 신호 변화, 수급 구간과 가격 공백 반응이 유지되는지 확인하면 판단 우선순위를 더 선명하게 잡을 수 있습니다.`;

  return `${first}\n\n${second}`;
}
