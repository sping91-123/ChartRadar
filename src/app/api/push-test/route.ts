// 로그인 사용자의 Android 앱 푸시 연결을 검증하기 위한 테스트 발송 API입니다.
import { NextResponse } from "next/server";
import { getPushTestMessage, type PushTestKind } from "@/lib/pushTestMessages";
import { fetchSupabaseUserOnServer, isSupabaseAdminConfigured, supabaseAdminRest } from "@/lib/server/supabaseAdmin";
import { isFirebaseMessagingConfigured, sendFcmMessage } from "@/lib/server/firebaseMessaging";

interface PushTokenRow {
  token: string;
}

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? "";
}

function isAdminUser(user: Awaited<ReturnType<typeof fetchSupabaseUserOnServer>>) {
  return user.app_metadata?.role === "admin" || user.app_metadata?.plan === "admin";
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

  const body = (await request.json().catch(() => ({}))) as { kind?: PushTestKind };
  const message = getPushTestMessage(body.kind);
  const user = await fetchSupabaseUserOnServer(accessToken);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: "관리자 계정만 테스트 알림을 보낼 수 있습니다.", requestPath }, { status: 403 });
  }

  const tokens = await supabaseAdminRest<PushTokenRow[]>(
    `push_tokens?select=token&user_id=eq.${encodeURIComponent(user.id)}&enabled=eq.true&platform=eq.android&provider=eq.fcm&order=last_registered_at.desc&limit=1`
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
