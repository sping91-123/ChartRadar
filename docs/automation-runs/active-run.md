# Active Automation Run

## Run Title

- `boxless-app-shell-run`

## Purpose

- ChartRadar 전 화면에서 공통으로 보이는 Header, Nav, AppShell의 박스 느낌을 줄인다.
- 개별 콘텐츠 카드보다 먼저 공통 상단 구조를 가볍게 만들어 boxless redesign 방향을 막는 요소를 제거한다.
- Coin Radar와 Global Radar를 동등한 상위 시장 모드로 유지하면서, 대기업 앱처럼 화면 전체를 쓰는 상단 구조를 설계하고 검증한다.

## Background

- `/news` boxless pilot은 완료됐고 결과 문서화까지 끝났다.
- `/news` pilot 스크린샷 기준으로 본문 카드 중첩은 줄었지만, 상단 Header/Nav가 여전히 박스처럼 보여 전체 앱의 boxless 방향을 제한한다.
- 다음 pilot은 특정 콘텐츠 화면이 아니라 공통 App Shell, Header, TopNav 구조를 대상으로 한다.

## Scope

- 조사 대상:
  - `src/components/Header.tsx`
  - `src/components/RadarTopNav.tsx`
  - `src/app/layout.tsx`
  - `src/app/page.tsx`
  - 주요 route wrapper
- 실제 UI 변경은 task 3에서만 제한적으로 진행한다.
- `/crypto`, `/global`, `/news`는 task 3의 스크린샷 검수 대상이다.
- 기능 로직, 라우팅, 인증, 결제, 알림 로직은 이 run의 변경 대상이 아니다.

## Product Principles

- Global Radar는 해외주식/해외선물 사용자용 독립 레이더로 유지한다.
- Coin Radar와 Global Radar는 같은 shell 원칙을 적용하되, 어느 한쪽을 보조 기능으로 격하하지 않는다.
- Header/Nav는 앱 전체의 공통 진입 구조이므로 콘텐츠보다 가볍게 보이게 한다.
- 화면 경계는 큰 박스보다 여백, 타이포그래피, 얇은 divider, sticky/fixed affordance로 만든다.

## Start Conditions

- 작업 전 `git status --short --branch`와 `git rev-list --left-right --count HEAD...origin/main`을 확인한다.
- local과 `origin/main`이 불일치하면 새 작업을 시작하지 않고 보고한다.
- 대표가 `AUTO RUN ACTIVE PLAN - one small step only`라고 입력하면 첫 `TODO` 하나만 처리한다.

## Stop Conditions

- 작업트리가 dirty이고 기존 변경 정체가 불명확함.
- local과 `origin/main`이 불일치함.
- route, auth, plan, notification logic 변경이 필요해짐.
- 결제, 인증, Supabase, Android, FCM, production 관련 변경이 필요해짐.
- `/crypto` 또는 `/global` 본문 대규모 수정이 필요해짐.
- task 3에서 스크린샷 확인 없이 push가 필요해짐.
- Global Radar 독립성이 약화될 가능성이 있음.

## Task List

| Order | Status | Task | Area | Risk | Goal | Forbidden | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | TODO | Header/Nav/AppShell 구조 조사 | App shell audit | LOW | Header, RadarTopNav, AppSurface 기반 shell, route wrapper에서 박스 느낌을 만드는 요소를 조사한다. | 코드 수정 금지. | `git diff --check` |
| 2 | TODO | App shell boxless 기준 문서화 | Design system docs | LOW | Header/Nav가 언제 border/background를 쓰고 언제 divider만 쓰는지 문서화한다. Coin Radar와 Global Radar 독립성을 유지하면서 공통 shell을 가볍게 만드는 기준을 정리한다. | 코드 수정 금지. | `git diff --check` |
| 3 | TODO | Header/Nav boxless pilot 적용 | App shell implementation | HIGH | Header와 RadarTopNav의 큰 박스/카드 느낌을 줄인다. 알림, 설정, 플랜 버튼은 유지한다. route, auth, plan, notification logic은 변경하지 않는다. | route 변경 금지. 로그인/인증 변경 금지. 결제/plan logic 변경 금지. 알림 로직 변경 금지. `/crypto`, `/global` 본문 대규모 수정 금지. 자동 push 금지. | `cmd /c npx tsc --noEmit`; `npm.cmd run build`; `npm.cmd run smoke:mobile`; `npm.cmd run smoke:all`; `git diff --check`; `/crypto` 360px screenshot; `/global` 360px screenshot; `/news` 360px screenshot; desktop screenshot |
| 4 | TODO | pilot 결과 문서화 | Docs / UX | LOW | Header/Nav pilot 결과와 남은 문제를 문서화하고 다음 적용 후보를 정리한다. | 앱 코드 수정 금지. | `git diff --check` |

## Push Policy

- task 3의 실제 UI 변경은 자동 push 금지.
- Header/Nav/AppShell 스크린샷 확인 전 push 금지.
- task 1, task 2, task 4 같은 문서-only 작업은 대표가 safe push를 허용한 경우에만 자동 push할 수 있다.
- push 전 Git 상태, ahead/behind, 최신 커밋, 비밀값 추적 여부를 확인한다.

## Screenshot Policy

Task 3 완료 후 반드시 확인한다:

- `/crypto` 360px mobile screenshot.
- `/global` 360px mobile screenshot.
- `/news` 360px mobile screenshot.
- desktop screenshot.
- Header/Nav가 큰 카드나 박스처럼 보이지 않는지.
- 알림, 설정, 플랜 버튼이 유지되는지.
- Coin Radar와 Global Radar의 독립 진입성이 유지되는지.
- horizontal overflow가 없는지.

## Completion Report Format

- 선택한 active run 작업.
- 선택 이유.
- 수정 파일.
- 변경 내용.
- Header/Nav/AppShell 외 화면 수정 여부.
- 기능/라우팅/인증/결제/알림 로직 변경 여부.
- Global Radar 독립성 유지 여부.
- 검증 결과.
- 스크린샷 경로(task 3의 경우).
- active run 상태 갱신 여부.
- 커밋 해시 또는 미커밋 상태.
- `git status --short --branch`.
- push 여부.
- 다음 추천 작업.
