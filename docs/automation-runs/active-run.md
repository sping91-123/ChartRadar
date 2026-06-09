# Active Automation Run

## Run Title

- `ios-capacitor-platform-setup-run`

## Run State

- Status: `TODO`
- Setup date: 2026-06-09
- Previous run context:
  - `ios-testflight-readiness-run` is `DONE`.
  - `ios-testflight-readiness-run` selected `ios-capacitor-platform-setup-run` as the first follow-up candidate.
- Current phase: Task 7 complete; next TODO is `8. Select next iOS follow-up run`.
- Execution mode: `AUTO RUN ACTIVE PLAN` processes exactly one `TODO` task per turn.
- This setup registers the run only. No dependency install, iOS platform add, Capacitor sync, iOS build, Xcode, pod install, archive, upload, Apple Developer, App Store Connect, RevenueCat, Supabase, auth, billing, entitlement, Android release, or production action was executed during setup.

## Purpose

- Prepare and execute the first controlled Capacitor iOS platform setup path for ChartRadar TestFlight readiness.
- Start with environment, dependency, package state, and command-scope checks before any native iOS project generation.
- Add `@capacitor/ios` and generate the native `ios/` project only in the specific TODOs that allow those actions.
- Keep TestFlight archive/upload, Apple Developer/App Store Connect, RevenueCat/App Store products, auth, Supabase, billing, Android release, and production settings out of scope.

## Background

- `ios-testflight-readiness-run` confirmed:
  - `capacitor.config.ts` `appId`: `com.staronlabs.chartradar`
  - `appName`: `Chart Radar`
  - `webDir`: `mobile-shell`
  - `ios/` directory is missing
  - native iOS project is missing
  - `@capacitor/ios` is missing
  - `package.json` has Android Capacitor scripts only
  - Bundle ID candidate is `com.staronlabs.chartradar`
  - iOS display name candidate is `Chart Radar`
- The same readiness run selected `ios-capacitor-platform-setup-run` as the first technical follow-up because no real iOS build/archive/TestFlight work can start without the native platform.

## Explicitly Out Of Scope

- Xcode archive, iOS build, TestFlight upload, Transporter upload, App Store Connect submission, or production iOS release.
- Apple Developer/App Store Connect console changes, Bundle ID registration, App ID registration, certificate creation, provisioning profile creation, or capability toggles.
- RevenueCat console changes, App Store subscription product creation, offering/package/product mapping changes, product IDs, plan IDs, entitlement names, prices, or billing policy changes.
- Supabase/Auth/RLS changes, Sign in with Apple implementation, account/session changes, production DB changes, or real login/purchase/restore tests.
- Android native/release setting changes.
- FCM/push-cron/server sending changes.
- Manual `pod install` unless a later explicitly approved run scopes it. If Capacitor CLI performs dependency installation as part of platform generation, document the result rather than manually expanding scope.

## High-Risk Guardrails

- Do not run `npx cap add ios` before TODO 5.
- Do not run `npx cap sync ios`, `npx cap open ios`, `xcodebuild`, `fastlane`, `pod install`, archive, upload, or submission commands in this run.
- Do not open Xcode.
- Do not modify generated native iOS files after platform generation in this run; audit and document required changes instead.
- Do not modify Android native/release settings.
- Do not modify auth, Supabase, billing, RevenueCat, entitlement, product, price, push sending, account deletion, logout, or session logic.
- If generated files include unexpected sensitive values or broad unrelated changes, stop and report before committing.

## Allowed Change Scope

- `package.json`
- `package-lock.json`
- generated `ios/` files only during TODO 5
- `docs/automation-runs/active-run.md`
- `docs/ios-testflight-readiness.md`
- optional `docs/qa/ios-testflight-checklist.md`

## Forbidden Change Scope

- Android native/release settings
- `src/lib/billing.ts`
- `src/lib/mobilePurchases.ts`
- RevenueCat setup code
- Supabase/Auth/RLS
- product ID, plan ID, entitlement, and price semantics
- push-cron and FCM server sending
- account deletion, logout, and session logic

## Start Conditions

- Confirm `ios-testflight-readiness-run` is `DONE`.
- Confirm current branch and working tree.
- Confirm local branch is not diverged from upstream.
- Confirm current Capacitor/package state and `ios/` absence before any install or platform generation.
- Process exactly one `TODO` item per turn.

## Stop Conditions

- The task requires external console work, signing, archive, upload, TestFlight submission, auth implementation, RevenueCat/App Store product work, Supabase changes, billing policy changes, Android release changes, or production data access.
- `@capacitor/ios` install attempts to upgrade unrelated packages or Capacitor major versions unexpectedly.
- `npx cap add ios` generates unexpected non-iOS or protected-path changes.
- Sensitive values appear in generated files, docs, logs, command output, or diffs.

## Task List

| Order | Status | Task | Area | Risk | Goal | Forbidden | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | DONE | iOS setup preflight environment/status check | Preflight | LOW | Confirmed branch, working tree, Node/npm, Capacitor config, package state, and missing iOS platform state. | No dependency install. No iOS platform add. | `git diff --check` |
| 2 | DONE | Confirm `@capacitor/ios` install need and command | Dependency Plan | MEDIUM | Confirmed matching Capacitor version and selected the exact install command without installing yet. | No install. No unrelated package changes. | `git diff --check` |
| 3 | DONE | Add `@capacitor/ios` dependency | Dependency Change | MEDIUM | Added `@capacitor/ios` matching the existing Capacitor major/version in the appropriate dependency section. | No arbitrary upgrades. No package manager change. No Android dependency change. | `git diff --check`; `cmd /c npx tsc --noEmit`; `npm.cmd run build` |
| 4 | DONE | Confirm iOS platform generation prerequisites | Platform Preflight | MEDIUM | Confirmed `npx cap add ios` prerequisites, `webDir`/mobile-shell state, and expected generated file scope before running platform generation. | No cap add. No Xcode. No sync/build. | `git diff --check` |
| 5 | DONE | Generate iOS platform | Native Generation | HIGH | Ran the controlled Capacitor iOS platform generation step. | No Xcode. No manual pod install. No build/archive/upload. No Apple Developer/App Store Connect changes. | `git diff --check`; generated file list review |
| 6 | DONE | Audit generated iOS platform config | Native Audit | MEDIUM | Inspected generated native project Bundle ID/appName/webDir linkage and documented needed follow-up edits. | No native config edits. No signing changes. | `git diff --check` |
| 7 | DONE | Safe validation and result documentation | Verification | LOW | Documented generated results and remaining risks after running safe checks. | No iOS build/upload. No Xcode. | `git diff --check`; `cmd /c npx tsc --noEmit`; `npm.cmd run build`; `npm.cmd run smoke:copy`; `npm.cmd run smoke:mobile` |
| 8 | TODO | Select next iOS follow-up run | Prioritization | LOW | Select exactly one next follow-up candidate after platform setup. | No next run auto-creation. | active-run overall status check |

## Task 1 Completion Note

| Field | Value |
| --- | --- |
| Task | `1. iOS setup preflight environment/status check` |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Read-only command execution and source inspection only. No dependency install, `@capacitor/ios` install, iOS platform add, Capacitor sync, Xcode, pod install, iOS build/archive/upload, external console change, package edit, native edit, config edit, auth, Supabase, billing, RevenueCat, entitlement, Android release, or production action was executed. |
| Result | Branch is `main`, upstream is `origin/main`, ahead/behind is `0/0`, working tree was clean before documentation edits, Node is `v24.15.0`, npm is `11.12.1`, `@capacitor/core` and `@capacitor/android` are installed at `8.3.3`, `@capacitor/ios` is absent, `capacitor.config.ts` keeps `appId` `com.staronlabs.chartradar`, `appName` `Chart Radar`, and `webDir` `mobile-shell`, and the `ios/` directory is missing. |
| Output document | `docs/ios-testflight-readiness.md` |
| Package/native/config changed? | `No` |
| Next TODO | `2. Confirm @capacitor/ios install need and command` |

## Task 2 Completion Note

| Field | Value |
| --- | --- |
| Task | `2. Confirm @capacitor/ios install need and command` |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | `package.json`, `package-lock.json`, and npm package-tree inspection only. No dependency install, package edit, lockfile edit, iOS platform add, Capacitor sync, Xcode, pod install, iOS build/archive/upload, external console change, auth, Supabase, billing, RevenueCat, entitlement, Android release, or production action was executed. |
| Result | `@capacitor/core`, `@capacitor/android`, and `@capacitor/cli` are aligned at `8.3.3`; `@capacitor/ios` is absent. Because `@capacitor/android` and `@capacitor/cli` are in `devDependencies`, the selected TODO 3 candidate is `npm.cmd install @capacitor/ios@8.3.3 --save-dev`. |
| Output document | `docs/ios-testflight-readiness.md` |
| Package/native/config changed? | `No` |
| Next TODO | `3. Add @capacitor/ios dependency` |

## Task 3 Completion Note

| Field | Value |
| --- | --- |
| Task | `3. Add @capacitor/ios dependency` |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Command executed | `npm.cmd install @capacitor/ios@8.3.3 --save-dev` |
| Result | Added `@capacitor/ios` to `devDependencies` as `^8.3.3` and added the matching `package-lock.json` entry at `8.3.3`. `@capacitor/core`, `@capacitor/android`, and `@capacitor/cli` remain at `8.3.3`; no unrelated dependency upgrade was observed. The `ios/` directory was not created. |
| npm audit note | npm reported an audit summary after install; `npm audit fix` was not run because it is out of scope. |
| Verification | `git diff --check` PASS, `npm.cmd run build` PASS, and final `cmd /c npx tsc --noEmit` PASS after build regenerated missing Next `.next/types` files. |
| Output document | `docs/ios-testflight-readiness.md` |
| Package/native/config changed? | Only `package.json` and `package-lock.json` changed for the allowed dependency add. No native/config changes. |
| Next TODO | `4. Confirm iOS platform generation prerequisites` |

## Task 4 Completion Note

| Field | Value |
| --- | --- |
| Task | `4. Confirm iOS platform generation prerequisites` |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Read-only precondition checks and documentation only. No `npx cap add ios`, Capacitor sync, Xcode, pod install, iOS build/archive/upload, npm install/update/audit fix, package edit, native file generation, config edit, external console change, auth, Supabase, billing, RevenueCat, entitlement, Android release, or production action was executed. |
| Result | `mobile-shell` exists with `index.html`, `ios/` is still missing, Capacitor config remains `appId` `com.staronlabs.chartradar`, `appName` `Chart Radar`, and `webDir` `mobile-shell`, and `@capacitor/core`, `@capacitor/android`, `@capacitor/cli`, and `@capacitor/ios` are aligned at `8.3.3`. Next command candidate is `npx cap add ios` with guardrails to avoid sync, Xcode, pod install, build/archive/upload, native edits, signing, console changes, and high-risk auth/billing/Supabase/RevenueCat/Android changes. |
| Output document | `docs/ios-testflight-readiness.md` |
| Package/native/config changed? | `No` |
| Next TODO | `5. Generate iOS platform` |

## Task 5 Completion Note

| Field | Value |
| --- | --- |
| Task | `5. Generate iOS platform` |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Command executed | `npx cap add ios` |
| Result | Capacitor created the native `ios/` project, copied `mobile-shell` assets into the generated iOS public directory, created generated Capacitor config files, and wrote Swift Package Manager plugin setup in `ios/App/CapApp-SPM/Package.swift`. |
| Generated scope | New `ios/` native project files only, plus documentation updates. `package.json`, `package-lock.json`, `capacitor.config.ts`, Android files, app/source files, auth/Supabase/billing/RevenueCat/entitlement files were not changed by this task. |
| Not generated / not executed | No top-level `App.xcworkspace`, no `Podfile`, and no `.entitlements` file were generated. No `npx cap sync ios`, Xcode, manual `pod install`, `xcodebuild`, fastlane, archive, upload, or external console commands were run. |
| Output document | `docs/ios-testflight-readiness.md` |
| Next TODO | `6. Audit generated iOS platform config` |

## Task 6 Completion Note

| Field | Value |
| --- | --- |
| Task | `6. Audit generated iOS platform config` |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Source inspection and documentation only. No native file edit, `Info.plist` edit, project file edit, entitlements file creation, signing change, `npx cap sync ios`, `npx cap open ios`, Xcode, pod install, iOS build/archive/upload, npm install/update/audit fix, external console change, auth, Supabase, billing, RevenueCat, entitlement, Android release, or production action was executed. |
| Result | Documented generated iOS project structure, Bundle ID `com.staronlabs.chartradar`, display name `Chart Radar`, deployment target `15.0`, SPM plugin setup, ignored generated files, missing entitlements/capabilities, and build/upload blockers. |
| Output document | `docs/ios-testflight-readiness.md` |
| Native/config/package changed? | `No`; generated native files were inspected only. |
| Next TODO | `7. Safe validation and result documentation` |

## Task 7 Completion Note

| Field | Value |
| --- | --- |
| Task | `7. Safe validation and result documentation` |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Safe validation commands and documentation only. No native iOS file edit, `Info.plist` edit, project file edit, entitlements file creation, signing change, `npx cap sync ios`, `npx cap open ios`, Xcode, pod install, iOS build/archive/upload, npm install/update/audit fix, external console change, auth, Supabase, billing, RevenueCat, entitlement, Android release, or production action was executed. |
| Result | `git diff --check`, `cmd /c npx tsc --noEmit`, `npm.cmd run build`, `npm.cmd run smoke:copy`, and `npm.cmd run smoke:mobile` passed. Capacitor packages are aligned at `8.3.3`; ignored generated iOS outputs remain untracked/unstaged; protected paths were not changed. |
| Output document | `docs/ios-testflight-readiness.md` |
| Native/config/package changed in Task 7? | `No` |
| Remaining blockers | Missing `.entitlements`, signing/Team ID, Apple Developer/App Store Connect setup, Sign in with Apple risk, RevenueCat/App Store product mapping, APNs/Firebase iOS push, and TestFlight upload. |
| Next TODO | `8. Select next iOS follow-up run` |

## Expected Command Boundaries

Allowed only in the specific TODOs that name them:

- `npm.cmd ls @capacitor/core @capacitor/android @capacitor/ios`
- package inspection commands
- `npm.cmd install @capacitor/ios@<matching-version> --save-dev`
- `npx cap add ios`

Always forbidden in this run:

- `npm.cmd run app:sync`
- `npm.cmd run app:sync:prod`
- `npm.cmd run app:add:android`
- `npm.cmd run app:android`
- `npm.cmd run app:android:debug`
- `npm.cmd run app:android:release`
- `npx cap sync ios`
- `npx cap open ios`
- `xcodebuild`
- `fastlane`
- `pod install`
- archive/upload/submission commands
- Apple Developer/App Store Connect/RevenueCat/Supabase/Play Console mutations

## Next Follow-Up Candidate Set

Task 8 must pick exactly one:

- `ios-auth-apple-signin-risk-run`
- `ios-revenuecat-product-mapping-run`
- `ios-push-apns-firebase-readiness-run`
- `ios-xcode-signing-readiness-run`
- `ios-testflight-build-run`

## Verification Policy

- Always run `git diff --check`.
- Confirm changed files stay within the allowed scope for the active TODO.
- Confirm Android native/release settings are unchanged.
- Confirm auth/Supabase/billing/RevenueCat/entitlement/product/price/session/account deletion/logout/push sending code is unchanged.
- For dependency/platform generation tasks, run `cmd /c npx tsc --noEmit` and `npm.cmd run build` when specified.
- For final validation, run `npm.cmd run smoke:copy`.
- Run sensitive-value pattern checks before commit.

## Commit And Push Policy

- Setup commit message: `Define iOS Capacitor platform setup run`.
- Because this is a higher-risk run, prefer small commits per TODO.
- Docs-only setup may be committed and pushed to `main` when verification passes and the branch is in sync with `origin/main`.
- For `@capacitor/ios` install and `ios/` native generation TODOs, report file scope clearly before push.
- Do not release, deploy, submit App Store Connect changes, submit Play Console changes, alter production configuration, or run production-mutating operations during this run.

## Completion Report Format

- New active-run name.
- Registered task list.
- Changes actually allowed in this run.
- High-risk areas forbidden in this run.
- Verification results.
- Commit hash.
- Push status.
- Final git status.
