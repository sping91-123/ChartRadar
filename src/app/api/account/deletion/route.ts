import { NextResponse } from "next/server";
import {
  normalizeAccountDeletionRequest,
  type AccountDeletionRequestRpcRow
} from "@/lib/accountDeletionContract";
import { isAccountDeletionProcessingEnabled } from "@/lib/server/accountDeletion";
import { fetchSupabaseUserOnServer, supabaseAdminRest, supabaseAdminRpc } from "@/lib/server/supabaseAdmin";

interface DeletionRequestRow {
  id: string;
  status: "pending" | "processing" | "failed" | "canceled" | "completed";
  requested_at: string;
  process_after: string;
  completed_at?: string | null;
}

function tokenFromRequest(request: Request) {
  return (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

async function requireUser(request: Request) {
  const token = tokenFromRequest(request);
  if (!token) return null;
  return fetchSupabaseUserOnServer(token).catch(() => null);
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  try {
    const rows = await supabaseAdminRest<DeletionRequestRow[]>(
      `account_deletion_requests?select=id,status,requested_at,process_after,completed_at&user_id=eq.${encodeURIComponent(user.id)}&order=requested_at.desc&limit=1`,
      { timeoutMs: 10_000 }
    );
    return NextResponse.json({ request: rows[0] ?? null });
  } catch {
    return NextResponse.json({ error: "삭제 요청 상태를 불러오지 못했습니다." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isAccountDeletionProcessingEnabled()) {
    return NextResponse.json(
      { error: "계정 삭제 처리 준비가 완료되지 않았습니다. 잠시 후 다시 시도해 주세요." },
      { status: 503 }
    );
  }
  try {
    const rows = await supabaseAdminRpc<AccountDeletionRequestRpcRow[]>(
      "request_account_deletion",
      { p_user_id: user.id },
      { timeoutMs: 10_000 }
    );
    const deletionRequest = normalizeAccountDeletionRequest(rows[0]);
    if (!deletionRequest) throw new Error("Deletion request RPC returned no row.");
    return NextResponse.json({ request: deletionRequest }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "삭제 요청을 등록하지 못했습니다." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  try {
    const canceled = await supabaseAdminRpc<boolean>(
      "cancel_account_deletion",
      { p_user_id: user.id },
      { timeoutMs: 10_000 }
    );
    if (!canceled) {
      return NextResponse.json({ error: "처리가 시작된 삭제 요청은 취소할 수 없습니다." }, { status: 409 });
    }
    return NextResponse.json({ canceled: true });
  } catch {
    return NextResponse.json({ error: "삭제 요청을 취소하지 못했습니다." }, { status: 503 });
  }
}
