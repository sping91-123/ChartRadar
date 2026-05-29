import { altAnalysisFreeLimit, altAnalysisUsageStorageKey } from "@/components/crypto/constants";
import type { AltAnalysisGate, AltAnalysisUsageSnapshot } from "@/components/crypto/types";
import { recordUsageEvent } from "@/lib/usageMeter";

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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
  const limit = isPaid ? 300 : altAnalysisFreeLimit;
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
      limit: 300,
      remaining: 300,
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

export function registerAltAnalysisSymbol(symbol: string, isPaid: boolean): AltAnalysisGate {
  const snapshot = readAltAnalysisUsage();
  if (isPaid || snapshot.symbols.includes(symbol)) {
    return getAltAnalysisGate(isPaid, symbol);
  }

  if (snapshot.symbols.length >= altAnalysisFreeLimit) {
    return {
      allowed: false,
      used: snapshot.symbols.length,
      limit: altAnalysisFreeLimit,
      remaining: 0,
      symbols: snapshot.symbols
    };
  }

  const next = {
    dateKey: snapshot.dateKey,
    symbols: [...snapshot.symbols, symbol]
  };
  writeAltAnalysisUsage(next);
  recordUsageEvent("altIndividualAnalysis");

  return {
    allowed: true,
    used: next.symbols.length,
    limit: altAnalysisFreeLimit,
    remaining: Math.max(0, altAnalysisFreeLimit - next.symbols.length),
    symbols: next.symbols
  };
}
