// 로그인 사용자의 Android 앱 푸시 연결을 검증하기 위한 테스트 발송 API입니다.
import { NextResponse } from "next/server";
import { fetchSupabaseUserOnServer, isSupabaseAdminConfigured, supabaseAdminRest } from "@/lib/server/supabaseAdmin";
import { isFirebaseMessagingConfigured, sendFcmMessage } from "@/lib/server/firebaseMessaging";

interface PushTokenRow {
  token: string;
  platform: string;
}

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? "";
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "앱 푸시 알림 설정을 조회할 수 없습니다." }, { status: 503 });
  }
  if (!isFirebaseMessagingConfigured()) {
    return NextResponse.json({ error: "앱 푸시 알림 발송 설정이 완료되지 않았습니다." }, { status: 503 });
  }

  const accessToken = bearerToken(request);
  if (!accessToken) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const user = await fetchSupabaseUserOnServer(accessToken);
  const tokens = await supabaseAdminRest<PushTokenRow[]>(
    `push_tokens?select=token,platform&user_id=eq.${encodeURIComponent(user.id)}&enabled=eq.true&platform=eq.android&provider=eq.fcm&order=last_registered_at.desc&limit=5`
  );

  if (tokens.length === 0) {
    return NextResponse.json({ error: "등록된 앱 푸시 알림 연결이 없습니다." }, { status: 404 });
  }

  const results = await Promise.allSettled(
    tokens.map((item) =>
      sendFcmMessage({
        token: item.token,
        title: "Chart Radar 테스트 알림",
        body: "앱 푸시 알림이 정상적으로 연결되었습니다.",
        data: {
          type: "push_test",
          target: "/alerts"
        }
      })
    )
  );
  const sent = results.filter((item) => item.status === "fulfilled").length;
  const failed = results.length - sent;

  return NextResponse.json({ ok: sent > 0, sent, failed });
}
