"use client";
// 운영자가 가입 회원의 테스트 권한을 수동으로 관리하는 관리자 화면입니다.

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Crown, Loader2, Search, ShieldCheck, UserPlus } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { supabaseAuthRefreshEvent } from "@/lib/supabase";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

const planOptions = [
  { id: "bundle_monthly", label: "All Market Pro", description: "코인과 글로벌 전체 권한" },
  { id: "crypto_monthly", label: "Coin Pro", description: "코인 시장 권한" },
  { id: "stocks_monthly", label: "Global Pro", description: "글로벌 시장 권한" },
  { id: "free", label: "Basic", description: "Pro 권한을 제거하고 기본 플랜으로 전환" }
];

interface AdminMember {
  id: string;
  email: string | null;
  displayName: string | null;
  profilePlan: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  activePlan: string | null;
  activeMarketScope: string | null;
  activeStatus: string | null;
  activeUntil: string | null;
}

function isAdminAccount(userPlan?: string | null, role?: string | null) {
  return userPlan === "admin" || role === "admin";
}

function getMemberLabel(member: AdminMember) {
  return member.email ?? member.displayName ?? `계정 ${member.id.slice(0, 8)}`;
}

function getMemberSubLabel(member: AdminMember) {
  if (member.email && member.displayName) return member.displayName;
  if (!member.email) return "이메일 없는 소셜 로그인 계정";
  return null;
}

function formatDate(value?: string | null) {
  if (!value) return "없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "없음";
  return date.toLocaleDateString("ko-KR");
}

export default function AdminEntitlementsPage() {
  const { session, user, profile, isLoading } = useSupabaseAuth();
  const [email, setEmail] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [planId, setPlanId] = useState(planOptions[0].id);
  const [durationDays, setDurationDays] = useState(90);
  const [reason, setReason] = useState("베타테스트 혜택 관리");
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberError, setMemberError] = useState("");
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isAdmin = user?.app_metadata?.role === "admin";
  const isBasicPlan = planId === "free";

  const loadMembers = useCallback(async (query: string) => {
    if (!session?.accessToken) return;
    setIsLoadingMembers(true);
    setMemberError("");

    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      const response = await fetch(`/api/admin/entitlements${params.size ? `?${params.toString()}` : ""}`, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`
        }
      });
      const payload = (await response.json()) as { members?: AdminMember[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "회원 목록을 불러오지 못했습니다.");
      setMembers(payload.members ?? []);
    } catch (loadError) {
      setMemberError(loadError instanceof Error ? loadError.message : "회원 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoadingMembers(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    if (session?.accessToken) {
      void loadMembers("");
    }
  }, [loadMembers, session?.accessToken]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!session?.accessToken) {
      setError("관리자 로그인이 필요합니다.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/entitlements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`
        },
        body: JSON.stringify({
          email,
          userId: selectedMemberId || undefined,
          planId,
          durationDays,
          reason,
          requestId: crypto.randomUUID()
        })
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        email?: string | null;
        accountLabel?: string;
        userId?: string;
        planName?: string;
        currentPeriodEnd?: string | null;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "테스터 권한 변경에 실패했습니다.");
      }

      const accountLabel = payload.accountLabel ?? payload.email ?? email;
      const endDate = payload.currentPeriodEnd ? new Date(payload.currentPeriodEnd).toLocaleDateString("ko-KR") : "만료일 미확정";
      setMessage(
        isBasicPlan
          ? `${accountLabel} 계정을 Basic으로 전환했습니다.`
          : `${accountLabel} 계정에 ${payload.planName ?? "Pro"} 권한을 ${endDate}까지 부여했습니다.`
      );
      window.dispatchEvent(new Event(supabaseAuthRefreshEvent));
      void loadMembers(memberQuery);
    } catch (grantError) {
      setError(grantError instanceof Error ? grantError.message : "테스터 권한 변경에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen max-w-full overflow-x-hidden px-2 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-4 sm:pb-10">
      <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-3 sm:gap-5">
        <Header />
        <Link href="/account" className="inline-flex w-fit items-center gap-2 text-sm font-bold text-slate-400 hover:text-white">
          <ArrowLeft size={16} aria-hidden />
          회원정보관리로 돌아가기
        </Link>

        <section className="min-w-0 overflow-visible border-y border-surface-line py-4 sm:py-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center text-amber-200">
              <UserPlus size={20} aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">테스터 Pro 권한 관리</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400 [word-break:keep-all]">
                가입한 테스터 계정을 선택해 Pro 권한을 부여하거나 Basic으로 되돌립니다. Basic은 기본 상태라 유지기간이 적용되지 않습니다.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="mt-6 border-y border-surface-line py-4 text-sm font-bold text-slate-300">
              관리자 권한을 확인하고 있습니다.
            </div>
          ) : !user ? (
            <div className="mt-6 border-y border-surface-line py-4 text-sm leading-6 text-slate-300">
              먼저 관리자 계정으로 로그인해 주세요.
              <Link
                href="/login?returnTo=%2Fadmin%2Fentitlements"
                className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-cyan-300/35 bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
              >
                로그인하기
              </Link>
            </div>
          ) : !isAdmin && memberError ? (
            <div className="mt-6 border-y border-rose-300/25 py-4 text-sm leading-6 text-rose-100">
              현재 계정은 관리자 권한이 없어 테스터 권한을 변경할 수 없습니다.
            </div>
          ) : (
            <div className="mt-6 grid min-w-0 gap-5">
              <section className="min-w-0 overflow-hidden border-y border-surface-line py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="grid min-w-0 flex-1 gap-2 text-sm font-bold text-slate-300">
                    가입 회원 검색
                    <input
                      type="search"
                      value={memberQuery}
                      onChange={(event) => setMemberQuery(event.target.value)}
                      placeholder="이메일 또는 이름으로 검색"
                      className="min-h-11 w-full min-w-0 rounded-xl border border-surface-line bg-slate-950 px-4 text-base font-bold text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/55"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void loadMembers(memberQuery)}
                    disabled={isLoadingMembers}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/35 bg-cyan-300/10 px-4 py-2 text-sm font-black text-cyan-100 transition hover:border-cyan-300/55 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
                  >
                    {isLoadingMembers ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Search size={16} aria-hidden />}
                    회원 불러오기
                  </button>
                </div>

                {memberError ? <p className="mt-3 border-y border-rose-300/25 py-3 text-sm font-bold text-rose-100">{memberError}</p> : null}

                <div className="mt-4 grid max-h-[28rem] min-w-0 gap-2 overflow-y-auto pr-1">
                  {isLoadingMembers && members.length === 0 ? (
                    <p className="border-y border-surface-line py-4 text-sm font-bold text-slate-400">회원 목록을 불러오고 있습니다.</p>
                  ) : members.length > 0 ? (
                    members.map((member) => {
                      const selected = selectedMemberId ? selectedMemberId === member.id : email.toLowerCase() === (member.email ?? "").toLowerCase();
                      const subLabel = getMemberSubLabel(member);
                      return (
                        <button
                          key={member.id}
                          type="button"
                          title={getMemberLabel(member)}
                          onClick={() => {
                            setSelectedMemberId(member.id);
                            setEmail(member.email ?? "");
                          }}
                          className={`w-full min-w-0 overflow-hidden border-y py-3 text-left transition sm:py-4 ${
                            selected ? "border-amber-300/55" : "border-surface-line hover:border-cyan-300/35"
                          }`}
                        >
                          <span className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <span className="min-w-0 flex-1">
                              <span className="block break-all text-sm font-black leading-5 text-white">{member.email ?? "이메일 없음"}</span>
                              {subLabel ? <span className="mt-1 block truncate text-xs text-slate-400">{subLabel}</span> : null}
                            </span>
                            <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-xs font-black text-slate-300">
                              {member.activePlan ?? member.profilePlan ?? "free"}
                            </span>
                          </span>
                          <span className="mt-3 grid min-w-0 gap-1 text-xs leading-5 text-slate-500 sm:grid-cols-2">
                            <span className="min-w-0 break-words">가입일 {formatDate(member.createdAt)}</span>
                            <span className="min-w-0 break-words">권한 만료 {formatDate(member.activeUntil)}</span>
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="border-y border-surface-line py-4 text-sm font-bold text-slate-400">
                      표시할 가입 회원이 없습니다. 테스터가 먼저 한 번 로그인해야 목록에 나타납니다.
                    </p>
                  )}
                </div>
              </section>

              <form onSubmit={handleSubmit} className="grid min-w-0 gap-4">
                <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-300">
                  선택한 테스터 이메일
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setSelectedMemberId("");
                      setEmail(event.target.value);
                    }}
                    placeholder="tester@example.com"
                    className="min-h-12 w-full min-w-0 rounded-xl border border-surface-line bg-slate-950 px-4 text-base font-bold text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/55"
                    required={!selectedMemberId}
                  />
                </label>

                <fieldset className="grid gap-2">
                  <legend className="text-sm font-bold text-slate-300">변경할 권한</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {planOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={planId === option.id}
                        onClick={() => setPlanId(option.id)}
                        className={`min-w-0 border-y py-2.5 text-left transition sm:py-4 ${
                          planId === option.id ? "border-amber-300/45" : "border-surface-line hover:border-cyan-300/35"
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2 text-sm font-black text-white">
                          {option.id === "free" ? <ShieldCheck size={15} aria-hidden /> : <Crown size={15} aria-hidden />}
                          <span className="min-w-0 truncate">{option.label}</span>
                        </span>
                        <span className="mt-1 hidden text-xs leading-5 text-slate-400 sm:block">{option.description}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>

                {!isBasicPlan ? (
                  <label className="grid gap-2 text-sm font-bold text-slate-300">
                    권한 유지 기간
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={durationDays}
                      onChange={(event) => setDurationDays(Number(event.target.value))}
                      className="min-h-12 rounded-xl border border-surface-line bg-slate-950 px-4 text-base font-bold text-white outline-none transition focus:border-cyan-300/55"
                    />
                  </label>
                ) : (
                  <p className="border-y border-surface-line py-3 text-xs font-bold leading-5 text-slate-300 sm:text-sm sm:leading-6">
                    Basic은 기본 플랜이라 유지기간을 설정하지 않습니다. 선택한 계정의 수동 Pro 권한을 제거합니다.
                  </p>
                )}

                <label className="grid gap-2 text-sm font-bold text-slate-300">
                  변경 사유
                  <input
                    type="text"
                    minLength={3}
                    maxLength={240}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    required
                    className="min-h-12 rounded-xl border border-surface-line bg-slate-950 px-4 text-base font-bold text-white outline-none transition focus:border-cyan-300/55"
                  />
                </label>

                {error ? <p className="border-y border-rose-300/25 py-3 text-sm font-bold text-rose-100">{error}</p> : null}
                {message ? <p className="border-y border-signal-success/25 py-3 text-sm font-bold text-signal-success">{message}</p> : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mb-[env(safe-area-inset-bottom)] inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-amber-300/35 bg-amber-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-amber-200 disabled:cursor-wait disabled:opacity-70"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ShieldCheck size={16} aria-hidden />}
                  {isBasicPlan ? "Basic으로 전환하기" : "권한 부여하기"}
                </button>
              </form>
            </div>
          )}
        </section>

        <section className="border-y border-cyan-300/20 py-4 text-sm leading-6 text-slate-300">
          이 화면은 결제 상품을 새로 만드는 기능이 아닙니다. 가입된 테스터 계정의 수동 권한만 운영 목적으로 변경합니다.
        </section>

        <AppFooter />
      </div>
    </main>
  );
}
