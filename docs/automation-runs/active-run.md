# Active Automation Run

## Run Title

- `boxless-journal-pilot-run`

## Purpose

- `/journal` 화면을 다음 boxless pilot 대상으로 삼는다.
- 저장/복기 화면의 과한 `AppSurface`, `PanelCard`, form wrapper, card 구조를 줄인다.
- 입력, 기록, 리스트 흐름을 더 앱다운 full-screen form/list 구조로 정리한다.

## Background

- `/news` boxless pilot, 공통 Header/Nav boxless pilot, `/alerts` boxless list pilot은 완료됐다.
- `/journal`은 입력 폼, 저장 상태, 기록 리스트가 함께 있어 form wrapper와 card 중첩이 강할 가능성이 높다.
- 저장/복기 데이터는 사용자 기록과 연결되므로 실제 구현 task는 HIGH risk로 취급한다.

## Scope

- 대상 route: `/journal`.
- 조사 대상 후보:
  - `src/app/journal/page.tsx`
  - journal 관련 components.
  - `AppSurface`, `PanelCard`, `bg-ui-panel`, `bg-ui-inset`, `border`, `rounded`, `shadow` 사용 지점.
- 실제 UI 변경은 task 2에서만 제한적으로 진행한다.
- task 2는 디자인 변경만 허용하며 저장/복기 데이터 로직은 변경하지 않는다.

## Product Principles

- `/journal?market=crypto`와 `/journal?market=global`의 시장 구분을 유지한다.
- Journal은 판단 복기와 기록 도구이며, 투자 수익 보장이나 매매 지시처럼 보이는 문구를 추가하지 않는다.
- 입력과 기록 흐름은 가볍게 만들되 저장 안정성을 우선한다.
- boxless 방향은 데이터 보존과 복기 기능 안정성보다 우선하지 않는다.

## Start Conditions

- 작업 전 `git status --short --branch`와 `git rev-list --left-right --count HEAD...origin/main`을 확인한다.
- local과 `origin/main`이 불일치하면 새 작업을 시작하지 않고 보고한다.
- 대표가 `AUTO RUN ACTIVE PLAN - one small step only`라고 입력하면 첫 `TODO` 하나만 처리한다.

## Stop Conditions

- 작업트리가 dirty이고 기존 변경 정체가 불명확함.
- local과 `origin/main`이 불일치함.
- 저장 로직, Supabase, 인증/session, journal API, data shape 변경이 필요해짐.
- 결제, Android, FCM, production 관련 변경이 필요해짐.
- route 변경이 필요해짐.
- task 2에서 스크린샷 확인 없이 push가 필요해짐.
- Global Radar 독립성이 약화될 가능성이 있음.

## Task List

| Order | Status | Task | Area | Risk | Goal | Forbidden | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | TODO | `/journal` 현재 박스 구조 조사 | Journal UI audit | LOW | `/journal` route와 관련 컴포넌트에서 `AppSurface`, `PanelCard`, `bg-ui-panel`, `bg-ui-inset`, `border`, `rounded`, `shadow` 사용 구조를 조사한다. | 코드 수정 금지. | `git diff --check` |
| 2 | TODO | `/journal` boxless form/list pilot 적용 | Journal UI implementation | HIGH | `/journal` 화면의 과한 카드/패널을 줄이고, 입력 폼과 복기 리스트를 full-screen form/list 흐름으로 정리한다. | 저장 로직 변경 금지. Supabase 변경 금지. 인증/session 변경 금지. journal API/data shape 변경 금지. 결제/Android/FCM 변경 금지. 자동 push 금지. | `cmd /c npx tsc --noEmit`; `npm.cmd run build`; `npm.cmd run smoke:mobile`; `npm.cmd run smoke:all`; `git diff --check`; `/journal` 360px screenshot; `/journal` desktop screenshot |
| 3 | TODO | pilot 결과 문서화 | Docs / UX | LOW | `/journal` pilot 결과, 남은 문제, 다음 적용 후보를 문서화한다. | 앱 코드 수정 금지. | `git diff --check` |

## Push Policy

- task 2의 실제 UI 변경은 자동 push 금지.
- `/journal` 스크린샷 확인 전 push 금지.
- task 1과 task 3 같은 문서-only 작업은 대표가 safe push를 허용한 경우에만 자동 push할 수 있다.
- push 전 Git 상태, ahead/behind, 최신 커밋, 비밀값 추적 여부를 확인한다.

## Screenshot Policy

Task 2 완료 후 반드시 확인한다:

- `/journal` 360px mobile screenshot.
- `/journal` desktop screenshot.
- horizontal overflow 없음.
- 입력 폼과 복기 리스트가 과한 card wrapper보다 form/list 중심으로 보이는지.
- 저장/복기 데이터 로직, 인증/session, Supabase 경로를 변경하지 않았는지.
- crypto/global market scope가 유지되는지.

## Completion Report Format

- 선택한 active run 작업.
- 선택 이유.
- 수정 파일.
- 변경 내용.
- `/journal` 외 화면 수정 여부.
- 저장/복기 데이터 로직 변경 여부.
- 인증/session/Supabase 변경 여부.
- Global Radar 독립성 유지 여부.
- 검증 결과.
- 스크린샷 경로(task 2의 경우).
- active run 상태 갱신 여부.
- 커밋 해시 또는 미커밋 상태.
- `git status --short --branch`.
- push 여부.
- 다음 추천 작업.
