# Active Automation Run

## Run Title

- `ios-first-local-build-readiness-run`

## Run State

- Status: `TODO`
- Setup date: 2026-06-10
- Previous run context:
  - `ios-xcode-signing-readiness-run` is `DONE`.
  - `ios-xcode-signing-readiness-run` selected `ios-first-local-build-readiness-run` as the next follow-up candidate.
- Current phase: TODO 3 complete; next TODO is `4. Safe local build command candidate selection`.
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
| 4 | TODO | Safe local build command candidate selection | Command Plan | HIGH | Document the exact local build command candidate and the conditions that must be true before it can run. | Do not execute command. No archive/upload. | `git diff --check` |
| 5 | TODO | Local build execution decision | Gate Decision | HIGH | Decide whether to run a local build or close as `BLOCKED` based on preconditions. | No TestFlight upload. No archive. No signing changes. | decision documented |
| 6 | TODO | Readiness result documentation | Documentation | LOW | Document readiness result, blockers, and one next-run candidate. | No next run auto-creation. | active-run `DONE` or `BLOCKED` state check |

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
