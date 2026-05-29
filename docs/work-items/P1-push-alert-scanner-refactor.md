# P1 pushAlertScanner 구조 분리

- 상태: `IN_PROGRESS`
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

- 1단계 일부 완료: 타입, threshold, eligibility helper를 `src/lib/server/push/` 아래로 분리했습니다. 관련 커밋: `8ee06a7`.
- 2단계 일부 완료: entitlement, preference, duplicate guard helper를 분리했습니다. 관련 커밋: `aa06cae`, `b6cfb91`, `029f69c`.
- 3단계 일부 완료: optional source scanner를 `src/lib/server/push/scanners/` 아래로 분리했습니다. 관련 커밋: `7f1168a`.
- diagnostics helper 분리 완료: `emptyDiagnostics`, `eventDiagnosticSample`, `pushSample`, `eventDiagnostic`, `pushPreferenceSkippedSample`을 `src/lib/server/push/diagnostics.ts`로 분리했습니다. 관련 커밋: `19b116d`.
- target helper 분리 완료: `cryptoSetupTargetPath`, `stockSetupTargetPath`, `setupTargetPath`, `stockSetupAlertKind`, `stockIndexSymbols`를 `src/lib/server/push/targets.ts`로 분리했습니다. 관련 커밋: `1bedd46`.
- event builder helper 분리 완료: setup/watchlist event 변환, 글로벌 composite event, market scout limit/batch helper를 `src/lib/server/push/eventBuilders.ts`로 분리했습니다. 관련 커밋은 이 문서 갱신 커밋입니다.
- FCM 발송 helper 분리 완료: `sendEventToUser`와 FCM 결과 집계를 `src/lib/server/push/sendPush.ts`로 분리했습니다. 관련 커밋은 이 문서 갱신 커밋입니다.
- recent event/cooldown helper 분리 완료: cooldown 판정과 dry-run recent row 변환을 `src/lib/server/push/cooldown.ts`로 분리했습니다. 관련 커밋은 이 문서 갱신 커밋입니다.
- crypto/global setup scanner 분리 완료: crypto setup scan, stock setup scan, global momentum symbol 목록을 `src/lib/server/push/scanners/setupScanner.ts`로 분리했습니다. 관련 커밋은 이 문서 갱신 커밋입니다.
- preset helper 분리 완료: preset row 변환, market/user grouping, preset scan input/count helper를 `src/lib/server/push/presets.ts`로 분리했습니다. 관련 커밋은 이 문서 갱신 커밋입니다.
- personalization helper 분리 완료: 사용자 저장 조건 기반 이벤트 개인화와 알트 market scout 문구 보정을 `src/lib/server/push/personalization.ts`로 분리했습니다. 관련 커밋은 이 문서 갱신 커밋입니다.
- preset event helper 분리 완료: 사용자 저장 조건과 스캔 결과를 watchlist/global preset 이벤트로 변환하는 로직을 `src/lib/server/push/presetEvents.ts`로 분리했습니다. 관련 커밋은 이 문서 갱신 커밋입니다.
- 현재 `src/lib/server/push/` 아래에는 `types`, `thresholds`, `eligibility`, `entitlements`, `preferences`, `duplicateGuard`, `sourceResults`, `diagnostics`, `targets`, `eventBuilders`, `sendPush`, `cooldown`, `presets`, `personalization`, `presetEvents`, `scanners/`가 분리되어 있습니다.
- 다음 작은 후보: user loop/orchestration helper를 동작 변경 없이 진행합니다. 발송 정책, `push_alert_events` DB 기록, 중복 방지 event key, 권한 판정, threshold 정책은 변경하지 않습니다.

## 검증 기준

- `git diff --check`
- `cmd /c npx tsc --noEmit`
- `npm.cmd run build`
- `npm.cmd run smoke:mobile`
- `npm.cmd run smoke:all`
- `npm.cmd run smoke:ops`
