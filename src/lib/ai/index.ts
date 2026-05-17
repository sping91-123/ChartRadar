// 환경변수 우선순위에 따라 AI Provider를 선택하는 팩토리입니다.
import type { AIProvider } from "./types";
import { GeminiProvider } from "./gemini";
import { GroqProvider } from "./groq";

let cached: AIProvider | null = null;
let cachedCandidates: AIProvider[] | null = null;

function buildAIProviderCandidates() {
  const providers: AIProvider[] = [];
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const geminiFallbackEnabled = process.env.ENABLE_GEMINI_AI_FALLBACK === "true";

  if (groqKey) {
    providers.push(new GroqProvider(groqKey, process.env.GROQ_MODEL));
  }

  if (geminiFallbackEnabled && geminiKey) {
    providers.push(new GeminiProvider(geminiKey));
  }

  return providers;
}

export function getAIProvider(): AIProvider {
  if (cached) return cached;

  const providers = getAIProviderCandidates();
  const firstProvider = providers[0];
  if (firstProvider) {
    cached = firstProvider;
    return cached;
  }

  throw new Error("AI 브리핑을 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.");
}

export function getAIProviderCandidates(): AIProvider[] {
  if (cachedCandidates) return cachedCandidates;

  cachedCandidates = buildAIProviderCandidates();
  if (cachedCandidates.length) return cachedCandidates;

  throw new Error("AI 브리핑을 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.");
}

export type {
  AIProvider,
  CommentaryInput,
  CommentaryOutput,
  MarketBriefingInput,
  MarketBriefingOutput
} from "./types";
export { AIProviderError } from "./types";
