"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  Loader2,
  Plus,
  Radar,
  RefreshCw,
  X
} from "lucide-react";
import { watchlistSymbolPool, type ScoutSetup } from "@/lib/setupScout";
import {
  addToWatchlist,
  getWatchlist,
  removeFromWatchlist,
  symbolToName,
  WATCHLIST_LIMIT,
  type WatchlistPlan
} from "@/lib/watchlist";

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

// ─── 미니 레이더 카드 ──────────────────────────────────────────────────────────
function WatchlistSetupCard({ setup }: { setup: ScoutSetup }) {
  const isLong = setup.plan.side === "long";
  const sideColor = isLong ? "text-signal-success" : "text-signal-danger";
  const SideIcon = isLong ? ArrowUpRight : ArrowDownRight;
  const sym = symbolToName(setup.symbol);

  const proximityText =
    setup.proximity === "ready"
      ? "관찰 구간 진입"
      : setup.proximity === "near"
        ? `${Math.abs(setup.distancePercent).toFixed(2)}% 근접`
        : `${Math.abs(setup.distancePercent).toFixed(2)}% 대기`;

  const proximityColor =
    setup.proximity === "ready"
      ? "text-signal-warning border-signal-warning/40 bg-signal-warning/10"
      : setup.proximity === "near"
        ? "text-accent-blue border-accent-blue/40 bg-accent-blue/10"
        : "text-slate-400 border-slate-600/40 bg-slate-600/10";

  return (
    <article className="rounded-lg border border-surface-line bg-surface-cardSoft p-3.5 transition hover:border-accent-blue/40">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-black text-white">{sym}</h4>
          <span className="rounded border border-white/10 bg-black/20 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
            {setup.timeframe}
          </span>
          <SideIcon className={sideColor} size={14} aria-hidden />
          <span className={`text-[11px] font-bold ${sideColor}`}>{isLong ? "롱" : "숏"}</span>
        </div>
        <span
          className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-black ${proximityColor}`}
        >
          {proximityText}
        </span>
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded border border-white/10 bg-black/30 px-1 py-1.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">현재가</p>
          <p className="mt-0.5 text-[11px] font-bold text-white">{formatPrice(setup.currentPrice)}</p>
        </div>
        <div className="rounded border border-accent-blue/20 bg-accent-blue/5 px-1 py-1.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-accent-blue">관찰 구간</p>
          <p className="mt-0.5 text-[10px] font-bold text-white">
            {formatPrice(setup.plan.entryLow)}~{formatPrice(setup.plan.entryHigh)}
          </p>
        </div>
        <div className="rounded border border-signal-danger/20 bg-signal-danger/10 px-1 py-1.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-signal-danger">무효화</p>
          <p className="mt-0.5 text-[11px] font-bold text-white">{formatPrice(setup.plan.invalidation)}</p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
        <span>{setup.plan.quality}급 감지 · 구조 신뢰도 {setup.plan.confidence}%</span>
        <span className="font-bold text-slate-400">다음 레벨 {formatPrice(setup.plan.target1)}</span>
      </div>
    </article>
  );
}

// ─── 코인 추가 모달 ───────────────────────────────────────────────────────────
function AddCoinModal({
  watchlist,
  plan,
  onAdd,
  onRemove,
  onClose
}: {
  watchlist: string[];
  plan: WatchlistPlan;
  onAdd: (symbol: string) => void;
  onRemove: (symbol: string) => void;
  onClose: () => void;
}) {
  const limit = WATCHLIST_LIMIT[plan];
  const pool = watchlistSymbolPool as readonly string[];

  // 모달 외부 클릭으로 닫기
  const backdropRef = useRef<HTMLDivElement>(null);

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-xl border border-surface-line bg-surface-card p-5 shadow-glow">
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
          현재 {watchlist.length}/{limit}개 · 베타 기간에는 전체 공개로 테스트합니다.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {pool.map((symbol) => {
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
        </div>

        <p className="mt-4 text-[10px] leading-5 text-slate-600">
          추가한 코인은 3분 단위로 레이더가 돌며 확인합니다. 정식 서비스 전까지 저장 조건과 제공 범위는 바뀔 수 있습니다.
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
  const plan: WatchlistPlan = "admin";
  const limit = WATCHLIST_LIMIT[plan];

  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [scanState, setScanState] = useState<ScanState>({ status: "idle" });

  // localStorage에서 초기 로드
  useEffect(() => {
    setWatchlist(getWatchlist());
  }, []);

  // 레이더 실행
  const runScan = useCallback(async (symbols: string[]) => {
    if (symbols.length === 0) {
      setScanState({ status: "idle" });
      return;
    }
    setScanState({ status: "loading" });
    try {
      const res = await fetch("/api/watchlist-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols }),
        cache: "no-store"
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `서버 오류 (${res.status})`);
      }
      const data = (await res.json()) as { setups: ScoutSetup[]; cachedAt: number };
      setScanState({ status: "ready", setups: data.setups, cachedAt: data.cachedAt });
    } catch (error) {
      const message = error instanceof Error ? error.message : "레이더 판독에 실패했습니다.";
      setScanState({ status: "error", message });
    }
  }, []);

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

  // ── 베타 기간 전체 공개 UI ──
  const isEmpty = watchlist.length === 0;

  return (
    <>
      {showModal && (
        <AddCoinModal
          watchlist={watchlist}
          plan={plan}
          onAdd={handleAdd}
          onRemove={handleRemove}
          onClose={() => setShowModal(false)}
        />
      )}

      <section className="rounded-lg border border-surface-line bg-surface-card p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-accent-blue/25 bg-accent-blue/10 text-accent-blue">
              <Radar size={20} aria-hidden />
            </div>
            <div>
              <h2 className="text-base font-black text-white">관심 코인 레이더</h2>
              <p className="mt-0.5 text-xs leading-5 text-slate-500">
                {watchlist.length}/{limit}개 · 3분 단위 레이더
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {scanState.status === "ready" && watchlist.length > 0 && (
              <button
                type="button"
                onClick={() => runScan(watchlist)}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-surface-line bg-surface-cardSoft px-2.5 text-[11px] font-bold text-slate-200 hover:border-accent-blue/50 hover:text-white disabled:opacity-50"
              >
                <RefreshCw size={12} aria-hidden />
                다시 돌리기
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowModal(true)}
              disabled={watchlist.length >= limit}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-accent-blue/30 bg-accent-blue/10 px-3 text-[11px] font-black text-accent-blue transition hover:bg-accent-blue hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus size={13} aria-hidden />
              코인 추가
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
            <div className="rounded-lg border border-dashed border-surface-line p-6 text-center">
              <Bookmark className="mx-auto text-slate-600" size={24} aria-hidden />
              <p className="mt-2 text-sm font-bold text-slate-400">관심 코인을 추가해보세요.</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                ADA, AVAX, LINK 등 관심 코인 중 최대 {limit}개를 선택해 구조 변화를 감지합니다.
              </p>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-md border border-accent-blue/40 bg-accent-blue/15 px-4 text-xs font-black text-accent-blue transition hover:bg-accent-blue hover:text-slate-950"
              >
                <Plus size={13} aria-hidden />
                코인 선택하기
              </button>
            </div>
          ) : scanState.status === "loading" ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-surface-line bg-surface-cardSoft p-6 text-sm text-slate-400">
              <Loader2 size={16} className="animate-spin" aria-hidden />
              관심 코인 레이더 작동 중...
            </div>
          ) : scanState.status === "error" ? (
            <div className="rounded-lg border border-signal-danger/30 bg-signal-danger/10 p-4 text-sm text-signal-danger">
              {scanState.message}
            </div>
          ) : scanState.status === "ready" ? (
            scanState.setups.length === 0 ? (
              <div className="rounded-lg border border-surface-line bg-surface-cardSoft p-5 text-center">
                <p className="text-sm font-bold text-slate-300">현재 강하게 감지된 구조가 없습니다.</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  관심 코인의 구조가 명확하지 않거나 관망 구간입니다.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {scanState.setups.map((setup) => (
                  <WatchlistSetupCard
                    key={`${setup.symbol}-${setup.timeframe}`}
                    setup={setup}
                  />
                ))}
              </div>
            )
          ) : null}
        </div>
      </section>
    </>
  );
}
