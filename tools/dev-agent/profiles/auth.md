# 인증 / 계정 / 사용자 데이터 Profile

## 담당 영역

- 로그인, Google OAuth, Supabase session.
- 계정 관리, 로그아웃, 계정 삭제 안내.
- 세션 저장과 refresh token 정책.

## 관련 파일/디렉터리

- `src/app/login/page.tsx`
- `src/app/auth/callback/page.tsx`
- `src/app/account/`
- `src/lib/supabase.ts`
- `src/lib/nativeGoogleAuth.ts`
- `src/components/HeaderActions.tsx`
- `docs/auth-session-audit.md`

## 자주 발생하는 작업

- Google 로그인 오류 점검.
- 세션 복구와 localStorage 정책 점검.
- 계정 삭제 안내 접근성.
- 관리자 계정 판정.

## 고위험 변경

- OAuth Client ID.
- refresh token 저장.
- Supabase Provider.
- 세션 삭제/복구 로직.

## 추천 검증 명령

- `cmd /c npx tsc --noEmit`
- `npm.cmd run build`
- `npm.cmd run smoke:mobile`
- `npm.cmd run smoke:all`

## subagent 역할 설명

인증과 사용자 데이터 담당이다. token 원문을 출력하지 않고, 콘솔 설정과 코드 변경을 분리해 기록한다.
