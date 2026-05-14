// 서비스 운영 상태와 주요 출시 준비 항목을 확인하는 헬스체크 API입니다.
import { NextResponse } from "next/server";
import { paidBillingPlans } from "@/lib/billing";
import { getMacroCalendarPayload } from "@/lib/macroCalendar";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const macroStaleAfterHours = 12;

function hasValue(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function hoursSince(iso: string) {
  const updatedAt = Date.parse(iso);
  if (!Number.isFinite(updatedAt)) return null;
  return Math.max(0, Math.round(((Date.now() - updatedAt) / (60 * 60 * 1000)) * 10) / 10);
}

function getDirectPaymentUrl(planId: string) {
  const paymentUrlByPlan: Record<string, string | undefined> = {
    crypto_monthly: process.env.NEXT_PUBLIC_CRYPTO_MONTHLY_PAYMENT_URL,
    crypto_yearly: process.env.NEXT_PUBLIC_CRYPTO_YEARLY_PAYMENT_URL,
    stocks_monthly: process.env.NEXT_PUBLIC_GLOBAL_MONTHLY_PAYMENT_URL ?? process.env.NEXT_PUBLIC_STOCKS_MONTHLY_PAYMENT_URL,
    stocks_yearly: process.env.NEXT_PUBLIC_GLOBAL_YEARLY_PAYMENT_URL ?? process.env.NEXT_PUBLIC_STOCKS_YEARLY_PAYMENT_URL,
    bundle_monthly: process.env.NEXT_PUBLIC_BUNDLE_MONTHLY_PAYMENT_URL,
    bundle_yearly: process.env.NEXT_PUBLIC_BUNDLE_YEARLY_PAYMENT_URL
  };

  return paymentUrlByPlan[planId] ?? "";
}

function getFallbackPaymentUrl(planId: string) {
  return (
    (planId.endsWith("_yearly")
      ? process.env.NEXT_PUBLIC_PRO_YEARLY_PAYMENT_URL
      : process.env.NEXT_PUBLIC_PRO_MONTHLY_PAYMENT_URL) ??
    process.env.NEXT_PUBLIC_PRO_PAYMENT_URL ??
    ""
  );
}

function scoreLaunchReadiness(checks: Record<string, boolean>) {
  const weights = {
    supabasePublic: 15,
    supabaseAdmin: 15,
    aiProvider: 12,
    siteUrl: 10,
    macroReady: 14,
    webPaymentProvider: 12,
    webPaymentLinks: 8,
    androidBilling: 10,
    iosBilling: 4
  };

  return Object.entries(weights).reduce((score, [key, weight]) => score + (checks[key] ? weight : 0), 0);
}

export async function GET() {
  const macroCalendarPayload = await getMacroCalendarPayload();
  const macroAgeHours = hoursSince(macroCalendarPayload.updatedAt);
  const hasGroq = hasValue(process.env.GROQ_API_KEY);
  const hasGemini = hasValue(process.env.GEMINI_API_KEY);
  const hasTossSecret = hasValue(process.env.TOSS_PAYMENTS_SECRET_KEY);
  const hasTossClient = hasValue(process.env.NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY);
  const hasRevenueCatAndroid = hasValue(process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY);
  const hasRevenueCatIos = hasValue(process.env.NEXT_PUBLIC_REVENUECAT_IOS_API_KEY);
  const hasRevenueCatRest = hasValue(process.env.REVENUECAT_REST_API_KEY);
  const hasSupabaseAdmin = hasValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hasSupabaseUrl = hasValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasSupabaseKey = hasValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const hasSiteUrl = hasValue(getConfiguredSiteUrl());
  const hasAIProvider = hasGroq || hasGemini;
  const hasPaymentProvider = hasTossSecret && hasTossClient;
  const hasAppPaymentProvider = hasRevenueCatRest && hasSupabaseAdmin && (hasRevenueCatAndroid || hasRevenueCatIos);
  const hasAndroidBillingProvider = hasRevenueCatAndroid && hasRevenueCatRest && hasSupabaseAdmin;
  const hasIosBillingProvider = hasRevenueCatIos && hasRevenueCatRest && hasSupabaseAdmin;
  const planPaymentLinks = paidBillingPlans.map((plan) => {
    const directUrl = getDirectPaymentUrl(plan.id);
    const fallbackUrl = getFallbackPaymentUrl(plan.id);
    const usesFallback = !hasValue(directUrl) && hasValue(fallbackUrl);

    return {
      planId: plan.id,
      name: plan.name,
      configured: hasValue(directUrl) || usesFallback,
      productSpecific: hasValue(directUrl),
      usesFallback
    };
  });
  const paymentLinksReady = planPaymentLinks.every((item) => item.configured);
  const missingPlanPaymentLinks = planPaymentLinks.filter((item) => !item.configured).map((item) => item.planId);
  const fallbackPlanPaymentLinks = planPaymentLinks.filter((item) => item.usesFallback).map((item) => item.planId);
  const isMacroStale = macroAgeHours === null ? true : macroAgeHours > macroStaleAfterHours;
  const hasAutomaticMacroRefresh = macroCalendarPayload.isAutomatic;
  const macroReady = hasAutomaticMacroRefresh && !isMacroStale;
  const coreReady = hasSupabaseUrl && hasSupabaseKey && hasAIProvider && macroReady;
  const readyForWebPaidLaunch = coreReady && hasSiteUrl && hasPaymentProvider && paymentLinksReady;
  const readyForAndroidLaunch = coreReady && hasSiteUrl && hasAndroidBillingProvider;
  const readyForIosLaunch = coreReady && hasSiteUrl && hasIosBillingProvider;
  const readyForPaidLaunch = readyForWebPaidLaunch || readyForAndroidLaunch || readyForIosLaunch;
  const launchScore = scoreLaunchReadiness({
    supabasePublic: hasSupabaseUrl && hasSupabaseKey,
    supabaseAdmin: hasSupabaseAdmin,
    aiProvider: hasAIProvider,
    siteUrl: hasSiteUrl,
    macroReady,
    webPaymentProvider: hasPaymentProvider,
    webPaymentLinks: paymentLinksReady,
    androidBilling: hasAndroidBillingProvider,
    iosBilling: hasIosBillingProvider
  });
  const blockingActions = [
    hasSiteUrl
      ? null
      : {
          area: "public_url",
          label: "공개 URL 설정",
          env: "NEXT_PUBLIC_SITE_URL",
          reason: "결제 성공, 약관, 개인정보처리방침, 앱스토어 심사 링크가 같은 도메인을 바라봐야 합니다."
        },
    hasPaymentProvider || hasAndroidBillingProvider || hasIosBillingProvider
      ? null
      : {
          area: "payment_provider",
          label: "결제 제공자 연결",
          env: "TOSS_PAYMENTS_SECRET_KEY 또는 REVENUECAT_REST_API_KEY",
          reason: "유료 결제 확인과 Pro 권한 반영은 서버에서 검증해야 합니다."
        },
    readyForWebPaidLaunch || paymentLinksReady || readyForAndroidLaunch || readyForIosLaunch
      ? null
      : {
          area: "web_payment_links",
          label: "플랜별 결제 링크 설정",
          env: "NEXT_PUBLIC_CRYPTO_MONTHLY_PAYMENT_URL 등",
          reason: "웹에서 요금제를 누르면 실제 결제창으로 이동해야 합니다."
        },
    macroReady
      ? null
      : {
          area: "macro_calendar",
          label: "매크로 일정 자동 갱신",
          env: "공개 경제 캘린더 또는 공식 통계 데이터",
          reason: "매크로 일정이 오래되면 첫 화면 신뢰도가 떨어집니다."
        }
  ].filter((item): item is { area: string; label: string; env: string; reason: string } => Boolean(item));
  const warnings = [
    hasSupabaseUrl && hasSupabaseKey ? null : "로그인 연결 정보가 아직 준비되지 않았습니다.",
    hasAIProvider ? null : "AI 제공자가 아직 연결되지 않았습니다.",
    hasSiteUrl ? null : "서비스 공개 URL이 아직 설정되지 않았습니다.",
    hasPaymentProvider || hasAppPaymentProvider ? null : "웹 결제 또는 앱 구독 결제 도구가 아직 연결되지 않았습니다.",
    paymentLinksReady || readyForAndroidLaunch || readyForIosLaunch ? null : `플랜별 결제 링크가 아직 비어 있습니다. ${missingPlanPaymentLinks.join(", ")}`,
    fallbackPlanPaymentLinks.length === 0 ? null : `공용 결제 링크로 대체 연결되는 플랜이 있습니다. ${fallbackPlanPaymentLinks.join(", ")}`,
    !macroReady ? "매크로 자동 캘린더 연결 상태를 확인해 주세요." : null
  ].filter((item): item is string => Boolean(item));

  return NextResponse.json({
    ok: coreReady,
    service: "chart-radar",
    status: readyForPaidLaunch ? "ready" : coreReady ? "degraded" : "attention_required",
    readyForPaidLaunch,
    launchScore,
    checkedAt: new Date().toISOString(),
    runtime: "nextjs",
    warnings,
    blockingActions,
    checks: {
      supabasePublic: hasSupabaseUrl && hasSupabaseKey,
      siteUrl: hasSiteUrl,
      aiProvider: hasGroq ? "groq" : hasGemini ? "gemini" : "not-configured",
      paymentProvider: hasPaymentProvider ? "toss-payments" : "not-configured",
      appBillingProvider: hasAppPaymentProvider ? "revenuecat" : "not-configured",
      readyForWebPaidLaunch,
      readyForAndroidLaunch,
      readyForIosLaunch,
      macroProvider: macroCalendarPayload.source,
      macroAutomaticRefresh: hasAutomaticMacroRefresh,
      paymentLinksReady,
      planPaymentLinks,
      appBilling: {
        androidPublicKey: hasRevenueCatAndroid,
        iosPublicKey: hasRevenueCatIos,
        revenueCatRest: hasRevenueCatRest,
        supabaseAdmin: hasSupabaseAdmin
      }
    },
    macroCalendar: {
      updatedAtIso: macroCalendarPayload.updatedAt,
      ageHours: macroAgeHours,
      automatic: macroCalendarPayload.isAutomatic,
      stale: isMacroStale,
      staleAfterHours: macroStaleAfterHours,
      sourceLabel: macroCalendarPayload.sourceLabel
    }
  });
}
