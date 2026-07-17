"use client";

import { useEffect, useState } from "react";
import { safeReturnTo } from "@/lib/authRedirect";
import { isIosNativeApp, nativeAppleSignIn } from "@/lib/nativeAppleSignIn";

const authReturnToStorageKey = "chartRadar.auth.returnTo";

export function AppleLoginButton({ returnTo = "/crypto" }: { returnTo?: string }) {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => setAvailable(isIosNativeApp()), []);
  if (!available) return null;

  async function signIn() {
    setBusy(true);
    setMessage("");
    const destination = safeReturnTo(returnTo);
    try {
      window.sessionStorage.setItem(authReturnToStorageKey, destination);
      await nativeAppleSignIn();
      window.location.href = destination;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Apple 로그인에 실패했습니다.");
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button type="button" onClick={signIn} disabled={busy} className="mx-auto flex h-11 w-full max-w-[360px] items-center justify-center rounded bg-white px-4 text-sm font-bold text-black disabled:opacity-60">
         Apple로 로그인
      </button>
      {message ? <p className="text-center text-xs text-signal-warning" aria-live="polite">{message}</p> : null}
    </div>
  );
}
