# Active Automation Run

## Run Title

- `ios-first-local-build-readiness-run`

## Run State

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
