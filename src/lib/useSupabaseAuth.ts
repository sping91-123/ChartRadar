"use client";

import { useEffect, useState } from "react";
import { resolveCombinedBillingEntitlementPlan } from "@/lib/billing";
import { nativeGoogleSignOut } from "@/lib/nativeGoogleSignIn";
import {
  clearSupabaseSession,
  fetchSupabaseActiveSubscriptions,
  fetchSupabaseProfile,
  fetchSupabaseUser,
  getSupabaseSession,
  refreshSupabaseSession,
  supabaseAuthRefreshEvent,
  type SupabaseProfile,
  type SupabaseSession,
  type SupabaseSubscription,
  type SupabaseUser
} from "@/lib/supabase";

const supabaseMetadataPlans = new Set<SupabaseProfile["plan"]>([
  "free",
  "member",
  "premium",
  "admin",
  "crypto_monthly",
  "crypto_yearly",
  "stocks_monthly",
  "stocks_yearly",
  "bundle_monthly",
  "bundle_yearly"
]);
const entitlementRefreshIntervalMs = 30 * 1000;

function resolveSupabaseMetadataPlan(user: SupabaseUser): SupabaseProfile["plan"] | null {
  const plan = user.app_metadata?.plan;
  if (typeof plan === "string" && supabaseMetadataPlans.has(plan as SupabaseProfile["plan"])) {
    return plan as SupabaseProfile["plan"];
  }
  return user.app_metadata?.role === "admin" ? "admin" : null;
}

function resolveActiveSubscriptionPlan(subscriptions: SupabaseSubscription[]): SupabaseProfile["plan"] | null {
  const plan = resolveCombinedBillingEntitlementPlan(
    subscriptions.map((subscription) => subscription.plan),
    "all"
  );
  return plan === "free" ? null : plan;
}

function resolveLegacyPaidPlan(plan: SupabaseProfile["plan"] | null | undefined) {
  return plan === "member" || plan === "premium" ? plan : null;
}

function applySupabaseAuthEntitlement(
  user: SupabaseUser,
  profile: SupabaseProfile | null,
  subscriptions: SupabaseSubscription[]
): SupabaseProfile | null {
  const metadataPlan = resolveSupabaseMetadataPlan(user);
  const activePlan = resolveActiveSubscriptionPlan(subscriptions);
  const profilePlan = profile?.plan ?? null;
  const resolvedPlan =
    metadataPlan === "admin"
      ? "admin"
      : profilePlan === "admin"
        ? "admin"
        : activePlan ?? resolveLegacyPaidPlan(metadataPlan) ?? resolveLegacyPaidPlan(profilePlan);

  if (!resolvedPlan) {
    return profile ? { ...profile, plan: "free" as SupabaseProfile["plan"] } : profile;
  }

  const now = new Date().toISOString();
  return {
    id: user.id,
    email: user.email ?? profile?.email ?? null,
    display_name:
      profile?.display_name ??
      user.user_metadata?.name ??
      user.user_metadata?.full_name ??
      user.user_metadata?.nickname ??
      user.user_metadata?.preferred_username ??
      null,
    avatar_url: profile?.avatar_url ?? user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    plan: resolvedPlan,
    created_at: profile?.created_at ?? now,
    updated_at: profile?.updated_at ?? now
  } satisfies SupabaseProfile;
}

export function useSupabaseAuth() {
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<SupabaseProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let isRefreshing = false;

    async function loadAuth() {
      const baseSession = getSupabaseSession();

      if (!baseSession) {
        if (isMounted) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setIsLoading(false);
        }
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      const activeSession =
        baseSession.expiresAt && baseSession.expiresAt <= now
          ? await refreshSupabaseSession(baseSession)
          : baseSession;

      if (!activeSession) {
        if (isMounted) {
          setSession(null);
          setIsLoading(false);
        }
        return;
      }

      if (isMounted) setSession(activeSession);

      const nextUser = await fetchSupabaseUser(activeSession.accessToken);
      const [nextProfile, nextSubscriptions] = await Promise.all([
        fetchSupabaseProfile(activeSession.accessToken).catch(() => null),
        fetchSupabaseActiveSubscriptions(activeSession.accessToken, nextUser.id).catch(() => [])
      ]);

      return [nextUser, nextProfile, nextSubscriptions] as const;
    }

    function applyAuthResult(result: Awaited<ReturnType<typeof loadAuth>>) {
        if (!isMounted || !result) return;
        const [nextUser, nextProfile, nextSubscriptions] = result;
        setUser(nextUser);
        setProfile(applySupabaseAuthEntitlement(nextUser, nextProfile ?? null, nextSubscriptions));
    }

    function handleAuthError() {
        clearSupabaseSession();
        if (!isMounted) return;
        setSession(null);
        setUser(null);
        setProfile(null);
    }

    function refreshAuth({ silent = false }: { silent?: boolean } = {}) {
      if (isRefreshing) return;
      isRefreshing = true;
      if (!silent) setIsLoading(true);
      loadAuth()
        .then(applyAuthResult)
        .catch(() => {
          if (!silent) handleAuthError();
        })
        .finally(() => {
          isRefreshing = false;
          if (isMounted && !silent) setIsLoading(false);
        });
    }

    refreshAuth();
    const handleRefreshEvent = () => refreshAuth();
    const handleFocusRefresh = () => refreshAuth({ silent: true });
    const handleVisibilityRefresh = () => {
      if (document.visibilityState === "visible") refreshAuth({ silent: true });
    };
    const intervalId = window.setInterval(() => refreshAuth({ silent: true }), entitlementRefreshIntervalMs);

    window.addEventListener(supabaseAuthRefreshEvent, handleRefreshEvent);
    window.addEventListener("focus", handleFocusRefresh);
    document.addEventListener("visibilitychange", handleVisibilityRefresh);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener(supabaseAuthRefreshEvent, handleRefreshEvent);
      window.removeEventListener("focus", handleFocusRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityRefresh);
    };
  }, []);

  function signOut() {
    void nativeGoogleSignOut();
    clearSupabaseSession();
    setSession(null);
    setUser(null);
    setProfile(null);
  }

  return {
    session,
    user,
    profile,
    isLoading,
    signOut
  };
}
