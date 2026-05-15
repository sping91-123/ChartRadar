// Groq OpenAI 호환 API로 차트 브리핑과 짧은 코멘트를 생성하는 Provider입니다.
import type { AIProvider, CommentaryInput, MarketBriefingInput } from "./types";
import { AIProviderError } from "./types";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";

const COMMENTARY_SYSTEM_INSTRUCTION = `당신은 한국어로 말하는 차트 레이더 분석 비서입니다.

규칙.
- 60자 안팎의 한 문장으로 답합니다.
- 매수, 매도, 수익 보장, 확정 표현은 금지합니다.
- 입력 데이터에 없는 가격이나 수치를 만들지 않습니다.
- 강점 1개와 주의점 1개를 함께 담습니다.`;

const BRIEFING_SYSTEM_INSTRUCTION = `당신은 한국어로 코인과 글로벌 시장 구조를 설명하는 분석 비서입니다.

역할.
- 사용자가 제공한 종목, 타임프레임, ICT 구조, POC/PD, 보조지표, 리스크 플래그를 종합해 긴 문장의 피드백을 작성합니다.
- 글의 성격은 투자 추천이 아니라 시장 구조 해석과 리스크 점검입니다.

출력 규칙.
- 500자에서 900자 사이의 한국어 문단 2개로 작성하고, 문단 사이는 빈 줄 하나로 구분합니다.
- 첫 문단은 현재 시장 해석과 롱·숏 중 무엇이 우세해 보이는지 설명합니다.
- 두 번째 문단은 조심할 점, 다음에 확인할 조건, 보조지표를 어떻게 참고할지 설명합니다.
- 반드시 한국어만 사용합니다. 일본어, 중국어, 히라가나, 가타카나는 절대 쓰지 않습니다.
- 직접적인 진입 지시, 매수·매도 신호, 수익 보장, 확정 표현은 금지합니다.
- 예측 가격을 만들지 말고, 입력된 시나리오와 참고 구간만 설명합니다.
- 중요한 단어는 롱, 숏, 상승, 하락, 위험, 관찰, 보류처럼 화면에서 색상 처리하기 쉬운 단어로 자연스럽게 씁니다.
- 생각 과정, XML 태그, 마크다운 제목, 코드블록은 출력하지 않습니다.`;

interface GroqChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

function normalizeGroqKey(apiKey: string) {
  return apiKey.trim().replace(/^["']|["']$/g, "").replace(/^gsk_gsk_/, "gsk_");
}

function sideLabel(side: CommentaryInput["side"]) {
  if (side === "long") return "롱";
  if (side === "short") return "숏";
  return "관찰";
}

function buildCommentaryPrompt(input: CommentaryInput): string {
  const sym = input.symbol.replace("USDT.P", "");
  const proximityLabel =
    input.proximity === "ready"
      ? "현재가가 검토 구간 안에 있음"
      : input.proximity === "near"
        ? `검토 구간까지 ${Math.abs(input.distancePercent).toFixed(2)}% 차이`
        : `검토 구간까지 ${Math.abs(input.distancePercent).toFixed(2)}% 이격`;

  return `종목 ${sym} ${input.timeframe}
방향 ${sideLabel(input.side)}
점수 ${input.score}
근접도 ${proximityLabel}
상위 TF 정렬 ${input.context.higherTfAlignedCount}개
OTE ${input.context.inOte ? "일치" : "아님"}
OB ${input.context.inOb ? "내부" : "아님"}
FVG ${input.context.inFvg ? "내부" : "아님"}
POC ${input.context.pocPosition}
강점 ${input.context.opportunityFlags.slice(0, 3).join(", ") || "없음"}
주의 ${input.context.riskFlags.slice(0, 3).join(", ") || "없음"}`;
}

function buildMarketBriefingPrompt(input: MarketBriefingInput): string {
  const sym = input.symbol.replace("USDT.P", "");
  const tfLines = input.timeframes
    .map((item) => `${item.timeframe}: MSB ${item.msb}, CHoCH ${item.choch}, 점수 ${item.score}, ${item.summary}`)
    .join("\n");
  const scenario = input.scenario
    ? `분석 시나리오: ${input.scenario.title}, ${input.scenario.reason}, 관찰 구간 ${input.scenario.entry}, 리스크 기준 ${input.scenario.invalidation}, 참고 목표 ${input.scenario.targets}, 신뢰도 ${input.scenario.confidence}%`
    : "분석 시나리오: 명확한 관찰 구간 없음";

  return `다음 데이터를 종합해 시장 구조 피드백을 작성하세요.

기본.
종목: ${sym}
선택 타임프레임: ${input.activeTimeframe}
현재가: ${input.price}
판정: ${input.verdict}
방향: ${input.bias}
종합 점수: ${input.biasScore} / ${input.scoreRange}
데이터 신뢰도: ${input.readiness}
요약: ${input.summaryLine}
다음 확인: ${input.actionGuide}
현재 위치: ${input.currentLocationLabel}
세션: ${input.killzone}

선택 TF 구조.
MSB: ${input.active.msb}
CHoCH: ${input.active.choch}
OB: ${input.active.ob}
FVG: ${input.active.fvg}
Sweep: ${input.active.sweep}
CISD: ${input.active.cisd}
PD: ${input.active.pd}
POC: ${input.active.poc}

보조지표.
RSI: ${input.active.rsi}
MACD: ${input.active.macd}
변동성: ${input.active.volatility}
거래량: ${input.active.volume}
볼린저밴드: ${input.active.bollinger}

타임프레임별 구조.
${tfLines}

강점 근거.
${input.opportunityFlags.join("\n") || "없음"}

리스크 근거.
${input.riskFlags.join("\n") || "없음"}

판독 근거.
${input.reasons.map((item) => `${item.tone}: ${item.text}`).join("\n") || "없음"}

${scenario}`;
}

export class GroqProvider implements AIProvider {
  readonly model: string;
  private readonly normalizedApiKey: string;

  constructor(apiKey: string, model?: string) {
    this.normalizedApiKey = normalizeGroqKey(apiKey);
    if (!this.normalizedApiKey) {
      throw new AIProviderError("GROQ_API_KEY 환경변수가 설정되지 않았습니다.", "groq");
    }
    this.model = model || DEFAULT_GROQ_MODEL;
  }

  async generateCommentary(input: CommentaryInput): Promise<string> {
    const text = await this.generateText(COMMENTARY_SYSTEM_INSTRUCTION, buildCommentaryPrompt(input), 700, 0.25);
    return sanitizeShortCommentary(text);
  }

  async generateMarketBriefing(input: MarketBriefingInput): Promise<string> {
    const text = await this.generateText(BRIEFING_SYSTEM_INSTRUCTION, buildMarketBriefingPrompt(input), 1300, 0.35);
    return sanitizeBriefing(text);
  }

  private async generateText(systemInstruction: string, prompt: string, maxTokens: number, temperature: number) {
    let response: Response;
    try {
      response = await fetch(GROQ_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.normalizedApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt }
          ],
          temperature,
          max_tokens: maxTokens
        })
      });
    } catch (cause) {
      throw new AIProviderError("Groq API 호출 네트워크 오류", "groq", cause);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new AIProviderError(`Groq API ${response.status}: ${text.slice(0, 240)}`, "groq");
    }

    let payload: GroqChatResponse;
    try {
      payload = (await response.json()) as GroqChatResponse;
    } catch (cause) {
      throw new AIProviderError("Groq 응답 파싱 실패", "groq", cause);
    }

    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new AIProviderError("Groq 응답에 텍스트가 없습니다.", "groq");
    }
    return stripReasoningTags(text);
  }
}

function stripReasoningTags(raw: string) {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/```[\s\S]*?```/g, "")
    .trim();
}

function sanitizeShortCommentary(raw: string): string {
  let text = stripReasoningTags(raw).replace(/[\r\n]+/g, " ").trim();
  text = text.replace(/^["'`]+|["'`]+$/g, "");
  if (text.length > 90) text = `${text.slice(0, 87)}...`;
  return text;
}

function sanitizeBriefing(raw: string): string {
  let text = stripReasoningTags(raw).replace(/\r/g, "").trim();
  text = text.replace(/^["'`]+|["'`]+$/g, "");
  text = text.replace(/^#+\s*/gm, "");
  text = text.replace(/\n{3,}/g, "\n\n");
  if (text.length > 1200) text = `${text.slice(0, 1197)}...`;
  return text;
}
