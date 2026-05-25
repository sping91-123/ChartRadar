import type { PushAlertEvent } from "@/lib/server/push/types";
import {
  cryptoAltMarketScoutMinimumEvidenceCount,
  cryptoAltMarketScoutScoreThreshold,
  cryptoAltPushScoreThreshold,
  cryptoMajorPushScoreThreshold,
  genericSetupPushScoreThreshold,
  minimumSetupPushScore
} from "@/lib/server/push/thresholds";

const cryptoMajorSymbols = new Set(["BTCUSDT.P", "ETHUSDT.P", "BTCUSDT", "ETHUSDT", "BTC", "ETH"]);

export function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export function compactPushSymbol(symbol: string) {
  return symbol.replace("USDT.P", "").replace("USDT", "");
}

export function isCryptoMajorPushSymbol(symbol: string) {
  return cryptoMajorSymbols.has(symbol) || cryptoMajorSymbols.has(compactPushSymbol(symbol));
}

export function isSetupPushEvent(event: PushAlertEvent) {
  return event.score !== undefined && (event.ruleId === "radar-grade" || event.ruleId === "watchlist-surge" || event.ruleId === "stock-momentum");
}

export function eventQualityThreshold(event: PushAlertEvent) {
  if (!isSetupPushEvent(event)) {
    return event.ruleId === "liquidation-pressure" ? "grade=heated|extreme" : "event-specific";
  }
  if (event.market === "crypto" && event.symbol && !isCryptoMajorPushSymbol(event.symbol) && event.isMarketScout) {
    return `score>=${cryptoAltMarketScoutScoreThreshold} or A>=${minimumSetupPushScore}, evidence>=${cryptoAltMarketScoutMinimumEvidenceCount}`;
  }
  if (event.market === "crypto" && event.symbol && !isCryptoMajorPushSymbol(event.symbol)) {
    return `score>=${cryptoAltPushScoreThreshold} or A>=${minimumSetupPushScore}`;
  }
  if (event.market === "crypto") return `score>=${cryptoMajorPushScoreThreshold} or A>=${minimumSetupPushScore}`;
  return `score>=${genericSetupPushScoreThreshold} or A>=${minimumSetupPushScore}`;
}

function setupSignalPassesPushQuality(event: PushAlertEvent) {
  const score = event.score ?? 0;
  const quality = event.quality;
  const market = event.market;
  const symbol = event.symbol;
  if (score < minimumSetupPushScore) return false;
  if (market === "crypto" && symbol && !isCryptoMajorPushSymbol(symbol) && event.isMarketScout) {
    const evidenceCount = event.evidenceLabels?.length ?? 0;
    if (evidenceCount < cryptoAltMarketScoutMinimumEvidenceCount) return false;
    return score >= cryptoAltMarketScoutScoreThreshold || quality === "A";
  }
  if (quality === "A") return true;
  if (market === "crypto") {
    return score >= (symbol && !isCryptoMajorPushSymbol(symbol) ? cryptoAltPushScoreThreshold : cryptoMajorPushScoreThreshold);
  }
  return score >= genericSetupPushScoreThreshold;
}

export function passesSetupPushQuality(event: PushAlertEvent) {
  if (!isSetupPushEvent(event)) return true;
  return setupSignalPassesPushQuality(event);
}
