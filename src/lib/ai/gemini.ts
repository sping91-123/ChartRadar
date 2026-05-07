// Gemini API로 셋업 코멘트와 시장 종합 피드백을 생성하는 Provider
import type { AIProvider, CommentaryInput, MarketBriefingInput } from "./types";
import { AIProviderError } from "./types";

const GEMINI_MODEL = "gemini-3-flash-preview";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const COMMENTARY_SYSTEM_INSTRUCTION = `당신은 한국어 트레이더를 돕는 리스크 중심 코치입니다.

규칙.
- 60자 이내 한 문장으로 답합니다.
- 매수·매도 지시, 수익 보장, 확정 표현은 금지합니다.
- 입력 데이터에 없는 가격이나 수치는 만들지 않습니다.
- 셋업의 강점 1개와 주의점 1개를 함께 담습니다.`;

const BRIEFING_SYSTEM_INSTRUCTION = `당신은 코인 시장 구조를 설명하는 한국어 분석 코치입니다.

역할.
- 사용자가 제공한 코인, 타임프레임, ICT 구조, POC/PD, 보조지표, 리스크 플래그를 종합해 긴 문장형 피드백을 작성합니다.
- 앱의 성격은 타점 추천이 아니라 시장 구조 분석과 리스크 점검입니다.

출력 규칙.
- 500자에서 900자 사이의 한국어 문단 2개로 작성합니다.
- 첫 문단은 현재 시장 해석과 롱/숏/횡보 중 무엇이 우세한지 설명합니다.
- 둘째 문단은 조심할 점, 다음에 확인할 조건, 보조지표를 어떻게 참고할지 설명합니다.
- 직접적인 진입 지시, 매수·매도 신호, 수익 보장, 확정적 표현은 금지합니다.
- 손절가·익절가를 지시하지 말고, 입력된 시나리오는 참고 구간으로만 설명합니다.
- 입력 데이터에 없는 지표나 가격은 추측하지 않습니다.`;

function buildCommentaryPrompt(input: CommentaryInput): string {
  const sym = input.symbol.replace("USDT.P", "");
  const sideLabel = input.side === "long" ? "롱" : input.side === "short" ? "숏" : "관찰";
  const proximityLabel =
    input.proximity === "ready"
      ? "현재가가 검토 구간 내부"
      : input.proximity === "near"
        ? `검토 구간까지 ${Math.abs(input.distancePercent).toFixed(2)}% 차이`
        : `검토 구간까지 ${Math.abs(input.distancePercent).toFixed(2)}% 이격`;

  return `종목 ${sym} ${input.timeframe}
방향 ${sideLabel}
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
    ? `분석 시나리오: ${input.scenario.title}, ${input.scenario.reason}, 관찰 구간 ${input.scenario.entry}, 리스크 기준 ${input.scenario.invalidation}, 참고 목표 ${input.scenario.targets}, 검토 ${input.scenario.confidence}%`
    : "분석 시나리오: 명확한 관찰 구간 없음";

  return `다음 데이터를 종합해 시장 구조 피드백을 작성하세요.

기본.
종목: ${sym}
선택 타임프레임: ${input.activeTimeframe}
레이더 기준: ${input.activeTimeframe} 타임프레임
현재가: ${input.price}
판정: ${input.verdict}
방향: ${input.bias}
종합 점수: ${input.biasScore} / ${input.scoreRange}
판독 상태: ${input.readiness}
요약: ${input.summaryLine}
행동 가이드: ${input.actionGuide}
현재 위치: ${input.currentLocationLabel}
킬존: ${input.killzone}

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

export class GeminiProvider implements AIProvider {
  readonly model = GEMINI_MODEL;

  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new AIProviderError("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.", "gemini");
    }
  }

  async generateCommentary(input: CommentaryInput): Promise<string> {
    const text = await this.generateText(COMMENTARY_SYSTEM_INSTRUCTION, buildCommentaryPrompt(input), 2048, 0.3);
    return sanitizeShortCommentary(text);
  }

  async generateMarketBriefing(input: MarketBriefingInput): Promise<string> {
    const text = await this.generateText(BRIEFING_SYSTEM_INSTRUCTION, buildMarketBriefingPrompt(input), 4096, 0.35);
    return sanitizeBriefing(text);
  }

  private async generateText(systemInstruction: string, prompt: string, maxOutputTokens: number, temperature: number) {
    const url = `${GEMINI_ENDPOINT}?key=${this.apiKey}`;
    const body = {
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature,
        topP: 0.9,
        maxOutputTokens,
        candidateCount: 1
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
      ]
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    } catch (cause) {
      throw new AIProviderError("Gemini API 호출 네트워크 오류", "gemini", cause);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new AIProviderError(`Gemini API ${response.status}: ${text.slice(0, 200)}`, "gemini");
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (cause) {
      throw new AIProviderError("Gemini 응답 파싱 실패", "gemini", cause);
    }

    const text = extractText(payload);
    if (!text) {
      throw new AIProviderError("Gemini 응답에 텍스트가 없습니다.", "gemini");
    }
    return text;
  }
}

function extractText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const first = candidates[0] as { content?: { parts?: Array<{ text?: string; thought?: boolean }> } };
  const parts = first?.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) return null;
  const text = parts
    .filter((part) => !part.thought)
    .map((part) => part.text ?? "")
    .join("")
    .trim();
  return text || null;
}

function sanitizeShortCommentary(raw: string): string {
  let text = raw.replace(/[\r\n]+/g, " ").trim();
  text = text.replace(/^["'`]+|["'`]+$/g, "");
  if (text.length > 90) text = text.slice(0, 87) + "...";
  return text;
}

function sanitizeBriefing(raw: string): string {
  let text = raw.replace(/\r/g, "").trim();
  text = text.replace(/^["'`]+|["'`]+$/g, "");
  text = text.replace(/\n{3,}/g, "\n\n");
  if (text.length > 1200) text = text.slice(0, 1197) + "...";
  return text;
}
