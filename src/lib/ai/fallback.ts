/**
 * 규칙 기반 폴백 코멘터리.
 * Gemini API 할당량 초과 / 오류 시 대신 사용.
 * 실제 입력 데이터를 바탕으로 한국어 한 줄 생성.
 */

import type { CommentaryInput } from "./types";

export function generateFallbackCommentary(input: CommentaryInput): string {
  const parts: string[] = [];

  // 1. 근접도 상태
  if (input.proximity === "ready") {
    parts.push("현재가 검토 영역 내 위치");
  } else if (input.proximity === "near") {
    parts.push(`검토 영역까지 ${Math.abs(input.distancePercent).toFixed(2)}% 차이`);
  } else {
    parts.push(`검토 대기 (${Math.abs(input.distancePercent).toFixed(2)}% 이격)`);
  }

  // 2. 상위 TF 정합
  if (input.context.higherTfAlignedCount >= 2) {
    parts.push("상위 TF 2개 정합");
  } else if (input.context.higherTfAlignedCount === 1) {
    parts.push("상위 TF 부분 정합");
  } else {
    parts.push("상위 TF 미정합");
  }

  // 3. 핵심 컨텍스트 (OTE/OB/FVG 중 가장 중요한 것 1개)
  if (input.context.inOte) {
    parts.push("OTE 영역 일치");
  } else if (input.context.inOb) {
    parts.push("OB 내부 검토 구간");
  } else if (input.context.inFvg) {
    parts.push("FVG 채움 구간");
  }

  // 4. POC 균형 구간은 휩쏘 리스크로 우선 표시
  if (input.context.pocPosition === "near") {
    parts.push("POC 근처 휩쏘 주의");
  }

  // 5. 주요 리스크 (있을 때만)
  if (input.context.riskFlags.length > 0) {
    const risk = input.context.riskFlags[0];
    // 너무 긴 경우 자르기
    parts.push(risk.length > 15 ? risk.slice(0, 15) : risk);
  }

  // 6. 킬존 보정
  if (input.context.killzone === "off") {
    parts.push("킬존 외 구간 주의");
  }

  // 조합 → 최대 80자
  let text = parts.join(", ") + ".";
  if (text.length > 80) text = text.slice(0, 77) + "...";
  return text;
}
