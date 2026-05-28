# Codex GitHub Issue Workflow

이 문서는 ChartRadar 작업을 기존 `docs/work-queue.md`와 Codex 방 중심 흐름에서 GitHub Issues + `@codex` + Pull Request 흐름으로 옮기기 위한 기준입니다.

## 목적

- 작업 지시를 GitHub Issue에 남겨 추적 가능하게 만듭니다.
- Codex는 한 Issue에서 한 작업만 처리합니다.
- `main` 직접 push를 줄이고 브랜치와 PR 기반 검토 흐름으로 전환합니다.
- 검증 결과, 남은 리스크, 변경 파일을 PR에 남깁니다.
- ChatGPT와 Codex 사이의 반복 복붙을 줄이고, 연속성을 저장소 문서와 GitHub 상태에 저장합니다.

## 방 운영 구조

- 전략실 메인방: 제품 방향 결정, active run 생성, 우선순위 조정, PR 결과 검수에 사용합니다.
- active-run 실행방: 하나의 active run을 끝낼 때까지 사용합니다. 작업마다 새 방을 만들지 않습니다.
- 고위험 전용방: 결제, 인증, Supabase, Android release, FCM, production migration처럼 대표 승인과 별도 검토가 필요한 작업에 사용합니다.
- 새 방으로 이동해야 할 때는 `AGENTS.md`, `docs/automation-runs/active-run.md`, completed 기록, GitHub Issue, PR을 먼저 읽고 이어갑니다.

## Source of Truth

- 채팅방 기억은 보조 정보입니다.
- 저장소 운영 기준은 `AGENTS.md`를 우선합니다.
- 특정 작업 묶음은 `docs/automation-runs/active-run.md`와 completed 기록을 우선합니다.
- 실제 구현 이력, 리뷰, 검증 결과는 GitHub Issue와 PR을 우선합니다.
- `docs/work-queue.md`는 큰 백로그와 우선순위 관리용으로 유지합니다.

## 기본 흐름

1. 대표가 GitHub Issue를 생성합니다.
2. Issue 템플릿의 목표, 수정 범위, 건드리지 말 것, 검증 명령을 채웁니다.
3. Issue 댓글 또는 본문에 `@codex` 작업 요청을 남깁니다.
4. Codex가 Issue를 읽고 작업 브랜치를 생성합니다.
5. Codex가 브랜치에서 수정, 검증, 커밋을 진행합니다.
6. Codex가 PR을 생성합니다.
7. GitHub Actions 또는 Codex가 검증 결과를 확인합니다.
8. 대표가 PR 결과와 화면 영향을 확인합니다.
9. 필요하면 ChatGPT에게 PR 리뷰를 요청합니다.
10. 대표 확인 후 PR을 merge합니다.
11. merge 후 Vercel Production 배포와 운영 health를 확인합니다.

## active run과 PR의 관계

- active run은 지금 처리할 작업 묶음과 순서를 정합니다.
- 조사, 정책 문서, 낮은 위험 문서 정리는 active run 안에서 직접 커밋할 수 있습니다.
- 앱 코드 구현, UI/디자인 변경, 고위험 작업은 active run에서 후보를 정한 뒤 branch/PR로 실행합니다.
- 하나의 active-run 실행방은 해당 run이 끝날 때까지 유지합니다.
- active run 완료 후에는 결과를 completed 기록으로 보존하고, 실제 구현 PR 번호나 merge commit을 남깁니다.

## docs/work-queue.md와 GitHub Issue의 관계

`docs/work-queue.md`는 큰 백로그와 우선순위 관리용 문서로 유지합니다.

- 아직 Issue로 만들지 않은 아이디어는 `docs/work-queue.md`에 남깁니다.
- 실제 실행할 작업은 GitHub Issue로 승격합니다.
- Issue를 만들 때는 work queue 항목의 우선순위, 담당방, 인텔리전스, 목표, 완료 기준을 복사합니다.
- Issue가 생성된 항목은 work queue의 완료 결과에 Issue 번호를 기록합니다.
- PR이 merge되면 work queue 항목을 `DONE`으로 바꾸고 PR 번호 또는 merge commit을 기록합니다.
- 외부 콘솔, 계정, 운영 권한이 필요한 항목은 `BLOCKED`로 유지하고 Issue에도 blocker를 명확히 적습니다.

권장 상태 매핑은 아래와 같습니다.

| work-queue 상태 | GitHub Issue 상태 |
| --- | --- |
| TODO | Open Issue 생성 가능 |
| IN_PROGRESS | Assignee 또는 `@codex` 작업 중 |
| BLOCKED | Open Issue + blocked 사유 기록 |
| DONE | Issue closed + PR merged |

## Codex 작업 규칙

Codex는 Issue 작업 시 아래 규칙을 지킵니다.

- 한 Issue에서 한 작업만 처리합니다.
- Issue 범위 밖의 기능 추가나 리팩토링을 하지 않습니다.
- 작업 전 `git status --short --branch`를 확인합니다.
- `main`에 직접 push하지 않습니다.
- 작업 브랜치를 만들고 PR을 생성합니다.
- 앱 코드 변경 시 최소 아래 검증을 실행합니다.
  - `git diff --check`
  - `npm.cmd run build`
  - `npm.cmd run smoke:mobile`
  - `npm.cmd run smoke:all`
- 필요 시 아래 검증을 추가합니다.
  - `cmd /c npx tsc --noEmit`
  - `npm.cmd run smoke:ops`
  - `npm.cmd run smoke:billing`
  - `npm.cmd run smoke:routes`
- 문서만 수정한 경우 build/smoke는 생략할 수 있지만 `git status`와 `git diff`는 확인합니다.
- 결과 보고에는 수정 파일, 검증 결과, 남은 한계 또는 리스크를 포함합니다.

## 자동 push 정책

- docs-only 또는 안전한 낮은 위험 작업은 대표가 해당 턴에서 safe push를 허용했거나 명시적으로 push를 요청한 경우에만 push할 수 있습니다.
- UI/디자인 작업은 스크린샷 확인 전 push 또는 merge하지 않습니다.
- 고위험 작업은 PR 기반으로 진행하고 대표 승인 전 merge하지 않습니다.
- 결제, 인증, Supabase, Android, FCM, production DB migration 관련 변경은 자동 push하지 않습니다.
- main 직접 push는 예외로 취급하고, 구현 작업은 branch/PR을 기본값으로 둡니다.

## MCP의 위치

- MCP는 Codex가 GitHub, 브라우저, 문서, 외부 서비스에 접근하기 위한 연결 계층입니다.
- 현재 운영 자동화의 중심은 MCP 자체가 아니라 GitHub Issue, branch, PR, 저장소 문서입니다.
- MCP 기반 자체 오케스트레이터는 장기 과제로 분리합니다.
- 단기 운영은 active run으로 작업 묶음을 정하고, 구현은 PR로 검수하는 흐름을 우선합니다.

## 브랜치와 PR 기준

브랜치 이름은 작업이 보이도록 짧게 만듭니다.

예시.

```text
codex/health-public-scope
codex/push-scanner-refactor
codex/ui-design-phase-2
```

PR 본문에는 아래 내용을 포함합니다.

```markdown
## Summary
- 변경 요약.

## Changed Files
- 수정 파일 목록.

## Verification
- 실행한 명령과 결과.

## Risks / Limits
- 남은 리스크.
- 확인하지 못한 항목.

## Issue
Closes #이슈번호
```

## 비밀값 금지

아래 파일과 값은 절대 커밋하지 않습니다.

- `.env.local`
- `.env*.local`
- `android/app/google-services.json`
- Firebase service account JSON
- Firebase private key
- Supabase service role key
- `SUPABASE_ACCESS_TOKEN`
- `CRON_SECRET`
- RevenueCat secret key
- Google OAuth client secret
- Android keystore, keystore password, key password

push 또는 PR 전에는 아래 검사를 실행합니다.

```powershell
git ls-files | Select-String -Pattern '(^|/)(\.env|\.env\.local|google-services\.json|firebase.*\.json|.*service.*account.*\.json|.*private.*key.*|.*cron.*secret.*|.*keystore.*|.*key-password.*)'
```

`.env.example`처럼 의도된 예시 파일만 추적되어야 합니다.

## 대표 확인 기준

대표는 PR에서 아래를 확인합니다.

- Issue 목표를 실제로 해결했는지.
- 수정 범위를 넘지 않았는지.
- 로그인, 푸시, 결제, Android native 설정 등 민감 영역이 불필요하게 바뀌지 않았는지.
- 검증 명령이 통과했는지.
- 남은 리스크가 명확히 적혀 있는지.
- Vercel Preview 또는 로컬 화면에서 주요 흐름이 깨지지 않는지.

## merge 후 운영 확인

PR merge 후에는 아래를 확인합니다.

- `origin/main` 최신 커밋이 merge commit 또는 squash commit인지 확인합니다.
- Vercel Production 배포가 시작됐는지 확인합니다.
- 배포가 Ready인지 확인합니다.
- 필요 시 `https://chartradar.kr/api/health?ts=현재시간`으로 운영 health를 확인합니다.
- Android 앱 관련 변경이면 AAB 빌드 전 `versionCode`, `CAPACITOR_SERVER_URL`, `google-services.json` 존재 여부를 다시 확인합니다.
