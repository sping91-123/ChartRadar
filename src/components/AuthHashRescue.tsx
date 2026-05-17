"use client";
// OAuth 토큰이 콜백이 아닌 화면에 붙어 돌아온 경우 세션을 복구한다.
import { useEffect } from "react";
import { parseSessionFromHash, saveSupabaseSession } from "@/lib/supabase";

const authReturnToStorageKey = "chartRadar.auth.returnTo";
const skipSplashAfterAuthKey = "chartRadar.skipSplashAfterAuth.v1";

function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export function AuthHashRescue() {
  useEffect(() => {
    if (!window.location.hash.includes("access_token=")) return;

    const session = parseSessionFromHash(window.location.hash);
    if (!session) return;

    saveSupabaseSession(session);
    const returnTo = safeReturnTo(window.sessionStorage.getItem(authReturnToStorageKey)) ?? "/crypto";
    window.sessionStorage.removeItem(authReturnToStorageKey);
    window.sessionStorage.setItem(skipSplashAfterAuthKey, "true");
    window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
    window.location.replace(returnTo);
  }, []);

  return null;
}
