"use client";
// 결제 성공 후 서버 승인 확인 결과를 사용자에게 보여주는 패널입니다.
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { getActiveSupabaseSession } from "@/lib/supabase";

interface CheckoutConfirmationPanelProps {
  orderId?: string;
  paymentKey?: string;
  amount?: string;
  planId?: string;
}

type ConfirmationState =
  | { status: "checking"; message: string }
  | { status: "active"; message: string }
  | { status: "pending"; message: string }
  | { status: "error"; message: string };

function getToneClass(status: ConfirmationState["status"]) {
  if (status === "active") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
  if (status === "pending") return "border-amber-400/30 bg-amber-400/10 text-amber-100";
  if (status === "error") return "border-rose-400/30 bg-rose-400/10 text-rose-100";
  return "border-cyan-300/30 bg-cyan-300/10 text-cyan-100";
}

function getIcon(status: ConfirmationState["status"]) {
  if (status === "active") return <CheckCircle2 size={18} aria-hidden />;
  if (status === "checking") return <Loader2 className="animate-spin" size={18} aria-hidden />;
  if (status === "pending") return <ShieldCheck size={18} aria-hidden />;
  return <AlertTriangle size={18} aria-hidden />;
}

export function CheckoutConfirmationPanel({ orderId, paymentKey, amount, planId }: CheckoutConfirmationPanelProps) {
  const [state, setState] = useState<ConfirmationState>({
    status: "checking",
    message: "결제 승인 여부를 확인하고 있습니다."
  });

  const canRequest = useMemo(() => Boolean(orderId && amount), [amount, orderId]);

  useEffect(() => {
    let cancelled = false;

    async function confirmPayment() {
      if (!canRequest) {
        setState({
          status: "pending",
          message: "주문번호나 결제 금액이 부족해 자동 확인을 보류했습니다. 결제사 성공 URL 설정을 확인해 주세요."
        });
        return;
      }

      const session = await getActiveSupabaseSession();
      if (!session?.accessToken) {
        setState({
          status: "pending",
          message: "로그인 상태가 아니라 Pro 권한을 자동 반영하지 못했습니다. 로그인 후 새로고침해 주세요."
        });
        return;
      }

      try {
        const response = await fetch("/api/billing/confirm", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            orderId,
            paymentKey,
            amount,
            planId
          })
        });
        const payload = (await response.json().catch(() => ({}))) as {
          status?: ConfirmationState["status"] | "setup_required" | "login_required" | "rejected";
          message?: string;
        };

        if (cancelled) return;

        if (!response.ok || payload.status === "rejected") {
          setState({
            status: "error",
            message: payload.message ?? "결제 승인 확인에 실패했습니다."
          });
          return;
        }

        if (payload.status === "active") {
          setState({
            status: "active",
            message: payload.message ?? "Pro 권한이 활성화되었습니다."
          });
          return;
        }

        setState({
          status: "pending",
          message: payload.message ?? "운영 결제 키가 아직 연결되지 않아 권한 반영을 보류했습니다."
        });
      } catch {
        if (!cancelled) {
          setState({
            status: "error",
            message: "결제 확인 서버와 통신하지 못했습니다. 잠시 후 다시 새로고침해 주세요."
          });
        }
      }
    }

    confirmPayment();
    return () => {
      cancelled = true;
    };
  }, [amount, canRequest, orderId, paymentKey, planId]);

  return (
    <div className={`mt-6 flex items-start gap-3 rounded-md border p-4 text-sm leading-6 ${getToneClass(state.status)}`}>
      <span className="mt-0.5 shrink-0">{getIcon(state.status)}</span>
      <div>
        <p className="font-black">
          {state.status === "checking" ? "승인 확인 중" : state.status === "active" ? "권한 활성화 완료" : state.status === "pending" ? "확인 대기" : "확인 필요"}
        </p>
        <p className="mt-1 opacity-90">{state.message}</p>
      </div>
    </div>
  );
}
