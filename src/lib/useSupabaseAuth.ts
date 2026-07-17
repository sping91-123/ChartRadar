"use client";

import { useEffect, useState } from "react";
import { resolveEffectiveEntitlement, type EffectiveEntitlementState } from "@/lib/effectiveEntitlement";
import { logOutNativePurchases, refreshNativeEntitlement } from "@/lib/mobilePurchases";
import { nativeGoogleSignOut } from "@/lib/nativeGoogleSignIn";
import {
  clearSupabaseSession,
  fetchSupabaseAccountDeletionRequest,
  fetchSupabaseActiveSubscriptions,
  fetchSupabaseProfile,
  fetchSupabaseUser,
  getSupabaseSession,
  refreshSupabaseSession,
  saveSupabaseSession,
  signOutSupabaseSession,
  supabaseAuthRefreshEvent,
  type SupabaseProfile,
  type SupabaseSession,
  type SupabaseUser
} from "@/lib/supabase";

const entitlementRefreshIntervalMs = 30 * 1000;

function profileWithEffectivePlan(
  user: SupabaseUser,
  profile: SupabaseProfile | null,
  plan: SupabaseProfile["plan"]
): SupabaseProfile {
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
    plan,
    created_at: profile?.created_at ?? now,
    updated_at: profile?.updated_at ?? now
  };
}

export function useSupabaseAuth() {
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<SupabaseProfile | null>(null);
  const [entitlementState, setEntitlementState] = useState<EffectiveEntitlementState>("anonymous");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let isRefreshing = false;

    async function loadAuth() {
      const baseSession = getSupabaseSession();
      if (!baseSession) return null;
      const now = Math.floor(Date.now() / 1000);
      const activeSession = baseSession.expiresAt && baseSession.expiresAt <= now
        ? await refreshSupabaseSession(baseSession)
        : baseSession;
      if (!activeSession) return null;

      const nextUser = await fetchSupabaseUser(activeSession.accessToken);
      const identifiedSession = activeSession.userId === nextUser.id
        ? activeSession
        : { ...activeSession, userId: nextUser.id };
      if (identifiedSession !== activeSession) saveSupabaseSession(identifiedSession);
      const nextProfilePromise = fetchSupabaseProfile(activeSession.accessToken).catch(() => null);
      let effective;
      try {
        const [subscriptions, deletionRequest] = await Promise.all([
          fetchSupabaseActiveSubscriptions(activeSession.accessToken, nextUser.id),
          fetchSupabaseAccountDeletionRequest(activeSession.accessToken, nextUser.id)
        ]);
        effective = resolveEffectiveEntitlement({
          isAuthenticated: true,
          isAdmin: nextUser.app_metadata?.role === "admin",
          subscriptions,
          deletionPending: Boolean(deletionRequest)
        });
      } catch {
        effective = resolveEffectiveEntitlement({
          isAuthenticated: true,
          isAdmin: nextUser.app_metadata?.role === "admin",
          unavailable: true
        });
      }

      return {
        session: identifiedSession,
        user: nextUser,
        profile: profileWithEffectivePlan(nextUser, await nextProfilePromise, effective.plan),
        state: effective.state
      };
    }

    function applyAuthResult(result: Awaited<ReturnType<typeof loadAuth>>) {
      if (!isMounted) return;
      if (!result) {
        setSession(null);
        setUser(null);
        setProfile(null);
        setEntitlementState("anonymous");
        return;
      }
      setSession(result.session);
      setUser(result.user);
      setProfile(result.profile);
      setEntitlementState(result.state);
      void refreshNativeEntitlement({
        userId: result.user.id,
        accessToken: result.session.accessToken
      }).catch(() => undefined);
    }

    function refreshAuth({ silent = false }: { silent?: boolean } = {}) {
      if (isRefreshing) return;
      isRefreshing = true;
      if (!silent) setIsLoading(true);
      loadAuth()
        .then(applyAuthResult)
        .catch(() => {
          clearSupabaseSession();
          applyAuthResult(null);
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

  async function signOut() {
    const accessToken = session?.accessToken ?? getSupabaseSession()?.accessToken ?? "";
    clearSupabaseSession();
    setSession(null);
    setUser(null);
    setProfile(null);
    setEntitlementState("anonymous");
    await Promise.allSettled([
      signOutSupabaseSession(accessToken, "local"),
      nativeGoogleSignOut(),
      logOutNativePurchases()
    ]);
  }

  return { session, user, profile, entitlementState, isLoading, signOut };
}
