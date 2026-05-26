// 코인 레이더 데이터 요청과 캐시 저장에 쓰는 순수 helper를 모은 파일입니다.
import type { ChartTimeframe } from "@/lib/marketAnalysis";
import {
  legacyChannelStoragePrefix,
  legacyPreviousBrandStoragePrefix,
  storagePrefix
} from "@/components/crypto/constants";
import type { AnalysisMode, MarketCachePayload, MsbMode, StructureSensitivity } from "@/components/crypto/types";

interface MarketCacheKeyInput {
  symbol: string;
  activeTimeframe: ChartTimeframe;
  analysisMode: AnalysisMode;
  msbMode: MsbMode;
  structureSensitivity: StructureSensitivity;
}

interface CryptoSymbolsApiResponse {
  symbols?: Array<{ symbol?: string }>;
}

interface MarketBriefingPayload {
  briefing?: string;
  model?: string;
  cached?: boolean;
  error?: string;
}

export function storageKey(name: string) {
  return `${storagePrefix}.${name}`;
}

export function legacyStorageKeys(name: string) {
  return [`${legacyPreviousBrandStoragePrefix}.${name}`, `${legacyChannelStoragePrefix}.${name}`];
}

export function readLocalStorageWithLegacy(primaryKey: string, legacyKeys: string[]) {
  const current = window.localStorage.getItem(primaryKey);
  if (current !== null) return current;

  const legacyKey = legacyKeys.find((key) => window.localStorage.getItem(key) !== null);
  const legacy = legacyKey ? window.localStorage.getItem(legacyKey) : null;
  if (legacy !== null) {
    window.localStorage.setItem(primaryKey, legacy);
    legacyKeys.forEach((key) => window.localStorage.removeItem(key));
  }

  return legacy;
}

export function writeLocalStorage(primaryKey: string, legacyKeys: string[], value: string) {
  window.localStorage.setItem(primaryKey, value);
  legacyKeys.forEach((key) => window.localStorage.removeItem(key));
}

export function buildMarketCacheKey({
  symbol,
  activeTimeframe,
  analysisMode,
  msbMode,
  structureSensitivity
}: MarketCacheKeyInput) {
  return `${storagePrefix}.marketCache.${symbol}.${activeTimeframe}.${analysisMode}.${msbMode}.${structureSensitivity}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidMarketCachePayload(value: unknown): value is MarketCachePayload {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.candles) || !isRecord(value.analysis)) return false;

  const timeframeAnalyses = value.analysis.timeframeAnalyses;
  return (
    Array.isArray(timeframeAnalyses) &&
    timeframeAnalyses.length > 0 &&
    timeframeAnalyses.every((item) => isRecord(item) && isRecord(item.condition))
  );
}

export function readMarketCache(cacheKey: string): MarketCachePayload | null {
  if (typeof window === "undefined") return null;

  const cached = window.localStorage.getItem(cacheKey);
  if (!cached) return null;

  try {
    const parsed = JSON.parse(cached) as unknown;
    if (isValidMarketCachePayload(parsed)) return parsed;
  } catch {
    // 손상된 캐시는 아래에서 제거합니다.
  }

  window.localStorage.removeItem(cacheKey);
  return null;
}

export function writeMarketCache(cacheKey: string, payload: MarketCachePayload) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(cacheKey, JSON.stringify(payload));
}

export async function fetchCryptoSymbolList() {
  const response = await fetch("/api/crypto-symbols", { cache: "no-store" });
  if (!response.ok) return [];

  const data = (await response.json()) as CryptoSymbolsApiResponse;
  return (data.symbols ?? [])
    .map((item) => item.symbol)
    .filter((symbol): symbol is string => typeof symbol === "string" && symbol.length > 0);
}

export async function readMarketBriefingResponse(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as MarketBriefingPayload;

  if (!response.ok || !payload.briefing) {
    throw new Error(payload.error ?? "AI 종합 피드백을 생성하지 못했습니다.");
  }

  return {
    briefing: payload.briefing,
    model: payload.model ?? "unknown",
    cached: Boolean(payload.cached)
  };
}
