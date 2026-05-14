"use client";

import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { getOAuthUrl, isSupabaseConfigured } from "@/lib/supabase";

export default function LoginPage() {
  const configured = isSupabaseConfigured();

  function startLogin(provider: "google") {
    const url = getOAuthUrl(provider);
    if (!url) return;
    window.location.href = url;
  }

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white">
          <ArrowLeft size={16} aria-hidden />
          Chart Radar로 돌아가기
        </Link>

        <section className="rounded-lg border border-surface-line bg-surface-card p-5 shadow-glow">
          <div className="grid h-12 w-12 place-items-center rounded-lg border border-accent-blue/25 bg-accent-blue/10 text-accent-blue">
            <KeyRound size={24} aria-hidden />
          </div>
          <h1 className="mt-5 text-2xl font-black text-white">Chart Radar 로그인</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            복기, Pro 이용, 레이더 알림을 한 계정에서 이어 쓰기 위한 로그인입니다.
          </p>

          {!configured ? (
            <div className="mt-5 rounded-md border border-signal-warning/25 bg-signal-warning/10 p-3 text-sm leading-6 text-signal-warning">
              로그인을 잠시 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.
            </div>
          ) : null}

          <div className="mt-6 grid gap-3">
            <button
              type="button"
              disabled={!configured}
              onClick={() => startLogin("google")}
              className="inline-flex min-h-12 items-center justify-center gap-3 rounded-md border border-white/10 bg-white px-4 text-sm font-black text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="grid h-5 w-5 place-items-center" aria-hidden>
                <svg viewBox="0 0 24 24" className="h-5 w-5">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z" />
                </svg>
              </span>
              구글로 계속하기
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
