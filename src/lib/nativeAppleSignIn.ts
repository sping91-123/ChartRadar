import { Capacitor, registerPlugin } from "@capacitor/core";
import { clearSupabaseSession, exchangeAppleIdToken, signOutSupabaseSession } from "@/lib/supabase";

interface AppleSignInPlugin {
  signIn(options: { nonce: string }): Promise<{
    identityToken: string;
    authorizationCode?: string;
    user: string;
    email?: string;
    givenName?: string;
    familyName?: string;
  }>;
}

const AppleSignIn = registerPlugin<AppleSignInPlugin>("AppleSignIn");

function createNonce() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function isIosNativeApp() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

export async function nativeAppleSignIn() {
  if (!isIosNativeApp()) throw new Error("Apple 로그인은 iOS 앱에서만 사용할 수 있습니다.");
  const nonce = createNonce();
  const credential = await AppleSignIn.signIn({ nonce });
  const session = await exchangeAppleIdToken(credential.identityToken, nonce);

  try {
    if (!credential.authorizationCode) throw new Error("Apple authorization code를 받지 못했습니다.");
    const response = await fetch("/api/auth/apple/authorization", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ authorizationCode: credential.authorizationCode })
    });
    if (!response.ok) throw new Error("Apple 계정 삭제 토큰을 안전하게 연결하지 못했습니다.");
    return session;
  } catch (error) {
    clearSupabaseSession();
    await signOutSupabaseSession(session.accessToken, "local").catch(() => undefined);
    throw error;
  }
}
