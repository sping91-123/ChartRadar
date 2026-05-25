# P1 pushAlertScanner 구조 분리

- 상태: `TODO`
- 담당방: 알림 시스템
- 인텔리전스: 높음
- 우선순위: P1

## 목표

`src/lib/server/pushAlertScanner.ts`가 너무 커져 자동 알림 조건, 중복 방지, 권한, 진단, 시그널 생성이 한 파일에 몰려 있습니다. 자동 알림이 안정화되는 것을 확인한 뒤, `types`, `thresholds`, `eligibility`, `scanners`, `diagnostics` 등으로 나누는 리팩토링을 진행합니다.

## 완료 기준

- 기능 동작은 유지하면서 자동 알림 로직이 역할별로 분리되어야 합니다.
- 기존 자동 발송 기준, 중복 방지, 관리자 진단 응답이 유지되어야 합니다.
- `docs/push-alert-scanner-refactor-plan.md` 기준으로 단계별 구현합니다.

## 진행 기록

- 1단계: 타입, threshold, 순수 eligibility helper를 `src/lib/server/push/` 아래로 분리합니다. 발송, DB 기록, 중복 방지, 권한 판정은 변경하지 않습니다.

## 검증 기준

- `git diff --check`
- `cmd /c npx tsc --noEmit`
- `npm.cmd run build`
- `npm.cmd run smoke:mobile`
- `npm.cmd run smoke:all`
- `npm.cmd run smoke:ops`
