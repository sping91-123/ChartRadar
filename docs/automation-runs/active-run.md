# Active Automation Run

## Run Title

- `coin-home-decision-polish-run`

## Purpose

- PR #2로 반영된 `/coin` 홈 decision summary를 1차 적용 상태에서 끝내지 않고, 모바일/데스크톱 시각 문제와 중복 문구를 정리한다.
- `/coin` 홈이 "정보 대시보드"보다 "매매 전 10초 판단 화면"처럼 읽히도록 우선순위, 문장 길이, 섹션 중복감을 다듬는다.

## Background

- PR #2 `Add coin home decision summary`는 merge 완료됐다.
- 현재 `/coin` 홈에는 오늘의 결론, 준비도 점수, 방향성, 시장 주도, 리스크, 다음 확인 조건이 추가됐다.
- 스크린샷 기준으로 아래 보정이 필요하다.
  - 모바일 문장 길이.
  - 상단 결론과 기존 `코인 홈` 섹션의 중복감.
  - 데스크톱 우측 공백.
  - 준비도, 주도, 리스크, 다음 확인 조건의 정보 우선순위.

## Scope

- 이번 run은 `/coin` decision summary polish만 다룬다.
- 대표 코인 개인화, 현물/선물 모드, 신규 API, Upbit/Bithumb breadth, ETH/BTC fetch는 별도 run으로 분리한다.
- 실제 UI 변경 작업은 PR 기반으로 진행한다.

## Start Conditions

- 작업 전 `git status --short --branch`와 `git rev-list --left-right --count HEAD...origin/main`을 확인한다.
- local과 `origin/main`이 불일치하면 새 작업을 시작하지 않고 보고한다.
- 대표가 `AUTO RUN ACTIVE PLAN - one small step only`라고 입력하면 첫 `TODO` 하나만 처리한다.

## Stop Conditions

- 작업트리가 dirty이고 기존 변경의 정체가 불명확함.
- local과 `origin/main`이 불일치함.
- 신규 API, route 변경, Supabase/auth/billing/Android/FCM 변경이 필요해짐.
- 대표 코인 선택 UI, Upbit/Bithumb breadth, ETH/BTC fetch가 필요해짐.
- 매수/매도/롱/숏 지시 문구가 필요해짐.
- 스크린샷 확인 전 UI 변경을 main에 merge/push해야 하는 상황.

## Task List

| Order | Status | Task | Area | Risk | Goal | Forbidden | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | TODO | `/coin` decision summary post-merge QA | Coin Home / QA | LOW | PR #2 반영 후 `/coin` 홈 화면의 모바일/데스크톱 문제를 문서화한다. | 코드 수정 금지. 앱 코드 변경 금지. | `git diff --check` |
| 2 | TODO | `/coin` decision summary polish 적용 | Coin Home / UI Polish | MEDIUM | 모바일 문장 길이, 상단 결론과 기존 `코인 홈` 섹션 중복감, 데스크톱 공백, 준비도/주도/리스크/다음 확인 조건 우선순위를 정리한다. | 신규 API 금지. route 변경 금지. Supabase/auth/billing/Android/FCM 변경 금지. 대표 코인 선택 UI 구현 금지. Upbit/Bithumb breadth 구현 금지. ETH/BTC 신규 fetch 금지. 매수/매도/롱/숏 지시 문구 금지. main 직접 push 금지. | `git diff --check`; `cmd /c npx tsc --noEmit`; `npm.cmd run lint`; `npm.cmd run build`; `npm.cmd run smoke:mobile`; `npm.cmd run smoke:all`; `/coin` 360px screenshot; `/coin` desktop screenshot |
| 3 | TODO | polish 결과 문서화 | Coin Home / Docs | LOW | `/coin` decision summary polish 결과와 다음 후보를 문서화한다. | 앱 코드 수정 금지. | `git diff --check` |

## Push / PR Policy

- 실제 UI 변경인 2번은 PR 기반으로 진행한다.
- 스크린샷 확인 전 merge 금지.
- main 직접 push 금지.
- docs-only safe 작업만 대표 승인 또는 요청 범위 안에서 자동 push 가능하다.

## Completion Report Format

- 선택한 작업.
- 수정 파일.
- 변경 내용.
- 금지 범위 준수 여부.
- 검증 결과.
- 스크린샷 경로, UI 작업인 경우.
- 커밋 해시.
- push/PR 여부.
- 다음 추천 작업.

## Completion Criteria

- post-merge QA가 문서화됨.
- decision summary polish가 PR 기반으로 적용되고 스크린샷 검수가 가능함.
- polish 결과와 남은 후보가 문서화됨.
- 신규 API, route, 결제, 인증, Supabase, Android, FCM 변경이 없음.
