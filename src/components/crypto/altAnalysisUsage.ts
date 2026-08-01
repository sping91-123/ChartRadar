import { altAnalysisUsageStorageKey } from "@/components/crypto/constants";
import type { AltAnalysisGate, AltAnalysisUsageSnapshot } from "@/components/crypto/types";
import { basicCoinCapabilityPolicy } from "@/lib/coinCapabilities";
import { recordUsageEvent, syncUsageCount } from "@/lib/usageMeter";

function localDateKey(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const year = kst.getUTCFullYear();
  const month = `${kst.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${kst.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const altAnalysisFreeLimit = basicCoinCapabilityPolicy.altAnalysisDailyLimit ?? 3;

function emptyAltAnalysisUsage(): AltAnalysisUsageSnapshot {
  return { dateKey: localDateKey(), symbols: [] };
}

function readAltAnalysisUsage(): AltAnalysisUsageSnapshot {
  if (typeof window === "undefined") return emptyAltAnalysisUsage();

  try {
    const raw = window.localStorage.getItem(altAnalysisUsageStorageKey);
    if (!raw) return emptyAltAnalysisUsage();

    const parsed = JSON.parse(raw) as Partial<AltAnalysisUsageSnapshot>;
    if (parsed.dateKey !== localDateKey() || !Array.isArray(parsed.symbols)) return emptyAltAnalysisUsage();

    return {
      dateKey: parsed.dateKey,
      symbols: Array.from(new Set(parsed.symbols.filter((item): item is string => typeof item === "string")))
    };
  } catch {
    return emptyAltAnalysisUsage();
  }
}

function writeAltAnalysisUsage(snapshot: AltAnalysisUsageSnapshot) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(altAnalysisUsageStorageKey, JSON.stringify(snapshot));
}

export function initialAltAnalysisGate(isPaid: boolean): AltAnalysisGate {
  const limit = isPaid ? Number.POSITIVE_INFINITY : altAnalysisFreeLimit;
  return {
    allowed: true,
    used: 0,
    limit,
    remaining: limit,
    symbols: []
  };
}

export function getAltAnalysisGate(isPaid: boolean, currentSymbol?: string): AltAnalysisGate {
  const snapshot = readAltAnalysisUsage();
  if (isPaid) {
    return {
      allowed: true,
      used: snapshot.symbols.length,
      limit: Number.POSITIVE_INFINITY,
      remaining: Number.POSITIVE_INFINITY,
      symbols: snapshot.symbols
    };
  }

  const alreadyUsed = currentSymbol ? snapshot.symbols.includes(currentSymbol) : false;
  return {
    allowed: alreadyUsed || snapshot.symbols.length < altAnalysisFreeLimit,
    used: snapshot.symbols.length,
    limit: altAnalysisFreeLimit,
    remaining: Math.max(0, altAnalysisFreeLimit - snapshot.symbols.length),
    symbols: snapshot.symbols
  };
}

export function applyServerAltAnalysisUsage(
  symbol: string,
  isPaid: boolean,
  result: {
    allowed: boolean;
    newlyCounted?: boolean;
    usage?: { used?: number; limit?: number | null; remaining?: number | null };
  }
): AltAnalysisGate {
  const snapshot = readAltAnalysisUsage();
  const symbols = result.allowed && !snapshot.symbols.includes(symbol)
    ? [...snapshot.symbols, symbol]
    : snapshot.symbols;
  const addedLocally = symbols !== snapshot.symbols;
  if (result.allowed && addedLocally) {
    writeAltAnalysisUsage({ dateKey: snapshot.dateKey, symbols });
  }
  if (!isPaid && typeof result.usage?.used === "number") {
    syncUsageCount("altIndividualAnalysis", result.usage.used);
  } else if (addedLocally) {
    recordUsageEvent("altIndividualAnalysis");
  }
  if (isPaid || result.usage?.limit === null) {
    return {
      allowed: result.allowed,
      used: symbols.length,
      limit: Number.POSITIVE_INFINITY,
      remaining: Number.POSITIVE_INFINITY,
      symbols
    };
  }
  const used = typeof result.usage?.used === "number" ? result.usage.used : symbols.length;
  const limit = typeof result.usage?.limit === "number" ? result.usage.limit : altAnalysisFreeLimit;
  return {
    allowed: result.allowed,
    used,
    limit,
    remaining: typeof result.usage?.remaining === "number" ? result.usage.remaining : Math.max(0, limit - used),
    symbols
  };
}
