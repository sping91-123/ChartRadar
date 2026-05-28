# ChartRadar Work Queue

이 문서는 ChartRadar 작업 백로그의 상위 인덱스입니다. 실제 작업 실행은 가능하면 GitHub Issue + `@codex` + PR 흐름을 우선하고, 이 문서는 우선순위와 상태를 한눈에 보는 관리 문서로 유지합니다.

## 작업 처리 원칙

- 저장소 운영 지침은 루트 `AGENTS.md`를 우선한다.
- 특정 문제 묶음 자동 처리는 `docs/automation-runs/active-run.md`를 기준으로 한다.
- 전략실 메인방은 방향 결정과 active run 관리에 사용하고, 실행방은 하나의 active run을 끝낼 때까지 사용한다.
- 연속성은 채팅방 기억이 아니라 저장소 문서, GitHub Issue, branch, PR에 저장한다.
- 대표가 `AUTO NEXT`라고 하면 `AGENTS.md`, 이 문서, `docs/work-items/`를 읽고 다음 작업 1개만 선택한다.
- 한 번에 하나의 `TODO`만 처리한다.
- 상태가 `TODO`인 항목 중 우선순위가 가장 높은 것만 처리한다.
- 작업 전 `git status --short --branch`를 확인한다.
- 작업을 시작하면 해당 항목을 `IN_PROGRESS`로 바꾸고, 완료 커밋 후 `DONE`으로 바꾼다.
- 작업 후 필요한 build/smoke 검증을 실행한다.
- 커밋은 하되 push는 하지 않는다.
- 결과 보고에는 수정 파일, 검증 결과, 커밋 해시를 포함한다.
- 비밀값, `.env.local`, `google-services.json`, Firebase key, `CRON_SECRET`은 절대 커밋하지 않는다.

## 공통 저장소 기준

- 저장소: `https://github.com/sping91-123/ChartRadar`
- 기본 브랜치: `main`
- 로컬 기준 경로: `X:\Chart-Radar`
- 운영 URL: `https://chartradar.kr`
- Android package: `com.staronlabs.chartradar`
- 작업 전 현재 폴더가 위 저장소와 연결되어 있는지 확인한다.

## Push 금지 원칙

- TODO 처리 후 기본 동작은 commit까지만 진행한다.
- `git push`는 대표가 명시적으로 요청한 경우에만 실행한다.
- push 전에는 반드시 아래를 확인한다.
  - `git status --short --branch`
  - `git log --oneline -5`
  - `git rev-list --left-right --count HEAD...origin/main`
  - 비밀값 파일 추적 여부

## 비밀값 커밋 금지 원칙

아래 파일 또는 값은 Git 추적 대상에 포함하면 안 된다.

- `.env.local`
- `.env*.local`
- `android/app/google-services.json`
- Firebase 서비스 계정 JSON
- Firebase private key
- Supabase service role key
- `SUPABASE_ACCESS_TOKEN`
- `CRON_SECRET`
- RevenueCat secret key
- Google OAuth client secret
- Android keystore, keystore password, key password

비밀값 추적 여부 확인 예시:

```powershell
git ls-files | Select-String -Pattern '(^|/)(\.env|\.env\.local|google-services\.json|firebase.*\.json|.*service.*account.*\.json|.*private.*key.*|.*cron.*secret.*|.*keystore.*|.*key-password.*)'
```

## 검증 명령 기준

작업 성격에 따라 필요한 검증을 선택하되, 앱 코드 변경 시 최소 build와 관련 smoke를 실행한다.

- 공통:
  - `git diff --check`
  - `cmd /c npx tsc --noEmit`
  - `npm.cmd run build`
- 모바일 영향:
  - `npm.cmd run smoke:mobile`
  - `npm.cmd run app:android:debug`
- 전체 회귀:
  - `npm.cmd run smoke:all`
- 결제 영향:
  - `npm.cmd run smoke:billing`
- 운영/크론 영향:
  - `npm.cmd run smoke:ops`
- 문서만 수정한 경우:
  - build/smoke는 생략 가능
  - `git status --short --branch`와 `git diff --check`는 반드시 확인한다.

## 작업 상태 규칙

- `TODO`: 아직 착수하지 않은 작업
- `IN_PROGRESS`: 현재 작업 중인 항목
- `BLOCKED`: 외부 권한, 계정, API, 운영 데이터, 대표 확인이 필요해 멈춘 항목
- `DONE`: 검증과 커밋까지 완료한 항목

## GitHub Issue 전환 규칙

장기적으로 실제 작업 실행은 GitHub Issue와 PR 흐름을 우선한다. 이 문서는 전체 백로그와 우선순위 관리용으로 유지한다.

- 실행할 작업은 `.github/ISSUE_TEMPLATE/codex-task.yml`로 Issue를 만든다.
- Issue에는 `@codex` 작업 요청을 남긴다.
- Codex는 main에 직접 push하지 않고 브랜치와 PR로 작업한다.
- 구현 작업은 가능하면 active run에서 선정한 뒤 branch/PR 단위로 진행한다.
- main 직접 push는 문서-only 또는 명확히 안전한 낮은 위험 작업으로 제한한다.
- UI/디자인 작업은 스크린샷 확인 전 push 또는 merge하지 않는다.
- 결제, 인증, Supabase, Android, FCM, production 관련 작업은 PR 기반과 대표 승인을 필수로 한다.
- Issue가 생성된 work queue 항목은 완료 결과에 Issue 번호를 기록한다.
- PR이 merge되면 해당 항목을 `DONE`으로 바꾸고 PR 번호 또는 merge commit을 기록한다.
- 자세한 흐름은 `docs/codex-workflow.md`를 따른다.

## 상세 작업 문서

- 작업 문서 인덱스: `docs/work-items/README.md`
- 활성 TODO/BLOCKED 상세: `docs/work-items/active-backlog.md`
- 완료 이력: `docs/work-items/completed-history.md`

## 현재 우선순위 요약

| 우선순위 | 상태 | 작업 | 담당방 | 인텔리전스 | 상세 문서 |
| --- | --- | --- | --- | --- | --- |
| P1 | TODO | pushAlertScanner 구조 분리 | 알림 시스템 | 높음 | `docs/work-items/P1-push-alert-scanner-refactor.md` |
| P1 | TODO | 디자인 시스템 2차 적용 | UI 디자인 시스템 / 브랜드 리뉴얼 | 높음 | `docs/work-items/P1-design-system-phase2.md` |
| P1 | TODO | Play Store용 AAB 재생성 및 푸시 탭 이동 반영 | Play Console / 출시 대응 | 중간 | `docs/work-items/P1-play-store-aab-push-tap.md` |
| P1 | BLOCKED | Google 계정 보안 알림에 Google TV 권한처럼 보이는 문제 점검 | 인증 / 계정 / 사용자 데이터 | 높음 | `docs/work-items/P1-google-oauth-project-cleanup.md` |
| P2 | TODO | LiveMarketChart 컴포넌트 분리 | 코인 레이더 /crypto | 높음 | `docs/work-items/P2-live-market-chart-refactor.md` |
| P2 | TODO | StockRadarApp 컴포넌트 분리 | /Global | 높음 | `docs/work-items/P2-stock-radar-app-refactor.md` |
| P2 | DONE | 작업 큐 포맷 개선 | 개발 메인 | 중간 | 현재 문서와 `docs/work-items/*` 구조로 재정리. 완료 커밋: `Reorganize work queue documentation` |

## DONE/BLOCKED 보존 기준

- 기존 `DONE` 항목은 `docs/work-items/completed-history.md`에 보존한다.
- 기존 `BLOCKED` 항목은 삭제하지 않고 현재 우선순위 요약과 `docs/work-items/active-backlog.md`에 유지한다.
- 완료된 작업을 다시 수정해야 하면 기존 항목을 되돌리지 말고 새 TODO를 만든다.
- 세부 작업이 GitHub Issue로 이동되면 상세 문서에 Issue 번호와 PR 번호를 기록한다.
