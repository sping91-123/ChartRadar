# Active Automation Run

## Run Title

- `ios-testflight-readiness-run`

## Run State

- Status: `TODO`
- Setup date: 2026-06-09
- Previous run context:
  - `android-production-auto-smoke-run` is `DONE` and recorded as `PASS`.
  - `alert-quality-operations-run` is `DONE`.
  - `alert-pro-rule-ui-clarity-run` is `DONE`.
  - `settings-account-polish-run` is `DONE`.
  - `settings-support-links-polish-run` is `DONE`.
- Current phase: Task 1 complete; next TODO is `2. Apple Developer submission requirement review`.
- Execution mode: `AUTO RUN ACTIVE PLAN` processes exactly one `TODO` task per turn.
- This setup registers the run only. No iOS platform add, iOS build, upload, App Store Connect change, Apple Developer change, RevenueCat change, auth change, Supabase change, billing change, Android release change, or production data action was executed during setup.

## Purpose

- Audit ChartRadar readiness for a future iOS TestFlight build.
- Prepare before building or uploading iOS artifacts; this is not an iOS production submission run.
- Identify required settings, risks, and missing checklist items for Capacitor iOS, Apple Developer/App Store Connect, Sign in with Apple, RevenueCat product mapping, and first TestFlight build preparation.
- Select one follow-up run candidate after the audit is complete.

## Background

- Android launch stabilization and follow-up operations are complete:
  - automatic Android production smoke checks passed
  - alert operations audit completed
  - Pro alert UI clarity completed
  - settings/account audit completed
  - settings support/policy link polish completed
- The next priority is iOS TestFlight readiness, not iOS production release.

## Explicitly Out Of Scope

- Adding the Capacitor iOS platform.
- Running an iOS native build, archive, signing, upload, or TestFlight submission.
- Modifying iOS native files, Android native/release files, Capacitor release settings, package scripts, or build configuration.
- Changing Apple Developer, App Store Connect, RevenueCat, Supabase, billing, entitlement, product IDs, plan IDs, pricing, auth, or production settings.
- Implementing Sign in with Apple.
- Creating App Store subscription products or RevenueCat offerings/packages/products.
- Querying or mutating production DB records.

## High-Risk Guardrails

- Do not run `npx cap add ios`, `npx cap sync ios`, Xcode build/archive/upload, Transporter upload, or App Store Connect submission commands during this run.
- Do not access or change external Apple Developer, App Store Connect, RevenueCat, Supabase, or Play Console settings.
- Do not modify auth, Supabase, billing, RevenueCat, entitlement, Android release, iOS native, package scripts, or production configuration.
- For Sign in with Apple policy risk, verify current Apple guidance from official sources during the relevant TODO before drawing a final conclusion.
- If any task requires implementation or external console work, stop and recommend a separate follow-up run.

## Scope

- Primary planning file:
  - `docs/automation-runs/active-run.md`
- Companion readiness document:
  - `docs/ios-testflight-readiness.md`
- Optional later checklist if needed:
  - `docs/qa/ios-testflight-checklist.md`

## Reference Documents

- `docs/ios-testflight-readiness.md`
- `docs/app-store-release.md`
- `docs/qa/android-production-qa-results.md`
- `docs/android-production-qa-execution.md`
- `docs/settings-account-polish.md`
- `docs/alert-quality-operations.md`

## Start Conditions

- Confirm Android/alert/settings stabilization runs listed in the background are `DONE`.
- Confirm `git status --short --branch`.
- Confirm `git rev-list --left-right --count HEAD...origin/main`.
- If local and `origin/main` diverge, stop before editing and report.
- If the worktree is dirty, identify existing changes before editing.
- Process exactly one `TODO` item per turn.

## Stop Conditions

- The task requires iOS platform add, sync, build, archive, signing, upload, App Store Connect submission, or Apple Developer/App Store Connect/RevenueCat console change.
- The task requires auth, Supabase, billing, RevenueCat, entitlement, product ID, plan ID, price, Android release, iOS native, package script, or production config changes.
- The task expands from readiness audit into implementation.
- Sensitive values appear in docs, logs, command output, or diffs.

## Task List

| Order | Status | Task | Area | Risk | Goal | Forbidden | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | DONE | Capacitor iOS readiness audit | Capacitor/iOS | MEDIUM | Checked iOS platform status, Capacitor config, app name, appId, bundle identifier candidates, iOS build scripts, and missing native iOS setup. | No iOS platform add. No iOS release setting edits. No Android setting edits. | `git diff --check` |
| 2 | TODO | Apple Developer submission requirement review | Store Requirements | MEDIUM | Document TestFlight-prep requirements for account/app metadata, privacy, support URL, screenshots, description, keywords, category, and marketing URL need. | No external console registration or edits. | `git diff --check` |
| 3 | TODO | Sign in with Apple requirement risk review | Auth Policy | HIGH | Assess whether current Google login structure may require Sign in with Apple for iOS review and document Supabase/UI/auth implications. | No auth code edits. No Supabase edits. No Apple login implementation. | `git diff --check` |
| 4 | TODO | RevenueCat Apple product mapping review | Monetization Mapping | HIGH | Document iOS subscription product, subscription group, RevenueCat offering/package/product, entitlement, price, and naming mapping needs. | No RevenueCat edits. No App Store Connect product creation. No productId, entitlement, price, or billing code edits. | `git diff --check` |
| 5 | TODO | TestFlight first-build checklist | Build Readiness | MEDIUM | Create the pre-build checklist for Xcode, signing, certificates, provisioning, Capacitor sync, build command candidates, upload checks, privacy, account deletion, contact, and support URLs. | No iOS build/upload. No submission. No production setting changes. | `git diff --check` |
| 6 | TODO | Select first iOS readiness follow-up run | Prioritization | LOW | Select exactly one follow-up run candidate after readiness audit. | No follow-up run auto-creation. No code edits. | `git diff --check` |

## Task 1 Completion Note

| Field | Value |
| --- | --- |
| Task | `1. Capacitor iOS readiness audit` |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Source inspection and documentation only. No iOS platform add, sync, build, open, upload, pod install, Xcode, App Store Connect, Apple Developer, RevenueCat, auth, Supabase, billing, Android, package script, or production action was executed. |
| Result | Capacitor common config exists with `appId` and `appName`, but the native iOS platform is absent and no iOS scripts or native project files were found. |
| Output document | `docs/ios-testflight-readiness.md` |
| Code/native/config changed? | `No` |
| Next TODO | `2. Apple Developer submission requirement review` |

## Follow-Up Candidate Selection Method

Task 6 must select exactly one follow-up candidate using these criteria:

- Highest blocker risk for first TestFlight build.
- Whether the task is required before any iOS build can be created.
- Whether it affects auth review, subscription review, signing, or native platform setup.
- Whether it can be completed without changing unrelated Android production behavior.
- Verification clarity and ability to keep one commit/run scope.

Candidate examples are not pre-approved implementation scope:

- `ios-capacitor-platform-setup-run`
- `ios-auth-apple-signin-risk-run`
- `ios-revenuecat-product-mapping-run`
- `ios-store-listing-assets-run`
- `ios-testflight-build-run`

## Verification Policy

- Always run `git diff --check`.
- Confirm changed files remain inside `docs/` during this readiness audit run.
- Confirm `package.json`, `scripts/`, app/UI code, Auth/Supabase, billing, RevenueCat, Android native/release files, iOS native files, and production config are unchanged.
- Run sensitive-value pattern checks before commit.

## Commit And Push Policy

- Setup commit message: `Define iOS TestFlight readiness run`.
- Docs-only setup may be committed and pushed to `main` when verification passes and the branch is in sync with `origin/main`.
- Do not release, deploy, submit App Store Connect changes, submit Play Console changes, alter production configuration, or run production-mutating operations during this run.

## Completion Report Format

- New active-run name.
- Registered task list.
- Whether Android/alert/settings stabilization completion is reflected.
- iOS TestFlight readiness scope.
- Whether high-risk forbidden scope is reflected.
- Verification results.
- Commit hash.
- Push status.
- Final git status.
