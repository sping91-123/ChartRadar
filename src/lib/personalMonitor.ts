import type { DecisionState, MonitorCondition, PerpetualDecisionSnapshot } from "@/lib/perpetualDecisionSnapshot";
import { decisionStateLabel, monitorConditionDisplayLabel, plainDecisionText } from "./perpetualDecisionCopy";
import { perpetualMonitorConditionVersion } from "./perpetualDecisionSnapshot";

export const watchIntentLabels = { watching: "진입 전 관망", long: "상승 방향 보유", short: "하락 방향 보유" } as const;
export type WatchIntent = keyof typeof watchIntentLabels;
export interface PersonalWatchContext {
  version: 1;
  intent: WatchIntent;
  savedAt: string;
  state: DecisionState;
  price: number;
  headline: string;
  topRisk: string;
}
export type PersonalMonitorCondition = MonitorCondition & { watchContext?: PersonalWatchContext };
export interface PersonalPriceInput { threshold: number; direction: "above" | "below" }
/** User-selected prices use the existing confirmed-close evaluator, never a new signal engine. */
export function personalPriceCondition(snapshot: PerpetualDecisionSnapshot, input: unknown): MonitorCondition | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  if (Object.keys(raw).some(k => k !== "threshold" && k !== "direction") ||
    typeof raw.threshold !== "number" || !Number.isFinite(raw.threshold) || raw.threshold <= 0 || raw.threshold > 100_000_000 ||
    (raw.direction !== "above" && raw.direction !== "below")) return null;
  const threshold = Math.round(raw.threshold * 1e8) / 1e8;
  if (threshold <= 0) return null;
  return { id: `${perpetualMonitorConditionVersion}:user-price:${snapshot.asset}:${raw.direction}:${threshold}`,
    kind: raw.direction === "above" ? "price_cross_above" : "price_cross_below", role: "confirmation", timeframe: "15m", threshold,
    label: `내 확인 가격 ${threshold.toLocaleString("en-US", { maximumFractionDigits: 8 })} USDT ${raw.direction === "above" ? "이상" : "이하"}에서 15분봉 마감`,
    basis: "사용자가 직접 정한 가격 · 확정된 15분봉 종가로 확인",
    expiresAt: new Date(Date.parse(snapshot.generatedAt) + 24 * 60 * 60_000).toISOString() };
}
export interface MonitorCurrentBrief {
  snapshotId: string;
  generatedAt: string;
  expiresAt: string;
  quality: PerpetualDecisionSnapshot["quality"];
  state: DecisionState;
  price: number;
  headline: string;
  topRisk: string;
  nextCheck: string;
}
export function isWatchIntent(value: unknown): value is WatchIntent {
  return typeof value === "string" && Object.hasOwn(watchIntentLabels, value);
}
export function readWatchContext(condition: MonitorCondition | null | undefined): PersonalWatchContext | null {
  const c = (condition as PersonalMonitorCondition | undefined)?.watchContext;
  return c?.version === 1 && isWatchIntent(c.intent) && Number.isFinite(Date.parse(c.savedAt)) &&
    Number.isFinite(c.price) && c.price > 0 && ["neutral", "upside_watch", "downside_watch", "risk"].includes(c.state) &&
    typeof c.headline === "string" && typeof c.topRisk === "string" ? c : null;
}
export function personalWatchContext(snapshot: PerpetualDecisionSnapshot, intent: WatchIntent): PersonalWatchContext {
  return { version: 1, intent, savedAt: snapshot.generatedAt, price: snapshot.price, state: snapshot.summary.state,
    headline: plainDecisionText(snapshot.summary.headline), topRisk: plainDecisionText(snapshot.summary.topRisk) };
}
export function monitorCurrentBrief(snapshot: PerpetualDecisionSnapshot): MonitorCurrentBrief {
  return { snapshotId: snapshot.id, generatedAt: snapshot.generatedAt, expiresAt: snapshot.expiresAt,
    quality: snapshot.quality, price: snapshot.price, state: snapshot.summary.state,
    headline: plainDecisionText(snapshot.summary.headline), topRisk: plainDecisionText(snapshot.summary.topRisk),
    nextCheck: monitorConditionDisplayLabel(snapshot.summary.primaryCondition) };
}
export function personalMonitorReason(intent: WatchIntent, condition: MonitorCondition) {
  if (intent === "watching") return "진입 전에 기다리던 조건이 바뀌었는지 확인합니다.";
  const side = intent === "long" ? "상승" : "하락";
  const adverse = intent === "long" ? "price_cross_below" : "price_cross_above";
  if (condition.kind === adverse) return `${side} 방향 보유 중 반대쪽 가격 기준을 확인합니다.`;
  return `${side} 방향 보유를 전제로, 저장한 조건 변화와 남은 위험을 다시 확인합니다.`;
}
/** Reorder only available canonical conditions; never invent a price or bypass Pro access. */
export function preferredWatchCondition(conditions: MonitorCondition[], intent: WatchIntent): MonitorCondition | undefined {
  const score = (c: MonitorCondition) => {
    if (intent === "watching") return c.role === "primary" ? 10 : 0;
    if (c.kind === (intent === "long" ? "price_cross_below" : "price_cross_above")) return 40;
    if (c.kind === "pressure_state_change" && c.targetPressure === (intent === "long" ? "downsideLongs" : "upsideShorts")) return 30;
    if (c.kind === "decision_state_change" && (!c.targetState || c.targetState === "risk" || c.targetState === (intent === "long" ? "downside_watch" : "upside_watch"))) return 20;
    return c.role === "primary" ? 10 : 0;
  };
  const frameOrder = { "15m": 0, "1h": 1, "4h": 2 };
  return [...conditions].sort((a, b) => score(b) - score(a) || frameOrder[a.timeframe] - frameOrder[b.timeframe])[0];
}
export function monitorChangeSummary(context: PersonalWatchContext | null, current: MonitorCurrentBrief | null | undefined, now = Date.now(), mode: "latest" | "last_check" = "latest") {
  const observed = Date.parse(current?.generatedAt ?? "");
  const currentReady = Boolean(current && current.quality === "ready" && Number.isFinite(observed) &&
    observed <= now && now - observed <= 7 * 60_000 && (mode === "last_check" || Date.parse(current.expiresAt) > now) &&
    Number.isFinite(current.price) && current.price > 0 && (!context || observed >= Date.parse(context.savedAt)));
  if (!currentReady || !current) return { ready: false, changed: false, title: "최신 비교를 확인하지 못했습니다.", priceChange: null };
  if (!context) return { ready: true, changed: false, title: "저장 당시 개인 상황이 없는 기존 감시입니다.", priceChange: null };
  const changed = context.state !== current.state;
  return { ready: true, changed, title: changed ? `${decisionStateLabel(context.state)} → ${decisionStateLabel(current.state)}` : `시장 판단은 ${decisionStateLabel(current.state)} 유지`,
    priceChange: ((current.price - context.price) / context.price) * 100 };
}
