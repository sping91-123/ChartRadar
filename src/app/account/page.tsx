"use client";
// 설정에서 진입하는 회원정보와 회원탈퇴 안내 페이지입니다.

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Crown, LogIn, LogOut, ShieldCheck, Trash2, UserCircle } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { getEntitlementLabel, hasAnyPaidEntitlement } from "@/lib/billing";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

function formatAccountDate(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function providerLabel(provider?: string | null) {
  if (provider === "google") return "Google 로그인 계정";
  if (provider === "kakao") return "Kakao 로그인 계정";
  if (provider) return `${provider} 로그인 계정`;
  return "로그인 계정";
}

function AccountInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-line bg-surface-cardSoft p-4">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-white">{value}</p>
    </div>
  );
}

export default function AccountPage() {
  const { user, profile, isLoading, signOut } = useSupabaseAuth();
  const [confirmedDeleteGuide, setConfirmedDeleteGuide] = useState(false);
  const plan = profile?.plan ?? "free";
  const isPaid = hasAnyPaidEntitlement(plan);
  const planLabel = getEntitlementLabel(plan);
  const email = user?.email ?? profile?.email ?? null;
  const provider = user?.app_metadata?.provider ?? user?.app_metadata?.providers?.[0] ?? null;
  const createdAt = formatAccountDate(user?.created_at ?? profile?.created_at);
  const lastSignInAt = formatAccountDate(user?.last_sign_in_at);
  const displayName =
    profile?.display_name ??
    user?.user_metadata?.name ??
    user?.user_metadata?.full_name ??
    user?.user_metadata?.nickname ??
    user?.email ??
    null;

  function handleSignOut() {
    signOut();
    setConfirmedDeleteGuide(false);
  }

  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <Header />
        <Link href="/" className="inline-flex w-fit items-center gap-2 text-sm font-bold text-slate-400 hover:text-white">
          <ArrowLeft size={16} aria-hidden />
          홈으로 돌아가기
        </Link>

        <section className="enterprise-panel p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
              <UserCircle size={21} aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">회원정보관리</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400 [word-break:keep-all]">
                로그인 상태, 계정 정보, Pro 권한과 회원탈퇴 안내를 확인합니다.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            {isLoading ? (
              <section className="rounded-xl border border-surface-line bg-surface-cardSoft p-4 text-sm font-bold text-slate-300">
                계정 상태를 확인하고 있습니다.
              </section>
            ) : user ? (
              <>
                <section className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-cyan-200">로그인됨</p>
                      <p className="mt-1 truncate text-lg font-black text-white">{displayName ?? "Chart Radar 회원"}</p>
                      {email ? <p className="mt-1 truncate text-sm text-slate-300">{email}</p> : null}
                    </div>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-signal-success/25 bg-signal-success/10 px-4 py-2 text-sm font-black text-signal-success transition hover:border-signal-success/45"
                    >
                      <LogOut size={16} aria-hidden />
                      로그아웃
                    </button>
                  </div>
                </section>

                <section className="grid gap-3 sm:grid-cols-2">
                  <AccountInfoRow label="로그인 상태" value="로그인 상태입니다." />
                  <AccountInfoRow label="이메일" value={email ?? "이메일 정보 없음"} />
                  <AccountInfoRow label="계정 유형" value={providerLabel(provider)} />
                  <AccountInfoRow label="현재 베타/Pro 상태" value={`${planLabel}${isPaid ? " 활성" : " 이용 중"} · 베타 이용 가능`} />
                  {createdAt ? <AccountInfoRow label="가입일" value={createdAt} /> : null}
                  {lastSignInAt ? <AccountInfoRow label="마지막 로그인" value={lastSignInAt} /> : null}
                </section>
              </>
            ) : (
              <section className="rounded-xl border border-surface-line bg-surface-cardSoft p-4">
                <div className="flex items-start gap-3">
                  <LogIn className="mt-0.5 shrink-0 text-cyan-300" size={18} aria-hidden />
                  <div>
                    <h2 className="text-base font-black text-white">로그아웃 상태입니다.</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400 [word-break:keep-all]">
                      회원정보관리, Pro 권한 확인, 계정 삭제 요청은 로그인 후 본인 계정 기준으로 확인할 수 있습니다.
                    </p>
                    <Link
                      href="/login?returnTo=%2Faccount"
                      className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-cyan-300/35 bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
                    >
                      <LogIn size={16} aria-hidden />
                      로그인하기
                    </Link>
                  </div>
                </div>
              </section>
            )}
          </div>
        </section>

        <section className="enterprise-panel p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-rose-300/25 bg-rose-300/10 text-rose-200">
              <Trash2 size={20} aria-hidden />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">회원탈퇴</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400 [word-break:keep-all]">
                계정 삭제는 즉시 실행 버튼이 아니라 안내 확인 후 삭제 요청 절차로 연결합니다. 유료 구독 해지는 Google Play 구독 관리에서 별도로 확인해야 합니다.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-surface-line bg-surface-cardSoft p-4 text-sm leading-6 text-slate-300">
              <input
                type="checkbox"
                checked={confirmedDeleteGuide}
                onChange={(event) => setConfirmedDeleteGuide(event.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-white/20 bg-slate-950 accent-cyan-300"
              />
              <span>계정 삭제 시 저장 데이터가 삭제될 수 있고, 스토어 구독 해지는 별도 절차라는 안내를 확인했습니다.</span>
            </label>

            {confirmedDeleteGuide ? (
              <Link
                href="/account/delete"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-rose-300/35 bg-rose-300/10 px-4 py-2 text-sm font-black text-rose-100 transition hover:border-rose-300/60"
              >
                <CheckCircle2 size={16} aria-hidden />
                계정·데이터 삭제 안내 보기
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex min-h-10 cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-black text-slate-500"
              >
                <ShieldCheck size={16} aria-hidden />
                안내 확인 후 이동 가능
              </button>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-signal-success/25 bg-signal-success/10 p-4 text-sm leading-6 text-slate-300">
          <div className="flex items-start gap-3">
            <Crown className="mt-0.5 shrink-0 text-signal-success" size={18} aria-hidden />
            <p>Pro 권한은 현재 계정 세션과 Supabase 프로필 기준으로 표시됩니다. 결제 로직이나 구독 동기화 로직은 이 화면에서 변경하지 않습니다.</p>
          </div>
        </section>

        <AppFooter />
      </div>
    </main>
  );
}
