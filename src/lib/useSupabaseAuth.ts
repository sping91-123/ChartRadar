"use client";

import { useEffect, useState } from "react";
import {
  clearSupabaseSession,
  fetchSupabaseProfile,
  fetchSupabaseUser,
  getSupabaseSession,
  refreshSupabaseSession,
  supabaseAuthRefreshEvent,
  type SupabaseProfile,
  type SupabaseSession,
  type SupabaseUser
} from "@/lib/supabase";

export function useSupabaseAuth() {
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<SupabaseProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

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

      return Promise.all([
        fetchSupabaseUser(activeSession.accessToken),
        fetchSupabaseProfile(activeSession.accessToken)
      ]);
    }

    function applyAuthResult(result: Awaited<ReturnType<typeof loadAuth>>) {
        if (!isMounted || !result) return;
        const [nextUser, nextProfile] = result;
        setUser(nextUser);
        setProfile(nextProfile ?? null);
    }

    function handleAuthError() {
        clearSupabaseSession();
        if (!isMounted) return;
        setSession(null);
        setUser(null);
        setProfile(null);
    }

    function refreshAuth() {
      setIsLoading(true);
      loadAuth()
        .then(applyAuthResult)
        .catch(handleAuthError)
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    }

    refreshAuth();
    window.addEventListener(supabaseAuthRefreshEvent, refreshAuth);

    return () => {
      isMounted = false;
      window.removeEventListener(supabaseAuthRefreshEvent, refreshAuth);
    };
  }, []);

  function signOut() {
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
