"use client";
// 헤더 우측에서 저빈도 보조 기능과 계정 액션을 정리하는 메뉴입니다.

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Bell,
  BookOpen,
  Crown,
  HelpCircle,
  LifeBuoy,
  LogIn,
  Menu,
  ReceiptText,
  Sparkles,
  UserCircle,
  type LucideIcon
} from "lucide-react";
import { AuthStatus } from "@/components/AuthStatus";
import { ThemeToggle } from "@/components/ThemeToggle";
import { APP_VERSION_DISPLAY } from "@/lib/appVersion";
import { billingPlans, getEntitlementLabel, hasAnyPaidEntitlement } from "@/lib/billing";
import { clearPreferredMarket, readPreferredMarket, type PreferredMarket } from "@/lib/marketPreference";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

type HeaderMarket = "crypto" | "stocks";
type AuthState = ReturnType<typeof useSupabaseAuth>;

function marketAlertHref(market?: HeaderMarket) {
  return market === "stocks" ? "/alerts?market=global" : "/alerts?market=crypto";
}

function marketProHref(market?: HeaderMarket) {
  if (market === "crypto") return "/pro?market=crypto";
  if (market === "stocks") return "/pro?market=stocks";
  return "/pro";
}

function SettingsLink({
  href,
  icon: Icon,
  label,
  description
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  description: string;
}) {
  return (
    <Link href={href} className="flex items-start gap-3 border-t border-white/10 px-0 py-2.5 text-left transition first:border-t-0 hover:text-white">
      <Icon className="mt-0.5 shrink-0 text-cyan-300" size={16} aria-hidden />
      <span className="min-w-0">
        <span className="block text-sm font-black text-white">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-400">{description}</span>
      </span>
    </Link>
  );
}

function SettingsPlaceholder({
  icon: Icon,
  label,
  description
}: {
  icon: LucideIcon;
  label: string;
  description: string;
}) {
  return (
    <button type="button" disabled className="flex w-full cursor-not-allowed items-start gap-3 border-t border-white/10 px-0 py-2.5 text-left opacity-55">
      <Icon className="mt-0.5 shrink-0 text-cyan-300" size={16} aria-hidden />
      <span className="min-w-0">
        <span className="block text-sm font-black text-white">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-400">{description}</span>
      </span>
    </button>
  );
}

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-white/10 px-3 py-3 first:border-t-0">
      <p className="mb-2 text-sm font-black text-white">{title}</p>
      {children}
    </section>
  );
}

const basicBenefits = billingPlans.find((plan) => plan.id === "free")?.highlights ?? [
  "주요 시장 흐름 확인",
  "AI 브리핑 일부 제공",
  "기본 알림 체험"
];

function MyAccountSection({
  planLabel,
  isPaid,
  proHref
}: {
  planLabel: string;
  isPaid: boolean;
  proHref: string;
}) {
  return (
    <SettingsSection title="나의 계정">
      <div className="py-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold text-slate-400">구독 플랜</span>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-black ${
              isPaid ? "text-amber-200" : "text-cyan-200"
            }`}
          >
            <Crown size={13} aria-hidden />
            {planLabel}
          </span>
        </div>
        {isPaid ? (
          <p className="mt-3 text-xs leading-5 text-slate-400">Pro 기능이 활성화되어 있습니다. 시장별 레이더, 관심종목, 알림을 확장해서 사용할 수 있습니다.</p>
        ) : (
          <>
            <ul className="mt-3 grid gap-1.5 text-xs leading-5 text-slate-400">
              {basicBenefits.map((benefit) => (
                <li key={benefit} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" aria-hidden />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
            <Link
              href={proHref}
              className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-cyan-200"
            >
              <Sparkles size={14} aria-hidden />
              Pro 업그레이드
            </Link>
          </>
        )}
      </div>
    </SettingsSection>
  );
}

function AccountSettingsSection({
  auth,
  loginHref
}: {
  auth: AuthState;
  loginHref: string;
}) {
  const { user, isLoading } = auth;

  return (
    <SettingsSection title="계정">
      <div className="grid gap-1">
        {isLoading ? (
          <button type="button" disabled className="flex w-full cursor-not-allowed items-start gap-3 border-t border-white/10 px-0 py-2.5 text-left opacity-55">
            <UserCircle className="mt-0.5 shrink-0 text-cyan-300" size={16} aria-hidden />
            <span className="min-w-0">
              <span className="block text-sm font-black text-white">회원정보관리</span>
              <span className="mt-0.5 block text-xs leading-5 text-slate-400">로그인 상태를 확인하고 있습니다.</span>
            </span>
          </button>
        ) : user ? (
          <SettingsLink href="/account" icon={UserCircle} label="회원정보관리" description="로그인 상태, 이메일, Pro 권한, 회원탈퇴 안내를 확인합니다." />
        ) : (
          <Link
            href={loginHref}
            className="flex items-start gap-3 border-t border-cyan-300/25 px-0 py-2.5 text-left transition hover:text-white"
          >
            <LogIn className="mt-0.5 shrink-0 text-cyan-200" size={16} aria-hidden />
            <span className="min-w-0">
              <span className="block text-sm font-black text-white">로그인하기</span>
              <span className="mt-0.5 block text-xs leading-5 text-slate-400">로그인 후 회원정보관리와 Pro 권한을 확인할 수 있습니다.</span>
            </span>
          </Link>
        )}
      </div>
    </SettingsSection>
  );
}

function DisplaySettingsSection() {
  const [preferredMarket, setPreferredMarket] = useState<PreferredMarket | null>(null);

  useEffect(() => {
    setPreferredMarket(readPreferredMarket());
  }, []);

  const resetPreferredMarket = () => {
    clearPreferredMarket();
    setPreferredMarket(null);
  };

  return (
    <SettingsSection title="화면 설정">
      <div className="grid gap-4 py-1">
        <div className="grid gap-2">
          <span className="min-w-0">
            <span className="block text-sm font-black text-white">테마</span>
            <span className="mt-0.5 block text-xs leading-5 text-slate-400">기기 테마를 기본으로 쓰고, 필요하면 라이트/다크를 고정합니다.</span>
          </span>
          <ThemeToggle variant="switch" />
        </div>
        <div className="grid gap-2">
          <span className="min-w-0">
            <span className="block text-sm font-black text-white">시작 화면</span>
            <span className="mt-0.5 block text-xs leading-5 text-slate-400">처음에는 시장을 선택하고, 이후에는 마지막으로 사용한 시장으로 바로 들어갑니다.</span>
          </span>
          <div className="border-y border-white/10 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-400">현재 기억된 시장</span>
              <span className="text-xs font-black text-white">{preferredMarket === "global" ? "Global Radar" : preferredMarket === "coin" ? "Coin Radar" : "선택 전"}</span>
            </div>
            <button
              type="button"
              onClick={resetPreferredMarket}
              className="mt-2 min-h-9 w-full border border-white/10 px-3 text-xs font-black text-slate-300 transition hover:border-cyan-300/40 hover:text-white"
            >
              다음 시작 때 시장 다시 선택
            </button>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}

function AppInfoSection() {
  return (
    <section className="border-t border-white/10 px-3 pb-2.5 pt-3">
      <p className="text-sm font-black text-white">Chart Radar</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{APP_VERSION_DISPLAY}</p>
    </section>
  );
}

export function HeaderActions({ market }: { market?: HeaderMarket } = {}) {
  const auth = useSupabaseAuth();
  const alertHref = marketAlertHref(market);
  const proHref = marketProHref(market);
  const alertBadgeCount: number | null = null;
  const plan = auth.profile?.plan ?? "free";
  const isPaid = hasAnyPaidEntitlement(plan);
  const planLabel = getEntitlementLabel(plan);
  const [loginHref, setLoginHref] = useState("/login");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const currentPath = `${window.location.pathname}${window.location.search}`;
    setLoginHref(`/login?returnTo=${encodeURIComponent(currentPath)}`);
  }, []);

  useEffect(() => {
    if (!isSettingsOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (window.history.state?.chartRadarSettingsPanel) {
          window.history.back();
        } else {
          setIsSettingsOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSettingsOpen]);

  useEffect(() => {
    if (!isSettingsOpen) return;

    window.history.pushState({ chartRadarSettingsPanel: true }, "", window.location.href);
    const handlePopState = () => {
      setIsSettingsOpen(false);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isSettingsOpen]);

  const closeSettings = () => {
    if (isSettingsOpen && window.history.state?.chartRadarSettingsPanel) {
      window.history.back();
      return;
    }
    setIsSettingsOpen(false);
  };

  return (
    <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
      <div className="hidden min-[390px]:block">
        <AuthStatus variant="compact" />
      </div>
      <Link
        href={alertHref}
        className="relative grid min-h-8 min-w-8 place-items-center rounded-full border border-transparent bg-transparent text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
        aria-label="알림 설정"
        title="알림 설정"
      >
        <Bell size={16} aria-hidden />
        {typeof alertBadgeCount === "number" && alertBadgeCount > 0 ? (
          <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-cyan-300 px-1 text-[10px] font-black leading-none text-slate-950">
            {alertBadgeCount > 9 ? "9+" : alertBadgeCount}
          </span>
        ) : null}
      </Link>
      <button
        type="button"
        onClick={() => setIsSettingsOpen(true)}
        className="grid min-h-8 min-w-8 place-items-center rounded-full border border-transparent bg-transparent text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
        aria-label="설정 열기"
        title="설정"
      >
        <Menu size={18} aria-hidden />
      </button>
      {isSettingsOpen ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-panel-title"
          className="settings-fullscreen-panel fixed inset-0 z-[100] overflow-y-auto px-3 pb-3 pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-5 sm:pb-5 sm:pt-[calc(env(safe-area-inset-top)+1.25rem)]"
        >
          <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
            <header className="sticky top-0 z-10 -mx-3 flex items-center gap-3 border-b border-white/10 bg-inherit px-3 py-3 sm:-mx-5 sm:px-5">
              <button
                type="button"
                onClick={closeSettings}
                className="grid min-h-10 min-w-10 place-items-center text-slate-300 transition hover:text-white"
                aria-label="설정 닫기"
                title="뒤로"
              >
                <ArrowLeft size={18} aria-hidden />
              </button>
              <div className="min-w-0">
                <p id="settings-panel-title" className="text-base font-black text-white">
                  설정
                </p>
                <p className="text-xs font-semibold text-slate-500">Chart Radar</p>
              </div>
            </header>
            <main className="grid gap-2 py-3">
              <MyAccountSection planLabel={planLabel} isPaid={isPaid} proHref={proHref} />
              <AccountSettingsSection auth={auth} loginHref={loginHref} />
              <DisplaySettingsSection />
              <SettingsSection title="고객지원">
                <div className="grid gap-1">
              <SettingsLink href="/learn" icon={BookOpen} label="지표 안내" description="판단 강도와 시장별 용어를 카테고리별로 확인합니다." />
                  <SettingsPlaceholder icon={LifeBuoy} label="고객센터" description="문의 접수 방식과 답변 기준을 준비 중입니다." />
                  <SettingsPlaceholder icon={HelpCircle} label="자주 묻는 질문" description="로그인, 알림, 구독 관련 FAQ를 정리할 예정입니다." />
                  <SettingsPlaceholder icon={ReceiptText} label="정기결제 현황" description="결제 시스템 구축 후 구독 상태와 갱신일을 연결합니다." />
                </div>
              </SettingsSection>
              <AppInfoSection />
            </main>
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}
