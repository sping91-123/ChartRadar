"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  Crown,
  Loader2,
  Plus,
  Radar,
  RefreshCw,
  Search,
  X
} from "lucide-react";
import { watchlistSymbolPool, type ScoutSetup } from "@/lib/setupScout";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { getUsageGate, recordUsageEvent } from "@/lib/usageMeter";
import { hasMarketEntitlement } from "@/lib/billing";
import { withSupabaseAuth } from "@/lib/authFetch";
import {
  addToWatchlist,
  getWatchlistLimit,
  getWatchlist,
  removeFromWatchlist,
  symbolToName,
  type WatchlistPlan
} from "@/lib/watchlist";

type WatchlistBucket = "candidate" | "watch" | "danger";

interface WatchlistFilterMeta {
  bucket: WatchlistBucket;
  label: string;
  className: string;
}

// ─── 가격 포매터 ─────────────────────────────────────────────────────────────
function formatPrice(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return "-";
  let decimals = 2;
  if (price < 0.01) decimals = 6;
  else if (price < 1) decimals = 5;
  else if (price < 10) decimals = 4;
  else if (price < 100) decimals = 3;
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(price);
}

function uniqueItems(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function activeSetupAnalysis(setup: ScoutSetup) {
  return setup.analysis.timeframeAnalyses.find((item) => item.timeframe === setup.timeframe);
}

function buildWatchlistRiskSignals(setup: ScoutSetup) {
  const active = activeSetupAnalysis(setup);
  const signals: string[] = [];

  if (setup.status === "active" || setup.proximity === "ready") signals.push("급등 추격 주의");
  if (setup.watchKind === "counter" || active?.condition.regime === "mixed") {
    signals.push("상승/하락 근거 혼재");
    signals.push("BTC 방향성 의존");
  }
  if (active?.condition.volatilityState === "expanded") signals.push("변동성 확대");
  if (active?.condition.volumeState === "low") {
    signals.push("거래량 부족");
    signals.push("저유동성 리스크");
  }
  if (setup.proximity === "wait") signals.push("추적 대기");

  return uniqueItems([...signals, ...setup.analysis.riskFlags]).slice(0, 5);
}

function summarizeWatchlistRisk(setup: ScoutSetup) {
  return buildWatchlistRiskSignals(setup)[0] ?? "리스크 점검";
}

function classifyWatchlistSetup(setup: ScoutSetup): WatchlistFilterMeta {
  const risks = buildWatchlistRiskSignals(setup);
  const isDanger =
    setup.status === "active" ||
    setup.watchKind === "counter" ||
    risks.includes("급등 추격 주의") ||
    risks.includes("변동성 확대") ||
    risks.length >= 3;

  if (isDanger) {
    return {
      bucket: "danger",
      label: "고위험",
      className: "text-signal-danger"
    };
  }

  if (setup.status === "watch" || setup.proximity === "wait") {
    return {
      bucket: "watch",
      label: "관망",
      className: "text-signal-warning"
    };
  }

  return {
    bucket: "candidate",
    label: "추적 후보",
    className: "text-accent-blue"
  };
}

function watchlistJudgmentLabel(setup: ScoutSetup, meta: WatchlistFilterMeta) {
  if (meta.bucket === "danger") return "고위험";
  if (meta.bucket === "watch") return "관망 우위";
  return setup.plan.side === "long" ? "상방 환경" : "하방 환경";
}

function WatchlistProCta() {
  return (
    <div className="mt-3 border-y border-cyan-300/25 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black text-cyan-100">Coin Pro 관심 코인 상세 판단</p>
          <p className="mt-1 text-sm leading-6 text-slate-300 [word-break:keep-all]">
            BTC·ETH와 알트의 위험, 확인할 가격, 해석을 다시 볼 조건, 세부 근거는 Coin Pro에서 확인할 수 있습니다.
          </p>
        </div>
        <Link
          href="/pro?market=crypto"
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-cyan-300 px-3 text-xs font-black text-slate-950 transition hover:bg-cyan-200"
        >
          <Crown size={14} aria-hidden />
          Coin Pro로 코인 상세 판단 열기
        </Link>
      </div>
    </div>
  );
}

// ─── 미니 레이더 카드 ──────────────────────────────────────────────────────────
function WatchlistSetupCard({ setup, canShowProDetails }: { setup: ScoutSetup; canShowProDetails: boolean }) {
  const isLong = setup.plan.side === "long";
  const sideColor = isLong ? "text-signal-success" : "text-signal-danger";
  const SideIcon = isLong ? ArrowUpRight : ArrowDownRight;
  const sym = symbolToName(setup.symbol);
  const meta = classifyWatchlistSetup(setup);
  const riskSignals = buildWatchlistRiskSignals(setup);
  const summaryRisk = summarizeWatchlistRisk(setup);

  const proximityText =
    setup.proximity === "ready"
      ? "관찰 구간 도달"
      : setup.proximity === "near"
        ? `${Math.abs(setup.distancePercent).toFixed(2)}% 근접`
        : `${Math.abs(setup.distancePercent).toFixed(2)}% 대기`;

  const proximityColor =
    setup.proximity === "ready"
      ? "text-signal-warning"
      : setup.proximity === "near"
        ? "text-accent-blue"
        : "text-slate-400";

  return (
    <article className="border-t border-ui-line py-3.5 transition first:border-t-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-black text-white">{sym}</h4>
          <span className="rounded border border-white/10 bg-black/20 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
            {setup.timeframe}
          </span>
          <SideIcon className={sideColor} size={14} aria-hidden />
          <span className={`text-[11px] font-bold ${meta.bucket === "candidate" ? sideColor : "text-slate-300"}`}>
            {watchlistJudgmentLabel(setup, meta)}
          </span>
        </div>
        <span className={`inline-flex items-center text-[10px] font-black ${meta.className}`}>
          {meta.label}
        </span>
      </div>

      <div className={`mt-2.5 grid gap-2 border-y border-white/10 py-2 text-xs ${canShowProDetails ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        <div className="flex items-center justify-between gap-3">
          <p className="font-bold uppercase tracking-wider text-slate-500">현재가</p>
          <p className="font-bold text-white">{formatPrice(setup.currentPrice)}</p>
        </div>
        {canShowProDetails ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <p className="font-bold uppercase tracking-wider text-accent-blue">관찰 구간</p>
              <p className="text-right font-bold text-white">
                {formatPrice(setup.plan.entryLow)}~{formatPrice(setup.plan.entryHigh)}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold uppercase tracking-wider text-signal-danger">무효화</p>
              <p className="font-bold text-white">{formatPrice(setup.plan.invalidation)}</p>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold uppercase tracking-wider text-slate-500">요약 리스크</p>
            <p className="font-bold text-white">{summaryRisk}</p>
          </div>
        )}
      </div>

      {canShowProDetails ? (
        <>
          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
            <span>{setup.plan.quality}급 감지 · 구조 신뢰도 {setup.plan.confidence}%</span>
            <span className="font-bold text-slate-400">다음 레벨 {formatPrice(setup.plan.target1)}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={`text-[10px] font-black ${proximityColor}`}>{proximityText}</span>
            {riskSignals.slice(0, 3).map((item) => (
              <span
                key={item}
                className="text-[10px] font-bold text-signal-warning"
              >
                {item}
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-2 text-[10px] leading-5 text-slate-500">
          Basic에서는 방향 요약만 제공합니다. 확인할 가격, 해석을 다시 볼 조건, 세부 위험은 Pro에서 확인할 수 있습니다.
        </p>
      )}
    </article>
  );
}

// ─── 코인 추가 모달 ───────────────────────────────────────────────────────────
function AddCoinModal({
  watchlist,
  plan,
  symbols,
  onAdd,
  onRemove,
  onClose
}: {
  watchlist: string[];
  plan: WatchlistPlan;
  symbols: string[];
  onAdd: (symbol: string) => void;
  onRemove: (symbol: string) => void;
  onClose: () => void;
}) {
  const limit = getWatchlistLimit(plan);
  const pool = symbols.length > 0 ? symbols : (watchlistSymbolPool as readonly string[]);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toUpperCase();
  const filteredPool = useMemo(() => {
    if (!normalizedQuery) return pool;
    return pool.filter((symbol) => {
      const name = symbolToName(symbol).toUpperCase();
      return symbol.toUpperCase().includes(normalizedQuery) || name.includes(normalizedQuery);
    });
  }, [normalizedQuery, pool]);

  // 모달 외부 클릭으로 닫기
  const backdropRef = useRef<HTMLDivElement>(null);

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
    >
      <div className="w-full max-w-sm rounded-xl border border-surface-line bg-surface-card p-5 shadow-none">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-white">관심 코인 추가</h3>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-md border border-surface-line text-slate-400 hover:text-white"
          >
            <X size={15} aria-hidden />
          </button>
        </div>
        <p className="mt-1.5 text-xs leading-5 text-slate-500">
          현재 {watchlist.length}/{limit}개 · 거래량이 충분한 주요 코인 목록 기준입니다.
        </p>

        <label className="mt-4 flex min-h-10 items-center gap-2 rounded-lg border border-surface-line bg-black/20 px-3 text-sm text-slate-300 focus-within:border-accent-blue">
          <Search size={15} className="shrink-0 text-slate-500" aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="코인명 검색. 예: XRP, SOL, PEPE"
            className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-slate-600"
          />
        </label>

        <div className="mt-4 grid max-h-[54vh] grid-cols-3 gap-2 overflow-y-auto pr-1">
          {filteredPool.map((symbol) => {
            const name = symbolToName(symbol);
            const isAdded = watchlist.includes(symbol);
            const isFull = watchlist.length >= limit && !isAdded;

            return (
              <button
                key={symbol}
                type="button"
                disabled={isFull}
                onClick={() => {
                  if (isAdded) {
                    onRemove(symbol);
                    return;
                  }
                  onAdd(symbol);
                }}
                className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-xs font-bold transition
                  ${
                    isAdded
                      ? "border-signal-success/40 bg-signal-success/15 text-signal-success"
                      : isFull
                        ? "cursor-not-allowed border-surface-line bg-surface-cardSoft text-slate-600"
                        : "border-surface-line bg-surface-cardSoft text-slate-200 hover:border-accent-blue/50 hover:text-white"
                  }`}
              >
                <span>{name}</span>
                {isAdded && <BookmarkCheck size={12} aria-hidden />}
              </button>
            );
          })}
          {filteredPool.length === 0 ? (
            <p className="col-span-3 border-y border-white/10 py-4 text-center text-xs leading-5 text-slate-500">
              검색 결과가 없습니다. 심볼을 다시 확인해 주세요.
            </p>
          ) : null}
        </div>

        <p className="mt-4 text-[10px] leading-5 text-slate-600">
          추가한 코인은 3분 단위로 레이더가 돌며 구조 변화를 확인합니다.
        </p>
      </div>
    </div>
  );
}

// ─── 상태 타입 ────────────────────────────────────────────────────────────────
type ScanState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; setups: ScoutSetup[]; cachedAt: number }
  | { status: "error"; message: string };

// ─── 메인 패널 ────────────────────────────────────────────────────────────────
export function WatchlistPanel() {
  const { profile } = useSupabaseAuth();
  const plan: WatchlistPlan = profile?.plan ?? "free";
  const isPaid = hasMarketEntitlement(profile?.plan, "crypto");
  const limit = getWatchlistLimit(plan);

  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [availableSymbols, setAvailableSymbols] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [scanState, setScanState] = useState<ScanState>({ status: "idle" });

  // localStorage에서 초기 로드
  useEffect(() => {
    setWatchlist(getWatchlist());
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadSymbols() {
      try {
        const response = await fetch("/api/crypto-symbols", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { symbols?: Array<{ symbol: string }> };
        const symbols = (data.symbols ?? []).map((item) => item.symbol);
        if (!cancelled && symbols.length) setAvailableSymbols(symbols);
      } catch {
        // 기본 관심 코인 목록으로 충분히 동작하므로 조용히 대체한다.
      }
    }
    void loadSymbols();
    return () => {
      cancelled = true;
    };
  }, []);

  // 레이더 실행
  const runScan = useCallback(async (symbols: string[]) => {
    if (symbols.length === 0) {
      setScanState({ status: "idle" });
      return;
    }
    const usageGate = getUsageGate("watchlistScan", isPaid);
    if (!usageGate.allowed) {
      setScanState({ status: "error", message: usageGate.message });
      return;
    }

    setScanState({ status: "loading" });
    try {
      const res = await fetch(
        "/api/watchlist-scan",
        await withSupabaseAuth({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbols }),
          cache: "no-store"
        })
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "관심코인 레이더를 잠시 확인하지 못했습니다. 잠시 뒤 다시 확인해 주세요.");
      }
      const data = (await res.json()) as { setups: ScoutSetup[]; cachedAt: number };
      setScanState({ status: "ready", setups: data.setups, cachedAt: data.cachedAt });
      recordUsageEvent("watchlistScan");
    } catch (error) {
      const message = error instanceof Error ? error.message : "레이더 판독을 잠시 확인하지 못했습니다. 잠시 뒤 다시 확인해 주세요.";
      setScanState({ status: "error", message });
    }
  }, [isPaid]);

  // watchlist 변경 시 자동 레이더 판독
  useEffect(() => {
    if (watchlist.length > 0) {
      void runScan(watchlist);
    } else {
      setScanState({ status: "idle" });
    }
  }, [watchlist, runScan]);

  function handleAdd(symbol: string) {
    const success = addToWatchlist(symbol, plan);
    if (success) {
      setWatchlist(getWatchlist());
    }
  }

  function handleRemove(symbol: string) {
    removeFromWatchlist(symbol);
    setWatchlist(getWatchlist());
  }

  // ── 정식 출시 초기 전체 공개 UI ──
  const isEmpty = watchlist.length === 0;

  return (
    <>
      {showModal && (
        <AddCoinModal
          watchlist={watchlist}
          plan={plan}
          symbols={availableSymbols}
          onAdd={handleAdd}
          onRemove={handleRemove}
          onClose={() => setShowModal(false)}
        />
      )}

      <section className="border-y border-ui-line py-4 sm:py-5">
        <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center text-accent-blue">
              <Radar size={20} aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black text-white">관심 코인 리스크 레이더</h2>
              <p className="mt-0.5 text-xs leading-5 text-slate-500">
                {watchlist.length}/{limit}개 · 추적 후보 / 관망 / 고위험 확인
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {scanState.status === "ready" && watchlist.length > 0 && (
              <button
                type="button"
                onClick={() => runScan(watchlist)}
                className="inline-flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap border-b border-ui-line px-0 text-[11px] font-bold text-slate-200 hover:text-white disabled:opacity-50"
              >
                <RefreshCw size={12} className="shrink-0" aria-hidden />
                다시 돌리기
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowModal(true)}
              disabled={watchlist.length >= limit}
              className="inline-flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-accent-blue/30 bg-accent-blue/10 px-2.5 text-[11px] font-black text-accent-blue transition hover:bg-accent-blue hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40 sm:px-3"
            >
              <Plus size={13} className="shrink-0" aria-hidden />
              추가
            </button>
          </div>
        </div>

        {/* 현재 관심 코인 칩 */}
        {watchlist.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {watchlist.map((symbol) => (
              <span
                key={symbol}
                className="inline-flex items-center gap-1.5 rounded-md border border-accent-blue/30 bg-accent-blue/10 px-2.5 py-1 text-xs font-bold text-accent-blue"
              >
                {symbolToName(symbol)}
                <button
                  type="button"
                  onClick={() => handleRemove(symbol)}
                  className="text-accent-blue/60 hover:text-accent-blue"
                  aria-label={`${symbolToName(symbol)} 제거`}
                >
                  <X size={11} aria-hidden />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* 레이더 결과 영역 */}
        <div className="mt-4">
          {isEmpty ? (
            <div className="border-y border-dashed border-surface-line py-6 text-center">
              <Bookmark className="mx-auto text-slate-600" size={24} aria-hidden />
              <p className="mt-2 text-sm font-bold text-slate-400">관심 코인을 추가해보세요.</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                ADA, AVAX, LINK 등 관심 코인 중 최대 {limit}개를 선택해 구조 변화를 감지합니다.
              </p>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="mt-4 inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-md border border-accent-blue/40 bg-accent-blue/15 px-4 text-xs font-black text-accent-blue transition hover:bg-accent-blue hover:text-slate-950"
              >
                <Plus size={13} className="shrink-0" aria-hidden />
                코인 선택하기
              </button>
            </div>
          ) : scanState.status === "loading" ? (
            <div className="flex items-center justify-center gap-2 border-y border-ui-line py-6 text-sm text-slate-400">
              <Loader2 size={16} className="animate-spin" aria-hidden />
              관심 코인 레이더 작동 중...
            </div>
          ) : scanState.status === "error" ? (
            <div className="border-y border-signal-danger/30 py-4 text-sm text-signal-danger">
              {scanState.message}
            </div>
          ) : scanState.status === "ready" ? (
            scanState.setups.length === 0 ? (
              <div className="border-y border-ui-line py-5 text-center">
                <p className="text-sm font-bold text-slate-300">현재 강하게 감지된 구조가 없습니다.</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  관심 코인의 구조가 명확하지 않거나 관망 구간입니다.
                </p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-ui-line">
                  {scanState.setups.map((setup) => (
                    <WatchlistSetupCard
                      key={`${setup.symbol}-${setup.timeframe}`}
                      setup={setup}
                      canShowProDetails={isPaid}
                    />
                  ))}
                </div>
                {!isPaid ? <WatchlistProCta /> : null}
              </>
            )
          ) : null}
        </div>
      </section>
    </>
  );
}
