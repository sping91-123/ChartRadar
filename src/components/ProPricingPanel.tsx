"use client";
// Pro 구독 플랜과 결제 시작 버튼을 보여주는 판매 패널입니다.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import {
  type BillingPlanId,
  type BillingPageScope,
  type BillingPlan,
  getBillingPlansForPage,
  formatKrw,
  subscriptionTrustNotes
} from "@/lib/billing";
import { fetchNativePlanPriceLabels, isNativePurchaseAvailable, purchaseNativePlan, restoreNativeEntitlement } from "@/lib/mobilePurchases";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

type CheckoutState =
  | { status: "idle" }
  | { status: "loading"; planId: string }
  | { status: "restoring" }
  | { status: "message"; tone: "info" | "error"; text: string };

function scopeCopy(scope: BillingPageScope) {
  if (scope === "crypto") {
    return {
      eyebrow: "COIN PRO",
      title: "Coin Pro로 코인 상세 판단을 엽니다.",
      body: "BTC/ETH·알트 추적 조건, 무효화 기준, 세부 리스크를 코인 시장 기준으로 정리합니다."
    };
  }

  if (scope === "stocks") {
    return {
      eyebrow: "GLOBAL PRO",
      title: "Global Pro로 미국장 상세 판단을 엽니다.",
      body: "미국장 30초 체크, 지수선물, 매크로 압력, 섹터 로테이션, 대장주 레이더를 한 화면에서 정리합니다."
    };
  }

  return {
    eyebrow: "ALL MARKET PRO",
    title: "All Market Pro로 전체 시장 판단을 엽니다.",
    body: "Coin Pro와 Global Pro를 통합해 코인과 미국장을 함께 보는 사용자를 위한 판단 보조 흐름을 제공합니다."
  };
}

function checkoutCtaLabel(plan: BillingPlan) {
  if (plan.marketScope === "crypto") return "Coin Pro로 코인 상세 판단 열기";
  if (plan.marketScope === "stocks") return "Global Pro로 미국장 상세 판단 열기";
  if (plan.marketScope === "bundle") return "All Market Pro로 전체 시장 판단 열기";
  return "Pro 시작하기";
}

function PlanCard({
  plan,
  isBusy,
  priceLabel,
  onCheckout
}: {
  plan: BillingPlan;
  isBusy: boolean;
  priceLabel: string;
  onCheckout: (plan: BillingPlan) => void;
}) {
  const isFree = plan.id === "free";
  const isRecommended = plan.marketScope === "bundle" && plan.billingPeriodMonths === 1;
  const hasMonthlyValue = plan.monthlyValue > 0 && plan.billingPeriodMonths > 1;

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
          <h3 className="mt-2 text-xl font-black text-slate-950 dark:text-white">{plan.displayName}</h3>
          <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">{plan.periodLabel}</p>
        </div>
        {isRecommended ? (
          <span className="rounded-full bg-cyan-300 px-2.5 py-1 text-[11px] font-black text-slate-950">통합</span>
        ) : null}
      </div>

      <p className="mt-4 text-3xl font-black text-slate-950 dark:text-white">{priceLabel}</p>
      {hasMonthlyValue ? (
        <p className="mt-1 text-xs font-bold text-slate-500">월 환산 {formatKrw(plan.monthlyValue)}</p>
      ) : null}
      <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{plan.description}</p>
      {!isFree ? <p className="mt-3 text-xs font-bold leading-5 text-slate-500 dark:text-slate-400">{plan.renewalText}</p> : null}

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
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-accent-blue px-4 text-center text-sm font-black leading-5 text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy ? <Loader2 className="mr-2 animate-spin" size={16} aria-hidden /> : null}
            {checkoutCtaLabel(plan)}
          </button>
        )}
      </div>
    </article>
  );
}

export function ProPricingPanel({ marketScope = "all" }: { marketScope?: BillingPageScope } = {}) {
  const { session, user, isLoading } = useSupabaseAuth();
  const [checkoutState, setCheckoutState] = useState<CheckoutState>({ status: "idle" });
  const [nativePriceLabels, setNativePriceLabels] = useState<Partial<Record<BillingPlanId, string>>>({});
  const visiblePlans = useMemo(() => getBillingPlansForPage(marketScope), [marketScope]);
  const visiblePlanIds = useMemo(() => visiblePlans.map((plan) => plan.id).join("|"), [visiblePlans]);
  const copy = scopeCopy(marketScope);
  const nativePurchaseAvailable = isNativePurchaseAvailable();

  useEffect(() => {
    if (!nativePurchaseAvailable || !user?.id) {
      setNativePriceLabels({});
      return;
    }

    let cancelled = false;
    fetchNativePlanPriceLabels(visiblePlans, user.id)
      .then((labels) => {
        if (!cancelled) setNativePriceLabels(labels);
      })
      .catch(() => {
        if (!cancelled) setNativePriceLabels({});
      });

    return () => {
      cancelled = true;
    };
  }, [nativePurchaseAvailable, user?.id, visiblePlanIds, visiblePlans]);

  async function startCheckout(plan: BillingPlan) {
    if (isLoading) {
      setCheckoutState({ status: "message", tone: "info", text: "계정 상태를 확인하고 있습니다. 잠시 후 다시 눌러 주세요." });
      return;
    }

    if (!session?.accessToken) {
      setCheckoutState({ status: "message", tone: "info", text: "결제 후 Pro 기능을 바로 이용하려면 먼저 구글 로그인이 필요합니다. 로그인 후 다시 결제를 시작해 주세요." });
      return;
    }

    setCheckoutState({ status: "loading", planId: plan.id });

    try {
      if (nativePurchaseAvailable) {
        if (!user?.id) throw new Error("앱 구독을 연결하려면 로그인 정보를 먼저 확인해야 합니다.");
        const result = await purchaseNativePlan({ plan, userId: user.id, accessToken: session.accessToken });
        setCheckoutState({ status: "message", tone: "info", text: result.message });
        return;
      }

      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, platform: "web" })
      });
      const data = (await response.json().catch(() => ({}))) as { paymentUrl?: string; message?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "결제창을 열지 못했습니다. 잠시 후 다시 시도해 주세요.");
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }
      setCheckoutState({ status: "message", tone: "info", text: data.message ?? "결제창 연결 정보를 확인하지 못했습니다." });
    } catch (error) {
      setCheckoutState({ status: "message", tone: "error", text: error instanceof Error ? error.message : "결제 연결 상태를 확인하지 못했습니다." });
    }
  }

  async function restoreCheckout() {
    if (!nativePurchaseAvailable) return;

    if (isLoading) {
      setCheckoutState({ status: "message", tone: "info", text: "계정 상태를 확인하고 있습니다. 잠시 후 다시 눌러 주세요." });
      return;
    }

    if (!session?.accessToken || !user?.id) {
      setCheckoutState({ status: "message", tone: "info", text: "구매 복원을 하려면 먼저 구글 로그인이 필요합니다." });
      return;
    }

    setCheckoutState({ status: "restoring" });

    try {
      const result = await restoreNativeEntitlement({ userId: user.id, accessToken: session.accessToken });
      setCheckoutState({ status: "message", tone: "info", text: result.message });
    } catch (error) {
      setCheckoutState({ status: "message", tone: "error", text: error instanceof Error ? error.message : "구매 복원 상태를 확인하지 못했습니다." });
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
            priceLabel={nativePriceLabels[plan.id] ?? plan.priceLabel}
            onCheckout={startCheckout}
          />
        ))}
      </div>

      {nativePurchaseAvailable ? (
        <button
          type="button"
          onClick={restoreCheckout}
          disabled={checkoutState.status === "restoring"}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-surface-line bg-white/80 px-4 text-sm font-black text-slate-700 dark:bg-black/20 dark:text-slate-200 disabled:cursor-wait disabled:opacity-60"
        >
          {checkoutState.status === "restoring" ? <Loader2 className="mr-2 animate-spin" size={16} aria-hidden /> : null}
          앱 구독 복원
        </button>
      ) : null}

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
