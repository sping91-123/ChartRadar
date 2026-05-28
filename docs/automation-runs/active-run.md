# Active Automation Run

## Run Title

- `design-system-flat-surfaces-run`

## Purpose

- ChartRadar 전체 UI에서 카드, 박스, 테두리, 중첩 패널 의존도를 줄이기 위한 공통 기준을 세운다.
- 화면을 더 넓고 빠르게 읽히는 리포트형 UI로 전환하되, 즉시 전면 구현하지 않는다.
- 공통 컴포넌트와 화면별 적용 순서를 먼저 문서화한 뒤, 실제 구현 run을 별도로 진행한다.

## Background

- `/crypto` flatten 시도 커밋 2개는 대표 기준에 만족스럽지 않아 main에서 제거했다.
- 실패 시도는 `backup/failed-crypto-flatten-20260528` 브랜치에 보존했다.
- main은 `origin/main`과 일치하며 기준 최신 커밋은 `3be564d Flatten crypto radar screen panels`이다.

## Scope

- 이번 run은 디자인 시스템 기준과 화면별 적용 순서를 문서화하는 작업만 다룬다.
- 앱 UI 코드는 수정하지 않는다.
- `docs/app-wide-boxless-ui-plan.md` 생성은 이 run의 다음 TODO에서 처리한다.
- Coin Radar와 Global Radar는 모두 같은 디자인 원칙을 적용하되, Global Radar는 해외주식/해외선물 사용자용 독립 레이더로 유지한다.

## Start Conditions

- 대표가 `AUTO RUN ACTIVE PLAN - one small step only`라고 입력하면 작업 목록의 첫 `TODO` 하나만 처리한다.
- 작업 전 `git status --short --branch`와 `git rev-list --left-right --count HEAD...origin/main`을 확인한다.
- local과 `origin/main`이 불일치하면 새 작업을 시작하지 않고 보고한다.
- 작업 완료 시 해당 항목을 `DONE`으로 갱신할지 보고하고, 같은 커밋에 포함해도 되는 문서 갱신이면 포함한다.

## Stop Conditions

- 작업트리가 dirty이고 기존 변경의 정체가 불명확함.
- local과 `origin/main`이 불일치함.
- 앱 코드 수정이 필요해짐.
- route, 기능 로직, 결제, 인증, 푸시, DB, Android, production 관련 변경이 필요해짐.
- Global Radar 독립 진입 또는 기능이 약화될 가능성이 있음.
- 스크린샷 확인 없이 UI 감각 변경을 push해야 하는 상황이 됨.
- 여러 화면을 한 번에 수정해야만 하는 상황이 됨.

## Task List

| Order | Status | Task | Area | Risk | Goal | Forbidden | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | DONE | App-wide box source audit | 디자인 시스템 / 전역 UI 조사 | LOW | 앱 전체에서 박스형 UI를 만드는 주요 원인을 조사한다. 검색 대상은 `AppSurface`, `PanelCard`, `enterprise-panel`, `enterprise-card`, `rounded-2xl`, `rounded-xl`, `border`, `shadow`, `ring`, `bg-ui-panel`, `bg-ui-inset`, `bg-surface-card`이다. 대상 화면은 시장 선택, `/crypto`, `/alts`, `/global`, `/global/assets`, `/news`, `/alerts`, `/journal`, `/learn`, `/pro`이다. | 코드 수정 금지. | `git diff --check` |
| 2 | DONE | Flat surface design rule 문서화 | 디자인 시스템 / 문서 | LOW | `docs/app-wide-boxless-ui-plan.md`를 생성해 유지해야 할 박스, 제거/약화해야 할 박스, `AppSurface`/`PanelCard` 사용 기준, flat/report/list variant 필요성, route별 적용 우선순위, 스크린샷 검수 기준을 정리한다. | 앱 코드 수정 금지. | `git diff --check` |
| 3 | TODO | DesignPrimitives variant 설계 | 공통 UI 컴포넌트 | MEDIUM | `AppSurface`, `PanelCard`에 flat/report/list 같은 variant를 추가할지 설계한다. 실제 구현은 하지 않고 타입/API 설계만 문서화한다. | 코드 수정 금지. | `git diff --check` |
| 4 | TODO | First implementation candidate 선정 | 전략실 메인 / 구현 준비 | LOW | 첫 실제 구현 후보를 선정한다. 후보는 DesignPrimitives flat/report variant 추가, `/crypto` summary 영역만 flat variant 적용, `/news` 또는 `/alerts` 같은 비교적 안전한 화면에 먼저 적용하는 방식이다. | 코드 수정 금지. | `git diff --check` |

## Status Values

- `TODO`: 아직 착수하지 않은 작업.
- `IN_PROGRESS`: 현재 처리 중인 작업.
- `DONE`: 검증과 커밋까지 완료된 작업.
- `BLOCKED`: 대표 승인, 제품 판단, 고위험 영역 검토가 필요해 멈춘 작업.

## Risk Values

- `LOW`: 문서, 조사, 적용 순서 정리.
- `MEDIUM`: 공통 컴포넌트 API 설계처럼 이후 구현 영향이 큰 문서 작업.
- `HIGH`: 결제, 인증, Supabase, Android release, Play Console, FCM, production DB, 비밀값과 관련된 변경.

## Design Principles

- UI 감각 작업은 자동 push하지 않는다.
- 화면 스크린샷 확인 전 push하지 않는다.
- 개별 화면에서 무작정 border, rounded, shadow를 제거하지 않는다.
- 먼저 공통 디자인 원칙을 정하고 적용한다.
- 기능, 라우팅, 결제, 인증, 푸시, DB 로직은 변경하지 않는다.
- Global Radar는 Coin Radar 보조 매크로가 아니라 독립 시장 레이더로 유지한다.
- Coin Radar와 Global Radar 모두 같은 flat surface 원칙을 적용한다.

## Completion Report Format

- 선택한 active run 작업.
- 선택 이유.
- 수정 파일.
- 변경 내용.
- 건드리지 않은 고위험 영역.
- Global Radar 독립 유지 여부.
- 검증 결과.
- active run 상태 갱신 여부.
- 커밋 해시 또는 미커밋 상태.
- `git status --short --branch`.
- push 여부: 대표 승인 전에는 하지 않음.
- 다음 추천 작업.

## Push Policy

- 기본 동작은 commit까지만 진행한다.
- `git push`는 대표가 명시적으로 요청한 경우에만 실행한다.
- UI 감각 변경은 safe auto push 대상이 아니다.
- push 전에는 Git 상태, ahead/behind, 최근 커밋, 비밀값 추적 여부를 확인한다.
