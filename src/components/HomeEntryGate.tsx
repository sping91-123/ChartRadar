"use client";
// 홈 첫 진입에서 짧은 스플래시와 로그인 선택 흐름을 제공합니다.

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bitcoin, LogIn, Radar, TrendingUp } from "lucide-react";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

const basicBrowseKey = "chartRadar.basicBrowse.v1";

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
    <div className={`relative overflow-hidden rounded-2xl border border-cyan-300/20 bg-slate-950 shadow-[0_0_34px_rgba(34,211,238,0.18)] ${frameSize}`}>
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

function SplashScreen() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <section className="flex flex-col items-center gap-5 text-center">
        <BrandMark size="large" />
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Chart Radar</h1>
          <p className="mt-2 text-sm font-bold text-slate-400">시장 레이더를 준비 중입니다.</p>
        </div>
      </section>
    </main>
  );
}

function LoginPrompt({ onBrowseBasic }: { onBrowseBasic: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-6 sm:px-6 sm:py-8">
      <section className="enterprise-panel w-full max-w-md rounded-2xl p-5 text-center sm:p-8">
        <div className="flex flex-col items-center gap-5">
          <BrandMark size="large" />
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">Chart Radar</h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">
              로그인하면 관심 종목, 알림, Pro 권한을 같은 계정에서 이어서 사용할 수 있습니다.
            </p>
          </div>
          <div className="grid w-full gap-2">
            <Link
              href="/login?returnTo=%2F"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-cyan-300/35 bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
            >
              <LogIn size={16} aria-hidden />
              로그인하고 시작
            </Link>
            <button
              type="button"
              onClick={onBrowseBasic}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-black text-slate-100 transition hover:border-cyan-300/35 hover:bg-white/[0.07]"
            >
              <Radar size={16} aria-hidden />
              Basic으로 둘러보기
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
  const [showSplash, setShowSplash] = useState(true);
  const [basicBrowse, setBasicBrowse] = useState(false);

  useEffect(() => {
    setBasicBrowse(window.localStorage.getItem(basicBrowseKey) === "true");
    const timer = window.setTimeout(() => setShowSplash(false), 1000);
    return () => window.clearTimeout(timer);
  }, []);

  const startBasicBrowse = () => {
    window.localStorage.setItem(basicBrowseKey, "true");
    setBasicBrowse(true);
  };

  if (showSplash || isLoading) {
    return <SplashScreen />;
  }

  if (!user && !basicBrowse) {
    return <LoginPrompt onBrowseBasic={startBasicBrowse} />;
  }

  return <MarketSelector />;
}
