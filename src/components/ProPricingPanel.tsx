"use client";
// Pro 구독 플랜과 결제 시작 버튼을 보여주는 판매 패널입니다.
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BookOpen, CheckCircle2, Gauge, Loader2, ShieldAlert, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
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
import { fetchNativePlanPriceLabels, isNativePurchaseAvailable, NativePurchaseError, purchaseNativePlan, restoreNativeEntitlement, type NativePurchaseStageEvent } from "@/lib/mobilePurchases";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { ActionButton, AppSurface, DataRow, MetricRow, PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";

type CheckoutState =
  | { status: "idle" }
  | { status: "loading"; planId: string; stageText?: string }
  | { status: "restoring" }
  | { status: "message"; tone: "info" | "error"; text: string; planId?: string };

type ValueCardTone = "info" | "watch" | "risk" | "long" | "locked";

const NATIVE_CHECKOUT_TIMEOUT_MS = 60_000;
const WEB_CHECKOUT_UNAVAILABLE_MESSAGE = "웹 결제는 준비 중입니다. Android 앱에서 Google Play 구독으로 결제해 주세요.";
const NATIVE_CHECKOUT_TIMEOUT_MESSAGE = "Google Play 결제창을 여는 데 시간이 오래 걸리고 있습니다. 앱을 다시 열거나 잠시 후 다시 시도해 주세요.";

class NativeCheckoutTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NativeCheckoutTimeoutError";
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new NativeCheckoutTimeoutError(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function nativeStageText(event: NativePurchaseStageEvent) {
  switch (event.stage) {
    case "native_start":
      return "결제 단계: Android 결제 환경을 확인하는 중입니다.";
    case "configure_start":
      return "결제 단계: 결제 서비스를 연결하는 중입니다.";
    case "configure_success":
      return "결제 단계: 결제 서비스 연결이 확인됐습니다.";
    case "configure_cached":
      return "결제 단계: 기존 결제 서비스 연결을 사용합니다.";
    case "get_products_start":
      return "결제 단계: Google Play 상품 정보를 확인하는 중입니다.";
    case "get_products_success":
      return `결제 단계: Google Play 상품 ${event.details?.productCount ?? 0}개를 확인했습니다.`;
    case "product_matched":
      return event.details?.matched
        ? "결제 단계: 요청한 Google Play 상품을 찾았습니다."
        : "결제 단계: 요청한 Google Play 상품을 찾지 못했습니다.";
    case "base_plan_matched":
      return event.details?.matched
        ? "결제 단계: Google Play 기본 요금제를 확인했습니다."
        : "결제 단계: Google Play 기본 요금제를 찾지 못했습니다.";
    case "purchase_start":
      return "결제 단계: Google Play 결제창을 요청했습니다.";
    case "purchase_success":
      return "결제 단계: Google Play 결제가 완료됐습니다.";
    case "purchase_cancel":
      return "결제 단계: 결제가 취소되었습니다.";
    case "purchase_error":
      return "결제 단계: 결제창 요청 중 오류가 발생했습니다.";
    default:
      return "결제 단계: Google Play 결제 상태를 확인하는 중입니다.";
  }
}

function nativeCheckoutErrorMessage(error: unknown, lastStage?: NativePurchaseStageEvent) {
  if (error instanceof NativeCheckoutTimeoutError) {
    if (lastStage?.stage === "purchase_start") {
      return "상품과 기본 요금제는 확인됐지만 Google Play 결제창 요청 단계에서 지연되고 있습니다. 앱을 다시 열거나 잠시 후 다시 시도해 주세요.";
    }
    if (lastStage?.stage === "get_products_start") {
      return "Google Play 상품 정보를 불러오는 단계에서 응답이 지연되고 있습니다. Play 스토어 계정과 네트워크 상태를 확인한 뒤 다시 시도해 주세요.";
    }
    if (lastStage?.stage === "base_plan_matched" || lastStage?.stage === "product_matched" || lastStage?.stage === "get_products_success") {
      return "상품 정보는 확인됐지만 Google Play 결제창을 여는 단계로 넘어가는 데 시간이 오래 걸리고 있습니다. 잠시 후 다시 시도해 주세요.";
    }
    return NATIVE_CHECKOUT_TIMEOUT_MESSAGE;
  }

  if (error instanceof NativePurchaseError) {
    if (error.code === "purchase_cancelled") return "결제가 취소되었습니다.";
    if (error.code === "product_load_failed" || error.code === "product_not_found" || error.code === "base_plan_not_found") {
      return "Google Play 상품 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
    }
  }

  return "결제창을 열지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

function logNativeCheckout(event: string, details: Record<string, string | boolean | number> = {}) {
  console.info(`[ChartRadar billing] ${event}`, details);
}

function scopeCopy(scope: BillingPageScope) {
  if (scope === "crypto") {
    return {
      eyebrow: "COIN PRO",
      title: "Coin Pro에서 열리는 판단 근거",
      body: "Basic은 오늘 결론과 핵심 리스크를 먼저 보여주고, Coin Pro는 코인 홈·현물·선물의 추적 조건, 무효화 기준, 세부 리스크까지 엽니다."
    };
  }

  if (scope === "stocks") {
    return {
      eyebrow: "GLOBAL PRO",
      title: "Global Pro에서 열리는 판단 근거",
      body: "Basic은 미국장 30초 체크와 핵심 리스크를 보여주고, Global Pro는 먼저 볼 자산, 세부 근거, 지수선물·매크로·섹터 해석까지 엽니다."
    };
  }

  return {
    eyebrow: "ALL MARKET PRO",
    title: "Pro에서 열리는 판단 근거",
    body: "Basic은 오늘 결론과 핵심 리스크를 확인하는 흐름입니다. Pro는 추적 조건, 무효화 기준, 세부 근거를 열어 코인과 미국장을 함께 판단하도록 돕습니다."
  };
}

function checkoutCtaLabel(plan: BillingPlan, nativePurchaseAvailable: boolean) {
  if (!nativePurchaseAvailable) return "Android 앱에서 결제 가능";
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

const planDepthRows: Array<{ label: string; value: string; detail: string; tone: ValueCardTone }> = [
  {
    label: "Basic",
    value: "오늘 결론",
    detail: "오늘 시장 상태, 핵심 리스크, 일부 후보를 먼저 확인합니다.",
    tone: "locked"
  },
  {
    label: "Coin Pro",
    value: "코인 상세 판단",
    detail: "코인 홈, 현물, 메이저 선물, 알트 선물의 추적 조건과 무효화 기준을 엽니다.",
    tone: "info"
  },
  {
    label: "Global Pro",
    value: "미국장 상세 판단",
    detail: "미국장 30초 체크 이후 먼저 볼 자산, 리스크 해석, 세부 근거를 엽니다.",
    tone: "info"
  },
  {
    label: "All Market Pro",
    value: "통합 판단 흐름",
    detail: "코인 리스크와 미국장 리스크를 함께 보는 가장 넓은 Pro 범위입니다.",
    tone: "watch"
  }
];

const proUnlockItems: Array<{ icon: LucideIcon; title: string; detail: string }> = [
  {
    icon: Gauge,
    title: "추적 조건",
    detail: "오늘 결론 뒤에 어떤 조건을 다시 확인해야 하는지 코인과 글로벌 화면에서 더 자세히 봅니다."
  },
  {
    icon: ShieldAlert,
    title: "무효화 기준",
    detail: "후보나 시나리오를 계속 볼지 낮춰 볼지 판단하는 기준을 분리해서 확인합니다."
  },
  {
    icon: BookOpen,
    title: "세부 리스크",
    detail: "변동성, 체결 흐름, 매크로 압력, 섹터와 대장주 흐름을 첫 결론 아래에서 나눠 봅니다."
  },
  {
    icon: Bell,
    title: "알림·복기 연결",
    detail: "확인 조건을 알림과 복기 흐름으로 이어가며 같은 기준으로 다시 점검합니다."
  }
];

const preSubscriptionNotes = [
  "Pro는 판단 보조 범위를 넓히는 구독이며 특정 거래 권유가 아닙니다.",
  "확인 조건과 세부 리스크를 더 자세히 보여주지만 결과를 보장하지 않습니다.",
  "가격과 시장 데이터는 제공처, 갱신 주기, 실제 거래 화면에 따라 차이가 날 수 있습니다.",
  "최종 판단과 책임은 사용자 본인에게 있습니다."
];

function ValueCard({
  label,
  value,
  detail,
  tone = "info"
}: {
  label: string;
  value: string;
  detail: string;
  tone?: ValueCardTone;
}) {
  return (
    <PanelCard variant="flat" padding="none" className="border-t border-ui-line py-4">
      <StatusPill tone={tone}>{label}</StatusPill>
      <p className="mt-2 text-base font-semibold leading-6 text-ui-text [word-break:keep-all]">{value}</p>
      <p className="mt-2 text-ui-body leading-6 text-ui-muted [word-break:keep-all]">{detail}</p>
    </PanelCard>
  );
}

function ProUnlocksSection() {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader
        eyebrow="PRO UNLOCKS"
        title="Pro에서 열리는 것"
        description="가격보다 먼저 확인할 것은 Pro가 여는 판단 깊이입니다. 새 기능을 과장하지 않고, 이미 연결된 판단 보조 흐름을 기준으로 정리합니다."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {proUnlockItems.map((item) => {
          const Icon = item.icon;
          return (
            <PanelCard key={item.title} variant="flat" padding="none" className="border-t border-ui-line py-4">
              <Icon size={18} className="text-ui-brand" aria-hidden />
              <h3 className="mt-3 text-sm font-semibold text-ui-text">{item.title}</h3>
              <p className="mt-2 text-ui-body leading-6 text-ui-muted [word-break:keep-all]">{item.detail}</p>
            </PanelCard>
          );
        })}
      </div>
    </section>
  );
}

function PlanCard({
  plan,
  isBusy,
  isCurrent,
  nativePurchaseAvailable,
  priceLabel,
  message,
  busyStageText,
  onCheckout
}: {
  plan: BillingPlan;
  isBusy: boolean;
  isCurrent: boolean;
  nativePurchaseAvailable: boolean;
  priceLabel: string;
  message?: { tone: "info" | "error"; text: string };
  busyStageText?: string;
  onCheckout: (plan: BillingPlan) => void;
}) {
  const hasMonthlyValue = plan.monthlyValue > 0 && plan.billingPeriodMonths > 1;

  return (
    <AppSurface
      as="article"
      tone={plan.marketScope === "bundle" ? "elevated" : "panel"}
      variant="flat"
      padding="none"
      className="flex h-full min-w-0 flex-col border-t border-ui-line py-5"
    >
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

      <AppSurface tone="inset" variant="list" padding="none" className="mt-4 border-y border-ui-line py-2">
        <MetricRow label="시장" value={<span className="block max-w-[9rem] whitespace-normal break-keep">{plan.limits.markets}</span>} />
        <MetricRow label="레이더" value={<span className="block max-w-[9rem] whitespace-normal break-keep">{plan.limits.radarScans}</span>} />
        <MetricRow label="관심목록" value={<span className="block max-w-[9rem] whitespace-normal break-keep">{plan.limits.watchlist}</span>} />
        <MetricRow label="알림" value={<span className="block max-w-[9rem] whitespace-normal break-keep">{plan.limits.alerts}</span>} />
      </AppSurface>

      <div className="mt-auto pt-5">
        <ActionButton tone="primary" onClick={() => onCheckout(plan)} disabled={isBusy} className="w-full whitespace-normal break-keep px-2 text-center leading-5 min-[360px]:px-3">
          {isBusy ? <Loader2 className="mr-2 animate-spin" size={16} aria-hidden /> : null}
          {checkoutCtaLabel(plan, nativePurchaseAvailable)}
        </ActionButton>
        {isBusy && busyStageText ? (
          <AppSurface tone="inset" variant="report" padding="md" className="mt-3 text-ui-muted">
            <StatusPill tone="info">결제 진행</StatusPill>
            <p className="mt-2 text-ui-body font-semibold [word-break:keep-all]">{busyStageText}</p>
          </AppSurface>
        ) : null}
        {message ? (
          <AppSurface tone="inset" variant="report" padding="md" className={`mt-3 ${message.tone === "error" ? "text-ui-short" : "text-ui-muted"}`}>
            <StatusPill tone={message.tone === "error" ? "risk" : "info"}>{message.tone === "error" ? "확인 필요" : "결제 상태"}</StatusPill>
            <p className="mt-2 text-ui-body font-semibold [word-break:keep-all]">{message.text}</p>
          </AppSurface>
        ) : null}
      </div>
    </AppSurface>
  );
}

export function ProPricingPanel({ marketScope = "all" }: { marketScope?: BillingPageScope } = {}) {
  const { session, user, profile, isLoading } = useSupabaseAuth();
  const [checkoutState, setCheckoutState] = useState<CheckoutState>({ status: "idle" });
  const [nativePriceLabels, setNativePriceLabels] = useState<Partial<Record<BillingPlanId, string>>>({});
  const checkoutRunRef = useRef(0);
  const isMountedRef = useRef(true);
  const lastNativeStageRef = useRef<NativePurchaseStageEvent | undefined>(undefined);
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
  const plansDescription = nativePurchaseAvailable
    ? "표시된 가격과 결제 버튼은 기존 플랜 정보를 그대로 사용합니다. 필요한 시장 범위만 선택하세요."
    : "표시된 가격은 앱 구독 기준입니다. 웹 결제는 준비 중이며 Android 앱에서 Google Play 구독으로 결제할 수 있습니다.";

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      checkoutRunRef.current += 1;
    };
  }, []);

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
    if (!nativePurchaseAvailable) {
      setCheckoutState({ status: "message", tone: "info", text: WEB_CHECKOUT_UNAVAILABLE_MESSAGE, planId: plan.id });
      return;
    }

    if (isLoading) {
      setCheckoutState({ status: "message", tone: "info", text: "계정 상태를 확인하고 있습니다. 잠시 후 다시 눌러 주세요." });
      return;
    }

    if (!session?.accessToken) {
      setCheckoutState({ status: "message", tone: "info", text: "결제 후 Pro 기능을 바로 이용하려면 먼저 구글 로그인이 필요합니다. 로그인 후 다시 결제를 시작해 주세요." });
      return;
    }

    const checkoutRunId = checkoutRunRef.current + 1;
    checkoutRunRef.current = checkoutRunId;
    lastNativeStageRef.current = undefined;
    setCheckoutState({ status: "loading", planId: plan.id, stageText: "결제 단계: Android 결제 요청을 시작합니다." });
    logNativeCheckout("native purchase start", { planId: plan.id });
    const handleNativeStage = (event: NativePurchaseStageEvent) => {
      lastNativeStageRef.current = event;
      if (!isMountedRef.current || checkoutRunRef.current !== checkoutRunId) return;
      setCheckoutState((current) => {
        if (current.status !== "loading" || current.planId !== plan.id) return current;
        return { ...current, stageText: nativeStageText(event) };
      });
    };

    try {
      if (!user?.id) throw new Error("앱 구독을 연결하려면 로그인 정보를 먼저 확인해야 합니다.");
      const result = await withTimeout(
        purchaseNativePlan({ plan, userId: user.id, accessToken: session.accessToken, onStage: handleNativeStage }),
        NATIVE_CHECKOUT_TIMEOUT_MS,
        NATIVE_CHECKOUT_TIMEOUT_MESSAGE
      );
      if (!isMountedRef.current || checkoutRunRef.current !== checkoutRunId) return;
      logNativeCheckout("native purchase success", { planId: plan.id });
      setCheckoutState({ status: "message", tone: "info", text: result.message, planId: plan.id });
    } catch (error) {
      if (!isMountedRef.current || checkoutRunRef.current !== checkoutRunId) return;
      const isTimeout = error instanceof NativeCheckoutTimeoutError;
      logNativeCheckout(isTimeout ? "native purchase timeout" : "native purchase error", {
        planId: plan.id,
        timeout: isTimeout,
        errorCode: error instanceof NativePurchaseError ? error.code : "unknown"
      });
      setCheckoutState({ status: "message", tone: "error", text: nativeCheckoutErrorMessage(error, lastNativeStageRef.current), planId: plan.id });
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
      <AppSurface tone="panel" variant="flat" padding="none" className="border-b border-ui-line py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <SectionHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.body} />
          <StatusPill tone={session ? "info" : "locked"} className="self-start">{currentPlanLabel}</StatusPill>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="border-t border-ui-line pt-3">
            <StatusPill tone="locked">Basic</StatusPill>
            <p className="mt-2 text-sm font-semibold leading-6 text-ui-text [word-break:keep-all]">오늘 결론과 핵심 리스크를 먼저 확인</p>
          </div>
          <div className="border-t border-ui-line pt-3">
            <StatusPill tone="info">Pro</StatusPill>
            <p className="mt-2 text-sm font-semibold leading-6 text-ui-text [word-break:keep-all]">추적 조건, 무효화 기준, 세부 근거까지 확인</p>
          </div>
          <div className="border-t border-ui-line pt-3">
            <StatusPill tone="watch" icon={Sparkles}>All Market</StatusPill>
            <p className="mt-2 text-sm font-semibold leading-6 text-ui-text [word-break:keep-all]">코인과 미국장을 함께 보는 통합 판단 흐름</p>
          </div>
        </div>
      </AppSurface>

      <section className="flex flex-col gap-3">
        <SectionHeader
          eyebrow="BASIC VS PRO"
          title="가격보다 먼저 보는 차이"
          description="Basic은 첫 판단을 빠르게 보여주고, Pro는 그 판단이 왜 나왔는지와 언제 다시 봐야 하는지를 더 깊게 엽니다."
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {planDepthRows.map((item) => (
            <ValueCard key={item.label} label={item.label} value={item.value} detail={item.detail} tone={item.tone} />
          ))}
        </div>
      </section>

      <ProUnlocksSection />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <PanelCard variant="flat" padding="none" className="border-t border-ui-line py-5">
          <SectionHeader
            eyebrow="CURRENT PLAN"
            title="현재 이용 상태"
            description="로그인된 계정에서 지금 열려 있는 시장 범위를 확인합니다."
          />
          <div className="mt-4">
            <DataRow label="현재 플랜" value={currentPlanLabel} detail={session ? "구독 권한은 계정 기준으로 적용됩니다." : "결제 전 Google 로그인이 필요합니다."} />
            <DataRow label="코인 Pro" value={<AccessValue open={hasCryptoAccess} />} detail="BTC/ETH, 알트 추적 조건, 무효화 기준." />
            <DataRow label="글로벌 Pro" value={<AccessValue open={hasGlobalAccess} />} detail="미국장 30초 체크, 지수선물, 매크로 압력." />
          </div>
          {freePlan ? (
            <ActionButton href="/crypto/home" tone="secondary" className="mt-4 w-full">
              Basic으로 먼저 둘러보기
            </ActionButton>
          ) : null}
        </PanelCard>

        <PanelCard variant="flat" padding="none" className="border-t border-ui-line py-5">
          <SectionHeader
            eyebrow="WHY ALL MARKET"
            title="All Market Pro가 자연스러운 경우"
            description="코인만 보거나 미국장만 보는 날도 있지만, 리스크가 커지는 날에는 두 시장을 같이 확인하는 편이 판단 흐름이 더 끊기지 않습니다."
          />
          <div className="mt-4">
            <DataRow label="코인 리스크" value="Coin Pro" detail="코인 홈, 현물, 메이저 선물, 알트 선물의 세부 조건을 확인합니다." />
            <DataRow label="미국장 리스크" value="Global Pro" detail="지수선물, 달러·금리, 섹터와 대장주 흐름을 확인합니다." />
            <DataRow label="통합 판단" value="All Market" detail="두 시장이 같은 방향으로 리스크를 키우는지 함께 확인합니다." />
          </div>
        </PanelCard>
      </div>

      {checkoutState.status === "message" ? (
        <AppSurface tone="inset" variant="report" padding="md" className={checkoutState.tone === "error" ? "text-ui-short" : "text-ui-muted"}>
          <StatusPill tone={checkoutState.tone === "error" ? "risk" : "info"}>{checkoutState.tone === "error" ? "확인 필요" : "결제 상태"}</StatusPill>
          <p className="mt-2 text-ui-body font-semibold [word-break:keep-all]">{checkoutState.text}</p>
        </AppSurface>
      ) : null}

      <div className="flex flex-col gap-3">
        <SectionHeader eyebrow="AVAILABLE PLANS" title="현재 플랜과 가격 선택" description={plansDescription} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {paidPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isBusy={checkoutState.status === "loading" && checkoutState.planId === plan.id}
              isCurrent={currentPlanId === plan.id}
              nativePurchaseAvailable={nativePurchaseAvailable}
              priceLabel={nativePriceLabels[plan.id] ?? plan.priceLabel}
              busyStageText={checkoutState.status === "loading" && checkoutState.planId === plan.id ? checkoutState.stageText : undefined}
              message={checkoutState.status === "message" && checkoutState.planId === plan.id ? { tone: checkoutState.tone, text: checkoutState.text } : undefined}
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

      <PanelCard variant="flat" padding="none" className="border-t border-ui-line py-5">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-ui-brand" aria-hidden />
          <h3 className="text-ui-title font-semibold text-ui-text">구독 전 확인할 점</h3>
        </div>
        <ul className="mt-3 space-y-2 text-ui-body text-ui-muted">
          {preSubscriptionNotes.map((note) => (
            <li key={note} className="flex gap-2 [word-break:keep-all]">
              <span className="text-ui-subtle" aria-hidden>·</span>
              <span>{note}</span>
            </li>
          ))}
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
