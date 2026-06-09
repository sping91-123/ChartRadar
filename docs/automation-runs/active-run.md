# Active Automation Run

## Run Title

- `ios-xcode-signing-readiness-run`

## Run State

- Status: `TODO`
- Setup date: 2026-06-10
- Previous run context:
  - `ios-capacitor-platform-setup-run` is `DONE`.
  - `ios-capacitor-platform-setup-run` selected `ios-xcode-signing-readiness-run` as the next follow-up candidate.
- Current phase: run registered; next TODO is `1. Xcode project signing state audit`.
- Execution mode: `AUTO RUN ACTIVE PLAN` processes exactly one `TODO` task per turn.
- This setup registers the run only. No Xcode, xcodebuild, archive, upload, signing change, Apple Developer/App Store Connect change, native file edit, entitlements creation, auth, Supabase, billing, RevenueCat, Android, or production action was executed during setup.

## Purpose

- Audit iOS Xcode signing readiness for ChartRadar TestFlight preparation.
- Confirm source-visible signing, Team ID, Bundle ID/App ID, provisioning, and capability readiness after Capacitor iOS platform generation.
- Produce a checklist and next-run recommendation before any local iOS build/archive/upload attempt.
- Keep this run as source inspection and documentation only.

## Background

- `ios-capacitor-platform-setup-run` completed the first iOS platform setup:
  - `@capacitor/ios@8.3.3` added
  - `ios/` native project generated
  - Bundle ID: `com.staronlabs.chartradar`
  - display name: `Chart Radar`
  - deployment target: `15.0`
  - SPM-based plugin setup confirmed
  - TypeScript, production build, copy smoke, and mobile smoke passed
  - Android/protected path changes were not introduced
- Remaining blockers recorded by the prior run:
  - no `.entitlements` file
  - signing and Team ID are not configured
  - Apple Developer/App Store Connect state is not configured or verified
  - Sign in with Apple risk remains HIGH
  - RevenueCat/App Store product mapping is incomplete
  - APNs/Firebase iOS push readiness is incomplete
  - no TestFlight build/archive/upload has been run
  - ignored generated output policy remains unresolved

## Explicitly Out Of Scope

- Opening Xcode.
- Running `xcodebuild`, archive, upload, Transporter, or TestFlight submission.
- Editing `ios/App/App.xcodeproj/project.pbxproj`.
- Editing `ios/App/App/Info.plist`.
- Creating or editing `.entitlements` files.
- Setting `DEVELOPMENT_TEAM`, signing style, provisioning profile, certificate, or capability values.
- Apple Developer/App Store Connect console changes, Bundle ID/App ID creation, certificate/provisioning creation, or capability toggles.
- Auth/Supabase/billing/RevenueCat/entitlement changes.
- Android native/release changes.
- Production DB or production configuration changes.

## High-Risk Guardrails

- Treat `project.pbxproj`, `Info.plist`, `.entitlements`, and signing files as read-only for this run.
- Treat Apple Developer and App Store Connect as read-only conceptual checklist items; do not change external console state.
- Do not create persistent Apple identifiers, certificates, provisioning profiles, or App Store Connect records.
- Do not turn on capabilities in Xcode or Apple Developer.
- If signing readiness requires actual Xcode or console action, document it and select a later run.
- If sensitive team/account/certificate identifiers are encountered, do not copy secrets or private keys into docs.

## Scope

- Primary planning file:
  - `docs/automation-runs/active-run.md`
- Companion signing readiness document:
  - `docs/ios-xcode-signing-readiness.md`
- Cross-reference documents:
  - `docs/ios-testflight-readiness.md`
  - `docs/qa/ios-testflight-checklist.md`

## Start Conditions

- Confirm `ios-capacitor-platform-setup-run` is `DONE`.
- Confirm current branch and working tree.
- Confirm local branch is not diverged from upstream.
- Process exactly one `TODO` item per turn.
- Before each TODO, confirm the task is source inspection/documentation only.

## Stop Conditions

- The task requires Xcode, xcodebuild, archive, upload, Apple Developer/App Store Connect mutation, signing mutation, provisioning mutation, capability mutation, native project edit, entitlements creation, auth/Supabase/billing/RevenueCat/entitlement edit, Android edit, or production DB/config access.
- The task expands from readiness audit into implementation.
- Sensitive values appear in docs, logs, command output, or diffs.

## Task List

| Order | Status | Task | Area | Risk | Goal | Forbidden | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | TODO | Xcode project signing state audit | Xcode Project | HIGH | Inspect source-visible signing, Team ID, Bundle ID, code-sign style, and provisioning settings in generated iOS project files. | No `project.pbxproj` edits. No Xcode. No signing changes. | `git diff --check` |
| 2 | TODO | Apple Developer readiness checklist | Apple Developer | HIGH | Document required Team ID, Bundle ID/App ID, membership, certificate, and provisioning items. | No Apple Developer console changes. No Bundle ID creation. | `git diff --check` |
| 3 | TODO | Capability requirements checklist | Capabilities | HIGH | Document likely iOS capabilities: Sign in with Apple, Push Notifications, In-App Purchase, and Associated Domains need. | No entitlements creation. No capability changes. No console changes. | `git diff --check` |
| 4 | TODO | Signing and build blocker checklist | Build Readiness | MEDIUM | Document likely blockers before first Xcode build/archive: macOS/Xcode, Team, Bundle ID, provisioning, certificate, capability mismatch, and SPM resolution. | No `xcodebuild`. No archive. | `git diff --check` |
| 5 | TODO | Select next signing follow-up run | Prioritization | LOW | Select exactly one follow-up run after signing readiness audit. | No next run auto-creation. No code/native/console changes. | active-run overall status check |

## Candidate Follow-Up Runs

Task 5 must select exactly one:

- `ios-auth-apple-signin-risk-run`
- `ios-revenuecat-product-mapping-run`
- `ios-push-apns-firebase-readiness-run`
- `ios-first-local-build-readiness-run`
- `ios-generated-output-policy-run`

## Verification Policy

- Always run `git diff --check`.
- Confirm changed files remain inside `docs/`.
- Confirm no iOS native files were modified after source inspection:
  - `ios/App/App.xcodeproj/project.pbxproj`
  - `ios/App/App/Info.plist`
  - `.entitlements` files
- Confirm `package.json`, `package-lock.json`, `capacitor.config.ts`, Android native/release files, auth/Supabase/billing/RevenueCat/entitlement code, and production config are unchanged.
- Run sensitive-value pattern checks before commit.

## Commit And Push Policy

- Setup commit message: `Define iOS Xcode signing readiness run`.
- Docs-only setup may be committed and pushed to `main` when verification passes and the branch is in sync with `origin/main`.
- Do not release, deploy, submit App Store Connect changes, submit Play Console changes, alter production configuration, or run production-mutating operations during this run.

## Completion Report Format

- New active-run name.
- Registered task list.
- Whether iOS platform setup completion is reflected.
- Signing readiness scope.
- Whether high-risk forbidden scope is reflected.
- Verification results.
- Commit hash.
- Push status.
- Final git status.
