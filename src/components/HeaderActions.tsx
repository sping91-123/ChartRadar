"use client";
// 헤더 우측에서 저빈도 보조 기능과 계정 액션을 정리하는 메뉴입니다.

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  BookOpen,
  Crown,
  HelpCircle,
  LifeBuoy,
  LogIn,
  LogOut,
  ReceiptText,
  Settings,
  Sparkles,
  Trash2,
  type LucideIcon
} from "lucide-react";
import { AuthStatus } from "@/components/AuthStatus";
import { ThemeToggle } from "@/components/ThemeToggle";
import { billingPlans, getEntitlementLabel, hasAnyPaidEntitlement } from "@/lib/billing";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

type HeaderMarket = "crypto" | "stocks";
type AuthState = ReturnType<typeof useSupabaseAuth>;
type AuthUser = NonNullable<AuthState["user"]>;

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
    <Link href={href} className="flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-white/[0.06]">
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
    <button type="button" disabled className="flex w-full cursor-not-allowed items-start gap-3 rounded-lg px-3 py-2.5 text-left opacity-55">
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
    <section className="rounded-lg px-3 py-2.5">
      <p className="mb-2 text-sm font-black text-white">{title}</p>
      {children}
    </section>
  );
}

function getAccountLabel(user: AuthUser, displayName?: string | null) {
  return (
    displayName ??
    user.user_metadata?.name ??
    user.user_metadata?.full_name ??
    user.user_metadata?.nickname ??
    user.user_metadata?.preferred_username ??
    user.email ??
    `회원 ${user.id.slice(0, 6)}`
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
      <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold text-slate-400">구독 플랜</span>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-black ${
              isPaid ? "border-amber-300/35 bg-amber-300/10 text-amber-200" : "border-cyan-300/35 bg-cyan-300/10 text-cyan-200"
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
              className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-cyan-300/35 bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-cyan-200"
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

function MemberManagementSection({
  auth,
  loginHref
}: {
  auth: AuthState;
  loginHref: string;
}) {
  const { user, profile, isLoading, signOut } = auth;
  const accountLabel = user ? getAccountLabel(user, profile?.display_name) : null;
  const email = user?.email ?? profile?.email ?? null;

  return (
    <details className="group/member rounded-lg px-3 py-2.5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-white [&::-webkit-details-marker]:hidden">
        <span>회원정보관리</span>
        <span className="text-xs font-bold text-slate-500 transition group-open/member:rotate-180" aria-hidden>
          ▼
        </span>
      </summary>
      <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.035] p-3">
        {isLoading ? (
          <p className="text-xs leading-5 text-slate-400">로그인 상태를 확인하고 있습니다.</p>
        ) : user ? (
          <div className="grid gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-white">{accountLabel}</p>
              {email ? <p className="mt-1 truncate text-xs text-slate-400">{email}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => {
                signOut();
                window.location.reload();
              }}
              className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-signal-success/25 bg-signal-success/10 px-3 py-2 text-xs font-black text-signal-success transition hover:border-signal-success/45"
            >
              <LogOut size={14} aria-hidden />
              로그아웃
            </button>
            <Link
              href="/account/delete"
              className="inline-flex min-h-8 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-3 py-2 text-xs font-bold text-slate-500 transition hover:border-rose-300/25 hover:text-slate-300"
            >
              <Trash2 size={13} aria-hidden />
              계정·데이터 삭제 안내
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            <p className="text-xs leading-5 text-slate-400">로그인하면 관심종목, 알림, Pro 권한을 같은 계정에서 이어서 사용할 수 있습니다.</p>
            <Link
              href={loginHref}
              className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-black text-slate-100 transition hover:border-cyan-300/35"
            >
              <LogIn size={14} aria-hidden />
              로그인
            </Link>
          </div>
        )}
      </div>
    </details>
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

  useEffect(() => {
    const currentPath = `${window.location.pathname}${window.location.search}`;
    setLoginHref(`/login?returnTo=${encodeURIComponent(currentPath)}`);
  }, []);

  return (
    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
      <AuthStatus variant="compact" />
      <Link
        href={alertHref}
        className="relative grid min-h-9 min-w-9 place-items-center rounded-lg border border-surface-line bg-surface-cardSoft text-slate-300 transition hover:border-cyan-300/45 hover:text-white"
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
      <div className="hidden sm:block">
        <ThemeToggle />
      </div>
      <details className="group relative">
        <summary
          className="grid min-h-9 min-w-9 cursor-pointer list-none place-items-center rounded-lg border border-surface-line bg-surface-cardSoft text-slate-300 transition hover:border-cyan-300/45 hover:text-white [&::-webkit-details-marker]:hidden"
          aria-label="설정 메뉴"
          title="설정"
        >
          <Settings size={16} aria-hidden />
        </summary>
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-cyan-300/20 bg-slate-950 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.72)] ring-1 ring-white/10">
          <MyAccountSection planLabel={planLabel} isPaid={isPaid} proHref={proHref} />
          <MemberManagementSection auth={auth} loginHref={loginHref} />
          <SettingsSection title="고객지원">
            <div className="grid gap-1">
              <SettingsLink href="/learn" icon={BookOpen} label="지표 안내" description="RSI, EMA, POC, OTE 같은 주요 판독 기준을 확인합니다." />
              <SettingsPlaceholder icon={LifeBuoy} label="고객센터" description="문의 접수 방식과 답변 기준을 준비 중입니다." />
              <SettingsPlaceholder icon={HelpCircle} label="자주 묻는 질문" description="로그인, 알림, 구독 관련 FAQ를 정리할 예정입니다." />
              <SettingsPlaceholder icon={ReceiptText} label="정기결제 현황" description="결제 시스템 구축 후 구독 상태와 갱신일을 연결합니다." />
            </div>
          </SettingsSection>
        </div>
      </details>
    </div>
  );
}
