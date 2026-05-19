// Firebase Cloud Messaging HTTP v1 발송을 위한 최소 서버 유틸입니다.
import { createSign } from "node:crypto";

interface FirebaseServiceAccount {
  project_id?: string;
  client_email?: string;
  private_key?: string;
}

interface FcmMessageParams {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  channelId?: string;
}

let cachedAccessToken: { value: string; expiresAt: number } | null = null;

function base64Url(value: string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function getFirebaseServiceAccount(): Required<FirebaseServiceAccount> | null {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as FirebaseServiceAccount;
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        return {
          project_id: parsed.project_id,
          client_email: parsed.client_email,
          private_key: parsed.private_key
        };
      }
    } catch {
      return null;
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) return null;

  return {
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey
  };
}

export function isFirebaseMessagingConfigured() {
  return Boolean(getFirebaseServiceAccount());
}

async function getFirebaseAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt - 60 > now) return cachedAccessToken.value;

  const serviceAccount = getFirebaseServiceAccount();
  if (!serviceAccount) throw new Error("Firebase 서비스 계정 환경변수가 설정되지 않았습니다.");

  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600
    })
  );
  const unsignedJwt = `${header}.${claims}`;
  const signature = createSign("RSA-SHA256").update(unsignedJwt).sign(serviceAccount.private_key, "base64url");
  const assertion = `${unsignedJwt}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    }),
    cache: "no-store"
  });

  if (!response.ok) throw new Error("Firebase access token 발급에 실패했습니다.");
  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) throw new Error("Firebase access token 응답이 올바르지 않습니다.");

  cachedAccessToken = {
    value: payload.access_token,
    expiresAt: now + (payload.expires_in ?? 3600)
  };
  return cachedAccessToken.value;
}

export async function sendFcmMessage(params: FcmMessageParams) {
  const serviceAccount = getFirebaseServiceAccount();
  if (!serviceAccount) throw new Error("Firebase 서비스 계정 환경변수가 설정되지 않았습니다.");

  const accessToken = await getFirebaseAccessToken();
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: {
        token: params.token,
        notification: {
          title: params.title,
          body: params.body
        },
        data: params.data ?? {},
        android: {
          priority: "HIGH",
          notification: {
            channel_id: params.channelId ?? "radar-alerts",
            icon: "ic_stat_chart_radar",
            color: "#0284c7",
            click_action: "OPEN_ALERTS"
          }
        }
      }
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "FCM 발송에 실패했습니다.");
  }

  return (await response.json()) as { name?: string };
}
