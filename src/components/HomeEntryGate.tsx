"use client";
// 홈 첫 진입에서 짧은 스플래시와 로그인 선택 흐름을 제공합니다.

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Bitcoin, TrendingUp } from "lucide-react";
import { getSupabaseSession } from "@/lib/supabase";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { readPreferredMarket, savePreferredMarket, type PreferredMarket } from "@/lib/marketPreference";

const skipSplashAfterAuthKey = "chartRadar.skipSplashAfterAuth.v1";
const marketEntries = [
  {
    title: "코인 레이더",
    scope: "홈 · 현물 · 선물 · 뉴스 · 복기",
    href: "/crypto/home",
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
    <main className="min-h-[100dvh] px-5 py-10 sm:py-16">
      <section className="mx-auto w-full max-w-lg">
        <p className="text-sm font-semibold text-ui-brand">차트 레이더 · BTC·ETH 판단 보조</p>
        <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight text-ui-text [word-break:keep-all]">계속 차트를 볼 수 없다면,<br />기다릴 조건을 남기세요.</h1>
        <p className="mt-4 text-sm leading-6 text-ui-muted">지금의 방향과 위험을 확인하고, 다시 볼 조건 1개를 무료로 감시할 수 있습니다.</p>
        <ol className="my-6 space-y-3 border-y border-ui-line py-5 text-sm text-ui-text">
          <li><span className="mr-3 font-bold text-ui-brand">01</span>지금 기다리는 이유 확인</li>
          <li><span className="mr-3 font-bold text-ui-brand">02</span>조건을 저장하고 앱에 감시 맡기기</li>
          <li><span className="mr-3 font-bold text-ui-brand">03</span>조건이 오면 당시 분석 다시 보기</li>
        </ol>
        <button type="button" onClick={onBrowseBasic} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-ui-sm bg-ui-brand px-4 text-sm font-bold text-white">로그인 없이 오늘의 조건 보기 <ArrowRight size={17} aria-hidden /></button>
        <p className="mt-2 text-center text-xs leading-5 text-ui-muted">Basic 무료 · 카드 등록 없음 · 감시 저장 시 로그인</p>
        <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-ui-muted">
          <Link href="/login?returnTo=%2Fcrypto%2Fhome" className="inline-flex min-h-11 items-center underline underline-offset-4">기존 계정으로 로그인</Link>
          <Link href="/global" onClick={() => savePreferredMarket("global")} className="inline-flex min-h-11 items-center underline underline-offset-4">글로벌 시장 보기</Link>
        </div>
        <p className="mt-4 text-xs leading-5 text-ui-subtle">거래소 시장 자료와 확정된 캔들로 판단 조건을 정리합니다. 조건 충족 시 재확인을 돕는 서비스이며, 주문을 실행하거나 수익을 보장하지 않습니다.</p>
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
            <h1 className="text-xl font-semibold tracking-tight text-ui-text sm:text-4xl">차트 레이더</h1>

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
  const { session, user, isLoading } = useSupabaseAuth();
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
    const canEnterApp = Boolean(
      user ||
      session ||
      basicBrowse ||
      (isLoading && (skipSplashAfterAuth || hasStoredSession))
    );
    if (!canEnterApp) return;
    router.replace(preferredMarket === "global" ? "/global" : "/crypto/home");
  }, [
    basicBrowse,
    hasStoredSession,
    isLoading,
    preferredMarket,
    preferredMarketLoaded,
    router,
    session,
    skipSplashAfterAuth,
    user
  ]);

  const startBasicBrowse = () => {
    savePreferredMarket("coin");
    setPreferredMarket("coin");
    setBasicBrowse(true);
    router.push("/crypto/home");
  };

  const loadingView = (
    <main className="grid min-h-screen place-items-center px-4" aria-live="polite" aria-busy="true">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-ui-line border-t-ui-brand" aria-hidden />
        <p className="mt-4 text-sm font-semibold text-ui-muted">로그인 상태와 시작 화면을 확인하고 있습니다.</p>
      </div>
    </main>
  );

  if (!preferredMarketLoaded) return loadingView;

  if (
    preferredMarket &&
    (isLoading || user || session || basicBrowse || (hasStoredSession && isLoading) || skipSplashAfterAuth)
  ) {
    return loadingView;
  }

  if (isLoading) {
    return loadingView;
  }

  if (!user && !session && !basicBrowse) {
    return <LoginPrompt onBrowseBasic={startBasicBrowse} />;
  }

  if (preferredMarketLoaded && preferredMarket) {
    return loadingView;
  }

  return <MarketSelector />;
}
