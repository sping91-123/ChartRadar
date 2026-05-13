"use client";
// Free와 Pro 사용량 차이를 보여주는 일일 사용량 패널이다.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Crown, Gauge, RotateCcw, Zap } from "lucide-react";
import {
  getUsageBucketStates,
  readUsageSnapshot,
  resetUsageSnapshot,
  summarizeUsage,
  USAGE_CHANGED_EVENT,
  type UsageBucketId,
  type UsageSnapshot
} from "@/lib/usageMeter";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { getEntitlementLabel, hasAnyPaidEntitlement, type BillingPageScope } from "@/lib/billing";

function barColor(percent: number, isOverFree: boolean) {
  if (isOverFree) return "bg-rose-400";
  if (percent >= 80) return "bg-amber-300";
  return "bg-cyan-300";
}

function UsageRow({ state, isPaid }: { state: ReturnType<typeof getUsageBucketStates>[number]; isPaid: boolean }) {
  const activeLimit = isPaid ? state.proDailyLimit : state.freeDailyLimit;
  const activeRemaining = Math.max(0, activeLimit - state.used);
  const activePercent = Math.min(100, Math.round((state.used / activeLimit) * 100));
  const isOverActiveLimit = state.used >= activeLimit;

  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-white">{state.label}</p>
          <p className="mt-1 line-clamp-1 text-[11px] text-slate-500">{state.description}</p>
        </div>
        <span className={`shrink-0 rounded border px-2 py-1 text-[11px] font-black ${
          isOverActiveLimit
            ? "border-rose-400/30 bg-rose-500/10 text-rose-300"
            : "border-cyan-300/30 bg-cyan-300/10 text-cyan-200"
        }`}
        >
          {state.used}/{activeLimit}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${barColor(activePercent, isOverActiveLimit)}`} style={{ width: `${activePercent}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-slate-500">
        <span>{isPaid ? "Pro" : "Free"} 잔여 {activeRemaining}회</span>
        <span>Free {state.freeDailyLimit}회 · Pro {state.proDailyLimit}회</span>
      </div>
    </div>
  );
}

const initialUsageSnapshot: UsageSnapshot = { dateKey: "", counts: {} };

const scopedUsageCopy: Record<BillingPageScope, { free: string; paid: string; proHref: string }> = {
  all: {
    free: "Free는 핵심 흐름을 확인하는 기본 모드이고, Pro는 코인·글로벌·AI·알림을 매일 여러 번 돌리는 운영 모드입니다.",
    paid: "결제 권한이 확인된 계정은 Pro 기준 사용량으로 표시됩니다. 로그인 계정 기준으로 여러 기기에서도 같은 권한을 확인할 수 있습니다.",
    proHref: "/pro"
  },
  crypto: {
    free: "Free는 코인 레이더의 핵심 흐름을 확인하는 기본 모드입니다. Coin Pro는 코인 판독, 관심종목, AI 브리핑, 알림을 더 넓게 돌리는 운영 모드입니다.",
    paid: "Coin Pro 또는 All Market 권한 기준으로 코인 레이더 사용량을 확인합니다. 코인 화면에서 쓰는 기능만 따로 모아 보여드립니다.",
    proHref: "/pro?market=crypto"
  },
  stocks: {
    free: "Free는 글로벌 레이더의 핵심 흐름을 확인하는 기본 모드입니다. Global Pro는 글로벌 종목, 매크로, 뉴스 브리핑, 알림을 더 넓게 돌리는 운영 모드입니다.",
    paid: "Global Pro 또는 All Market 권한 기준으로 글로벌 레이더 사용량을 확인합니다. 글로벌 화면에서 쓰는 기능만 따로 모아 보여드립니다.",
    proHref: "/pro?market=stocks"
  }
};

function bucketMatchesScope(id: UsageBucketId, marketScope: BillingPageScope) {
  if (marketScope === "crypto") {
    return id === "radarScan" || id === "watchlistScan" || id === "aiBriefing" || id === "alertRule";
  }

  if (marketScope === "stocks") {
    return id === "stockRadar" || id === "aiBriefing" || id === "alertRule";
  }

  return true;
}

export function UsageMeterPanel({
  compact = false,
  marketScope = "all"
}: {
  compact?: boolean;
  marketScope?: BillingPageScope;
}) {
  const { profile } = useSupabaseAuth();
  const [snapshot, setSnapshot] = useState<UsageSnapshot>(initialUsageSnapshot);
  const isPaid = hasAnyPaidEntitlement(profile?.plan);
  const entitlementLabel = getEntitlementLabel(profile?.plan);
  const copy = scopedUsageCopy[marketScope];

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
  const scopedStates = summary.states.filter((state) => bucketMatchesScope(state.id, marketScope));
  const visibleStates = compact ? scopedStates.slice(0, 3) : scopedStates;
  const scopedUsedTotal = scopedStates.reduce((sum, state) => sum + state.used, 0);
  const scopedOverCount = scopedStates.filter((state) => state.isOverFree).length;
  const title =
    isPaid
      ? `${entitlementLabel} 권한으로 사용 중입니다.`
      : scopedOverCount > 0
      ? "오늘 무료 기준을 넘긴 항목이 있습니다."
      : scopedUsedTotal > 0
        ? "오늘 레이더 사용량이 쌓이고 있습니다."
        : "오늘 사용할 레이더 한도가 열려 있습니다.";

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
              {isPaid ? copy.paid : copy.free}
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
            href={copy.proHref}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md bg-cyan-300 px-3 text-xs font-black text-slate-950 transition hover:bg-cyan-200"
          >
            <Crown size={13} aria-hidden />
            Pro 보기
          </Link>
        </div>
      </div>

      <div className={`mt-4 grid gap-2 ${compact ? "lg:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-3"}`}>
        {visibleStates.map((state) => (
          <UsageRow key={state.id} state={state} isPaid={isPaid} />
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/10 p-3 text-xs leading-5 text-cyan-100 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-start gap-2">
          <Zap className="mt-0.5 shrink-0" size={14} aria-hidden />
          로그인 계정 기준으로 Pro 한도와 사용량을 확인합니다.
        </span>
        {compact ? (
          <Link href={copy.proHref} className="font-black text-cyan-200 hover:text-white">
            전체 플랜 보기
          </Link>
        ) : null}
      </div>
    </section>
  );
}
