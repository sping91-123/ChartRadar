# 알림 시스템 Profile

## 담당 영역

- Android FCM 앱 푸시.
- push token 저장.
- push cron 자동 스캔.
- 알림 설정과 관리자 진단.

## 관련 파일/디렉터리

- `src/components/RadarAlertCenter.tsx`
- `src/components/RadarAlertMonitor.tsx`
- `src/lib/appPush.ts`
- `src/lib/server/pushAlertScanner.ts`
- `src/lib/server/push/`
- `src/app/api/push-cron/route.ts`
- `src/app/api/push-tokens/route.ts`
- `src/app/api/push-test/route.ts`
- `src/app/api/admin/push-diagnostics/route.ts`

## 자주 발생하는 작업

- FCM token 등록.
- market/rule preference 필터.
- 자동 푸시 threshold, cooldown, diagnostics.
- 테스트 패널 관리자 전용화.

## 고위험 변경

- FCM 발송 로직.
- `push_alert_events` DB write.
- 중복 방지 eventKey.
- token/user_id/email/secret 로그 노출.
- dryRun에서 실제 발송되는 회귀.

## 추천 검증 명령

- `cmd /c npx tsc --noEmit`
- `npm.cmd run build`
- `npm.cmd run smoke:mobile`
- `npm.cmd run smoke:all`
- `npm.cmd run smoke:ops`
- `/api/push-cron?dryRun=1&diagnostics=1` 확인.

## subagent 역할 설명

자동 알림과 앱 푸시 담당이다. 발송 조건, 선호 필터, 중복 방지, diagnostics를 변경할 때 실제 발송과 민감정보 노출을 엄격히 차단한다.
