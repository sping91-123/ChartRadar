"use client";
// Pro 구독 플랜과 결제 시작 흐름을 보여주는 판매 패널이다.
import { useState } from "react";
import Link from "next/link";
import { BellRing, Check, Crown, Loader2, Radar, Sparkles } from "lucide-react";
import { RadarAlertCenter } from "@/components/RadarAlertCenter";
import { paidBillingPlans, billingPlans, launchPaymentNotes, type BillingPlanId } from "@/lib/billing";

type CheckoutState =
  | { status: "idle" }
  | { status: "loading"; planId: BillingPlanId }
  | { status: "message"; tone: "info" | "error"; text: string };

const conversionPoints = [
  {
    icon: Radar,
    title: "매일 켜는 이유",
    body: "코인과 해외주식에서 오늘 먼저 볼 종목, 방향 쏠림, 위험 구간을 한 화면에서 정리합니다."
  },
  {
    icon: Sparkles,
    title: "AI 사용량 차별화",
    body: "무료는 맛보기만 열고, Pro는 AI 브리핑과 종합 해석을 넉넉하게 제공합니다."
  },
  {
    icon: BellRing,
    title: "알림이 결제 이유",
    body: "5월 출시 이후 Pro는 관심종목 구조 변화, 급등락, 주요 뉴스 브리핑 알림을 우선 받습니다."
  }
];

export function ProPricingPanel() {
  const [checkoutState, setCheckoutState] = useState<CheckoutState>({ status: "idle" });

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
        text: data.message ?? "결제 링크가 아직 연결되지 않았습니다. 토스페이먼츠 계약과 결제 URL 설정이 필요합니다."
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
              5월 출시 결제 모델
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-normal text-white sm:text-4xl">
              Pro는 신호 판매가 아니라, 매일 시장을 훑는 시간을 줄여주는 구독입니다.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              무료 사용자는 핵심 흐름을 확인하고, Pro 사용자는 전체 코인 레이더, 해외주식 레이더, AI 브리핑, 관심종목 알림과 저장 기능을 더 넓게 씁니다.
              앱스토어 출시 시 iOS 내부 결제는 Apple 구독 상품으로 연결하고, 웹은 토스페이먼츠로 결제받는 구조가 가장 안전합니다.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/25 p-4 text-sm text-slate-300 lg:w-72">
            <p className="font-black text-white">권장 출시가</p>
            <p className="mt-2 text-3xl font-black text-cyan-200">월 19,900원</p>
            <p className="mt-2 leading-6 text-slate-400">
              정식 출시 첫 달은 가격을 낮추기보다 기능을 충분히 보여주고, 결제자는 알림과 저장 안정성을 먼저 제공하는 편이 좋습니다.
            </p>
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

      <div className="grid gap-4 lg:grid-cols-3">
        {billingPlans.map((plan) => {
          const highlighted = plan.id === "pro_monthly";
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
              {plan.id === "pro_yearly" ? (
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
                  href="/survival"
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
                  {isLoading ? "결제 상태 확인 중" : "Pro 시작하기"}
                </button>
              )}
            </article>
          );
        })}
      </div>

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
        <p className="font-black text-white">출시 전 결제 체크리스트</p>
        <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-400">
          {launchPaymentNotes.map((item) => (
            <p key={item} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
              {item}
            </p>
          ))}
        </div>
        <div className="mt-4 rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
          실제 결제를 열기 전에는 사업자 정보, 환불 정책, 고객센터 이메일, 개인정보 처리방침, App Store 구독 상품 심사까지 함께 맞춰야 합니다.
        </div>
      </div>
    </section>
  );
}
