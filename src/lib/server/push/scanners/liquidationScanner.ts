// 푸시 크론용 청산압력 optional source 이벤트를 생성한다.
import { fetchLiquidationPressureReport } from "@/lib/server/liquidationPressureSource";
import { eventBucket } from "@/lib/server/push/duplicateGuard";
import type { PushAlertEvent } from "@/lib/server/push/types";

export async function scanLiquidationEvent(): Promise<PushAlertEvent | null> {
  const report = await fetchLiquidationPressureReport("BTCUSDT", "15m");
  if (report.grade !== "heated" && report.grade !== "extreme") return null;

  const pressure = Math.max(report.upsideShortPressure ?? 0, report.downsideLongPressure ?? 0);
  return {
    market: "crypto",
    ruleId: "liquidation-pressure",
    alertKind: "liquidation",
    eventKey: `liquidation-pressure:crypto:${report.symbol ?? "BTCUSDT"}:${report.grade}:${eventBucket(30)}`,
    title: "Chart Radar 청산 압력 확대 감지",
    body: `BTC 청산 압력이 ${report.grade === "extreme" ? "매우 높음" : "높음"} 구간입니다. 변동성 확대 가능성이 있어 리스크 확인이 필요합니다.`,
    data: {
      type: "liquidation-pressure",
      market: "crypto",
      alert_kind: "liquidation",
      alertKind: "liquidation",
      target: "/crypto",
      targetPath: "/crypto",
      pressure: String(pressure)
    },
    system: true
  };
}
