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

export interface JournalEntry {
  id: string;
  title: string;
  bias: string;
  note: string;
  createdAt: string;
  market?: "crypto" | "stocks";
  source?: "manual" | "chart" | "scout";
  symbol?: string;
  timeframe?: string;
  verdict?: string;
  /** Scout 저장 시에만 존재 */
  scoutSnapshot?: ScoutSnapshot;
  /** 결과 기록 (W/L/BE/missed) */
  outcome?: OutcomeType;
  /** 결과 기록 시각 */
  outcomeAt?: string;
}

export const journalStorageKey = "chartRadar.journal";
const legacyUntitledRiskJournalStorageKey = "untitledRisk.journal";
const legacyPositionGuardJournalStorageKey = "positionguard.journal";
const legacyJournalStorageKey = "co" + "ters.journal";

export function loadJournalEntries(): JournalEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const saved =
      window.localStorage.getItem(journalStorageKey) ??
      window.localStorage.getItem(legacyUntitledRiskJournalStorageKey) ??
      window.localStorage.getItem(legacyPositionGuardJournalStorageKey) ??
      window.localStorage.getItem(legacyJournalStorageKey);
    if (saved) {
      window.localStorage.setItem(journalStorageKey, saved);
      window.localStorage.removeItem(legacyUntitledRiskJournalStorageKey);
      window.localStorage.removeItem(legacyPositionGuardJournalStorageKey);
      window.localStorage.removeItem(legacyJournalStorageKey);
    }
    return saved ? (JSON.parse(saved) as JournalEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveJournalEntries(entries: JournalEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(journalStorageKey, JSON.stringify(entries));
  window.localStorage.removeItem(legacyUntitledRiskJournalStorageKey);
  window.localStorage.removeItem(legacyPositionGuardJournalStorageKey);
  window.localStorage.removeItem(legacyJournalStorageKey);
}

export function appendJournalEntry(entry: Omit<JournalEntry, "id" | "createdAt">) {
  const current = loadJournalEntries();
  const next: JournalEntry[] = [
    {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    },
    ...current
  ];

  saveJournalEntries(next);
  return next;
}
