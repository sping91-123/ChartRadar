import type { AIProvider, CommentaryInput } from "./types";
import { AIProviderError } from "./types";

const GEMINI_MODEL = "gemini-3-flash-preview";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_INSTRUCTION = `당신은 한국 트레이더용 리스크 점검 코치입니다.

규칙:
- 60자 이내 한 줄로 답합니다. 줄바꿈 없음.
- 단호하고 사실 기반 톤. 매수/매도 권유 금지.
- "들어가세요", "사세요", "팔으세요" 같은 직접 행동 지시 금지.
- 셋업의 핵심 강점 1개와 주의할 리스크 1개를 한 문장에 압축.
- 이모지 사용 금지. 마침표 1개로 끝낼 것.
- 입력 데이터에 명시되지 않은 가격이나 수치는 절대 추측하지 마세요.

출력 예시:
- "4H 상위 추세 정합 + OTE 일치, 다만 뉴욕 세션 외라 변동성 약함."
- "현재가가 OB 영역 안, 검토 구간이지만 무효 폭이 좁음."
- "가격이 OB까지 1.8% 떨어져야 하므로 단기 구조 변동 주시 필요."`;

function buildUserPrompt(input: CommentaryInput): string {
  const sym = input.symbol.replace("USDT.P", "");
  const sideLabel = input.side === "long" ? "롱" : input.side === "short" ? "숏" : "관망";
  const proximityLabel =
    input.proximity === "ready"
      ? "현재가가 진입 영역 내부"
      : input.proximity === "near"
        ? `현재가가 진입까지 ${Math.abs(input.distancePercent).toFixed(2)}% 차이 (근접)`
        : `현재가가 진입까지 ${Math.abs(input.distancePercent).toFixed(2)}% 차이 (대기)`;

  const killzoneLabel =
    input.context.killzone === "asia"
      ? "아시아 세션"
      : input.context.killzone === "london"
        ? "런던 세션"
        : input.context.killzone === "newyork"
          ? "뉴욕 세션"
          : "킬존 외";

  const opportunities = input.context.opportunityFlags.length
    ? input.context.opportunityFlags.slice(0, 3).join(", ")
    : "없음";
  const risks = input.context.riskFlags.length
    ? input.context.riskFlags.slice(0, 3).join(", ")
    : "없음";

  return `다음 셋업에 대한 한 줄 코멘트를 60자 이내로 작성하세요.

종목: ${sym} ${input.timeframe}
방향: ${sideLabel}
품질: ${input.context.quality}급 (점수 ${input.score})
근접도: ${proximityLabel}
킬존: ${killzoneLabel}
상위 TF 정합: ${input.context.higherTfAlignedCount}개
OTE 영역 일치: ${input.context.inOte ? "예" : "아니오"}
OB 내부: ${input.context.inOb ? "예" : "아니오"}
FVG 내부: ${input.context.inFvg ? "예" : "아니오"}
강점 신호: ${opportunities}
리스크 신호: ${risks}

답변 (60자 이내, 한 문장, 마침표 1개):`;
}

export class GeminiProvider implements AIProvider {
  readonly model = GEMINI_MODEL;

  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new AIProviderError("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.", "gemini");
    }
  }

  async generateCommentary(input: CommentaryInput): Promise<string> {
    const url = `${GEMINI_ENDPOINT}?key=${this.apiKey}`;
    const body = {
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: buildUserPrompt(input) }]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        topP: 0.9,
        maxOutputTokens: 2048,
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
      throw new AIProviderError(
        `Gemini API ${response.status}: ${text.slice(0, 200)}`,
        "gemini"
      );
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

    return sanitizeCommentary(text);
  }
}

function extractText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const first = candidates[0] as { content?: { parts?: Array<{ text?: string; thought?: boolean }> } };
  const parts = first?.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) return null;
  // thought 파트 제외 (Gemini 2.5/3 thinking 모델의 내부 추론 토큰)
  const text = parts
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  return text || null;
}

/** 모델이 가끔 줄바꿈/따옴표/이모지를 섞어 보내는 걸 정리. 80자에서 절단. */
function sanitizeCommentary(raw: string): string {
  let text = raw.replace(/[\r\n]+/g, " ").trim();
  // 양쪽 따옴표 제거
  text = text.replace(/^["'`]+|["'`]+$/g, "");
  // 길이 제한
  if (text.length > 90) text = text.slice(0, 87) + "...";
  return text;
}
