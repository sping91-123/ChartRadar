# 인증 세션 저장 구조 감사

## 범위

- 기준 작업: `docs/work-queue.md`의 `세션 저장/refresh token 구조 점검`.
- 점검 파일: `src/lib/supabase.ts`, `src/lib/nativeGoogleSignIn.ts`, `src/lib/useSupabaseAuth.ts`, `src/components/GoogleLoginButton.tsx`, `src/components/AuthHashRescue.tsx`, `src/app/auth/callback/page.tsx`, `src/app/api/auth/kakao/callback/route.ts`, `.env.example`.
- 제외 범위: Google OAuth 프로젝트/콘솔 정리, OAuth consent screen 수정, 로그인 UX 대공사, 결제/푸시/레이더 로직 변경.

## 현재 세션 저장 구조

1. ChartRadar는 `supabase-js`의 기본 세션 저장을 쓰지 않고 `src/lib/supabase.ts`의 경량 세션 유틸을 사용한다.
2. 저장 키는 `chartRadar.supabase.session`이며 저장소는 브라우저와 Android WebView 모두 `localStorage`다.
3. 저장되는 값은 `accessToken`, `refreshToken`, `expiresAt`, `tokenType`이다.
4. `NEXT_PUBLIC_ALLOW_LOCAL_REFRESH_TOKEN !== "false"`이면 refresh token을 함께 저장한다.
5. `NEXT_PUBLIC_ALLOW_LOCAL_REFRESH_TOKEN=false`이면 refresh token은 저장하지 않고 access token, 만료 시각, token type만 저장한다.
6. 이전 브랜드/이전 키의 세션은 읽은 뒤 현재 키로 이전하고 레거시 키를 제거한다.

## 로그인과 세션 생성 흐름

### Android 네이티브 Google 로그인

1. `GoogleLoginButton`이 Android 앱 환경을 감지하면 WebView OAuth나 GIS script 대신 `nativeGoogleSignIn()`을 호출한다.
2. `nativeGoogleSignIn()`은 `@capawesome/capacitor-google-sign-in`에서 Google `idToken`을 받는다.
3. `exchangeGoogleIdToken()`이 Supabase `/auth/v1/token?grant_type=id_token`에 `provider=google`, `id_token`, `nonce`를 보내 Supabase 세션으로 교환한다.
4. 반환된 Supabase access token과 refresh token은 `saveSupabaseSession()`을 통해 `localStorage`에 저장된다.

### 웹 Google OAuth와 Kakao 로그인

1. 웹 Google OAuth와 Kakao callback은 `/auth/callback` 또는 hash rescue 흐름에서 URL hash의 `access_token`, `refresh_token`을 읽는다.
2. `parseSessionFromHash()`가 Supabase 세션 객체로 변환하고 `saveSupabaseSession()`이 저장한다.
3. 저장 후 callback/hash rescue는 `history.replaceState()` 또는 `location.replace()`로 hash를 제거한다.

## 세션 복구와 refresh 흐름

1. `useSupabaseAuth()`는 마운트 시 `getSupabaseSession()`으로 저장 세션을 읽는다.
2. `expiresAt`이 지났고 `refreshToken`이 있으면 `refreshSupabaseSession()`이 Supabase refresh endpoint를 호출한다.
3. refresh 성공 시 새 access token과 새 refresh token 또는 기존 refresh token을 다시 저장한다.
4. refresh 실패 시 `clearSupabaseSession()`으로 저장 세션을 삭제한다.
5. 세션이 없으면 user/profile 상태를 null로 만든다.
6. corrupt JSON 등 저장 세션 파싱 실패 시 이번 점검에서 `clearSupabaseSession()`으로 정리하도록 최소 보정했다.

## Pro 권한 갱신 흐름

1. `useSupabaseAuth()`는 user, profile, active subscriptions를 함께 읽고 `applySupabaseAuthEntitlement()`로 최종 plan을 계산한다.
2. `supabaseAuthRefreshEvent`를 받으면 권한을 다시 읽는다.
3. focus, visibilitychange, 30초 interval에서도 silent refresh를 수행한다.
4. manual tester 권한 부여, 앱 구독 동기화, 결제 성공 후 권한 재조회와 충돌하는 별도 상태 저장은 없다.
5. 세션 refresh 실패는 `refreshSupabaseSession()`에서 저장 세션을 삭제하므로 만료된 refresh token이 오래 유지되는 구조는 아니다.

## 로그아웃 정리 상태

1. `signOut()`은 네이티브 Google Sign-In signOut을 호출하고 `clearSupabaseSession()`으로 localStorage 세션을 제거한다.
2. 이번 점검에서 네이티브 signOut 실패가 unhandled rejection으로 남지 않도록 `.catch(() => undefined)`를 추가했다.
3. `clearSupabaseSession()`은 현재 세션 키와 레거시 세션 키 3개를 제거한다.
4. OAuth returnTo, splash skip 같은 `sessionStorage` 값은 인증 토큰이 아니며 저장 기간도 브라우저 세션 단위라 이번 최소 보정 대상에서 제외했다.

## refresh token 저장 위험도

- 현재 `NEXT_PUBLIC_ALLOW_LOCAL_REFRESH_TOKEN=true`가 기본 예시다.
- 이 값이 true이면 refresh token이 `localStorage`에 저장된다.
- 장점은 앱 재실행, WebView 재시작, 브라우저 종료 후에도 로그인과 Pro 권한이 유지된다는 점이다.
- 위험은 XSS 또는 WebView 내 임의 스크립트 실행이 발생하면 refresh token이 노출될 수 있다는 점이다.
- 현재 구조는 결제 후 앱을 껐다 켜도 권한이 유지되어야 하는 출시 요구를 만족하기 위한 현실적 임시 구조다.
- 유료화 안정화 후에는 더 안전한 저장소로 옮기는 것이 맞다.

## Android WebView와 웹 브라우저 차이

- 두 환경 모두 최종 Supabase 세션 저장소는 `localStorage`다.
- Android 앱은 Google ID token을 네이티브 플러그인으로 받은 뒤 Supabase 세션으로 교환한다.
- 웹 브라우저는 Supabase OAuth callback 또는 Kakao callback을 통해 세션 hash를 받아 저장한다.
- Android WebView의 `localStorage`는 앱 데이터 삭제 또는 앱 재설치 시 사라진다.
- 일반 브라우저의 `localStorage`는 사이트 데이터 삭제, 시크릿 모드 종료, 브라우저 정책에 따라 사라질 수 있다.

## 토큰 로그와 UI 노출 점검

- `idToken`, `accessToken`, `refreshToken`을 `console.log`, `console.info`, `console.warn`, UI 문구에 직접 출력하는 코드는 발견하지 못했다.
- Authorization header로 access token을 보내는 API 호출은 존재하지만 로그 출력은 아니다.
- 앱 푸시 쪽은 FCM token을 localStorage에 저장하고 서버로 전송하지만, registration log는 `hasValue`만 출력한다. 이 항목은 인증 refresh token과 별개다.

## Supabase auth state listener 구조

- 현재는 `supabase-js` 클라이언트와 `onAuthStateChange` listener를 사용하지 않는다.
- 대신 커스텀 `useSupabaseAuth()` hook이 localStorage 세션, refresh endpoint, focus/visibility/interval/event 기반 재조회로 상태를 관리한다.
- 이 구조는 단순하지만 Supabase SDK의 built-in session persistence, cookie integration, multi-tab auth broadcast 장점은 쓰지 못한다.

## 권장 후속 작업

1. 유료화 안정화 후 refresh token을 `localStorage`에서 Capacitor secure storage 또는 OS-backed storage로 이전한다.
2. 웹은 서버 cookie 기반 세션 또는 Supabase SSR auth helper 구조를 별도로 검토한다.
3. Android 앱은 WebView JS에서 refresh token 접근이 필요 없는 native secure session bridge를 검토한다.
4. secure storage 전환 전까지는 CSP, 외부 script 최소화, user-generated HTML 렌더링 금지를 유지한다.
5. `NEXT_PUBLIC_ALLOW_LOCAL_REFRESH_TOKEN=false`는 로그인 장기 유지가 깨질 수 있으므로 대체 저장소 적용 전 운영 기본값으로 두지 않는다.

## 결론

- 출시 차단 수준의 토큰 로그 노출은 발견하지 못했다.
- 현재 refresh token localStorage 저장은 보안상 최종 구조는 아니지만, 앱 재실행 후 Pro 권한 유지라는 현재 요구를 만족하기 위해 의도된 구조다.
- 이번 작업에서는 대공사 없이 corrupt session 정리와 네이티브 signOut 실패 흡수만 최소 보정했다.
