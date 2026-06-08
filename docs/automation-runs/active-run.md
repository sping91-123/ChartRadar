# Active Automation Run

## Run Title

- `android-production-qa-execution-run`

## Run State

- Status: `ACTIVE`
- Setup date: 2026-06-09
- Previous run prerequisite: `android-production-stability-qa-run` was confirmed `DONE` before this setup.
- Current phase: Tasks 1-2 completed; Task 3 is the next `TODO`.
- Execution mode: `AUTO RUN ACTIVE PLAN` processes exactly one `TODO` task per turn.
- This setup registers the run and does not execute production QA, payment, restore, account deletion, or push-delivery checks.

## Purpose

- Move the documented Android production QA checklist into an executable smoke and QA flow.
- Reuse existing browser smoke, mobile-adjacent smoke, and npm smoke commands where they are safe and non-mutating.
- Separate Google Play production install, login, billing, notification permission, and Play Console health checks into manual QA tables.
- Keep implementation fixes out of this run. Any failure should be documented first and moved into a separate bug-fix run.

## Background

- The completed `android-production-stability-qa-run` documented Android production QA scope, core screen smoke scenarios, login/account/settings QA, billing/subscription QA, notification QA, and first execution candidates.
- That completed run recommended `android-production-qa-execution-run` as the next active run.
- This run prepares and records the actual execution sequence while preserving release, billing, auth, Supabase, FCM, and Android guardrails.

## High-Risk Guardrails

- Do not modify app code.
- Do not modify smoke scripts unless a separate approved implementation task is opened.
- Do not edit auth, Google sign-in, Supabase, sessions, account deletion, or policy logic.
- Do not edit billing, RevenueCat, Google Play product IDs, base plan IDs, plan IDs, entitlements, prices, checkout, restore, or plan-display logic.
- Do not edit FCM, push token handling, push-cron, alert scanner, targetPath handling, cooldown, or notification routing logic.
- Do not edit Android native files, Android release settings, Play Console configuration, app signing, AAB generation, or versioning.
- Do not touch production data, production config, secrets, tokens, keys, or external service settings.
- Do not perform actual purchase, purchase restore, account deletion, production DB mutation, or real push send inside this run.
- Do not add iOS scope.
- Do not add new features.
- Record failures and follow-up candidates instead of fixing them inside this run.

## Scope

- Primary planning file:
  - `docs/automation-runs/active-run.md`
- Execution planning document:
  - `docs/android-production-qa-execution.md`
- Manual QA checklist:
  - `docs/qa/android-production-manual-qa.md`
- Completed source checklist:
  - `docs/android-production-stability-qa.md`

## QA Coverage Lanes

Automatic or script-supported lane:

- Existing npm smoke command audit.
- Existing route reachability smoke where it only checks local HTTP responses and expected guard responses.
- Existing static mobile/PWA/Android asset smoke.
- Existing static billing, copy, launch, ops, API, and CSS smoke only when the command is non-mutating and its service assumptions are explicit.
- Documentation safety checks: `git diff --check`, docs-only diff confirmation, and sensitive-value pattern checks.

Manual QA lane:

- Google Play production install and first launch.
- Android navigation, back behavior, refresh, force-close, and relaunch.
- Google login, account picker, cancel path, successful login, session persistence, and logout with a dedicated QA account.
- `/pro` pre-checkout review before entering any paid flow.
- Notification permission and settings review without real push send or token exposure.
- Play Console crash, ANR, vitals, and warnings as read-only review only.

Separate approval lane:

- Actual Google Play purchase.
- Purchase restore.
- Actual account deletion.
- Real push delivery or push-click validation.
- Production DB, push token, Supabase, FCM, RevenueCat, Google Play Console, Android release, or production configuration changes.

## Start Conditions

- Confirm `git status --short --branch`.
- Confirm `git rev-list --left-right --count HEAD...origin/main`.
- If local and `origin/main` diverge, stop before editing and report.
- If the worktree is dirty, identify existing changes before editing.
- For `AUTO RUN ACTIVE PLAN`, process exactly one `TODO` item per turn.
- Confirm each command candidate does not violate the forbidden scope before running it.

## Stop Conditions

- A task requires app code changes, production data changes, deploys, release submissions, Play Console changes, or external service settings changes.
- A task requires modifying billing, auth, Supabase, FCM, Android release, or production configuration.
- A smoke command would perform production mutation, actual payment, restore, account deletion, or real push send.
- QA uncovers an implementation issue. Record it as a work-item candidate or follow-up run instead of fixing it here.
- Sensitive values appear in docs, logs, smoke output, or diffs.
- The requested QA scope expands into iOS release work, new feature work, or production operations.

## Task List

| Order | Status | Task | Area | Risk | Goal | Forbidden | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | DONE | Existing smoke command audit | Smoke Audit | LOW | Review `package.json` and `scripts/` smoke commands, then document which commands can be reused for Android production QA. | No app code edits. No smoke script edits. | `git diff --check` |
| 2 | DONE | Mobile viewport smoke scope check | Mobile Smoke Scope | LOW | Check whether 360px core-screen review is already supported and document missing smoke coverage. | No UI code edits. No new smoke script. | Existing smoke command or documentation review, then `git diff --check` |
| 3 | TODO | Production QA execution table | QA Execution Plan | MEDIUM | Write an execution table that separates automatic checks from manual checks. | No billing, auth, FCM code edits. No production data changes. | `git diff --check` |
| 4 | TODO | Safe smoke command execution candidate selection | Smoke Candidate | MEDIUM | Select at least one smoke command that is safe to run in the current repository and confirm it does not hit forbidden scope before execution. | No production purchase. No real push send. No account deletion. No production DB mutation. | Document selection rationale, then `git diff --check` |
| 5 | TODO | Manual QA checklist separation | Manual QA | MEDIUM | Split actual Android-device checks into a manual QA checklist, including Play Store install, navigation/back/relaunch, Google login, `/pro` pre-checkout review, notification permission/settings, and Play Console crash/ANR read-only review. | No real payment. No purchase restore. No real account deletion. No real push send. | `git diff --check` |
| 6 | TODO | QA result recording template | QA Evidence | LOW | Create a template for later QA execution results using `PASS`, `FAIL`, `BLOCKED`, and `NEEDS-RUN`. | No code edits. | `git diff --check` |

## Documentation Policy

- Keep this run focused on QA execution preparation and safe command selection.
- Mark command output as `NEEDS-RUN` unless it has actually been executed in the current task.
- Do not imply 360px browser screenshot coverage exists unless a real screenshot/browser workflow has been confirmed.
- Keep manual QA checklists separate from automatic smoke candidates.
- Keep high-risk checks explicitly read-only or separate-approval.
- Keep ChartRadar framed as judgment support. Do not add buy, sell, long, short, guaranteed return, or investment-advice wording.

## Verification Policy

- Always run `git diff --check`.
- Confirm changed files stay inside `docs/`.
- Run a sensitive-value pattern check before commit.
- Docs-only setup and checklist tasks do not require TypeScript, production build, or smoke execution.
- If a smoke command is selected for a later task, confirm its service target and mutation risk before running it.
- If app code changes appear necessary, stop and report instead of changing code.

## Commit And Push Policy

- Setup commit message: `Define Android production QA execution run`.
- Docs-only setup may be committed and pushed to `main` when verification passes and the branch is in sync with `origin/main`.
- Do not release, deploy, submit Play Console changes, alter production configuration, or run production-mutating operations during this run.

## Task 1 Completion Note

- Completed: 2026-06-09
- Scope: audited `package.json` scripts and `scripts/` smoke-related files by source inspection only.
- Output: `docs/android-production-qa-execution.md` now classifies reusable smoke commands, caution commands, and separate-approval commands for Android production QA.
- No smoke commands were executed.
- No app code, `package.json`, smoke script, billing, auth, Supabase, FCM, Android release, Play Console, or production-data changes were made.

## Task 2 Completion Note

- Completed: 2026-06-09
- Scope: checked current mobile viewport smoke coverage from docs and script/source inspection only.
- Output: `docs/android-production-qa-execution.md` now documents 360px coverage for `/coin`, `/crypto`, `/alts`, `/global`, `/alerts`, `/journal`, `/pro`, and settings/account screens.
- Result: existing smoke commands can support route/static preconditions, but no existing command was confirmed to capture 360px screenshots, inspect DOM overflow, verify bottom navigation/safe-area overlap, or validate Android WebView behavior.
- No smoke commands were executed.
- No app code, UI code, `package.json`, smoke script, billing, auth, Supabase, FCM, Android release, Play Console, or production-data changes were made.

## Completion Report Format

- New active-run name.
- Registered task list.
- Whether automatic smoke, manual QA, and separate approval items are separated.
- Whether high-risk forbidden scope is reflected.
- Verification results.
- Commit hash.
- Push status.
- Final git status.
