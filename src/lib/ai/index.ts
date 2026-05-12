// AI Provider를 환경변수 우선순위에 따라 선택하는 팩토리.
import type { AIProvider } from "./types";
import { GeminiProvider } from "./gemini";
import { GroqProvider } from "./groq";

let cached: AIProvider | null = null;
let cachedCandidates: AIProvider[] | null = null;

function buildAIProviderCandidates() {
  const providers: AIProvider[] = [];
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (groqKey) {
    providers.push(new GroqProvider(groqKey, process.env.GROQ_MODEL));
  }

  if (geminiKey) {
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

  throw new Error(
    "AI Provider가 설정되지 않았습니다. .env.local에 GROQ_API_KEY 또는 GEMINI_API_KEY를 추가하세요."
  );
}

export function getAIProviderCandidates(): AIProvider[] {
  if (cachedCandidates) return cachedCandidates;

  cachedCandidates = buildAIProviderCandidates();
  if (cachedCandidates.length) return cachedCandidates;

  throw new Error(
    "AI Provider가 설정되지 않았습니다. .env.local에 GROQ_API_KEY 또는 GEMINI_API_KEY를 추가하세요."
  );
}

export type {
  AIProvider,
  CommentaryInput,
  CommentaryOutput,
  MarketBriefingInput,
  MarketBriefingOutput
} from "./types";
export { AIProviderError } from "./types";
