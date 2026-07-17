import { createCipheriv, createDecipheriv, createPrivateKey, randomBytes, sign } from "node:crypto";
import { supabaseAdminRest } from "@/lib/server/supabaseAdmin";
import type { SupabaseUser } from "@/lib/supabase";

interface AppleTokenResponse {
  refresh_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

const appleRequestTimeoutMs = 10_000;

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function requiredAppleConfig() {
  const teamId = process.env.APPLE_TEAM_ID ?? "";
  const keyId = process.env.APPLE_KEY_ID ?? "";
  const clientId = process.env.APPLE_CLIENT_ID ?? "";
  const privateKey = (process.env.APPLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  if (!teamId || !keyId || !clientId || !privateKey) throw new Error("Apple server credentials are incomplete.");
  return { teamId, keyId, clientId, privateKey };
}

function appleClientSecret() {
  const config = requiredAppleConfig();
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "ES256", kid: config.keyId, typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: config.teamId,
    iat: now,
    exp: now + 300,
    aud: "https://appleid.apple.com",
    sub: config.clientId
  }));
  const signingInput = `${header}.${payload}`;
  const signature = sign("sha256", Buffer.from(signingInput), {
    key: createPrivateKey(config.privateKey),
    dsaEncoding: "ieee-p1363"
  });
  return { clientId: config.clientId, secret: `${signingInput}.${base64Url(signature)}` };
}

function encryptionKey() {
  const encoded = process.env.APPLE_TOKEN_ENCRYPTION_KEY ?? "";
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("APPLE_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  return key;
}

function encryptRefreshToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((value) => value.toString("base64url")).join(".");
}

function decryptRefreshToken(payload: string) {
  const [ivValue, tagValue, encryptedValue] = payload.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Stored Apple token is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

async function fetchApple(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), appleRequestTimeoutMs);
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function appleTokenRequest(body: URLSearchParams) {
  const response = await fetchApple("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const payload = (await response.json().catch(() => ({}))) as AppleTokenResponse;
  if (!response.ok) throw new Error(payload.error_description ?? payload.error ?? "Apple token exchange failed.");
  return payload;
}

function appleSubjectFromIdToken(idToken: string | undefined) {
  if (!idToken) return "";
  try {
    const [, payload] = idToken.split(".");
    if (!payload) return "";
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: unknown };
    return typeof parsed.sub === "string" ? parsed.sub : "";
  } catch {
    return "";
  }
}

function appleIdentitySubject(user: SupabaseUser) {
  const identity = user.identities?.find((candidate) => candidate.provider === "apple");
  return identity?.identity_data?.sub ?? identity?.id ?? "";
}

export async function storeAppleAuthorizationCode(user: SupabaseUser, authorizationCode: string) {
  const { clientId, secret } = appleClientSecret();
  const payload = await appleTokenRequest(new URLSearchParams({
    client_id: clientId,
    client_secret: secret,
    code: authorizationCode,
    grant_type: "authorization_code"
  }));
  if (!payload.refresh_token) throw new Error("Apple did not return a refresh token.");
  const expectedSubject = appleIdentitySubject(user);
  const tokenSubject = appleSubjectFromIdToken(payload.id_token);
  if (!expectedSubject || !tokenSubject || expectedSubject !== tokenSubject) {
    throw new Error("Apple authorization code does not belong to the signed-in account.");
  }

  await supabaseAdminRest("oauth_provider_credentials", {
    method: "POST",
    prefer: "resolution=merge-duplicates",
    timeoutMs: appleRequestTimeoutMs,
    body: {
      user_id: user.id,
      provider: "apple",
      encrypted_refresh_token: encryptRefreshToken(payload.refresh_token),
      updated_at: new Date().toISOString()
    }
  });
}

export async function revokeAppleAuthorization(userId: string) {
  const rows = await supabaseAdminRest<Array<{ encrypted_refresh_token: string }>>(
    `oauth_provider_credentials?select=encrypted_refresh_token&user_id=eq.${encodeURIComponent(userId)}&provider=eq.apple&limit=1`,
    { timeoutMs: appleRequestTimeoutMs }
  );
  if (!rows[0]) return { revoked: false, reason: "not_linked" as const };

  const { clientId, secret } = appleClientSecret();
  const response = await fetchApple("https://appleid.apple.com/auth/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: secret,
      token: decryptRefreshToken(rows[0].encrypted_refresh_token),
      token_type_hint: "refresh_token"
    })
  });
  if (!response.ok) throw new Error(`Apple token revocation failed (${response.status}).`);
  await supabaseAdminRest(
    `oauth_provider_credentials?user_id=eq.${encodeURIComponent(userId)}&provider=eq.apple`,
    { method: "DELETE", timeoutMs: appleRequestTimeoutMs }
  );
  return { revoked: true as const };
}
