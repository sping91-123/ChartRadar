"use client";

import Link from "next/link";
import { Loader2, LogIn, LogOut } from "lucide-react";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

export function AuthStatus() {
  const { user, isLoading, signOut } = useSupabaseAuth();

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
        href="/login"
        className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:border-accent-blue/50 hover:text-white"
      >
        <LogIn size={13} aria-hidden />
        로그인
      </Link>
    );
  }

  const name = user.user_metadata?.name ?? user.user_metadata?.full_name ?? user.email ?? "회원";

  return (
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
  );
}
