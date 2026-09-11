import type { DecisionJournalContext } from "@/lib/journal";
import { isUuid, type PerpetualScenarioMonitor } from "@/lib/perpetualMonitor";

export const decisionReviewChoices = {
  kept: "기준 유지", changed: "기준 수정", waited: "관망 유지", insufficient: "자료 부족"
} as const;
export interface DecisionReview {
  conclusion: keyof typeof decisionReviewChoices;
  nextCheck: string;
  reviewedAt: string;
}
export function readDecisionReviewInput(value: unknown): Pick<DecisionReview, "conclusion" | "nextCheck"> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.conclusion !== "string" || !Object.hasOwn(decisionReviewChoices, raw.conclusion) ||
    typeof raw.nextCheck !== "string" || !raw.nextCheck.trim() || raw.nextCheck.trim().length > 240 ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(raw.nextCheck)) return null;
  return { conclusion: raw.conclusion as DecisionReview["conclusion"], nextCheck: raw.nextCheck.trim() };
}
export function readDecisionReview(value: unknown): DecisionReview | null {
  const input = readDecisionReviewInput(value);
  const reviewedAt = (value as Partial<DecisionReview> | null)?.reviewedAt;
  return input && typeof reviewedAt === "string" && Number.isFinite(Date.parse(reviewedAt)) ? { ...input, reviewedAt } : null;
}
export interface WorkspaceJournal {
  id: string;
  createdAt: string;
  context: DecisionJournalContext;
  review: DecisionReview | null;
}
export interface WorkspaceJournalRow {
  id: string;
  created_at: string;
  decision_snapshot_id: string | null;
  decision_context: DecisionJournalContext | null;
}
export function toWorkspaceJournal(row: WorkspaceJournalRow): WorkspaceJournal | null {
  const c = row.decision_context;
  if (!isUuid(row.id) || !c || !isUuid(c.snapshotId) || row.decision_snapshot_id !== c.snapshotId ||
    !["btc", "eth"].includes(c.asset) || typeof c.headline !== "string" || typeof c.topRisk !== "string" ||
    typeof c.primaryCondition?.label !== "string" || !Number.isFinite(Date.parse(c.generatedAt))) return null;
  return { id: row.id, createdAt: row.created_at, context: c, review: readDecisionReview(c.review) };
}
export interface DecisionWorkspaceData {
  monitors: PerpetualScenarioMonitor[];
  history: PerpetualScenarioMonitor[];
  journals: WorkspaceJournal[];
  focusedJournal: WorkspaceJournal | null;
  unavailableJournalCount: number;
  checkedAt: string;
}
export function workspaceSummary(data: DecisionWorkspaceData, now = Date.now()) {
  const running = data.monitors.filter(m => m.status === "active" && Date.parse(m.expiresAt) > now);
  const checked = running.filter(m => {
    const last = Date.parse(m.lastEvaluatedAt ?? "");
    return last <= now && now - last <= 7 * 60000 && m.lastEvaluation?.quality === "ready";
  });
  return { running: running.length, checked: checked.length, pending: data.journals.filter(j => !j.review).length,
    reviewed: data.journals.filter(j => j.review).length };
}
export function workspaceAnalysisHref(asset: "btc" | "eth", snapshotId?: string | null) {
  const params = new URLSearchParams({ asset, timeframe: "15m" });
  if (isUuid(snapshotId)) params.set("snapshot", snapshotId);
  return `/crypto/perpetual?${params.toString()}`;
}
