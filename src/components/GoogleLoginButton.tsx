// Google Identity Services 버튼으로 Supabase 세션을 만듭니다.
"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { getNativeGoogleSignInErrorMessage, isAndroidNativeApp, nativeGoogleSignIn } from "@/lib/nativeGoogleSignIn";
import { exchangeGoogleIdToken, googleOAuthClientId, isGoogleOAuthConfigured } from "@/lib/supabase";

const authReturnToStorageKey = "chartRadar.auth.returnTo";
const skipSplashAfterAuthKey = "chartRadar.skipSplashAfterAuth.v1";

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdentityOptions {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  nonce?: string;
}

interface GoogleButtonOptions {
  logo_alignment?: "center" | "left";
  shape?: "pill" | "rectangular" | "circle" | "square";
  size?: "large" | "medium" | "small";
  text?: "continue_with" | "signin" | "signin_with" | "signup_with";
  theme?: "filled_black" | "filled_blue" | "outline";
  type?: "icon" | "standard";
  width?: number;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(options: GoogleIdentityOptions): void;
          renderButton(parent: HTMLElement, options: GoogleButtonOptions): void;
        };
      };
    };
  }
}

function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/crypto";
  return value;
}

function createNonce() {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashNonce(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function GoogleLoginButton({ returnTo = "/crypto" }: { returnTo?: string }) {
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const nonceRef = useRef("");
  const [platform, setPlatform] = useState<"unknown" | "android" | "web">("unknown");
  const [scriptReady, setScriptReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [message, setMessage] = useState("");
  const configured = isGoogleOAuthConfigured();

  const finishLogin = useCallback(async (response: GoogleCredentialResponse) => {
    if (!response.credential) {
      setMessage("Google 로그인 정보를 받지 못했습니다. 다시 시도해 주세요.");
      return;
    }

    setIsSigningIn(true);
    setMessage("로그인 정보를 확인하고 있습니다.");

    try {
      await exchangeGoogleIdToken(response.credential, nonceRef.current);
      const destination = safeReturnTo(window.sessionStorage.getItem(authReturnToStorageKey));
      window.sessionStorage.removeItem(authReturnToStorageKey);
      window.sessionStorage.setItem(skipSplashAfterAuthKey, "true");
      window.location.href = destination;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google 로그인 처리에 실패했습니다.");
      setIsSigningIn(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPlatform(isAndroidNativeApp() ? "android" : "web");
    window.sessionStorage.setItem(authReturnToStorageKey, safeReturnTo(returnTo));
    if (window.google?.accounts.id) setScriptReady(true);
  }, [returnTo]);

  useEffect(() => {
    if (!configured || !scriptReady || !googleButtonRef.current || !window.google?.accounts.id) return;

    let cancelled = false;

    async function renderGoogleButton() {
      try {
        if (!window.crypto?.subtle) throw new Error("현재 브라우저에서 보안 로그인 기능을 사용할 수 없습니다.");
        const nonce = createNonce();
        const hashedNonce = await hashNonce(nonce);
        if (cancelled || !googleButtonRef.current || !window.google?.accounts.id) return;
        nonceRef.current = nonce;
        googleButtonRef.current.innerHTML = "";
        window.google.accounts.id.initialize({
          client_id: googleOAuthClientId,
          callback: finishLogin,
          nonce: hashedNonce
        });
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          logo_alignment: "center",
          shape: "rectangular",
          size: "large",
          text: "continue_with",
          theme: "outline",
          type: "standard",
          width: Math.min(360, googleButtonRef.current.clientWidth || 360)
        });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Google 로그인 버튼을 준비하지 못했습니다.");
      }
    }

    renderGoogleButton();

    return () => {
      cancelled = true;
    };
  }, [configured, finishLogin, scriptReady]);

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
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => setMessage("Google 로그인 스크립트를 불러오지 못했습니다.")}
      />
      {!configured ? (
        <div className="rounded-xl border border-signal-warning/25 bg-signal-warning/10 p-3 text-sm leading-6 text-signal-warning">
          로그인 설정이 아직 연결되지 않았습니다. 잠시 후 다시 시도해 주세요.
        </div>
      ) : null}
      <div className="mx-auto flex min-h-10 w-full max-w-[360px] justify-center overflow-hidden rounded border border-transparent">
        <div
          ref={googleButtonRef}
          aria-hidden={!configured}
          className={configured ? "min-h-10 w-full" : "hidden"}
        />
      </div>
      {isSigningIn ? <p className="text-center text-xs font-bold text-accent-blue">로그인 처리 중입니다.</p> : null}
      {message ? <p className="text-center text-xs font-semibold leading-5 text-slate-400">{message}</p> : null}
    </div>
  );
}
