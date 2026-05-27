# Active Automation Run

## Run Title

- `coin-radar-market-selection-ui-run`

## Purpose

- 시장 선택 화면의 큰 외곽 테두리 박스와 중첩 카드 느낌을 줄여 모바일 첫 화면 공간감을 개선한다.
- Coin Radar와 Global Radar는 동등한 상위 시장 모드로 유지한다.
- Global Radar 독립 진입 동선을 훼손하지 않는다.

## Scope

- 이번 run은 시장 선택 화면의 외곽 박스 제거와 공간감 개선만 다룬다.
- 마지막 사용 시장 기억 기능은 구현하지 않는다.
- 하단 탭 구조는 구현하지 않는다.
- `/spot`, `/home`, `/macro` 신규 route를 만들지 않는다.
- safe auto push 정책은 별도 승인 전까지 사용하지 않는다.

## Start Conditions

- 대표가 `AUTO RUN ACTIVE PLAN - one small step only`라고 입력하면 작업 목록의 첫 `TODO`부터 처리한다.
- 한 턴에는 하나의 `TODO`만 처리한다.
- 작업 전 `git status --short --branch`와 `git rev-list --left-right --count HEAD...origin/main`이 정상이어야 한다.
- 작업 완료 시 해당 항목을 `DONE`으로 갱신한다.

## Stop Conditions

- 작업트리가 dirty이고 기존 변경의 정체가 불명확함.
- local과 `origin/main`이 불일치함.
- route 변경이 필요함.
- 마지막 사용 시장 기억 구현이 필요함.
- Global Radar 진입 제거 또는 약화가 필요함.
- 결제, 인증, 푸시, Android, Supabase, production DB, deploy 변경이 필요함.
- 비밀값 파일 또는 민감값 추적이 감지됨.
- 검증 실패 원인이 불명확함.
- 같은 턴에 여러 작업을 처리해야만 하는 상태임.

## Task List

| Order | Status | Task | Area | Risk | Goal | Forbidden | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | TODO | 시장 선택 화면 현재 구조 조사 | 홈 랜딩 / 시장 선택 화면 | LOW | 현재 시장 선택 화면 파일과 컴포넌트 구조를 확인하고, 어떤 wrapper/card가 큰 외곽 테두리 박스를 만드는지 조사한다. | 코드 수정 금지. | `git diff --check` |
| 2 | TODO | 큰 외곽 박스 제거 | 홈 랜딩 / 시장 선택 화면 | MEDIUM | 시장 선택 화면에서 큰 외곽 wrapper/border/card를 제거하거나 약화한다. Coin Radar와 Global Radar 선택 카드는 유지하되, 전체 화면을 더 넓게 쓰는 구조로 조정한다. | route 변경 금지. 마지막 사용 시장 기억 구현 금지. Global Radar 진입 제거 금지. 결제/인증/푸시/Android 변경 금지. | `npm.cmd run build`, `npm.cmd run smoke:mobile`, `npm.cmd run smoke:all`, `cmd /c npx tsc --noEmit`, `git diff --check`, 340px/360px 시장 선택 화면 확인, Coin Radar / Global Radar 진입 확인 |
| 3 | TODO | 구현 결과 문서 정리 | 문서 / UX | LOW | `docs/coin-radar-ux-redesign-plan.md` 또는 관련 work item에 구현 결과와 남은 과제를 기록한다. 마지막 사용 시장 기억은 다음 구현 후보로 유지한다. | 앱 코드 수정 금지. | `git diff --check` |

## Status Values

- `TODO`: 아직 착수하지 않은 작업.
- `IN_PROGRESS`: 현재 처리 중인 작업.
- `DONE`: 검증과 커밋까지 완료한 작업.
- `BLOCKED`: 대표 확인, 외부 권한, 운영 데이터, 고위험 승인 등이 필요해 멈춘 작업.

## Risk Values

- `LOW`: 문서, 조사, 작은 구조 정리.
- `MEDIUM`: 시장 선택 화면 UI 코드처럼 사용자 화면에 직접 보이는 변경.
- `HIGH`: 결제, 인증, Supabase, Android release, Play Console, FCM, production DB, 비밀값과 관련된 변경.

## Completion Report Format

- 선택한 active run 작업.
- 선택 이유.
- 수정 파일.
- 변경 내용.
- Global Radar 독립 진입 동선 유지 여부.
- 건드리지 않은 고위험 영역.
- 검증 결과.
- active run 상태 갱신 여부.
- 커밋 해시 또는 미커밋 상태.
- `git status --short --branch`.
- push 여부. 대표 승인 전에는 하지 않음.
- 다음 active run 작업.

## Push Policy

- 기본 동작은 commit까지만 진행한다.
- `git push`는 대표가 명시적으로 요청한 경우에만 실행한다.
- push 전에는 Git 상태, ahead/behind, 최근 커밋, 비밀값 추적 여부를 확인한다.
