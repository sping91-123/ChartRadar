// Google Identity Services 버튼으로 Supabase 세션을 만듭니다.
"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const configured = isGoogleOAuthConfigured();
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const nonceRef = useRef("");
  const [scriptReady, setScriptReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [message, setMessage] = useState("");

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
