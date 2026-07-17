// Kakao 인가코드를 ID token으로 바꾸고 Supabase 세션으로 교환합니다.
import { NextRequest, NextResponse } from "next/server";
import { kakaoRestApiKey, supabasePublishableKey, supabaseUrl } from "@/lib/supabase";
import { safeReturnTo, trustedRequestOrigin } from "@/lib/authRedirect";

const kakaoAuthStateCookie = "chartRadar.kakao.state";
const kakaoAuthReturnToCookie = "chartRadar.kakao.returnTo";
const kakaoCookiePath = "/api/auth/kakao";

interface KakaoTokenResponse {
  id_token?: string;
  error?: string;
  error_description?: string;
}

interface SupabaseTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
  msg?: string;
}

function redirectToLogin(origin: string, returnTo: string, error: string, description?: string) {
  const url = new URL("/login", origin);
  url.searchParams.set("returnTo", returnTo);
  url.searchParams.set("error", error);
  if (description) url.searchParams.set("error_description", description);
  return url;
}

function clearKakaoCookies(response: NextResponse) {
  const expiredCookieOptions = { maxAge: 0, path: kakaoCookiePath };
  response.cookies.set(kakaoAuthStateCookie, "", expiredCookieOptions);
  response.cookies.set(kakaoAuthReturnToCookie, "", expiredCookieOptions);
}

export async function GET(request: NextRequest) {
  let origin: string;
  try {
    origin = trustedRequestOrigin(request.url);
  } catch {
    return NextResponse.json({ error: "Trusted application origin is not configured." }, { status: 503 });
  }
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const returnedState = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(kakaoAuthStateCookie)?.value;
  const returnTo = safeReturnTo(request.cookies.get(kakaoAuthReturnToCookie)?.value);

  if (error || !code || !returnedState || !expectedState || returnedState !== expectedState) {
    const response = NextResponse.redirect(redirectToLogin(origin, returnTo, error ?? "kakao_auth_failed"));
    clearKakaoCookies(response);
    return response;
  }

  if (!kakaoRestApiKey || !supabaseUrl || !supabasePublishableKey) {
    const response = NextResponse.redirect(redirectToLogin(origin, returnTo, "kakao_setup"));
    clearKakaoCookies(response);
    return response;
  }

  const redirectUri = `${origin}/api/auth/kakao/callback`;
  const kakaoTokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: kakaoRestApiKey,
    redirect_uri: redirectUri,
    code
  });
  if (process.env.KAKAO_CLIENT_SECRET) {
    kakaoTokenBody.set("client_secret", process.env.KAKAO_CLIENT_SECRET);
  }

  const kakaoTokenResponse = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: kakaoTokenBody
  });
  const kakaoTokenPayload = (await kakaoTokenResponse.json()) as KakaoTokenResponse;

  if (!kakaoTokenResponse.ok || !kakaoTokenPayload.id_token) {
    const response = NextResponse.redirect(
      redirectToLogin(
        origin,
        returnTo,
        kakaoTokenPayload.error ?? "kakao_token_failed",
        kakaoTokenPayload.error_description
      )
    );
    clearKakaoCookies(response);
    return response;
  }

  const supabaseTokenResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=id_token`, {
    method: "POST",
    headers: {
      apikey: supabasePublishableKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      provider: "kakao",
      id_token: kakaoTokenPayload.id_token
    })
  });
  const supabaseTokenPayload = (await supabaseTokenResponse.json()) as SupabaseTokenResponse;

  if (!supabaseTokenResponse.ok || !supabaseTokenPayload.access_token) {
    const response = NextResponse.redirect(
      redirectToLogin(
        origin,
        returnTo,
        supabaseTokenPayload.error ?? supabaseTokenPayload.msg ?? "supabase_kakao_failed",
        supabaseTokenPayload.error_description ?? supabaseTokenPayload.msg
      )
    );
    clearKakaoCookies(response);
    return response;
  }

  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("returnTo", returnTo);
  const hash = new URLSearchParams({
    access_token: supabaseTokenPayload.access_token,
    expires_in: String(supabaseTokenPayload.expires_in ?? 3600),
    token_type: supabaseTokenPayload.token_type ?? "bearer"
  });
  if (supabaseTokenPayload.refresh_token) hash.set("refresh_token", supabaseTokenPayload.refresh_token);
  callbackUrl.hash = hash.toString();

  const response = NextResponse.redirect(callbackUrl);
  clearKakaoCookies(response);
  return response;
}
