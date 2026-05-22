"use client";
// 매매 복기 흐름을 레이더 저장, 결과 확인, 원칙 점검으로 연결하는 페이지.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock3,
  History,
  ListChecks,
  Loader2,
  Plus,
  Radar,
  ShieldCheck,
  Target,
  Trash2
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
type DirectionType = "롱" | "숏" | "관망" | "미진입";
type TradeResult = "익절" | "손절" | "본절" | "미진입" | "진행 중";
type RResult = "+1R" | "-1R" | "0R" | "직접 입력";
type HistoryFilter = "전체" | "익절" | "손절" | "원칙 지킴" | "원칙 깨짐" | "추격 진입";

interface FeedbackSummary {
  principleStatus: string;
  mistake: string;
  wellDone: string;
  checkpoint: string;
  message: string;
}

interface ParsedEntryMeta {
  symbol: string;
  result: string;
  rResult: string;
  entryReasons: string[];
  keptPrinciples: string[];
  brokenPrinciples: string[];
  nextCheckpoint: string;
  memo: string;
  brokenReal: string[];
  principleStatus: string;
}

const historyFilters: HistoryFilter[] = ["전체", "익절", "손절", "원칙 지킴", "원칙 깨짐", "추격 진입"];
const directions: DirectionType[] = ["롱", "숏", "관망", "미진입"];
const resultOptions: TradeResult[] = ["익절", "손절", "본절", "미진입", "진행 중"];
const rResultOptions: RResult[] = ["+1R", "-1R", "0R", "직접 입력"];
const entryReasonOptions = ["지지 반등", "저항 돌파", "눌림목", "뉴스 반응", "추격 진입", "감정 진입"];
const keptPrincipleOptions = ["손절 기준 설정", "포지션 크기 준수", "상위 시간봉 확인", "기다렸다 진입", "관망 유지"];
const brokenPrincipleOptions = ["손절 늦춤", "비중 과다", "추격 진입", "근거 부족", "익절 성급함", "없음"];
const stockSymbols = new Set([
  "SPY",
  "QQQ",
  "DIA",
  "IWM",
  "AAPL",
  "MSFT",
  "NVDA",
  "TSLA",
  "META",
  "GOOGL",
  "AMZN",
  "AMD",
  "AVGO",
  "JPM",
  "XOM",
  "GLD",
  "USO"
]);

function detectEntryMarket(entry: JournalEntry): MarketScope | "unknown" {
  if (entry.market) return entry.market;

  const verdict = entry.verdict?.toLowerCase() ?? "";
  if (verdict.includes("global") || verdict.includes("글로벌") || verdict.includes("해외주식")) return "stocks";
  if (verdict.includes("crypto") || verdict.includes("코인")) return "crypto";
  if (!entry.symbol) return "unknown";

  const symbol = entry.symbol.replace("USDT.P", "").replace("USDT", "").toUpperCase();
  return stockSymbols.has(symbol) ? "stocks" : "crypto";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function splitChips(value?: string) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readNoteValue(note: string, labels: string[]) {
  const lines = note.split("\n");
  for (const label of labels) {
    const line = lines.find((item) => item.trim().startsWith(`${label}:`));
    if (line) return line.replace(`${label}:`, "").trim();
  }
  return "";
}

function outcomeLabel(outcome?: OutcomeType | null) {
  if (outcome === "win") return "익절";
  if (outcome === "loss") return "손절";
  if (outcome === "breakeven") return "본절";
  if (outcome === "missed") return "미진입";
  return "진행 중";
}

function resultToOutcome(result: TradeResult): OutcomeType | undefined {
  if (result === "익절") return "win";
  if (result === "손절") return "loss";
  if (result === "본절") return "breakeven";
  if (result === "미진입") return "missed";
  return undefined;
}

function outcomeClass(outcome?: OutcomeType | null) {
  if (outcome === "win") return "border-signal-success/40 bg-signal-success/15 text-signal-success";
  if (outcome === "loss") return "border-signal-danger/40 bg-signal-danger/15 text-signal-danger";
  if (outcome === "breakeven") return "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-300";
  if (outcome === "missed") return "border-amber-400/40 bg-amber-400/10 text-amber-700 dark:border-amber-400/30 dark:text-amber-200";
  return "border-accent-blue/25 bg-accent-blue/10 text-accent-blue";
}

function profitResultLabel(value: string) {
  if (value === "+1R") return "수익";
  if (value === "-1R") return "손실";
  if (value === "0R") return "본전";
  return value;
}

function parseEntryMeta(entry: JournalEntry): ParsedEntryMeta {
  const entryReasons = splitChips(readNoteValue(entry.note, ["진입 근거"]));
  const keptPrinciples = splitChips(readNoteValue(entry.note, ["지킨 기준", "지킨 원칙"]));
  const brokenPrinciples = splitChips(readNoteValue(entry.note, ["깨진 기준", "깨진 원칙"]));
  const brokenReal = brokenPrinciples.filter((item) => item !== "없음");
  const hasKeptOnly = keptPrinciples.length > 0 && brokenReal.length === 0;
  const principleStatus = brokenReal.length ? "원칙 점검 필요" : hasKeptOnly ? "원칙 준수" : "기준 기록 대기";

  return {
    symbol: readNoteValue(entry.note, ["시장/종목"]) || entry.symbol || "시장 미기록",
    result: readNoteValue(entry.note, ["결과"]) || outcomeLabel(entry.outcome),
    rResult: readNoteValue(entry.note, ["R 결과"]) || "기록 대기",
    entryReasons,
    keptPrinciples,
    brokenPrinciples,
    nextCheckpoint: readNoteValue(entry.note, ["다음 매매 전 체크", "다음에 고칠 점"]) || "다음 매매 전 손절 기준과 주요 근거를 먼저 확인하세요.",
    memo: readNoteValue(entry.note, ["선택 메모", "메모"]),
    brokenReal,
    principleStatus
  };
}

function toggleChip(current: string[], item: string, exclusiveNone = false) {
  if (exclusiveNone && item === "없음") return current.includes("없음") ? [] : ["없음"];
  const withoutNone = exclusiveNone ? current.filter((value) => value !== "없음") : current;
  return withoutNone.includes(item) ? withoutNone.filter((value) => value !== item) : [...withoutNone, item];
}

function isStructuredJournalNote(note: string) {
  return note.includes("시장/종목:") || note.includes("진입 근거:") || note.includes("R 결과:");
}

function buildFeedback(params: {
  entryReasons: string[];
  keptPrinciples: string[];
  brokenPrinciples: string[];
  nextFix: string;
}): FeedbackSummary {
  const brokenReal = params.brokenPrinciples.filter((item) => item !== "없음");
  const principleStatus = brokenReal.length ? "깨진 기준 확인 필요" : "원칙 준수 흐름이 좋습니다";
  const mistake = brokenReal.length ? brokenReal.join(", ") : "기록된 깨진 기준이 없습니다";
  const wellDone = params.keptPrinciples.length
    ? params.keptPrinciples.join(", ")
    : "다음 복기에서 지킨 기준을 하나만 더 남겨보세요";
  const checkpoint =
    params.nextFix ||
    (brokenReal.includes("손절 늦춤")
      ? "다음 매매 전 손절 기준을 먼저 적고 지지·저항 반응을 확인하세요."
      : params.entryReasons.some((item) => item.includes("추격") || item.includes("감정"))
        ? "다음 매매 전 진입 근거가 충분한지 한 번 더 확인하세요."
        : "다음 매매 전 손절 기준과 지지·저항 반응을 먼저 확인하세요.");

  return {
    principleStatus,
    mistake,
    wellDone,
    checkpoint,
    message: "이번 복기는 방향 판단보다 진입 기준 확인이 핵심입니다. 다음 매매 전에는 손절 기준과 지지·저항 반응을 먼저 확인하세요."
  };
}

function SourceBadge({ entry }: { entry: JournalEntry }) {
  const sourceLabel =
    entry.source === "scout" ? "레이더 저장" : entry.source === "chart" ? "차트 저장" : "직접 기록";

  return (
    <div className="flex min-w-0 max-w-full flex-wrap gap-1.5 sm:gap-2">
      <span className="max-w-full whitespace-normal break-keep rounded-md border border-accent-blue/20 bg-accent-blue/10 px-2 py-1 text-[11px] font-bold leading-snug text-accent-blue">
        {entry.bias || "방향 미기록"}
      </span>
      <span className="max-w-full whitespace-normal break-keep rounded-md border border-slate-200/80 bg-white/70 px-2 py-1 text-[11px] font-bold leading-snug text-slate-600 dark:border-white/10 dark:bg-black/20 dark:text-slate-300">
        {sourceLabel}
      </span>
      {entry.symbol ? (
        <span className="max-w-full whitespace-normal break-keep rounded-md border border-slate-200/80 bg-white/70 px-2 py-1 text-[11px] font-bold leading-snug text-slate-600 dark:border-white/10 dark:bg-black/20 dark:text-slate-300">
          {entry.symbol}
        </span>
      ) : null}
      {entry.timeframe ? (
        <span className="max-w-full whitespace-normal break-keep rounded-md border border-slate-200/80 bg-white/70 px-2 py-1 text-[11px] font-bold leading-snug text-slate-600 dark:border-white/10 dark:bg-black/20 dark:text-slate-300">
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
      <p className="mb-1.5 text-[11px] font-bold text-slate-500">결과 입력</p>
      <div className="flex min-w-0 max-w-full flex-wrap gap-1.5">
        {buttons.map((outcome) => {
          const active = entry.outcome === outcome;
          return (
            <button
              key={outcome}
              type="button"
              onClick={() => onOutcome(entry.id, outcome)}
              className={`min-h-9 min-w-0 max-w-full flex-1 basis-[calc(50%-0.1875rem)] whitespace-normal break-keep rounded-md border px-2 py-1.5 text-xs font-bold leading-snug transition sm:flex-none sm:basis-auto sm:px-3 ${outcomeClass(outcome)} ${active ? "ring-1 ring-white/30" : ""}`}
            >
              {outcomeLabel(outcome)}
            </button>
          );
        })}
      </div>
      {entry.outcomeAt ? <p className="mt-2 text-[11px] text-slate-500">기록 시간 {formatDateTime(entry.outcomeAt)}</p> : null}
    </div>
  );
}

function ChipGroup({
  label,
  helper,
  options,
  selected,
  onToggle,
  tone = "blue"
}: {
  label: string;
  helper?: string;
  options: string[];
  selected: string[];
  onToggle: (item: string) => void;
  tone?: "blue" | "green" | "red";
}) {
  const activeClass =
    tone === "green"
      ? "border-signal-success bg-signal-success text-slate-950"
      : tone === "red"
        ? "border-signal-danger bg-signal-danger text-white"
        : "border-accent-blue bg-accent-blue text-slate-950";

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-black/15">
      <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-xs font-black text-slate-700 dark:text-slate-200">{label}</p>
        {helper ? <span className="min-w-0 text-[11px] text-slate-500">{helper}</span> : null}
      </div>
      <div className="flex min-w-0 max-w-full flex-wrap gap-1.5 sm:gap-2">
        {options.map((item) => {
          const active = selected.includes(item);
          return (
            <button
              key={item}
              type="button"
              onClick={() => onToggle(item)}
              className={`min-h-9 min-w-0 max-w-full flex-1 basis-[calc(50%-0.1875rem)] whitespace-normal break-keep rounded-md border px-2 py-2 text-[13px] font-bold leading-snug transition sm:min-h-10 sm:flex-none sm:basis-auto sm:px-3 sm:text-sm ${
                active ? activeClass : "border-slate-200 bg-white/80 text-slate-700 hover:border-accent-blue/50 hover:text-slate-950 dark:border-surface-line dark:bg-surface-cardSoft dark:text-slate-300 dark:hover:text-white"
              }`}
            >
              {item}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function JournalPage({ searchParams }: { searchParams?: { market?: string } }) {
  const initialMarket = searchParams?.market === "stocks" || searchParams?.market === "global" ? "stocks" : "crypto";
  const { session } = useSupabaseAuth();
  const [market, setMarket] = useState<MarketScope>(initialMarket);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [title, setTitle] = useState("");
  const [symbol, setSymbol] = useState("");
  const [direction, setDirection] = useState<DirectionType>("관망");
  const [result, setResult] = useState<TradeResult>("진행 중");
  const [rResult, setRResult] = useState<RResult>("0R");
  const [customRResult, setCustomRResult] = useState("");
  const [entryReasons, setEntryReasons] = useState<string[]>([]);
  const [keptPrinciples, setKeptPrinciples] = useState<string[]>([]);
  const [brokenPrinciples, setBrokenPrinciples] = useState<string[]>(["없음"]);
  const [nextFix, setNextFix] = useState("");
  const [memo, setMemo] = useState("");
  const [activeFilter, setActiveFilter] = useState<HistoryFilter>("전체");
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [lastFeedback, setLastFeedback] = useState<FeedbackSummary | null>(null);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);

  const marketLabel = market === "stocks" ? "글로벌" : "코인";
  const marketHeroLine =
    market === "stocks"
      ? "글로벌 시장 매매의 판단 근거, 리스크 관리, 반복 실수를 정리합니다."
      : "코인 매매의 진입 근거, 원칙 준수, 반복 실수를 정리합니다.";

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
    () =>
      entries.filter((entry) => {
        const detected = detectEntryMarket(entry);
        return detected === "unknown" || detected === market;
      }),
    [entries, market]
  );

  const pendingRadarEntries = useMemo(
    () => marketEntries.filter((entry) => (entry.source === "scout" || entry.source === "chart") && !entry.outcome).slice(0, 4),
    [marketEntries]
  );

  const summary = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weekEntries = marketEntries.filter((entry) => new Date(entry.createdAt).getTime() >= cutoff);
    const parsedEntries = marketEntries.map(parseEntryMeta);
    const principleReady = parsedEntries.filter((entry) => entry.keptPrinciples.length > 0 || entry.brokenPrinciples.length > 0);
    const principleKept = principleReady.filter((entry) => entry.brokenReal.length === 0 && entry.keptPrinciples.length > 0);
    const complianceRate = principleReady.length ? Math.round((principleKept.length / principleReady.length) * 100) : null;
    const mistakeCounts = new Map<string, number>();

    parsedEntries.forEach((entry) => {
      entry.brokenReal.forEach((mistake) => mistakeCounts.set(mistake, (mistakeCounts.get(mistake) ?? 0) + 1));
    });

    const repeatedMistake = Array.from(mistakeCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    const latestCheckpoint = parsedEntries.find((entry) => entry.nextCheckpoint)?.nextCheckpoint ?? "";

    return {
      total: marketEntries.length,
      weekCount: weekEntries.length,
      complianceRate,
      repeatedMistake,
      checkpoint:
        repeatedMistake && repeatedMistake !== "없음"
          ? `다음 매매 전 ${repeatedMistake} 기준을 먼저 확인하세요.`
          : latestCheckpoint || "복기 1건 이상 저장 시 표시됩니다"
    };
  }, [marketEntries]);

  const filteredEntries = useMemo(() => {
    return marketEntries.filter((entry) => {
      const parsed = parseEntryMeta(entry);
      if (activeFilter === "익절") return entry.outcome === "win" || parsed.result === "익절";
      if (activeFilter === "손절") return entry.outcome === "loss" || parsed.result === "손절";
      if (activeFilter === "원칙 지킴") return parsed.brokenReal.length === 0 && parsed.keptPrinciples.length > 0;
      if (activeFilter === "원칙 깨짐") return parsed.brokenReal.length > 0;
      if (activeFilter === "추격 진입") return parsed.entryReasons.includes("추격 진입") || parsed.brokenPrinciples.includes("추격 진입");
      return true;
    });
  }, [activeFilter, marketEntries]);

  const isSubmitReady =
    title.trim() &&
    symbol.trim() &&
    nextFix.trim();

  function resetForm() {
    setTitle("");
    setSymbol("");
    setDirection("관망");
    setResult("진행 중");
    setRResult("0R");
    setCustomRResult("");
    setEntryReasons([]);
    setKeptPrinciples([]);
    setBrokenPrinciples(["없음"]);
    setNextFix("");
    setMemo("");
  }

  function scrollToForm() {
    document.getElementById("quick-journal-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function startFromRadar(entry: JournalEntry) {
    const parsed = parseEntryMeta(entry);
    setTitle(`${entry.symbol || parsed.symbol} 저장 레이더 복기`);
    setSymbol(entry.symbol || parsed.symbol.replace("시장 미기록", ""));
    setDirection(entry.bias === "숏" || entry.bias.toLowerCase().includes("short") ? "숏" : entry.bias === "롱" || entry.bias.toLowerCase().includes("long") ? "롱" : "관망");
    setMemo(entry.verdict || entry.note || "");
    setLastFeedback(null);
    scrollToForm();
  }

  async function addEntry() {
    if (!isSubmitReady) return;

    const selectedRResult = rResult === "직접 입력" ? customRResult.trim() || "직접 입력" : rResult;
    const outcome = resultToOutcome(result);
    const noteLines = [
      `시장/종목: ${symbol.trim()}`,
      `결과: ${result}`,
      `R 결과: ${selectedRResult}`,
      `진입 근거: ${entryReasons.join(", ")}`,
      `지킨 기준: ${keptPrinciples.join(", ")}`,
      `깨진 기준: ${brokenPrinciples.join(", ")}`,
      `다음 매매 전 체크: ${nextFix.trim()}`,
      memo.trim() ? `선택 메모: ${memo.trim()}` : ""
    ].filter(Boolean);
    const feedback = buildFeedback({ entryReasons, keptPrinciples, brokenPrinciples, nextFix: nextFix.trim() });
    const entry = {
      title: title.trim(),
      bias: direction,
      note: noteLines.join("\n"),
      market,
      source: "manual" as const,
      symbol: symbol.trim(),
      verdict: `${market === "stocks" ? "global" : "crypto"} 빠른 복기`,
      outcome,
      outcomeAt: outcome ? new Date().toISOString() : undefined
    };

    if (session?.accessToken) {
      const created = await createRemoteJournalEntry(session.accessToken, entry);
      setEntries((current) => [created, ...current]);
    } else {
      const next = appendJournalEntry(entry);
      setEntries(next);
    }

    setLastFeedback(feedback);
    resetForm();
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
    <main className="journal-page min-h-[100dvh] w-full max-w-full overflow-x-hidden px-3 pb-[calc(18rem+env(safe-area-inset-bottom))] sm:px-4 sm:pb-[calc(10rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 pt-3 sm:pt-0">
        <Header market={market} />
        <RadarTopNav market={market} />

        <section className="enterprise-panel overflow-hidden p-0">
          <div className="relative border-b border-slate-200/80 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_36%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(241,245,249,0.94))] p-5 dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.22),transparent_36%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent-blue/25 bg-accent-blue/10 px-3 py-1 text-xs font-black text-accent-blue">
                  <Radar size={14} aria-hidden />
                  복기 레이더
                </div>
                <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">오늘의 판단을 다음 매매의 기준으로 바꿉니다.</h1>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">{marketHeroLine}</p>
                <p className="mt-2 text-xs font-semibold text-slate-500">좋은 매매보다 지킨 매매를 먼저 기록해보세요.</p>
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200/80 bg-white/70 p-2 text-center dark:border-white/10 dark:bg-black/20">
                {["차트 분석", "근거 저장", "결과 복기"].map((item) => (
                  <div key={item} className="rounded-lg border border-slate-200/80 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-5 p-4 sm:p-5">
            <section className="rounded-xl border border-accent-blue/20 bg-accent-blue/10 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <ClipboardCheck size={18} className="text-accent-blue" aria-hidden />
                    <h2 className="text-lg font-black text-slate-950 dark:text-white">오늘의 복기 요약</h2>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    {summary.total
                      ? "저장된 복기에서 원칙 준수와 반복 실수를 정리했습니다."
                      : "아직 복기 데이터가 없습니다. 첫 복기를 남기면 반복 실수와 원칙 준수율을 정리해드립니다."}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => document.getElementById("pending-radar")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    className="min-h-11 rounded-md border border-accent-blue/40 bg-white/70 px-4 text-sm font-extrabold text-accent-blue hover:bg-accent-blue/10 dark:bg-black/20"
                  >
                    저장한 레이더로 복기하기
                  </button>
                  <button
                    type="button"
                    onClick={scrollToForm}
                    className="min-h-11 rounded-md bg-accent-blue px-4 text-sm font-extrabold text-slate-950 hover:bg-sky-300"
                  >
                    직접 기록하기
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-black/20">
                  <p className="text-[11px] font-black text-slate-500">이번 주 복기 수</p>
                  <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{summary.total ? `${summary.weekCount}건` : "대기 중"}</p>
                  <p className="mt-1 text-xs text-slate-500">{summary.total ? "최근 7일 기준입니다." : "복기 1건 이상 저장 시 표시됩니다."}</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-black/20">
                  <p className="text-[11px] font-black text-slate-500">원칙 준수율</p>
                  <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{summary.complianceRate === null ? "대기 중" : `${summary.complianceRate}%`}</p>
                  <p className="mt-1 text-xs text-slate-500">{summary.complianceRate === null ? "지킨 기준과 깨진 기준 저장 후 표시됩니다." : "기록된 기준 기반입니다."}</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-black/20">
                  <p className="text-[11px] font-black text-slate-500">반복 실수</p>
                  <p className="mt-2 text-lg font-black text-slate-950 dark:text-white">{summary.repeatedMistake || "대기 중"}</p>
                  <p className="mt-1 text-xs text-slate-500">{summary.repeatedMistake ? "가장 자주 나온 깨진 기준입니다." : "깨진 기준 저장 후 표시됩니다."}</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-black/20">
                  <p className="text-[11px] font-black text-slate-500">다음 매매 전 체크포인트</p>
                  <p className="mt-2 text-sm font-bold leading-6 text-slate-950 dark:text-white">{summary.checkpoint}</p>
                </div>
              </div>
            </section>

            <section id="pending-radar" className="scroll-mt-4 scroll-mb-56 rounded-xl border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-surface-cardSoft">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Target size={18} className="text-accent-blue" aria-hidden />
                    <h2 className="text-lg font-black text-slate-950 dark:text-white">복기 대기 중인 레이더</h2>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-400">분석 화면에서 저장한 레이더를 결과 확인과 복기로 이어갑니다.</p>
                </div>
                <span className="rounded-md border border-slate-200/80 bg-white/70 px-2 py-1 text-xs font-bold text-slate-600 dark:border-white/10 dark:bg-black/20 dark:text-slate-400">
                  {pendingRadarEntries.length ? `${pendingRadarEntries.length}건 대기` : "대기 없음"}
                </span>
              </div>

              {pendingRadarEntries.length ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {pendingRadarEntries.map((entry) => {
                    const checkpoint =
                      entry.scoutSnapshot
                        ? `무효화 기준 ${entry.scoutSnapshot.invalidation.toLocaleString()} 확인`
                        : entry.verdict || "저장 당시 근거와 결과를 확인하세요.";
                    return (
                      <article key={entry.id} className="rounded-xl border border-accent-blue/20 bg-white/75 p-4 dark:border-accent-blue/15 dark:bg-black/20">
                        <SourceBadge entry={entry} />
                        <div className="mt-3 grid gap-2 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">종목/시장</span>
                            <span className="font-bold text-slate-950 dark:text-white">{entry.symbol || marketLabel}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">저장 당시 방향성</span>
                            <span className="font-bold text-slate-950 dark:text-white">{entry.bias || "관망"}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">저장 시간</span>
                            <span className="font-bold text-slate-950 dark:text-white">{formatDateTime(entry.createdAt)}</span>
                          </div>
                          <div className="rounded-md border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-black/20">
                            <p className="text-[11px] font-black text-slate-500">체크포인트</p>
                            <p className="mt-1 text-sm font-semibold leading-6 text-slate-700 dark:text-slate-200">{checkpoint}</p>
                          </div>
                        </div>
                        <OutcomeButtons entry={entry} onOutcome={recordOutcome} />
                        <button
                          type="button"
                          onClick={() => startFromRadar(entry)}
                          className="mt-3 min-h-10 w-full rounded-md border border-accent-blue/40 bg-accent-blue/10 px-3 text-sm font-extrabold text-accent-blue hover:bg-accent-blue/15"
                        >
                          결과 입력 후 복기 작성
                        </button>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white/70 p-5 dark:border-white/15 dark:bg-black/20">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">아직 복기할 저장 레이더가 없습니다.</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    분석 화면에서 레이더를 저장하면 이곳에서 결과를 확인할 수 있습니다. 저장된 근거가 생기면 복기 대기 카드로 이어집니다.
                  </p>
                </div>
              )}
            </section>

            <section id="quick-journal-form" className="scroll-mt-4 scroll-mb-64 min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 p-3 dark:border-white/10 dark:bg-surface-cardSoft sm:p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-accent-blue/25 bg-accent-blue/10 text-accent-blue">
                  <ListChecks size={20} aria-hidden />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-950 dark:text-white">빠른 복기 입력</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-400">긴 글 대신 칩을 눌러 30초 안에 진입 근거, 지킨 기준, 깨진 기준을 남깁니다.</p>
                </div>
              </div>

              <div className="mt-5 grid min-w-0 gap-4">
                <div className="grid min-w-0 gap-3 lg:grid-cols-2">
                  <label className="grid min-w-0 gap-2 text-xs font-black text-slate-700 dark:text-slate-300" htmlFor="journal-title">
                    복기 제목
                    <input
                      id="journal-title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder={market === "stocks" ? "예: NVDA 지지 반응 복기" : "예: BTC 눌림목 관찰 복기"}
                      className="min-h-11 min-w-0 max-w-full rounded-md border border-slate-200 bg-white/80 px-3 text-[15px] font-semibold text-slate-950 outline-none placeholder:text-slate-400 focus:border-accent-blue dark:border-surface-line dark:bg-black/20 dark:text-white dark:placeholder:text-slate-600 sm:min-h-12 sm:px-4 sm:text-base"
                    />
                  </label>
                  <label className="grid min-w-0 gap-2 text-xs font-black text-slate-700 dark:text-slate-300" htmlFor="journal-symbol">
                    시장/종목
                    <input
                      id="journal-symbol"
                      value={symbol}
                      onChange={(event) => setSymbol(event.target.value)}
                      placeholder={market === "stocks" ? "예: SPY, NVDA, QQQ" : "예: BTC, ETH, SOL"}
                      className="min-h-11 min-w-0 max-w-full rounded-md border border-slate-200 bg-white/80 px-3 text-[15px] font-semibold text-slate-950 outline-none placeholder:text-slate-400 focus:border-accent-blue dark:border-surface-line dark:bg-black/20 dark:text-white dark:placeholder:text-slate-600 sm:min-h-12 sm:px-4 sm:text-base"
                    />
                  </label>
                </div>

                <div className="grid min-w-0 gap-3 lg:grid-cols-3">
                  <ChipGroup label="방향" options={directions} selected={[direction]} onToggle={(item) => setDirection(item as DirectionType)} />
                  <ChipGroup label="결과" options={resultOptions} selected={[result]} onToggle={(item) => setResult(item as TradeResult)} tone="green" />
                  <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-black/15">
                    <p className="mb-2 text-xs font-black text-slate-700 dark:text-slate-200">손익 결과</p>
                    <div className="flex min-w-0 max-w-full flex-wrap gap-1.5 sm:gap-2">
                      {rResultOptions.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setRResult(item)}
                          className={`min-h-9 min-w-0 max-w-full flex-1 basis-[calc(50%-0.1875rem)] whitespace-normal break-keep rounded-md border px-2 py-2 text-[13px] font-bold leading-snug transition sm:min-h-10 sm:flex-none sm:basis-auto sm:px-3 sm:text-sm ${
                            rResult === item
                              ? "border-accent-blue bg-accent-blue text-slate-950"
                              : "border-slate-200 bg-white/80 text-slate-700 hover:border-accent-blue/50 hover:text-slate-950 dark:border-surface-line dark:bg-surface-cardSoft dark:text-slate-300 dark:hover:text-white"
                          }`}
                        >
                          {profitResultLabel(item)}
                        </button>
                      ))}
                    </div>
                    {rResult === "직접 입력" ? (
                      <input
                        value={customRResult}
                        onChange={(event) => setCustomRResult(event.target.value)}
                        placeholder="예: 소폭 수익 / 약손실"
                        className="mt-2 min-h-10 w-full min-w-0 max-w-full rounded-md border border-slate-200 bg-white/80 px-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400 focus:border-accent-blue dark:border-surface-line dark:bg-black/20 dark:text-white dark:placeholder:text-slate-600"
                      />
                    ) : null}
                  </div>
                </div>

                <ChipGroup
                  label="진입 근거"
                  helper="복수 선택"
                  options={entryReasonOptions}
                  selected={entryReasons}
                  onToggle={(item) => setEntryReasons((current) => toggleChip(current, item))}
                />
                <ChipGroup
                  label="지킨 기준"
                  helper="원칙 준수 체크"
                  options={keptPrincipleOptions}
                  selected={keptPrinciples}
                  onToggle={(item) => setKeptPrinciples((current) => toggleChip(current, item))}
                  tone="green"
                />
                <ChipGroup
                  label="깨진 기준"
                  helper="없음 선택 가능"
                  options={brokenPrincipleOptions}
                  selected={brokenPrinciples}
                  onToggle={(item) => setBrokenPrinciples((current) => toggleChip(current, item, true))}
                  tone="red"
                />

                <label className="grid min-w-0 gap-2 text-xs font-black text-slate-700 dark:text-slate-300" htmlFor="journal-next-fix">
                  다음에 고칠 점 한 줄
                  <input
                    id="journal-next-fix"
                    value={nextFix}
                    onChange={(event) => setNextFix(event.target.value)}
                    placeholder="예: 다음 매매 전 손절 기준을 먼저 적고 확인하기"
                    className="min-h-11 min-w-0 max-w-full rounded-md border border-slate-200 bg-white/80 px-3 text-[15px] font-semibold text-slate-950 outline-none placeholder:text-slate-400 focus:border-accent-blue dark:border-surface-line dark:bg-black/20 dark:text-white dark:placeholder:text-slate-600 sm:min-h-12 sm:px-4 sm:text-base"
                  />
                </label>

                <label className="grid min-w-0 gap-2 text-xs font-black text-slate-700 dark:text-slate-300" htmlFor="journal-memo">
                  선택 메모
                  <textarea
                    id="journal-memo"
                    value={memo}
                    onChange={(event) => setMemo(event.target.value)}
                    placeholder="차트 상황이나 감정 상태를 짧게 남겨도 좋습니다."
                    rows={3}
                    className="w-full min-w-0 max-w-full resize-none rounded-md border border-slate-200 bg-white/80 px-3 py-3 text-[15px] leading-7 text-slate-950 outline-none placeholder:text-slate-400 focus:border-accent-blue dark:border-surface-line dark:bg-black/20 dark:text-white dark:placeholder:text-slate-600 sm:px-4 sm:text-base"
                  />
                </label>

                <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-black/20">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    {isSubmitReady
                      ? "필수 항목이 준비되었습니다. 저장하면 이번 복기 요약과 다음 체크포인트를 바로 보여드립니다."
                      : "복기 제목, 시장/종목, 다음 체크포인트를 채우면 저장할 수 있습니다. 진입 근거와 지킨 기준은 칩으로 빠르게 더해보세요."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addEntry}
                  disabled={!isSubmitReady}
                  className="inline-flex min-h-12 w-full max-w-full items-center justify-center gap-2 whitespace-normal break-keep rounded-md bg-accent-blue px-3 text-center text-[13px] font-extrabold leading-snug text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400 sm:w-auto sm:px-4 sm:text-sm"
                >
                  <Plus size={18} aria-hidden />
                  복기 저장하고 요약 보기
                </button>
              </div>
            </section>

            {lastFeedback ? (
              <section className="rounded-xl border border-signal-success/25 bg-signal-success/10 p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-signal-success/30 bg-signal-success/15 text-signal-success">
                    <ShieldCheck size={20} aria-hidden />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-950 dark:text-white">이번 복기 요약</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">{lastFeedback.message}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-black/20">
                    <p className="text-[11px] font-black text-slate-500">원칙 준수 상태</p>
                    <p className="mt-2 text-sm font-bold text-slate-950 dark:text-white">{lastFeedback.principleStatus}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-black/20">
                    <p className="text-[11px] font-black text-slate-500">주요 실수</p>
                    <p className="mt-2 text-sm font-bold text-slate-950 dark:text-white">{lastFeedback.mistake}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-black/20">
                    <p className="text-[11px] font-black text-slate-500">잘한 점</p>
                    <p className="mt-2 text-sm font-bold text-slate-950 dark:text-white">{lastFeedback.wellDone}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-black/20">
                    <p className="text-[11px] font-black text-slate-500">다음 매매 전 체크포인트</p>
                    <p className="mt-2 text-sm font-bold leading-6 text-slate-950 dark:text-white">{lastFeedback.checkpoint}</p>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="scroll-mb-56 rounded-xl border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-surface-cardSoft">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <History size={18} className="text-accent-blue" aria-hidden />
                    <h2 className="text-lg font-black text-slate-950 dark:text-white">복기 히스토리</h2>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-400">결과보다 원칙, 리스크 관리, 다음 체크포인트가 한눈에 보이도록 정리합니다.</p>
                </div>
                <div className="flex min-w-0 max-w-full flex-wrap gap-1.5 sm:gap-2">
                  {historyFilters.map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setActiveFilter(filter)}
                      className={`min-h-9 min-w-0 max-w-full flex-1 basis-[calc(50%-0.1875rem)] whitespace-normal break-keep rounded-md border px-2 py-2 text-[13px] font-bold leading-snug sm:min-h-10 sm:flex-none sm:basis-auto sm:px-3 sm:text-sm ${
                        activeFilter === filter
                          ? "border-accent-blue bg-accent-blue text-slate-950"
                          : "border-slate-200 bg-white/70 text-slate-700 hover:border-accent-blue/50 hover:text-slate-950 dark:border-surface-line dark:bg-black/20 dark:text-slate-300 dark:hover:text-white"
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {isLoadingRemote ? (
                  <div className="flex items-center gap-2 rounded-md border border-slate-200/80 bg-white/70 p-4 text-sm text-slate-700 dark:border-white/10 dark:bg-black/20 dark:text-slate-300">
                    <Loader2 className="animate-spin text-accent-blue" size={17} aria-hidden />
                    복기 기록을 불러오는 중입니다.
                  </div>
                ) : filteredEntries.length ? (
                  filteredEntries.map((entry) => {
                    const parsed = parseEntryMeta(entry);
                    const expanded = expandedEntryId === entry.id;
                    return (
                      <article key={entry.id} className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200/80 bg-white/75 p-3 dark:border-surface-line dark:bg-black/20 sm:p-4">
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <div className="min-w-0">
                            <SourceBadge entry={entry} />
                            <h3 className="mt-2 min-w-0 break-keep text-base font-black leading-snug text-slate-950 dark:text-white">{entry.title}</h3>
                            <div className="mt-2 flex min-w-0 max-w-full flex-wrap gap-1.5 sm:gap-2">
                              <span className="max-w-full whitespace-normal break-keep rounded-md border border-slate-200/80 bg-white/70 px-2 py-1 text-xs font-bold leading-snug text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
                                {parsed.symbol}
                              </span>
                              <span className="max-w-full whitespace-normal break-keep rounded-md border border-slate-200/80 bg-white/70 px-2 py-1 text-xs font-bold leading-snug text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
                                방향 {entry.bias || "미기록"}
                              </span>
                              <span className={`max-w-full whitespace-normal break-keep rounded-md border px-2 py-1 text-xs font-bold leading-snug ${outcomeClass(entry.outcome)}`}>
                                결과 {parsed.result}
                              </span>
                              <span className="max-w-full whitespace-normal break-keep rounded-md border border-slate-200/80 bg-white/70 px-2 py-1 text-xs font-bold leading-snug text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
                                손익 {profitResultLabel(parsed.rResult)}
                              </span>
                              <span className="max-w-full whitespace-normal break-keep rounded-md border border-slate-200/80 bg-white/70 px-2 py-1 text-xs font-bold leading-snug text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
                                <Clock3 className="mr-1 inline" size={12} aria-hidden />
                                {formatDateTime(entry.createdAt)}
                              </span>
                            </div>
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

                        <div className="mt-3 grid gap-2 md:grid-cols-3">
                          <div className="rounded-md border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-black/20">
                            <p className="text-[11px] font-black text-slate-500">실수 태그</p>
                            <p className="mt-1 text-sm font-bold text-slate-950 dark:text-white">{parsed.brokenReal.length ? parsed.brokenReal.join(", ") : "없음"}</p>
                          </div>
                          <div className="rounded-md border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-black/20">
                            <p className="text-[11px] font-black text-slate-500">원칙 준수 상태</p>
                            <p className="mt-1 flex items-center gap-1 text-sm font-bold text-slate-950 dark:text-white">
                              {parsed.brokenReal.length ? <AlertTriangle size={14} className="text-signal-danger" aria-hidden /> : <CheckCircle2 size={14} className="text-signal-success" aria-hidden />}
                              {parsed.principleStatus}
                            </p>
                          </div>
                          <div className="rounded-md border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-black/20">
                            <p className="text-[11px] font-black text-slate-500">다음 매매 전 체크</p>
                            <p className="mt-1 text-sm font-bold leading-6 text-slate-950 dark:text-white">{parsed.nextCheckpoint}</p>
                          </div>
                        </div>

                        {(entry.source === "scout" || entry.source === "chart") ? <OutcomeButtons entry={entry} onOutcome={recordOutcome} /> : null}

                        <button
                          type="button"
                          onClick={() => setExpandedEntryId(expanded ? null : entry.id)}
                          className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200/80 bg-white/70 px-3 text-sm font-bold text-slate-700 hover:border-accent-blue/50 hover:text-slate-950 dark:border-white/10 dark:bg-black/20 dark:text-slate-300 dark:hover:text-white"
                        >
                          자세히 보기
                          {expanded ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
                        </button>

                        {expanded ? (
                          <div className="mt-3 rounded-md border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-black/20">
                            <div className="grid gap-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
                              <p>
                                <span className="font-black text-slate-950 dark:text-slate-100">진입 근거.</span>{" "}
                                {parsed.entryReasons.length ? parsed.entryReasons.join(", ") : "기록 대기"}
                              </p>
                              <p>
                                <span className="font-black text-slate-950 dark:text-slate-100">지킨 기준.</span>{" "}
                                {parsed.keptPrinciples.length ? parsed.keptPrinciples.join(", ") : "기록 대기"}
                              </p>
                              <p>
                                <span className="font-black text-slate-950 dark:text-slate-100">깨진 기준.</span>{" "}
                                {parsed.brokenPrinciples.length ? parsed.brokenPrinciples.join(", ") : "기록 대기"}
                              </p>
                              <p>
                                <span className="font-black text-slate-950 dark:text-slate-100">손익 결과.</span> {profitResultLabel(parsed.rResult)}
                              </p>
                              {parsed.memo ? (
                                <p>
                                  <span className="font-black text-slate-950 dark:text-slate-100">선택 메모.</span> {parsed.memo}
                                </p>
                              ) : entry.note && !isStructuredJournalNote(entry.note) ? (
                                <p className="whitespace-pre-wrap">{entry.note}</p>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-5 dark:border-white/15 dark:bg-black/20">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">아직 저장된 복기가 없습니다.</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      첫 복기는 짧아도 됩니다. 진입 이유와 깨진 원칙만 남겨도 다음 판단이 선명해집니다.
                    </p>
                    <button
                      type="button"
                      onClick={scrollToForm}
                      className="mt-4 min-h-10 rounded-md bg-accent-blue px-4 text-sm font-extrabold text-slate-950 hover:bg-sky-300"
                    >
                      첫 복기 남기기
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>
        <AppFooter />
      </div>
    </main>
  );
}
