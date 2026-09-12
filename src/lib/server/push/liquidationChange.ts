import { liquidationChangeText, liquidationNextCheck, readLiquidationAlertSnapshot, type LiquidationChange } from "@/lib/liquidationAlert";
import type { RecentPushAlertEventRow } from "@/lib/server/push/duplicateGuard";
import type { PushAlertEvent } from "@/lib/server/push/types";

export function liquidationChange(recent: RecentPushAlertEventRow[], event: PushAlertEvent, now = Date.now()): LiquidationChange {
  const previous = recent.filter(row => row.rule_id === "liquidation-pressure" && row.market === event.market &&
    row.payload?.symbol === event.symbol && Date.parse(row.created_at) <= now &&
    (row.delivery_status === undefined || ["sent", "partial"].includes(row.delivery_status ?? "") || Number(row.payload?.sentCount) > 0))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
  const first: LiquidationChange = { reason: "first", previousPressure: null, previousSide: null, previousAt: null };
  if (!previous) return first;
  const raw = previous.payload?.pressure;
  const old = raw === null || raw === undefined || raw === "" ? Number.NaN : Number(raw);
  const pressure = Number(event.data.pressure);
  const previousSide = typeof previous.payload?.pressure_side === "string" ? previous.payload.pressure_side : null;
  const directional = ["downsideLongs", "upsideShorts"];
  const reversed = directional.includes(previousSide ?? "") && directional.includes(event.data.pressure_side) && previousSide !== event.data.pressure_side;
  return {
    reason: !directional.includes(previousSide ?? "") && directional.includes(event.data.pressure_side) ? "direction_confirmed" :
      reversed ? "side_changed" : Number.isFinite(old) && old < 75 && pressure >= 75 ? "extreme" :
      Number.isFinite(old) && pressure >= old + 10 ? "increase" : "unchanged",
    previousPressure: Number.isFinite(old) && old >= 0 && old <= 100 ? old : null,
    previousSide: ["downsideLongs", "upsideShorts", "balanced"].includes(previousSide ?? "") ? previousSide : null,
    previousAt: previous.created_at
  };
}

export function withLiquidationChange(event: PushAlertEvent, recent: RecentPushAlertEventRow[]): PushAlertEvent {
  if (event.ruleId !== "liquidation-pressure") return event;
  const alert = readLiquidationAlertSnapshot(event.auditEvidence?.snapshot.alert);
  if (!alert || !event.auditEvidence) return event;
  const change = liquidationChange(recent, event);
  return { ...event, body: liquidationChangeText(alert.pressure, change) + ". " + liquidationNextCheck(alert),
    auditEvidence: { ...event.auditEvidence, snapshot: { ...event.auditEvidence.snapshot, alert: { ...alert, change } } } };
}
