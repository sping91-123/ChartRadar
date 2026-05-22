"use client";
// 홈 첫 진입에서 짧은 스플래시와 로그인 선택 흐름을 제공합니다.

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bitcoin, TrendingUp } from "lucide-react";
import { GoogleLoginButton } from "@/components/GoogleLoginButton";
import { KakaoLoginButton } from "@/components/KakaoLoginButton";
import { getSupabaseSession } from "@/lib/supabase";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

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
  const frameSize = size === "large" ? "h-20 w-20" : "h-12 w-12 sm:h-14 sm:w-14";
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
    <main className="grid h-[100dvh] max-h-[100dvh] place-items-center overflow-hidden px-4">
      <section className="flex -translate-y-[3dvh] flex-col items-center gap-5 text-center">
        <SplashBrandMark />
        <div>
          <p className="mb-2 text-sm font-bold text-cyan-200">근거를 포착해, 방향을 더 선명하게</p>
          <AnimatedBrandText />
        </div>
      </section>
    </main>
  );
}

function LoginPrompt({ onBrowseBasic }: { onBrowseBasic: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center overflow-hidden px-3 py-6 sm:px-6 sm:py-8">
      <section className="enterprise-panel w-[calc(100vw-1.5rem)] max-w-md rounded-2xl p-4 text-center sm:w-full sm:p-8">
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
      <section className="enterprise-panel max-h-full w-[calc(100vw-1.5rem)] max-w-5xl overflow-hidden rounded-2xl p-3 sm:w-full sm:p-6 lg:p-10">
        <div className="flex min-h-0 flex-col items-center gap-3 sm:gap-6 lg:gap-9">
          <header className="flex w-full shrink-0 flex-col items-center gap-1.5 text-center sm:gap-4">
            <div className="flex items-center justify-center gap-2 sm:gap-3">
              <BrandMark />
              <h1 className="text-xl font-black tracking-tight text-white sm:text-4xl">Chart Radar</h1>
            </div>

            <p className="max-w-2xl text-xs font-semibold leading-snug text-slate-200 sm:text-base sm:leading-relaxed">
              오늘 시장의 방향성과 핵심 대응 포인트를 한눈에 제공합니다.
            </p>
          </header>

          <div className="grid min-h-0 w-full flex-1 gap-2.5 sm:gap-4 md:grid-cols-2">
            {marketEntries.map(({ title, scope, href, icon: Icon, iconFrame, iconRing, accent, glow }) => (
              <Link
                key={title}
                href={href}
                className="group relative grid min-h-[7.25rem] place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-center transition hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-white/[0.055] hover:shadow-[0_22px_60px_rgba(0,0,0,0.22)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:min-h-[12rem] sm:p-6 md:min-h-[16rem]"
              >
                <div className={`absolute inset-x-0 top-0 h-28 bg-gradient-to-b ${glow} to-transparent`} aria-hidden />
                <div className="relative flex flex-col items-center gap-2 sm:gap-4">
                  <div className={`grid h-11 w-11 place-items-center border sm:h-16 sm:w-16 ${iconFrame} ${accent}`}>
                    {iconRing ? (
                      <div className={`grid h-7 w-7 place-items-center border sm:h-11 sm:w-11 ${iconRing}`} aria-hidden>
                        <Icon size={22} aria-hidden className="sm:hidden" />
                        <Icon size={26} aria-hidden className="hidden sm:block" />
                      </div>
                    ) : (
                      <>
                        <Icon size={24} aria-hidden className="sm:hidden" />
                        <Icon size={30} aria-hidden className="hidden sm:block" />
                      </>
                    )}
                  </div>
                  <h2 className="text-xl font-black tracking-tight text-white sm:text-4xl">{title}</h2>
                  <p className="text-[11px] font-bold leading-tight text-slate-400 sm:text-xs">{scope}</p>
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

    const timer = window.setTimeout(() => setShowSplash(false), 700);
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
