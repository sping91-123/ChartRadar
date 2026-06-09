# Active Automation Run

## Run Title

- `settings-account-polish-run`

## Run State

- Status: `TODO`
- Setup date: 2026-06-09
- Previous run context:
  - `android-production-auto-smoke-run` is `DONE` and recorded as `PASS`.
  - `alert-quality-operations-run` is `DONE`.
  - `alert-pro-rule-ui-clarity-run` is `DONE`.
- Current phase: run registered; next TODO is `1. Current settings/account screen audit`.
- Execution mode: `AUTO RUN ACTIVE PLAN` processes exactly one `TODO` task per turn.
- This setup registers the run only. No app code, UI code, auth, Supabase, billing, RevenueCat, entitlement, account deletion, production DB, purchase, restore, or logout action was executed during setup.

## Purpose

- Improve trust in the settings/account area for a production app.
- Ensure users can clearly find account state, current plan, alerts, support, terms, privacy policy, account deletion, logout, and app version.
- Start with audit and design only; split actual implementation into a later run.
- Treat auth/session, current plan display, logout, account deletion, Supabase, billing, and RevenueCat as protected or high-risk adjacent surfaces.

## Background

- Android production auto smoke is complete and recorded as `PASS`.
- Alert operations audit is complete.
- Alert Pro rule UI clarity is complete; Basic or wrong-market Pro users should no longer see Pro alert rules as enabled/deliverable.
- The next priority is the settings/account screen because it directly affects user trust, support, refunds, account deletion, privacy, and terms accessibility.

## Target User Trust Outcomes

- Users can identify which account they are using.
- Users can see whether they are Basic or Pro without needing to infer it from another screen.
- Users can reach alert settings, support, terms, privacy policy, and account deletion without hunting.
- Logout and account deletion are visually and semantically separated from normal settings.
- App version and business/developer information access are discoverable enough for production support.

## Explicitly Out Of Scope

- Auth/session logic changes.
- Supabase, RLS, production DB, or account data changes.
- Account deletion behavior, deletion API, or real deletion tests.
- Logout behavior changes or real logout tests unless a future task explicitly scopes a manual check.
- Billing, RevenueCat, product ID, plan ID, entitlement, price, purchase, or restore changes.
- Android native/release settings, Play Console changes, external console access, or production configuration changes.
- New product features beyond documenting a minimal first implementation candidate.

## High-Risk Guardrails

- Do not modify auth, Supabase, RLS, billing, RevenueCat, entitlement, account deletion, logout/session, Android release, Play Console, or production configuration in this run setup.
- Do not query or mutate production DB records.
- Do not execute real account deletion, real logout, purchase, restore, or production account operations.
- Do not change plan IDs, product IDs, entitlement names, prices, or subscription policy.
- If a future implementation candidate requires protected logic changes, stop and recommend a separate high-risk run.

## Scope

- Primary planning file:
  - `docs/automation-runs/active-run.md`
- Companion planning document:
  - `docs/settings-account-polish.md`

## Reference Documents

- `docs/qa/android-production-qa-results.md`
- `docs/android-production-qa-execution.md`
- `docs/alert-quality-operations.md`
- `docs/qa/android-production-manual-qa.md`

## Start Conditions

- Confirm `android-production-auto-smoke-run` is `DONE/PASS`.
- Confirm `alert-quality-operations-run` is `DONE`.
- Confirm `alert-pro-rule-ui-clarity-run` is `DONE`.
- Confirm `git status --short --branch`.
- Confirm `git rev-list --left-right --count HEAD...origin/main`.
- If local and `origin/main` diverge, stop before editing and report.
- If the worktree is dirty, identify existing changes before editing.
- Process exactly one `TODO` item per turn.

## Stop Conditions

- The task requires auth, Supabase, RLS, billing, RevenueCat, entitlement, account deletion, logout/session, Android release, Play Console, production config, or production data changes.
- The task requires real account deletion, real logout, purchase, restore, production DB/account access, or external-console changes.
- The task expands from audit/design into implementation before a separate implementation run is opened.
- Sensitive values appear in docs, logs, command output, or diffs.

## Task List

| Order | Status | Task | Area | Risk | Goal | Forbidden | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | TODO | Current settings/account screen audit | Source Inspection | MEDIUM | Identify current settings/account screens, entry paths, and missing production-trust items. | No auth, Supabase, account deletion, billing, or UI code edits. | `git diff --check` |
| 2 | TODO | Required settings item list finalization | Product/Compliance UX | LOW | Confirm required production settings items: account state, plan, alerts, support, privacy, terms, account deletion, logout, app version, and business/developer info access. | No code edits. | `git diff --check` |
| 3 | TODO | Settings screen structure proposal | UX Spec | LOW | Document recommended sections: Account, Subscription/Plan, Alerts, Support, Terms/Policies, App Info, and Dangerous Actions. | No code edits. | `git diff --check` |
| 4 | TODO | Select one first implementation candidate | Prioritization | MEDIUM | Select the safest, highest-trust implementation candidate for a later run. | No simultaneous auth, DB, billing, Supabase, or account deletion changes. | `git diff --check` |

## First Implementation Candidate Selection Method

Task 4 must select exactly one candidate using these criteria:

- User trust impact for a production app.
- Whether the change can stay UI/copy/accessibility-only.
- Whether protected auth, Supabase, billing, RevenueCat, entitlement, logout, or account deletion logic can remain untouched.
- Verification clarity with static checks and, later, mobile UI smoke where relevant.
- Smallest useful change that can be reverted cleanly.

Candidate examples are not pre-approved implementation scope. They include:

- Current plan/account state display improvement.
- Support, terms, privacy, or business/developer information accessibility improvement.
- App version display.
- Separate visual grouping for logout and account deletion.

## Task Execution Rules

- `AUTO NEXT` handles only the next `TODO` item.
- All four tasks in this run are audit/design/prioritization tasks.
- No app/UI code changes are allowed in this run.
- Actual implementation must be opened as a separate run after Task 4 selects one candidate.
- Findings should be documented before any implementation decision.

## Verification Policy

- Always run `git diff --check`.
- Confirm changed files remain inside `docs/`.
- Confirm `package.json`, `scripts/`, app/UI code, auth code, Supabase, billing, RevenueCat, entitlement, account deletion, Android release, and production config are unchanged.
- Run sensitive-value pattern checks before commit.

## Commit And Push Policy

- Setup commit message: `Define settings account polish run`.
- Docs-only setup may be committed and pushed to `main` when verification passes and the branch is in sync with `origin/main`.
- Do not release, deploy, submit Play Console changes, alter production configuration, or run production-mutating operations during this run.

## Completion Report Format

- New active-run name.
- Registered task list.
- Whether Android and alert stabilization completion is reflected.
- First implementation candidate selection method.
- Whether high-risk items are separated.
- Verification results.
- Commit hash.
- Push status.
- Final git status.
