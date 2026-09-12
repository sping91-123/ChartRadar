// 푸시 크론용 청산압력 optional source 이벤트를 생성한다.
import { fetchLiquidationPressureReport } from "@/lib/server/liquidationPressureSource";
import { parseClosedBinanceKlines } from "@/lib/marketTime";
import { liquidationInputsReady, liquidationPriceContext, liquidationAlertKey, liquidationNextCheck, liquidationChangeText, type LiquidationAlertSnapshot, type LiquidationAlertSide } from "@/lib/liquidationAlert";
import type { PushAlertEvent } from "@/lib/server/push/types";

export async function scanLiquidationEvent(): Promise<PushAlertEvent | null> {
  const report = await fetchLiquidationPressureReport("BTCUSDT", "15m");
  if (!liquidationInputsReady(report)) return null;
  const response = await fetch("https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=15m&limit=7", {
    cache: "no-store", signal: AbortSignal.timeout(5500), headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error("Liquidation reference candles HTTP " + response.status);
  const rows = await response.json();
  const now = Date.now();
  // Recheck after fetching candles: data may have aged across the deadline.
  if (!liquidationInputsReady(report, now)) return null;
  const prices = liquidationPriceContext(parseClosedBinanceKlines(rows, now).candles, now);
  if (!prices) return null;

  const pressure = Math.max(report.upsideShortPressure ?? 0, report.downsideLongPressure ?? 0);
  const side = report.dominantSide as LiquidationAlertSide;
  const riskLabel = side === "downsideLongs" ? "하락 시 롱 청산 주의" : side === "upsideShorts" ? "상승 시 숏 청산 주의" : "양방향 청산 압력 주의";
  const alert: LiquidationAlertSnapshot = { version: 2, symbol: "BTCUSDT", observedAt: new Date(now).toISOString(),
    side, pressure, longAccountPercent: report.globalLongShort.longPercent!, shortAccountPercent: report.globalLongShort.shortPercent!, prices };
  const nextCheck = liquidationNextCheck(alert);
  const eventKey = liquidationAlertKey(alert);
  const crowdedPercent = side === "downsideLongs" ? report.globalLongShort.longPercent : side === "upsideShorts" ? report.globalLongShort.shortPercent : null;
  const evidence = Number.isFinite(crowdedPercent) ? `${side === "downsideLongs" ? "롱" : "숏"} 계정 ${crowdedPercent!.toFixed(1)}% · ` : "";
  return {
    market: "crypto",
    ruleId: "liquidation-pressure",
    alertKind: "liquidation",
    eventKey,
    symbol: report.symbol ?? "BTCUSDT",
    title: `BTC ${riskLabel}`,
    body: liquidationChangeText(pressure) + ". " + nextCheck,
    auditEvidence: {
      version: 1,
      capturedAt: new Date().toISOString(),
      source: "liquidation_inputs",
      snapshot: {
        alert,
        symbol: report.symbol,
        period: report.period,
        markPrice: report.markPrice,
        fundingRatePercent: report.fundingRatePercent,
        fundingRateSource: report.fundingRateSource,
        openInterestChangePercent: report.openInterestChangePercent,
        globalLongShort: report.globalLongShort,
        topAccountLongShort: report.topAccountLongShort,
        topPositionLongShort: report.topPositionLongShort,
        takerFlow: report.takerFlow,
        upsideShortPressure: report.upsideShortPressure,
        downsideLongPressure: report.downsideLongPressure,
        dominantSide: side,
        grade: report.grade,
        evidenceObservedAt: report.evidenceObservedAt,
        sourceUpdatedAt: report.updatedAt
      }
    },
    data: {
      type: "liquidation-pressure",
      market: "crypto",
      symbol: report.symbol ?? "BTCUSDT",
      alert_kind: "liquidation",
      alertKind: "liquidation",
      destination: "liquidation_alert",
      event_key: eventKey,
      observed_at: alert.observedAt,
      pressure: String(pressure),
      pressure_grade: report.grade,
      pressure_side: side,
      timeframe: report.period,
      evidence: evidence.replace(/ · $/, ""),
      next_check: nextCheck
    },
    system: true
  };
}
