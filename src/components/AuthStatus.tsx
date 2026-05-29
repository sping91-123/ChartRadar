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
      <span className="inline-flex min-h-9 items-center gap-1.5 px-0 py-1 text-xs font-semibold text-slate-300">
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
          className="inline-flex min-h-9 items-center gap-1.5 px-0 py-1 text-xs font-black text-cyan-100"
          title="Basic 상태입니다. 로그인은 설정 메뉴에서 진행할 수 있습니다."
        >
          <UserCircle size={14} aria-hidden />
          Basic
        </span>
      );
    }

    return (
      <span
        className={`inline-flex min-h-9 items-center gap-1.5 px-0 py-1 text-xs font-black ${
          isPaid
            ? "text-amber-100"
            : "text-cyan-100"
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
        className="inline-flex min-h-9 items-center gap-1.5 px-0 py-1 text-xs font-semibold text-slate-200 hover:text-white"
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
        className={`inline-flex items-center gap-1.5 px-0 py-1 text-xs font-black ${
          isPaid
            ? "text-amber-200"
            : "text-cyan-200"
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
        className="inline-flex items-center gap-1.5 px-0 py-1 text-xs font-semibold text-signal-success hover:text-emerald-200"
        title={`${name} 로그아웃`}
      >
        <LogOut size={13} aria-hidden />
        {name.length > 8 ? `${name.slice(0, 8)}...` : name}
      </button>
    </div>
  );
}
