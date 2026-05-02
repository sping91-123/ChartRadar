"use client";

import { useEffect, useState } from "react";
import {
  clearSupabaseSession,
  fetchSupabaseProfile,
  fetchSupabaseUser,
  getSupabaseSession,
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
    const nextSession = getSupabaseSession();
    setSession(nextSession);

    if (!nextSession) {
      setIsLoading(false);
      return;
    }

    Promise.all([
      fetchSupabaseUser(nextSession.accessToken),
      fetchSupabaseProfile(nextSession.accessToken)
    ])
      .then(([nextUser, nextProfile]) => {
        setUser(nextUser);
        setProfile(nextProfile);
      })
      .catch(() => {
        clearSupabaseSession();
        setSession(null);
        setUser(null);
        setProfile(null);
      })
      .finally(() => setIsLoading(false));
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
