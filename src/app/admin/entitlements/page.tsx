"use client";
// 운영자가 테스터 이메일로 Pro 권한을 부여하는 관리자 화면입니다.

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
  { id: "stocks_monthly", label: "Global Pro", description: "글로벌 시장 권한" }
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
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberError, setMemberError] = useState("");
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isAdmin = isAdminAccount(profile?.plan, user?.app_metadata?.role ?? user?.app_metadata?.plan);

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
        body: JSON.stringify({ email, userId: selectedMemberId || undefined, planId, durationDays })
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        email?: string;
        accountLabel?: string;
        userId?: string;
        planName?: string;
        currentPeriodEnd?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "테스터 권한 부여에 실패했습니다.");
      }

      const endDate = payload.currentPeriodEnd ? new Date(payload.currentPeriodEnd).toLocaleDateString("ko-KR") : "만료일 미확인";
      setMessage(`${payload.email ?? email} 계정에 ${payload.planName ?? "Pro"} 권한을 ${endDate}까지 부여했습니다.`);
      if (payload.accountLabel && !payload.email) {
        setMessage(`${payload.accountLabel} 계정에 ${payload.planName ?? "Pro"} 권한을 ${endDate}까지 부여했습니다.`);
      }
      window.dispatchEvent(new Event(supabaseAuthRefreshEvent));
      void loadMembers(memberQuery);
    } catch (grantError) {
      setError(grantError instanceof Error ? grantError.message : "테스터 권한 부여에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <Header />
        <Link href="/account" className="inline-flex w-fit items-center gap-2 text-sm font-bold text-slate-400 hover:text-white">
          <ArrowLeft size={16} aria-hidden />
          회원정보관리로 돌아가기
        </Link>

        <section className="enterprise-panel p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-300/25 bg-amber-300/10 text-amber-200">
              <UserPlus size={20} aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">테스터 Pro 권한 부여</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400 [word-break:keep-all]">
                가입한 테스터 이메일을 입력해 수동 Pro 권한을 부여합니다. 테스터는 권한 부여 후 앱을 재실행하거나 다시 로그인해야 새 권한을 읽습니다.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="mt-6 rounded-xl border border-surface-line bg-surface-cardSoft p-4 text-sm font-bold text-slate-300">
              관리자 권한을 확인하고 있습니다.
            </div>
          ) : !user ? (
            <div className="mt-6 rounded-xl border border-surface-line bg-surface-cardSoft p-4 text-sm leading-6 text-slate-300">
              먼저 관리자 계정으로 로그인해 주세요.
              <Link
                href="/login?returnTo=%2Fadmin%2Fentitlements"
                className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-cyan-300/35 bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
              >
                로그인하기
              </Link>
            </div>
          ) : !isAdmin && memberError ? (
            <div className="mt-6 rounded-xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm leading-6 text-rose-100">
              현재 계정은 관리자 권한이 없어 테스터 Pro 권한을 부여할 수 없습니다.
            </div>
          ) : (
            <div className="mt-6 grid gap-5">
              <section className="rounded-xl border border-surface-line bg-surface-cardSoft p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="grid flex-1 gap-2 text-sm font-bold text-slate-300">
                    가입 회원 검색
                    <input
                      type="search"
                      value={memberQuery}
                      onChange={(event) => setMemberQuery(event.target.value)}
                      placeholder="이메일 또는 이름으로 검색"
                      className="min-h-11 rounded-xl border border-surface-line bg-slate-950 px-4 text-base font-bold text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/55"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void loadMembers(memberQuery)}
                    disabled={isLoadingMembers}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-300/35 bg-cyan-300/10 px-4 py-2 text-sm font-black text-cyan-100 transition hover:border-cyan-300/55 disabled:cursor-wait disabled:opacity-70"
                  >
                    {isLoadingMembers ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Search size={16} aria-hidden />}
                    회원 불러오기
                  </button>
                </div>

                {memberError ? <p className="mt-3 rounded-xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm font-bold text-rose-100">{memberError}</p> : null}

                <div className="mt-4 grid max-h-[28rem] gap-2 overflow-y-auto pr-1">
                  {isLoadingMembers && members.length === 0 ? (
                    <p className="rounded-xl border border-surface-line bg-slate-950/50 p-4 text-sm font-bold text-slate-400">회원 목록을 불러오고 있습니다.</p>
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
                          className={`rounded-xl border p-4 text-left transition ${
                            selected ? "border-amber-300/55 bg-amber-300/10" : "border-surface-line bg-slate-950/45 hover:border-cyan-300/35"
                          }`}
                        >
                          <span className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <span className="min-w-0 flex-1">
                              <span className="block break-all text-sm font-black leading-5 text-white">{member.email ?? "이메일 없음"}</span>
                              {member.displayName ? <span className="mt-1 block truncate text-xs text-slate-400">{member.displayName}</span> : null}
                            </span>
                            <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-xs font-black text-slate-300">
                              {member.activePlan ?? member.profilePlan ?? "free"}
                            </span>
                          </span>
                          <span className="mt-3 grid gap-1 text-xs leading-5 text-slate-500 sm:grid-cols-2">
                            <span>가입일 {formatDate(member.createdAt)}</span>
                            <span>권한 만료 {formatDate(member.activeUntil)}</span>
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="rounded-xl border border-surface-line bg-slate-950/50 p-4 text-sm font-bold text-slate-400">
                      표시할 가입 회원이 없습니다. 테스터가 먼저 한 번 로그인해야 목록에 나타납니다.
                    </p>
                  )}
                </div>
              </section>

              <form onSubmit={handleSubmit} className="grid gap-4">
              <label className="grid gap-2 text-sm font-bold text-slate-300">
                선택한 테스터 이메일
                <input
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setSelectedMemberId("");
                    setEmail(event.target.value);
                  }}
                  placeholder="tester@example.com"
                  className="min-h-12 rounded-xl border border-surface-line bg-slate-950 px-4 text-base font-bold text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/55"
                  required={!selectedMemberId}
                />
              </label>

              <fieldset className="grid gap-2">
                <legend className="text-sm font-bold text-slate-300">부여할 권한</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {planOptions.map((option) => (
                    <label
                      key={option.id}
                      className={`cursor-pointer rounded-xl border p-4 transition ${
                        planId === option.id ? "border-amber-300/45 bg-amber-300/10" : "border-surface-line bg-surface-cardSoft hover:border-cyan-300/35"
                      }`}
                    >
                      <input
                        type="radio"
                        name="planId"
                        value={option.id}
                        checked={planId === option.id}
                        onChange={(event) => setPlanId(event.target.value)}
                        className="sr-only"
                      />
                      <span className="flex items-center gap-2 text-sm font-black text-white">
                        <Crown size={15} aria-hidden />
                        {option.label}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-400">{option.description}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

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

              {error ? <p className="rounded-xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm font-bold text-rose-100">{error}</p> : null}
              {message ? <p className="rounded-xl border border-signal-success/25 bg-signal-success/10 p-3 text-sm font-bold text-signal-success">{message}</p> : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-amber-300/35 bg-amber-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-amber-200 disabled:cursor-wait disabled:opacity-70"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ShieldCheck size={16} aria-hidden />}
                권한 부여하기
              </button>
              </form>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-6 text-slate-300">
          이 화면은 결제 상품을 새로 만드는 기능이 아닙니다. 가입된 테스터 계정의 `subscriptions`에 수동 활성 권한을 추가하는 운영 도구입니다.
        </section>

        <AppFooter />
      </div>
    </main>
  );
}
