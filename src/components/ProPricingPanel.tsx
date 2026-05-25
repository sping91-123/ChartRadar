"use client";
// Pro 구독 플랜과 결제 시작 버튼을 보여주는 판매 패널입니다.
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import {
  type BillingEntitlementPlan,
  type BillingPlanId,
  type BillingPageScope,
  type BillingPlan,
  getBillingPlansForPage,
  formatKrw,
  getEntitlementLabel,
  hasMarketEntitlement,
  subscriptionTrustNotes
} from "@/lib/billing";
import { fetchNativePlanPriceLabels, isNativePurchaseAvailable, purchaseNativePlan, restoreNativeEntitlement } from "@/lib/mobilePurchases";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { ActionButton, AppSurface, DataRow, MetricRow, PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";

type CheckoutState =
  | { status: "idle" }
  | { status: "loading"; planId: string }
  | { status: "restoring" }
  | { status: "message"; tone: "info" | "error"; text: string };

function scopeCopy(scope: BillingPageScope) {
  if (scope === "crypto") {
    return {
      eyebrow: "COIN PRO",
      title: "Coin Pro 권한과 플랜을 확인합니다.",
      body: "BTC/ETH·알트 추적 조건, 무효화 기준, 세부 리스크를 코인 시장 기준으로 정리합니다."
    };
  }

  if (scope === "stocks") {
    return {
      eyebrow: "GLOBAL PRO",
      title: "Global Pro 권한과 플랜을 확인합니다.",
      body: "미국장 30초 체크, 지수선물, 매크로 압력, 섹터 로테이션, 대장주 레이더를 한 화면에서 정리합니다."
    };
  }

  return {
    eyebrow: "ALL MARKET PRO",
    title: "All Market Pro 권한과 플랜을 확인합니다.",
    body: "Coin Pro와 Global Pro를 통합해 코인과 미국장을 함께 보는 사용자를 위한 판단 보조 흐름을 제공합니다."
  };
}

function checkoutCtaLabel(plan: BillingPlan) {
  if (plan.marketScope === "crypto") return "Coin Pro로 코인 상세 판단 열기";
  if (plan.marketScope === "stocks") return "Global Pro로 미국장 상세 판단 열기";
  if (plan.marketScope === "bundle") return "All Market Pro로 전체 시장 판단 열기";
  return "Pro 시작하기";
}

function planScopeLabel(plan: BillingPlan) {
  if (plan.marketScope === "crypto") return "Coin Pro";
  if (plan.marketScope === "stocks") return "Global Pro";
  if (plan.marketScope === "bundle") return "All Market Pro";
  return "Basic";
}

function planScopeTone(plan: BillingPlan) {
  if (plan.marketScope === "trial") return "locked" as const;
  if (plan.marketScope === "bundle") return "watch" as const;
  return "info" as const;
}

function AccessValue({ open }: { open: boolean }) {
  return <span className={open ? "text-ui-long" : "text-ui-locked"}>{open ? "열림" : "Basic"}</span>;
}

function PlanCard({
  plan,
  isBusy,
  isCurrent,
  priceLabel,
  onCheckout
}: {
  plan: BillingPlan;
  isBusy: boolean;
  isCurrent: boolean;
  priceLabel: string;
  onCheckout: (plan: BillingPlan) => void;
}) {
  const hasMonthlyValue = plan.monthlyValue > 0 && plan.billingPeriodMonths > 1;

  return (
    <AppSurface as="article" tone={plan.marketScope === "bundle" ? "elevated" : "panel"} padding="md" className="flex h-full min-w-0 flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusPill tone={planScopeTone(plan)}>{planScopeLabel(plan)}</StatusPill>
            {isCurrent ? <StatusPill tone="long">현재 플랜</StatusPill> : null}
          </div>
          <h3 className="mt-3 break-keep text-ui-title font-semibold tracking-tight text-ui-text">{plan.displayName}</h3>
          <p className="mt-1 text-ui-label font-semibold text-ui-subtle">{plan.periodLabel}</p>
        </div>
      </div>

      <p className="mt-4 break-keep text-[1.35rem] font-semibold leading-tight tracking-tight text-ui-text min-[360px]:text-2xl">{priceLabel}</p>
      {hasMonthlyValue ? (
        <p className="mt-1 text-ui-label font-semibold text-ui-muted">월 환산 {formatKrw(plan.monthlyValue)}</p>
      ) : null}
      <p className="mt-3 text-ui-body text-ui-muted [word-break:keep-all]">{plan.description}</p>
      <p className="mt-3 text-xs font-semibold leading-5 text-ui-subtle [word-break:keep-all]">{plan.renewalText}</p>

      <ul className="mt-4 space-y-2 text-sm text-ui-muted">
        {plan.highlights.map((item) => (
          <li key={item} className="flex gap-2 [word-break:keep-all]">
            <CheckCircle2 className="mt-0.5 shrink-0 text-ui-long" size={15} aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <AppSurface tone="inset" padding="sm" className="mt-4">
        <MetricRow label="시장" value={<span className="block max-w-[9rem] whitespace-normal break-keep">{plan.limits.markets}</span>} />
        <MetricRow label="레이더" value={<span className="block max-w-[9rem] whitespace-normal break-keep">{plan.limits.radarScans}</span>} />
        <MetricRow label="관심목록" value={<span className="block max-w-[9rem] whitespace-normal break-keep">{plan.limits.watchlist}</span>} />
        <MetricRow label="알림" value={<span className="block max-w-[9rem] whitespace-normal break-keep">{plan.limits.alerts}</span>} />
      </AppSurface>

      <div className="mt-auto pt-5">
        <ActionButton tone="primary" onClick={() => onCheckout(plan)} disabled={isBusy} className="w-full whitespace-normal break-keep px-2 text-center leading-5 min-[360px]:px-3">
          {isBusy ? <Loader2 className="mr-2 animate-spin" size={16} aria-hidden /> : null}
          {checkoutCtaLabel(plan)}
        </ActionButton>
      </div>
    </AppSurface>
  );
}

export function ProPricingPanel({ marketScope = "all" }: { marketScope?: BillingPageScope } = {}) {
  const { session, user, profile, isLoading } = useSupabaseAuth();
  const [checkoutState, setCheckoutState] = useState<CheckoutState>({ status: "idle" });
  const [nativePriceLabels, setNativePriceLabels] = useState<Partial<Record<BillingPlanId, string>>>({});
  const visiblePlans = useMemo(() => getBillingPlansForPage(marketScope), [marketScope]);
  const freePlan = visiblePlans.find((plan) => plan.id === "free");
  const paidPlans = visiblePlans.filter((plan) => plan.id !== "free");
  const visiblePlanIds = useMemo(() => visiblePlans.map((plan) => plan.id).join("|"), [visiblePlans]);
  const copy = scopeCopy(marketScope);
  const nativePurchaseAvailable = isNativePurchaseAvailable();
  const currentPlanId = (profile?.plan ?? "free") as BillingEntitlementPlan;
  const currentPlanLabel = isLoading ? "확인 중" : session ? getEntitlementLabel(currentPlanId) : "로그인 필요";
  const hasCryptoAccess = hasMarketEntitlement(currentPlanId, "crypto");
  const hasGlobalAccess = hasMarketEntitlement(currentPlanId, "stocks");

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
      setCheckoutState({ status: "message", tone: "info", text: "구독 권한을 불러오려면 먼저 구글 로그인이 필요합니다." });
      return;
    }

    setCheckoutState({ status: "restoring" });

    try {
      const result = await restoreNativeEntitlement({ userId: user.id, accessToken: session.accessToken });
      setCheckoutState({ status: "message", tone: "info", text: result.message });
    } catch (error) {
      setCheckoutState({ status: "message", tone: "error", text: error instanceof Error ? error.message : "구독 권한 상태를 확인하지 못했습니다." });
    }
  }

  return (
    <section className="flex flex-col gap-4 sm:gap-5">
      <AppSurface tone="panel" padding="lg" className="shadow-none">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <SectionHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.body} />
          <StatusPill tone={session ? "info" : "locked"} className="self-start">{currentPlanLabel}</StatusPill>
        </div>
      </AppSurface>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <PanelCard>
          <SectionHeader
            eyebrow="CURRENT PLAN"
            title="현재 이용 상태"
            description="로그인된 계정의 Pro 권한과 Basic에서 확인 가능한 범위를 먼저 보여줍니다."
          />
          <div className="mt-4">
            <DataRow label="현재 플랜" value={currentPlanLabel} detail={session ? "구독 권한은 계정 기준으로 적용됩니다." : "결제 전 Google 로그인이 필요합니다."} />
            <DataRow label="코인 Pro" value={<AccessValue open={hasCryptoAccess} />} detail="BTC/ETH, 알트 추적 조건, 무효화 기준." />
            <DataRow label="글로벌 Pro" value={<AccessValue open={hasGlobalAccess} />} detail="미국장 30초 체크, 지수선물, 매크로 압력." />
          </div>
          {freePlan ? (
            <ActionButton href="/crypto" tone="secondary" className="mt-4 w-full">
              Basic으로 먼저 둘러보기
            </ActionButton>
          ) : null}
        </PanelCard>

        <PanelCard>
          <SectionHeader
            eyebrow="PLAN DIFFERENCE"
            title="Basic과 Pro 차이"
            description="Basic은 방향 요약 중심이고, Pro는 상세 근거와 리스크 세부 정보를 열어 확인하는 구조입니다."
          />
          <div className="mt-4">
            <DataRow label="Basic" value="방향 요약" detail="상세 조건, 무효화 기준, 세부 리스크는 제한됩니다." />
            <DataRow label="Coin Pro" value="코인 상세" detail="BTC/ETH·알트 리스크, 추적 조건, 무효화 기준." />
            <DataRow label="Global Pro" value="미국장 상세" detail="지수선물, 매크로 압력, 섹터 로테이션, 대장주 레이더." />
            <DataRow label="All Market" value="전체 시장" detail="Coin Pro + Global Pro 통합 권한." />
          </div>
        </PanelCard>
      </div>

      {checkoutState.status === "message" ? (
        <AppSurface tone="inset" padding="md" className={checkoutState.tone === "error" ? "text-ui-short" : "text-ui-muted"}>
          <StatusPill tone={checkoutState.tone === "error" ? "risk" : "info"}>{checkoutState.tone === "error" ? "확인 필요" : "결제 상태"}</StatusPill>
          <p className="mt-2 text-ui-body font-semibold [word-break:keep-all]">{checkoutState.text}</p>
        </AppSurface>
      ) : null}

      <div className="flex flex-col gap-3">
        <SectionHeader eyebrow="AVAILABLE PLANS" title="선택 가능한 Pro 플랜" description="가격과 권한 범위를 확인한 뒤 필요한 시장만 선택할 수 있습니다." />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {paidPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isBusy={checkoutState.status === "loading" && checkoutState.planId === plan.id}
              isCurrent={currentPlanId === plan.id}
              priceLabel={nativePriceLabels[plan.id] ?? plan.priceLabel}
              onCheckout={startCheckout}
            />
          ))}
        </div>
      </div>

      {nativePurchaseAvailable ? (
        <ActionButton onClick={restoreCheckout} disabled={checkoutState.status === "restoring"} tone="secondary" className="w-full sm:w-auto">
          {checkoutState.status === "restoring" ? <Loader2 className="mr-2 animate-spin" size={16} aria-hidden /> : null}
          구독 권한 불러오기
        </ActionButton>
      ) : null}

      <PanelCard>
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-ui-brand" aria-hidden />
          <h3 className="text-ui-title font-semibold text-ui-text">구독 전 확인할 점</h3>
        </div>
        <ul className="mt-3 space-y-2 text-ui-body text-ui-muted">
          {subscriptionTrustNotes.map((note) => (
            <li key={note} className="flex gap-2 [word-break:keep-all]">
              <span className="text-ui-subtle" aria-hidden>·</span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </PanelCard>
    </section>
  );
}
