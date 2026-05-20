// Google 로그인 버튼을 렌더링하고, Android 앱에서는 네이티브 로그인을 사용합니다.
"use client";

import { useEffect, useState } from "react";
import { getNativeGoogleSignInErrorMessage, isAndroidNativeApp, nativeGoogleSignIn } from "@/lib/nativeGoogleSignIn";
import { isGoogleOAuthConfigured, supabaseUrl } from "@/lib/supabase";

const authReturnToStorageKey = "chartRadar.auth.returnTo";
const skipSplashAfterAuthKey = "chartRadar.skipSplashAfterAuth.v1";

function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/crypto";
  return value;
}

export function GoogleLoginButton({ returnTo = "/crypto" }: { returnTo?: string }) {
  const [platform, setPlatform] = useState<"unknown" | "android" | "web">("unknown");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [message, setMessage] = useState("");
  const configured = isGoogleOAuthConfigured();

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(authReturnToStorageKey, safeReturnTo(returnTo));

    let attempts = 0;
    let timer: number | undefined;

    function detectPlatform() {
      if (isAndroidNativeApp()) {
        setPlatform("android");
        return;
      }

      attempts += 1;
      if (attempts < 12) {
        timer = window.setTimeout(detectPlatform, 100);
        return;
      }

      setPlatform("web");
    }

    detectPlatform();

    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [returnTo]);

  async function startNativeGoogleLogin() {
    if (!configured) {
      setMessage("로그인 설정이 아직 연결되지 않았습니다.");
      return;
    }

    setIsSigningIn(true);
    setMessage("Google 계정 선택창을 여는 중입니다.");
    try {
      await nativeGoogleSignIn();
      const destination = safeReturnTo(window.sessionStorage.getItem(authReturnToStorageKey));
      window.sessionStorage.removeItem(authReturnToStorageKey);
      window.sessionStorage.setItem(skipSplashAfterAuthKey, "true");
      window.location.href = destination;
    } catch (error) {
      setMessage(getNativeGoogleSignInErrorMessage(error));
      setIsSigningIn(false);
    }
  }

  function startWebGoogleLogin() {
    if (!configured || !supabaseUrl) {
      setMessage("로그인 설정이 아직 연결되지 않았습니다.");
      return;
    }

    const destination = safeReturnTo(returnTo);
    window.sessionStorage.setItem(authReturnToStorageKey, destination);
    setIsSigningIn(true);
    setMessage("Google 로그인 화면으로 이동합니다.");

    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("returnTo", destination);
    const authorizeUrl = new URL(`${supabaseUrl}/auth/v1/authorize`);
    authorizeUrl.searchParams.set("provider", "google");
    authorizeUrl.searchParams.set("redirect_to", redirectTo.toString());
    window.location.href = authorizeUrl.toString();
  }

  if (platform !== "web") {
    return (
      <div className="grid gap-2">
        <button
          type="button"
          onClick={startNativeGoogleLogin}
          className="mx-auto flex h-10 w-full max-w-[360px] items-center justify-center rounded border border-[#dadce0] bg-white px-4 text-[14px] font-medium text-[#3c4043] shadow-none transition hover:bg-[#f8fafd] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={platform === "unknown" || !configured || isSigningIn}
        >
          <span className="inline-flex items-center justify-center gap-2">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z" />
            </svg>
            <span>Google 계정으로 계속하기</span>
          </span>
        </button>
        {message ? <p className="text-center text-xs font-semibold leading-5 text-slate-400">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {!configured ? (
        <div className="rounded-xl border border-signal-warning/25 bg-signal-warning/10 p-3 text-sm leading-6 text-signal-warning">
          로그인 설정이 아직 연결되지 않았습니다. 잠시 후 다시 시도해 주세요.
        </div>
      ) : null}
      <button
        type="button"
        onClick={startWebGoogleLogin}
        className="mx-auto flex h-10 w-full max-w-[360px] items-center justify-center rounded border border-[#dadce0] bg-white px-4 text-[14px] font-medium text-[#3c4043] shadow-none transition hover:bg-[#f8fafd] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!configured || isSigningIn}
      >
        <span className="inline-flex items-center justify-center gap-2">
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z" />
          </svg>
          <span>Google 계정으로 계속하기</span>
        </span>
      </button>
      {isSigningIn ? <p className="text-center text-xs font-bold text-accent-blue">로그인 처리 중입니다.</p> : null}
      {message ? <p className="text-center text-xs font-semibold leading-5 text-slate-400">{message}</p> : null}
    </div>
  );
}
