import { NextResponse } from "next/server";
import { isBodyTooLarge, rateLimit } from "@/lib/server/rateLimit";
import { storeAppleAuthorizationCode } from "@/lib/server/appleAuth";
import { fetchSupabaseUserOnServer } from "@/lib/server/supabaseAdmin";

export async function POST(request: Request) {
  const limit = await rateLimit(request, { key: "apple-authorization", limit: 8, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Apple 로그인 요청이 잠시 많습니다." }, {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfter) }
    });
  }
  if (isBodyTooLarge(request, 8_000)) {
    return NextResponse.json({ error: "요청이 너무 큽니다." }, { status: 413 });
  }

  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const user = token ? await fetchSupabaseUserOnServer(token).catch(() => null) : null;
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { authorizationCode?: unknown };
  const code = typeof body.authorizationCode === "string" ? body.authorizationCode.trim() : "";
  if (!code || code.length > 4096) {
    return NextResponse.json({ error: "Apple authorization code가 필요합니다." }, { status: 400 });
  }
  try {
    await storeAppleAuthorizationCode(user, code);
    return NextResponse.json({ stored: true });
  } catch {
    return NextResponse.json({ error: "Apple 계정 삭제 토큰을 연결하지 못했습니다." }, { status: 503 });
  }
}
