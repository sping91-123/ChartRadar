"use client";
// 홈 첫 진입에서 짧은 스플래시와 로그인 선택 흐름을 제공합니다.

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Bitcoin, TrendingUp } from "lucide-react";
import { GoogleLoginButton } from "@/components/GoogleLoginButton";
import { KakaoLoginButton } from "@/components/KakaoLoginButton";
import { getSupabaseSession } from "@/lib/supabase";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { readPreferredMarket, savePreferredMarket, type PreferredMarket } from "@/lib/marketPreference";

const skipSplashAfterAuthKey = "chartRadar.skipSplashAfterAuth.v1";
const marketEntries = [
  {
    title: "코인 레이더",
    scope: "홈 · 현물 · 선물 · 매크로 · 복기",
    href: "/coin",
    icon: Bitcoin,
    accent: "text-blue-300"
  },
  {
    title: "글로벌 레이더",
    scope: "미국장 · 지수선물 · 자산 · 일정",
    href: "/global",
    icon: TrendingUp,
    accent: "text-slate-300"
  }
] as const;

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
            <h1 className="text-xl font-semibold tracking-tight text-ui-text sm:text-4xl">ChartRadar</h1>

            <p className="max-w-2xl text-xs font-medium leading-snug text-ui-muted sm:text-base sm:leading-relaxed">
              코인과 글로벌 시장을 각각 독립 레이더로 확인합니다.
            </p>
          </header>

          <div className="w-full max-w-3xl divide-y divide-white/10 border-y border-white/10">
            {marketEntries.map(({ title, scope, href, icon: Icon, accent }) => (
              <Link
                key={title}
                href={href}
                onClick={() => savePreferredMarket(href === "/global" ? "global" : "coin")}
                className="group relative flex min-h-[5.75rem] items-center justify-center gap-4 px-1 py-4 text-center transition hover:bg-white/[0.025] focus:outline-none focus-visible:bg-white/[0.035] focus-visible:ring-2 focus-visible:ring-ui-brand sm:min-h-[7rem] sm:px-3 sm:py-5"
              >
                <div className="flex min-w-0 flex-col items-center gap-2 sm:gap-3">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center sm:h-12 sm:w-12 ${accent}`}>
                    <Icon size={25} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-2xl font-black tracking-tight text-white sm:text-4xl">{title}</h2>
                    <p className="mt-1 text-xs font-bold leading-tight text-slate-400 sm:text-sm">{scope}</p>
                  </div>
                </div>
                <ArrowRight size={19} aria-hidden className="absolute right-2 shrink-0 text-slate-500 transition group-hover:translate-x-1 group-hover:text-ui-brand sm:right-4" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export function HomeEntryGate() {
  const router = useRouter();
  const { user, isLoading } = useSupabaseAuth();
  const [skipSplashAfterAuth, setSkipSplashAfterAuth] = useState(false);
  const [hasStoredSession, setHasStoredSession] = useState(false);
  const [basicBrowse, setBasicBrowse] = useState(false);
  const [preferredMarket, setPreferredMarket] = useState<PreferredMarket | null>(null);
  const [preferredMarketLoaded, setPreferredMarketLoaded] = useState(false);

  useEffect(() => {
    setHasStoredSession(Boolean(getSupabaseSession()));
    setPreferredMarket(readPreferredMarket());
    setPreferredMarketLoaded(true);

    if (window.sessionStorage.getItem(skipSplashAfterAuthKey) === "true") {
      window.sessionStorage.removeItem(skipSplashAfterAuthKey);
      setSkipSplashAfterAuth(true);
    }
  }, []);

  useEffect(() => {
    if (!preferredMarketLoaded || !preferredMarket) return;
    const canEnterApp = Boolean(user || basicBrowse || (isLoading && (skipSplashAfterAuth || hasStoredSession)));
    if (!canEnterApp) return;
    router.replace(preferredMarket === "global" ? "/global" : "/coin");
  }, [basicBrowse, hasStoredSession, isLoading, preferredMarket, preferredMarketLoaded, router, skipSplashAfterAuth, user]);

  const startBasicBrowse = () => {
    setBasicBrowse(true);
  };

  if (!preferredMarketLoaded) {
    return null;
  }

  if (preferredMarket && (isLoading || user || basicBrowse || hasStoredSession || skipSplashAfterAuth)) {
    return null;
  }

  if (isLoading) {
    return null;
  }

  if (!user && !basicBrowse) {
    return <LoginPrompt onBrowseBasic={startBasicBrowse} />;
  }

  if (preferredMarketLoaded && preferredMarket) {
    return null;
  }

  return <MarketSelector />;
}
