export interface JournalEntry {
  id: string;
  title: string;
  bias: string;
  note: string;
  createdAt: string;
  source?: "manual" | "chart";
  symbol?: string;
  timeframe?: string;
  verdict?: string;
}

export const journalStorageKey = "coters.journal";

export function loadJournalEntries(): JournalEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const saved = window.localStorage.getItem(journalStorageKey);
    return saved ? (JSON.parse(saved) as JournalEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveJournalEntries(entries: JournalEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(journalStorageKey, JSON.stringify(entries));
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
