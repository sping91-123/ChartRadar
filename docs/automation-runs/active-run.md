# Active Automation Run

## Current Run — `news-impact-v1-local-implementation`

### Run State

- Status: `GATE_A_APPLIED / SHADOW_STARTING`
- Completion date: 2026-07-20
- Scope completed: 공식 출처 catalog, 사건 정규화·개정 병합, 15분·60분 반응 분류, 저장 원장과 RLS, 원자적 뉴스 알림 outbox, Crypto·Global NEWS, Home strip, Perpetual·Global·Journal 연결, 구형 `/api/radar-news` 저장 기반 호환 응답.
- Safe defaults: `NEWS_IMPACT_V1=shadow`, `NEWS_IMPACT_PUSH_ENABLED=false`.
- Explicitly not executed: News Impact UI `on`, 실제 News Impact FCM 발송, AAB/iOS/store 작업.

### 2026-07-21 Gate A Production Application

- 운영 Supabase에 `news_impact_v1` (`20260721101117`), `harden_news_impact_v1` (`20260721101128`), `reconcile_macro_event_status` (`20260721101323`)를 forward-only로 적용했다.
- 운영에 누락돼 있던 `macro_events`와 `macro_sync_runs`는 과거 migration replay 없이 News Impact migration이 additive bootstrap하도록 보완했다. 실제 런타임 상태 `released_pending_actual`, `actual_available`까지 별도 reconciler로 허용한다.
- 신규 12개 service-role 테이블은 모두 RLS 활성화·사용자 policy 0개이며, `PUBLIC`·`anon`·`authenticated` 직접 grant 0개, service role CRUD와 RPC 실행만 허용됨을 운영 catalog에서 확인했다.
- 적용 직후 News 원장 데이터는 0건이고 subscription 12건은 불변이었다. 공식 source allowlist 5개만 활성화됐고 CoinDesk·Cointelegraph·CNBC·MarketWatch는 blocked 상태다.
- Vercel Production 변수는 `NEWS_IMPACT_V1=shadow`, `NEWS_IMPACT_PUSH_ENABLED=false`로 저장했다. 5분 cron은 코드 배포 후 would-send 관찰만 시작하며 실제 News Push는 Gate C 전까지 발송하지 않는다.
- 로컬 재검증: `test:news-impact`, `smoke:migrations`, `smoke:all`, TypeScript, production build, `git diff --check` PASS.
- 남은 외부 게이트: Gate B 72시간 shadow 품질 관찰 뒤 UI `on` 여부 결정, Gate C 7일·eligible 10건·disposable Android FCM 검증 뒤 Push 별도 승인.

### Source And Decision Boundaries

- 활성 adapter는 Fed, SEC RSS·EDGAR, CFTC, 기존 공식 `macro_events`로 제한했다.
- CoinDesk, Cointelegraph, CNBC, MarketWatch는 `blocked_pending_license`이며 endpoint 없이 fail-closed로 유지한다.
- 뉴스는 Perpetual 점수·방향을 수정하지 않고 `강화·충돌·상태 변화·리스크 증가·무반응·데이터 부족` 오버레이만 제공한다.
- Basic 응답은 24시간 최대 3건과 공개 요약만, Pro는 30일 근거·반응·복기·명시적 opt-in 알림을 사용한다.
- `news-impact` 알림은 기본 OFF이며 ready 반응과 허용 공식 출처가 없으면 claim·발송할 수 없다.

### Local Verification

- PASS: `test:news-sources`, `test:news-impact`, `test:news-reactions`, `test:news-alerts`, `test:push-outbox`, `test:alert-preferences`.
- PASS: `test:perpetual-snapshot`, `test:perpetual-monitors`, `test:push-targets`.
- PASS: `smoke:migrations` production/repository/fresh 반복 적용, News RLS·revision·reaction integrity·quota·outbox·retention·account purge matrix.
- PASS: `smoke:supabase-security`, `smoke:ops`, `smoke:routes`, `smoke:mobile`, `smoke:all`, TypeScript, production build, `git diff --check`.
- PASS: canonical `supabase/schema.sql` News Impact block equals `20260720141318_news_impact_v1.sql` exactly.
- PASS: CLI Playwright 360×800 and 390×844 — Crypto NEWS, Global NEWS, Home strip, 알림→NEWS→동일 Perpetual snapshot→Journal, News→Global, stale·empty·error. 가로 넘침 0, 정상 상태 console/page error 0.
- QA evidence: `output/playwright/news-impact-v1/` (gitignored local artifacts).

### 2026-07-21 Re-audit Hardening

- 공식 출처 URL은 수집 시점뿐 아니라 catalog host 정책 변경, API 직렬화, Perpetual·Journal 문맥 조회, Push claim·발송 직전에도 다시 검증한다. 운영 `allowed_hosts` 축소는 기존 허용 item을 같은 트랜잭션에서 `blocked`로 전환한다.
- 5분 sync는 인접 bucket 사이에도 단일 lease를 사용하고 주기적으로 갱신한다. 기준 snapshot·observation보다 빠른 평가 시각은 DB와 순수 classifier 양쪽에서 거부한다.
- 매크로를 포함한 개정 사건은 최초 발표가 아니라 개정 감지 시각을 기준으로 재평가한다. 철회 사건과 현재 event version이 아닌 과거 reaction은 Perpetual·Journal에 다시 연결할 수 없다.
- SEC·CFTC 공동 발표는 실제 admission 경로에서 공통 event kind와 기관명 제거 semantic subject를 사용한다. 서로 다른 공식 URL도 같은 사건이면 병합되고, 제목 주제가 다르면 별도 사건으로 유지된다.
- 외부 요약 모델의 문자열은 결정론적으로 승인된 한국어 사실 문구와 정확히 일치할 때만 통과한다. 원문에 없는 수치·승인·인물 변동·시장 방향 문구는 저장되지 않는다.
- 계정 삭제가 pending·processing·failed인 사용자는 새 알림 claim과 기존 outbox 발송 대상에서 제외한다. 다만 기존 opt-in은 권한 종료 뒤에도 사용자가 직접 끌 수 있다.
- Push OAuth·FCM 요청에 timeout과 OAuth token 동시 요청 단일화를 적용했다. 만료·재시도 소진 시 일부 token 성공 기록은 `partial`과 `delivered_at`으로 보존한다.
- route smoke는 `off|shadow|on`에 따라 `/crypto/news`, `/news`, canonical redirect의 정확한 `Location`을 검증한다. `on` 호환 링크는 `asset`·`event`·`snapshot`·`source`만 보존하고 나머지 query를 제거하며, 로컬에서 `off`와 `on` 행렬을 모두 통과했다.
- CLI Chromium QA는 snapshot을 고정한 pagination과 늦은 BTC 응답 뒤 ETH 전환 race를 추가로 검증했다. 360×800·390×844 핵심 화면의 overflow와 예상 밖 console/page error는 0건이다.
- 최종 재검증: `smoke:all`, 독립 production build, TypeScript, `git diff --check` 모두 PASS. 첫 독립 병렬 시도에서 build와 `tsc`가 `.next/types`를 동시에 갱신해 일시 충돌했으나 올바른 순차 실행에서 재현되지 않았다.
- 운영 DDL·cron·Vercel flag·deploy·실제 FCM·AAB·스토어 변경은 이번 재감사에서 수행하지 않았다.

### Operational Gates Not Yet Run

- Gate A: 운영 DDL·5분 cron 적용 승인 후 production catalog/RLS 재검증과 `shadow` 수집 시작.
- Gate B: 최소 72시간 shadow 관찰에서 출처 없는 사건 0, 미허가 payload 0, 중복률 5% 이하, 수동 관련성 90% 이상일 때 UI `on` 검토.
- Gate C: 최소 7일과 eligible 사건 10건, 중복·snapshot 불일치·부적절 후보 0, disposable Android FCM 확인 후 별도 승인.
- 위 운영 시간 기반 기준은 로컬 구현 완료로 대체하거나 통과로 기록하지 않는다.

---

## Previous Completed Run

### Run Title

- `ios-first-local-build-readiness-run`

### Run State

- Status: `DONE`
- Setup date: 2026-06-10
- Previous run context:
  - `ios-xcode-signing-readiness-run` is `DONE`.
  - `ios-xcode-signing-readiness-run` selected `ios-first-local-build-readiness-run` as the next follow-up candidate.
- Current phase: TODO 6 complete; `ios-first-local-build-readiness-run` is `DONE`.
- Execution mode: `AUTO RUN ACTIVE PLAN` processes exactly one `TODO` task per turn.
- This setup registers the run only. No Xcode setting change, `xcodebuild`, local iOS build, archive, upload, TestFlight submission, signing change, provisioning/certificate creation, Apple Developer/App Store Connect change, native file edit, entitlements/capability creation, auth, Supabase, billing, RevenueCat, Android, or production action was executed during setup.

## Purpose

- Confirm whether ChartRadar can safely approach a first local iOS build after native iOS project generation and signing readiness audit.
- Check local environment, account/signing prerequisites, SPM/build preconditions, and whether a build attempt should be allowed or marked `BLOCKED`.
- Keep this run separate from TestFlight upload and archive work.
- Treat local build execution as a later per-TODO decision, not as a setup-time action.

## Background

- `ios-xcode-signing-readiness-run` is complete.
- Current signing readiness state:
  - Bundle ID: `com.staronlabs.chartradar`
  - `CODE_SIGN_STYLE`: `Automatic`
  - `DEVELOPMENT_TEAM`: not found
  - `PROVISIONING_PROFILE_SPECIFIER`: not found
  - `.entitlements`: not found
  - Sign in with Apple / Push / IAP: HIGH risk
  - Associated Domains: MEDIUM risk
  - first local build, archive, and TestFlight upload: not executed
- Main unresolved blockers:
  - macOS/Xcode/Command Line Tools/Apple ID/Xcode account/SPM resolution are unverified
  - Team ID, Apple Developer membership, certificates, and provisioning are unverified
  - explicit App ID and App Store Connect Bundle ID linkage are unverified
  - entitlements/capabilities are not configured
  - Apple login, IAP/RevenueCat, APNs/Firebase, reviewer notes, and listing readiness remain incomplete

## Explicitly Out Of Scope

- TestFlight upload, archive, App Store Connect upload, Transporter upload, or App Store submission.
- Apple Developer/App Store Connect console changes.
- Changing `DEVELOPMENT_TEAM`, signing style, provisioning profile, certificates, or capability settings.
- Creating provisioning profiles, signing certificates, Bundle ID/App ID records, or entitlements files.
- Editing `ios/App/App.xcodeproj/project.pbxproj` or `ios/App/App/Info.plist`.
- Auth/Supabase/billing/RevenueCat/entitlement changes.
- Android native/release setting changes.
- Production DB or production configuration changes.

## High-Risk Guardrails

- Do not open Xcode.
- Do not run archive/upload/TestFlight submission commands.
- Do not mutate signing, provisioning, Apple account, Apple Developer, or App Store Connect state.
- Do not change native iOS project files in this run.
- Do not create `.entitlements` files or enable capabilities.
- Do not run a local iOS build until the dedicated decision TODO marks it allowed; if prerequisites are missing, document `BLOCKED`.
- If the current environment is not macOS or lacks Xcode, record the local build path as `BLOCKED` instead of trying workarounds.

## Scope

- Primary planning file:
  - `docs/automation-runs/active-run.md`
- Companion local build readiness document:
  - `docs/ios-first-local-build-readiness.md`
- Cross-reference documents:
  - `docs/ios-testflight-readiness.md`
  - `docs/ios-xcode-signing-readiness.md`
  - `docs/qa/ios-testflight-checklist.md`

## Start Conditions

- Confirm `ios-xcode-signing-readiness-run` is `DONE`.
- Confirm current branch and working tree.
- Identify any pre-existing untracked files before editing.
- Confirm local branch is not diverged from upstream.
- Process exactly one `TODO` item per turn.
- Before any build-related command, confirm the current TODO explicitly allows that command.

## Stop Conditions

- The task requires signing changes, Apple Developer/App Store Connect mutations, provisioning/certificate creation, entitlements/capability creation, native project edits, auth/Supabase/billing/RevenueCat/entitlement edits, Android edits, archive/upload/submission, or production DB/config access.
- The environment lacks macOS/Xcode/Command Line Tools or a confirmed signing path and the task reaches local build decision.
- Sensitive values appear in docs, logs, command output, or diffs.

## Task List

| Order | Status | Task | Area | Risk | Goal | Forbidden | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | DONE | Local iOS build environment preflight | Environment | HIGH | Check OS, Xcode, Command Line Tools, `xcode-select`, `xcodebuild` version, and record Apple ID/Xcode account login as manual-only. | No build. No Xcode setting changes. No Apple account changes. | `git diff --check` |
| 2 | DONE | iOS project build precondition audit | Project Preflight | HIGH | Document current project path, scheme, target, configuration, signing state, SPM dependency, and ignored generated output preconditions. | No project edits. No `xcodebuild`. | `git diff --check` |
| 3 | DONE | Signing blocker decision | Signing Decision | HIGH | Decide whether missing Team ID/signing/provisioning means first local build should be `BLOCKED`. | No `DEVELOPMENT_TEAM` setting. No provisioning creation. No Apple Developer console changes. | `git diff --check` |
| 4 | DONE | Safe local build command candidate selection | Command Plan | HIGH | Document the exact local build command candidate and the conditions that must be true before it can run. | Do not execute command. No archive/upload. | `git diff --check` |
| 5 | DONE | Local build execution decision | Gate Decision | HIGH | Decide whether to run a local build or close as `BLOCKED` based on preconditions. | No TestFlight upload. No archive. No signing changes. | decision documented |
| 6 | DONE | Readiness result documentation | Documentation | LOW | Document readiness result, blockers, and one next-run candidate. | No next run auto-creation. | active-run `DONE` or `BLOCKED` state check |

## Build Command Boundary

Potential command candidate for later decision only:

```powershell
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination <explicit destination>
```

This command must not be run until TODO 5 decides the prerequisites are sufficient. Archive/upload commands are prohibited for the entire run.

## Candidate Next Runs

Task 6 must select at most one follow-up candidate:

- `ios-auth-apple-signin-risk-run`
- `ios-revenuecat-product-mapping-run`
- `ios-push-apns-firebase-readiness-run`
- `ios-first-local-build-run`
- `ios-xcode-team-signing-setup-run`

## Progress Log

### 2026-06-10 - TODO 1 Local iOS build environment preflight

- Result: `DONE`.
- Environment finding: current machine is Windows 11 Pro, not macOS.
- Local iOS build environment status: `BLOCKED` on this machine because Xcode and iOS local builds require macOS.
- `xcodebuild -version`: command not found.
- `xcode-select -p`: command not found.
- Apple ID / Xcode account login: `NOT_CHECKED`; must be manually confirmed inside Xcode on a macOS machine.
- SPM resolution readiness: `BLOCKED` until a macOS/Xcode environment is available.
- Build/archive/upload execution: not run.
- Native/config/console changes: none.
- Next TODO remains `2. iOS project build precondition audit`.

### 2026-06-10 - TODO 2 iOS project build precondition audit

- Result: `DONE`.
- Method: source inspection only.
- Project state: `ios/App/App.xcodeproj` and `ios/App/App.xcodeproj/project.xcworkspace` exist.
- Target/configuration state: target candidate `App`, scheme candidate `App`, `Debug` and `Release` configurations present, default configuration `Release`.
- Build setting state: bundle ID `com.staronlabs.chartradar`, deployment target `15.0`, device family `1,2`, app icon `AppIcon`, marketing version `1.0`, build number `1`.
- Signing state: `DEVELOPMENT_TEAM` not found, `CODE_SIGN_STYLE` is `Automatic`, provisioning profile specifier not found.
- SPM state: `ios/App/CapApp-SPM/Package.swift` exists, uses Capacitor SPM package `8.3.3`, and references local plugin packages for push notifications, Google sign-in, and RevenueCat.
- Generated output state: ignored generated outputs exist on disk and were not staged or committed.
- Current machine status: scheme list, SPM resolution, signing resolution, and local build remain `BLOCKED` or `NEEDS_MANUAL_CONFIRMATION` because this environment is Windows without Xcode.
- Build/archive/upload execution: not run.
- Native/config/console changes: none.
- Next TODO remains `3. Signing blocker decision`.

### 2026-06-10 - TODO 3 signing blocker decision

- Result: `DONE`.
- Decision: local iOS build execution is `BLOCKED` on the current machine.
- Primary blockers: Windows environment, no Xcode, no Command Line Tools, scheme list unavailable, SPM resolution unavailable, Apple ID/Xcode account not checked, Apple Developer membership unverified, no `DEVELOPMENT_TEAM`, certificate/provisioning state unconfirmed.
- Debug build separation: a future simulator-only Debug build may have fewer signing requirements, but it still requires macOS/Xcode, confirmed scheme, and SPM resolution.
- TestFlight/archive separation: Team ID, certificates/provisioning, explicit App ID/App Store Connect linkage, and capability decisions remain required for device/archive/TestFlight paths.
- Build/archive/upload execution: not run.
- Native/config/console changes: none.
- Next TODO remains `4. Safe local build command candidate selection`.

### 2026-06-10 - TODO 4 safe local build command candidate selection

- Result: `DONE`.
- Method: documentation-only command candidate selection.
- Current Windows decision: all Xcode/build command families are `BLOCKED` or `NOT_RUN` on this machine.
- Safe future macOS sequence candidate: `sw_vers`, `xcodebuild -version`, `xcode-select -p`, `xcrun simctl list devices`, `xcodebuild -list -project ios/App/App.xcodeproj`, then a Debug simulator build only if a later TODO/run explicitly allows build execution.
- First build candidate for a future macOS environment: Debug simulator build with scheme `App`, not device build, archive, or upload.
- Device build, archive, upload, TestFlight, Transporter, fastlane, signing mutation, `npx cap sync ios`, `npx cap open ios`, pod install, and native project mutation remain forbidden.
- Build/archive/upload execution: not run.
- Native/config/console changes: none.
- Next TODO remains `5. Local build execution decision`.

### 2026-06-10 - TODO 5 local build execution decision

- Result: `DONE`.
- Decision: local iOS build execution is `DO_NOT_RUN / BLOCKED` on the current machine.
- Primary blocker: current environment is Windows, not macOS.
- Secondary blockers: Xcode unavailable, Command Line Tools unavailable, scheme confirmation unavailable, SPM resolution unavailable, Apple ID/Xcode account not checked, no `DEVELOPMENT_TEAM`, signing/provisioning unconfirmed, App ID/App Store Connect linkage unverified.
- Retry conditions: macOS, Xcode, Command Line Tools, confirmed scheme `App`, SPM resolution, Apple ID/Xcode account as needed, and signing/team readiness before any device/archive path.
- Build/archive/upload execution: not run.
- Native/config/console changes: none.
- Next TODO remains `6. Readiness result documentation`.

### 2026-06-10 - TODO 6 readiness result documentation

- Result: `DONE`.
- Run result: `ios-first-local-build-readiness-run` is `DONE`.
- Local iOS build execution: `DO_NOT_RUN / BLOCKED`.
- Primary blocker: current machine is Windows, not macOS/Xcode.
- Secondary blockers: no Xcode/CLT, scheme list unavailable, SPM resolution unavailable, Apple ID/Xcode account not checked, no `DEVELOPMENT_TEAM`, signing/provisioning unconfirmed, App ID/App Store Connect linkage unverified, no entitlements/capabilities.
- Retry path: use a macOS/Xcode environment, confirm Xcode/CLT, confirm scheme `App`, resolve SPM, then decide whether a Debug simulator build is allowed.
- Next candidate if no macOS/Xcode machine is ready: `ios-macos-xcode-environment-setup-run`.
- Next candidate if macOS/Xcode is ready but signing is unresolved: `ios-xcode-team-signing-setup-run`.
- Next active-run creation: not performed.
- Build/archive/upload execution: not run.
- Native/config/console changes: none.

## Verification Policy

- Always run `git diff --check`.
- Confirm changed files remain inside `docs/`.
- Confirm no iOS native files were modified:
  - `ios/App/App.xcodeproj/project.pbxproj`
  - `ios/App/App/Info.plist`
  - `.entitlements` files
- Confirm `package.json`, `package-lock.json`, `capacitor.config.ts`, Android native/release files, auth/Supabase/billing/RevenueCat/entitlement code, and production config are unchanged.
- Run sensitive-value pattern checks before commit.

## Commit And Push Policy

- Setup commit message: `Define iOS first local build readiness run`.
- Docs-only setup may be committed and pushed to `main` when verification passes and the branch is in sync with `origin/main`.
- Do not release, deploy, archive, upload, submit App Store Connect changes, submit Play Console changes, alter production configuration, or run production-mutating operations during this run.

## Completion Report Format

- New active-run name.
- Registered task list.
- Purpose of this run.
- Build/archive/upload forbidden scope.
- Whether signing/Apple console change prohibition is reflected.
- Verification results.
- Commit hash.
- Push status.
- Final git status.

## 2026-07-16 별도 대표 지시 실행 기록

- 기존 `ios-first-local-build-readiness-run`은 그대로 `DONE`이며 이 기록은 active run 자동 실행이 아니라 대표가 승인한 ChartRadar 전체 안정화 계획의 별도 실행 결과다.
- 로컬 구현 범위: entitlement/RLS/migration, RevenueCat/Auth/계정 삭제, 분석·라우팅, 복구 UX·접근성·PWA, iOS 정적 준비, 배포 smoke.
- 검증: entitlement/auth/futures/hotfix 테스트, Supabase/billing/routes/mobile/ops/API/CSS smoke, `smoke:all`, TypeScript, production build, `git diff --check`, CLI Playwright 18개 모바일 화면.
- 결과: 모든 로컬 필수 게이트 통과. iOS 외부 자격증명과 Xcode team 설정 7개는 release gate에서 의도대로 차단됐다.
- 남은 위험: 운영 재집계와 migration 적용, RevenueCat/Apple 콘솔 설정, Mac archive/TestFlight, production deploy/release는 별도 승인 필요.
- 운영 변경: 없음. beta 12명 mutation 없음. Android 뒤로가기 정책 변경 없음.
- 커밋: 없음. push/deploy/release: 수행하지 않음.

## 2026-07-17 운영 전 read-only 게이트

- 운영 Supabase를 집계·catalog·advisor 쿼리로만 재확인했다.
- 최신 기준선: profiles/auth users 62/62, free 50, beta premium 12, admin 1, subscriptions 0, signals 0.
- beta 12명은 모두 2026-05 cohort이고 non-legacy subscription 충돌은 0건이다.
- migration ledger table은 없으며 profile self-upgrade, broad signal ACL/RLS, 공개 SECURITY DEFINER 실행 위험이 아직 운영에 남아 있다.
- `docs/production-entitlement-cutover-runbook.md`에 Gate A~D, dry-run hash, 검증과 중단 조건을 기록했다.
- 로컬 migration/security/hotfix 회귀와 `git diff --check`는 통과했다.
- production DDL/DML, beta mutation, migration 등록, push/deploy/release는 실행하지 않았다. 다음 단계는 별도 production 승인 게이트다.

## 2026-07-17 운영 Gate A+B 적용

- 대표의 명시적 승인 후 profile self-upgrade 차단과 signal fail-closed 두 migration만 운영에 적용했다.
- ledger: `20260717092124 close_profile_entitlement_self_upgrade`, `20260717092324 close_signal_entitlement_gap`.
- 실제 disposable Basic JWT에서 profile self-upgrade HTTP 403, anon signal SELECT 401, authenticated signal SELECT/DELETE 403을 확인했다.
- signup trigger와 service-role profile UPDATE는 정상이며 disposable user/profile은 즉시 삭제됐다.
- 최종 기준선 62 users/profiles, free 50, beta 12, subscriptions 0, signals 0 및 beta hash 불변을 확인했다.
- Gate C, beta backfill, deploy/push/release는 수행하지 않았다.
- Gate A+B advisor 이후 canonical migration의 production-missing-column signup 결함과 공개 trigger 함수 ACL을 로컬에서 보강했고 entitlement/migration/security 회귀를 통과했다. 이 Gate C 보강은 운영 미적용이다.

## 2026-07-17 운영 Gate C schema/RPC와 beta dry-run

- 대표 승인 범위: canonical schema/RPC 적용과 `backfill_legacy_beta_entitlements(12, true, null)` dry-run. 실제 beta DML은 제외했다.
- 첫 적용은 missing `signals.triggered_at` 오류로 원자적으로 롤백됐다. production `fired_at` 보존 이관과 old subscription provider/tier constraint 제거를 추가하고 실제 운영형 PGlite fixture를 통과한 뒤 재적용했다.
- ledger: `20260717131436 canonical_entitlement_ledger`.
- 실제 JWT: signup/free profile 정상, self-upgrade 403, signal anon/Basic SELECT 200, authenticated DELETE 403, beta RPC anon 401/authenticated 403, disposable cleanup 완료.
- dry-run: eligible 12, conflict 0, changed false, hash `23514409169df37bd42368113e94cb60`.
- 사후 기준선: profiles/auth users 63/63, Basic 51, beta 12, subscriptions 0, entitlement events 0, signals 0.
- advisor 후속: event ledger service-role privilege 최소화, duplicate legacy subscription policy 제거, entitlement helper SECURITY INVOKER 전환이 필요하다.
- 후속 migration `20260717133500_gate_c_advisor_hardening.sql`과 cohort 경쟁을 막는 `20260717134000_lock_beta_backfill_cohort.sql`은 로컬 회귀만 완료했고 운영 미적용이다.
- beta apply, Gate D, provider console, commit, push, deploy, release는 수행하지 않았다.

## 2026-07-17 전체 안정화 최종 구현·운영 기록

- 대표의 전체 승인 후 Gate C advisor hardening, beta cohort lock, beta backfill, Gate D 계정 삭제 원장, retry hardening을 단계별 검증과 함께 운영에 적용했다.
- 운영 ledger는 총 7건이며, beta dry-run과 apply 모두 대상 12명·충돌 0건·hash `23514409169df37bd42368113e94cb60` 조건을 만족했다.
- beta 12명에게 `profiles.created_at`부터 3개월인 `legacy_beta` subscription과 event를 각각 12건 생성했다. 최종 auth users/profiles 63/63, Basic 51, beta 12, subscriptions/events 12/12, signals/deletion requests/OAuth credentials 0/0/0이다.
- 계정 삭제 요청의 7일 deadline 멱등성, pending 취소, processing lock, 실패 backoff, 수동 retry를 운영 JWT/RPC로 검증했다. 표시된 일회용 Basic 계정 하나만 단건 처리해 Auth/profile/request 제거와 기존 beta aggregate 불변을 확인했다.
- 정상 권한은 subscriptions 단일 원장으로 통일했고 profile/app-metadata 유료 fallback, 비관리자 admin fallback, verified-empty 미철회, signal broad authenticated read를 제거했다.
- 동일 symbol 선물 근거 선택, ETH canonical route, stale response 차단, 글로벌 알림 기록, same-origin auth redirect, Supabase/RevenueCat logout 경계, neutral 계정 삭제 UX, root 복구 boundary, Journal/Spot/Global 복구 상태, 확대·ARIA·PWA 연결을 구현했다.
- Next.js `15.5.18`, React/DOM `19.2.7`로 보안 업그레이드하고 async `searchParams` 경계를 이관했다. production/full `npm audit`는 모두 취약점 0건이다.
- 필수 entitlement/auth/futures/hotfix 테스트, migration/Supabase/billing/mobile/ops/routes smoke, TypeScript, lint, production build, `smoke:all`, `git diff --check`가 모두 통과했다.
- CLI Playwright로 360×800과 390×844에서 `/crypto/home`, `/crypto/perpetual/alts`, `/global`, `/news?market=global`, `/journal`, `/pro`, `/global/alertlist`, `/account/delete` 총 16개 화면을 확인했다. 모든 화면에서 가로 overflow와 console error/warning은 0건이다. Codex in-app Browser는 사용하지 않았다.
- iOS release gate는 iOS RevenueCat key, Apple Team/Key/Client ID, private key, token encryption key, Xcode `DEVELOPMENT_TEAM`의 7개 외부 조건을 의도대로 차단한다. Windows에서는 실제 archive/TestFlight를 완료할 수 없다.
- Android 뒤로가기의 `/crypto/home` 이동은 대표 의도대로 변경하지 않았다.
- Android release bundle을 clean build로 새로 생성했다. `com.staronlabs.chartradar`, versionCode `12`, versionName `1.0.8`, 운영 URL `https://chartradar.kr`, cleartext 비활성 상태다.
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`, 7,584,612 bytes, SHA-256 `4B9F9BEF40200F477DF78444C8FBC95B63AFF119D09F50F02CA2F6BE8F6F8F51`. Gradle `validateSigningRelease`와 `jarsigner -verify`가 통과했다. 업로드 키는 self-signed certificate이므로 jarsigner의 chain/timestamp warning은 남는다.

## 2026-07-17 production 배포·provider 최종 검증

- 전체 안정화 구현은 PR `#6`으로 squash merge되었고 main SHA는 `c73a108e456f32389b38ef0096cf9b7e234fcef6`이다. 첫 production deployment `dpl_BMb67HUCbo4UcnF4Z2WLgyTJQPMa`가 READY가 된 뒤 운영 QA를 시작했다.
- RevenueCat production/sandbox 공용 webhook `ChartRadar production reconciliation`을 `https://chartradar.kr/api/billing/app-store/webhook`에 등록했다. HMAC signing을 활성화했고 노출 가능성이 생긴 최초 one-time secret은 즉시 회전해 폐기한 뒤 회전된 값만 Vercel Production sensitive 환경 변수로 저장했다.
- Vercel Production에 `REVENUECAT_WEBHOOK_SIGNING_SECRET`과 `ACCOUNT_DELETION_PROCESSING_ENABLED=true`를 추가했다. 기존 `CRON_SECRET`, RevenueCat REST key, Supabase service-role key가 배치되어 있음을 값 노출 없이 확인했다.
- RevenueCat dashboard의 합성 `TEST` 이벤트가 실제 subscriber UUID를 보장하지 않는 점을 반영해, 서명과 event ID를 먼저 검증한 뒤 entitlement mutation 없이 200을 반환하도록 PR `#7`을 추가했다. main SHA `f3772145471d31d52243bb4f6b762a250c339169`, production deployment `dpl_BEhuUNepvK4W9tJdxFrfCFmArAEr`가 `chartradar.kr` 별칭과 함께 READY다.
- RevenueCat dashboard에서 signed `TEST`를 한 번 전송해 `Response 200`을 확인했다. 직후 원장은 subscriptions 12건, `legacy_beta` 12건, entitlement events 12건, RevenueCat subscription/event 0건으로 불변이었다.
- 운영 API 경계는 unsigned webhook 401, account-deletion processor 무인증 401, account-deletion request 무인증 401, Toss checkout/confirm 410을 반환했다. `/crypto/home`, `/global`, `/pro`, `/account/delete`는 200이었다.
- production CLI Playwright를 다시 실행해 두 viewport의 16개 핵심 화면이 모두 200, canonical path 유지, horizontal overflow 없음, console warning/error 없음임을 확인했다. 검증 직후 임시 browser session과 QA 스크립트를 제거했다.
- 최근 1시간 Vercel runtime error cluster는 0건이었다.
- Supabase security advisor의 남은 WARN은 leaked-password protection 비활성화다. 현재 외부 Chrome 세션이 Supabase/GitHub에 로그인되어 있지 않아 자격증명 없이 dashboard 설정을 변경하지 않았다. `billing_entitlement_events`와 `oauth_provider_credentials`의 no-policy INFO는 외부 역할에 fail-closed인 내부 테이블 설계다.
- push, Play Console 업로드, App Store 제출은 수행하지 않았다. iOS 7개 외부 자격증명/Xcode 조건과 macOS archive/TestFlight는 계속 release gate로 남는다.

## 2026-07-20 Home → Perpetual 수익화 코어 v1 로컬 구현

- 대표 승인 계획에 따라 Binance USDT-M BTC·ETH의 공통 `PerpetualDecisionSnapshot`과 Home → Perpetual → monitor → 알림 → Journal 흐름을 구현했다.
- Home 첫 화면은 상태·가장 큰 위험·이유 2개·다음 조건·단일 CTA로 압축했고, 관심 거래소·알트 시세와 유료 판단 범위를 분리했다.
- Perpetual Hero·차트·압력·대형 체결·다중 시간대 근거는 하나의 snapshot을 공유한다. 유효 snapshot은 유지하고 만료·없는 ID와 asset 불일치는 최신 선택 자산 snapshot으로 교체하면서 갱신 안내를 표시한다.
- Basic 1개, Coin Pro·bundle·admin 20개인 preset+scenario shared quota, pause/resume/cancel, atomic scanner claim, 앱 내 알림, structured push target, Journal snapshot/monitor 연결을 구현했다.
- 신규 snapshot/monitor/outcome/product event 구조와 service-role RPC·RLS·retention·계정 삭제 purge migration을 추가했다. 운영 DDL은 적용하지 않았다.
- 익명 HMAC product analytics, RevenueCat verified purchase attribution, `off|shadow|on` preflight를 추가했다. 현재 local mode는 `off`이고 Vercel flag·deploy는 변경하지 않았다.
- 모바일 CLI Playwright에서 360×800·390×844 Home, BTC/ETH 동일 snapshot 이동, Home/alert 갱신, asset mismatch를 확인했다. 최종 session의 overflow·console error는 0건이다. 증거는 `output/playwright/perpetual-revenue-core-v1/`에 있다.
- 필수 신규/기존 테스트, Supabase·billing·ops·migration·mobile·route smoke, TypeScript, production build, `smoke:all`, `git diff --check`가 통과했다.
- 남은 외부 게이트: production migration, `shadow/on` Vercel flag와 deploy, 실제 5분 cron·disposable Android FCM, authenticated Basic/Pro E2E, 14일 beta 관찰. beta 12명 mutation, 실제 Push, AAB, 스토어, iOS, commit, push는 수행하지 않았다.
- 상세 기록: `docs/work-items/home-perpetual-revenue-core-v1.md`.

## 2026-07-20 Home → Perpetual 수익화 코어 v1 운영 활성화·최종 검증

- 운영 Supabase에 `20260720045112 perpetual_revenue_core_v1`, `20260720053641 reconcile_journal_columns`를 적용했다. Journal drift reconciler는 반복 적용 가능하며 production catalog·RLS·advisor 검증을 통과했다.
- Vercel Production의 `PERPETUAL_REVENUE_CORE_V1`을 `on`으로 활성화했다. 기능 PR `#11`은 main SHA `e660e5a897b307eb1fd2e42e5240f4f61af17e6c`로 squash merge됐고 deployment `dpl_5r2RZD7HcDSpgCipNKiy3rqLKHXb`가 `chartradar.kr`·`www.chartradar.kr` 별칭과 `iad1`·`sin1` 함수 배치로 READY다.
- production snapshot API는 BTC `quality=ready`, `continuity=current`, HTTP 200 JSON을 반환했다. Binance 451과 Journal `PGRST204`는 최종 deployment에서 재발하지 않았다.
- disposable Basic/Pro 운영 E2E를 다시 실행했다. Basic limit 1과 두 번째 `monitor_limit_reached`, Pro limit 20·invalidation monitor·pause/resume·Journal 201을 확인했다. beta 12명 fingerprint는 전후 불변이고 일회용 Auth·profile·subscription·monitor·Journal은 즉시 purge했다.
- 실제 scheduled `/api/push-cron`을 2회 관찰했다. 두 번 모두 HTTP 200, optional source `failed=[]`, `lookupErrorCount=0`, `scannerErrorCount=0`으로 protection HTML JSON 오류가 사라졌다. 첫 실행은 FCM API 성공 4건을 기록했으며 일부 기존 토큰 발송 실패가 남아 물리 단말 receipt와 stale token 상태는 베타 관찰 항목으로 둔다.
- CLI Playwright 운영 QA에서 360×800 BTC CTA bottom 530px, 390×844 ETH CTA bottom 482px로 첫 viewport 안에 들어왔다. BTC·ETH 모두 Home/detail asset·snapshot이 동일했고 각 화면의 `scrollWidth === innerWidth`, console error/warning 0건이었다. Codex in-app Browser는 사용하지 않았다.
- 최종 정리 후 운영 집계는 Auth users/profiles 66/66, subscriptions 12, `legacy_beta` 12, active scenario monitor 0, Journal 0, disposable Auth user 0이다. cohort dry-run hash `23514409169df37bd42368113e94cb60`과 E2E fingerprint 불변을 확인했다.
- 신규·기존 단위 테스트, Supabase·billing·ops·migration·mobile·route smoke, `smoke:all`, TypeScript, production build, `git diff --check`가 모두 통과했다.
- 베타 reporter preflight는 2026-07-21 KST 시작, 기능 release SHA `e660e5a897b307eb1fd2e42e5240f4f61af17e6c` 기준으로 cohort 12명·중복 0·Day 14 이후 entitlement 세 gate를 통과했다. Day 7은 2026-07-28, Day 14 종료는 2026-08-04 00:00 KST다.
- 시간·외부 장치 의존 잔여: Android 실기기 FCM receipt, 14일 사용 데이터, B01~B12 정성 인터뷰, 실제 RevenueCat 구매 표본의 2분·99% 판정. iOS·AAB·스토어 제출은 합의된 제외 범위다.
- Supabase advisor의 leaked-password protection WARN과 intentional fail-closed no-policy INFO, Vercel dashboard의 overdue/payment 경고는 잔여 운영 리스크다. 이번 작업에서 계정 결제 설정은 변경하지 않았다.

## 2026-07-21 Home·Perpetual 초보자 판단 과정 복원

- 사용자 피드백에 따라 결론만 남기던 축약을 되돌리고, Home과 Perpetual이 같은 분석 ID를 유지한 채 `결론 → 위험 → 확인 가격 → 차트 → 판단 과정 → 포지션 쏠림·큰 체결 → Pro 심화 근거·AI·알림·판단 기록`으로 이어지게 재구성했다.
- 기존 분석 자산을 삭제하지 않고 MSB·CHoCH를 `추세 방향 확인`, `추세 전환 가능성`으로 먼저 설명한 뒤 전문 약어를 괄호에 남겼다. Pro에는 15분·1시간·4시간별 정확한 발생 시각·가격, OB·FVG·Sweep·CISD·POC·PD, 청산 압력·큰 체결 상세 수치, 저장된 동일 분석 기반 AI 설명을 복원했다.
- Basic은 15분 차트, 중요한 확인 가격, 추세·전환 과정, 정성적 포지션 쏠림과 큰 체결을 계속 볼 수 있다. Pro 소개는 한 카드로 통합하고 다중 시간대·고급 가격 구간·상세 수급 수치·AI 설명·전체 조건 감시라는 실제 차이를 명시했다.
- Home 최상단의 풍부한 공식 경제 일정 카드를 복원해 사건명, 중요도, 한국시간 날짜·시각, 실제·예측·이전 값을 유지했다. 뉴스 반응이 있어도 일정을 숨기지 않으며, 관심코인 시세는 별도 관찰 영역에서 바로 보인다.
- 사용자 표면의 `스냅샷`, `상방/하방 시나리오`, `무효화 기준`, 설명 없는 `ICT`, `공식 사건`을 각각 `시장 분석`, `가격이 오를 때/내릴 때 확인할 흐름`, `해석을 다시 볼 조건`, `고급 가격 구조`, `공식 발표·공시`처럼 쉬운 말로 정리했다.
- 분석 상세 계약은 `perpetual-v1.1.0`으로 분리해 구형 저장 결과와 섞이지 않게 했고, 이미 저장된 조건 감시 ID는 `perpetual-v1.0.0` 호환을 유지했다. 일시적 갱신 실패 시 Pro 근거는 읽기 전용으로 보존하고 조건 감시만 막는다.
- CLI Playwright로 360×800 Home과 390×844 Perpetual을 확인했다. Home의 일정·결론·위험·확인 가격·상세 CTA가 첫 화면 안에 들어왔고, Perpetual의 차트·MSB/CHoCH 쉬운 설명·Basic/Pro 경계가 보이며 가로 overflow는 없었다. 증거는 `output/playwright/home-perpetual-beginner-v1/`에 있다.
- 검증: `test:perpetual-snapshot`, `test:perpetual-briefing`, `test:perpetual-monitors`, `test:futures-brief`, `test:push-targets`, `smoke:copy`, `smoke:ops`, `smoke:mobile`, `smoke:routes`, TypeScript, production build, CLI Playwright, 전체 `smoke:all` 통과.
- 운영 DB, Vercel 환경변수, 실제 Push, deploy, AAB, 스토어 제출은 수행하지 않았다. 커밋·push도 수행하지 않았다.

## 2026-07-21 News Impact v1·초보자 판단 과정 운영 반영

- 기능 PR `#14`를 squash merge했고 main SHA는 `98fc2fdea599ee4dff2663ab479d35909a5abc18`이다. production deployment `dpl_BsVFZCPw2EiW6pBpHzcqJ42Lq7dQ`가 `chartradar.kr`·`www.chartradar.kr` 별칭과 함께 READY가 됐다.
- 운영 Supabase에 `20260721101117 news_impact_v1`, `20260721101128 harden_news_impact_v1`, `20260721101323 reconcile_macro_event_status`를 적용했다. 신규 뉴스 테이블은 RLS 활성화, 사용자 정책 0개, `PUBLIC`·`anon`·`authenticated` 직접 grant 없음, service-role 전용 CRUD/RPC 상태다.
- Vercel Production은 `NEWS_IMPACT_V1=shadow`, `NEWS_IMPACT_PUSH_ENABLED=false`다. 공식 수집·반응 원장만 동작하며 News Impact UI와 실제 Push는 Gate B/C 전까지 활성화하지 않는다.
- 첫 shadow 주기에서 30일 보관 범위를 지난 정상 Fed RSS·SEC EDGAR 항목이 source 오류로 계산되는 문제를 발견했다. PR `#15`, main SHA `6da28553b10d340458fc69d7afc05b098baa977e`, production deployment `dpl_4u9RF5hqtE2pcmoFSHzkKCKWYixJ`로 과거 정상 항목은 건너뛰되 미래·잘못된 시각은 계속 fail-closed로 거부하도록 보완했다.
- 보완 후 2026-07-21 19:45 KST scheduled sync는 `stored`: Fed·SEC RSS·SEC EDGAR·CFTC·공식 macro store와 BTC·ETH·Global observation이 모두 `succeeded`, fetched 232, accepted 9, source failure 0, circuit open 0이었다.
- 운영 shadow 집계는 macro event 18, source item 13, impact event 21, market reaction 62다. News Impact Push 원장은 0건이고 `would_send_count=0`으로 실제 FCM은 발송하지 않았다.
- production API는 `/api/health` 200, 익명 snapshot 200과 Basic 직렬화, `/api/news-sync` 무인증 401, `/api/crypto/perpetual/briefing` 무인증 401, `/api/news-impact` shadow 응답을 확인했다. 최근 30분 Vercel runtime error cluster는 0건이다.
- production CLI Playwright에서 360×800 Home의 풍부한 경제 일정·위험·확인 가격·CTA와 390×844 Perpetual의 동일 분석 이동, 차트, MSB/CHoCH 쉬운 설명, 포지션 쏠림·큰 체결, Pro 심화 가치 카드를 확인했다. 가로 overflow와 console error/warning은 0건이다. 증거는 `output/playwright/production-gate-a/`에 있다.
- 검증: 신규 뉴스 테스트 전체, 기존 Perpetual·Push·Supabase·billing·ops·routes·mobile smoke, `smoke:all`, TypeScript, production build, `git diff --check` 통과. 보관 범위 보완 뒤 `test:news-sources`, `test:news-impact`, TypeScript, production build를 다시 통과했다.
- Gate A는 완료했다. Gate B는 2026-07-21 19:45 KST부터 최소 72시간 동안 출처 없는 사건 0, 미허가 payload 0, 중복률·관련성 기준을 관찰한 뒤 별도 전환한다. Gate C는 최소 7일과 eligible 사건 10건, 실제 disposable Android FCM 검증 조건이므로 Push OFF를 유지한다.
- AAB, Play Console, iOS, 스토어 제출은 수행하지 않았다. Vercel dashboard의 overdue/payment 경고와 Supabase leaked-password protection WARN은 별도 계정 운영 리스크로 남는다.

## 2026-07-21 Home·Perpetual·공식 NEWS 유료 가치 복구 (로컬)

- 운영 화면을 다시 확인한 결과 결론 축약 과정에서 Home CTA가 아래로 밀리고, Perpetual의 MSB·CHoCH·시간대별 구조·상세 수급·AI 설명 가치가 약해졌다. 이를 삭제 전 자산을 되살리는 방향으로 로컬에서 복구했다. NEWS의 `shadow` 계약은 공식 발표·공시 사실만 사용자에게 제공하고, 검증 전 시장 반응·정확한 분석 연결·알림·NEWS 전용 복기는 계속 숨기는 것으로 분리했다.
- Home은 공식 경제 일정의 날짜·시각·실제·예측·이전 값을 최상단에 유지하고, BTC/ETH 상태·가장 큰 위험·확인 가격·이유 2개·`전체 선물 분석과 조건 알림 보기`를 360×800 첫 화면 안에 배치했다. CTA 아래에는 같은 분석 시점의 공식 NEWS와 MSB·CHoCH·15분/1시간/4시간 근거·차트를 이어서 보여준다.
- Perpetual은 Basic에도 정확한 15분 MSB·CHoCH 가격·시각, 다중 시간대 흐름, 포지션 쏠림, 큰 금액 체결을 남겼다. Coin Pro에는 OB·FVG·Sweep·CISD·POC·가격 구간, RSI·MACD·ATR·거래량, 계정별 롱·숏·OI·펀딩비·강제 청산 위험·큰 체결 상세, AI 설명, 최대 20개 조건 감시와 당시 판단 기록의 차이를 명시했다.
- `/crypto/news`와 `/news?market=global`을 공식 사실 피드와 검증된 반응 화면으로 분리했다. `shadow`에서는 최근 공식 발표·공시 최대 3개의 사건명·시각·중요한 이유·공식 출처만 제공하고, `on`에서만 30일 이력·15분/60분 비교·전체 출처와 개정 이력을 연다. 미허가 매체 RSS·기사 스크래핑·뉴스 Push는 계속 차단했다.
- NEWS 화면은 `무슨 일이 있었나 → 발표 뒤 실제 시장 반응 → 현재 판단과 같은가 → 다음에 확인할 것`으로 정리했다. `snapshot`, `News Impact`, `첫 완결`, `동일 품질`, `수급 원본` 같은 내부·전문 표현을 쉬운 한국어로 교체했다. `shadow`는 공식 사실 UI만 제공하고, 반응 분류·알림·정확한 Perpetual 연결·NEWS 전용 복기는 Gate B 전까지 fail-closed다.
- NEWS→Perpetual→Journal 연결은 `on` 모드에서만 정확한 공식 뉴스 문맥을 저장한다. 미활성 모드에서는 버튼을 `선물 판단만 저장`으로 표시하고 뉴스 연결이 포함되지 않음을 안내해, 사용자가 NEWS 복기가 저장됐다고 오해하지 않게 했다.
- Home 매크로 일정 지연 원인은 클라이언트가 매 요청마다 저장 캐시를 우회하고, 저장 원장 조회도 다시 외부 공식 adapter를 호출하던 구조였다. 캐시 우회를 제거하고 저장 조회를 순수 DB read로 바꿨으며 Supabase 2.5초 timeout, API 4.5초 예비 일정 deadline, 클라이언트 8초 timeout과 즉시 fallback을 추가했다. 로컬 API는 stored-cache 18건을 약 2.4초에 반환했다.
- CLI Playwright 360×800·390×844에서 Home의 일정·위험·조건·CTA, 동일 분석으로 이동한 Perpetual의 MSB·CHoCH·다중 시간대·AI, Crypto/Global NEWS의 사실→반응→판단 영향→다음 확인, Coin Pro의 29,000원 가격·Google Play CTA, NEWS 문맥이 동결된 Journal 복기를 확인했다. Home CTA bottom 656px, Coin Pro CTA bottom 605px로 첫 화면 안에 있었고 모든 화면의 horizontal overflow와 console error/warning은 0건이었다. 출처 지연 상태도 마지막 정상 결과 확인 안내와 대체 행동을 표시했다. 증거는 `output/playwright/paid-flow-final-2026-07-21/`에 있다. Codex in-app Browser는 사용하지 않았다.
- 최종 상태에서 신규 NEWS·Perpetual·Push·제품 이벤트 테스트, 기존 entitlement·auth·futures·Supabase 테스트, migration·security·ops·routes·mobile·billing smoke, TypeScript, production build, `smoke:all`, `git diff --check`를 모두 통과했다. route smoke의 첫 실행은 QA 서버가 3100인데 기본 주소 3000을 사용해 연결 실패했으며, 동일 빌드의 실제 3100 주소와 `on` UI 후보 모드로 재실행해 43개 page manifest와 66개 route/API 검사를 통과했다.
- 웹 결제의 막힌 CTA를 실제 Android 패키지의 Google Play 경로로 연결하고, 이미 보유한 권한의 중복 구매를 막았으며, 로그인·구매 뒤 사용자가 보던 분석으로 돌아가는 `returnTo`를 보존했다. Basic과 Coin Pro의 차이는 `무료 결론·조건 감시 1개` 대 `1시간·4시간 신호 발생 가격·시각·심화 근거·AI 해설·20개 감시·알림 당시 판단 복기`로 실제 구현과 맞췄다. 예측 정확도를 보장하는 것으로 읽힐 수 있는 `정확한 신호` 표현은 제거했다.
- 운영 DB, 실제 Push, Vercel flag, deploy, AAB, 스토어 제출은 변경하지 않았다. 현재 변경은 `codex/restore-paid-value` 로컬 브랜치에 있으며 commit·push하지 않았다. 운영은 계속 NEWS `shadow`이므로 `chartradar.kr`은 production deploy와 Gate B `on` 전환 전까지 이 로컬 후보와 다르다.

## 2026-07-22 유료 가치 최종 회귀·모바일 신뢰도 보강 (로컬)

- Home은 360×800에서 풍부한 경제 일정의 사건명·D-day·한국시간·실제·예측·이전을 유지하면서 상태·가장 큰 위험·확인 가격·`전체 선물 분석과 조건 알림 보기`가 첫 화면 안에 들어왔다. CTA bottom은 660px이고 horizontal overflow와 console warning/error는 0건이다.
- Perpetual은 첫 화면의 결론·위험·확인 조건 다음에 조건 감시 CTA를 먼저 배치해 하단 탭에 가려지지 않게 했다. 360×800에서 CTA는 691~731px이고 하단 탭 위에 완전히 노출된다. 아래에는 15분 차트, MSB·CHoCH 발생 가격·시각, 15분·1시간·4시간 비교, 몰린 포지션, 큰 금액 체결, Coin Pro의 고급 구간·AI 설명·20개 감시·알림 당시 복기가 유지된다.
- Coin Pro 화면은 360×800에서 29,000원/월 가격과 Google Play CTA가 첫 화면 안에 들어오며 overflow와 console warning/error가 0건이다. `정확한 신호`처럼 수익·정확도를 보장하는 표현은 제거하고 실제 제공 범위인 신호 발생 가격·시각, 고급 구간, AI 설명, 조건 감시, 당시 판단 복기만 판매 문구에 남겼다.
- NEWS `shadow`는 공식 사실만 표시하고 검증 전 15분·60분 반응, 뉴스 알림, NEWS 전용 복기를 노출하지 않는다. 360×800에서 공식 출처 상태, `무슨 일이 있었나`, `왜 확인해야 하나`, `지금 할 일`, 선물 화면 CTA가 보이며 overflow와 console warning/error는 0건이다.
- 같은 신규 실업수당 일정이 TradingEconomics·ForexFactory 계열 입력에서 두 번 보이던 문제를 데이터 projection에서 해결했다. source와 표시명 대신 semantic event family·발표 시각으로 합치고, 211K·212K처럼 전망치가 다르면 임의 선택 없이 `출처별 전망 상이`로 표시한다.
- 공개 캘린더 행이 제목만으로 DOL 공식 데이터처럼 승격되던 provenance 오류를 차단했다. 공식 허용 host와 `official_api|official_page`가 함께 확인된 경우만 공식으로 표시하고, 과거 버그로 오염된 미래 DOL stored-cache는 live/fallback으로 우회한다.
- DOL adapter는 Initial Claims와 Continuing Claims를 분리하고 각각 `initialClaimsSa`, `continuedClaimsSa`를 사용한다. 발표 전 일정에 최신 주간 actual을 복사하지 않으며, 공식 actual과 공개 캘린더 actual이 충돌하면 공식값을 우선한다.
- AI 해설은 계정별 일일 한도와 전역 provider 일일 한도를 공유 Upstash backend에서 fail-closed로 적용한다. 예산 초과·provider 장애 fallback은 사용자별·전역 캐시에 저장하지 않아 정상 사용자의 유료 해설을 오염시키지 않는다.
- Home의 조건 수는 저장 quota가 아니라 실제 scanner가 평가하는 running count를 표시한다. 조건 이력은 저장 당시 분석과 trigger/마지막 확인 분석을 함께 보여주고, Journal 이동에는 서버가 다시 검증하는 monitor UUID 문맥을 보존한다.
- 검증: 신규 `test:macro-calendar`, NEWS·Perpetual·Push·제품 이벤트·entitlement·auth·futures·Supabase 테스트, migration·security·ops·copy·routes·mobile·billing smoke, TypeScript, production build, 전체 `smoke:all`, `git diff --check`가 통과했다.
- CLI Playwright 증거는 `output/playwright/value-ready-2026-07-22/`에 있다. Codex in-app Browser는 사용하지 않았다.
- 이 결과는 월 29,000원 제품의 로컬 출시 후보 품질을 의미하며 매출·수익을 보장하는 검증은 아니다. 운영 `chartradar.kr`, 운영 DB, 실제 Push, Vercel flag, deploy, AAB, 스토어는 변경하지 않았고 commit·push도 수행하지 않았다.

## 2026-07-22 유료 가치 P1 최종 차단·모바일 재검증 (로컬)

- 매크로 값 출처를 행 출처와 분리했다. 공개 캘린더 실제값·전망값은 공식 일정 링크가 붙어도 공식 수치로 승격되지 않으며, 숫자형 NEWS 사건은 `actualProvenance=official`인 경우만 공식 반응 원장에 들어간다.
- DOL은 Initial·Continuing·4주 평균을 서로 다른 사건과 필드로 유지하고 정확한 발표 주차가 없으면 actual을 붙이지 않는다. Census Durable Goods actual은 전망과 같은 전월비 퍼센트로 맞췄다. actual 갱신 timeout에는 오래된 정적 일정 대신 마지막 정상 stored payload를 유지한다.
- Upstash rate limit을 Lua `INCR+PTTL+PEXPIRE` 한 연산으로 바꿔 TTL 없는 영구 제한 키를 복구한다. 동일 분석 AI 생성은 60초 분산 lease와 전체 공급자 공용 18초 deadline으로 중복 비용을 막고, 공유 캐시 저장 실패 시 lease를 즉시 풀지 않는다.
- AI 공급자를 사용하지 않은 fallback은 `규칙 기반 자동 설명`으로 표시한다. 유료 기능 `on`·canary 활성화는 Groq 또는 명시적으로 활성화된 Gemini가 없으면 실패하며 health readiness에도 같은 조건을 적용한다.
- 알림 URL의 서버 검증 monitor ID를 sessionStorage보다 우선한다. Journal은 사용자 소유 monitor의 실제 조건·시간대·trigger/평가 시각을 서버에서 동결하며, 서버 장애 시 monitor 연결 복기를 불완전한 로컬 성공으로 저장하지 않고 재시도를 안내한다.
- 검증: `test:macro-calendar`, `test:news-sources`, `test:news-reactions`, `test:perpetual-snapshot`, `test:perpetual-briefing`, `test:perpetual-monitors`, `smoke:ops`, TypeScript, production build, 최종 `smoke:all`을 모두 통과했다. AI 공급자 미설정 `on` fixture는 의도대로 activation gate 실패를 확인했다.
- CLI Playwright로 360×800과 390×844의 Home·Perpetual·Coin Pro를 재확인했다. Home은 공식 일정 날짜·시각·실제값과 결론·위험·확인 조건·CTA가 첫 화면에 있고, Perpetual 조건 감시 CTA와 29,000원 Google Play CTA는 하단 탭 위에 노출된다. 증거는 `output/playwright/paid-value-final-2026-07-22/`에 있다. Codex in-app Browser는 사용하지 않았다.
- 운영 `chartradar.kr`, 운영 DB, 실제 Push, Vercel flag, deploy, AAB, 스토어, commit·push는 변경하지 않았다. 이 완료는 로컬 제품 후보의 구현·회귀 품질이며 실제 매출을 보장하지 않는다.

## 2026-07-22 매크로·NEWS 데이터 신뢰성 최종 보강 (로컬)

- DOL Initial Claims·4주 평균은 발표에 대응하는 직전 토요일, Continuing Claims는 그보다 1주 전 보고 기간만 사용한다. 휴일 발표·연도 경계와 `Jobless Claims 4-week Average` 역순 라벨을 fixture로 고정하고 0.25K 정밀도를 보존했다.
- Census Durable Goods는 공식 발표일을 동일 회차 매칭에만 사용하고 실제 사건 시각은 캘린더 발표 시각을 유지한다. `Core`, `Ex Transportation`, `Ex Transp`, `Nondefense Capital Goods` 같은 세부 지표에는 headline actual을 붙이지 않는다.
- 실제값에는 provider·공식 URL·보고 기간·관측 시각을, 시장 예상에는 별도 provenance·provider·URL을 보존한다. Home의 호재·악재 해석과 숫자형 NEWS admission은 공식 actual, 유효한 값, `actual_available`, 허용 source type, DB/raw 값 일치를 모두 요구한다.
- stale stored payload는 강제 갱신과 live timeout에서도 마지막 정상 fallback으로 유지하되 화면에 마지막 정상 확인 시각을 표시한다. 예비 일정과 일부 공식값 확인 지연은 stale과 다른 상태로 표시하며 모든 compact 경로에도 경고가 보인다.
- 수집 결과가 비어 있는 live 응답은 `fallback/degraded`로 전환하고 정적 예비 일정이 정상 원장을 덮어쓰지 못하게 했다. macro sync degraded 응답은 HTTP 503과 실패 원장으로 드러난다.
- 정상 동기화는 ISO `syncGeneration`을 모든 행에 함께 저장한다. 화면과 NEWS는 중요도 필터보다 먼저 최신 세대를 선택하므로 발표 시각 변경·취소 전 일정과 이전 세대의 고중요도 사건이 다시 나타나지 않는다. 최근 8일·향후 60일 조회와 90일 retention도 적용했다.
- 검증: `test:macro-calendar`, `test:news-sources`, `test:news-reactions`, `test:news-impact`, `smoke:ops`, TypeScript, 64-page production build, 최종 전체 `smoke:all`이 통과했다. 독립 읽기 전용 감사에서 발견된 데이터 신뢰 P1을 모두 반영한 뒤 마지막 전체 회귀를 다시 실행했다.
- 운영 `chartradar.kr`, 운영 DB, cron, Push, Vercel flag, deploy, AAB, 스토어, commit·push는 변경하지 않았다. 로컬 후보가 돈을 받을 만한 제품 구조에 가까워졌다는 의미이며 실제 결제 전환과 매출은 운영 배포 후 사용 데이터로 별도 검증해야 한다.

## 2026-07-22 BTC.D·환율·김프 기준 정합성 보강 (로컬)

- 사용자가 비교하는 기준에 맞춰 BTC 도미넌스를 CoinGecko 전체 시장 비중에서 공식 TradingView `CRYPTOCAP:BTC.D` 위젯으로 교체했다. TradingView 숫자를 비공식 API로 복제하지 않으며 원문 링크와 정의를 함께 표시한다.
- 원·달러 대표값은 TradingView `FX_IDC:USDKRW`를 그대로 표시한다. 김프 계산용 환율은 선택적 exchangerate.dev 실시간값, ExchangeRate.fun 시간 단위값, Frankfurter 일 단위값 순으로 fail-closed 처리하며, 일 단위 공급자의 날짜를 가짜 시각으로 변환하지 않는다.
- 김프 정의를 `Upbit BTC/KRW 현물 ÷ Binance BTC/USDT 현물 ÷ Coinbase USDT/USD 체결가 ÷ USD/KRW - 1`로 고정했다. Futures fallback과 `1 USDT=1 USD` 가정을 제거하고 네 원천의 값·기준 시각·최대 시차·허용 지연을 검증한다.
- 부분 장애에서는 필드별 마지막 정상값만 제한 시간 동안 유지한다. 김프의 원래 계산 시각과 사용한 환율·USDT/USD·출처·갱신 주기를 함께 동결해 stale 수명이 반복 요청으로 연장되거나 새 환율 라벨이 과거 계산값에 붙지 않게 했다.
- 화면은 1분 visibility-aware 자동 갱신, 늦은 응답 차단, 마지막 정상값 배지, 원천별 기준 시각, TradingView 위젯 자동 재시도·수동 재시도·접근 가능한 원문 링크를 제공한다. BTC.D 문구는 자금 이동 인과를 단정하지 않고 시가총액 비중과 알트의 상대 강도로 설명한다.
- 실제 공개 원천을 같은 시각에 다시 조회해 API 김프와 재계산값이 약 0.001%p 이내로 일치함을 확인했다. 로컬 production API는 warnings 없이 시간 단위 환율과 세 현물 시각을 반환했다.
- 검증: 신규 `test:coin-market-metrics`의 계산·잘못된 날짜·unknown source·stale TTL·부분/전체 장애·캐시·시각 불일치 행렬, TypeScript, 64-page production build, `smoke:ops`, `smoke:mobile`, `smoke:routes`, 최종 `smoke:all`, `git diff --check`가 통과했다.
- CLI Playwright로 360×800·390×844 Perpetual 시장 환경 패널을 확인했다. 두 TradingView 위젯 높이는 89px, 원천·Coinbase 환산 표시는 노출되고 horizontal overflow와 console error는 0건이다. 증거는 `output/playwright/coin-market-metrics-panel-360.png`, `output/playwright/coin-market-metrics-panel-390.png`에 있다. Codex in-app Browser는 사용하지 않았다.
- 운영 `chartradar.kr`, 운영 환경변수, deploy, Push, AAB, 스토어, commit·push는 변경하지 않았다. Vercel 인스턴스별 메모리 캐시와 Android 실기기 확인은 배포 후 운영 관찰 항목이다.

## 2026-07-22 매크로 발표 호재·악재·중립 복구 (로컬)

- 회귀 원인은 최근 발표 실제값이 `public_calendar`인데 UI 판정이 공식 actual만 허용하면서 최신 일정의 배지가 모두 사라진 것이었다. 공식 actual은 `호재·악재·중립`, 공개 캘린더 actual은 `잠정 호재·잠정 악재·잠정 중립`으로 구분해 복구했다.
- 판정은 실제값과 시장 예상의 surprise를 같은 단위로 비교한다. 물가·임금·고용·수요와 실업수당의 방향을 구분하고, 발표 전·결측·알 수 없는 출처·단위 불일치·혼합 전망은 표시하지 않는다. 전월비와 전년비가 엇갈리면 `중립`과 엇갈림 이유를 표시한다.
- Home은 다음 일정이 주 카드일 때도 `직전 발표 · 실제값 · 판정 · 발표 시각`을 유지한다. Schedule과 Crypto/Global NEWS는 실제·예측·이전 값, 판정 배지, `단기 금리·달러 기준` 이유와 공식/잠정 상태를 함께 보여준다.
- Census 공식 Economic Indicators의 `MARTS`를 Retail Sales headline actual로 연결했다. Core·Control Group·Ex Autos에는 headline actual을 잘못 붙이지 않는다.
- 신규 `test:macro-impact`와 기존 `test:macro-calendar`, `smoke:ops`, `smoke:mobile`, `smoke:routes`, TypeScript, production build, 최종 `smoke:all`, `git diff --check`가 통과했다. route smoke 첫 실행은 기준 포트 3000 서버가 없어 연결 실패했으며 빌드 서버를 띄운 동일 검증은 66개 경로/API 전부 통과했다.
- CLI Playwright로 360×800 Home·Crypto NEWS와 390×844 Schedule·Global을 확인했다. 발표값·배지·날짜가 보이고 horizontal overflow와 console error는 0건이다. 증거는 `output/playwright/macro-impact-restore/`에 있다. Codex in-app Browser는 사용하지 않았다.
- 운영 `chartradar.kr`, 운영 DB, cron, deploy, Push, AAB, 스토어, commit·push는 변경하지 않았다. 배포 전 저장 캐시는 public-calendar actual을 잠정으로 표시하고, 배포 후 공식 동기화가 성공한 항목부터 확정 배지로 전환된다.

## 2026-07-23 Home 상단 매크로 일정 비중 축소 (로컬·Figma)

- Home 매크로 기본 카드를 Figma 390px 기준 162px에서 120px로, 360px QA 기준 약 111px로 줄였다. 날짜·시각, 중요도, 사건명, 발표 상태, 호재·악재·중립, 실제·예측·이전 값은 접힌 상태에 유지했다.
- 판정 이유, 전체 수치, 직전 발표, 출처 상태, stale 경고, 출처 링크, 전체 일정 링크는 native `details` 펼침 영역으로 이동했다. 삭제된 데이터는 없다.
- 발표 전 실제값은 빈칸 대신 `발표 전`으로 표시한다. 공개 보조 출처는 `출처`, 공식 일정은 `공식 일정 출처`, 공식 실제값은 `공식 발표값 출처`로 구분해 과장된 출처 라벨을 막았다.
- Figma 증거는 `output/figma/v2-home-macro-compact-390.png`, `output/figma/v2-home-macro-compact-360.png`에, 실제 구현 증거는 `output/playwright/macro-compact-home-390x844.png`, `output/playwright/macro-compact-home-390x844-expanded.png`, `output/playwright/macro-compact-home-360x800.png`에 있다.
- CLI Playwright에서 390×844·360×800 Home의 접힘·펼침, 첫 화면 선물 CTA, horizontal overflow 0, console error/warning 0을 확인했다. Codex in-app Browser는 사용하지 않았다.
- 검증: `test:macro-impact`, `test:macro-calendar`, `smoke:ops`, `smoke:mobile`, production server의 `smoke:routes`, TypeScript, production build, `git diff --check` 통과.
- 운영 `chartradar.kr`, 운영 DB, cron, deploy, Push, AAB, 스토어, commit·push는 변경하지 않았다.

## 2026-07-23 BTC.D·환율·김프·매크로 UI 운영 반영

- PR #18을 squash merge해 운영 `main` 커밋 `cc4c3f8b134c0e2f878c6af0637bbc314c302700`에 반영했다. Vercel 운영 배포 `dpl_Dt7rASgPyjeYBLTmiYChGRYTtshf`가 `READY`이며 `chartradar.kr`, `www.chartradar.kr` 별칭 연결 오류는 없다.
- 운영 Home을 CLI Playwright 390×844·360×800에서 확인했다. 축소된 매크로 카드의 접힘·펼침, 실제·예측·이전 값, 발표 후 판정 안내, 첫 화면 선물 CTA가 정상이며 horizontal overflow와 console error/warning은 0건이다.
- 운영 Perpetual에서 TradingView `CRYPTOCAP:BTC.D`, TradingView `FX_IDC:USDKRW`, Upbit·Binance 현물과 Coinbase USDT/USD를 사용한 김프 카드가 노출되는 것을 확인했다. `/api/coin-market-metrics`는 stale 없이 계산값을 반환하고 일 단위 환율 fallback은 전일 기준으로 명시한다.
- 운영 `/api/health`는 HTTP 200이며 관련 Home·시장지표·매크로 API의 최근 1시간 Vercel runtime error는 0건이다. 배포 증거는 `output/playwright/production-release-2026-07-23/`에 있다.
- Android 앱은 Capacitor WebView가 `https://chartradar.kr`를 로드하므로 이번 웹 UI·서버 API 변경에는 새 AAB가 필요하지 않다. Android native·Manifest·Gradle·플러그인·버전·아이콘·FCM 설정은 변경하지 않았고 Play Console 업로드도 수행하지 않았다.

## 2026-07-23 TradingView 비공식 scanner 네이티브 지표 전환 (운영 배포 승인)

- 사용자 지시에 따라 TradingView 화면이 사용하는 비공식 `global/scan` 응답을 서버에서 확인해 `CRYPTOCAP:BTC.D`와 `FX_IDC:USDKRW` 숫자만 가져오는 로컬 후보를 구현했다. 브라우저 iframe과 `TradingViewSingleTicker`는 제거하고 ChartRadar 카드 안에 현재값·등락률·서버 확인 시각·원문 링크를 표시한다.
- 한 요청에서 심볼을 함께 조회하고 행 순서가 바뀌어도 심볼명으로 매핑한다. `update_mode=streaming`만 현재값으로 인정하며 부분 응답·범위 오류·지연/EOD 값은 fail-closed 처리한다. BTC.D는 15분, scanner 환율은 30분 동안만 마지막 정상값을 유지하고 이후 비운다.
- scanner 환율과 기존 exchangerate.dev·ExchangeRate.fun·Frankfurter fallback을 동시에 시작해 scanner 장애가 기존 환율 대체 경로를 5초 이상 추가 지연하지 않게 했다. 같은 Vercel 인스턴스의 동시 요청은 하나의 in-flight refresh를 공유한다. 김프는 화면에 표시한 동일 USD/KRW 값과 Upbit·Binance 현물·Coinbase USDT/USD를 사용한다.
- 로컬 production API에서 BTC.D `59.36%`, USD/KRW 약 `1,477원`, 두 값 모두 `tradingview-scanner`, 김프 계산 환율과 화면 환율 동일, stale `false`, 두 번째 요청 cache hit을 확인했다. 값은 시장 상황에 따라 계속 변한다.
- CLI Playwright 390×844·360×800에서 네이티브 시장 환경 카드, 숫자·등락·확인 시각, iframe 제거, 가로 overflow 0, console error/warning 0을 확인했다. 증거는 `output/playwright/native-tradingview-metrics-2026-07-23/`에 있다. Codex in-app Browser는 사용하지 않았다.
- 검증: `test:coin-market-metrics`, TypeScript, production build, `smoke:ops`, `smoke:mobile`, production server의 `smoke:routes`, 최종 전체 `smoke:all`, `git diff --check` 통과. 첫 `smoke:all`은 명령 실행 제한 120초를 넘어 중단됐고 동일 검사를 10분 제한으로 다시 실행해 177초에 정상 통과했다.
- TradingView 공식 약관은 시장 데이터의 자동 수집·가공·제3자 상용 서비스 사용과 보상 대가 재배포를 별도 서면 허가 없이 금지하고, Widget FAQ도 데이터 API를 제공하지 않는다고 명시한다. 이 법적·계약상 위험과 허가된 상용 데이터 공급자 대안을 대표에게 다시 알렸으며, 대표의 명시적 운영 배포 지시에 따라 이번 릴리스 대상으로 전환한다. endpoint 차단·스키마 변경·정책 집행 가능성은 운영 관찰 위험으로 남긴다.
- DB, Push, Android native, AAB, Play Console, 스토어는 변경하지 않았다.
