// Kakao 로그인 시작 URL을 만들고 CSRF 검증용 쿠키를 저장합니다.
import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { kakaoRestApiKey } from "@/lib/supabase";

const kakaoAuthStateCookie = "chartRadar.kakao.state";
const kakaoAuthReturnToCookie = "chartRadar.kakao.returnTo";
const kakaoCookiePath = "/api/auth/kakao";

function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/crypto";
  return value;
}

function createToken() {
  return randomBytes(24).toString("base64url");
}

function getRequestOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request);
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));

  if (!kakaoRestApiKey) {
    return NextResponse.redirect(new URL(`/login?returnTo=${encodeURIComponent(returnTo)}&error=kakao_setup`, origin));
  }

  const state = createToken();
  const redirectUri = `${origin}/api/auth/kakao/callback`;
  const authorizeUrl = new URL("https://kauth.kakao.com/oauth/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", kakaoRestApiKey);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);
  const scope = process.env.NEXT_PUBLIC_KAKAO_AUTH_SCOPE?.trim();
  if (scope) authorizeUrl.searchParams.set("scope", scope);

  const response = NextResponse.redirect(authorizeUrl);
  const cookieOptions = {
    httpOnly: true,
    maxAge: 600,
    path: kakaoCookiePath,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production"
  };
  response.cookies.set(kakaoAuthStateCookie, state, cookieOptions);
  response.cookies.set(kakaoAuthReturnToCookie, returnTo, cookieOptions);
  return response;
}
