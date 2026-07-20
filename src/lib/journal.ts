import type { PerpetualDecisionSnapshot } from "@/lib/perpetualDecisionSnapshot";

/** Scout 셋업 저장 시 결과 추적용 구조화 데이터 */
export interface ScoutSnapshot {
  entryLow: number;
  entryHigh: number;
  invalidation: number;
  target1: number;
  target2: number;
  side: "long" | "short";
  score: number;
  quality: string;
  scannedAt: string | number;
}

/** W/L/BE 결과 기록 */
export type OutcomeType = "win" | "loss" | "breakeven" | "missed";

export interface DecisionJournalContext {
  asset: "btc" | "eth";
  symbol: "BTCUSDT" | "ETHUSDT";
  snapshotId: string;
  generatedAt: string;
  quality: "ready" | "partial" | "stale" | "unavailable";
  state: "neutral" | "upside_watch" | "downside_watch" | "risk";
  headline: string;
  topRisk: string;
  primaryCondition: {
    id: string;
    label: string;
    role: "primary" | "confirmation" | "invalidation";
  };
}

export function decisionJournalContextFromSnapshot(snapshot: PerpetualDecisionSnapshot): DecisionJournalContext {
  return {
    asset: snapshot.asset,
    symbol: snapshot.symbol,
    snapshotId: snapshot.id,
    generatedAt: snapshot.generatedAt,
    quality: snapshot.quality,
    state: snapshot.summary.state,
    headline: snapshot.summary.headline,
    topRisk: snapshot.summary.topRisk,
    primaryCondition: {
      id: snapshot.summary.primaryCondition.id,
      label: snapshot.summary.primaryCondition.label,
      role: snapshot.summary.primaryCondition.role
    }
  };
}

export interface JournalEntry {
  id: string;
  title: string;
  bias: string;
  note: string;
  createdAt: string;
  market?: "crypto" | "stocks";
  source?: "manual" | "chart" | "scout" | "snapshot" | "alert";
  symbol?: string;
  timeframe?: string;
  verdict?: string;
  /** Scout 저장 시에만 존재 */
  scoutSnapshot?: ScoutSnapshot;
  /** 결과 기록 (W/L/BE/missed) */
  outcome?: OutcomeType;
  /** 결과 기록 시각 */
  outcomeAt?: string;
  decisionSnapshotId?: string;
  monitorId?: string;
  decisionContext?: DecisionJournalContext;
}

export const journalStorageKey = "chartRadar.journal";
export const guestJournalStorageKey = "chartRadar.journal.guest";
const userJournalStorageKeyPrefix = "chartRadar.journal.user.";
const sessionStorageKey = "chartRadar.supabase.session";
const legacyUntitledRiskJournalStorageKey = "untitledRisk.journal";
const legacyPreviousBrandJournalStorageKey = `${"position"}${"guard"}.journal`;
const legacyJournalStorageKey = "co" + "ters.journal";

function storedSessionOwner() {
  if (typeof window === "undefined") return { authenticated: false, userId: null as string | null };
  try {
    const raw = window.localStorage.getItem(sessionStorageKey);
    if (!raw) return { authenticated: false, userId: null as string | null };
    const session = JSON.parse(raw) as { accessToken?: string; userId?: string };
    return {
      authenticated: Boolean(session.accessToken),
      userId: typeof session.userId === "string" && session.userId.trim() ? session.userId.trim() : null
    };
  } catch {
    return { authenticated: false, userId: null as string | null };
  }
}

export function journalStorageKeyForOwner(ownerId?: string | null) {
  if (typeof ownerId === "string" && ownerId.trim()) {
    return `${userJournalStorageKeyPrefix}${encodeURIComponent(ownerId.trim())}`;
  }
  if (ownerId === null) return guestJournalStorageKey;
  const storedOwner = storedSessionOwner();
  if (storedOwner.userId) return `${userJournalStorageKeyPrefix}${encodeURIComponent(storedOwner.userId)}`;
  return storedOwner.authenticated ? null : guestJournalStorageKey;
}

function migrateGuestJournal(targetKey: string) {
  const saved =
    window.localStorage.getItem(targetKey) ??
    window.localStorage.getItem(journalStorageKey) ??
    window.localStorage.getItem(legacyUntitledRiskJournalStorageKey) ??
    window.localStorage.getItem(legacyPreviousBrandJournalStorageKey) ??
    window.localStorage.getItem(legacyJournalStorageKey);
  if (saved) window.localStorage.setItem(targetKey, saved);
  window.localStorage.removeItem(journalStorageKey);
  window.localStorage.removeItem(legacyUntitledRiskJournalStorageKey);
  window.localStorage.removeItem(legacyPreviousBrandJournalStorageKey);
  window.localStorage.removeItem(legacyJournalStorageKey);
  return saved;
}

export function loadJournalEntries(ownerId?: string | null): JournalEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const key = journalStorageKeyForOwner(ownerId);
    if (!key) return [];
    const saved = key === guestJournalStorageKey
      ? migrateGuestJournal(key)
      : window.localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as JournalEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveJournalEntries(entries: JournalEntry[], ownerId?: string | null) {
  if (typeof window === "undefined") return false;
  const key = journalStorageKeyForOwner(ownerId);
  if (!key) return false;
  window.localStorage.setItem(key, JSON.stringify(entries));
  if (key === guestJournalStorageKey) migrateGuestJournal(key);
  return true;
}

export function appendJournalEntry(entry: Omit<JournalEntry, "id" | "createdAt">, ownerId?: string | null) {
  const key = journalStorageKeyForOwner(ownerId);
  if (!key) throw new Error("Authenticated journal owner is not available.");
  const current = loadJournalEntries(ownerId);
  const next: JournalEntry[] = [
    {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    },
    ...current
  ];

  if (!saveJournalEntries(next, ownerId)) throw new Error("Journal entry could not be stored.");
  return next;
}
