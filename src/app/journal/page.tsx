"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Cloud,
  CloudOff,
  History,
  Loader2,
  Plus,
  Rows3,
  ScanSearch,
  Trash2,
  UploadCloud
} from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { TabMenu } from "@/components/TabMenu";
import {
  appendJournalEntry,
  journalStorageKey,
  loadJournalEntries,
  saveJournalEntries,
  type JournalEntry
} from "@/lib/journal";
import {
  createRemoteJournalEntry,
  deleteRemoteJournalEntry,
  loadRemoteJournalEntries,
  migrateLocalJournalEntries
} from "@/lib/remoteJournal";
import { getSupabaseSession, type SupabaseSession } from "@/lib/supabase";

const promptChips = [
  "왜 들어가고 싶었는가?",
  "무엇이 실제로 깨졌는가?",
  "손절 기준은 지켰는가?",
  "다음엔 무엇 하나만 고칠까?"
];
const filters = ["전체", "차트 저장", "직접 기록"] as const;

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
      {entry.source === "chart" ? (
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

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [localEntries, setLocalEntries] = useState<JournalEntry[]>([]);
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [title, setTitle] = useState("");
  const [bias, setBias] = useState("관망");
  const [note, setNote] = useState("");
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]>("전체");
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  useEffect(() => {
    const savedLocal = loadJournalEntries();
    const savedSession = getSupabaseSession();
    setLocalEntries(savedLocal);
    setEntries(savedLocal);
    setSession(savedSession);

    if (!savedSession) return;

    setIsLoadingRemote(true);
    loadRemoteJournalEntries(savedSession.accessToken)
      .then((remoteEntries) => {
        setEntries(remoteEntries);
      })
      .catch((error) => {
        setSyncMessage(error instanceof Error ? error.message : "서버 복기장을 불러오지 못했습니다.");
      })
      .finally(() => setIsLoadingRemote(false));
  }, []);

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

  async function migrateLocalEntries() {
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
  }

  const filteredEntries = useMemo(() => {
    if (activeFilter === "차트 저장") return entries.filter((entry) => entry.source === "chart");
    if (activeFilter === "직접 기록") return entries.filter((entry) => entry.source !== "chart");
    return entries;
  }, [activeFilter, entries]);

  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Header />
        <TabMenu />

        <section className="rounded-lg border border-surface-line bg-surface-card p-4 shadow-glow sm:p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-accent-blue/25 bg-accent-blue/10 text-accent-blue">
              <History size={21} aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">매매 복기</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                결과보다 원칙을 지켰는지 기록하는 공간입니다. 로그인하면 기록이 서버에 저장되어 나중에 모바일 앱에서도 이어갈 수 있습니다.
              </p>
            </div>
          </div>

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
                      : "구글/카카오 로그인을 연결하면 기기 변경, 모바일 앱 출시 후에도 기록을 이어갈 수 있습니다."}
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
            {syncMessage ? <p className="mt-3 text-xs leading-5 text-slate-400">{syncMessage}</p> : null}
          </div>

          <div className="mt-5 grid gap-3">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="예: BTC 15m 롱 관찰"
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
                const chartNote = entry.source === "chart" ? parseChartNote(entry.note) : null;

                return (
                  <article key={entry.id} className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <SourceBadge entry={entry} />
                        <h3 className="mt-2 text-base font-bold text-white">{entry.title}</h3>
                        {entry.verdict ? <p className="mt-2 text-sm font-semibold text-slate-200">{entry.verdict}</p> : null}
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
                    {entry.note ? (
                      entry.source === "chart" && chartNote ? (
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
                            직접 기록
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
                  아직 저장된 복기가 없습니다. 좋은 매매보다 지킨 매매를 먼저 기록하세요.
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
