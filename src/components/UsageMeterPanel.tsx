"use client";
// 무료 체험과 Pro 사용량 차이를 보여주는 일일 사용량 패널이다.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Crown, Gauge, RotateCcw, Zap } from "lucide-react";
import {
  getUsageBucketStates,
  readUsageSnapshot,
  resetUsageSnapshot,
  summarizeUsage,
  USAGE_CHANGED_EVENT,
  type UsageSnapshot
} from "@/lib/usageMeter";

function barColor(percent: number, isOverFree: boolean) {
  if (isOverFree) return "bg-rose-400";
  if (percent >= 80) return "bg-amber-300";
  return "bg-cyan-300";
}

function UsageRow({ state }: { state: ReturnType<typeof getUsageBucketStates>[number] }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-white">{state.label}</p>
          <p className="mt-1 line-clamp-1 text-[11px] text-slate-500">{state.description}</p>
        </div>
        <span className={`shrink-0 rounded border px-2 py-1 text-[11px] font-black ${
          state.isOverFree
            ? "border-rose-400/30 bg-rose-500/10 text-rose-300"
            : "border-cyan-300/30 bg-cyan-300/10 text-cyan-200"
        }`}
        >
          {state.used}/{state.freeDailyLimit}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${barColor(state.freePercent, state.isOverFree)}`} style={{ width: `${state.freePercent}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-slate-500">
        <span>Free 잔여 {state.freeRemaining}회</span>
        <span>Pro 일 {state.proDailyLimit}회</span>
      </div>
    </div>
  );
}

export function UsageMeterPanel({ compact = false }: { compact?: boolean }) {
  const [snapshot, setSnapshot] = useState<UsageSnapshot>(() => readUsageSnapshot());

  useEffect(() => {
    const refresh = () => setSnapshot(readUsageSnapshot());
    refresh();
    window.addEventListener(USAGE_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(USAGE_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const summary = useMemo(() => summarizeUsage(snapshot), [snapshot]);
  const visibleStates = compact ? summary.states.slice(0, 3) : summary.states;
  const title =
    summary.overCount > 0
      ? "오늘 무료 기준을 넘긴 항목이 있습니다."
      : summary.usedTotal > 0
        ? "오늘 레이더 사용량이 쌓이고 있습니다."
        : "오늘 사용할 레이더 한도를 준비했습니다.";

  return (
    <section className="rounded-lg border border-cyan-300/25 bg-surface-card p-4 shadow-glow sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 text-cyan-300">
            <Gauge size={20} aria-hidden />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Usage Radar</p>
            <h2 className="mt-1 text-lg font-black text-white">{title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 [word-break:keep-all]">
              Free는 핵심 흐름을 확인하는 체험 모드이고, Pro는 코인·해외주식·AI·알림을 매일 여러 번 돌리는 운영 모드입니다.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setSnapshot(resetUsageSnapshot())}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 text-xs font-black text-slate-300 transition hover:border-cyan-300/40 hover:text-white"
          >
            <RotateCcw size={13} aria-hidden />
            초기화
          </button>
          <Link
            href="/pro"
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md bg-cyan-300 px-3 text-xs font-black text-slate-950 transition hover:bg-cyan-200"
          >
            <Crown size={13} aria-hidden />
            Pro 보기
          </Link>
        </div>
      </div>

      <div className={`mt-4 grid gap-2 ${compact ? "lg:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-3"}`}>
        {visibleStates.map((state) => (
          <UsageRow key={state.id} state={state} />
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/10 p-3 text-xs leading-5 text-cyan-100 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-start gap-2">
          <Zap className="mt-0.5 shrink-0" size={14} aria-hidden />
          계정 결제 연결 후에는 이 사용량이 서버 기준으로 동기화됩니다.
        </span>
        {compact ? (
          <Link href="/pro" className="font-black text-cyan-200 hover:text-white">
            전체 플랜 보기
          </Link>
        ) : null}
      </div>
    </section>
  );
}
