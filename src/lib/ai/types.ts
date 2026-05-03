/**
 * Provider-agnostic AI 인터페이스.
 * 지금은 Gemini 무료 티어로 시작하지만, 매출 발생 후 Claude/GPT-4로 한 줄만 바꿔서
 * 갈아탈 수 있도록 입출력 구조를 추상화한다.
 */

import type { BiasSide, ChartTimeframe } from "../marketAnalysis";

/** Setup Scout 카드 한 장에 대한 AI 코멘트 생성 입력 */
export interface CommentaryInput {
  symbol: string;
  timeframe: ChartTimeframe;
  side: BiasSide;
  score: number;
  currentPrice: number;
  entryLow: number;
  entryHigh: number;
  invalidation: number;
  target1: number;
  target2: number;
  proximity: "ready" | "near" | "wait";
  distancePercent: number;
  /** 셋업 컨텍스트 (Pine 분석 결과 요약) */
  context: {
    killzone: "asia" | "london" | "newyork" | "off";
    higherTfAlignedCount: number;
    inOte: boolean;
    inOb: boolean;
    inFvg: boolean;
    pocPosition: "above" | "below" | "near" | "unknown";
    quality: "A" | "B" | "C";
    riskFlags: string[];
    opportunityFlags: string[];
  };
}

export interface CommentaryOutput {
  /** 30~80자 한국어 코멘트. 단호한 톤, 진입 권유 X (교육 톤) */
  commentary: string;
  /** 사용한 모델명 (디버깅용) */
  model: string;
  /** 서버 캐시에서 반환됐는지 */
  cached: boolean;
}

/** AI Provider 추상 인터페이스 */
export interface AIProvider {
  /** 모델 식별자 (로그/디버그용) */
  readonly model: string;
  /** Setup 카드용 짧은 코멘트 생성 */
  generateCommentary(input: CommentaryInput): Promise<string>;
}

/** AI 호출 실패 시 던지는 에러 */
export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}
