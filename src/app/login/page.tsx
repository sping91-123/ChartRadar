"use client";
// 구글 로그인 진입 화면을 렌더링합니다.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GoogleLoginButton } from "@/components/GoogleLoginButton";
import { KakaoLoginButton } from "@/components/KakaoLoginButton";

function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/crypto";
  return value;
}

function readReturnTo() {
  if (typeof window === "undefined") return "/crypto";
  const params = new URLSearchParams(window.location.search);
  return safeReturnTo(params.get("returnTo"));
}

function readLoginError() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");
  const description = params.get("error_description");
  if (!error) return "";
  if (error === "kakao_setup") return "Kakao 로그인 설정이 아직 완료되지 않았습니다.";
  if (description) return `로그인 처리 실패: ${description}`;
  return "로그인 처리 중 문제가 발생했습니다. 다시 시도해 주세요.";
}

export default function LoginPage() {
  const [returnTo, setReturnTo] = useState("/crypto");
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    setReturnTo(readReturnTo());
    setLoginError(readLoginError());
  }, []);

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white">
          <ArrowLeft size={16} aria-hidden />
          Chart Radar로 돌아가기
        </Link>

        <section className="border-y border-surface-line py-5">
          <p className="text-center text-sm font-semibold leading-6 text-slate-300">
            로그인하면 관심 종목, 알림, 복기 페이지 등을
            <br />
            같은 계정에서 이어서 사용할 수 있습니다.
          </p>

          <div className="mt-6">
            <GoogleLoginButton returnTo={returnTo} />
            <div className="mt-2">
              <KakaoLoginButton returnTo={returnTo} />
            </div>
          </div>
          {loginError ? <p className="mt-3 text-center text-xs font-semibold text-signal-warning">{loginError}</p> : null}
        </section>
      </div>
    </main>
  );
}
