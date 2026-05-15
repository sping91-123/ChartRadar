"use client";
// 매매 복기 기록을 로컬과 Supabase 계정에 저장하는 페이지.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  History,
  Loader2,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { RadarTopNav } from "@/components/RadarTopNav";
import {
  appendJournalEntry,
  loadJournalEntries,
  saveJournalEntries,
  type JournalEntry,
  type OutcomeType
} from "@/lib/journal";
import {
  createRemoteJournalEntry,
  deleteRemoteJournalEntry,
  loadRemoteJournalEntries,
  updateRemoteJournalOutcome
} from "@/lib/remoteJournal";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

type MarketScope = "crypto" | "stocks";
type EntryFilter = "전체" | "레이더 저장" | "직접 기록";

const promptChips = [
  "왜 들어가고 싶었나?",
  "실제로 깨진 기준은 무엇인가?",
  "손절 기준을 지켰나?",
  "다음에 하나만 고친다면?"
];
const filters: EntryFilter[] = ["전체", "레이더 저장", "직접 기록"];
const stockSymbols = new Set(["SPY", "QQQ", "DIA", "IWM", "AAPL", "MSFT", "NVDA", "TSLA", "META", "GOOGL", "AMZN", "AMD", "AVGO", "JPM", "XOM", "GLD", "USO"]);

function detectEntryMarket(entry: JournalEntry): MarketScope | "unknown" {
  if (entry.market) return entry.market;
  if (entry.verdict?.includes("글로벌") || entry.verdict?.includes("해외주식")) return "stocks";
  if (entry.verdict?.includes("코인")) return "crypto";
  if (!entry.symbol) return "unknown";
  const symbol = entry.symbol.replace("USDT.P", "").replace("USDT", "").toUpperCase();
  return stockSymbols.has(symbol) ? "stocks" : "crypto";
}

function useScoutStats(entries: JournalEntry[]) {
  return useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const scoutEntries = entries.filter(
      (entry) => entry.source === "scout" && new Date(entry.createdAt).getTime() >= cutoff
    );
    const withOutcome = scoutEntries.filter((entry) => entry.outcome && entry.outcome !== "missed");
    const win = withOutcome.filter((entry) => entry.outcome === "win").length;
    const loss = withOutcome.filter((entry) => entry.outcome === "loss").length;
    const be = withOutcome.filter((entry) => entry.outcome === "breakeven").length;
    const pending = scoutEntries.filter((entry) => !entry.outcome).length;
    const total = withOutcome.length;
    const winRate = total > 0 ? Math.round((win / total) * 100) : null;
    return { win, loss, be, pending, total, winRate, scoutEntries };
  }, [entries]);
}

function outcomeLabel(outcome: OutcomeType) {
  if (outcome === "win") return "익절";
  if (outcome === "loss") return "손절";
  if (outcome === "breakeven") return "본전";
  return "패스";
}

function outcomeClass(outcome: OutcomeType) {
  if (outcome === "win") return "border-signal-success/40 bg-signal-success/15 text-signal-success";
  if (outcome === "loss") return "border-signal-danger/40 bg-signal-danger/15 text-signal-danger";
  if (outcome === "breakeven") return "border-slate-500/40 bg-slate-500/15 text-slate-300";
  return "border-slate-600/30 bg-slate-600/10 text-slate-500";
}

function SourceBadge({ entry }: { entry: JournalEntry }) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className="rounded-md border border-accent-blue/20 bg-accent-blue/10 px-2 py-1 text-[11px] font-bold text-accent-blue">
        {entry.bias}
      </span>
      <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[11px] font-bold text-slate-300">
        {entry.source === "scout" ? "레이더 저장" : entry.source === "chart" ? "차트 판독 저장" : "직접 기록"}
      </span>
      {entry.symbol ? (
        <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[11px] font-bold text-slate-300">
          {entry.symbol}
        </span>
      ) : null}
      {entry.timeframe ? (
        <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[11px] font-bold text-slate-300">
          {entry.timeframe}
        </span>
      ) : null}
    </div>
  );
}

function OutcomeButtons({
  entry,
  onOutcome
}: {
  entry: JournalEntry;
  onOutcome: (id: string, outcome: OutcomeType) => void;
}) {
  const buttons: OutcomeType[] = ["win", "loss", "breakeven", "missed"];

  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[11px] font-bold text-slate-500">결과 기록</p>
      <div className="flex flex-wrap gap-1.5">
        {buttons.map((outcome) => {
          const active = entry.outcome === outcome;
          return (
            <button
              key={outcome}
              type="button"
              onClick={() => onOutcome(entry.id, outcome)}
              className={`rounded-md border px-2.5 py-1 text-xs font-bold transition ${outcomeClass(outcome)} ${active ? "ring-1 ring-white/30" : ""}`}
            >
              {outcomeLabel(outcome)}
            </button>
          );
        })}
      </div>
      {entry.outcomeAt ? (
        <p className="mt-2 text-[11px] text-slate-500">
          기록 시간 {new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(entry.outcomeAt))}
        </p>
      ) : null}
    </div>
  );
}

export default function JournalPage({ searchParams }: { searchParams?: { market?: string } }) {
  const initialMarket = searchParams?.market === "stocks" || searchParams?.market === "global" ? "stocks" : "crypto";
  const { session } = useSupabaseAuth();
  const [market, setMarket] = useState<MarketScope>(initialMarket);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [title, setTitle] = useState("");
  const [bias, setBias] = useState("롱");
  const [note, setNote] = useState("");
  const [activeFilter, setActiveFilter] = useState<EntryFilter>("전체");
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);

  const marketLabel = market === "stocks" ? "글로벌" : "코인";

  const refreshRemote = useCallback(async () => {
    if (!session?.accessToken) return;
    setIsLoadingRemote(true);
    try {
      const remoteEntries = await loadRemoteJournalEntries(session.accessToken);
      setEntries(remoteEntries);
    } catch {
      setEntries(loadJournalEntries());
    } finally {
      setIsLoadingRemote(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    const nextMarket = new URLSearchParams(window.location.search).get("market");
    setMarket(nextMarket === "stocks" || nextMarket === "global" ? "stocks" : "crypto");
    const local = loadJournalEntries();
    if (!session?.accessToken) {
      setEntries(local);
      return;
    }
    refreshRemote();
  }, [refreshRemote, session?.accessToken]);

  const marketEntries = useMemo(
    () => entries.filter((entry) => {
      const detected = detectEntryMarket(entry);
      return detected === "unknown" || detected === market;
    }),
    [entries, market]
  );

  const stats = useScoutStats(marketEntries);

  const filteredEntries = useMemo(() => {
    if (activeFilter === "레이더 저장") return marketEntries.filter((entry) => entry.source === "scout" || entry.source === "chart");
    if (activeFilter === "직접 기록") return marketEntries.filter((entry) => !entry.source || entry.source === "manual");
    return marketEntries;
  }, [activeFilter, marketEntries]);

  async function addEntry() {
    const nextTitle = title.trim() || `${marketLabel} 복기 ${new Date().toLocaleDateString("ko-KR")}`;
    const entry = {
      title: nextTitle,
      bias,
      note: note.trim(),
      market,
      source: "manual" as const,
      verdict: `${marketLabel} 직접 복기`
    };

    if (session?.accessToken) {
      const created = await createRemoteJournalEntry(session.accessToken, entry);
      setEntries((current) => [created, ...current]);
    } else {
      const next = appendJournalEntry(entry);
      setEntries(next);
    }

    setTitle("");
    setBias("롱");
    setNote("");
  }

  async function removeEntry(id: string) {
    const next = entries.filter((entry) => entry.id !== id);
    setEntries(next);
    if (session?.accessToken) {
      await deleteRemoteJournalEntry(session.accessToken, id);
    } else {
      saveJournalEntries(next);
    }
  }

  async function recordOutcome(id: string, outcome: OutcomeType) {
    const currentEntry = entries.find((entry) => entry.id === id);
    const nextOutcome = currentEntry?.outcome === outcome ? undefined : outcome;
    const nextOutcomeAt = nextOutcome ? new Date().toISOString() : undefined;
    const next = entries.map((entry) =>
      entry.id === id ? { ...entry, outcome: nextOutcome, outcomeAt: nextOutcomeAt } : entry
    );
    setEntries(next);

    if (session?.accessToken) {
      await updateRemoteJournalOutcome(session.accessToken, id, nextOutcome ?? null, nextOutcomeAt ?? null);
    } else {
      saveJournalEntries(next);
    }
  }

  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Header market={market} />
        <RadarTopNav market={market} />

        <section className="enterprise-panel p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-accent-blue/25 bg-accent-blue/10 text-accent-blue">
              <History size={21} aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{marketLabel} 매매 복기</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                결과보다 원칙을 지켰는지 남기는 공간입니다. 계정을 연결하면 기기가 바뀌어도 이어볼 수 있습니다.
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-accent-blue/20 bg-accent-blue/10 p-3 text-xs leading-5 text-accent-blue">
            {session
              ? "복기 기록이 계정에 연결되어 있습니다. 다른 기기에서도 같은 계정으로 이어볼 수 있습니다."
              : "계정을 연결하면 복기 기록을 안전하게 이어갈 수 있습니다. 로그인 전 기록은 이 기기에만 남습니다."}
          </div>

          {stats.scoutEntries.length > 0 ? (
            <div className="mt-5 rounded-xl border border-accent-blue/20 bg-accent-blue/10 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-accent-blue">레이더 후보 30일 결과</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-xl border border-signal-success/20 bg-black/20 px-2 py-2">
                  <p className="text-lg font-black text-signal-success">{stats.win}</p>
                  <p className="text-[10px] font-bold text-slate-500">익절</p>
                </div>
                <div className="rounded-xl border border-signal-danger/20 bg-black/20 px-2 py-2">
                  <p className="text-lg font-black text-signal-danger">{stats.loss}</p>
                  <p className="text-[10px] font-bold text-slate-500">손절</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-2 py-2">
                  <p className="text-lg font-black text-slate-300">{stats.be}</p>
                  <p className="text-[10px] font-bold text-slate-500">본전</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/10 px-2 py-2">
                  <p className="text-lg font-black text-slate-400">{stats.pending}</p>
                  <p className="text-[10px] font-bold text-slate-500">미기록</p>
                </div>
              </div>
              {stats.winRate !== null ? (
                <div className="mt-3 flex items-center gap-2">
                  {stats.winRate >= 50
                    ? <TrendingUp size={14} className="text-signal-success" aria-hidden />
                    : <TrendingDown size={14} className="text-signal-danger" aria-hidden />}
                  <p className="text-sm font-black text-white">
                    적중률 {stats.winRate}%
                    <span className="ml-2 text-xs font-normal text-slate-500">({stats.total}건 기준)</span>
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 grid gap-3">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={market === "stocks" ? "예. NVDA 1h 조정 관찰" : "예. BTC 15m 롱 관찰"}
              className="min-h-12 rounded-md border border-surface-line bg-surface-cardSoft px-4 text-base text-white outline-none placeholder:text-slate-600 focus:border-accent-blue"
            />
            <div className="grid grid-cols-2 gap-2">
              {["롱", "숏"].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setBias(item)}
                  className={`min-h-10 rounded-md border px-3 text-sm font-bold ${
                    bias === item
                      ? "border-accent-blue bg-accent-blue text-slate-950"
                      : "border-surface-line bg-surface-cardSoft text-slate-300"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="진입 전 봤던 구조, 위험 신호, 지킨 원칙, 다음에 고칠 점을 적어보세요."
              rows={5}
              className="w-full resize-none rounded-md border border-surface-line bg-surface-cardSoft px-4 py-3 text-base leading-7 text-white outline-none placeholder:text-slate-600 focus:border-accent-blue"
            />
            <div className="flex flex-wrap gap-2">
              {promptChips.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setNote((current) => (current ? `${current}\n- ${item}` : `- ${item}`))}
                  className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-accent-blue/50 hover:text-white"
                >
                  {item}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={addEntry}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-accent-blue px-4 text-sm font-extrabold text-slate-950 hover:bg-sky-300"
            >
              <Plus size={18} aria-hidden />
              복기 저장
            </button>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`min-h-10 rounded-md border px-3 text-sm font-bold ${
                  activeFilter === filter
                    ? "border-accent-blue bg-accent-blue text-slate-950"
                    : "border-surface-line bg-surface-cardSoft text-slate-300 hover:border-accent-blue/50 hover:text-white"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-3">
            {isLoadingRemote ? (
              <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
                <Loader2 className="animate-spin text-accent-blue" size={17} aria-hidden />
                복기 기록을 불러오는 중입니다.
              </div>
            ) : filteredEntries.length ? (
              filteredEntries.map((entry) => (
                <article key={entry.id} className={`rounded-lg border bg-surface-cardSoft p-4 ${entry.source === "scout" ? "border-accent-blue/20" : "border-surface-line"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <SourceBadge entry={entry} />
                      <h3 className="mt-2 text-base font-bold text-white">{entry.title}</h3>
                      {entry.verdict ? <p className="mt-1 text-xs font-semibold text-slate-400">{entry.verdict}</p> : null}
                      <p className="mt-1 text-xs text-slate-500">
                        {new Intl.DateTimeFormat("ko-KR", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit"
                        }).format(new Date(entry.createdAt))}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeEntry(entry.id)}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-surface-line text-slate-400 hover:border-signal-danger/50 hover:text-signal-danger"
                      aria-label="복기 삭제"
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </div>

                  {entry.source === "scout" ? <OutcomeButtons entry={entry} onOutcome={recordOutcome} /> : null}

                  {entry.note ? (
                    <div className="mt-4 rounded-md border border-white/10 bg-black/20 p-3">
                      <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">{entry.note}</p>
                    </div>
                  ) : null}
                </article>
              ))
            ) : (
              <div className="rounded-md border border-white/10 bg-black/20 p-4">
                <p className="text-sm leading-6 text-slate-300">
                  아직 저장된 {marketLabel} 복기가 없습니다. 좋은 매매보다 지킨 매매를 먼저 기록해보세요.
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  첫 기록은 짧아도 됩니다. 추격했는지, 손절 기준이 있었는지만 적어도 다음 판단이 더 선명해집니다.
                </p>
              </div>
            )}
          </div>
        </section>
        <AppFooter />
      </div>
    </main>
  );
}
