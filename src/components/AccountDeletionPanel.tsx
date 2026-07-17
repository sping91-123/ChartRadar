"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

interface DeletionRequest {
  id: string;
  status: "pending" | "processing" | "failed" | "canceled" | "completed";
  requested_at: string;
  process_after: string;
}

export function AccountDeletionPanel() {
  const { session, user, isLoading } = useSupabaseAuth();
  const [request, setRequest] = useState<DeletionRequest | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadStatus = useCallback(async () => {
    if (!session?.accessToken) return;
    const response = await fetch("/api/account/deletion", {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store"
    });
    const data = (await response.json().catch(() => ({}))) as { request?: DeletionRequest | null; error?: string };
    if (!response.ok) throw new Error(data.error ?? "삭제 요청 상태를 확인하지 못했습니다.");
    setRequest(data.request ?? null);
  }, [session?.accessToken]);

  useEffect(() => {
    void loadStatus().catch((error) => setMessage(error instanceof Error ? error.message : "상태 확인에 실패했습니다."));
  }, [loadStatus]);

  async function submitRequest(retry = false) {
    if (!session?.accessToken || (!confirmed && !retry)) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/account/deletion", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.accessToken}` }
      });
      const data = (await response.json().catch(() => ({}))) as { request?: DeletionRequest; error?: string };
      if (!response.ok || !data.request) throw new Error(data.error ?? "삭제 요청을 등록하지 못했습니다.");
      setRequest(data.request);
      setMessage("삭제 요청을 접수했습니다. 처리가 시작되기 전까지 취소할 수 있습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "삭제 요청에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelRequest() {
    if (!session?.accessToken) return;
    setBusy(true);
    try {
      const response = await fetch("/api/account/deletion", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.accessToken}` }
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "삭제 요청을 취소하지 못했습니다.");
      setRequest(null);
      setConfirmed(false);
      setMessage("삭제 요청을 취소했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "취소에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 border-y border-surface-line py-5 text-sm text-slate-400">
        <Loader2 className="animate-spin" size={16} /> 계정을 확인하고 있습니다.
      </div>
    );
  }
  if (!user || !session) {
    return (
      <section className="border-y border-surface-line py-5 text-sm leading-7 text-slate-400">
        <p>웹 또는 앱에서 로그인한 뒤 이 페이지로 돌아오면 계정 삭제를 직접 요청할 수 있습니다.</p>
        <Link href="/login?returnTo=%2Faccount%2Fdelete" className="mt-4 inline-flex rounded bg-accent-blue px-4 py-2 font-black text-slate-950">
          로그인하고 삭제 요청
        </Link>
      </section>
    );
  }

  const activeRequest = request && ["pending", "processing", "failed"].includes(request.status);
  const statusLabel = request?.status === "pending"
    ? "처리 대기"
    : request?.status === "processing"
      ? "처리 중"
      : "자동 재시도 대기";

  return (
    <section className="border-y border-rose-300/25 py-5">
      <div className="flex items-start gap-3 text-sm leading-7 text-slate-300">
        <AlertTriangle className="mt-1 shrink-0 text-amber-300" size={18} aria-hidden />
        <p>
          계정 삭제는 Google Play 또는 App Store 구독을 자동으로 해지하지 않습니다. 계속 청구되지 않도록 먼저
          {" "}<a className="font-bold text-accent-blue underline" href="https://play.google.com/store/account/subscriptions" target="_blank" rel="noreferrer">Google Play 구독</a>
          {" "}또는 <a className="font-bold text-accent-blue underline" href="https://apps.apple.com/account/subscriptions" target="_blank" rel="noreferrer">App Store 구독</a>을 확인해 주세요.
        </p>
      </div>

      {activeRequest ? (
        <div className="mt-5 rounded border border-surface-line p-4 text-sm text-slate-300">
          <p className="font-black text-white">현재 상태: {statusLabel}</p>
          <p className="mt-2 text-slate-400">
            요청일 {new Date(request.requested_at).toLocaleString("ko-KR")} · 처리 완료 예정 기한 {new Date(request.process_after).toLocaleDateString("ko-KR")}
          </p>
          {request.status === "pending" ? (
            <button type="button" onClick={cancelRequest} disabled={busy} className="mt-4 rounded border border-surface-line px-4 py-2 font-bold text-white disabled:opacity-50">
              삭제 요청 취소
            </button>
          ) : null}
          {request.status === "failed" ? (
            <button type="button" onClick={() => submitRequest(true)} disabled={busy} className="mt-4 rounded border border-surface-line px-4 py-2 font-bold text-white disabled:opacity-50">
              처리 다시 요청
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mt-5">
          <label className="flex items-start gap-3 text-sm leading-6 text-slate-300">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" />
            <span>삭제되는 앱 데이터와 별도로 스토어 구독은 계속될 수 있다는 안내를 확인했으며 계정 삭제를 요청합니다.</span>
          </label>
          <button type="button" onClick={() => submitRequest()} disabled={!confirmed || busy} className="mt-4 rounded bg-rose-300 px-4 py-2 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "요청 중…" : "계정 삭제 요청"}
          </button>
        </div>
      )}
      {message ? <p className="mt-4 text-sm text-amber-200" aria-live="polite">{message}</p> : null}
    </section>
  );
}
