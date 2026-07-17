import { NextResponse } from "next/server";
import {
  accountDeletionRequestIdPattern,
  isAccountDeletionProcessingEnabled,
  processAccountDeletionRequest,
  type AccountDeletionQueueRow
} from "@/lib/server/accountDeletion";
import { fetchSupabaseUserOnServer, supabaseAdminRest } from "@/lib/server/supabaseAdmin";

async function requireAdmin(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  const user = await fetchSupabaseUserOnServer(token).catch(() => null);
  if (!user) return { error: NextResponse.json({ error: "로그인을 다시 확인해 주세요." }, { status: 401 }) };
  if (user.app_metadata?.role !== "admin") {
    return { error: NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 }) };
  }
  return { user };
}

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.error) return admin.error;
  try {
    const rows = await supabaseAdminRest<AccountDeletionQueueRow[]>(
      "account_deletion_requests?select=id,user_id,status,requested_at,process_after,started_at,next_attempt_at,attempt_count,last_error&status=in.(pending,processing,failed)&order=process_after.asc&limit=100",
      { timeoutMs: 10_000 }
    );
    return NextResponse.json({ requests: rows.map(({ user_id: _userId, ...row }) => row) });
  } catch {
    return NextResponse.json({ error: "삭제 요청 목록을 불러오지 못했습니다." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.error) return admin.error;
  if (!isAccountDeletionProcessingEnabled()) {
    return NextResponse.json({ error: "계정 삭제 처리 gate가 비활성화되어 있습니다." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { requestId?: unknown };
  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  if (!accountDeletionRequestIdPattern.test(requestId)) {
    return NextResponse.json({ error: "올바른 requestId가 필요합니다." }, { status: 400 });
  }

  const result = await processAccountDeletionRequest(requestId);
  if (result.status === "not_started") {
    return NextResponse.json({ error: "처리할 수 있는 요청이 아닙니다." }, { status: 409 });
  }
  if (result.status === "failed") {
    return NextResponse.json({ error: "계정 삭제를 완료하지 못해 자동 재시도 대기 상태로 전환했습니다." }, { status: 503 });
  }
  return NextResponse.json({ completed: true });
}
