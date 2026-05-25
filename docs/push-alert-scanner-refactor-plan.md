# pushAlertScanner 구조 분리 설계

이 문서는 `src/lib/server/pushAlertScanner.ts`를 즉시 리팩토링하지 않고, 자동 푸시 안정화 상태를 보존한 채 단계적으로 분리하기 위한 설계 기록이다. 현재 자동 푸시는 최근 threshold, 진단, 푸시 탭 라우팅까지 여러 번 수정된 상태이므로, 첫 구현 단계는 동작 변경이 없는 추출부터 시작해야 한다.

## 1. 현재 구조 요약

`pushAlertScanner.ts`는 Vercel Cron에서 호출되는 자동 푸시의 핵심 오케스트레이터이면서, 다음 역할을 한 파일 안에서 모두 처리한다.

| 역할 | 현재 위치와 책임 | 분리 필요성 |
| --- | --- | --- |
| 타입 정의 | `PushTokenRow`, `PushAlertEvent`, `PushScanDiagnostics` 등 | API, 진단 UI, scanner가 같은 타입을 공유하므로 별도 타입 파일이 필요하다 |
| threshold 정의 | 메이저 80점, 알트 82점, 알트 market scout 85점, A급 최소 80점 등 | 낮은 점수 오발송을 막는 정책이라 변경 추적과 테스트가 쉬워야 한다 |
| target path 계산 | `setupTargetPath`, `cryptoSetupTargetPath`, `stockSetupTargetPath` | 서버 payload와 앱 탭 라우팅 정책이 맞아야 한다 |
| 권한 판정 | `profilePlan`, `subscriptionPlan`, `userPlan`, `ruleAllowed` | Pro/Basic 차단과 시스템 알림 예외가 섞여 있다 |
| 선호 필터 | `tokenWants` | `push_tokens.markets`, `rule_ids` 해석을 발송 루프와 분리할 필요가 있다 |
| 중복 방지 | `alreadySent`, `recordSentEvent`, `eventBucket`, `duplicateBucket` | `event_key` 정책이 깨지면 미발송 또는 중복 발송으로 바로 이어진다 |
| 코인/알트 스캔 | `scanCryptoSetups`, `topPushSetups`, `setupToEvent` | UI setup 계산과 서버 후보 생성의 차이를 추적하기 어렵다 |
| 글로벌 스캔 | `scanStockSetups`, `buildStockSetup`, `buildRiskOffEvent`, `buildSemiconductorLeadershipEvent` | 글로벌 자산, 리스크오프, 반도체 주도력 조건이 한 파일에 누적되어 있다 |
| 청산압력 스캔 | `scanLiquidationEvent` | optional source 실패와 인증 이슈가 있었으므로 독립 검증이 필요하다 |
| 뉴스/매크로 스캔 | `scanNewsEvent`, `scanMacroCalendarEvent` | 내부 HTTP 호출과 이벤트 생성 정책을 분리할 수 있다 |
| FCM 발송 | `sendEventToUser`, `sendFcmMessage` 호출 | 발송 대상 필터, 중복 방지, 이벤트 기록이 섞여 있다 |
| 이벤트 기록 | `push_alert_events` 조회와 insert | 기록 실패가 전체 cron에 미치는 영향을 명확히 해야 한다 |
| dryRun/diagnostics | `eventDiagnostic`, 샘플 수집, 카운트 누적 | 운영 진단 API와 UI가 의존하므로 변경 안정성이 중요하다 |
| error handling | `readRows`, `scanRows`, optional source wrapper, user loop try/catch | 한 사용자나 소스 실패가 전체 cron 500으로 번지지 않아야 한다 |

관련 호출 흐름은 `src/app/api/push-cron/route.ts`가 `runPushAlertScan`을 실행하고, `src/app/api/admin/push-diagnostics/route.ts`가 같은 함수를 dry-run으로 호출해 관리자 진단 화면에 전달하는 구조다. `src/components/RadarAlertCenter.tsx`는 알림 설정, 앱 푸시 연결 상태, 관리자 테스트 패널, 관리자 dry-run 진단 UI를 함께 보여준다.

## 2. 현재 파일의 문제점

- 역할 경계가 약해 threshold, 후보 생성, 권한, 중복 방지, 발송, 진단 카운트가 같은 루프에서 함께 변경된다.
- 코인 market scout, 관심코인 watchlist, 글로벌 setup, 청산압력, 매크로 이벤트가 같은 `PushAlertEvent`로 합쳐지기 전의 기준을 추적하기 어렵다.
- dry-run 진단값과 실제 발송 루프가 같은 카운터를 공유하므로 이름 변경이나 필터 변경 시 운영 해석이 흔들릴 수 있다.
- optional source 실패는 현재 전체 cron을 죽이지 않도록 보강되어 있지만, 각 source별 인증과 응답 형식이 scanner 본문에 묻혀 있다.
- `push_alert_events` 중복 방지와 FCM 발송이 같은 함수 안에 있어 발송 전후 실패 처리를 독립적으로 테스트하기 어렵다.
- 관리자 UI와 API가 `PushScanDiagnostics` 구조를 암묵적으로 의존하므로 타입 변경 시 프론트 회귀가 발생하기 쉽다.

## 3. 역할별 분리 후보

| 후보 모듈 | 담당 역할 | 초기 추출 난이도 |
| --- | --- | --- |
| `src/lib/server/push/types.ts` | `PushTokenRow`, `PushAlertEvent`, diagnostics 타입 | 낮음 |
| `src/lib/server/push/thresholds.ts` | score threshold, quality gate, threshold label | 낮음 |
| `src/lib/server/push/targets.ts` | `targetPath`, symbol 분류, 내부 경로 정책 | 낮음 |
| `src/lib/server/push/entitlements.ts` | profile/subscription plan 결합, ruleAllowed | 중간 |
| `src/lib/server/push/preferences.ts` | token market/rule 선호 필터 | 낮음 |
| `src/lib/server/push/duplicateGuard.ts` | event bucket, alreadySent, recordSentEvent | 중간 |
| `src/lib/server/push/eventBuilders.ts` | setup event, watchlist event, global composite event 변환 | 중간 |
| `src/lib/server/push/diagnostics.ts` | diagnostics 초기값, 샘플, eventDiagnostic 생성 | 중간 |
| `src/lib/server/push/scanners/cryptoScanner.ts` | crypto setup fetch, top 후보 추출 | 중간 |
| `src/lib/server/push/scanners/globalScanner.ts` | stock setup, risk-off, semiconductor leadership | 중간~높음 |
| `src/lib/server/push/scanners/liquidationScanner.ts` | 청산압력 source와 이벤트 변환 | 낮음~중간 |
| `src/lib/server/push/scanners/macroScanner.ts` | radar-news, macro-calendar optional event | 중간 |
| `src/lib/server/push/sendPush.ts` | FCM 발송, 발송 결과 집계 | 중간 |
| `src/lib/server/pushAlertScanner.ts` | thin orchestrator 유지 | 마지막 단계 |

## 4. 추천 파일 구조

```text
src/lib/server/push/
  types.ts
  thresholds.ts
  targets.ts
  entitlements.ts
  preferences.ts
  duplicateGuard.ts
  eventBuilders.ts
  diagnostics.ts
  sendPush.ts
  scanners/
    cryptoScanner.ts
    globalScanner.ts
    liquidationScanner.ts
    macroScanner.ts
src/lib/server/pushAlertScanner.ts
```

최종 형태에서 `pushAlertScanner.ts`는 데이터 조회, scanner 실행, 사용자별 후보 결합, 품질 gate, 권한 gate, 발송 또는 dry-run 분기를 순서대로 조립하는 얇은 오케스트레이터만 담당한다.

## 5. 단계별 리팩토링 순서

### 1단계. 타입, threshold, diagnostics 상수만 추출

- `types.ts`에 row 타입, `PushAlertEvent`, diagnostics 타입을 옮긴다.
- `thresholds.ts`에 `minimumSetupPushScore`, 메이저/알트/market scout threshold, `passesSetupPushQuality`, `eventQualityThreshold`를 옮긴다.
- `diagnostics.ts`에 `emptyDiagnostics`, `eventDiagnosticSample`, `eventDiagnostic`, 샘플 push helper를 옮긴다.
- 동작 변경은 금지하고 import 경로만 바꾼다.

### 2단계. 권한, 선호, 중복 방지 분리

- `entitlements.ts`로 `profilePlan`, `subscriptionPlan`, `userPlan`, `ruleAllowed`를 옮긴다.
- `preferences.ts`로 `tokenWants`를 옮긴다.
- `duplicateGuard.ts`로 `eventBucket`, `duplicateBucket`, `alreadySent`, `recordSentEvent`를 옮긴다.
- `push_alert_events` event key 형식은 절대 변경하지 않는다.

### 3단계. optional source 분리

- `liquidationScanner.ts`로 청산압력 이벤트 생성만 옮긴다.
- `macroScanner.ts`로 `scanNewsEvent`, `scanMacroCalendarEvent`를 옮긴다.
- optional source 실패가 전체 cron 500으로 번지지 않는 wrapper 정책을 유지한다.
- HTTP self-call이 필요한 소스와 내부 함수 호출이 가능한 소스를 구분해 문서화한다.

### 4단계. 코인과 글로벌 scanner 분리

- `cryptoScanner.ts`로 `scanCryptoSetups`, `topPushSetups`, crypto market scout 입력 생성을 옮긴다.
- `globalScanner.ts`로 `scanStockSetups`, `buildStockSetup`, risk-off, semiconductor leadership 생성을 옮긴다.
- UI의 A급/점수 계산과 서버 scanner 점수가 다를 수 있는 지점을 별도 sanity test로 보호한다.

### 5단계. 발송과 오케스트레이터 정리

- `sendPush.ts`로 `sendEventToUser`와 FCM 결과 집계를 옮긴다.
- `pushAlertScanner.ts`는 `runPushAlertScan` 중심으로 데이터 조회, 후보 결합, gate 적용, dry-run/발송 분기만 유지한다.
- `src/app/api/push-cron/route.ts`와 `src/app/api/admin/push-diagnostics/route.ts`의 응답 구조는 유지한다.

## 6. 회귀 위험

| 위험 | 원인 | 방어 기준 |
| --- | --- | --- |
| 자동 푸시 미발송 | 품질 gate, 권한 gate, 선호 필터 순서 변경 | dry-run에서 `candidateEventCount`, `qualityPassedEventCount`, `deliveryEligibleEventCount` 비교 |
| 낮은 점수 알림 재발송 | threshold 추출 중 A급/점수 예외 해석 변경 | 58점, 62점, 75~79점 A급 setup은 푸시 후보 제외를 sanity로 확인 |
| 중복 방지 깨짐 | `eventKey` 또는 bucket 변경 | 기존 `push_alert_events` unique key와 15분/30분 bucket 유지 |
| 권한 필터 깨짐 | system event와 Pro event 분리 실수 | 시스템 알림 예외와 Pro 전용 규칙을 dry-run 샘플로 확인 |
| 선호 필터 깨짐 | `markets`, `rule_ids` 빈 배열 의미 변경 | 빈 배열은 전체 허용, 값이 있으면 해당 market/rule만 허용 유지 |
| dryRun 실제 발송 | send branch 분리 오류 | dryRun에서는 `sendFcmMessage`와 `recordSentEvent` 호출이 없어야 한다 |
| diagnostics 누락 | 타입 또는 샘플 구조 변경 | 관리자 API와 `RadarAlertCenter`가 기대하는 필드 유지 |
| 청산압력/매크로 누락 | optional source 분리 중 인증/URL 처리 변경 | 실패는 warning으로 남기고 전체 cron은 200 유지 |
| 개인정보 노출 | diagnostics 샘플 확장 | token, user_id 원문, email, secret은 응답과 로그에 절대 포함하지 않는다 |

## 7. 단계별 검증 기준

모든 단계에서 다음 검증을 기본으로 실행한다.

- `npm.cmd run build`
- `npm.cmd run smoke:mobile`
- `npm.cmd run smoke:all`
- `npm.cmd run smoke:ops`
- `cmd /c npx tsc --noEmit`
- `git diff --check`
- `/api/push-cron?dryRun=1&diagnostics=1`이 실제 발송 없이 응답하는지 확인
- 관리자 `/api/admin/push-diagnostics`에서 후보, skip 사유, 최근 이벤트 요약이 깨지지 않는지 확인

추가 sanity 기준은 다음과 같다.

- 58점과 62점 setup은 `skippedLowScore`로 유지한다.
- 75~79점 A급 setup은 앱 화면 표시 가능이어도 자동 푸시 후보에서는 제외한다.
- A급 자동 푸시도 최소 80점 이상이어야 한다.
- 메이저 코인은 80점 이상, 알트 setup은 82점 이상, 알트 market scout는 85점 이상 또는 A급 80점 이상과 근거 2개 이상을 유지한다.
- 관심코인/저장조건 알림과 시장 레이더 자동 알림의 `alertKind`, `isWatchlist`, `isMarketScout`, `isWatchedSymbol` 구분을 유지한다.
- 테스트 푸시는 관리자 전용이고 자동 푸시와 발송 경로를 섞지 않는다.
- `dryRun`에서는 FCM 발송과 `push_alert_events` 기록을 하지 않는다.

## 8. 절대 바꾸면 안 되는 정책

- 58점, 62점 같은 낮은 점수 방향성 알림은 자동 푸시로 보내지 않는다.
- A급 후보도 자동 푸시 후보가 되려면 최소 80점 이상이어야 한다.
- 메이저 코인 setup은 80점 이상, 알트 setup은 82점 이상을 유지한다.
- 알트 market scout는 관심코인이 아니어도 보낼 수 있지만, 85점 이상 또는 A급 80점 이상과 거래량·변동성·구조 중 최소 2개 근거를 요구한다.
- 관심코인/저장조건 알림과 시장 레이더 자동 알림은 문구와 이벤트 타입에서 분리한다.
- 청산압력 급등과 중요 매크로 일정은 setup 점수 기반 gate와 별개인 시스템 이벤트로 유지한다.
- 테스트 알림 패널은 관리자 전용으로 유지한다.
- `push_test`와 자동 조건 감시 푸시는 같은 UI에 있어도 권한과 목적을 분리한다.
- FCM token 원문, `user_id` 원문, email, `CRON_SECRET`, Firebase private key는 로그와 API 응답에 노출하지 않는다.
- `dryRun`과 diagnostics 모드는 실제 푸시 발송과 이벤트 기록을 하지 않는다.
- 외부 URL 이동은 허용하지 않고 내부 `targetPath`만 사용한다.

## 9. 다음 구현 작업 메모

이 문서 작성 후에도 `docs/work-queue.md`의 `pushAlertScanner 구조 분리` 항목은 `TODO`로 유지한다. 실제 구현은 자동 푸시 운영 로그가 안정적이라는 추가 확인 후 1단계부터 별도 커밋 단위로 진행한다.
