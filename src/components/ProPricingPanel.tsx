"use client";
// Pro 구독 플랜과 결제 시작 흐름을 보여주는 판매 패널이다.
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
  type BillingPlanId
} from "@/lib/billing";

type CheckoutState =
  | { status: "idle" }
  | { status: "loading"; planId: BillingPlanId }
  | { status: "message"; tone: "info" | "error"; text: string };

const conversionPoints = [
  {
    icon: Radar,
    title: "시장 먼저 훑기",
    body: "선택한 시장에서 오늘 먼저 봐야 할 자산, 방향 쏠림, 위험 구간을 압축합니다."
  },
  {
    icon: Sparkles,
    title: "AI 해석 넉넉하게",
    body: "뉴스, 레이더 결과, 관심종목 흐름을 긴 문장으로 다시 정리해 줍니다."
  },
  {
    icon: BellRing,
    title: "놓치지 않는 알림",
    body: "관심종목 구조 변화, 큰 변동, 뉴스 브리핑을 매번 직접 찾지 않도록 도와줍니다."
  }
];

const valueRows = [
  {
    icon: TimerReset,
    title: "하루 3번 켜는 구조",
    body: "아침에는 시장 온도, 장중에는 TOP 감지, 자기 전에는 관심종목과 뉴스 브리핑을 확인하는 흐름을 만듭니다."
  },
  {
    icon: ShieldCheck,
    title: "타점 강요 대신 위험 정리",
    body: "롱·숏을 단정하기보다 어느 쪽 근거가 강한지, 무엇을 확인해야 하는지 먼저 보여줍니다."
  },
  {
    icon: Crown,
    title: "Pro는 편의성과 빈도",
    body: "더 많은 종목, 더 많은 AI 브리핑, 더 많은 알림 규칙으로 반복 사용의 마찰을 줄입니다."
  }
];

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
  }
> = {
  all: {
    eyebrow: "Chart Radar Pro",
    title: "매일 시장을 확인하는 시간을 줄이고, 놓칠 만한 변화는 먼저 띄워드립니다.",
    body:
      "무료로 핵심 흐름을 먼저 확인하고, Pro에서는 전체 코인 레이더, 글로벌 레이더, AI 브리핑, 관심종목 알림과 저장 기능을 더 넓게 사용합니다. 신호를 판매하는 서비스가 아니라, 매일 시장을 빠르게 정리하는 레이더입니다.",
    representativePrice: "월 24,900원",
    representativeBody: "자주 켜는 사용자에게 필요한 코인, 글로벌 시장, AI 브리핑, 관심종목 알림을 하나로 묶었습니다.",
    highlightedPlanId: "bundle_monthly",
    freeHref: "/survival",
    filterNotice: "전체 요금제를 보고 있습니다. 코인과 글로벌 시장을 모두 쓰면 올마켓 플랜이 유리합니다."
  },
  crypto: {
    eyebrow: "Coin Radar Pro",
    title: "코인 화면에서는 코인 전용 플랜과 올마켓 플랜만 보여드립니다.",
    body:
      "BTC·ETH, 알트코인, 코인뉴스, 코인알림을 중심으로 쓰는 사용자라면 코인 전용 플랜으로 충분합니다. 글로벌 시장까지 함께 볼 예정이면 올마켓 플랜을 선택하면 됩니다.",
    representativePrice: "월 14,900원",
    representativeBody: "코인 레이더, ICT 판독, 기술지표, 코인뉴스, 코인알림을 코인 시장에 맞춰 엽니다.",
    highlightedPlanId: "crypto_monthly",
    freeHref: "/survival",
    filterNotice: "코인 전용 화면입니다. 글로벌 전용 플랜은 숨기고, 올마켓 플랜만 함께 보여드립니다."
  },
  stocks: {
    eyebrow: "Global Radar Pro",
    title: "글로벌 화면에서는 글로벌 전용 플랜과 올마켓 플랜만 보여드립니다.",
    body:
      "미국주식, ETF, 지수, 실적, 원자재와 매크로 흐름을 중심으로 쓰는 사용자라면 글로벌 전용 플랜으로 충분합니다. 장전 점검, 장중 기준선 확인, 매크로 브리핑, 관심 자산 알림을 한 흐름으로 묶어 매일 켜는 용도로 설계했습니다.",
    representativePrice: "월 14,900원",
    representativeBody: "글로벌 레이더, 기술지표, 글로벌뉴스, 매크로 브리핑, 관심 자산 알림을 한 화면으로 엽니다.",
    highlightedPlanId: "stocks_monthly",
    freeHref: "/global",
    filterNotice: "글로벌 전용 화면입니다. 다른 단일 시장 플랜은 숨기고, 올마켓 플랜만 함께 보여드립니다."
  }
};

export function ProPricingPanel({ marketScope = "all" }: { marketScope?: BillingPageScope } = {}) {
  const [checkoutState, setCheckoutState] = useState<CheckoutState>({ status: "idle" });
  const visiblePlans = getBillingPlansForPage(marketScope);
  const copy = scopeCopy[marketScope];

  async function startCheckout(planId: BillingPlanId) {
    setCheckoutState({ status: "loading", planId });

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, platform: "web" })
      });
      const data = (await response.json().catch(() => ({}))) as {
        paymentUrl?: string;
        message?: string;
        error?: string;
      };

      if (!response.ok) throw new Error(data.error ?? "결제 준비 중 오류가 발생했습니다.");
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }

      setCheckoutState({
        status: "message",
        tone: "info",
        text: data.message ?? "현재 결제창을 점검하고 있습니다. 잠시 후 다시 시도해 주세요."
      });
    } catch (error) {
      setCheckoutState({
        status: "message",
        tone: "error",
        text: error instanceof Error ? error.message : "결제 연결 상태를 확인하지 못했습니다."
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

      <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-6 text-cyan-100">
        {copy.filterNotice}
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

      <div id="plans" className="grid scroll-mt-28 gap-4 lg:grid-cols-3">
        {visiblePlans.map((plan) => {
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
                  <h3 className="mt-4 text-xl font-black text-white">{plan.name}</h3>
                </div>
                {highlighted ? <Crown className="text-cyan-300" size={22} aria-hidden /> : null}
              </div>
              <p className="mt-4 text-3xl font-black text-white">{plan.priceLabel}</p>
              {isYearly && plan.id !== "free" ? (
                <p className="mt-1 text-xs font-bold text-cyan-200">월 환산 약 {plan.monthlyValue.toLocaleString("ko-KR")}원</p>
              ) : null}
              <p className="mt-4 min-h-16 text-sm leading-6 text-slate-400">{plan.description}</p>

              <div className="mt-5 space-y-2">
                {plan.highlights.map((item) => (
                  <p key={item} className="flex items-start gap-2 text-sm text-slate-200">
                    <Check className="mt-0.5 shrink-0 text-cyan-300" size={15} aria-hidden />
                    {item}
                  </p>
                ))}
              </div>

              <div className="mt-5 grid gap-2 rounded-md border border-white/10 bg-black/20 p-3 text-xs text-slate-400">
                <p>레이더: <span className="font-bold text-slate-200">{plan.limits.radarScans}</span></p>
                <p>AI 브리핑: <span className="font-bold text-slate-200">{plan.limits.aiBriefings}</span></p>
                <p>관심종목: <span className="font-bold text-slate-200">{plan.limits.watchlist}</span></p>
                <p>알림: <span className="font-bold text-slate-200">{plan.limits.alerts}</span></p>
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
                  onClick={() => startCheckout(plan.id)}
                  disabled={checkoutState.status === "loading"}
                  className={`mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-black transition ${
                    highlighted
                      ? "bg-cyan-300 text-slate-950 hover:bg-cyan-200"
                      : "border border-cyan-300/30 bg-cyan-300/10 text-cyan-200 hover:bg-cyan-300 hover:text-slate-950"
                  } disabled:cursor-wait disabled:opacity-70`}
                >
                  {isLoading ? <Loader2 className="animate-spin" size={16} aria-hidden /> : null}
                  {isLoading ? "결제 상태 확인 중" : isYearly ? "연간으로 시작하기" : "월간으로 시작하기"}
                </button>
              )}
            </article>
          );
        })}
      </div>

      <UsageMeterPanel />

      <RadarAlertCenter />

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
        <p className="font-black text-white">구독 전 확인해 주세요</p>
        <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-400">
          {subscriptionTrustNotes.map((item) => (
            <p key={item} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
              {item}
            </p>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
          <Link href="/refund" className="rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-cyan-200">
            구독 해지·환불 안내
          </Link>
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
