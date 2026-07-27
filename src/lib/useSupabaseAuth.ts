"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
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
  isSupabaseSessionInvalidError,
  refreshSupabaseSession,
  saveSupabaseSession,
  shouldRefreshSupabaseSession,
  signOutSupabaseSession,
  supabaseAuthRefreshEvent,
  type SupabaseProfile,
  type SupabaseSession,
  type SupabaseUser
} from "@/lib/supabase";

const entitlementRefreshIntervalMs = 30 * 1000;
const transientAuthRetryMs = 5 * 1000;

interface SupabaseAuthContextValue {
  session: SupabaseSession | null;
  user: SupabaseUser | null;
  profile: SupabaseProfile | null;
  entitlementState: EffectiveEntitlementState;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

interface LoadedAuth {
  session: SupabaseSession;
  user: SupabaseUser;
  profile: SupabaseProfile;
  state: EffectiveEntitlementState;
}

const SupabaseAuthContext = createContext<SupabaseAuthContextValue | null>(null);

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

async function loadSupabaseAuth(): Promise<LoadedAuth | null> {
  const baseSession = getSupabaseSession();
  if (!baseSession) return null;

  let activeSession = baseSession;
  if (shouldRefreshSupabaseSession(baseSession)) {
    const refreshedSession = await refreshSupabaseSession(baseSession);
    if (!refreshedSession) return null;
    activeSession = refreshedSession;
  }

  let nextUser: SupabaseUser;
  try {
    nextUser = await fetchSupabaseUser(activeSession.accessToken);
  } catch (error) {
    if (!isSupabaseSessionInvalidError(error) || !activeSession.refreshToken) throw error;

    const refreshedSession = await refreshSupabaseSession(activeSession);
    if (!refreshedSession) return null;
    activeSession = refreshedSession;
    nextUser = await fetchSupabaseUser(activeSession.accessToken);
  }

  const identifiedSession = activeSession.userId === nextUser.id
    ? activeSession
    : { ...activeSession, userId: nextUser.id };
  if (identifiedSession !== activeSession) saveSupabaseSession(identifiedSession);

  const nextProfilePromise = fetchSupabaseProfile(
    identifiedSession.accessToken,
    nextUser
  ).catch(() => null);

  let effective;
  try {
    const [subscriptions, deletionRequest] = await Promise.all([
      fetchSupabaseActiveSubscriptions(identifiedSession.accessToken, nextUser.id),
      fetchSupabaseAccountDeletionRequest(identifiedSession.accessToken, nextUser.id)
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

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<SupabaseProfile | null>(null);
  const [entitlementState, setEntitlementState] = useState<EffectiveEntitlementState>("anonymous");
  const [isLoading, setIsLoading] = useState(true);
  const authRevisionRef = useRef(0);
  const userRef = useRef<SupabaseUser | null>(null);

  useEffect(() => {
    let isMounted = true;
    let isRefreshing = false;
    let refreshQueued = false;
    let retryTimerId: number | null = null;

    function applyAuthResult(result: LoadedAuth | null, revision: number) {
      if (!isMounted || revision !== authRevisionRef.current) return;
      if (!result) {
        userRef.current = null;
        setSession(null);
        setUser(null);
        setProfile(null);
        setEntitlementState("anonymous");
        setIsLoading(false);
        return;
      }
      userRef.current = result.user;
      setSession(result.session);
      setUser(result.user);
      setProfile(result.profile);
      setEntitlementState(result.state);
      setIsLoading(false);
      void refreshNativeEntitlement({
        userId: result.user.id,
        accessToken: result.session.accessToken
      }).catch(() => undefined);
    }

    function scheduleTransientRetry() {
      if (retryTimerId !== null) return;
      retryTimerId = window.setTimeout(() => {
        retryTimerId = null;
        void refreshAuth({ silent: true });
      }, transientAuthRetryMs);
    }

    async function refreshAuth({ silent = false }: { silent?: boolean } = {}) {
      if (isRefreshing) {
        refreshQueued = true;
        return;
      }

      isRefreshing = true;
      const revision = authRevisionRef.current;
      if (!silent) setIsLoading(true);

      try {
        const result = await loadSupabaseAuth();
        if (retryTimerId !== null) {
          window.clearTimeout(retryTimerId);
          retryTimerId = null;
        }
        applyAuthResult(result, revision);
      } catch (error) {
        if (!isMounted || revision !== authRevisionRef.current) return;

        const storedSession = getSupabaseSession();
        if (isSupabaseSessionInvalidError(error) || !storedSession) {
          clearSupabaseSession();
          applyAuthResult(null, revision);
        } else {
          setSession(storedSession);
          setEntitlementState("unavailable");
          setIsLoading(userRef.current === null);
          scheduleTransientRetry();
        }
      } finally {
        isRefreshing = false;
        if (isMounted && refreshQueued) {
          refreshQueued = false;
          void refreshAuth({ silent: true });
        }
      }
    }

    void refreshAuth();
    const handleRefreshEvent = () => void refreshAuth();
    const handleFocusRefresh = () => void refreshAuth({ silent: true });
    const handleVisibilityRefresh = () => {
      if (document.visibilityState === "visible") void refreshAuth({ silent: true });
    };
    const intervalId = window.setInterval(
      () => void refreshAuth({ silent: true }),
      entitlementRefreshIntervalMs
    );
    window.addEventListener(supabaseAuthRefreshEvent, handleRefreshEvent);
    window.addEventListener("focus", handleFocusRefresh);
    document.addEventListener("visibilitychange", handleVisibilityRefresh);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      if (retryTimerId !== null) window.clearTimeout(retryTimerId);
      window.removeEventListener(supabaseAuthRefreshEvent, handleRefreshEvent);
      window.removeEventListener("focus", handleFocusRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityRefresh);
    };
  }, []);

  const signOut = useCallback(async () => {
    authRevisionRef.current += 1;
    userRef.current = null;
    const accessToken = session?.accessToken ?? getSupabaseSession()?.accessToken ?? "";
    clearSupabaseSession();
    setSession(null);
    setUser(null);
    setProfile(null);
    setEntitlementState("anonymous");
    setIsLoading(false);
    await Promise.allSettled([
      signOutSupabaseSession(accessToken, "local"),
      nativeGoogleSignOut(),
      logOutNativePurchases()
    ]);
  }, [session?.accessToken]);

  const value = useMemo<SupabaseAuthContextValue>(
    () => ({ session, user, profile, entitlementState, isLoading, signOut }),
    [entitlementState, isLoading, profile, session, signOut, user]
  );

  return createElement(SupabaseAuthContext.Provider, { value }, children);
}

export function useSupabaseAuth() {
  const context = useContext(SupabaseAuthContext);
  if (!context) {
    throw new Error("useSupabaseAuth must be used within SupabaseAuthProvider.");
  }
  return context;
}
