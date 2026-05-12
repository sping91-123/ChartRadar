"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Cloud,
  CloudOff,
  History,
  Loader2,
  Plus,
  Rows3,
  ScanSearch,
  Trash2,
  TrendingDown,
  TrendingUp,
  UploadCloud
} from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { RadarTopNav } from "@/components/RadarTopNav";
import {
  appendJournalEntry,
  journalStorageKey,
  loadJournalEntries,
  saveJournalEntries,
  type JournalEntry,
  type OutcomeType
} from "@/lib/journal";
import {
  createRemoteJournalEntry,
  deleteRemoteJournalEntry,
  loadRemoteJournalEntries,
  migrateLocalJournalEntries,
  updateRemoteJournalOutcome
} from "@/lib/remoteJournal";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

const promptChips = [
  "왜 들어가고 싶었는가?",
  "무엇이 실제로 깨졌는가?",
  "손절 기준은 지켰는가?",
  "다음엔 무엇 하나만 고칠까?"
];
const filters = ["전체", "레이더 저장", "직접 기록"] as const;
const stockSymbols = new Set(["SPY", "QQQ", "DIA", "IWM", "AAPL", "MSFT", "NVDA", "TSLA", "META", "GOOGL", "AMZN", "AMD", "AVGO", "JPM", "XOM", "GLD", "USO"]);

function detectEntryMarket(entry: JournalEntry): "crypto" | "stocks" | "unknown" {
  if (entry.market) return entry.market;
  if (entry.verdict?.includes("글로벌")) return "stocks";
  if (entry.verdict?.includes("해외주식")) return "stocks";
  if (entry.verdict?.includes("코인")) return "crypto";
  if (!entry.symbol) return "unknown";
  const symbol = entry.symbol.replace("USDT.P", "").replace("USDT", "").toUpperCase();
  if (stockSymbols.has(symbol)) return "stocks";
  return "crypto";
}

/** 30일 Scout 결과 통계 */
function useScoutStats(entries: JournalEntry[]) {
  return useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const scoutEntries = entries.filter(
      (e) => e.source === "scout" && new Date(e.createdAt).getTime() >= cutoff
    );
    const withOutcome = scoutEntries.filter((e) => e.outcome);
    const win = withOutcome.filter((e) => e.outcome === "win").length;
    const loss = withOutcome.filter((e) => e.outcome === "loss").length;
    const be = withOutcome.filter((e) => e.outcome === "breakeven").length;
    const pending = scoutEntries.filter((e) => !e.outcome).length;
    const total = withOutcome.length;
    const winRate = total > 0 ? Math.round((win / total) * 100) : null;
    return { win, loss, be, pending, total, winRate, scoutEntries };
  }, [entries]);
}

/** Scout 항목 결과 기록 버튼 */
function OutcomeButtons({
  entry,
  onOutcome
}: {
  entry: JournalEntry;
  onOutcome: (id: string, outcome: OutcomeType) => void;
}) {
  const buttons: { label: string; value: OutcomeType; color: string }[] = [
    { label: "✓ 익절", value: "win", color: "border-signal-success/40 bg-signal-success/15 text-signal-success hover:bg-signal-success/30" },
    { label: "✕ 손절", value: "loss", color: "border-signal-danger/40 bg-signal-danger/15 text-signal-danger hover:bg-signal-danger/30" },
    { label: "— 본전", value: "breakeven", color: "border-slate-500/40 bg-slate-500/15 text-slate-300 hover:bg-slate-500/30" },
    { label: "패스", value: "missed", color: "border-slate-600/30 bg-slate-600/10 text-slate-500 hover:bg-slate-600/20" }
  ];

  if (entry.outcome) {
    const found = buttons.find((b) => b.value === entry.outcome);
    return (
      <div className="mt-3 flex items-center gap-2">
        <span className={`rounded-md border px-2.5 py-1 text-xs font-black ${found?.color ?? ""}`}>
          {found?.label ?? entry.outcome}
        </span>
        <span className="text-[11px] text-slate-500">
          {entry.outcomeAt ? new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(entry.outcomeAt)) : ""}
        </span>
        <button
          type="button"
          onClick={() => onOutcome(entry.id, entry.outcome!)}
          className="text-[11px] text-slate-600 underline hover:text-slate-400"
        >
          취소
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[11px] font-bold text-slate-500">결과 기록</p>
      <div className="flex flex-wrap gap-1.5">
        {buttons.map((btn) => (
          <button
            key={btn.value}
            type="button"
            onClick={() => onOutcome(entry.id, btn.value)}
            className={`rounded-md border px-2.5 py-1 text-xs font-bold transition ${btn.color}`}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function parseChartNote(note: string) {
  const lines = note.split("\n").map((line) => line.trim()).filter(Boolean);
  const summary: string[] = [];
  const checkpoints: string[] = [];
  const risks: string[] = [];
  const opportunities: string[] = [];
  let section: "summary" | "checkpoints" | "risks" | "opportunities" = "summary";

  for (const line of lines) {
    if (line === "체크포인트:") {
      section = "checkpoints";
      continue;
    }
    if (line === "위험 신호:") {
      section = "risks";
      continue;
    }
    if (line === "기회 신호:") {
      section = "opportunities";
      continue;
    }

    const cleanLine = line.replace(/^- /, "");

    if (section === "checkpoints") checkpoints.push(cleanLine);
    else if (section === "risks") risks.push(cleanLine);
    else if (section === "opportunities") opportunities.push(cleanLine);
    else summary.push(cleanLine);
  }

  return { summary, checkpoints, risks, opportunities };
}

function SourceBadge({ entry }: { entry: JournalEntry }) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className="rounded-md border border-accent-blue/20 bg-accent-blue/10 px-2 py-1 text-[11px] font-bold text-accent-blue">
        {entry.bias}
      </span>
      {entry.source === "scout" ? (
        <span className="rounded-md border border-accent-blue/30 bg-accent-blue/10 px-2 py-1 text-[11px] font-bold text-accent-blue">
                  차트 레이더
        </span>
      ) : entry.source === "chart" ? (
        <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[11px] font-bold text-slate-300">
          차트 판독 저장
        </span>
      ) : (
        <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[11px] font-bold text-slate-300">
          직접 기록
        </span>
      )}
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

function SectionList({
  title,
  items,
  tone = "neutral"
}: {
  title: string;
  items: string[];
  tone?: "neutral" | "risk" | "opportunity";
}) {
  if (!items.length) return null;

  const toneClass =
    tone === "risk"
      ? "border-signal-warning/20 bg-signal-warning/10 text-slate-200"
      : tone === "opportunity"
        ? "border-signal-success/20 bg-signal-success/10 text-slate-200"
        : "border-white/10 bg-black/20 text-slate-200";

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-slate-500">{title}</p>
      <div className="space-y-2">
        {items.map((item) => (
          <p key={`${title}-${item}`} className={`rounded-md border px-3 py-2 text-sm leading-6 ${toneClass}`}>
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function JournalPage({ searchParams }: { searchParams?: { market?: string } }) {
  const initialMarket = searchParams?.market === "stocks" || searchParams?.market === "global" ? "stocks" : "crypto";
  const [market, setMarket] = useState<"crypto" | "stocks">(initialMarket);
  const marketLabel = market === "stocks" ? "글로벌" : "코인";
  const { session, user, profile, isLoading: isLoadingAuth } = useSupabaseAuth();
  const profilePlanLabel = profile?.plan && profile.plan !== "free" ? profile.plan.toUpperCase() : "PRO 미리보기";
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [localEntries, setLocalEntries] = useState<JournalEntry[]>([]);
  const [title, setTitle] = useState("");
  const [bias, setBias] = useState("관망");
  const [note, setNote] = useState("");
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]>("전체");
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [shouldAutoSync, setShouldAutoSync] = useState(false);

  useEffect(() => {
    const marketParam = new URLSearchParams(window.location.search).get("market");
    setMarket(marketParam === "stocks" || marketParam === "global" ? "stocks" : "crypto");
    const savedLocal = loadJournalEntries();
    setLocalEntries(savedLocal);
    setEntries(savedLocal);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setShouldAutoSync(params.get("sync") === "1");
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    setIsLoadingRemote(true);
    loadRemoteJournalEntries(session.accessToken)
      .then((remoteEntries) => {
        setEntries(remoteEntries);
      })
      .catch((error) => {
        setSyncMessage(error instanceof Error ? error.message : "서버 복기장을 불러오지 못했습니다.");
      })
      .finally(() => setIsLoadingRemote(false));
  }, [session]);

  function persistLocal(nextEntries: JournalEntry[]) {
    setEntries(nextEntries);
    setLocalEntries(nextEntries);
    saveJournalEntries(nextEntries);
  }

  async function addEntry() {
    const cleanTitle = title.trim();
    const cleanNote = note.trim();
    if (!cleanTitle && !cleanNote) return;

    const payload = {
      title: cleanTitle || "복기 메모",
      bias,
      note: cleanNote,
      market,
      verdict: `${marketLabel} 복기`,
      source: "manual" as const
    };

    if (session) {
      try {
        const created = await createRemoteJournalEntry(session.accessToken, payload);
        setEntries((current) => [created, ...current]);
        setSyncMessage("서버 복기장에 저장했습니다.");
      } catch (error) {
        setSyncMessage(error instanceof Error ? error.message : "서버 저장에 실패했습니다.");
        return;
      }
    } else {
      persistLocal(appendJournalEntry(payload));
    }

    setTitle("");
    setNote("");
  }

  async function removeEntry(id: string) {
    if (session) {
      try {
        await deleteRemoteJournalEntry(session.accessToken, id);
        setEntries((current) => current.filter((entry) => entry.id !== id));
        setSyncMessage("서버 복기장에서 삭제했습니다.");
      } catch (error) {
        setSyncMessage(error instanceof Error ? error.message : "삭제에 실패했습니다.");
      }
      return;
    }

    persistLocal(entries.filter((entry) => entry.id !== id));
  }

  const migrateLocalEntries = useCallback(async () => {
    if (!session || !localEntries.length) return;
    setIsLoadingRemote(true);
    setSyncMessage("");

    try {
      await migrateLocalJournalEntries(session.accessToken, localEntries);
      const remoteEntries = await loadRemoteJournalEntries(session.accessToken);
      setEntries(remoteEntries);
      setLocalEntries([]);
      window.localStorage.removeItem(journalStorageKey);
      setSyncMessage("로컬 복기 기록을 서버 복기장으로 옮겼습니다.");
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "로컬 기록 이전에 실패했습니다.");
    } finally {
      setIsLoadingRemote(false);
    }
  }, [localEntries, session]);

  useEffect(() => {
    if (isLoadingAuth || !session) return;
    if (!shouldAutoSync) return;
    if (!localEntries.length) return;
    void migrateLocalEntries();
  }, [isLoadingAuth, session, shouldAutoSync, localEntries, migrateLocalEntries]);

  const marketEntries = useMemo(
    () =>
      entries.filter((entry) => {
        const entryMarket = detectEntryMarket(entry);
        if (entryMarket === "unknown") return market === "crypto";
        return entryMarket === market;
      }),
    [entries, market]
  );

  const filteredEntries = useMemo(() => {
    if (activeFilter === "레이더 저장") return marketEntries.filter((entry) => entry.source === "scout");
    if (activeFilter === "직접 기록") return marketEntries.filter((entry) => entry.source !== "chart" && entry.source !== "scout");
    return marketEntries;
  }, [activeFilter, marketEntries]);

  const stats = useScoutStats(marketEntries);

  async function recordOutcome(id: string, outcome: OutcomeType) {
    const updater = (list: JournalEntry[]): JournalEntry[] =>
      list.map((e) => {
        if (e.id !== id) return e;
        // 같은 값 클릭 시 취소
        if (e.outcome === outcome) return { ...e, outcome: undefined, outcomeAt: undefined };
        return { ...e, outcome, outcomeAt: new Date().toISOString() };
      });

    if (session) {
      const current = entries.find((entry) => entry.id === id);
      const nextOutcome = current?.outcome === outcome ? null : outcome;
      const nextOutcomeAt = nextOutcome ? new Date().toISOString() : null;
      const previous = entries;
      setEntries(updater(entries));

      try {
        const updated = await updateRemoteJournalOutcome(session.accessToken, id, nextOutcome, nextOutcomeAt);
        if (updated) {
          setEntries((list) => list.map((entry) => (entry.id === id ? updated : entry)));
        }
      } catch (error) {
        setEntries(previous);
        setSyncMessage(error instanceof Error ? error.message : "결과 기록 저장에 실패했습니다.");
      }
    } else {
      const next = updater(loadJournalEntries());
      saveJournalEntries(next);
      setEntries(next);
    }
  }

  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Header market={market} />
        <RadarTopNav market={market} />

        <section className="rounded-lg border border-surface-line bg-surface-card p-4 shadow-glow sm:p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-accent-blue/25 bg-accent-blue/10 text-accent-blue">
              <History size={21} aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{marketLabel} 매매 복기</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                {marketLabel} 매매에서 결과보다 원칙을 지켰는지 기록하는 공간입니다. 로그인하면 기록이 서버에 저장되어 나중에 모바일 앱에서도 이어갈 수 있습니다.
              </p>
              <p className="mt-2 rounded-md border border-signal-warning/25 bg-signal-warning/10 px-3 py-2 text-xs leading-5 text-signal-warning">
                복기 데이터는 계정과 브라우저 상태에 따라 보존됩니다. 중요한 기록은 별도 백업을 권장합니다.
              </p>
            </div>
          </div>

              {/* 레이더 30일 통계 카드 */}
          {stats.scoutEntries.length > 0 && (
            <div className="mt-5 rounded-lg border border-accent-blue/20 bg-accent-blue/5 p-4">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-accent-blue">레이더 후보 · 30일 결과</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-md border border-signal-success/20 bg-signal-success/10 px-2 py-2">
                  <p className="text-lg font-black text-signal-success">{stats.win}</p>
                  <p className="text-[10px] font-bold text-slate-500">익절</p>
                </div>
                <div className="rounded-md border border-signal-danger/20 bg-signal-danger/10 px-2 py-2">
                  <p className="text-lg font-black text-signal-danger">{stats.loss}</p>
                  <p className="text-[10px] font-bold text-slate-500">손절</p>
                </div>
                <div className="rounded-md border border-white/10 bg-black/20 px-2 py-2">
                  <p className="text-lg font-black text-slate-300">{stats.be}</p>
                  <p className="text-[10px] font-bold text-slate-500">본전</p>
                </div>
                <div className="rounded-md border border-white/10 bg-black/10 px-2 py-2">
                  <p className="text-lg font-black text-slate-400">{stats.pending}</p>
                  <p className="text-[10px] font-bold text-slate-500">미기록</p>
                </div>
              </div>
              {stats.winRate !== null && (
                <div className="mt-3 flex items-center gap-2">
                  {stats.winRate >= 50
                    ? <TrendingUp size={14} className="text-signal-success" aria-hidden />
                    : <TrendingDown size={14} className="text-signal-danger" aria-hidden />}
                  <p className="text-sm font-black text-white">
                    적중률 {stats.winRate}%
                    <span className="ml-2 text-xs font-normal text-slate-500">({stats.total}건 기준)</span>
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-md border ${session ? "border-signal-success/25 bg-signal-success/10 text-signal-success" : "border-signal-warning/25 bg-signal-warning/10 text-signal-warning"}`}>
                  {session ? <Cloud size={18} aria-hidden /> : <CloudOff size={18} aria-hidden />}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    {session ? "서버 복기장 연결됨" : "현재는 이 브라우저에만 저장됩니다"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {session
                      ? "Supabase 계정에 연결되어 복기 기록을 서버에 저장합니다."
                      : "구글 로그인을 연결하면 기기 변경, 모바일 앱 출시 후에도 기록을 이어갈 수 있습니다."}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {!session ? (
                  <Link
                    href="/login"
                    className="inline-flex min-h-10 items-center justify-center rounded-md bg-accent-blue px-3 text-sm font-black text-slate-950 hover:bg-sky-300"
                  >
                    로그인 연결
                  </Link>
                ) : localEntries.length ? (
                  <button
                    type="button"
                    onClick={migrateLocalEntries}
                    disabled={isLoadingRemote}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-accent-blue px-3 text-sm font-black text-slate-950 hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoadingRemote ? <Loader2 className="animate-spin" size={16} aria-hidden /> : <UploadCloud size={16} aria-hidden />}
                    로컬 기록 서버로 옮기기
                  </button>
                ) : null}
              </div>
            </div>
            {session && user ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1">
                  {profile?.display_name ?? user.user_metadata?.name ?? user.email ?? "회원"}
                </span>
                <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1">
                  {user.email ?? "이메일 없음"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-accent-blue/25 bg-accent-blue/10 px-2 py-1 text-accent-blue">
                  <BadgeCheck size={12} aria-hidden />
                  {profilePlanLabel}
                </span>
              </div>
            ) : null}
            {syncMessage ? <p className="mt-3 text-xs leading-5 text-slate-400">{syncMessage}</p> : null}
          </div>

          <div className="mt-5 grid gap-3">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={market === "stocks" ? "예: NVDA 1h 조정 관찰" : "예: BTC 15m 롱 관찰"}
              className="min-h-12 rounded-md border border-surface-line bg-surface-cardSoft px-4 text-base text-white outline-none placeholder:text-slate-600 focus:border-accent-blue"
            />
            <div className="grid grid-cols-3 gap-2">
              {["롱", "숏", "관망"].map((item) => (
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
                  onClick={() =>
                    setNote((current) => (current ? `${current}\n- ${item}` : `- ${item}`))
                  }
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
                서버 복기장을 불러오는 중입니다.
              </div>
            ) : filteredEntries.length ? (
              filteredEntries.map((entry) => {
                const chartNote = (entry.source === "chart") ? parseChartNote(entry.note) : null;
                const isScout = entry.source === "scout";

                return (
                  <article key={entry.id} className={`rounded-lg border bg-surface-cardSoft p-4 ${isScout ? "border-accent-blue/20" : "border-surface-line"}`}>
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

                    {/* Scout 항목 - W/L/BE 결과 기록 버튼 */}
                    {isScout && (
                      <OutcomeButtons entry={entry} onOutcome={recordOutcome} />
                    )}

                    {entry.note ? (
                      chartNote ? (
                        <div className="mt-4 space-y-4">
                          <div className="rounded-md border border-white/10 bg-black/20 p-3">
                            <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-500">
                              <ScanSearch size={14} aria-hidden />
                              판독 요약
                            </div>
                            <div className="space-y-2">
                              {chartNote.summary.map((item) => (
                                <p key={item} className="text-sm leading-6 text-slate-200">
                                  {item}
                                </p>
                              ))}
                            </div>
                          </div>
                          <SectionList title="체크포인트" items={chartNote.checkpoints} />
                          <SectionList title="위험 신호" items={chartNote.risks} tone="risk" />
                          <SectionList title="기회 신호" items={chartNote.opportunities} tone="opportunity" />
                        </div>
                      ) : (
                        <div className="mt-4 rounded-md border border-white/10 bg-black/20 p-3">
                          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-500">
                            <Rows3 size={14} aria-hidden />
                              {isScout ? "차트 레이더 분석" : "직접 기록"}
                          </div>
                          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">{entry.note}</p>
                        </div>
                      )
                    ) : null}
                  </article>
                );
              })
            ) : (
              <div className="rounded-md border border-white/10 bg-black/20 p-4">
                <p className="text-sm leading-6 text-slate-300">
                  아직 저장된 {marketLabel} 복기가 없습니다. 좋은 매매보다 지킨 매매를 먼저 기록하세요.
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  첫 기록은 짧아도 됩니다. 추격했는지, 손절 기준이 있었는지만 남겨도 다음 판단이 훨씬 선명해집니다.
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
