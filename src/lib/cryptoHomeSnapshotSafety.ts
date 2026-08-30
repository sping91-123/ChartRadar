import type { ChartTimeframe } from "./marketAnalysis";
import { sourceAgeMs } from "./marketTime";
import type { CryptoExchangeMarket, CryptoHomeSnapshot } from "./server/cryptoExchangeData";

const homeTimeframes: ChartTimeframe[] = ["5m", "15m", "1h", "4h", "1d"];
const pressureFreshnessMs = 70 * 60 * 1000;
const homeTimeframeFreshnessMs: Record<ChartTimeframe, number> = {
  "5m": 8 * 60 * 1000,
  "15m": 20 * 60 * 1000,
  "1h": 70 * 60 * 1000,
  "4h": 250 * 60 * 1000,
  "1d": 25 * 60 * 60 * 1000
};
const timeframeLabels: Record<ChartTimeframe, string> = {
  "5m": "5분",
  "15m": "15분",
  "1h": "1시간",
  "4h": "4시간",
  "1d": "일봉"
};

function compactUsdtSwapTarget(value: string) {
  const withoutPerpetualSuffix = value.endsWith(".P") ? value.slice(0, -2) : value;
  if (/^[A-Z0-9]+$/.test(withoutPerpetualSuffix)) return withoutPerpetualSuffix;
  const symbolMatch = withoutPerpetualSuffix.match(/^([A-Z0-9]+)\/USDT(?::USDT)?$/);
  return symbolMatch ? `${symbolMatch[1]}USDT` : null;
}

export function findExchangeMarket(markets: CryptoExchangeMarket[], symbol: string | null | undefined) {
  const target = symbol?.trim();
  if (!target) return null;
  const normalizedTarget = target.toUpperCase();
  const compactTarget = compactUsdtSwapTarget(normalizedTarget);
  return (
    markets.find((market) => market.symbol.toUpperCase() === normalizedTarget || market.marketId.toUpperCase() === normalizedTarget) ??
    markets.find((market) => market.base.toUpperCase() === normalizedTarget) ??
    (compactTarget
      ? markets.find((market) => market.marketId.toUpperCase() === compactTarget || `${market.base.toUpperCase()}USDT` === compactTarget)
      : undefined) ??
    null
  );
}

export function classifyCryptoHomeSnapshotQuality(input: {
  asOfMs: number;
  observedAtByTimeframe: Partial<Record<ChartTimeframe, string | null>>;
  hasLiveTicker: boolean;
  pressureSource: CryptoHomeSnapshot["pressure"]["source"];
  pressureEvidence: Array<{ available: boolean; observedAt: number | null; maxAgeMs?: number }>;
}) {
  const staleTimeframes = homeTimeframes.filter((timeframe) => (
    sourceAgeMs(input.observedAtByTimeframe[timeframe] ?? null, input.asOfMs) > homeTimeframeFreshnessMs[timeframe]
  ));
  if (staleTimeframes.length) {
    return {
      quality: "stale" as const,
      detail: `${staleTimeframes.map((timeframe) => timeframeLabels[timeframe]).join("·")} 확정봉 기준시각이 오래됐습니다.`
    };
  }
  if (!input.hasLiveTicker) {
    return { quality: "partial" as const, detail: "실시간 가격을 확인하지 못해 최신 확정봉 가격을 사용했습니다." };
  }
  if (input.pressureSource === "binance-public-proxy") {
    return { quality: "partial" as const, detail: "포지션 쏠림은 Binance 공개 파생 데이터를 참고했습니다." };
  }
  if (input.pressureSource === "ccxt-public-partial") {
    return { quality: "partial" as const, detail: "공개 파생 데이터 일부가 제한되어 구조 중심으로 분석했습니다." };
  }
  const availablePressureEvidence = input.pressureEvidence.filter((item) => item.available);
  if (availablePressureEvidence.length < 2) {
    return { quality: "partial" as const, detail: "포지션 쏠림을 판단할 공개 파생 근거가 충분하지 않습니다." };
  }
  const hasStalePressureEvidence = availablePressureEvidence.some((item) => (
    !Number.isFinite(item.observedAt) || sourceAgeMs(
      item.observedAt === null ? null : new Date(item.observedAt).toISOString(),
      input.asOfMs
    ) > (item.maxAgeMs ?? pressureFreshnessMs)
  ));
  if (hasStalePressureEvidence) {
    return { quality: "partial" as const, detail: "포지션 쏠림 데이터의 기준시각을 최신으로 확인하지 못했습니다." };
  }
  return { quality: "ready" as const, detail: "필요한 확정봉과 공개 파생 데이터를 정상 확인했습니다." };
}
