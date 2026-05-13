"use client";
// Pro 구독 플랜과 결제 시작 버튼을 보여주는 판매 패널입니다.
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BellRing, Check, Crown, Loader2, Radar, ShieldCheck, Sparkles, TimerReset } from "lucide-react";
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
    title: "오늘 볼 자산부터 압축",
    body: "상승률만 보는 화면이 아니라 거래대금, 구조, 변동성, 뉴스 영향을 합쳐 먼저 볼 대상을 줄여줍니다."
  },
  {
    icon: Sparkles,
    title: "근거를 실행 언어로 정리",
    body: "차트와 뉴스가 따로 놀지 않게 지금 우세한 방향, 위험 요인, 다음 확인 조건을 한 번에 정리합니다."
  },
  {
    icon: BellRing,
    title: "켜두면 대신 감시",
    body: "관심종목 구조 변화, 큰 변동, 브리핑 업데이트를 직접 새로고침하지 않아도 확인하게 돕습니다."
  }
];

const valueRows = [
  {
    icon: TimerReset,
    title: "아침에는 큰 흐름",
    body: "매크로 일정, 시장 온도, 주요 자산 흐름을 먼저 보고 오늘 조심해야 할 구간을 정리합니다."
  },
  {
    icon: ShieldCheck,
    title: "장중에는 변화 감시",
    body: "TOP 레이더, 관심종목, 알림 조건으로 지금 움직이는 자산과 변동성 확대 구간을 빠르게 확인합니다."
  },
  {
    icon: Crown,
    title: "마감 전에는 복기",
    body: "오늘 본 근거와 실제 움직임을 복기해 다음 매매에서 반복할 것과 피할 것을 남깁니다."
  }
];

const proDifferenceRows = [
  "무료는 하루 확인용입니다. Pro는 장중에 반복해서 레이더를 돌리고 변화가 생긴 자산을 계속 확인하는 용도입니다.",
  "Pro는 AI 브리핑, 관심종목, 알림 규칙의 한도를 넓혀 직접 찾아보는 시간을 줄이는 구독입니다.",
  "매수·매도 신호를 단정하지 않고 시장 구조, 뉴스, 매크로, 위험도를 함께 정리하는 분석형 작업 공간입니다."
];

function getFreeVsProRows(scope: BillingPageScope) {
  if (scope === "crypto") {
    return [
      { label: "레이더 스캔", free: "코인 하루 3회", pro: "코인 하루 200회" },
      { label: "AI 브리핑", free: "코인 하루 1회", pro: "코인 하루 30회" },
      { label: "관심코인", free: "코인 2개 저장", pro: "코인 50개 감시" },
      { label: "알림", free: "코인 조건 1개", pro: "코인 조건 20개" }
    ];
  }

  if (scope === "stocks") {
    return [
      { label: "레이더 스캔", free: "글로벌 하루 2회", pro: "글로벌 하루 100회" },
      { label: "AI 브리핑", free: "글로벌 하루 1회", pro: "글로벌 하루 30회" },
      { label: "관심자산", free: "자산 2개 저장", pro: "자산 50개 감시" },
      { label: "알림", free: "글로벌 조건 1개", pro: "글로벌 조건 20개" }
    ];
  }

  return [
    { label: "레이더 스캔", free: "코인 3회 · 글로벌 2회", pro: "코인 200회 · 글로벌 100회" },
    { label: "AI 브리핑", free: "시장별 하루 1회", pro: "시장별 하루 30회" },
    { label: "관심종목", free: "시장별 2개 저장", pro: "시장별 50개 이상 감시" },
    { label: "알림", free: "시장별 조건 1개", pro: "시장별 조건 20개" }
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
    title: "매일 시장을 확인하는 시간을 줄이고, 놓칠 만한 변화는 먼저 띄워드립니다.",
    body:
      "무료로 핵심 흐름을 먼저 확인하고, Pro에서는 전체 코인 레이더, 글로벌 레이더, AI 브리핑, 관심종목 알림과 저장 기능을 더 넓게 사용합니다. 신호를 판매하는 서비스가 아니라 매일 시장을 빠르게 정리하는 레이더입니다.",
    representativePrice: "월 24,900원",
    representativeBody: "두 시장을 모두 보는 사용자에게 코인, 글로벌 시장, AI 브리핑, 관심종목 알림을 하나로 묶었습니다.",
    highlightedPlanId: "bundle_monthly",
    freeHref: "/survival",
    filterNotice: "전체 요금제를 보고 있습니다. 코인과 글로벌 시장을 모두 보면 All Market 플랜이 유리합니다.",
    priceAnchor: "코인과 글로벌을 따로 결제하는 것보다 월 4,900원을 줄이면서 두 시장을 함께 감시합니다."
  },
  crypto: {
    eyebrow: "Coin Radar Pro",
    title: "코인 화면에서는 코인 전용 플랜과 All Market 플랜만 보여드립니다.",
    body:
      "BTC·ETH, 알트코인, 코인뉴스, 코인알림을 중심으로 쓰는 사용자라면 Coin Pro로 충분합니다. 글로벌 시장까지 함께 볼 예정이면 All Market 플랜을 선택하면 됩니다.",
    representativePrice: "월 14,900원",
    representativeBody: "코인 레이더, ICT 판독, 기술지표, 코인뉴스, 코인알림을 코인 시장에 맞춰 씁니다.",
    highlightedPlanId: "crypto_monthly",
    freeHref: "/survival",
    filterNotice: "코인 전용 화면입니다. 글로벌 전용 플랜은 숨기고 All Market 플랜만 함께 보여드립니다.",
    priceAnchor: "하루 500원대 비용으로 코인 레이더, 뉴스 브리핑, 관심종목 알림을 매일 확인하는 구조입니다."
  },
  stocks: {
    eyebrow: "Global Radar Pro",
    title: "글로벌 화면에서는 글로벌 전용 플랜과 All Market 플랜만 보여드립니다.",
    body:
      "미국주식, ETF, 지수, 자산군과 매크로 흐름을 중심으로 쓰는 사용자라면 Global Pro로 충분합니다. 코인까지 함께 볼 예정이면 All Market 플랜을 선택하면 됩니다.",
    representativePrice: "월 14,900원",
    representativeBody: "글로벌 레이더, 기술지표, 글로벌뉴스, 매크로 브리핑, 관심 자산 알림을 한 화면으로 씁니다.",
    highlightedPlanId: "stocks_monthly",
    freeHref: "/global",
    filterNotice: "글로벌 전용 화면입니다. 코인 전용 플랜은 숨기고 All Market 플랜만 함께 보여드립니다.",
    priceAnchor: "하루 500원대 비용으로 미국장, ETF, 지수, 매크로 이벤트를 한 화면에서 점검합니다."
  }
};

function getScopedDisplayPlan(plan: BillingPlan, scope: BillingPageScope): BillingPlan {
  if (plan.id !== "free") return plan;

  if (scope === "stocks") {
    return {
      ...plan,
      description: "글로벌 레이더의 핵심 흐름을 확인해 보는 체험 플랜입니다. 반복 감시와 알림은 Pro에서 열립니다.",
      highlights: ["QQQ / SPY 기본 레이더 맛보기", "글로벌 뉴스 제한 확인", "AI 브리핑 하루 1회 미리보기"],
      limits: {
        ...plan.limits,
        radarScans: "일 2회",
        watchlist: "글로벌 종목 2개",
        alerts: "알림 저장 제한",
        markets: "글로벌 맛보기"
      }
    };
  }

  if (scope === "crypto") {
    return {
      ...plan,
      description: "코인 레이더의 핵심 흐름을 확인해 보는 체험 플랜입니다. 반복 감시와 알림은 Pro에서 열립니다.",
      highlights: ["BTC / ETH 기본 레이더 맛보기", "주요 알트코인 제한 감시", "AI 브리핑 하루 1회 미리보기"],
      limits: {
        ...plan.limits,
        radarScans: "일 3회",
        watchlist: "코인 2개",
        alerts: "알림 저장 제한",
        markets: "코인 맛보기"
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
    const planId = plan.id;
    if (isAuthLoading) {
      setCheckoutState({
        status: "message",
        tone: "info",
        text: "로그인 상태를 확인하고 있습니다. 잠시 후 다시 눌러 주세요."
      });
      return;
    }

    if (!session?.accessToken) {
      setCheckoutState({
        status: "message",
        tone: "info",
        text: "결제 후 Pro 권한을 바로 열려면 먼저 구글 로그인이 필요합니다. 로그인 후 다시 결제를 시작해 주세요."
      });
      return;
    }

    setCheckoutState({ status: "loading", planId });

    try {
      if (nativePurchaseAvailable) {
        if (!user?.id) throw new Error("앱 구독을 연결하려면 로그인 사용자 정보를 먼저 확인해야 합니다.");
        const result = await purchaseNativePlan({
          plan,
          userId: user.id,
          accessToken: session.accessToken
        });
        setCheckoutState({
          status: "message",
          tone: "info",
          text: result.message
        });
        return;
      }

      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ planId, platform: "web" })
      });
      const data = (await response.json().catch(() => ({}))) as {
        paymentUrl?: string;
        message?: string;
        error?: string;
      };

      if (!response.ok) throw new Error(data.error ?? "결제 연결 중 오류가 발생했습니다.");
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }

      setCheckoutState({
        status: "message",
        tone: "info",
        text: data.message ?? "현재 결제창을 여는 중입니다. 잠시 후 다시 시도해 주세요."
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
        text: "로그인 상태를 확인하고 있습니다. 잠시 후 다시 눌러 주세요."
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
      setCheckoutState({
        status: "message",
        tone: "info",
        text: result.message
      });
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
            <h2 className="mt-4 text-3xl font-black tracking-normal text-white sm:text-4xl">
              {copy.title}
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              {copy.body}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/25 p-4 text-sm text-slate-300 lg:w-72">
            <p className="font-black text-white">대표 플랜</p>
            <p className="mt-2 text-3xl font-black text-cyan-200">{copy.representativePrice}</p>
            <p className="mt-2 leading-6 text-slate-400">
              {copy.representativeBody}
            </p>
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
        <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-6 text-cyan-100">
          <p className="font-black text-cyan-50">{copy.filterNotice}</p>
          <p className="mt-2 text-cyan-100/85">{copy.priceAnchor}</p>
        </div>
        <div className="rounded-lg border border-surface-line bg-surface-card p-4 text-sm leading-6 text-slate-300">
          <p className="font-black text-white">무료와 Pro의 차이</p>
          <p className="mt-2 text-slate-400">
            무료는 핵심 확인, Pro는 반복 감시와 저장을 위한 작업 공간입니다.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-surface-line bg-surface-card">
        <div className="border-b border-white/10 p-4">
          <p className="text-lg font-black text-white">무료는 확인용, Pro는 매일 쓰는 레이더입니다.</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            무료에서도 방향은 볼 수 있게 열어두되, 반복 확인과 감시 자동화는 Pro에서 차이가 나도록 설계했습니다.
          </p>
        </div>
        <div className="grid divide-y divide-white/10 text-sm md:grid-cols-4 md:divide-x md:divide-y-0">
          {freeVsProRows.map((row) => (
            <div key={row.label} className="p-4">
              <p className="font-black text-cyan-200">{row.label}</p>
              <div className="mt-3 space-y-2">
                <p className="rounded-md border border-white/10 bg-black/20 p-2 text-slate-400">
                  Free · {row.free}
                </p>
                <p className="rounded-md border border-cyan-300/25 bg-cyan-300/10 p-2 font-bold text-cyan-100">
                  Pro · {row.pro}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {valueRows.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-lg border border-surface-line bg-surface-card p-4">
            <Icon className="text-cyan-300" size={20} aria-hidden />
            <p className="mt-3 font-black text-white">{title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-surface-line bg-surface-card p-4">
        <p className="font-black text-white">Pro가 필요한 순간</p>
        <div className="mt-3 grid gap-2 lg:grid-cols-3">
          {proDifferenceRows.map((item) => (
            <p key={item} className="rounded-md border border-white/10 bg-black/20 p-3 text-sm leading-6 text-slate-300">
              {item}
            </p>
          ))}
        </div>
      </div>

      {nativePurchaseAvailable ? (
        <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-6 text-cyan-100">
          <p className="font-black text-cyan-50">앱 구독 복원</p>
          <p className="mt-2 text-cyan-100/85">
            이미 Google Play에서 구독하셨다면 새 기기나 재설치 후에도 구매 복원으로 Pro 권한을 다시 연결할 수 있습니다.
          </p>
          <button
            type="button"
            onClick={restoreCheckout}
            disabled={checkoutState.status === "loading" || checkoutState.status === "restoring" || isAuthLoading}
            className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-cyan-300/35 bg-black/20 px-4 text-sm font-black text-cyan-100 transition hover:bg-cyan-300 hover:text-slate-950 disabled:cursor-wait disabled:opacity-70"
          >
            {checkoutState.status === "restoring" ? <Loader2 className="animate-spin" size={16} aria-hidden /> : null}
            {checkoutState.status === "restoring" ? "구매 복원 확인 중" : "구매 복원하기"}
          </button>
        </div>
      ) : null}

      <div id="plans" className="grid scroll-mt-28 gap-4 lg:grid-cols-3">
        {visiblePlans.map((plan) => {
          const displayPlan = getScopedDisplayPlan(plan, marketScope);
          const highlighted = plan.id === copy.highlightedPlanId;
          const isYearly = isYearlyBillingPlan(plan.id);
          const isLoading = checkoutState.status === "loading" && checkoutState.planId === plan.id;

          return (
            <article
              key={plan.id}
              className={`rounded-lg border p-5 ${
                highlighted
                  ? "border-cyan-300/40 bg-cyan-300/10 shadow-[0_0_35px_rgba(34,211,238,0.16)]"
                  : "border-surface-line bg-surface-card"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-xs font-black text-slate-300">
                    {plan.badge}
                  </span>
                  <h3 className="mt-4 text-xl font-black text-white">{displayPlan.name}</h3>
                </div>
                {highlighted ? <Crown className="text-cyan-300" size={22} aria-hidden /> : null}
              </div>
              <p className="mt-4 text-3xl font-black text-white">{displayPlan.priceLabel}</p>
              {isYearly && plan.id !== "free" ? (
                <p className="mt-1 text-xs font-bold text-cyan-200">월 환산 약 {plan.monthlyValue.toLocaleString("ko-KR")}원</p>
              ) : null}
              <p className="mt-4 min-h-16 text-sm leading-6 text-slate-400">{displayPlan.description}</p>

              <div className="mt-5 space-y-2">
                {displayPlan.highlights.map((item) => (
                  <p key={item} className="flex items-start gap-2 text-sm text-slate-200">
                    <Check className="mt-0.5 shrink-0 text-cyan-300" size={15} aria-hidden />
                    {item}
                  </p>
                ))}
              </div>

              <div className="mt-5 grid gap-2 rounded-md border border-white/10 bg-black/20 p-3 text-xs text-slate-400">
                <p>레이더: <span className="font-bold text-slate-200">{displayPlan.limits.radarScans}</span></p>
                <p>AI 브리핑: <span className="font-bold text-slate-200">{displayPlan.limits.aiBriefings}</span></p>
                <p>관심종목: <span className="font-bold text-slate-200">{displayPlan.limits.watchlist}</span></p>
                <p>알림: <span className="font-bold text-slate-200">{displayPlan.limits.alerts}</span></p>
              </div>

              {plan.id === "free" ? (
                <Link
                  href={copy.freeHref}
                  className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-white/10 bg-white/5 px-4 text-sm font-black text-white transition hover:bg-white/10"
                >
                  무료로 먼저 보기
                </Link>
              ) : (
                <button
          type="button"
          onClick={() => startCheckout(plan)}
          disabled={checkoutState.status === "loading" || isAuthLoading}
                  className={`mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-black transition ${
                    highlighted
                      ? "bg-cyan-300 text-slate-950 hover:bg-cyan-200"
                      : "border border-cyan-300/30 bg-cyan-300/10 text-cyan-200 hover:bg-cyan-300 hover:text-slate-950"
                  } disabled:cursor-wait disabled:opacity-70`}
                >
                  {isLoading ? <Loader2 className="animate-spin" size={16} aria-hidden /> : null}
          {isAuthLoading ? "로그인 확인 중" : isLoading ? "결제 상태 확인 중" : nativePurchaseAvailable ? "앱 구독으로 시작하기" : isYearly ? "연간으로 시작하기" : "월간으로 시작하기"}
                </button>
              )}
            </article>
          );
        })}
      </div>

      <UsageMeterPanel marketScope={marketScope} />

      <RadarAlertCenter market={marketScope === "stocks" ? "stocks" : "crypto"} />

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

      <div className="rounded-lg border border-surface-line bg-surface-card p-4">
        <p className="font-black text-white">구독 전 확인해 주세요.</p>
        <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-400">
          {subscriptionTrustNotes.map((item) => (
            <p key={item} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
              {item}
            </p>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
          <Link href="/terms" className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-slate-300">
            이용약관
          </Link>
          <Link href="/privacy" className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-slate-300">
            개인정보 처리방침
          </Link>
        </div>
      </div>
    </section>
  );
}
