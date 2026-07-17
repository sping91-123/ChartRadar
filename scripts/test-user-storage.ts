import assert from "node:assert/strict";
import {
  appendJournalEntry,
  guestJournalStorageKey,
  journalStorageKey,
  journalStorageKeyForOwner,
  loadJournalEntries,
  saveJournalEntries,
  type JournalEntry
} from "../src/lib/journal";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { localStorage: storage }
});

const userA = "00000000-0000-4000-8000-000000000001";
const userB = "00000000-0000-4000-8000-000000000002";
const legacyEntry: JournalEntry = {
  id: "legacy-entry",
  title: "legacy",
  bias: "neutral",
  note: "private",
  createdAt: "2026-07-16T00:00:00.000Z"
};

storage.setItem(journalStorageKey, JSON.stringify([legacyEntry]));
storage.setItem("chartRadar.supabase.session", JSON.stringify({ accessToken: "token-a", userId: userA }));
assert.deepEqual(loadJournalEntries(), [], "authenticated users must never inherit the unowned legacy journal");
assert.equal(storage.getItem(journalStorageKey) !== null, true, "legacy data remains available for an explicit guest migration");

saveJournalEntries([{ ...legacyEntry, id: "a-only" }], userA);
storage.setItem("chartRadar.supabase.session", JSON.stringify({ accessToken: "token-b", userId: userB }));
assert.deepEqual(loadJournalEntries(), [], "user B must not read user A's local journal");
saveJournalEntries([{ ...legacyEntry, id: "b-only" }], userB);
assert.deepEqual(loadJournalEntries(userA).map((entry) => entry.id), ["a-only"]);
assert.deepEqual(loadJournalEntries(userB).map((entry) => entry.id), ["b-only"]);
assert.notEqual(journalStorageKeyForOwner(userA), journalStorageKeyForOwner(userB));

storage.removeItem("chartRadar.supabase.session");
assert.deepEqual(loadJournalEntries().map((entry) => entry.id), ["legacy-entry"], "only the guest namespace migrates legacy data");
assert.equal(storage.getItem(journalStorageKey), null);
assert.equal(storage.getItem(guestJournalStorageKey) !== null, true);

storage.setItem("chartRadar.supabase.session", JSON.stringify({ accessToken: "unidentified-token" }));
assert.deepEqual(loadJournalEntries(), [], "an authenticated but unidentified session fails closed");
assert.throws(
  () => appendJournalEntry({ title: "blocked", bias: "neutral", note: "private" }),
  /owner is not available/
);

console.log("User-scoped Journal storage matrix passed.");
