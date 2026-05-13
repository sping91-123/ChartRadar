// 서비스 운영 상태와 주요 설정 신선도를 확인하는 헬스체크 API입니다.
import { NextResponse } from "next/server";
import { macroCalendarUpdatedAtIso } from "@/data/macroEvents";
import { paidBillingPlans } from "@/lib/billing";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const macroStaleAfterHours = 72;

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

export async function GET() {
  const macroAgeHours = hoursSince(macroCalendarUpdatedAtIso);
  const hasGroq = hasValue(process.env.GROQ_API_KEY);
  const hasGemini = hasValue(process.env.GEMINI_API_KEY);
  const hasTossSecret = hasValue(process.env.TOSS_PAYMENTS_SECRET_KEY);
  const hasTossClient = hasValue(process.env.NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY);
  const hasSupabaseUrl = hasValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasSupabaseKey = hasValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const hasSiteUrl = hasValue(getConfiguredSiteUrl());
  const hasAIProvider = hasGroq || hasGemini;
  const hasPaymentProvider = hasTossSecret && hasTossClient;
  const hasMacroAutomation =
    hasValue(process.env.TRADING_ECONOMICS_API_KEY) ||
    (hasValue(process.env.TRADING_ECONOMICS_CLIENT) && hasValue(process.env.TRADING_ECONOMICS_SECRET));
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
  const macroReady = hasMacroAutomation || !isMacroStale;
  const coreReady = hasSupabaseUrl && hasSupabaseKey && hasAIProvider && macroReady;
  const readyForPaidLaunch = coreReady && hasSiteUrl && hasPaymentProvider && paymentLinksReady && hasMacroAutomation;
  const warnings = [
    hasSupabaseUrl && hasSupabaseKey ? null : "Supabase public env is missing.",
    hasAIProvider ? null : "AI provider env is missing.",
    hasSiteUrl ? null : "NEXT_PUBLIC_SITE_URL is missing.",
    hasPaymentProvider ? null : "TossPayments env is missing.",
    paymentLinksReady ? null : `Plan payment links are missing: ${missingPlanPaymentLinks.join(", ")}.`,
    fallbackPlanPaymentLinks.length === 0 ? null : `Shared payment link fallback is used: ${fallbackPlanPaymentLinks.join(", ")}.`,
    hasMacroAutomation ? null : "Trading Economics macro calendar env is missing. Static backup calendar is being used.",
    !hasMacroAutomation && isMacroStale ? "Macro backup calendar is stale." : null
  ].filter((item): item is string => Boolean(item));

  return NextResponse.json({
    ok: coreReady,
    service: "chart-radar",
    status: readyForPaidLaunch ? "ready" : coreReady ? "degraded" : "attention_required",
    readyForPaidLaunch,
    checkedAt: new Date().toISOString(),
    runtime: "nextjs",
    warnings,
    checks: {
      supabasePublic: hasSupabaseUrl && hasSupabaseKey,
      siteUrl: hasSiteUrl,
      aiProvider: hasGroq ? "groq" : hasGemini ? "gemini" : "not-configured",
      paymentProvider: hasPaymentProvider ? "toss-payments" : "not-configured",
      macroProvider: hasMacroAutomation ? "trading-economics" : "curated-backup",
      paymentLinksReady,
      planPaymentLinks
    },
    macroCalendar: {
      updatedAtIso: macroCalendarUpdatedAtIso,
      ageHours: macroAgeHours,
      automatic: hasMacroAutomation,
      stale: !hasMacroAutomation && isMacroStale,
      staleAfterHours: macroStaleAfterHours
    }
  });
}
