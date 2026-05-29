"use client";
// 홈 첫 진입에서 짧은 스플래시와 로그인 선택 흐름을 제공합니다.

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Bitcoin, TrendingUp } from "lucide-react";
import { GoogleLoginButton } from "@/components/GoogleLoginButton";
import { KakaoLoginButton } from "@/components/KakaoLoginButton";
import { getSupabaseSession } from "@/lib/supabase";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

const skipSplashAfterAuthKey = "chartRadar.skipSplashAfterAuth.v1";
const splashDurationMs = 850;
const brandLetters = Array.from("Chart Radar");

const marketEntries = [
  {
    title: "코인 레이더",
    scope: "코인 시장",
    href: "/crypto",
    icon: Bitcoin,
    accent: "text-blue-300"
  },
  {
    title: "글로벌 레이더",
    scope: "해외주식·선물",
    href: "/global",
    icon: TrendingUp,
    accent: "text-slate-300"
  }
] as const;

function BrandMark({ size = "default" }: { size?: "default" | "large" }) {
  const frameSize = size === "large" ? "h-20 w-20" : "h-12 w-12 sm:h-14 sm:w-14";

  return (
    <div className={`grid shrink-0 place-items-center rounded-xl border border-ui-line bg-ui-panel text-2xl font-semibold text-ui-brand ${frameSize}`}>
      C
    </div>
  );
}

function SplashBrandMark() {
  return (
    <div className="grid h-24 w-24 place-items-center rounded-2xl border border-ui-line bg-ui-panel text-4xl font-semibold text-ui-brand sm:h-28 sm:w-28" aria-hidden>
      C
    </div>
  );
}

function AnimatedBrandText() {
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsRevealed(true), 80);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <h1 className="relative inline-block text-3xl font-black tracking-tight text-white sm:text-4xl" aria-label="Chart Radar">
      <span
        aria-hidden
        className="absolute top-0 inline-block transition-all duration-300 ease-out"
        style={{
          left: isRevealed ? "0" : "50%",
          transform: isRevealed ? "translateX(0)" : "translateX(-50%)"
        }}
      >
        C
      </span>
      {brandLetters.map((letter, index) => (
        <span
          key={`${letter}-${index}`}
          aria-hidden
          className="inline-block transition-all duration-300 ease-out"
          style={{
            opacity: index === 0 ? 0 : isRevealed ? 1 : 0,
            transform: index === 0 || isRevealed ? "translateY(0)" : "translateY(0.35rem)",
            transitionDelay: index === 0 ? "0ms" : `${60 + index * 28}ms`,
            width: letter === " " ? "0.32em" : undefined
          }}
        >
          {letter}
        </span>
      ))}
    </h1>
  );
}

function SplashScreen() {
  return (
    <main className="grid h-[100dvh] max-h-[100dvh] place-items-center overflow-hidden px-4">
      <section className="flex -translate-y-[3dvh] flex-col items-center gap-5 text-center">
        <SplashBrandMark />
        <div>
          <p className="mb-2 text-sm font-bold text-slate-300">근거를 포착해, 방향을 더 선명하게</p>
          <AnimatedBrandText />
        </div>
      </section>
    </main>
  );
}

function LoginPrompt({ onBrowseBasic }: { onBrowseBasic: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center overflow-hidden px-3 py-6 sm:px-6 sm:py-8">
      <section className="w-[calc(100vw-1.5rem)] max-w-md border-y border-white/10 py-5 text-center sm:w-full sm:py-8">
        <div className="flex flex-col items-center gap-5">
          <p className="max-w-full text-center text-sm font-semibold leading-6 text-slate-300">
            로그인하면 관심 종목, 알림, 복기 페이지 등을
            <br />
            같은 계정에서 이어서 사용할 수 있습니다.
          </p>
          <div className="grid w-full min-w-0 gap-2 [&>*]:min-w-0">
            <GoogleLoginButton returnTo="/" />
            <KakaoLoginButton returnTo="/" />
            <button
              type="button"
              onClick={onBrowseBasic}
              className="mx-auto grid h-10 w-full max-w-full grid-cols-[40px_1fr_40px] items-center rounded border border-[#dadce0] bg-white px-0 text-[14px] font-medium text-[#3c4043] shadow-none transition hover:bg-[#f8fafd]"
            >
              <span aria-hidden />
              <span className="text-center">로그인 없이 둘러보기</span>
              <span aria-hidden />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function MarketSelector() {
  useEffect(() => {
    document.documentElement.classList.add("market-selection-lock");
    return () => document.documentElement.classList.remove("market-selection-lock");
  }, []);

  return (
    <main className="grid h-[100dvh] max-h-[100dvh] min-h-0 place-items-center overflow-hidden px-3 py-2 sm:px-6 sm:py-6">
      <section className="max-h-full w-full max-w-5xl -translate-y-[6dvh] overflow-visible sm:translate-y-0">
        <div className="flex min-h-0 flex-col items-center gap-5 sm:gap-8 lg:gap-10">
          <header className="flex w-full shrink-0 flex-col items-center gap-1.5 text-center sm:gap-4">
            <div className="flex items-center justify-center gap-2 sm:gap-3">
              <BrandMark />
              <h1 className="text-xl font-black tracking-tight text-white sm:text-4xl">Chart Radar</h1>
            </div>

            <p className="max-w-2xl text-xs font-semibold leading-snug text-slate-200 sm:text-base sm:leading-relaxed">
              오늘 시장의 방향성과 핵심 대응 포인트를 한눈에 제공합니다.
            </p>
          </header>

          <div className="w-full max-w-3xl divide-y divide-white/10 border-y border-white/10">
            {marketEntries.map(({ title, scope, href, icon: Icon, accent }) => (
              <Link
                key={title}
                href={href}
                className="group flex min-h-[5.75rem] items-center justify-between gap-4 px-1 py-4 text-left transition hover:bg-white/[0.025] focus:outline-none focus-visible:bg-white/[0.035] focus-visible:ring-2 focus-visible:ring-ui-brand sm:min-h-[7rem] sm:px-3 sm:py-5"
              >
                <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center sm:h-12 sm:w-12 ${accent}`}>
                    <Icon size={25} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-2xl font-black tracking-tight text-white sm:text-4xl">{title}</h2>
                    <p className="mt-1 text-xs font-bold leading-tight text-slate-400 sm:text-sm">{scope}</p>
                  </div>
                </div>
                <ArrowRight size={20} aria-hidden className="shrink-0 text-slate-500 transition group-hover:translate-x-1 group-hover:text-ui-brand" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export function HomeEntryGate() {
  const { user, isLoading } = useSupabaseAuth();
  const [skipSplashAfterAuth, setSkipSplashAfterAuth] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [hasStoredSession, setHasStoredSession] = useState(false);
  const [basicBrowse, setBasicBrowse] = useState(false);

  useEffect(() => {
    setHasStoredSession(Boolean(getSupabaseSession()));

    if (window.sessionStorage.getItem(skipSplashAfterAuthKey) === "true") {
      window.sessionStorage.removeItem(skipSplashAfterAuthKey);
      setSkipSplashAfterAuth(true);
      setShowSplash(false);
      return;
    }

    const timer = window.setTimeout(() => setShowSplash(false), splashDurationMs);
    return () => window.clearTimeout(timer);
  }, []);

  const startBasicBrowse = () => {
    setBasicBrowse(true);
  };

  if (showSplash) {
    return <SplashScreen />;
  }

  if (isLoading && (skipSplashAfterAuth || hasStoredSession)) {
    return <MarketSelector />;
  }

  if (!user && !basicBrowse) {
    return <LoginPrompt onBrowseBasic={startBasicBrowse} />;
  }

  return <MarketSelector />;
}
