export type GlobalMarketMode = "Risk-On" | "Neutral" | "Risk-Off";

export function globalMarketModeFromScore(score: number, availableCount: number): GlobalMarketMode {
  if (!Number.isFinite(score) || availableCount < 6) return "Neutral";
  if (score >= 3.2) return "Risk-On";
  if (score <= -3.2) return "Risk-Off";
  return "Neutral";
}
