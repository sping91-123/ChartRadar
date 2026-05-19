// 웹 Kakao 로그인 버튼을 렌더링하고 Android 앱에서는 숨깁니다.
"use client";

import { useEffect, useState } from "react";
import { isAndroidNativeApp } from "@/lib/nativeGoogleSignIn";
import { isKakaoOAuthConfigured } from "@/lib/supabase";

const authReturnToStorageKey = "chartRadar.auth.returnTo";

function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/crypto";
  return value;
}

export function KakaoLoginButton({ returnTo = "/crypto" }: { returnTo?: string }) {
  const configured = isKakaoOAuthConfigured();
  const [isAndroidApp, setIsAndroidApp] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setIsAndroidApp(isAndroidNativeApp());
  }, []);

  const startKakaoLogin = () => {
    if (!configured) {
      setMessage("Kakao 로그인 설정이 아직 연결되지 않았습니다.");
      return;
    }

    const destination = safeReturnTo(returnTo);
    window.sessionStorage.setItem(authReturnToStorageKey, destination);
    window.location.href = `/api/auth/kakao/start?returnTo=${encodeURIComponent(destination)}`;
  };

  if (isAndroidApp) return null;

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={startKakaoLogin}
        className="mx-auto flex h-10 w-full max-w-[360px] items-center justify-center rounded border border-[#e5d200] bg-[#FEE500] px-4 text-[14px] font-medium text-[#191919] shadow-none transition hover:bg-[#f6dc00] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!configured}
      >
        <span className="inline-flex items-center justify-center gap-2">
          <span className="text-[17px] font-black leading-none" aria-hidden>
            K
          </span>
          <span>Kakao 계정으로 계속하기</span>
        </span>
      </button>
      {!configured ? (
        <p className="text-center text-xs font-semibold leading-5 text-slate-400">
          Kakao REST API 키를 설정하면 Kakao 로그인을 사용할 수 있습니다.
        </p>
      ) : null}
      {message ? <p className="text-center text-xs font-semibold leading-5 text-slate-400">{message}</p> : null}
    </div>
  );
}
