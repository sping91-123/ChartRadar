# ChartRadar Work Queue

이 문서는 ChartRadar 작업 백로그의 상위 인덱스입니다. 실제 작업 실행은 가능하면 GitHub Issue + `@codex` + PR 흐름을 우선하고, 이 문서는 우선순위와 상태를 한눈에 보는 관리 문서로 유지합니다.

상세 저장소 운영 원칙은 루트 `AGENTS.md`를 우선합니다.
`AGENTS.md`와 이 문서의 내용이 충돌하면 `AGENTS.md`를 우선합니다.

---

## 문서 역할

* `AGENTS.md`: 저장소 운영 헌법, 고위험 기준, 자동화 명령어 정의, 검증/보고 원칙.
* `docs/work-queue.md`: 전체 백로그의 상위 인덱스와 우선순위 관제판.
* `docs/work-items/active-backlog.md`: 현재 살아있는 TODO/BLOCKED 작업 목록.
* `docs/work-items/*.md`: 개별 작업 상세 카드.
* `docs/work-items/completed-history.md`: 완료 이력 보존.
* `docs/automation-runs/active-run.md`: 대표가 지정한 특정 문제 묶음을 순서대로 처리하는 active run 문서.

---

## 작업 처리 원칙

* 저장소 운영 지침은 루트 `AGENTS.md`를 우선한다.
* 특정 문제 묶음 자동 처리는 `docs/automation-runs/active-run.md`를 기준으로 한다.
* 전략실 메인방은 방향 결정과 active run 관리에 사용하고, 실행방은 하나의 active run을 끝낼 때까지 사용한다.
* 연속성은 채팅방 기억이 아니라 저장소 문서, GitHub Issue, branch, PR에 저장한다.
* 대표가 `AUTO NEXT`라고 하면 `AGENTS.md`, 이 문서, `docs/automation-runs/active-run.md`, `docs/work-items/active-backlog.md`, `docs/work-items/`를 읽고 다음 작업 1개만 선택한다.
* 한 번에 하나의 `TODO`만 처리한다.
* 상태가 `TODO`인 항목 중 우선순위가 가장 높은 것만 처리한다.
* 작업 전 `git status --short --branch`를 확인한다.
* 작업 전 `git rev-list --left-right --count HEAD...origin/main`을 확인한다.
* local `main`과 `origin/main`이 불일치하면 새 작업을 시작하지 말고 보고한다.
* 작업트리가 dirty이면 기존 변경의 정체를 먼저 확인한다.
* 기존 사용자 변경이나 미커밋 파일을 되돌리지 않는다.
* 작업을 시작하면 해당 항목을 `IN_PROGRESS`로 바꾼다.
* 완료 후 필요한 build/smoke 검증을 실행한다.
* 검증 통과 후 하나의 논리 단위로 커밋한다.
* push는 대표가 명시적으로 요청한 경우에만 실행한다.
* 결과 보고에는 수정 파일, 변경 내용, 검증 결과, 커밋 해시 또는 미커밋 상태, push 여부, 다음 추천 작업을 포함한다.
* 비밀값, `.env.local`, `google-services.json`, Firebase key, `CRON_SECRET`은 절대 커밋하지 않는다.

---

## 자동 명령어 라우팅

대표의 명령어에 따라 작업 큐 처리 방식을 아래처럼 구분한다.

### `AUTO PLAN ONLY`

* 코드와 문서를 수정하지 않는다.
* 다음 작업 1개를 선택하고 계획만 보고한다.
* 보고에는 아래 항목을 포함한다.

  * 선택한 작업.
  * 선택 이유.
  * 예상 수정 파일.
  * 위험도.
  * 필요한 검증 명령.
  * 중단 조건.

### `AUTO NEXT`

* 먼저 `docs/automation-runs/active-run.md`가 있는지 확인한다.
* active run에 `TODO`가 있으면 `docs/work-items/`에서 임의 선택하지 않고 active run의 다음 `TODO` 1개만 처리한다.
* active run이 없거나 모든 항목이 `DONE`이면 이 문서와 `docs/work-items/active-backlog.md`에서 가장 우선순위 높은 `TODO` 1개를 선택한다.
* 처리 가능한 `TODO`가 없으면 임의로 코드 수정하지 않는다.
* 처리 가능한 `TODO`가 없을 때는 다음에 만들 만한 작업 후보 1~3개를 제안한다.
* 낮은 위험 또는 중간 위험 작업은 계획 보고 후 진행할 수 있다.
* 고위험 작업은 계획만 보고하고 대표 승인 전에는 수정하지 않는다.

### `AUTO FIX SAFE`

* 명백한 타입 오류, 빌드 실패, smoke 실패, 모바일 레이아웃 깨짐처럼 범위가 좁고 원인이 분명한 문제만 수정한다.
* 결제, 인증, Supabase, Android release, FCM, production 관련 변경은 제외한다.
* 수정 범위가 예상보다 커지면 중단하고 보고한다.
* 기존 사용자 변경과 충돌할 가능성이 있으면 중단하고 보고한다.
* 검증 실패 원인이 현재 작업과 직접 관련이 없으면 임의로 넓게 고치지 않는다.

### `AUTO QA SWEEP`

* 기능 추가 없이 품질 점검만 수행한다.
* 핵심 route의 모바일 화면, 빈 상태, 로딩 상태, 에러 상태, Pro gating, 문구 위험도, CTA 흐름을 점검한다.
* 핵심 route는 `/crypto`, `/alts`, `/global`, `/news`, `/journal`, `/pro`, `/alerts`, `/login`을 우선한다.
* 발견한 문제는 `docs/work-items/active-backlog.md` 또는 개별 work item 후보로 정리한다.
* 대표 지시 없이 대규모 리팩터링이나 디자인 변경은 하지 않는다.
* 고위험 영역 수정이 필요하면 작업 후보로만 기록하고 실행하지 않는다.

### `AUTO RUN ACTIVE PLAN`

* `docs/automation-runs/active-run.md`의 `TODO`를 순서대로 처리한다.
* 한 턴에는 하나의 작업만 완료한다.
* 각 작업 후 검증 결과, 커밋 상태, 남은 리스크, 다음 작업 후보를 보고한다.
* 다음 작업으로 넘어가기 전 현재 작업의 미완료/리스크를 먼저 정리한다.

---

## 작업 우선순위 산정 기준

active run이 비어 있거나 다음 작업 후보를 골라야 할 때는 아래 기준으로 우선순위를 매긴다.

우선순위 점수는 아래 항목을 기준으로 판단한다.

* 사용자 영향도: 실제 사용자가 바로 체감하는가.
* 출시 필요성: 비공개 테스트, Play Console, 심사, 앱 안정성에 직접 연결되는가.
* 수익화 영향: Pro 전환, 구독, paywall, entitlement, 가격 정책에 영향을 주는가.
* 위험 감소: 장애, 오작동, 개인정보, secret, 인증, 결제 오류 가능성을 낮추는가.
* 구현 확실성: 현재 코드 구조에서 안전하게 끝낼 수 있는가.
* 검증 가능성: 자동 검증 또는 명확한 수동 확인이 가능한가.
* 작업 크기: 한 커밋 또는 한 PR 단위로 작게 끝낼 수 있는가.

기본 우선순위는 아래 순서를 따른다.

1. 앱 실행 불가, 로그인 불가, 결제 권한 오류, 데이터 노출 같은 치명 문제.
2. 비공개 테스트, Play Console, 출시 심사에 필요한 문제.
3. Pro gating, 구독, 관리자 권한처럼 BM에 직접 연결되는 문제.
4. 사용자가 자주 보는 핵심 route의 UX 문제.
5. 알림, 복기, 뉴스, 글로벌, 알트 등 기능 완성도 개선.
6. 내부 문서, 리팩터링, 개발 편의성 개선.

---

## 공통 저장소 기준

* 저장소: `https://github.com/sping91-123/ChartRadar`
* 기본 브랜치: `main`
* 로컬 기준 경로: `X:\Chart-Radar`
* 운영 URL: `https://chartradar.kr`
* Android package: `com.staronlabs.chartradar`
* 작업 전 현재 폴더가 위 저장소와 연결되어 있는지 확인한다.

---

## Push / PR 원칙

작업 실행 방식에 따라 push 기준을 구분한다.

### 로컬 실행방 기준

* 기본 동작은 commit까지만 진행한다.
* `git push`는 대표가 명시적으로 요청한 경우에만 실행한다.
* push 전에는 반드시 아래를 확인한다.

  * `git status --short --branch`
  * `git log --oneline -5`
  * `git rev-list --left-right --count HEAD...origin/main`
  * 비밀값 파일 추적 여부

### GitHub Issue + `@codex` + PR 기준

* 구현 작업은 가능하면 `main` 직접 수정이 아니라 `codex/` prefix 브랜치와 PR로 진행한다.
* PR 생성을 위한 작업 브랜치 push는 허용될 수 있다.
* 단, `main` 직접 push, PR merge, production deploy, Play Console 제출, AAB 업로드는 대표 승인 전 금지한다.
* 결제, 인증, Supabase, Android, FCM, production 관련 작업은 PR 생성 후에도 대표 검수 전 merge하지 않는다.
* UI/디자인 작업은 가능하면 스크린샷 또는 화면 확인 결과를 PR 본문에 포함한다.
* 문서-only 또는 명확히 안전한 낮은 위험 작업도 대표가 push를 허용한 경우에만 push한다.

---

## 비밀값 커밋 금지 원칙

아래 파일 또는 값은 Git 추적 대상에 포함하면 안 된다.

* `.env.local`
* `.env*.local`
* `android/app/google-services.json`
* Firebase 서비스 계정 JSON
* Firebase private key
* Supabase service role key
* `SUPABASE_ACCESS_TOKEN`
* `CRON_SECRET`
* RevenueCat secret key
* Google OAuth client secret
* Android keystore
* keystore password
* key password

비밀값 추적 여부 확인 예시:

```powershell
git ls-files | Select-String -Pattern '(^|/)(\.env|\.env\.local|google-services\.json|firebase.*\.json|.*service.*account.*\.json|.*private.*key.*|.*cron.*secret.*|.*keystore.*|.*key-password.*)'
```

---

## 고위험 작업 기준

아래 영역은 항상 고위험으로 취급한다.

* RevenueCat
* `src/lib/billing.ts`
* planId / productId / entitlement
* Supabase / RLS / production DB migration
* Google 로그인 / OAuth / 세션
* Android / Capacitor / AAB / Play Console
* FCM / push token / push-cron
* `.env`, Firebase key, keystore, `android/app/google-services.json`
* 계정 삭제, 로그아웃, 세션 복구, 관리자 권한 보정

고위험 작업은 아래 원칙을 따른다.

* 실행 전 계획을 먼저 보고한다.
* 대표 승인 전에는 코드 수정, push, deploy, Play Console 제출, production migration을 하지 않는다.
* 가능한 경우 PR 기반으로 진행한다.
* 검증 명령에 관련 smoke를 포함한다.
* secret, token, key, 개인정보가 출력되거나 커밋되지 않아야 한다.

---

## 검증 명령 기준

작업 성격에 따라 필요한 검증을 선택하되, 앱 코드 변경 시 최소 build와 관련 smoke를 실행한다.

### 공통

* `git diff --check`
* `cmd /c npx tsc --noEmit`
* `npm.cmd run build`

### 모바일 영향

* `npm.cmd run smoke:mobile`
* 필요 시 `npm.cmd run app:android:debug`

### 전체 회귀

* `npm.cmd run smoke:all`

### 결제 영향

* `npm.cmd run smoke:billing`

### 운영/크론 영향

* `npm.cmd run smoke:ops`
* 가능하면 로컬에서 `/api/push-cron?dryRun=1&diagnostics=1` 확인
* dryRun에서 실제 발송, DB write, 민감정보 노출이 없는지 확인

### Android 영향

* `npm.cmd run app:sync`
* `npm.cmd run app:android:debug`
* release AAB는 대표 지시가 있을 때만 생성한다.

### 문서만 수정한 경우

* build/smoke는 생략 가능하다.
* `git status --short --branch`와 `git diff --check`는 반드시 확인한다.

---

## 완료 기준

작업 완료는 단순히 코드를 수정했다는 뜻이 아니다. 아래 조건을 충족해야 완료로 본다.

### 공통 완료 기준

* 요청 범위가 충족되어야 한다.
* 변경 파일이 작업 목적과 직접 관련되어야 한다.
* 불필요한 리팩터링이나 스타일 변경을 섞지 않는다.
* secret, token, key, 개인정보가 출력되거나 커밋되지 않아야 한다.
* `git diff --check`를 통과해야 한다.
* 작업 성격에 맞는 검증 명령을 실행해야 한다.
* 실패한 검증이 있으면 실패 원인과 남은 리스크를 보고해야 한다.

### 앱 코드 완료 기준

* TypeScript 타입 오류가 없어야 한다.
* production build가 깨지지 않아야 한다.
* 모바일 WebView 기준에서 주요 화면이 깨지지 않아야 한다.
* 빈 상태, 로딩 상태, 에러 상태가 최소한의 안내를 가져야 한다.
* Basic/Pro 노출 정책을 약화하지 않아야 한다.
* 투자 권유, 수익 보장, 진입 지시처럼 보이는 문구가 없어야 한다.

### UI 작업 완료 기준

* 모바일 화면에서 첫 화면의 핵심 메시지가 분명해야 한다.
* 사용자가 다음에 눌러야 할 행동이 하나 이상 명확해야 한다.
* 카드, 버튼, 배지, 문구의 위계가 과하게 복잡하지 않아야 한다.
* 스크롤, 하단 버튼, safe area, WebView 높이 문제가 없어야 한다.
* 가능하면 스크린샷 또는 화면 확인 결과를 보고한다.

### Pro/Billing 작업 완료 기준

* 상품명, 가격, 기간, entitlement, plan id가 서로 충돌하지 않아야 한다.
* legacy plan id가 사용자 화면에 노출되지 않아야 한다.
* Google Play 상품 문구와 앱 내부 문구가 어긋나지 않아야 한다.
* `npm.cmd run smoke:billing`을 포함해야 한다.
* 대표 승인 전에는 push, release, deploy를 하지 않는다.

---

## 실패 시 복구 규칙

검증 실패 시 Codex는 무작정 수정 범위를 넓히지 않는다.

### 타입 오류

* 현재 작업으로 인해 발생한 오류인지 먼저 확인한다.
* 직접 관련된 오류만 수정한다.
* 기존 누적 오류로 보이면 중단하고 보고한다.

### 빌드 실패

* 에러 로그의 최초 원인을 기준으로 수정한다.
* 의존성 설치, package 변경, 설정 변경이 필요하면 먼저 보고한다.
* 빌드 실패가 고위험 영역과 연결되면 중단한다.

### smoke 실패

* 실패한 smoke의 목적을 먼저 파악한다.
* 현재 변경과 직접 관련 있으면 수정한다.
* 관련이 불명확하면 실패 로그와 의심 범위를 보고한다.

### UI 확인 실패

* 레이아웃 깨짐, 버튼 가림, 모바일 스크롤 문제는 같은 작업 범위 안에서 수정할 수 있다.
* 디자인 방향 자체가 바뀌는 수정은 대표에게 보고한다.

---

## 작업 상태 규칙

* `TODO`: 아직 착수하지 않은 작업
* `IN_PROGRESS`: 현재 작업 중인 항목
* `BLOCKED`: 외부 권한, 계정, API, 운영 데이터, 대표 확인이 필요해 멈춘 항목
* `DONE`: 검증과 커밋까지 완료한 항목

---

## GitHub Issue 전환 규칙

장기적으로 실제 작업 실행은 GitHub Issue와 PR 흐름을 우선한다. 이 문서는 전체 백로그와 우선순위 관리용으로 유지한다.

* 실행할 작업은 `.github/ISSUE_TEMPLATE/codex-task.yml`로 Issue를 만든다.
* Issue에는 `@codex` 작업 요청을 남긴다.
* Codex는 main에 직접 push하지 않고 브랜치와 PR로 작업한다.
* 구현 작업은 가능하면 active run에서 선정한 뒤 branch/PR 단위로 진행한다.
* main 직접 push는 문서-only 또는 명확히 안전한 낮은 위험 작업으로 제한한다.
* UI/디자인 작업은 스크린샷 확인 전 push 또는 merge하지 않는다.
* 결제, 인증, Supabase, Android, FCM, production 관련 작업은 PR 기반과 대표 승인을 필수로 한다.
* Issue가 생성된 work queue 항목은 완료 결과에 Issue 번호를 기록한다.
* PR이 merge되면 해당 항목을 `DONE`으로 바꾸고 PR 번호 또는 merge commit을 기록한다.
* 자세한 흐름은 `docs/codex-workflow.md`를 따른다.

---

## 상세 작업 문서

* 작업 문서 인덱스: `docs/work-items/README.md`
* 활성 TODO/BLOCKED 상세: `docs/work-items/active-backlog.md`
* 완료 이력: `docs/work-items/completed-history.md`

---

## 현재 우선순위 요약

현재 자동으로 이어서 처리 가능한 기존 구현 TODO는 많지 않습니다.
다만 앱 완성도와 자동화 운영력을 높이기 위해 아래 QA/점검성 TODO를 우선 등록합니다.

| 우선순위 | 상태      | 작업                                        | 담당방                  | 인텔리전스 | 상세 문서                                                                            |
| ---- | ------- | ----------------------------------------- | -------------------- | ----- | -------------------------------------------------------------------------------- |
| P1   | TODO    | 핵심 route 모바일 QA sweep                     | 개발 메인 / UI QA        | 중간    | `docs/work-items/P1-core-routes-mobile-qa-sweep.md`                              |
| P1   | TODO    | Pro gating 문구/노출 정책 점검                    | Pro 요금제 / 유료화        | 높음    | `docs/work-items/P1-pro-gating-copy-audit.md`                                    |
| P2   | TODO    | 빈 상태/로딩 상태/에러 상태 UX 점검                    | UI 디자인 시스템           | 중간    | `docs/work-items/P2-empty-loading-error-state-audit.md`                          |
| P1   | BLOCKED | Google 계정 보안 알림에 Google TV 권한처럼 보이는 문제 점검 | 인증 / 계정 / 사용자 데이터    | 높음    | `docs/work-items/P1-google-oauth-project-cleanup.md`                             |
| P1   | BLOCKED | Play Store용 AAB 재생성 및 푸시 탭 이동 반영          | Play Console / 출시 대응 | 중간    | `docs/work-items/P1-play-store-aab-push-tap.md`                                  |
| P1   | DONE    | 디자인 시스템 2차 적용                             | UI 디자인 시스템 / 브랜드 리뉴얼 | 높음    | `docs/work-items/P1-design-system-phase2.md`                                     |
| P2   | DONE    | StockRadarApp 컴포넌트 분리                     | /Global              | 높음    | `docs/work-items/P2-stock-radar-app-refactor.md`                                 |
| P2   | DONE    | 작업 큐 포맷 개선                                | 개발 메인                | 중간    | 현재 문서와 `docs/work-items/*` 구조로 재정리. 완료 커밋: `Reorganize work queue documentation` |

---

## 자동 실행 가능한 TODO가 없을 때

`TODO`가 없거나 모든 작업이 `BLOCKED`인 경우 Codex는 임의로 앱 코드를 수정하지 않는다.

대신 아래 순서로 처리한다.

1. `docs/automation-runs/active-run.md`에 아직 남은 `TODO`가 있는지 확인한다.
2. `docs/work-items/active-backlog.md`에서 누락된 `TODO`가 있는지 확인한다.
3. 핵심 route 기준으로 QA sweep 후보를 제안한다.
4. 필요한 경우 새 work item 후보 1~3개를 제안한다.
5. 대표 승인 없이 고위험 영역을 직접 수정하지 않는다.

자동 생성 가능한 안전한 후보 예시는 아래와 같다.

* 핵심 route 모바일 QA sweep
* 빈 상태 / 로딩 상태 / 에러 상태 UX 점검
* Pro gating 문구와 Basic/Pro 노출 정책 점검
* 투자 권유처럼 보이는 문구 점검
* route별 CTA 흐름 점검
* 오래된 legacy route 또는 redirect 정리 후보 조사
* smoke 명령과 실제 package script 불일치 점검

---

## 핵심 route QA 기준

`AUTO QA SWEEP` 또는 UI 점검 작업에서는 아래 route를 우선 확인한다.

| route                                              | 확인 기준                              |
| -------------------------------------------------- | ---------------------------------- |
| `/`                                                | 시장 선택과 앱 진입 흐름이 명확한가               |
| `/crypto`                                          | BTC/ETH 중심 판단 흐름, 리스크, 추적 조건이 명확한가 |
| `/alts`                                            | 알트 필터, 추적 후보, 고위험 후보가 구분되는가        |
| `/global`                                          | 미국장/글로벌 흐름을 30초 안에 파악할 수 있는가       |
| `/global/assets`                                   | 자산별 흐름과 리스크가 과도하게 복잡하지 않은가         |
| `/news`                                            | 뉴스와 이벤트가 판단 보조 흐름으로 연결되는가          |
| `/alerts`                                          | 알림 설정과 상태가 사용자가 이해하기 쉬운가           |
| `/journal`                                         | 복기 입력, 히스토리, 대기 레이더 흐름이 막히지 않는가    |
| `/learn`                                           | 지표 안내가 앱 판단 흐름을 보조하는가              |
| `/login`                                           | 로그인 CTA, 에러, 세션 안내가 명확한가           |
| `/pro`                                             | Pro 가치, 가격, Basic/Pro 차이가 분명한가     |
| `/terms`, `/privacy`, `/refund`, `/account/delete` | 정책과 계정 안내가 심사 기준에 맞게 노출되는가         |
| `/admin/entitlements`                              | 관리자 권한/구독 보정 흐름이 안전한가              |

---

## DONE/BLOCKED 보존 기준

* 기존 `DONE` 항목은 `docs/work-items/completed-history.md`에 보존한다.
* 기존 `BLOCKED` 항목은 삭제하지 않고 현재 우선순위 요약과 `docs/work-items/active-backlog.md`에 유지한다.
* 완료된 작업을 다시 수정해야 하면 기존 항목을 되돌리지 말고 새 TODO를 만든다.
* 세부 작업이 GitHub Issue로 이동되면 상세 문서에 Issue 번호와 PR 번호를 기록한다.

---

## 완료 보고 형식

작업 완료 시 반드시 아래를 보고한다.

* 선택한 작업.
* 선택 이유.
* 수정 파일.
* 변경 내용.
* 건드리지 않은 고위험 영역.
* 검증 결과.
* 커밋 해시 또는 미커밋 상태.
* `git status --short --branch`.
* push 여부.
* 다음 추천 작업.

대표 승인 전에는 push하지 않는다.
