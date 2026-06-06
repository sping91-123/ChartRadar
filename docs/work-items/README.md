# ChartRadar Work Items

이 폴더는 `docs/work-queue.md`가 너무 길어지지 않도록 개별 작업 상세와 완료 이력을 분리해 보관합니다.

`docs/work-queue.md`는 상위 인덱스와 우선순위 관제판이고, 이 폴더는 실제 실행 가능한 작업 카드와 완료 기록을 관리합니다.

상세 저장소 운영 원칙은 루트 `AGENTS.md`를 우선합니다.
`AGENTS.md`, `docs/work-queue.md`, 이 문서의 내용이 충돌하면 아래 순서를 우선합니다.

1. `AGENTS.md`
2. `docs/work-queue.md`
3. `docs/work-items/README.md`
4. 개별 work item 문서

---

## 문서 역할

* `docs/work-queue.md`

  * 전체 백로그 상위 인덱스.
  * 우선순위와 상태를 한눈에 보는 관제판.
  * 자동 명령어 라우팅 기준.
  * Push / PR 원칙.
  * 고위험 작업 기준.

* `docs/work-items/README.md`

  * 이 폴더의 운영 방식.
  * work item 작성 기준.
  * 새 작업 카드 템플릿.

* `docs/work-items/active-backlog.md`

  * 현재 살아있는 `TODO`, `IN_PROGRESS`, `BLOCKED` 작업 목록.
  * `AUTO NEXT`가 active run 이후 확인할 기본 후보 목록.

* `docs/work-items/*.md`

  * 개별 작업 상세 카드.
  * 작업 배경, 목표, 범위, 검증 명령, 완료 기준, 중단 조건을 기록한다.

* `docs/work-items/completed-history.md`

  * 완료된 작업 이력.
  * 완료 커밋, PR, 검증 결과, 남은 리스크를 보존한다.

* `docs/automation-runs/active-run.md`

  * 대표가 지정한 특정 문제 묶음을 순서대로 처리하는 active run 문서.
  * active run에 `TODO`가 있으면 `docs/work-items/`에서 임의 선택하지 않는다.

---

## 운영 방식

* `docs/work-queue.md`는 상위 인덱스와 운영 원칙만 유지한다.
* 활성 TODO/BLOCKED 작업은 `active-backlog.md`와 개별 작업 문서에 기록한다.
* 완료된 작업은 `completed-history.md`에 보존한다.
* 실제 실행은 가능하면 GitHub Issue + `@codex` + PR 흐름을 우선한다.
* main 직접 push 금지, 비밀값 커밋 금지, 한 번에 하나의 작업 처리 원칙은 `AGENTS.md`와 `docs/work-queue.md`를 따른다.
* 대표가 `AUTO NEXT`라고 하면 active run을 먼저 확인한 뒤, active run이 비어 있을 때만 `active-backlog.md`와 개별 work item을 확인한다.
* 작업 시작 시 해당 항목은 `IN_PROGRESS`로 바꾼다.
* 작업 완료 시 검증과 커밋까지 끝난 경우에만 `DONE`으로 바꾼다.
* 대표 승인 전에는 push하지 않는다.
* 완료된 작업을 다시 수정해야 하면 기존 항목을 되돌리지 말고 새 work item을 만든다.

---

## 자동 명령어와 Work Items 관계

### `AUTO PLAN ONLY`

* work item을 수정하지 않는다.
* 다음 작업 1개를 선택하고 계획만 보고한다.
* 필요하면 새 work item 후보를 제안할 수 있다.

### `AUTO NEXT`

* 먼저 `docs/automation-runs/active-run.md`를 확인한다.
* active run에 `TODO`가 있으면 해당 TODO 1개만 처리한다.
* active run이 없거나 모두 `DONE`이면 `active-backlog.md`에서 가장 우선순위 높은 `TODO` 1개를 처리한다.
* 처리 가능한 `TODO`가 없으면 임의로 코드 수정하지 않고 새 work item 후보 1~3개를 제안한다.

### `AUTO FIX SAFE`

* 명백한 타입 오류, 빌드 실패, smoke 실패, 모바일 레이아웃 깨짐처럼 범위가 좁은 문제만 처리한다.
* 결제, 인증, Supabase, Android release, FCM, production 관련 변경은 제외한다.
* 필요하면 새 work item으로 분리한다.

### `AUTO QA SWEEP`

* 기능 추가 없이 품질 점검만 수행한다.
* 발견한 문제는 `active-backlog.md` 또는 개별 work item 후보로 정리한다.
* 대표 지시 없이 대규모 리팩터링이나 디자인 변경은 하지 않는다.

### `AUTO RUN ACTIVE PLAN`

* active run의 `TODO`를 순서대로 처리한다.
* 한 턴에는 하나의 작업만 완료한다.
* 완료 후 관련 work item 또는 completed 기록을 갱신한다.

---

## 활성 작업 문서

현재 활성 또는 보존 대상 작업 문서는 아래와 같습니다.

### 활성 백로그

* `active-backlog.md`

### P1 작업

* `P1-core-routes-mobile-qa-sweep.md`
* `P1-pro-gating-copy-audit.md`
* `P1-google-oauth-project-cleanup.md`
* `P1-play-store-aab-push-tap.md`
* `P1-push-alert-scanner-refactor.md`
* `P1-design-system-phase2.md`

### P2 작업

* `P2-empty-loading-error-state-audit.md`
* `P2-live-market-chart-refactor.md`
* `P2-stock-radar-app-refactor.md`

### 완료 이력

* `completed-history.md`

---

## 새로 우선 등록할 자동화 친화 작업

`docs/work-queue.md`의 현재 우선순위 요약과 맞추기 위해 아래 작업을 우선 등록합니다.

| 우선순위 | 상태   | 작업                     | 상세 문서                                   |
| ---- | ---- | ---------------------- | --------------------------------------- |
| P1   | TODO | 핵심 route 모바일 QA sweep  | `P1-core-routes-mobile-qa-sweep.md`     |
| P1   | TODO | Pro gating 문구/노출 정책 점검 | `P1-pro-gating-copy-audit.md`           |
| P2   | TODO | 빈 상태/로딩 상태/에러 상태 UX 점검 | `P2-empty-loading-error-state-audit.md` |

이 작업들은 고위험 코드를 바로 수정하기보다 앱 완성도와 자동화 운영력을 높이기 위한 점검성 작업입니다.

---

## Work Item 작성 기준

새 작업 문서는 가능하면 아래 형식을 따릅니다.

```md
# 작업명

## 상태

- 상태: TODO
- 우선순위: P1 / P2 / P3
- 담당방:
- 인텔리전스: 낮음 / 중간 / 높음
- 위험도: 낮음 / 중간 / 높음
- 관련 route:
- 관련 Issue:
- 관련 PR:

## 배경

이 작업이 필요한 이유를 적는다.

## 목표

이 작업이 끝났을 때 사용자가 체감해야 하는 변화를 적는다.

## 범위

### 포함

- 이번 작업에서 수정할 수 있는 범위.

### 제외

- 이번 작업에서 건드리지 않을 범위.
- 결제, 인증, Supabase, Android, FCM 등 고위험 영역은 필요한 경우 명시적으로 제외한다.

## 예상 수정 파일

- `src/...`
- `docs/...`

## 검증 명령

- `git status --short --branch`
- `git diff --check`
- `cmd /c npx tsc --noEmit`
- `npm.cmd run build`
- 필요한 smoke 명령

## 완료 기준

- 목표가 충족된다.
- 수정 범위가 작업 목적과 직접 관련된다.
- 모바일 화면에서 깨짐이 없다.
- Basic/Pro 정책이 약화되지 않는다.
- 투자 권유, 수익 보장, 진입 지시처럼 보이는 문구가 없다.
- 검증 명령 결과를 보고한다.
- 커밋 또는 미커밋 상태를 명확히 보고한다.

## 중단 조건

- 고위험 영역 수정이 필요해지는 경우.
- 작업 범위가 예상보다 커지는 경우.
- 기존 변경과 충돌하는 경우.
- local과 `origin/main`이 불일치하는 경우.
- 작업트리가 dirty이고 기존 변경의 정체가 불명확한 경우.
- 검증 실패 원인이 불명확한 경우.

## 완료 기록

- 완료 커밋:
- PR:
- 검증 결과:
- 남은 리스크:
```

---

## 파일 이름 규칙

개별 work item 파일명은 아래 규칙을 따른다.

```text
P{우선순위}-{작업-요약}.md
```

예시:

```text
P1-core-routes-mobile-qa-sweep.md
P1-pro-gating-copy-audit.md
P2-empty-loading-error-state-audit.md
```

파일명은 짧고 명확하게 작성한다.

* 공백은 사용하지 않는다.
* 영문 소문자와 하이픈을 사용한다.
* route 이름이나 기능명이 드러나게 작성한다.
* 완료된 작업 파일명을 바꾸지 않는다.

---

## 우선순위 기준

### P1

즉시 처리하거나 출시/운영에 직접 영향을 주는 작업.

예시:

* 앱 실행 불가.
* 로그인 불가.
* 결제 권한 오류.
* Pro gating 오류.
* Play Console 또는 심사 대응.
* 개인정보, secret, 인증, 결제 위험.
* 핵심 route 모바일 사용성 문제.

### P2

앱 완성도와 사용성을 높이는 중요 작업.

예시:

* 핵심 화면 UX 개선.
* 빈 상태, 로딩 상태, 에러 상태 개선.
* 문구 정리.
* 컴포넌트 분리.
* 알림, 뉴스, 저널, 글로벌, 알트 완성도 개선.

### P3

장기 개선 또는 개발 편의성 작업.

예시:

* 내부 문서 정리.
* 낮은 위험의 리팩터링.
* 개발 자동화 보조.
* 중복 코드 정리.
* 테스트 보강.

---

## 위험도 기준

### 낮음

* 문서 수정.
* 작은 문구 수정.
* UI 표시만 바꾸는 작업.
* 기능 흐름이나 데이터 구조에 영향이 거의 없는 작업.

### 중간

* 일반 앱 컴포넌트 수정.
* route 화면 구조 변경.
* 사용자 흐름 변경.
* smoke 또는 build 검증이 필요한 작업.

### 높음

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

고위험 작업은 대표 승인 전에는 코드 수정, push, deploy, Play Console 제출, production migration을 하지 않는다.

---

## 핵심 route 기준

QA, UX, 문구, Pro gating 점검 작업에서는 아래 route를 우선 확인한다.

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

## QA Sweep 기록 기준

`AUTO QA SWEEP` 결과로 문제를 발견하면 아래 기준에 따라 기록한다.

### 바로 수정 가능한 낮은 위험 문제

* 작은 문구 오류.
* 명백한 UI 깨짐.
* 안전한 className 조정.
* 빈 상태 문구 누락.

처리 가능하면 하나의 work item으로 등록하거나, 기존 QA work item의 하위 항목으로 기록한다.

### 별도 work item으로 분리할 문제

* route 구조 변경이 필요한 문제.
* 여러 컴포넌트에 걸친 문제.
* Pro gating 정책 확인이 필요한 문제.
* 데이터 fetching 또는 API 수정이 필요한 문제.
* Android WebView 확인이 필요한 문제.

### BLOCKED로 기록할 문제

* 외부 콘솔 접근이 필요한 문제.
* Google Play Console 확인이 필요한 문제.
* RevenueCat 대시보드 확인이 필요한 문제.
* Supabase production 데이터 확인이 필요한 문제.
* 대표의 정책 결정이 필요한 문제.

---

## 상태 변경 기준

### TODO → IN_PROGRESS

작업을 실제로 시작할 때 변경한다.

시작 전 확인:

* `git status --short --branch`
* `git rev-list --left-right --count HEAD...origin/main`
* 작업트리 dirty 여부
* 고위험 영역 포함 여부

### IN_PROGRESS → DONE

아래 조건을 충족하면 `DONE`으로 변경한다.

* 작업 목표가 충족됨.
* 필요한 검증 명령을 실행함.
* 검증 결과를 기록함.
* 커밋 또는 미커밋 상태를 명확히 기록함.
* 남은 리스크를 기록함.

### TODO / IN_PROGRESS → BLOCKED

아래 경우 `BLOCKED`로 변경한다.

* 대표 확인이 필요함.
* 외부 콘솔 접근이 필요함.
* production 데이터 확인이 필요함.
* 고위험 영역 수정이 필요하지만 승인되지 않음.
* 검증 실패 원인이 불명확함.
* local과 remote 상태가 불일치함.
* 기존 미커밋 변경과 충돌 가능성이 있음.

### DONE 유지

완료된 작업을 다시 수정해야 하는 경우 기존 항목을 되돌리지 않는다.
새 work item을 만든다.

---

## 완료 이력 기록 기준

작업이 완료되면 필요한 경우 `completed-history.md`에 아래 내용을 기록한다.

```md
## 작업명

- 완료일:
- 우선순위:
- 담당방:
- 관련 route:
- 완료 커밋:
- 관련 PR:
- 수정 파일:
- 검증 명령:
- 검증 결과:
- 남은 리스크:
```

완료 이력은 나중에 채팅방이 바뀌어도 작업 맥락을 복원하기 위한 source of truth로 사용한다.

---

## 새 Work Item 생성 체크리스트

새 work item을 만들 때 아래를 확인한다.

* [ ] 작업명이 명확한가.
* [ ] P1/P2/P3 우선순위가 적절한가.
* [ ] 위험도가 명확한가.
* [ ] 관련 route가 적혀 있는가.
* [ ] 포함 범위와 제외 범위가 구분되어 있는가.
* [ ] 고위험 영역 포함 여부가 명확한가.
* [ ] 검증 명령이 적혀 있는가.
* [ ] 완료 기준이 구체적인가.
* [ ] 중단 조건이 적혀 있는가.
* [ ] `active-backlog.md`에도 반영했는가.
* [ ] `docs/work-queue.md`의 현재 우선순위 요약과 충돌하지 않는가.

---

## 대표 보고 기준

work item 처리 후 대표에게 보고할 때는 아래 항목을 포함한다.

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
