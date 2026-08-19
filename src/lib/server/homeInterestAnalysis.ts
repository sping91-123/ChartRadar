import type { HomeInterestAnalysisSummary, HomeInterestSummaryTimeframe } from "@/lib/homeInterestAnalysis";
import type { DirectionState } from "@/lib/marketAnalysis";
import type { CryptoHomeSnapshot } from "@/lib/server/cryptoExchangeData";

const homeTimeframes = new Set<HomeInterestSummaryTimeframe>(["15m", "1h", "4h"]);

function isHomeTimeframe(value: string): value is HomeInterestSummaryTimeframe {
  return homeTimeframes.has(value as HomeInterestSummaryTimeframe);
}

function directionalState(value: DirectionState) {
  return value === "bullish" || value === "bearish";
}

function headline(snapshot: CryptoHomeSnapshot) {
  if (snapshot.direction === "up") return "현재는 오르는 근거가 더 많습니다.";
  if (snapshot.direction === "down") return "현재는 내리는 근거가 더 많습니다.";
  return "한쪽 방향 근거가 뚜렷하지 않습니다.";
}

function summaryCopy(snapshot: CryptoHomeSnapshot) {
  const context = snapshot.timeframes.filter((item) => isHomeTimeframe(item.timeframe));
  const established = context.map((item) => item.msb).filter(directionalState);
  const hasBullish = established.includes("bullish");
  const hasBearish = established.includes("bearish");
  const hasUnknown = context.some((item) => !directionalState(item.msb));

  const topRisk = hasBullish && hasBearish
    ? "짧은 흐름과 큰 흐름이 엇갈려 변동이 빠르게 되돌려질 수 있습니다."
    : hasUnknown
      ? "아직 확인된 구조가 부족해 작은 움직임을 추세로 오해하기 쉽습니다."
      : snapshot.pressure.dominant !== "balanced"
        ? "포지션이 한쪽으로 몰려 반대 움직임 때 변동성이 커질 수 있습니다."
        : "방향이 맞더라도 짧은 변동만 보고 따라가면 되돌림에 흔들릴 수 있습니다.";

  const nextCheck = hasUnknown || hasBullish === hasBearish
    ? "15분·1시간·4시간 화살표가 한쪽으로 모이는지 확인하세요."
    : snapshot.direction === "up"
      ? "15분 상승 흐름이 1시간까지 이어지는지 확인하세요."
      : "15분 하락 흐름이 1시간까지 이어지는지 확인하세요.";

  return { headline: headline(snapshot), topRisk, nextCheck };
}

function pressureSummary(snapshot: CryptoHomeSnapshot) {
  if (snapshot.pressure.dominant === "long") return "롱 쏠림 신호가 더 크게 잡힙니다.";
  if (snapshot.pressure.dominant === "short") return "숏 쏠림 신호가 더 크게 잡힙니다.";
  return "롱과 숏 쏠림이 비슷합니다.";
}

export function serializeHomeInterestAnalysis(
  snapshot: CryptoHomeSnapshot,
  canSeeProDetail: boolean
): HomeInterestAnalysisSummary {
  const timeframes = snapshot.timeframes
    .filter((item) => isHomeTimeframe(item.timeframe))
    .map((item) => ({
      timeframe: item.timeframe as HomeInterestSummaryTimeframe,
      label: item.label,
      structure: item.msb
    }));

  return {
    access: canSeeProDetail ? "coin_pro" : "basic",
    selection: {
      exchangeId: snapshot.selection.exchangeId,
      exchangeLabel: snapshot.selection.exchangeLabel,
      marketId: snapshot.selection.marketId,
      base: snapshot.selection.base,
      quote: snapshot.selection.quote
    },
    price: snapshot.price,
    changePercent: snapshot.changePercent,
    updatedAt: snapshot.updatedAt,
    direction: snapshot.direction,
    directionLabel: snapshot.directionLabel,
    compositeScore: snapshot.compositeScore,
    chart: {
      timeframe: "15m",
      candles: snapshot.chartCandles.slice(-64),
      candlesByTimeframe: {
        "15m": (snapshot.chartCandlesByTimeframe?.["15m"] ?? snapshot.chartCandles).slice(-64),
        "1h": (snapshot.chartCandlesByTimeframe?.["1h"] ?? []).slice(-64),
        "4h": (snapshot.chartCandlesByTimeframe?.["4h"] ?? []).slice(-64)
      }
    },
    summary: summaryCopy(snapshot),
    timeframes,
    pressure: {
      dominant: snapshot.pressure.dominant,
      summary: pressureSummary(snapshot)
    },
    ...(canSeeProDetail
      ? {
          pro: {
            timeframes: snapshot.timeframes
              .filter((item) => isHomeTimeframe(item.timeframe))
              .map((item) => ({
                timeframe: item.timeframe as HomeInterestSummaryTimeframe,
                label: item.label,
                structure: item.msb,
                transition: item.choch,
                score: item.score,
                regime: item.regime
              })),
            pressure: {
              longScore: snapshot.pressure.longScore,
              shortScore: snapshot.pressure.shortScore,
              evidence: snapshot.pressure.evidence
                .filter((item) => item.available)
                .slice(0, 6)
                .map((item) => ({ label: item.label, value: item.value })),
              source: snapshot.pressure.source
            }
          }
        }
      : {})
  };
}
