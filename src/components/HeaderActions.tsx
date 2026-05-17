"use client";
// 헤더 우측에서 저빈도 보조 기능과 계정 액션을 정리하는 메뉴입니다.

import Link from "next/link";
import { Bell, Crown, Database, FileText, Settings, ShieldCheck, UserCircle } from "lucide-react";
import { AuthStatus } from "@/components/AuthStatus";
import { ThemeToggle } from "@/components/ThemeToggle";

type HeaderMarket = "crypto" | "stocks";

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
  icon: typeof Settings;
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

export function HeaderActions({ market }: { market?: HeaderMarket } = {}) {
  const alertHref = marketAlertHref(market);
  const proHref = marketProHref(market);
  const alertBadgeCount: number | null = null;

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
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-cyan-300/20 bg-slate-950 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.72)] ring-1 ring-white/10">
          <SettingsLink href={alertHref} icon={Bell} label="알림 설정" description="감시 조건과 알림 권한 상태를 확인합니다." />
          <div className="rounded-lg px-3 py-2.5 sm:hidden">
            <p className="mb-2 text-sm font-black text-white">테마 설정</p>
            <ThemeToggle />
          </div>
          <div className="rounded-lg px-3 py-2.5">
            <p className="mb-2 text-sm font-black text-white">계정</p>
            <AuthStatus />
          </div>
          <SettingsLink href={proHref} icon={Crown} label="구독/프리미엄" description="시장별 Pro 기능과 결제 상태를 확인합니다." />
          <button
            type="button"
            disabled
            className="flex w-full cursor-not-allowed items-start gap-3 rounded-lg px-3 py-2.5 text-left opacity-55"
          >
            <Database className="mt-0.5 shrink-0 text-cyan-300" size={16} aria-hidden />
            <span className="min-w-0">
              <span className="block text-sm font-black text-white">데이터/캐시</span>
              <span className="mt-0.5 block text-xs leading-5 text-slate-400">앱 데이터 관리 진입 구조를 준비 중입니다.</span>
            </span>
          </button>
          <SettingsLink href="/terms" icon={FileText} label="약관/면책 안내" description="서비스 이용 기준과 투자 유의사항을 확인합니다." />
          <SettingsLink href="/privacy" icon={ShieldCheck} label="개인정보" description="계정과 데이터 처리 기준을 확인합니다." />
          <SettingsLink href="/account/delete" icon={UserCircle} label="계정 관리" description="계정과 사용 데이터 삭제 안내를 확인합니다." />
        </div>
      </details>
    </div>
  );
}
