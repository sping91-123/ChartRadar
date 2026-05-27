# 관리자 콘솔 운영 백오피스 Profile

## 담당 영역

- 관리자 콘솔.
- 사용자 entitlement 보정.
- 운영 진단 API와 관리자 전용 화면.

## 관련 파일/디렉터리

- `src/app/admin/entitlements/page.tsx`
- `src/app/api/admin/entitlements/route.ts`
- `src/app/api/admin/health/route.ts`
- `src/app/api/admin/push-diagnostics/route.ts`
- `src/lib/server/supabaseAdmin.ts`
- `src/lib/server/billingEntitlements.ts`

## 자주 발생하는 작업

- 관리자 권한 확인.
- 사용자 구독/권한 보정.
- 운영 health와 push diagnostics 확인.
- 관리자 전용 UI 노출 범위 점검.

## 고위험 변경

- service role REST write.
- 관리자 판정 로직.
- 사용자 plan/subscription 변경.
- 운영 내부 정보 공개 범위.

## 추천 검증 명령

- `cmd /c npx tsc --noEmit`
- `npm.cmd run build`
- `npm.cmd run smoke:ops`
- `npm.cmd run smoke:billing`
- `npm.cmd run smoke:all`

## subagent 역할 설명

운영 백오피스 담당이다. 관리자 권한이 없는 사용자에게 도구가 노출되지 않게 하고, service role write는 최소 범위로 유지한다.
