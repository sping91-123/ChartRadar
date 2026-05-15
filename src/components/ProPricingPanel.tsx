"use client";
// Pro 구독 플랜과 결제 시작 버튼을 보여주는 판매 패널입니다.
import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Crown, Loader2, ShieldCheck } from "lucide-react";
import {
  type BillingPageScope,
  type BillingPlan,
  getBillingPlansForPage,
  formatKrw,
  isYearlyBillingPlan,
  subscriptionTrustNotes
} from "@/lib/billing";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { withSupabaseAuth } from "@/lib/authFetch";

type CheckoutState =
  | { status: "idle" }
  | { status: "loading"; planId: string }
  | { status: "message"; tone: "info" | "error"; text: string };

function scopeCopy(scope: BillingPageScope) {
  if (scope === "crypto") {
    return {
      eyebrow: "COIN PRO",
      title: "코인 시장을 매일 보는 사람에게 필요한 레이더입니다.",
      body: "BTC, ETH, 알트코인, 코인 뉴스와 알림을 코인 흐름에 맞춰 깊게 확인합니다."
    };
  }

  if (scope === "stocks") {
    return {
      eyebrow: "GLOBAL PRO",
      title: "글로벌 시장과 매크로 흐름을 함께 보는 레이더입니다.",
      body: "미국주식, ETF, 해외선물, 주요 매크로 이슈를 한 화면에서 정리합니다."
    };
  }

  return {
    eyebrow: "ALL MARKET PRO",
    title: "코인과 글로벌 시장을 모두 감시하는 통합 레이더입니다.",
    body: "두 시장을 따로 결제하는 것보다 효율적으로, 뉴스와 알림까지 함께 사용할 수 있습니다."
  };
}

function PlanCard({
  plan,
  isBusy,
  onCheckout
}: {
  plan: BillingPlan;
  isBusy: boolean;
  onCheckout: (plan: BillingPlan) => void;
}) {
  const isFree = plan.id === "free";
  const isRecommended = plan.marketScope === "bundle" && !isYearlyBillingPlan(plan.id);

  return (
    <article
      className={`relative flex h-full flex-col rounded-2xl border p-5 ${
        isRecommended
          ? "border-cyan-300/35 bg-cyan-300/10 shadow-[0_24px_70px_rgba(34,211,238,0.12)]"
          : "border-surface-line bg-white/70 dark:bg-white/[0.035]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-[0.22em] text-accent-blue">{plan.badge}</p>
          <h3 className="mt-2 text-xl font-black text-slate-950 dark:text-white">{plan.name}</h3>
        </div>
        {isRecommended ? (
          <span className="rounded-full bg-cyan-300 px-2.5 py-1 text-[11px] font-black text-slate-950">추천</span>
        ) : null}
      </div>

      <p className="mt-4 text-3xl font-black text-slate-950 dark:text-white">{plan.priceLabel}</p>
      {plan.monthlyValue > 0 ? (
        <p className="mt-1 text-xs font-bold text-slate-500">월 환산 {formatKrw(plan.monthlyValue)}</p>
      ) : null}
      <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{plan.description}</p>

      <ul className="mt-5 space-y-2 text-sm text-slate-600 dark:text-slate-300">
        {plan.highlights.map((item) => (
          <li key={item} className="flex gap-2">
            <CheckCircle2 className="mt-0.5 shrink-0 text-signal-success" size={15} aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 grid gap-2 rounded-xl border border-white/10 bg-black/5 p-3 text-xs font-bold text-slate-500 dark:bg-black/20">
        <p>레이더: {plan.limits.radarScans}</p>
        <p>AI 브리핑: {plan.limits.aiBriefings}</p>
        <p>관심목록: {plan.limits.watchlist}</p>
        <p>알림: {plan.limits.alerts}</p>
      </div>

      <div className="mt-auto pt-5">
        {isFree ? (
          <Link
            href="/crypto"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-surface-line bg-white/80 px-4 text-sm font-black text-slate-700 dark:bg-black/20 dark:text-slate-200"
          >
            무료로 둘러보기
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => onCheckout(plan)}
            disabled={isBusy}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-accent-blue px-4 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy ? <Loader2 className="mr-2 animate-spin" size={16} aria-hidden /> : null}
            {isYearlyBillingPlan(plan.id) ? "연간으로 시작하기" : "월간으로 시작하기"}
          </button>
        )}
      </div>
    </article>
  );
}

export function ProPricingPanel({ marketScope = "all" }: { marketScope?: BillingPageScope } = {}) {
  const { user, isLoading } = useSupabaseAuth();
  const [checkoutState, setCheckoutState] = useState<CheckoutState>({ status: "idle" });
  const visiblePlans = useMemo(() => getBillingPlansForPage(marketScope), [marketScope]);
  const copy = scopeCopy(marketScope);

  async function startCheckout(plan: BillingPlan) {
    if (isLoading) {
      setCheckoutState({ status: "message", tone: "info", text: "계정 상태를 확인하고 있습니다. 잠시 후 다시 눌러 주세요." });
      return;
    }

    if (!user?.id) {
      setCheckoutState({ status: "message", tone: "info", text: "결제를 시작하려면 먼저 로그인해 주세요." });
      return;
    }

    setCheckoutState({ status: "loading", planId: plan.id });

    try {
      const response = await fetch(
        "/api/billing/checkout",
        await withSupabaseAuth({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ planId: plan.id, platform: "web" })
        })
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "결제창을 열지 못했습니다. 잠시 후 다시 시도해 주세요.");
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setCheckoutState({ status: "message", tone: "info", text: data.message ?? "결제창 연결 정보를 확인하지 못했습니다." });
    } catch (error) {
      setCheckoutState({ status: "message", tone: "error", text: error instanceof Error ? error.message : "결제 연결 상태를 확인하지 못했습니다." });
    }
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="enterprise-panel p-6">
        <p className="text-xs font-black tracking-[0.24em] text-accent-blue">{copy.eyebrow}</p>
        <h2 className="mt-3 max-w-3xl text-3xl font-black tracking-tight text-slate-950 dark:text-white">{copy.title}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{copy.body}</p>
      </div>

      {checkoutState.status === "message" ? (
        <div
          className={`rounded-2xl border p-4 text-sm font-bold ${
            checkoutState.tone === "error"
              ? "border-signal-danger/30 bg-signal-danger/10 text-signal-danger"
              : "border-accent-blue/30 bg-accent-blue/10 text-accent-blue"
          }`}
        >
          {checkoutState.text}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {visiblePlans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isBusy={checkoutState.status === "loading" && checkoutState.planId === plan.id}
            onCheckout={startCheckout}
          />
        ))}
      </div>

      <div className="enterprise-panel p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-accent-blue" aria-hidden />
          <h3 className="text-base font-black text-slate-950 dark:text-white">구독 전 확인할 점</h3>
        </div>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {subscriptionTrustNotes.map((note) => (
            <li key={note}>· {note}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
