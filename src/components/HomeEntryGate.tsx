"use client";
// 홈 첫 진입에서 짧은 스플래시와 로그인 선택 흐름을 제공합니다.

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bitcoin, TrendingUp } from "lucide-react";
import { getSupabaseSession, isGoogleOAuthConfigured } from "@/lib/supabase";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

const basicBrowseKey = "chartRadar.basicBrowse.v1";
const authReturnToStorageKey = "chartRadar.auth.returnTo";
const skipSplashAfterAuthKey = "chartRadar.skipSplashAfterAuth.v1";
const brandLetters = Array.from("Chart Radar");

const marketEntries = [
  {
    title: "코인 레이더",
    scope: "비트코인 및 이더리움 · 알트코인",
    href: "/crypto",
    icon: Bitcoin,
    iconFrame: "rounded-2xl border-white/10 bg-slate-950/60",
    iconRing: "rounded-full border-cyan-200/25 bg-cyan-300/10",
    accent: "text-cyan-200",
    glow: "from-cyan-300/16"
  },
  {
    title: "글로벌 레이더",
    scope: "미국주식·ETF·해외선물",
    href: "/global",
    icon: TrendingUp,
    iconFrame: "rounded-2xl border-white/10 bg-slate-950/60",
    iconRing: null,
    accent: "text-emerald-200",
    glow: "from-emerald-300/16"
  }
] as const;

function BrandMark({ size = "default" }: { size?: "default" | "large" }) {
  const frameSize = size === "large" ? "h-20 w-20" : "h-14 w-14";
  const imageSize = size === "large" ? 80 : 56;

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-slate-950 shadow-[0_0_34px_rgba(34,211,238,0.18)] ${frameSize}`}>
      <Image
        src="/brand/chart-radar-mark.png"
        alt=""
        width={imageSize}
        height={imageSize}
        priority
        className="h-full w-full object-cover"
        draggable={false}
      />
    </div>
  );
}

function SplashBrandMark() {
  return (
    <div className="relative h-32 w-32 sm:h-36 sm:w-36" aria-hidden>
      <Image
        src="/brand/chart-radar-icon.png"
        alt=""
        width={144}
        height={144}
        priority
        className="h-full w-full object-cover opacity-80 mix-blend-screen drop-shadow-[0_0_28px_rgba(34,211,238,0.22)]"
        style={{
          WebkitMaskImage: "radial-gradient(circle, black 34%, rgba(0,0,0,0.86) 46%, transparent 70%)",
          maskImage: "radial-gradient(circle, black 34%, rgba(0,0,0,0.86) 46%, transparent 70%)"
        }}
        draggable={false}
      />
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
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <section className="flex flex-col items-center gap-5 text-center">
        <SplashBrandMark />
        <div>
          <p className="mb-2 text-sm font-bold text-cyan-200">근거를 포착해, 방향을 더 선명하게</p>
          <AnimatedBrandText />
        </div>
      </section>
    </main>
  );
}

function LoginPrompt({ onBrowseBasic, onGoogleLogin, configured }: { onBrowseBasic: () => void; onGoogleLogin: () => void; configured: boolean }) {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-6 sm:px-6 sm:py-8">
      <section className="enterprise-panel w-full max-w-md rounded-2xl p-5 text-center sm:p-8">
        <div className="flex flex-col items-center gap-5">
          <p className="text-center text-sm font-semibold leading-6 text-slate-300">
            로그인하면 관심 종목, 알림, 복기 페이지 등을
            <br />
            같은 계정에서 이어서 사용할 수 있습니다.
          </p>
          <div className="grid w-full gap-2">
            <button
              type="button"
              disabled={!configured}
              onClick={onGoogleLogin}
              className="inline-flex min-h-11 items-center justify-center gap-3 rounded-lg border border-white/10 bg-white px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="grid h-5 w-5 place-items-center" aria-hidden>
                <svg viewBox="0 0 24 24" className="h-5 w-5">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z" />
                </svg>
              </span>
              Google로 계속하기
            </button>
            <button
              type="button"
              onClick={onBrowseBasic}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-black text-slate-100 transition hover:border-cyan-300/35 hover:bg-white/[0.07]"
            >
              로그인 없이 둘러보기
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function MarketSelector() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-6 sm:px-6 sm:py-8">
      <section className="enterprise-panel w-full max-w-5xl rounded-2xl p-5 sm:p-8 lg:p-10">
        <div className="flex flex-col items-center gap-9">
          <header className="flex w-full flex-col items-center gap-4 text-center">
            <div className="flex items-center justify-center gap-3">
              <BrandMark />
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Chart Radar</h1>
            </div>

            <p className="max-w-2xl text-sm font-semibold leading-relaxed text-slate-200 sm:text-base">
              오늘 시장의 방향성과 핵심 대응 포인트를 한눈에 제공합니다.
            </p>
          </header>

          <div className="grid w-full gap-4 md:grid-cols-2">
            {marketEntries.map(({ title, scope, href, icon: Icon, iconFrame, iconRing, accent, glow }) => (
              <Link
                key={title}
                href={href}
                className="group relative grid min-h-[14rem] place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-6 text-center transition hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-white/[0.055] hover:shadow-[0_22px_60px_rgba(0,0,0,0.22)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:min-h-[16rem]"
              >
                <div className={`absolute inset-x-0 top-0 h-28 bg-gradient-to-b ${glow} to-transparent`} aria-hidden />
                <div className="relative flex flex-col items-center gap-4">
                  <div className={`grid h-16 w-16 place-items-center border ${iconFrame} ${accent}`}>
                    {iconRing ? (
                      <div className={`grid h-11 w-11 place-items-center border ${iconRing}`} aria-hidden>
                        <Icon size={26} aria-hidden />
                      </div>
                    ) : (
                      <Icon size={30} aria-hidden />
                    )}
                  </div>
                  <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{title}</h2>
                  <p className="text-xs font-bold text-slate-400">{scope}</p>
                </div>
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
  const [skipSplashAfterAuth, setSkipSplashAfterAuth] = useState(() =>
    typeof window !== "undefined" ? window.sessionStorage.getItem(skipSplashAfterAuthKey) === "true" : false
  );
  const [showSplash, setShowSplash] = useState(() => !skipSplashAfterAuth);
  const [hasStoredSession, setHasStoredSession] = useState(() => (typeof window !== "undefined" ? Boolean(getSupabaseSession()) : false));
  const [basicBrowse, setBasicBrowse] = useState(false);

  useEffect(() => {
    window.localStorage.removeItem(basicBrowseKey);
    setHasStoredSession(Boolean(getSupabaseSession()));
    setBasicBrowse(window.sessionStorage.getItem(basicBrowseKey) === "true");

    if (window.sessionStorage.getItem(skipSplashAfterAuthKey) === "true") {
      window.sessionStorage.removeItem(skipSplashAfterAuthKey);
      setSkipSplashAfterAuth(true);
      setShowSplash(false);
      return;
    }

    const timer = window.setTimeout(() => setShowSplash(false), 700);
    return () => window.clearTimeout(timer);
  }, []);

  const startBasicBrowse = () => {
    window.sessionStorage.setItem(basicBrowseKey, "true");
    setBasicBrowse(true);
  };

  const startGoogleLogin = () => {
    window.sessionStorage.setItem(authReturnToStorageKey, "/");
    window.location.href = "/login?returnTo=%2F";
  };

  if (showSplash) {
    return <SplashScreen />;
  }

  if (isLoading && (skipSplashAfterAuth || hasStoredSession)) {
    return <MarketSelector />;
  }

  if (!user && !basicBrowse) {
    return <LoginPrompt onBrowseBasic={startBasicBrowse} onGoogleLogin={startGoogleLogin} configured={isGoogleOAuthConfigured()} />;
  }

  return <MarketSelector />;
}
