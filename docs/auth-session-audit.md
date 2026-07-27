# 인증 세션 저장 구조 감사

## 범위

- 기준 작업: `docs/work-queue.md`의 `세션 저장/refresh token 구조 점검`.
- 점검 파일: `src/lib/supabase.ts`, `src/lib/nativeGoogleSignIn.ts`, `src/lib/useSupabaseAuth.ts`, `src/app/layout.tsx`, `src/components/HomeEntryGate.tsx`, `src/components/GoogleLoginButton.tsx`, `src/components/AuthHashRescue.tsx`, `src/app/auth/callback/page.tsx`, `src/app/api/auth/kakao/callback/route.ts`, `.env.example`.
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

1. 루트 `SupabaseAuthProvider`가 마운트 시 한 번만 `getSupabaseSession()`으로 저장 세션을 읽는다. 각 화면의 `useSupabaseAuth()`는 같은 Context 상태를 구독하며 별도 인증 요청을 만들지 않는다.
2. access token 만료 60초 전부터 `refreshSupabaseSession()`이 Supabase refresh endpoint를 호출한다.
3. 같은 refresh token으로 동시에 들어온 갱신은 한 Promise를 공유한다. refresh 성공 시 회전된 access token과 refresh token을 저장한다.
4. refresh endpoint의 400·401·403처럼 토큰이 실제로 거부된 경우에만 현재 저장 세션을 삭제한다.
5. 429·5xx·응답 형식 오류·네트워크 예외는 저장 세션을 보존하고 5초 뒤 재시도한다. 아직 유효한 access token은 그대로 사용한다.
6. 다른 탭이나 새 로그인에서 이미 refresh token이 바뀐 경우 늦은 응답이 새 세션을 덮거나 삭제하지 않는다. 로그아웃 뒤 도착한 refresh 응답도 세션을 되살리지 않는다.
7. corrupt JSON 등 저장 세션 파싱 실패는 `clearSupabaseSession()`으로 정리한다.

## Pro 권한 갱신 흐름

1. 루트 `SupabaseAuthProvider`는 user, profile, active subscriptions를 함께 읽고 공용 entitlement resolver로 최종 plan을 계산한다.
2. `supabaseAuthRefreshEvent`를 받으면 권한을 다시 읽는다.
3. focus, visibilitychange, 30초 interval에서도 공용 Provider 한 곳에서만 silent refresh를 수행한다.
4. manual tester 권한 부여, 앱 구독 동기화, 결제 성공 후 권한 재조회와 충돌하는 별도 상태 저장은 없다.
5. 검증된 invalid refresh token만 삭제한다. 일시 장애 중에는 entitlement를 `unavailable`로 표시하되 로그인 세션은 보존한다.

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
- 대신 루트 `SupabaseAuthProvider`가 localStorage 세션, refresh endpoint, focus/visibility/interval/event 기반 재조회를 한 번만 수행하고 `useSupabaseAuth()`는 Context를 구독한다.
- 이 구조는 단순하지만 Supabase SDK의 built-in session persistence, cookie integration, multi-tab auth broadcast 장점은 쓰지 못한다.

## 2026-07-27 모바일 재진입 회귀 수정

- 운영 Auth 로그에서 한 화면 진입마다 동일 기기의 `/auth/v1/user` 요청이 같은 초에 여러 건 반복됐다. 원인은 20개가 넘는 화면 컴포넌트가 각각 `useSupabaseAuth()`의 effect와 30초 타이머를 실행하던 구조였다.
- 개별 hook을 루트 Provider 하나로 합쳐 `/user`, profile, subscription 조회와 token refresh가 앱 전체에서 한 번만 실행되게 했다.
- 이전에는 어떤 오류든 hook catch에서 `clearSupabaseSession()`을 호출해 모바일 네트워크 전환·서버 일시 장애도 로그아웃으로 바뀌었다. 이제 확실한 인증 거부와 일시 장애를 구분한다.
- Home 진입은 초기 mount 때 한 번 읽은 `hasStoredSession`만 믿지 않고 Provider의 현재 `session`을 사용한다. 세션 복원 중에는 로그인 화면을 먼저 보여주지 않는다.
- 회귀 테스트는 만료 60초 전 선제 갱신, 동시 갱신 단일 요청, 503 보존, invalid token 삭제, 로그아웃 race, 다른 탭의 최신 token 보호를 포함한다.

## 권장 후속 작업

1. 유료화 안정화 후 refresh token을 `localStorage`에서 Capacitor secure storage 또는 OS-backed storage로 이전한다.
2. 웹은 서버 cookie 기반 세션 또는 Supabase SSR auth helper 구조를 별도로 검토한다.
3. Android 앱은 WebView JS에서 refresh token 접근이 필요 없는 native secure session bridge를 검토한다.
4. secure storage 전환 전까지는 CSP, 외부 script 최소화, user-generated HTML 렌더링 금지를 유지한다.
5. `NEXT_PUBLIC_ALLOW_LOCAL_REFRESH_TOKEN=false`는 로그인 장기 유지가 깨질 수 있으므로 대체 저장소 적용 전 운영 기본값으로 두지 않는다.

## 결론

- 출시 차단 수준의 토큰 로그 노출은 발견하지 못했다.
- 현재 refresh token localStorage 저장은 보안상 최종 구조는 아니지만, 앱 재실행 후 Pro 권한 유지라는 현재 요구를 만족하기 위해 의도된 구조다.
- 2026-07-27 보정으로 화면별 중복 인증 요청과 일시 오류 시 강제 로그아웃을 제거했다.
- 현재 수정은 웹 코드이므로 `https://chartradar.kr`를 직접 로드하는 Android 앱에는 웹 배포만으로 반영되며 새 AAB가 필요하지 않다.
