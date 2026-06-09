# Active Automation Run

## Run Title

- `settings-support-links-polish-run`

## Run State

- Status: `TODO`
- Setup date: 2026-06-09
- Previous run context:
  - `settings-account-polish-run` is `DONE`.
  - `settings-account-polish-run` selected `settings-support-links-polish-run` as the first implementation candidate.
  - `android-production-auto-smoke-run` is `DONE` and recorded as `PASS`.
  - `alert-quality-operations-run` is `DONE`.
  - `alert-pro-rule-ui-clarity-run` is `DONE`.
- Current phase: Task 3 completed; next TODO is `4. Documentation update`.
- Execution mode: `AUTO RUN ACTIVE PLAN` processes exactly one `TODO` task per turn.
- This setup registers the run only. No app UI implementation, auth, session, logout, account deletion, Supabase, billing, RevenueCat, entitlement, production DB, purchase, restore, Android release, Play Console, or external console action was executed during setup.

## Purpose

- Improve production-app trust by making support, FAQ, terms, privacy policy, refund guidance, alert settings, account deletion guidance, and app version easier to find from settings/menu/header settings surfaces.
- Keep the implementation low-risk and limited to UI links, labels, copy, and app-info display.
- Preserve auth/session, billing, RevenueCat, entitlement, Supabase, account deletion, logout/session, and production data behavior.

## Background

- The previous `settings-account-polish-run` audited settings/account surfaces and selected this run as the safest first implementation candidate.
- Selection rationale:
  - Directly improves user trust and production readiness.
  - Covers expected Android production app access paths for support, policies, refunds, and app information.
  - Can be implemented without touching protected auth, billing, Supabase, RevenueCat, entitlement, account deletion, or logout/session logic.
- This run is intentionally narrower than a full settings redesign.

## Risk To Resolve In This Run

- Users may have to hunt across `/settings`, `/menu`, header settings, `/account`, and footer surfaces for support and policy links.
- Refund/subscription guidance, FAQ, privacy, terms, account deletion guidance, alert settings, and app version may not be discoverable enough for a production Android app.
- Settings surfaces may feel less trustworthy if support, policy, and app-info paths are missing or uneven.

## Explicitly Out Of Scope

- Auth/session logic, login state, logout/session clearing, or real logout tests.
- Account deletion logic, deletion API, deletion confirmation behavior, or real deletion tests.
- Billing, RevenueCat, product ID, plan ID, entitlement, price, subscription restore, purchase, or payment behavior.
- Supabase, RLS, production DB, account data, or production configuration changes.
- Android native/release settings, Play Console, external console work, or store-listing metadata changes.
- New subscription restore/management features.
- Inventing business/developer information that is not already present in the app or documents.

## High-Risk Guardrails

- Do not modify auth, session, logout, account deletion, Supabase, RLS, billing, RevenueCat, entitlement, Android release, Play Console, or production configuration.
- Do not query or mutate production DB records.
- Do not execute real login, logout, account deletion, purchase, restore, production account, or external-console operations.
- Do not change product IDs, plan IDs, entitlement names, prices, subscription policy, or account deletion behavior.
- If business/developer information is uncertain, document it as needing confirmation instead of inventing values.

## Scope

- Settings/menu/header settings panel UI/link/copy files, only when the active TODO explicitly allows implementation.
- Existing route links only, such as FAQ, support/contact, privacy, terms, refund/subscription guidance, alert settings, account deletion guidance, and app information.
- Existing app version source or existing constant only; do not create a new versioning policy in this run.
- Primary planning file:
  - `docs/automation-runs/active-run.md`
- Companion planning document:
  - `docs/settings-account-polish.md`

## Reference Documents

- `docs/settings-account-polish.md`
- `docs/qa/android-production-qa-results.md`
- `docs/android-production-qa-execution.md`
- `docs/alert-quality-operations.md`

## Start Conditions

- Confirm `settings-account-polish-run` is `DONE`.
- Confirm `settings-account-polish-run` selected `settings-support-links-polish-run`.
- Confirm `git status --short --branch`.
- Confirm `git rev-list --left-right --count HEAD...origin/main`.
- If local and `origin/main` diverge, stop before editing and report.
- If the worktree is dirty, identify existing changes before editing.
- Process exactly one `TODO` item per turn.

## Stop Conditions

- The task requires auth, session, logout, account deletion, Supabase, RLS, billing, RevenueCat, entitlement, Android release, Play Console, production config, or production data changes.
- The task requires real login, logout, account deletion, purchase, restore, production DB/account access, or external-console actions.
- The task expands from low-risk UI/link/copy polish into account, billing, subscription restore, deletion, or session behavior changes.
- Sensitive values appear in docs, logs, command output, or diffs.

## Task List

| Order | Status | Task | Area | Risk | Goal | Forbidden | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | DONE | Reconfirm settings/menu link locations | Source Inspection | LOW | Reconfirmed support/policy/alert/app-info link locations in `/settings`, `/menu`, header settings panel, `/account`, and footer. | No code edits. | `git diff --check` |
| 2 | DONE | Support and policy link proposal | UX Spec | LOW | Documented the smallest link/accessibility improvements for FAQ, support, privacy, terms, refund/subscription guide, alert settings, account deletion guide, and app version. | No implementation. | `git diff --check` |
| 3 | DONE | Minimal support/policy link implementation | UI/Link/Copy | LOW | Improved `/menu` and `AppFooter` support, policy, alert settings, account deletion guide, and app info access. | No auth/session, billing, RevenueCat, entitlement, Supabase, account deletion, logout/session, purchase, restore, or production DB edits. | `git diff --check`; `cmd /c npx tsc --noEmit` |
| 4 | TODO | Documentation update | Documentation | LOW | Record the implementation result and remaining risks in `docs/settings-account-polish.md`. | No feature expansion. | `git diff --check` |
| 5 | TODO | Safe validation execution | Verification | LOW | Confirm the final change remains UI/link/copy/docs only and run safe checks. | No `smoke:billing`, `smoke:api`, real purchase, restore, account deletion, login, or logout tests. | `git diff --check`; `cmd /c npx tsc --noEmit`; `npm.cmd run build`; `npm.cmd run smoke:copy`; optional `npm.cmd run smoke:mobile` |

## Implementation Boundaries

- Task 1 and Task 2 are inspection/spec tasks and must not change app/UI code.
- Task 3 may change only settings/menu/header support-link UI, labels, copy, and app-info presentation.
- Task 4 updates docs only.
- Task 5 runs safe validation and records results.
- No task may alter account, auth, billing, entitlement, Supabase, deletion, logout/session, or production behavior.

## Task 1 Completion Note

| Field | Value |
| --- | --- |
| Task | `1. Reconfirm settings/menu link locations` |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Source inspection and documentation only. |
| Result | Reconfirmed current support, FAQ, terms, privacy, refund, alert settings, account deletion guide, and app-version locations across `/settings`, `/menu`, header settings panel, `/account`, `AppFooter`, and related policy/support pages. |
| Code changed? | `No` |
| Next TODO | `2. Support and policy link proposal` |

## Task 2 Completion Note

| Field | Value |
| --- | --- |
| Task | `2. Support and policy link proposal` |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Improvement proposal and implementation-boundary documentation only. |
| Result | Proposed TODO 3 as a low-risk `/menu` and `AppFooter` centered link/display polish using existing routes, existing support email context, and `APP_VERSION_DISPLAY`, while leaving header settings panel light and avoiding `/account`, auth, billing, Supabase, entitlement, deletion, logout, production DB, Android release, and Play Console changes. |
| Code changed? | `No` |
| Next TODO | `3. Minimal support/policy link implementation` |

## Task 3 Completion Note

| Field | Value |
| --- | --- |
| Task | `3. Minimal support/policy link implementation` |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Low-risk UI/link/copy implementation only. |
| Result | `/menu` now exposes alert settings, direct support contact, account deletion guidance, and app version using existing routes, existing `staronlabs@gmail.com`, and `APP_VERSION_DISPLAY`. `AppFooter` now exposes FAQ, support contact, and app version while preserving existing terms, privacy, account deletion, and refund links. |
| Code changed? | `Yes - UI/link/copy only` |
| Protected logic changed? | `No` |
| Next TODO | `4. Documentation update` |

## Verification Policy

- Always run `git diff --check`.
- Confirm changed files are limited to settings/menu/header UI/link/copy files and docs once implementation starts.
- Confirm protected areas remain unchanged:
  - auth/session, logout, account deletion, Supabase/RLS, billing, RevenueCat, entitlement, Android release, Play Console, production DB, package scripts.
- For implementation and final validation, run `cmd /c npx tsc --noEmit`.
- For final validation, run `npm.cmd run build` and `npm.cmd run smoke:copy`; run `npm.cmd run smoke:mobile` only if the change needs mobile static readiness coverage.
- Run sensitive-value pattern checks before commit.

## Commit And Push Policy

- Setup commit message: `Polish settings support and policy links`.
- Setup may be committed and pushed to `main` when verification passes and the branch is in sync with `origin/main`.
- Future implementation TODOs can use the same commit message only if the final change remains safe and the representative asks to commit that TODO.
- Do not release, deploy, submit Play Console changes, alter production configuration, or run production-mutating operations during this run.

## Completion Report Format

- New active-run name.
- Registered task list.
- Risk this run will resolve.
- High-risk areas excluded from this run.
- Verification results.
- Commit hash.
- Push status.
- Final git status.
