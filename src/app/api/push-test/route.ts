// 로그인 사용자의 Android 앱 푸시 연결을 검증하기 위한 테스트 발송 API입니다.
import { NextResponse } from "next/server";
import { getPushTestMessage } from "@/lib/pushTestMessages";
import { fetchSupabaseUserOnServer, isSupabaseAdminConfigured, supabaseAdminRest } from "@/lib/server/supabaseAdmin";
import { isFirebaseMessagingConfigured, sendFcmMessage } from "@/lib/server/firebaseMessaging";
import { pushTestRequest } from "@/lib/pushReceiptTest";
import { rateLimit, readJsonBodyLimited } from "@/lib/server/rateLimit";

interface PushTokenRow {
  token: string;
}

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? "";
}

function isAdminUser(user: Awaited<ReturnType<typeof fetchSupabaseUserOnServer>>) {
  return user.app_metadata?.role === "admin";
}

async function recordPushTestEvent(userId: string, message: ReturnType<typeof getPushTestMessage>, sent: number) {
  const eventKey = `push-test:${message.kind}:${Date.now()}`;
  await supabaseAdminRest("push_alert_events", {
    method: "POST",
    body: {
      user_id: userId,
      market: message.market,
      rule_id: "push-test",
      event_key: eventKey,
      title: message.title,
      body: message.body,
      delivery_status: "sent",
      sent_count: sent,
      failed_count: 0,
      sent_at: new Date().toISOString(),
      payload: {
        type: "push_test",
        kind: message.kind,
        alertKind: message.alertKind,
        alert_kind: message.alertKind,
        market: message.market === "stocks" ? "global" : message.market,
        ...(message.symbol ? { symbol: message.symbol } : {}),
        target: message.target,
        targetPath: message.targetPath,
        sent
      }
    }
  });
  return eventKey;
}

export async function POST(request: Request) {
  const requestPath = "/api/push-test";
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "앱 푸시 알림 설정을 조회할 수 없습니다.", requestPath }, { status: 503 });
  }
  if (!isFirebaseMessagingConfigured()) {
    return NextResponse.json({ error: "앱 푸시 알림 발송 설정이 완료되지 않았습니다.", requestPath }, { status: 503 });
  }

  const accessToken = bearerToken(request);
  if (!accessToken) return NextResponse.json({ error: "로그인이 필요합니다.", requestPath }, { status: 401 });

  const parsed = await readJsonBodyLimited<unknown>(request, 6_144);
  if (!parsed.ok) return NextResponse.json({ error: "수신 확인 요청을 확인해 주세요.", requestPath }, { status: 400 });
  const user = await fetchSupabaseUserOnServer(accessToken).catch(() => null);
  if (!user) return NextResponse.json({ error: "다시 로그인해 주세요.", requestPath }, { status: 401 });
  const input = pushTestRequest(parsed.value, isAdminUser(user));
  if (!input) return NextResponse.json({ error: "이 기기 연결 후 수신 확인을 이용해 주세요. 알림 예시는 관리자만 사용할 수 있습니다.", requestPath }, { status: 403 });
  const limited = await rateLimit(request, { key: `push-receipt-test:${user.id}`, includeClientIp: false, limit: 3, windowMs: 5 * 60_000, requireSharedBackend: process.env.NODE_ENV === "production" });
  if (limited.backend === "unavailable") return NextResponse.json({ error: "수신 확인을 잠시 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.", requestPath }, { status: 503 });
  if (!limited.allowed) return NextResponse.json({ error: "수신 확인은 5분에 3회까지 가능합니다. 잠시 후 다시 시도해 주세요.", requestPath }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  const message = getPushTestMessage(input.kind);

  const tokens = await supabaseAdminRest<PushTokenRow[]>(
    `push_tokens?select=token&user_id=eq.${encodeURIComponent(user.id)}&enabled=eq.true&platform=eq.android&provider=eq.fcm${input.token ? `&token=eq.${encodeURIComponent(input.token)}` : ""}&order=last_registered_at.desc&limit=1`
  );
  const latestToken = tokens[0];

  if (!latestToken) {
    return NextResponse.json({ error: "등록된 앱 푸시 알림 연결이 없습니다.", requestPath }, { status: 404 });
  }

  try {
    await sendFcmMessage({
      token: latestToken.token,
      title: message.title,
      body: message.body,
      data: {
        type: "push_test",
        kind: message.kind,
        alertKind: message.alertKind,
        alert_kind: message.alertKind,
        market: message.market === "stocks" ? "global" : message.market,
        ...(message.symbol ? { symbol: message.symbol } : {}),
        target: message.target,
        targetPath: message.targetPath
      }
    });
  } catch (error) {
    console.warn("[push-test] send failed", error);
    return NextResponse.json({ error: "테스트 알림 발송에 실패했습니다.", requestPath }, { status: 502 });
  }

  let eventKey: string | null = null;
  try {
    eventKey = await recordPushTestEvent(user.id, message, 1);
  } catch (error) {
    console.warn("[push-test] event log failed", error);
  }

  return NextResponse.json({ ok: true, sent: 1, failed: 0, kind: message.kind, logged: Boolean(eventKey), eventKey, requestPath });
}
