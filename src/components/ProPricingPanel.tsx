"use client";
// Pro 구독 플랜과 결제 시작 버튼을 보여주는 판매 패널입니다.
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  Check,
  Crown,
  Loader2,
  Radar,
  ShieldCheck,
  Sparkles,
  TimerReset
} from "lucide-react";
import { RadarAlertCenter } from "@/components/RadarAlertCenter";
import { UsageMeterPanel } from "@/components/UsageMeterPanel";
import {
  getBillingPlansForPage,
  isYearlyBillingPlan,
  subscriptionTrustNotes,
  type BillingPageScope,
  type BillingPlan,
  type BillingPlanId
} from "@/lib/billing";
import { isNativePurchaseAvailable, purchaseNativePlan, restoreNativeEntitlement } from "@/lib/mobilePurchases";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

type CheckoutState =
  | { status: "idle" }
  | { status: "loading"; planId: BillingPlanId }
  | { status: "restoring" }
  | { status: "message"; tone: "info" | "error"; text: string };

const conversionPoints = [
  {
    icon: Radar,
    title: "오늘 볼 시장을 먼저 좁혀줍니다",
    body: "여러 거래소와 차트를 오가며 확인하던 구조, 변동성, 뉴스 흐름을 한 화면에서 먼저 정리합니다."
  },
  {
    icon: Sparkles,
    title: "근거를 행동 언어로 바꿉니다",
    body: "지금 강한 쪽, 조심해야 할 구간, 다음 확인 조건을 짧게 정리해 매매 전 판단 속도를 높입니다."
  },
  {
    icon: BellRing,
    title: "놓치기 쉬운 변화를 계속 감시합니다",
    body: "관심종목, 뉴스 브리핑, 레이더 알림 조건을 넓혀 장중에 다시 확인해야 할 대상을 줄여줍니다."
  }
];

const valueRows = [
  {
    icon: TimerReset,
    title: "장 시작 전 시장 정리",
    body: "매크로 일정, 시장 온도, 주요 자산 흐름을 먼저 보고 오늘 조심해야 할 구간을 잡습니다."
  },
  {
    icon: ShieldCheck,
    title: "장중 변화 감시",
    body: "TOP 레이더와 관심종목 알림 조건으로 갑자기 좋아지거나 위험해지는 구간을 빠르게 확인합니다."
  },
  {
    icon: Crown,
    title: "마감 전 복기 준비",
    body: "오늘 본 근거와 실제 움직임을 다음 매매에서 반복하거나 피해야 할 기준으로 남길 수 있습니다."
  }
];

const proDifferenceRows = [
  "Basic은 처음 확인용입니다. Pro는 장중에 여러 번 다시 확인하고, 관심종목과 알림까지 이어가는 작업 모드입니다.",
  "Pro는 AI 브리핑, 관심종목, 알림 조건의 한도를 넓혀 직접 찾아보는 시간을 줄이고 중요한 변화를 놓치지 않게 돕습니다.",
  "Chart Radar의 유료 가치는 더 많은 예측 문장이 아니라 시장 구조, 뉴스, 매크로, 위험 요소를 빠르게 종합해 보는 데 있습니다."
];

function getFreeVsProRows(scope: BillingPageScope) {
  if (scope === "crypto") {
    return [
      { label: "레이더 스캔", free: "코인 하루 2회", pro: "코인 하루 200회" },
      { label: "AI 브리핑", free: "코인 하루 1회", pro: "코인 하루 30회" },
      { label: "관심코인", free: "코인 1개 저장", pro: "코인 50개 감시" },
      { label: "알림", free: "코인 조건 1개", pro: "코인 조건 20개" }
    ];
  }

  if (scope === "stocks") {
    return [
      { label: "레이더 스캔", free: "글로벌 하루 1회", pro: "글로벌 하루 100회" },
      { label: "AI 브리핑", free: "글로벌 하루 1회", pro: "글로벌 하루 30회" },
      { label: "관심자산", free: "자산 1개 저장", pro: "자산 50개 감시" },
      { label: "알림", free: "글로벌 조건 1개", pro: "글로벌 조건 20개" }
    ];
  }

  return [
    { label: "레이더 스캔", free: "코인 2회, 글로벌 1회", pro: "코인 200회, 글로벌 100회" },
    { label: "AI 브리핑", free: "시장별 하루 1회", pro: "시장별 하루 30회 이상" },
    { label: "관심종목", free: "시장별 1개 저장", pro: "시장별 50개 이상 감시" },
    { label: "알림", free: "시장별 조건 1개", pro: "시장별 조건 20개 이상" }
  ];
}

const scopeCopy: Record<
  BillingPageScope,
  {
    eyebrow: string;
    title: string;
    body: string;
    representativePrice: string;
    representativeBody: string;
    highlightedPlanId: BillingPlanId;
    freeHref: string;
    filterNotice: string;
    priceAnchor: string;
  }
> = {
  all: {
    eyebrow: "Chart Radar Pro",
    title: "매일 시장을 정리하는 시간을 줄이고, 놓치기 쉬운 변화는 먼저 보여드립니다.",
    body:
      "Basic으로 핵심 흐름을 먼저 확인하고, Pro에서는 코인, 글로벌, AI 브리핑, 관심종목, 알림을 더 넓게 사용합니다. 여러 시장을 직접 돌아다니는 시간을 줄이고 중요한 변화만 빠르게 모아보는 작업 공간입니다.",
    representativePrice: "월 24,900원",
    representativeBody: "코인과 글로벌 시장을 모두 보는 사용자에게 두 시장의 레이더, 뉴스, 브리핑, 알림을 하나로 묶었습니다.",
    highlightedPlanId: "bundle_monthly",
    freeHref: "/survival",
    filterNotice: "전체 요금제를 보고 있습니다. 코인과 글로벌 시장을 모두 보면 All Market Pro가 가장 효율적입니다.",
    priceAnchor: "코인과 글로벌을 따로 결제하는 것보다 월 4,900원을 줄이면서 두 시장을 함께 감시합니다."
  },
  crypto: {
    eyebrow: "Coin Radar Pro",
    title: "코인만 집중해서 본다면 Coin Pro, 전체 시장까지 함께 보려면 All Market Pro가 맞습니다.",
    body:
      "BTC, ETH, 알트코인, 코인 뉴스, 코인 알림을 중심으로 쓰는 사용자라면 Coin Pro로 충분합니다. 글로벌 시장까지 같이 확인한다면 All Market Pro가 더 효율적입니다.",
    representativePrice: "월 14,900원",
    representativeBody: "코인 레이더, ICT 구조, 기술지표, 코인 뉴스, 코인 알림을 코인 시장에 맞춰 엽니다.",
    highlightedPlanId: "crypto_monthly",
    freeHref: "/survival",
    filterNotice: "코인 중심 사용자에게 필요한 요금제만 정리했습니다.",
    priceAnchor: "하루 500원 정도의 비용으로 코인 레이더, 뉴스 브리핑, 관심코인, 알림을 매일 확인하는 구조입니다."
  },
  stocks: {
    eyebrow: "Global Radar Pro",
    title: "미국주식, 해외선물, ETF와 매크로를 집중해서 본다면 Global Pro가 맞습니다.",
    body:
      "미국주식, 해외선물, ETF, 지수, 원자재와 매크로 흐름을 중심으로 쓰는 사용자라면 Global Pro로 충분합니다. 코인까지 함께 확인한다면 All Market Pro가 더 효율적입니다.",
    representativePrice: "월 14,900원",
    representativeBody: "글로벌 레이더, 해외선물, 기술지표, 글로벌 뉴스, 매크로 브리핑, 관심자산 알림을 한 화면으로 엽니다.",
    highlightedPlanId: "stocks_monthly",
    freeHref: "/global",
    filterNotice: "글로벌 시장 중심 사용자에게 필요한 요금제만 정리했습니다.",
    priceAnchor: "하루 500원 정도의 비용으로 미국주식, 해외선물, ETF, 매크로 이벤트를 한 화면에서 점검합니다."
  }
};

function getScopedDisplayPlan(plan: BillingPlan, scope: BillingPageScope): BillingPlan {
  if (plan.id !== "free") return plan;

  if (scope === "stocks") {
    return {
      ...plan,
      description: "글로벌 레이더의 핵심 흐름을 먼저 확인합니다. 반복 감시와 알림은 Pro에서 넓어집니다.",
      highlights: ["QQQ / SPY 핵심 레이더 확인", "주요 글로벌 뉴스 확인", "AI 브리핑 하루 1회"],
      limits: {
        ...plan.limits,
        radarScans: "하루 1회",
        watchlist: "글로벌 자산 1개",
        alerts: "알림 조건 1개",
        markets: "글로벌 핵심 확인"
      }
    };
  }

  if (scope === "crypto") {
    return {
      ...plan,
      description: "코인 레이더의 핵심 흐름을 먼저 확인합니다. 반복 감시와 알림은 Pro에서 넓어집니다.",
      highlights: ["BTC / ETH 핵심 레이더 확인", "주요 알트코인 흐름 확인", "AI 브리핑 하루 1회"],
      limits: {
        ...plan.limits,
        radarScans: "하루 2회",
        watchlist: "코인 1개",
        alerts: "알림 조건 1개",
        markets: "코인 핵심 확인"
      }
    };
  }

  return plan;
}

export function ProPricingPanel({ marketScope = "all" }: { marketScope?: BillingPageScope } = {}) {
  const [checkoutState, setCheckoutState] = useState<CheckoutState>({ status: "idle" });
  const { session, user, isLoading: isAuthLoading } = useSupabaseAuth();
  const visiblePlans = getBillingPlansForPage(marketScope);
  const copy = scopeCopy[marketScope];
  const nativePurchaseAvailable = isNativePurchaseAvailable();
  const freeVsProRows = getFreeVsProRows(marketScope);

  async function startCheckout(plan: BillingPlan) {
    if (isAuthLoading) {
      setCheckoutState({
        status: "message",
        tone: "info",
        text: "계정 상태를 확인하는 중입니다. 잠시 후 다시 눌러 주세요."
      });
      return;
    }

    if (!session?.accessToken) {
      setCheckoutState({
        status: "message",
        tone: "info",
        text: "결제 후 Pro 기능을 바로 이용하려면 먼저 구글 로그인이 필요합니다. 로그인한 뒤 다시 결제를 시작해 주세요."
      });
      return;
    }

    setCheckoutState({ status: "loading", planId: plan.id });

    try {
      if (nativePurchaseAvailable) {
        if (!user?.id) throw new Error("앱 구독을 연결하려면 로그인 정보를 먼저 확인해야 합니다.");
        const result = await purchaseNativePlan({
          plan,
          userId: user.id,
          accessToken: session.accessToken
        });
        setCheckoutState({ status: "message", tone: "info", text: result.message });
        return;
      }

      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ planId: plan.id, platform: "web" })
      });
      const data = (await response.json().catch(() => ({}))) as {
        paymentUrl?: string;
        message?: string;
        error?: string;
      };

      if (!response.ok) throw new Error(data.error ?? "결제창을 바로 열지 못했습니다. 잠시 후 다시 시도해 주세요.");
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }

      setCheckoutState({
        status: "message",
        tone: "info",
        text: data.message ?? "현재 결제창을 준비하는 중입니다. 잠시 후 다시 시도해 주세요."
      });
    } catch (error) {
      setCheckoutState({
        status: "message",
        tone: "error",
        text: error instanceof Error ? error.message : "결제 연결 상태를 확인하지 못했습니다."
      });
    }
  }

  async function restoreCheckout() {
    if (!nativePurchaseAvailable) return;

    if (isAuthLoading) {
      setCheckoutState({
        status: "message",
        tone: "info",
        text: "계정 상태를 확인하는 중입니다. 잠시 후 다시 눌러 주세요."
      });
      return;
    }

    if (!session?.accessToken || !user?.id) {
      setCheckoutState({
        status: "message",
        tone: "info",
        text: "구매 복원을 하려면 먼저 구글 로그인이 필요합니다."
      });
      return;
    }

    setCheckoutState({ status: "restoring" });

    try {
      const result = await restoreNativeEntitlement({
        userId: user.id,
        accessToken: session.accessToken
      });
      setCheckoutState({ status: "message", tone: "info", text: result.message });
    } catch (error) {
      setCheckoutState({
        status: "message",
        tone: "error",
        text: error instanceof Error ? error.message : "구매 복원 상태를 확인하지 못했습니다."
      });
    }
  }

  return (
    <section className="space-y-5">
      <div className="force-dark-card overflow-hidden rounded-lg border border-cyan-300/20 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.18),transparent_34%),linear-gradient(135deg,rgba(2,6,23,0.96),rgba(15,23,42,0.92))] p-5 shadow-glow">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-black text-cyan-200">
              {copy.eyebrow}
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-normal text-white sm:text-4xl">{copy.title}</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">{copy.body}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/25 p-4 text-sm text-slate-300 lg:w-72">
            <p className="font-black text-white">대표 플랜</p>
            <p className="mt-2 whitespace-nowrap text-2xl font-black text-cyan-200 sm:text-3xl">{copy.representativePrice}</p>
            <p className="mt-2 leading-6 text-slate-400">{copy.representativeBody}</p>
            <Link
              href="#plans"
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
            >
              플랜 보기
              <ArrowRight size={15} aria-hidden />
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          {conversionPoints.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <Icon className="text-cyan-300" size={20} aria-hidden />
              <p className="mt-3 font-black text-white">{title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-cyan-300/25 bg-surface-card p-4 text-sm leading-6 text-slate-300">
          <p className="font-black text-white">{copy.filterNotice}</p>
          <p className="mt-2 text-slate-400">{copy.priceAnchor}</p>
        </div>
        <div className="rounded-lg border border-surface-line bg-surface-card p-4 text-sm leading-6 text-slate-300">
          <p className="font-black text-white">Basic과 Pro의 차이</p>
          <p className="mt-2 text-slate-400">
            Basic은 처음 확인용입니다. Pro는 장중 반복 확인, 관심종목 감시, 알림 조건까지 이어지는 작업 공간입니다.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-surface-line bg-surface-card">
        <div className="border-b border-white/10 p-4">
          <p className="text-xs font-black tracking-[0.2em] text-cyan-300">BASIC VS PRO</p>
          <h3 className="mt-1 text-xl font-black text-white">Pro에서 실제로 넓어지는 범위입니다.</h3>
        </div>
        <div className="grid divide-y divide-white/10 md:grid-cols-4 md:divide-x md:divide-y-0">
          {freeVsProRows.map((row) => (
            <div key={row.label} className="p-4">
              <p className="text-sm font-black text-white">{row.label}</p>
              <p className="mt-3 text-xs font-bold text-slate-500">Basic</p>
              <p className="mt-1 text-sm text-slate-300">{row.free}</p>
              <p className="mt-3 text-xs font-bold text-cyan-300">Pro</p>
              <p className="mt-1 text-sm font-black text-cyan-100">{row.pro}</p>
            </div>
          ))}
        </div>
      </div>

      <UsageMeterPanel marketScope={marketScope} />

      <div id="plans" className="grid gap-4 lg:grid-cols-3">
        {visiblePlans.map((rawPlan) => {
          const plan = getScopedDisplayPlan(rawPlan, marketScope);
          const isFree = plan.id === "free";
          const isHighlighted = plan.id === copy.highlightedPlanId;
          const isYearly = isYearlyBillingPlan(plan.id);
          const isLoading = checkoutState.status === "loading" && checkoutState.planId === plan.id;

          return (
            <article
              key={plan.id}
              className={`relative rounded-lg border p-5 ${
                isHighlighted ? "border-cyan-300 bg-cyan-300/10 shadow-glow" : "border-surface-line bg-surface-card"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-black ${isHighlighted ? "bg-cyan-300 text-slate-950" : "bg-white/10 text-slate-300"}`}>
                  {plan.badge}
                </span>
                {isYearly ? <span className="text-xs font-black text-amber-300">연간 할인</span> : null}
              </div>
              <h3 className="mt-4 text-xl font-black text-white">{plan.name}</h3>
              <p className="mt-2 text-3xl font-black text-white">{plan.priceLabel}</p>
              {plan.monthlyValue > 0 ? (
                <p className="mt-1 text-xs font-bold text-slate-500">월 환산 약 {plan.monthlyValue.toLocaleString("ko-KR")}원</p>
              ) : null}
              <p className="mt-4 min-h-16 text-sm leading-6 text-slate-400">{plan.description}</p>

              <div className="mt-4 space-y-2">
                {plan.highlights.map((item) => (
                  <p key={item} className="flex gap-2 text-sm text-slate-300">
                    <Check className="mt-0.5 shrink-0 text-cyan-300" size={15} aria-hidden />
                    <span>{item}</span>
                  </p>
                ))}
              </div>

              <div className="mt-5 rounded-md border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-400">
                <p>레이더 {plan.limits.radarScans}</p>
                <p>AI 브리핑 {plan.limits.aiBriefings}</p>
                <p>관심종목 {plan.limits.watchlist}</p>
                <p>알림 {plan.limits.alerts}</p>
              </div>

              {isFree ? (
                <Link
                  href={copy.freeHref}
                  className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-white/15 px-4 text-sm font-black text-white transition hover:bg-white/10"
                >
                  핵심 레이더 보기
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => startCheckout(plan)}
                  disabled={checkoutState.status === "loading" || isAuthLoading}
                  className={`mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-black transition ${
                    isHighlighted ? "bg-cyan-300 text-slate-950 hover:bg-cyan-200" : "bg-white text-slate-950 hover:bg-slate-200"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {isLoading ? <Loader2 className="animate-spin" size={16} aria-hidden /> : <Crown size={16} aria-hidden />}
                  {nativePurchaseAvailable ? "앱 구독으로 시작하기" : isYearly ? "연간으로 시작하기" : "월간으로 시작하기"}
                </button>
              )}
            </article>
          );
        })}
      </div>

      {nativePurchaseAvailable ? (
        <div className="rounded-lg border border-surface-line bg-surface-card p-4 text-center">
          <button
            type="button"
            onClick={restoreCheckout}
            disabled={checkoutState.status === "restoring" || isAuthLoading}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/15 px-4 text-sm font-black text-white transition hover:bg-white/10 disabled:opacity-60"
          >
            {checkoutState.status === "restoring" ? <Loader2 className="animate-spin" size={16} aria-hidden /> : null}
            구매 복원하기
          </button>
        </div>
      ) : null}

      {checkoutState.status === "message" ? (
        <div
          className={`rounded-lg border p-4 text-sm leading-6 ${
            checkoutState.tone === "error"
              ? "border-rose-400/30 bg-rose-500/10 text-rose-100"
              : "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
          }`}
        >
          {checkoutState.text}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-surface-line bg-surface-card p-5">
          <p className="text-xs font-black tracking-[0.2em] text-cyan-300">WHY PAY</p>
          <h3 className="mt-2 text-xl font-black text-white">유료 상품의 핵심은 더 긴 글이 아니라 더 넓은 감시 범위입니다.</h3>
          <div className="mt-4 space-y-3">
            {proDifferenceRows.map((row) => (
              <p key={row} className="text-sm leading-6 text-slate-400">
                {row}
              </p>
            ))}
          </div>
        </div>
        <div className="grid gap-3">
          {valueRows.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-lg border border-surface-line bg-surface-card p-4">
              <div className="flex gap-3">
                <Icon className="mt-1 shrink-0 text-cyan-300" size={20} aria-hidden />
                <div>
                  <p className="font-black text-white">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <RadarAlertCenter market={marketScope === "stocks" ? "stocks" : "crypto"} />

      <div className="rounded-lg border border-surface-line bg-surface-card p-5">
        <p className="text-xs font-black tracking-[0.2em] text-cyan-300">안심 기준</p>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {subscriptionTrustNotes.map((note) => (
            <p key={note} className="rounded-md border border-white/10 bg-black/20 p-3 text-sm leading-6 text-slate-400">
              {note}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
