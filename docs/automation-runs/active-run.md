# Active Automation Run

## Run Title

- `boxless-news-pilot-run`

## Purpose

- `/news` 화면에 boxless UI foundation을 처음으로 제한 적용한다.
- `AppSurface` / `PanelCard` 중첩 카드 느낌을 줄이고, 뉴스/매크로/시장 레이더 내용을 list/report 중심으로 전환 가능한지 검증한다.
- 이번 run은 첫 실제 visual pilot이므로 `/news` 범위 밖으로 확장하지 않는다.

## Background

- `DesignPrimitives`에 `card`, `flat`, `report`, `list` variant가 backward-compatible하게 추가됐다.
- 기존 call-site는 아직 새 variant를 사용하지 않으므로 현재 화면 visual은 기본적으로 바뀌지 않았다.
- `full-app-boxless-redesign-run`은 planning level에서 완료됐고, 첫 visual pilot 대상으로 `/news`가 적합하다고 판단했다.
- `/news`는 feed/list 성격이 강해 boxless 방향을 검증하기 좋다.

## Scope

- 대상 route: `/news`
- 대상 후보 컴포넌트:
  - `src/app/news/page.tsx`
  - `src/components/RadarNewsPanel.tsx`
  - `src/components/RadarDigestPanel.tsx`
  - `src/components/MacroTicker.tsx`는 `/news`에서 직접 영향이 확인될 때만 조사한다.
- 앱 코드 구현은 task 2에서만 제한적으로 진행한다.
- `/crypto`, `/alts`, `/global`, `/global/assets`, `/alerts`, `/journal`, `/learn`, `/pro`는 이번 run에서 수정하지 않는다.

## Product Principles

- Global Radar는 해외주식/해외선물 사용자용 독립 레이더로 유지한다.
- `/news?market=crypto`와 `/news?market=global` 모두 동작해야 한다.
- 뉴스/일정 표현은 투자 권유가 아니라 판단 보조, 확인 조건, 리스크, 관망/추적 조건 중심이어야 한다.
- 기능보다 시각 검수를 우선한다.

## Start Conditions

- 작업 전 `git status --short --branch`와 `git rev-list --left-right --count HEAD...origin/main`을 확인한다.
- local과 `origin/main`이 불일치하면 새 작업을 시작하지 않고 보고한다.
- 대표가 `AUTO RUN ACTIVE PLAN - one small step only`라고 입력하면 첫 `TODO` 하나만 처리한다.
- task 2 visual 변경 후에는 스크린샷 검수 전 push하지 않는다.

## Stop Conditions

- 작업트리가 dirty이고 기존 변경 정체가 불명확함.
- local과 `origin/main`이 불일치함.
- `/news` 외 화면 수정이 필요해짐.
- API fetch, data shape, routing 변경이 필요해짐.
- 결제, 인증, Supabase, Android, FCM, production DB 변경이 필요해짐.
- Global Radar 독립성이 약화될 가능성이 있음.
- 스크린샷 확인 없이 visual 변경 push가 필요한 상황.

## Task List

| Order | Status | Task | Area | Risk | Goal | Forbidden | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | DONE | `/news` 현재 박스 구조 조사 | News UI audit | LOW | `/news`, `RadarNewsPanel`, `RadarDigestPanel`, 필요 시 `MacroTicker`에서 `AppSurface`, `PanelCard`, `rounded`, `border`, `shadow` 사용 구조를 조사한다. | 코드 수정 금지. | `git diff --check` |
| 2 | DONE | `/news` boxless pilot 적용 | News UI implementation | MEDIUM | `/news` 화면의 일부 또는 주요 섹션에 `variant="report"` 또는 `variant="list"`를 제한 적용하고, 중첩 `PanelCard`를 줄이며 뉴스 리스트를 row/list 중심으로 정리한다. | `/crypto`, `/global`, `/alerts`, `/journal`, `/pro` 수정 금지. API fetch 변경 금지. news data shape 변경 금지. routing 변경 금지. | `cmd /c npx tsc --noEmit`; `npm.cmd run build`; `npm.cmd run smoke:mobile`; `npm.cmd run smoke:all`; `git diff --check`; `/news` 360px screenshot; `/news` desktop screenshot; `/news?market=crypto` 확인; `/news?market=global` 확인 |
| 3 | DONE | pilot 결과 문서화 | Docs / UX | LOW | `docs/app-wide-boxless-ui-plan.md` 또는 `docs/full-app-boxless-redesign-plan.md`에 `/news` pilot 결과, 장점/문제/다음 적용 후보를 기록한다. | 앱 코드 수정 금지. | `git diff --check` |

## Push Policy

- 자동 push 금지.
- task 2 visual 변경은 스크린샷 확인 전 push하지 않는다.
- 문서-only 작업도 대표의 명시 지시 전에는 push하지 않는다.
- push 전에는 Git 상태, ahead/behind, 최신 커밋, 비밀값 추적 여부를 확인한다.

## Screenshot Policy

Task 2 완료 시 반드시 확인한다:

- `/news` 360px mobile screenshot.
- `/news` desktop screenshot.
- `/news?market=crypto`.
- `/news?market=global`.
- horizontal overflow 없음.
- 뉴스/매크로/시장 레이더 정보가 카드에 갇혀 보이지 않는지.
- Global Radar 관련 뉴스/일정 맥락이 코인 보조로 격하되지 않았는지.

## Completion Report Format

- 선택한 active run 작업.
- 선택 이유.
- 수정 파일.
- 변경 내용.
- `/news` 외 화면 미수정 여부.
- Global Radar 독립 유지 여부.
- 검증 결과.
- 스크린샷 경로(task 2인 경우).
- active run 상태 갱신 여부.
- 커밋 해시 또는 미커밋 상태.
- `git status --short --branch`.
- push 여부: 하지 않음.
- 다음 추천 작업.
