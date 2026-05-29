import { getLiquidCryptoSymbols } from "@/lib/cryptoUniverse";
import { chartTimeframes, type ChartTimeframe, type TradingMode } from "@/lib/marketAnalysis";
import { scanAllSetups, type ScoutSetup } from "@/lib/setupScout";
import { sideLabel, stockQuality, topPushSetups } from "@/lib/server/push/eventBuilders";
import { fetchStockCandles } from "@/lib/stockMarket";
import { analyzeTechnicalRadar } from "@/lib/technicalRadar";

const cryptoModes: TradingMode[] = ["scalp", "swing"];

export const stockMomentumSymbols = ["QQQ", "SPY", "NQ=F", "ES=F", "^VIX", "VIXY", "SMH", "SOXX", "NVDA", "AMD", "UUP", "GLD", "TLT"];

function asChartTimeframe(value: string): ChartTimeframe {
  return chartTimeframes.includes(value as ChartTimeframe) ? (value as ChartTimeframe) : "1d";
}

function stockModeFromTimeframe(timeframe: ChartTimeframe): TradingMode {
  return timeframe === "5m" || timeframe === "15m" ? "scalp" : "swing";
}

async function buildStockSetup(symbol: string, timeframe: ChartTimeframe): Promise<ScoutSetup | null> {
  const candles = await fetchStockCandles(symbol, timeframe);
  if (candles.length < 60) return null;

  const report = analyzeTechnicalRadar(candles);
  if (!report.price) return null;

  const edge = report.bullishCount - report.bearishCount;
  if (Math.abs(edge) < 2) return null;

  const side: ScoutSetup["plan"]["side"] = edge > 0 ? "long" : "short";
  const score = Math.min(95, Math.max(50, 55 + Math.abs(edge) * 8));
  const mode = stockModeFromTimeframe(timeframe);
  const support = report.supportResistance.support;
  const resistance = report.supportResistance.resistance;

  return {
    symbol,
    mode,
    timeframe,
    analysis: {} as ScoutSetup["analysis"],
    plan: {
      mode,
      side,
      quality: stockQuality(score),
      title: side === "long" ? "글로벌 기술 레이더 상승 우세" : "글로벌 기술 레이더 하락 우세",
      entryLabel: "현재 기술지표 재감지",
      entryLow: report.price,
      entryHigh: report.price,
      invalidation: side === "long" ? support ?? report.price * 0.98 : resistance ?? report.price * 1.02,
      target1: side === "long" ? resistance ?? report.price * 1.03 : support ?? report.price * 0.97,
      target2: side === "long" ? report.price * 1.06 : report.price * 0.94,
      rr1: 1,
      rr2: 2,
      confidence: score,
      reason: report.summary,
      cautions: []
    },
    score,
    status: "active",
    headline: `${symbol} ${timeframe} ${sideLabel(side, "stocks")} 재감지`,
    distancePercent: 0,
    insideZone: true,
    proximity: "ready",
    currentPrice: report.price,
    scannedAt: new Date().toISOString()
  };
}

export async function scanCryptoSetups() {
  const symbolGroups = await Promise.all([
    getLiquidCryptoSymbols({ includeMajor: true, limit: 40 }),
    getLiquidCryptoSymbols({ excludeMajor: true, limit: 36 })
  ]);
  const symbols = Array.from(new Set(["BTCUSDT.P", "ETHUSDT.P", ...symbolGroups.flat()]));
  const settled = await Promise.allSettled(
    cryptoModes.map(async (mode) => {
      const all = await scanAllSetups({ mode, riskProfile: "radar", symbols });
      return topPushSetups(all, 16);
    })
  );
  return settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

export async function scanStockSetups(symbolsAndTimeframes: Array<{ symbol: string; timeframe: string }>) {
  const unique = Array.from(new Set(symbolsAndTimeframes.map((item) => `${item.symbol}:${item.timeframe}`)));
  const settled = await Promise.allSettled(
    unique.map(async (key) => {
      const [symbol, rawTimeframe] = key.split(":");
      return buildStockSetup(symbol ?? "QQQ", asChartTimeframe(rawTimeframe ?? "1d"));
    })
  );
  return settled.flatMap((result) => (result.status === "fulfilled" && result.value ? [result.value] : []));
}
