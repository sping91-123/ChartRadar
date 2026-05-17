"use client";
// 로그인 상태와 현재 권한을 상단에 표시합니다.

import Link from "next/link";
import { useEffect, useState } from "react";
import { Crown, Loader2, LogIn, LogOut, UserCircle } from "lucide-react";
import { getEntitlementLabel, hasAnyPaidEntitlement } from "@/lib/billing";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

type AuthUser = NonNullable<ReturnType<typeof useSupabaseAuth>["user"]>;

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

export function AuthStatus({ variant = "default" }: { variant?: "default" | "compact" } = {}) {
  const { user, profile, isLoading, signOut } = useSupabaseAuth();
  const [loginHref, setLoginHref] = useState("/login");

  useEffect(() => {
    const currentPath = `${window.location.pathname}${window.location.search}`;
    setLoginHref(`/login?returnTo=${encodeURIComponent(currentPath)}`);
  }, []);

  if (isLoading) {
    return (
      <span className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-300">
        <Loader2 className="animate-spin" size={13} aria-hidden />
        확인 중
      </span>
    );
  }

  const plan = profile?.plan ?? "free";
  const isPaid = hasAnyPaidEntitlement(plan);
  const planLabel = getEntitlementLabel(plan);

  if (variant === "compact") {
    if (!user) {
      return (
        <span
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-2.5 py-1 text-xs font-black text-cyan-100 sm:px-3"
          title="Basic 상태입니다. 로그인은 설정 메뉴에서 진행할 수 있습니다."
        >
          <UserCircle size={14} aria-hidden />
          Basic
        </span>
      );
    }

    return (
      <span
        className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-black sm:px-3 ${
          isPaid
            ? "border-amber-300/35 bg-amber-300/10 text-amber-100"
            : "border-cyan-300/25 bg-cyan-300/10 text-cyan-100"
        }`}
        title={isPaid ? `${planLabel} 이용 중` : "Basic 이용 중"}
      >
        <Crown size={14} aria-hidden />
        <span className="max-w-[6.5rem] truncate">{isPaid ? planLabel : "Basic"}</span>
      </span>
    );
  }

  if (!user) {
    return (
      <Link
        href={loginHref}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:border-accent-blue/50 hover:text-white"
      >
        <LogIn size={13} aria-hidden />
        로그인
      </Link>
    );
  }

  const name = getAccountLabel(user, profile?.display_name);

  return (
    <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center">
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-black ${
          isPaid
            ? "border-amber-300/35 bg-amber-300/10 text-amber-200"
            : "border-cyan-300/35 bg-cyan-300/10 text-cyan-200"
        }`}
        title={isPaid ? `${planLabel} 이용 중` : "Basic 이용 중"}
      >
        <Crown size={13} aria-hidden />
        <span className="max-w-32 truncate">{isPaid ? planLabel : "Basic"}</span>
      </span>
      <button
        type="button"
        onClick={() => {
          signOut();
          window.location.reload();
        }}
        className="inline-flex items-center gap-1.5 rounded-md border border-signal-success/20 bg-signal-success/10 px-2.5 py-1 text-xs font-semibold text-signal-success hover:border-signal-success/50"
        title={`${name} 로그아웃`}
      >
        <LogOut size={13} aria-hidden />
        {name.length > 8 ? `${name.slice(0, 8)}...` : name}
      </button>
    </div>
  );
}
