"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { parseSessionFromHash, saveSupabaseSession } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("로그인 정보를 확인하는 중입니다.");
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    const session = parseSessionFromHash(window.location.hash);
    if (!session) {
      setMessage("로그인 토큰을 찾지 못했습니다. Supabase OAuth 설정의 Redirect URL을 확인하세요.");
      return;
    }

    saveSupabaseSession(session);
    setMessage("로그인이 완료됐습니다. 잠시 후 복기 페이지로 이동합니다.");
    setIsDone(true);

    const id = window.setTimeout(() => {
      window.location.href = "/journal?sync=1";
    }, 900);

    return () => window.clearTimeout(id);
  }, []);

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <section className="w-full max-w-md rounded-lg border border-surface-line bg-surface-card p-5 text-center shadow-glow">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg border border-accent-blue/25 bg-accent-blue/10 text-accent-blue">
          {isDone ? <CheckCircle2 size={24} aria-hidden /> : <Loader2 className="animate-spin" size={24} aria-hidden />}
        </div>
        <h1 className="mt-5 text-xl font-black text-white">코털스 로그인</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">{message}</p>
        {!isDone ? (
          <Link
            href="/login"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md border border-surface-line bg-surface-cardSoft px-4 text-sm font-bold text-slate-200"
          >
            로그인으로 돌아가기
          </Link>
        ) : null}
      </section>
    </main>
  );
}
