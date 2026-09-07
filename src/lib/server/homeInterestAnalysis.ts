import type { HomeInterestAnalysisSummary, HomeInterestChartTimeframe, HomeInterestSummaryTimeframe } from "@/lib/homeInterestAnalysis";
import type { DirectionState } from "@/lib/marketAnalysis";
import type { CryptoHomeSnapshot } from "@/lib/server/cryptoExchangeData";

const homeTimeframes = new Set<HomeInterestSummaryTimeframe>(["5m", "15m", "1h", "4h", "1d"]);
const homeChartTimeframes = new Set<HomeInterestChartTimeframe>(["15m", "1h", "4h"]);

function isHomeTimeframe(value: string): value is HomeInterestSummaryTimeframe {
  return homeTimeframes.has(value as HomeInterestSummaryTimeframe);
}

function isHomeChartTimeframe(value: string): value is HomeInterestChartTimeframe {
  return homeChartTimeframes.has(value as HomeInterestChartTimeframe);
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
  const context = snapshot.timeframes.filter((item) => isHomeChartTimeframe(item.timeframe));
  const established = context.map((item) => item.msb).filter(directionalState);
  const hasBullish = established.includes("bullish");
  const hasBearish = established.includes("bearish");
  const hasUnknown = context.some((item) => !directionalState(item.msb));

  const summaryHeadline = hasBullish && hasBearish
    ? "큰 흐름과 현재 방향이 엇갈려 지금은 기다릴 때입니다."
    : established.length < 2
      ? "확인된 구조가 부족해 지금은 판단을 서두르기 어렵습니다."
      : headline(snapshot);

  const topRisk = hasBullish && hasBearish
    ? "짧은 흐름과 큰 흐름이 엇갈려 변동이 빠르게 되돌려질 수 있습니다."
    : hasUnknown
      ? "아직 확인된 구조가 부족해 작은 움직임을 추세로 오해하기 쉽습니다."
      : snapshot.pressure.dominant !== "balanced"
        ? "포지션이 한쪽으로 몰려 반대 움직임 때 변동성이 커질 수 있습니다."
        : "방향이 맞더라도 짧은 변동만 보고 따라가면 되돌림에 흔들릴 수 있습니다.";

  const nextCondition = hasUnknown || hasBullish === hasBearish
    ? {
        label: "15분·1시간·4시간 확정봉 방향이 한쪽으로 모이는지 확인하세요.",
        met: "한쪽으로 정렬되면 상세 분석에서 방향을 다시 확인합니다.",
        unmet: "계속 엇갈리면 방향을 보류하고 기다립니다.",
        note: "실시간 움직임이 아닌 확정봉 기준입니다."
      }
    : hasBullish
      ? {
          label: "다음 15분 확정봉에서도 상승 구조가 유지되고 1시간 흐름도 상승으로 이어지는지 확인하세요.",
          met: "15분·1시간이 함께 유지되면 현재 해석을 계속 추적합니다.",
          unmet: "둘 중 하나가 꺾이면 추격하지 않고 기다립니다.",
          note: "실시간 움직임이 아닌 확정봉 기준입니다."
        }
      : {
          label: "다음 15분 확정봉에서도 하락 구조가 유지되고 1시간 흐름도 하락으로 이어지는지 확인하세요.",
          met: "15분·1시간이 함께 유지되면 현재 해석을 계속 추적합니다.",
          unmet: "둘 중 하나가 반대로 꺾이면 추격하지 않고 기다립니다.",
          note: "실시간 움직임이 아닌 확정봉 기준입니다."
        };

  return { headline: summaryHeadline, topRisk, nextCheck: nextCondition.label, nextCondition };
}

function pressureSummary(snapshot: CryptoHomeSnapshot) {
  if (snapshot.pressure.dominant === "long") return "롱 쏠림 신호가 더 크게 잡힙니다.";
  if (snapshot.pressure.dominant === "short") return "숏 쏠림 신호가 더 크게 잡힙니다.";
  return "롱과 숏 쏠림이 비슷합니다.";
}

function pressureSourceLabel(snapshot: CryptoHomeSnapshot) {
  if (snapshot.pressure.source === "binance-public-proxy") return "Binance 공개 파생 데이터 참고";
  if (snapshot.pressure.source === "ccxt-public-partial") return `${snapshot.selection.exchangeLabel} 공개 데이터 일부`;
  return "Binance 공개 파생 데이터";
}

function directionCopy(value: DirectionState) {
  if (value === "bullish") return "상승";
  if (value === "bearish") return "하락";
  if (value === "neutral") return "중립";
  return "확인 중";
}

function proInsight(snapshot: CryptoHomeSnapshot) {
  const core = snapshot.timeframes.filter((item) => isHomeChartTimeframe(item.timeframe));
  const structure = core.map((item) => `${item.label} ${directionCopy(item.msb)}`).join(" · ");
  const transitions = core.filter((item) => directionalState(item.choch));
  const transition = transitions.length
    ? `${transitions.map((item) => `${item.label} ${directionCopy(item.choch)} 전환`).join(" · ")} 신호를 함께 확인합니다.`
    : "15분·1시간·4시간에서 새 방향 전환 신호는 아직 뚜렷하지 않습니다.";
  return {
    structure: structure || "핵심 시간대 구조를 확인하고 있습니다.",
    transition,
    pressure: `${pressureSummary(snapshot)} ${pressureSourceLabel(snapshot)}입니다.`
  };
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
      observedAt: item.observedAt,
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
    generatedAt: snapshot.generatedAt,
    observedAt: snapshot.observedAt,
    expiresAt: snapshot.expiresAt,
    quality: snapshot.quality,
    qualityDetail: snapshot.qualityDetail,
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
      summary: pressureSummary(snapshot),
      sourceLabel: pressureSourceLabel(snapshot)
    },
    ...(canSeeProDetail
      ? {
          pro: {
            insight: proInsight(snapshot),
            timeframes: snapshot.timeframes
              .filter((item) => isHomeChartTimeframe(item.timeframe))
              .map((item) => ({
                timeframe: item.timeframe as HomeInterestChartTimeframe,
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

// Keep anonymous compatibility responses on the same allowlisted projection.
export function serializeLegacyHomeSnapshot(snapshot: CryptoHomeSnapshot, canSeeProDetail: boolean) {
  return canSeeProDetail ? snapshot : serializeHomeInterestAnalysis(snapshot, false);
}
