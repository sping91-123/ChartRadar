"use client";
// Basic과 Pro의 일일 사용량 차이를 보여주는 패널입니다.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Crown, Gauge, Zap } from "lucide-react";
import {
  getUsageBucketStates,
  readUsageSnapshot,
  summarizeUsage,
  USAGE_CHANGED_EVENT,
  type UsageBucketId,
  type UsageSnapshot
} from "@/lib/usageMeter";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { getEntitlementLabel, hasScopedEntitlement, type BillingPageScope } from "@/lib/billing";

function barColor(percent: number, isOverFree: boolean) {
  if (isOverFree) return "bg-rose-400";
  if (percent >= 80) return "bg-amber-300";
  return "bg-cyan-300";
}

function UsageRow({ state, isPaid }: { state: ReturnType<typeof getUsageBucketStates>[number]; isPaid: boolean }) {
  const activeLimit = Math.max(1, isPaid ? state.proDailyLimit : state.freeDailyLimit);
  const displayedUsed = Math.min(state.used, activeLimit);
  const activeRemaining = Math.max(0, activeLimit - state.used);
  const activePercent = Math.min(100, Math.round((state.used / activeLimit) * 100));
  const isOverActiveLimit = state.used >= activeLimit;
  const limitCopy = isPaid
    ? `오늘 ${state.proDailyLimit}회까지 같은 항목을 다시 확인할 수 있습니다.`
    : `첫 확인 ${state.freeDailyLimit}회 이후에는 Pro에서 장중 재확인이 열립니다.`;

  return (
    <div className="rounded-xl border border-surface-line bg-surface-cardSoft p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-white">{state.label}</p>
          <p className="mt-1 line-clamp-1 text-[11px] text-slate-500">{state.description}</p>
        </div>
        <span
          className={`shrink-0 rounded border px-2 py-1 text-[11px] font-black ${
            isOverActiveLimit
              ? "border-rose-400/30 bg-rose-500/10 text-rose-300"
              : "border-accent-blue/30 bg-accent-blue/10 text-accent-blue"
          }`}
        >
          {displayedUsed}/{activeLimit}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${barColor(activePercent, isOverActiveLimit)}`} style={{ width: `${activePercent}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-slate-500">
        <span>오늘 남음 {activeRemaining}회</span>
        <span className="text-right">{limitCopy}</span>
      </div>
    </div>
  );
}

const initialUsageSnapshot: UsageSnapshot = { dateKey: "", counts: {} };

const scopedUsageCopy: Record<BillingPageScope, { free: string; paid: string; proHref: string }> = {
  all: {
    free: "Basic에서는 오늘 시장의 큰 흐름을 먼저 확인합니다. 장중에 다시 돌려보고, 관심종목을 쌓고, 변화 알림까지 받으려면 Pro가 필요합니다.",
    paid: "Pro 실전 감시 모드가 열려 있습니다. 코인, 글로벌, AI 브리핑, 관심종목, 알림을 장중에도 끊기지 않게 이어갈 수 있습니다.",
    proHref: "/pro"
  },
  crypto: {
    free: "Basic에서는 코인 시장의 큰 흐름을 먼저 확인합니다. 장중 후보 재확인, 관심코인 누적, 코인 알림까지 챙기려면 Coin Pro가 필요합니다.",
    paid: "Coin Pro 실전 감시 모드가 열려 있습니다. 코인 스캔, 관심코인, AI 브리핑, 알림을 장중에도 끊기지 않게 이어갈 수 있습니다.",
    proHref: "/pro?market=crypto"
  },
  stocks: {
    free: "Basic에서는 글로벌 시장의 큰 흐름을 먼저 확인합니다. 장중 미국주식, 해외선물, ETF, 매크로 브리핑과 알림을 반복 확인하려면 Global Pro가 필요합니다.",
    paid: "Global Pro 실전 감시 모드가 열려 있습니다. 미국주식, 해외선물, ETF, 매크로 브리핑과 알림을 장중에도 끊기지 않게 이어갈 수 있습니다.",
    proHref: "/pro?market=stocks"
  }
};

function bucketMatchesScope(id: UsageBucketId, marketScope: BillingPageScope) {
  if (marketScope === "crypto") {
    return id === "radarScan" || id === "altIndividualAnalysis" || id === "watchlistScan" || id === "cryptoAiBriefing" || id === "cryptoAlertRule";
  }

  if (marketScope === "stocks") {
    return id === "stockRadar" || id === "stocksAiBriefing" || id === "stocksAlertRule";
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
  const isPaid = hasScopedEntitlement(profile?.plan, marketScope);
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
      ? `${entitlementLabel} 실전 감시 모드입니다.`
      : scopedOverCount > 0
        ? "오늘 Basic 한도를 모두 사용했습니다."
        : scopedUsedTotal > 0
          ? "오늘 레이더를 사용하고 있습니다."
          : "오늘 레이더를 아직 쓰지 않았습니다.";

  return (
    <section className="enterprise-panel p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-accent-blue/25 bg-accent-blue/10 text-accent-blue">
            <Gauge size={20} aria-hidden />
          </div>
          <div>
            <p className="text-xs font-black tracking-[0.2em] text-accent-blue">오늘 이용 현황</p>
            <h2 className="mt-1 text-lg font-black text-white">{title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 [word-break:keep-all]">
              {isPaid ? copy.paid : copy.free}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href={copy.proHref}
            className="enterprise-button inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-black"
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

      <div className="mt-4 flex flex-col gap-2 rounded-xl border border-accent-blue/20 bg-accent-blue/10 p-3 text-xs leading-5 text-accent-blue sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-start gap-2">
          <Zap className="mt-0.5 shrink-0" size={14} aria-hidden />
          Basic은 첫 확인용이고, Pro는 장중 재확인과 알림까지 이어지는 실전 감시 모드입니다.
        </span>
          {compact ? (
          <Link href={copy.proHref} className="font-black text-accent-blue hover:text-white">
            Pro 플랜 보기
          </Link>
        ) : null}
      </div>
    </section>
  );
}
