# Active Automation Run

## Run Title

- `post-refactor-stability-run`

## 목적

- 최근 진행한 pushAlertScanner, `/crypto` LiveMarketChart, 자동화 기반 작업을 정리한다.
- 남은 안정화 작업을 순서대로 처리한다.
- 출시 전 안정성을 해치지 않도록 작은 단위로만 진행한다.

## 시작 조건

- 대표가 `AUTO RUN ACTIVE PLAN - one small step only`라고 입력하면 작업 목록의 첫 `TODO`부터 처리한다.
- 한 턴에는 하나의 `TODO`만 처리한다.
- 작업 전 `git status --short --branch`와 `git rev-list --left-right --count HEAD...origin/main`이 정상이어야 한다.
- 작업 전 해당 작업의 금지 범위와 검증 명령을 확인한다.

## 중단 조건

- 작업트리가 dirty이고 기존 변경의 정체가 불명확함.
- local과 `origin/main`이 불일치함.
- 작업이 고위험 영역에 닿지만 대표의 명시 승인이 없음.
- 작업 중 금지 범위를 건드려야만 하는 상황이 발생함.
- production DB migration, versionCode 변경, AAB 생성, Play Console 업로드, deploy가 필요함.
- 비밀값 파일 또는 민감값 추적이 감지됨.
- 검증 실패 원인이 불명확함.
- 같은 턴에 여러 작업을 처리해야만 하는 상태임.

## 작업 목록

| 순서 | 상태 | 작업 | 담당 영역 | 위험도 | 목표 | 금지 | 검증 명령 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | TODO | StockRadarApp 리팩토링 1단계 | `/Global` | MEDIUM | `src/components/StockRadarApp.tsx`에서 타입/상수/표시 helper만 `src/components/global/` 아래로 분리한다. | 차트 로직, API fetch, lightweight-charts useEffect, 모바일 하단 패널, Basic/Pro gating 변경 금지. | `git diff --check`, `cmd /c npx tsc --noEmit`, `npm.cmd run build`, `npm.cmd run smoke:mobile`, `npm.cmd run smoke:all`, `/global/assets` 340px/360px 확인 |
| 2 | TODO | LiveMarketChart 리팩토링 진행 상태 문서 정리 | `/crypto` | LOW | 이미 완료된 `/crypto` 리팩토링 단계들을 `docs/work-items/P2-live-market-chart-refactor.md`에 반영한다. | 앱 코드 수정 금지. | `git diff --check` |
| 3 | TODO | pushAlertScanner 구조 분리 진행 상태 문서 정리 | 알림 시스템 | LOW | 최근 진행한 target helper, diagnostics helper 등 분리 상태를 work item 문서에 정확히 반영한다. | 앱 코드 수정 금지. | `git diff --check` |
| 4 | TODO | Play Store AAB 재생성 준비 체크리스트 보강 | Play Console / 출시 대응 | MEDIUM | AndroidManifest `OPEN_ALERTS`, 푸시 탭 이동, versionCode 증가, signed AAB 생성, Play 비공개 테스트 업로드 전 체크리스트를 문서로 정리한다. | versionCode 변경 금지, AAB 생성 금지, Play Console 업로드 금지. | `git diff --check` |

## 상태 값

- `TODO`: 아직 착수하지 않은 작업.
- `IN_PROGRESS`: 현재 처리 중인 작업.
- `DONE`: 검증과 커밋까지 완료한 작업.
- `BLOCKED`: 대표 확인, 외부 권한, 운영 데이터, 고위험 승인 등이 필요해 멈춘 작업.

## 위험도

- `LOW`: 문서, 작은 구조 정리, 앱 동작 영향이 낮은 변경.
- `MEDIUM`: 앱 코드 또는 사용자 흐름에 영향을 줄 수 있으나 고위험 영역은 아닌 변경.
- `HIGH`: 결제, 인증, Supabase, Android release, Play Console, FCM, production DB, 비밀값과 관련된 변경.

## 완료 보고 형식

- 선택한 active run 작업.
- 선택 이유.
- 수정 파일.
- 변경 내용.
- 건드리지 않은 고위험 영역.
- 검증 결과.
- active run 상태 갱신 여부.
- 커밋 해시 또는 미커밋 상태.
- `git status --short --branch`.
- push 여부. 대표 승인 전에는 하지 않음.
- 다음 active run 작업.

## push 정책

- 기본 동작은 commit까지만 진행한다.
- `git push`는 대표가 명시적으로 요청한 경우에만 실행한다.
- push 전에는 Git 상태, ahead/behind, 최근 커밋, 비밀값 추적 여부를 확인한다.
