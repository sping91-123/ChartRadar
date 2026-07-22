import { paidBillingPlans } from "@/lib/billing";
import { getMacroCalendarPayload } from "@/lib/macroCalendar";
import { productAnalyticsConfigured } from "@/lib/server/productEventStore";
import {
  isPerpetualRevenueCoreScannerEnabled,
  perpetualRevenueCoreMode
} from "@/lib/server/perpetualRevenueCore";
import { supabaseAdminRest } from "@/lib/server/supabaseAdmin";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";

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
    bundle_yearly: process.env.NEXT_PUBLIC_BUNDLE_6MONTH_PAYMENT_URL
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
    primaryPaymentChannel: 24,
    multiPlatformPayment: 10
  };

  return Object.entries(weights).reduce((score, [key, weight]) => score + (checks[key] ? weight : 0), 0);
}

async function verifySupabaseAdminRest(enabled: boolean) {
  if (!enabled) {
    return {
      ok: false,
      status: "missing_env" as const,
      message: "SUPABASE_SERVICE_ROLE_KEY is not configured."
    };
  }

  try {
    await supabaseAdminRest("profiles?select=id&limit=1");
    await supabaseAdminRest("subscriptions?id=eq.00000000-0000-0000-0000-000000000000", {
      method: "PATCH",
      body: { status: "inactive" }
    });
    await supabaseAdminRest("push_tokens?id=eq.00000000-0000-0000-0000-000000000000", {
      method: "PATCH",
      body: { last_seen_at: new Date().toISOString() }
    });
    await supabaseAdminRest("push_alert_events?select=id&limit=1");

    return {
      ok: true,
      status: "verified" as const,
      message: "Supabase admin REST read/write path is reachable."
    };
  } catch (error) {
    return {
      ok: false,
      status: "failed" as const,
      message: error instanceof Error ? error.message.slice(0, 240) : "Supabase admin REST verification failed."
    };
  }
}

export function getPublicHealthPayload() {
  const hasSupabaseUrl = hasValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasSupabaseKey = hasValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const hasSiteUrl = hasValue(getConfiguredSiteUrl());
  const coreAvailable = hasSupabaseUrl && hasSupabaseKey && hasSiteUrl;

  return {
    ok: coreAvailable,
    service: "chart-radar",
    status: coreAvailable ? "ok" : "attention_required",
    checkedAt: new Date().toISOString(),
    runtime: "nextjs",
    app: {
      name: "Chart Radar"
    },
    availability: {
      publicApi: "available",
      core: coreAvailable ? "available" : "attention_required"
    }
  };
}

export async function getDetailedHealthPayload() {
  const macroCalendarPayload = await getMacroCalendarPayload();
  const macroAgeHours = hoursSince(macroCalendarPayload.updatedAt);
  const hasGroq = hasValue(process.env.GROQ_API_KEY);
  const hasGemini = hasValue(process.env.GEMINI_API_KEY);
  const geminiAiFallbackEnabled = process.env.ENABLE_GEMINI_AI_FALLBACK === "true";
  const hasEnabledGeminiFallback = geminiAiFallbackEnabled && hasGemini;
  const hasTossSecret = hasValue(process.env.TOSS_PAYMENTS_SECRET_KEY);
  const hasTossClient = hasValue(process.env.NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY);
  const hasRevenueCatAndroid = hasValue(process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY);
  const hasRevenueCatIos = hasValue(process.env.NEXT_PUBLIC_REVENUECAT_IOS_API_KEY);
  const hasRevenueCatRest = hasValue(process.env.REVENUECAT_REST_API_KEY);
  const hasSupabaseAdmin = hasValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const supabaseAdminRestCheck = await verifySupabaseAdminRest(hasSupabaseAdmin);
  const hasVerifiedSupabaseAdmin = supabaseAdminRestCheck.ok;
  const hasSupabaseUrl = hasValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasSupabaseKey = hasValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const hasSiteUrl = hasValue(getConfiguredSiteUrl());
  const hasAIProvider = hasGroq || hasEnabledGeminiFallback;
  const hasPaymentProvider = hasTossSecret && hasTossClient;
  const hasAppPaymentProvider = hasRevenueCatRest && hasVerifiedSupabaseAdmin && (hasRevenueCatAndroid || hasRevenueCatIos);
  const hasAndroidBillingProvider = hasRevenueCatAndroid && hasRevenueCatRest && hasVerifiedSupabaseAdmin;
  const hasIosBillingProvider = hasRevenueCatIos && hasRevenueCatRest && hasVerifiedSupabaseAdmin;
  const perpetualMode = perpetualRevenueCoreMode();
  const perpetualMutationEnabled = isPerpetualRevenueCoreScannerEnabled(perpetualMode);
  const hasProductAnalytics = productAnalyticsConfigured();
  const hasCronSecret = hasValue(process.env.CRON_SECRET);
  const hasSharedAiCostGuard = hasValue(process.env.UPSTASH_REDIS_REST_URL) && hasValue(process.env.UPSTASH_REDIS_REST_TOKEN);
  const hasFirebaseServer = hasValue(process.env.FIREBASE_SERVICE_ACCOUNT_JSON) || (
    hasValue(process.env.FIREBASE_PROJECT_ID) &&
    hasValue(process.env.FIREBASE_CLIENT_EMAIL) &&
    hasValue(process.env.FIREBASE_PRIVATE_KEY)
  );
  const perpetualRevenueCoreReady = !perpetualMutationEnabled || (
    hasVerifiedSupabaseAdmin && hasProductAnalytics && hasCronSecret && hasFirebaseServer && hasSharedAiCostGuard && hasAIProvider
  );
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
  const readyForWebCheckout = hasPaymentProvider && paymentLinksReady;
  const readyForAndroidBilling = hasAndroidBillingProvider;
  const readyForIosBilling = hasIosBillingProvider;
  const readyForWebPaidLaunch = coreReady && hasSiteUrl && readyForWebCheckout;
  const readyForAndroidLaunch = coreReady && hasSiteUrl && readyForAndroidBilling && perpetualRevenueCoreReady;
  const readyForIosLaunch = coreReady && hasSiteUrl && readyForIosBilling;
  const readyForPaidLaunch = (readyForWebPaidLaunch || readyForAndroidLaunch || readyForIosLaunch) && perpetualRevenueCoreReady;
  const hasPrimaryPaymentChannel = readyForWebCheckout || readyForAndroidBilling || readyForIosBilling;
  const hasMultiPlatformPayment = readyForWebCheckout || (readyForAndroidBilling && readyForIosBilling);
  const launchScore = scoreLaunchReadiness({
    supabasePublic: hasSupabaseUrl && hasSupabaseKey,
    supabaseAdmin: hasVerifiedSupabaseAdmin,
    aiProvider: hasAIProvider,
    siteUrl: hasSiteUrl,
    macroReady,
    primaryPaymentChannel: hasPrimaryPaymentChannel,
    multiPlatformPayment: hasMultiPlatformPayment
  });
  const blockingActions = [
    hasSiteUrl
      ? null
      : {
          area: "public_url",
          label: "Public URL configuration",
          env: "NEXT_PUBLIC_SITE_URL",
          reason: "Checkout success, legal pages, and store review links should resolve to the same production domain."
        },
    hasPaymentProvider || hasAndroidBillingProvider || hasIosBillingProvider
      ? null
      : {
          area: "payment_provider",
          label: "Payment provider connection",
          env: "TOSS_PAYMENTS_SECRET_KEY or REVENUECAT_REST_API_KEY",
          reason: "Paid purchase verification and Pro entitlement updates must be verified on the server."
        },
    readyForWebCheckout || readyForAndroidBilling || readyForIosBilling
      ? null
      : {
          area: "web_payment_links",
          label: "Plan checkout links",
          env: "NEXT_PUBLIC_*_PAYMENT_URL",
          reason: "Paid plan buttons need a working checkout path or app subscription integration."
        },
    macroReady
      ? null
      : {
          area: "macro_calendar",
          label: "Macro calendar refresh",
          env: "Public economic calendar or official statistics source",
          reason: "Stale macro events reduce first-screen trust."
        },
    perpetualRevenueCoreReady
      ? null
      : {
          area: "perpetual_revenue_core",
          label: "Perpetual revenue-core activation",
          env: "PRODUCT_ANALYTICS_HMAC_SECRET, CRON_SECRET, Firebase server credentials, UPSTASH_REDIS_REST_URL/TOKEN",
          reason: "On mode requires measurable product events, an authenticated five-minute Push worker, and a cross-instance AI cost ceiling."
        }
  ].filter((item): item is { area: string; label: string; env: string; reason: string } => Boolean(item));
  const warnings = [
    hasSupabaseUrl && hasSupabaseKey ? null : "Supabase public connection is not fully configured.",
    hasVerifiedSupabaseAdmin ? null : `Supabase admin REST verification failed: ${supabaseAdminRestCheck.message}`,
    hasAIProvider ? null : "AI provider is not configured. The primary provider is Groq.",
    hasGemini && !geminiAiFallbackEnabled ? "Gemini is configured but ENABLE_GEMINI_AI_FALLBACK=true is not set." : null,
    hasSiteUrl ? null : "Public site URL is not configured.",
    hasPaymentProvider || hasAppPaymentProvider ? null : "Web checkout or app subscription provider is not configured.",
    paymentLinksReady || readyForAndroidBilling || readyForIosBilling ? null : `Plan checkout links are missing: ${missingPlanPaymentLinks.join(", ")}`,
    !paymentLinksReady && (readyForAndroidBilling || readyForIosBilling)
      ? "App subscription billing is ready, but web checkout links are still missing."
      : null,
    fallbackPlanPaymentLinks.length === 0 ? null : `Some plans use fallback checkout links: ${fallbackPlanPaymentLinks.join(", ")}`,
    !macroReady ? "Macro calendar automatic refresh requires attention." : null,
    perpetualRevenueCoreReady ? null : "Perpetual revenue core is on without its AI provider, analytics, cron, Firebase, Supabase, or shared AI cost-limit prerequisites."
  ].filter((item): item is string => Boolean(item));

  return {
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
      aiProvider: hasGroq ? "groq" : hasEnabledGeminiFallback ? "gemini-fallback" : "not-configured",
      geminiAiFallbackEnabled,
      paymentProvider: hasPaymentProvider ? "toss-payments" : "not-configured",
      appBillingProvider: hasAppPaymentProvider ? "revenuecat" : "not-configured",
      readyForWebCheckout,
      readyForAndroidBilling,
      readyForIosBilling,
      hasPrimaryPaymentChannel,
      hasMultiPlatformPayment,
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
        supabaseAdmin: hasSupabaseAdmin,
        supabaseAdminRest: supabaseAdminRestCheck
      },
      perpetualRevenueCore: {
        mode: perpetualMode,
        canary: perpetualMode === "shadow" && perpetualMutationEnabled,
        ready: perpetualRevenueCoreReady,
        productAnalyticsHmac: hasProductAnalytics,
        cronSecret: hasCronSecret,
        firebaseServer: hasFirebaseServer,
        sharedAiCostGuard: hasSharedAiCostGuard,
        aiProvider: hasAIProvider
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
  };
}
