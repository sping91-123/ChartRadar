# Active Automation Run

## Run Title

- `boxless-alerts-list-pilot-run`

## Purpose

- `/alerts` 화면을 다음 boxless pilot 대상으로 삼는다.
- 알림 설정/상태 화면의 카드, 패널, 중첩 surface 의존도를 줄이고 list/row/divider 중심 UI로 전환한다.
- 알림 기능과 푸시 로직은 유지하고, 시각 구조만 제한적으로 검증한다.

## Background

- `/news` boxless pilot과 공통 Header/Nav boxless pilot은 완료됐다.
- `/alerts`는 설정, 상태, 이벤트 이력, 사용량 안내가 함께 보여 카드/패널 중첩이 강한 화면이다.
- 알림 기능은 FCM, push token, push-cron, 권한 상태와 연결되므로 실제 구현 task는 HIGH risk로 취급한다.

## Scope

- 대상 route: `/alerts`
- 조사 대상 후보:
  - `src/app/alerts/page.tsx`
  - `src/components/RadarAlertCenter.tsx`
  - `src/components/UsageMeterPanel.tsx`
  - `src/components/ui/DesignPrimitives.tsx` 사용 지점
- 실제 UI 변경은 task 2에서만 제한적으로 진행한다.
- task 2는 디자인 변경만 허용하며 알림 기능/푸시 로직은 변경하지 않는다.

## Product Principles

- Global Radar는 해외주식/해외선물 사용자용 독립 레이더로 유지한다.
- `/alerts?market=crypto`와 `/alerts?market=global`의 시장 구분을 유지한다.
- 알림 화면은 설정/상태 확인 도구이며, 투자 수익 보장이나 매매 지시처럼 보이는 문구를 추가하지 않는다.
- boxless 방향은 기능 안정성보다 우선하지 않는다.

## Start Conditions

- 작업 전 `git status --short --branch`와 `git rev-list --left-right --count HEAD...origin/main`을 확인한다.
- local과 `origin/main`이 불일치하면 새 작업을 시작하지 않고 보고한다.
- 대표가 `AUTO RUN ACTIVE PLAN - one small step only`라고 입력하면 첫 `TODO` 하나만 처리한다.

## Stop Conditions

- 작업트리가 dirty이고 기존 변경 정체가 불명확함.
- local과 `origin/main`이 불일치함.
- push token, FCM, push-cron, 알림 permission 로직 변경이 필요해짐.
- Supabase, 결제, 인증, Android, production 관련 변경이 필요해짐.
- route 변경이 필요해짐.
- task 2에서 스크린샷 확인 없이 push가 필요해짐.
- Global Radar 독립성이 약화될 가능성이 있음.

## Task List

| Order | Status | Task | Area | Risk | Goal | Forbidden | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | DONE | `/alerts` 현재 박스 구조 조사 | Alerts UI audit | LOW | `/alerts`, `RadarAlertCenter`, `UsageMeterPanel` 등에서 `AppSurface`, `PanelCard`, `bg-ui-inset`, `border`, `rounded`, `shadow` 사용 구조를 조사했다. 결과는 `docs/alerts-boxless-pilot-audit.md`에 기록했다. | 코드 수정 금지. | `git diff --check` |
| 2 | TODO | `/alerts` boxless list pilot 적용 | Alerts UI implementation | HIGH | 알림 설정 화면의 과한 카드/패널을 줄이고 list/row/divider 중심으로 정리한다. | push token 로직 변경 금지. FCM 변경 금지. push-cron 변경 금지. 알림 permission 로직 변경 금지. Supabase 변경 금지. 결제/인증/Android 변경 금지. 자동 push 금지. | `cmd /c npx tsc --noEmit`; `npm.cmd run build`; `npm.cmd run smoke:mobile`; `npm.cmd run smoke:all`; `npm.cmd run smoke:ops`; `git diff --check`; `/alerts` 360px screenshot; `/alerts` desktop screenshot |
| 3 | TODO | pilot 결과 문서화 | Docs / UX | LOW | `/alerts` pilot 결과, 남은 문제, 다음 적용 후보를 문서화한다. | 앱 코드 수정 금지. | `git diff --check` |

## Push Policy

- task 2의 실제 UI 변경은 자동 push 금지.
- `/alerts` 스크린샷 확인 전 push 금지.
- task 1과 task 3 같은 문서-only 작업은 대표가 safe push를 허용한 경우에만 자동 push할 수 있다.
- push 전 Git 상태, ahead/behind, 최신 커밋, 비밀값 추적 여부를 확인한다.

## Screenshot Policy

Task 2 완료 후 반드시 확인한다:

- `/alerts` 360px mobile screenshot.
- `/alerts` desktop screenshot.
- horizontal overflow 없음.
- 알림 설정/상태/이력 흐름이 카드보다 list/row 중심으로 보이는지.
- 알림 권한, push token, FCM, push-cron 관련 동작을 변경하지 않았는지.
- crypto/global market scope가 유지되는지.

## Completion Report Format

- 선택한 active run 작업.
- 선택 이유.
- 수정 파일.
- 변경 내용.
- `/alerts` 외 화면 수정 여부.
- 알림 기능/푸시 로직 변경 여부.
- Global Radar 독립성 유지 여부.
- 검증 결과.
- 스크린샷 경로(task 2의 경우).
- active run 상태 갱신 여부.
- 커밋 해시 또는 미커밋 상태.
- `git status --short --branch`.
- push 여부.
- 다음 추천 작업.
