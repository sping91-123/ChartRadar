// Android 네이티브 Google Sign-In 결과를 Supabase 세션으로 교환합니다.
import { Capacitor } from "@capacitor/core";
import { ErrorCode, GoogleSignIn } from "@capawesome/capacitor-google-sign-in";
import { exchangeGoogleIdToken, googleOAuthClientId, isGoogleOAuthConfigured, supabaseAuthRefreshEvent, type SupabaseSession } from "@/lib/supabase";

let initializePromise: Promise<void> | null = null;

export function isAndroidNativeApp() {
  if (Capacitor.getPlatform() !== "android") return false;
  if (Capacitor.isNativePlatform()) return true;
  if (typeof window === "undefined") return false;
  return Boolean((window as Window & { androidBridge?: unknown }).androidBridge);
}

function createNonce() {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashNonce(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function initializeNativeGoogleSignIn() {
  if (!isGoogleOAuthConfigured()) throw new Error("Google 로그인 설정이 아직 연결되지 않았습니다.");
  initializePromise ??= GoogleSignIn.initialize({ clientId: googleOAuthClientId });
  return initializePromise;
}

export async function nativeGoogleSignIn(): Promise<SupabaseSession> {
  if (!isAndroidNativeApp()) throw new Error("Android 앱에서만 사용할 수 있는 로그인 방식입니다.");

  await initializeNativeGoogleSignIn();
  const nonce = createNonce();
  const hashedNonce = await hashNonce(nonce);
  const result = await GoogleSignIn.signIn({ nonce: hashedNonce });
  if (!result.idToken) throw new Error("Google 로그인 정보를 받지 못했습니다. 다시 시도해 주세요.");

  const session = await exchangeGoogleIdToken(result.idToken, nonce);
  window.dispatchEvent(new Event(supabaseAuthRefreshEvent));
  return session;
}

export function getNativeGoogleSignInErrorMessage(error: unknown) {
  const errorCode =
    typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const errorMessage = error instanceof Error ? error.message : String(error ?? "");

  if (
    errorCode === ErrorCode.SignInCanceled ||
    errorMessage.includes(ErrorCode.SignInCanceled) ||
    errorMessage.toLowerCase().includes("canceled")
  ) {
    return "계정 선택이 완료되지 않았습니다. 계정을 선택했는데 반복되면 Google Cloud Android OAuth Client의 패키지명과 SHA-1 설정을 확인해 주세요.";
  }
  return errorMessage || "Google 로그인 처리에 실패했습니다. 다시 시도해 주세요.";
}

export async function nativeGoogleSignOut() {
  if (!isAndroidNativeApp()) return;
  await GoogleSignIn.signOut();
}
