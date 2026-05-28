# Active Automation Run

## Run Title

- `full-app-boxless-redesign-run`

## Purpose

- ChartRadar 전체 디자인을 카드, 박스, 패널 중심 구조에서 벗어나 풀스크린 앱 구조로 전환한다.
- Coin Radar와 Global Radar를 모두 포함한다.
- 시장 선택, 코인, 글로벌, 자산, 뉴스/일정, 복기, 설정, 알림, Pro까지 전 화면을 같은 디자인 철학으로 재정리한다.
- AI가 만든 대시보드처럼 보이는 중첩 카드 구조를 줄이고, 대기업 앱처럼 화면 전체를 쓰는 모바일 우선 UI로 전환한다.
- 즉시 전체 코드를 수정하지 않고, 먼저 공통 디자인 원칙과 적용 순서를 확정한다.

## Background

- 대표는 ChartRadar 전체 UI를 박스 없는 풀스크린 앱 구조로 전환하기로 결정했다.
- 참고 방향은 당근마켓, 토스, 유튜브, 인스타그램, 쿠팡처럼 콘텐츠가 화면 전체 흐름을 차지하는 앱형 구조다.
- 기존 `design-system-flat-surfaces-run`은 공통 box source 조사와 surface variant 설계까지 진행했지만, 더 큰 방향 전환으로 종료한다.
- 기존 조사 문서인 `docs/app-wide-box-source-audit.md`와 `docs/app-wide-boxless-ui-plan.md`는 참고 자료로 유지한다.

## Scope

- 이번 run은 전 화면 redesign 기준, 우선순위, 공통 shell/list/section 구조를 문서화한다.
- 앱 코드 구현은 별도 구현 run에서 진행한다.
- 기능, 라우팅, 결제, 인증, Supabase, Android, FCM, production DB 로직은 변경하지 않는다.
- Coin Radar와 Global Radar는 동등한 상위 시장 모드로 유지한다.
- Global Radar를 코인 보조 매크로로 격하하지 않는다.

## Core Design Principles

- 하단 고정 패널 또는 필수 컨트롤 외에는 큰 박스/카드/패널을 기본 사용하지 않는다.
- 화면 경계는 박스가 아니라 여백, 타이포그래피, 얇은 divider, 리스트 흐름으로 만든다.
- 카드 안에 카드, 패널 안에 패널 구조를 제거한다.
- `AppSurface`, `PanelCard`, `enterprise-panel` 중심 구조를 줄인다.
- 결제, 인증, 위험 경고, 모달, 폼, Pro 요금제 비교처럼 경계가 필요한 곳은 예외로 둔다.
- 모바일 첫 화면에서 정보가 박스에 갇혀 보이면 실패로 본다.
- 디자인 변경은 화면 스크린샷 확인 전 자동 push하지 않는다.

## Start Conditions

- 대표가 `AUTO RUN ACTIVE PLAN - one small step only`라고 입력하면 작업 목록의 첫 `TODO` 하나만 처리한다.
- 작업 전 `git status --short --branch`와 `git rev-list --left-right --count HEAD...origin/main`을 확인한다.
- local과 `origin/main`이 불일치하면 새 작업을 시작하지 않고 보고한다.
- 작업 완료 시 해당 항목을 `DONE`으로 갱신할지 판단하고, 같은 커밋에 포함 가능한 문서 갱신이면 포함한다.

## Stop Conditions

- 작업트리가 dirty이고 기존 변경의 정체가 불명확함.
- local과 `origin/main`이 불일치함.
- 앱 코드 수정이 필요해짐.
- 결제, 인증, Supabase, Android, FCM, production DB 변경이 필요해짐.
- Global Radar 독립성이 약화될 가능성이 있음.
- Pro/BM, Basic/Pro gating, 결제 문구 영향이 생김.
- 여러 화면을 한 번에 구현해야만 하는 상황이 됨.
- 스크린샷 검수 없이 UI 변경 push가 필요한 상황이 됨.

## Task List

| Order | Status | Task | Area | Risk | Goal | Forbidden | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | TODO | 전체 앱 boxless redesign 방향 문서화 | 제품 디자인 / 전략 | LOW | `docs/full-app-boxless-redesign-plan.md`를 기준으로 전 화면 boxless redesign 원칙, 예외, 참고 앱 방향, 금지 범위를 정리한다. | 앱 코드 수정 금지. | `git diff --check` |
| 2 | TODO | 화면별 카드/패널 제거 우선순위 재정리 | 제품 디자인 / 화면 구조 | LOW | 시장 선택, `/crypto`, `/alts`, `/global`, `/global/assets`, `/news`, `/alerts`, `/journal`, `/learn`, `/pro`, 설정/계정 흐름별 적용 순서를 정한다. | 앱 코드 수정 금지. | `git diff --check` |
| 3 | TODO | 공통 AppShell / BottomNav / Section / ListRow 디자인 기준 설계 | 공통 UI 구조 | MEDIUM | 박스 없는 앱 구조를 위한 공통 shell, 하단 네비게이션/컨트롤, 섹션, 리스트 row, metric row 기준을 문서화한다. 실제 구현은 하지 않는다. | 앱 코드 수정 금지. | `git diff --check` |
| 4 | TODO | 첫 구현 화면 선정 | 전략실 메인 / 구현 준비 | LOW | 첫 실제 구현 후보를 하나만 선정한다. 후보는 시장 선택, 뉴스/일정, 알림, Coin Radar summary, Global Radar summary 중 하나다. | 앱 코드 수정 금지. | `git diff --check` |
| 5 | TODO | 첫 구현 범위 확정 | 전략실 메인 / 구현 준비 | LOW | 첫 구현 작업의 수정 파일, 금지 범위, 검증 명령, 스크린샷 기준, push 정책을 확정한다. | 앱 코드 수정 금지. | `git diff --check` |

## Status Values

- `TODO`: 아직 처리하지 않은 작업.
- `IN_PROGRESS`: 현재 처리 중인 작업.
- `DONE`: 검증과 커밋까지 완료한 작업.
- `BLOCKED`: 대표 승인, 제품 판단, 고위험 영역 검토가 필요해 멈춘 작업.

## Risk Values

- `LOW`: 문서, 조사, 우선순위 정리.
- `MEDIUM`: 공통 UI 구조 설계처럼 이후 구현 영향이 큰 문서 작업.
- `HIGH`: 결제, 인증, Supabase, Android release, Play Console, FCM, production DB, 실제 비밀값과 관련된 변경.

## Push Policy

- 기본 동작은 commit까지만 진행한다.
- `git push`는 대표가 명시적으로 요청한 경우에만 실행한다.
- UI 감각 작업은 safe auto push 대상이 아니다.
- 화면 스크린샷 확인 전에는 UI 구현 변경을 push하지 않는다.

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
