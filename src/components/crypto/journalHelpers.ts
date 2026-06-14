import type { JournalEntry } from "@/lib/journal";
import type { ChartTimeframe, MarketAnalysis, TimeframeAnalysis } from "@/lib/marketAnalysis";
import { conditionLabel, formatIndicatorValue, formatPrice, stateLabel } from "@/components/crypto/displayHelpers";

interface CryptoJournalEntryInput {
  symbol: string;
  timeframe: ChartTimeframe;
  analysis: MarketAnalysis;
  activeAnalysis: TimeframeAnalysis;
  alignmentSummary: {
    higher: string;
    fast: string;
  } | null;
}

export function buildCryptoJournalEntry({
  symbol,
  timeframe,
  analysis,
  activeAnalysis,
  alignmentSummary
}: CryptoJournalEntryInput): Omit<JournalEntry, "id" | "createdAt"> {
  const noteParts = [
    `판정: ${analysis.verdict}`,
    `행동 가이드: ${analysis.actionGuide}`,
    `현재 위치: ${analysis.currentLocationLabel}`,
    `상위 구조: ${alignmentSummary?.higher ?? "-"}`,
    `단기 구조: ${alignmentSummary?.fast ?? "-"}`,
    `MSB/CHoCH: ${stateLabel(activeAnalysis.msb)} / ${stateLabel(activeAnalysis.choch)}`,
    `POC: ${
      activeAnalysis.volumeProfile
        ? `${formatPrice(activeAnalysis.volumeProfile.poc)} / ${stateLabel(activeAnalysis.volumeProfile.position)}`
        : "-"
    }`,
    `시장 환경: RSI ${formatIndicatorValue(activeAnalysis.condition.rsi14, 1)} (${conditionLabel(activeAnalysis.condition.rsiState)}) / MACD ${conditionLabel(
      activeAnalysis.condition.macdState
    )} / ATR ${formatIndicatorValue(activeAnalysis.condition.atrPercent, 2, "%")} (${conditionLabel(activeAnalysis.condition.volatilityState)})`,
    `체크포인트:`,
    ...analysis.checkpoints.map((item) => `- ${item}`),
    `위험 신호:`,
    ...(analysis.riskFlags.length ? analysis.riskFlags.map((item) => `- ${item}`) : ["- 없음"]),
    `추적 후보:`,
    ...(analysis.opportunityFlags.length ? analysis.opportunityFlags.map((item) => `- ${item}`) : ["- 없음"])
  ];

  return {
    title: `${symbol} ${timeframe} 레이더 저장`,
    bias: analysis.bias === "long" ? "롱" : analysis.bias === "short" ? "숏" : "관찰",
    note: noteParts.join("\n"),
    market: "crypto",
    source: "chart",
    symbol,
    timeframe,
    verdict: analysis.verdict
  };
}
