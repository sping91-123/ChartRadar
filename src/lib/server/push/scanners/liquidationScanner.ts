// 푸시 크론용 청산압력 optional source 이벤트를 생성한다.
import { fetchLiquidationPressureReport } from "@/lib/server/liquidationPressureSource";
import { eventBucket } from "@/lib/server/push/duplicateGuard";
import type { PushAlertEvent } from "@/lib/server/push/types";

export async function scanLiquidationEvent(): Promise<PushAlertEvent | null> {
  const report = await fetchLiquidationPressureReport("BTCUSDT", "15m");
  if (report.grade !== "heated" && report.grade !== "extreme") return null;

  const pressure = Math.max(report.upsideShortPressure ?? 0, report.downsideLongPressure ?? 0);
  const side = report.dominantSide;
  const riskLabel = side === "downsideLongs" ? "하락 시 롱 청산 주의" : side === "upsideShorts" ? "상승 시 숏 청산 주의" : "양방향 청산 압력 주의";
  const nextCheck = side === "downsideLongs" ? "15분봉의 지지 유지 여부" : side === "upsideShorts" ? "15분봉의 저항 돌파 여부" : "15분봉의 상·하단 이탈 여부";
  const crowdedPercent = side === "downsideLongs" ? report.globalLongShort.longPercent : side === "upsideShorts" ? report.globalLongShort.shortPercent : null;
  const evidence = Number.isFinite(crowdedPercent) ? `${side === "downsideLongs" ? "롱" : "숏"} 계정 ${crowdedPercent!.toFixed(1)}% · ` : "";
  return {
    market: "crypto",
    ruleId: "liquidation-pressure",
    alertKind: "liquidation",
    eventKey: `liquidation-pressure:crypto:${report.symbol ?? "BTCUSDT"}:${report.grade}:${eventBucket(30)}`,
    symbol: report.symbol ?? "BTCUSDT",
    title: `BTC ${riskLabel}`,
    body: `${evidence}청산 압력 추정 ${pressure}/100. ${nextCheck}를 확인하세요.`,
    auditEvidence: {
      version: 1,
      capturedAt: new Date().toISOString(),
      source: "liquidation_inputs",
      snapshot: {
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
      target: "/crypto",
      targetPath: "/crypto",
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
