"use client";
// 로그인 상태와 현재 권한을 상단에 표시한다.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Crown, Loader2, LogIn, LogOut } from "lucide-react";
import { getEntitlementLabel, hasAnyPaidEntitlement } from "@/lib/billing";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

export function AuthStatus() {
  const { user, profile, isLoading, signOut } = useSupabaseAuth();
  const [loginHref, setLoginHref] = useState("/login");

  useEffect(() => {
    const currentPath = `${window.location.pathname}${window.location.search}`;
    setLoginHref(`/login?returnTo=${encodeURIComponent(currentPath)}`);
  }, []);

  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-300">
        <Loader2 className="animate-spin" size={13} aria-hidden />
        확인 중
      </span>
    );
  }

  if (!user) {
    return (
      <Link
        href={loginHref}
        className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:border-accent-blue/50 hover:text-white"
      >
        <LogIn size={13} aria-hidden />
        로그인
      </Link>
    );
  }

  const name = user.user_metadata?.name ?? user.user_metadata?.full_name ?? user.email ?? "회원";
  const plan = profile?.plan ?? "free";
  const isPaid = hasAnyPaidEntitlement(plan);
  const planLabel = getEntitlementLabel(plan);

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
