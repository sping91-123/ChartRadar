# Active Automation Run

## Run Title

- `alert-pro-rule-ui-clarity-run`

## Run State

- Status: `TODO`
- Setup date: 2026-06-09
- Previous run context: `alert-quality-operations-run` is `DONE`.
- Current phase: Task 3 completed; next TODO is `4. Related documentation update`.
- Execution mode: `AUTO RUN ACTIVE PLAN` processes exactly one `TODO` task per turn.
- This setup registers the run only. No UI implementation, entitlement, billing, RevenueCat, Supabase, push-cron, alert delivery, production DB/token, real push, purchase, restore, targetPath, routing, Android release, or external console action was executed during setup.

## Purpose

- Clarify the alert settings UI so Basic users do not think Pro alert rules are enabled or deliverable.
- Keep this run focused on a small UI/copy improvement for the alert settings surface.
- Preserve existing Basic/Pro entitlement, billing, RevenueCat, Supabase, push-cron, scanner, token sync, FCM delivery, and quota behavior.
- Split any server-side policy, targetPath, quota, or high-risk entitlement work into separate runs.

## Background

- The previous `alert-quality-operations-run` completed all six audit and prioritization tasks.
- Its selected first implementation candidate was: `Basic users should not see Pro alert rules as if they are enabled or deliverable`.
- Confirmed risk: Basic users can see Pro rule toggles in a way that may imply the rule is active, while server-side delivery later blocks non-system Pro rules through entitlement checks.
- User-trust goal: reduce "I configured this but why did no alert arrive?" confusion without changing paid-boundary logic.

## Risk To Resolve In This Run

- Basic UI can make Pro alert rules look configurable or active for Basic users.
- Server-side `ruleAllowed` blocks non-system Pro alerts by entitlement, but the UI may not make that boundary obvious early enough.
- The intended fix is UI/copy clarity only: locked, unavailable, explanatory, or disabled-style treatment for Pro-only rules in Basic state.

## Explicitly Out Of Scope

- Billing, RevenueCat, product IDs, plan IDs, entitlement names, prices, or purchase/restore behavior.
- Supabase, RLS, production DB rows, push tokens, token persistence policy, or token lookup.
- FCM, push-cron, scanner delivery logic, cooldown, dedupe, event generation, ruleAllowed server policy, or actual alert sending.
- targetPath, routing, push-click handling, login returnTo, Android native/release settings, Play Console, or external console changes.
- Alert limit 30/40 versus local Pro 20 quota mismatch.
- System-event entitlement bypass policy.
- Actual Android phone manual QA, real push sends, admin test pushes, real purchases, purchase restores, or account deletion tests.

## High-Risk Guardrails

- Do not modify billing, entitlement, RevenueCat, Supabase, RLS, FCM, push-cron, push scanner, token persistence, targetPath, routing, Android release, Play Console, or production configuration.
- Do not query, print, copy, insert, delete, rotate, or expose raw push tokens.
- Do not query or mutate production DB records.
- Do not execute actual push sends, admin test pushes, purchase tests, restore tests, account deletion, Android native, release, or external-console operations.
- If the implementation requires server-side delivery or paid-policy changes, stop and recommend a separate high-risk run.

## Scope

- Alert settings UI/copy related files, only when the active TODO explicitly allows implementation.
- Possible UI surface based on previous audit:
  - `src/components/RadarAlertCenter.tsx`
  - route wrappers for `/crypto/alert` or `/alerts?market=global` only if needed for display context
- Primary planning file:
  - `docs/automation-runs/active-run.md`
- Companion operations document:
  - `docs/alert-quality-operations.md`

## Reference Documents

- `docs/alert-quality-operations.md`
- `docs/qa/android-production-qa-results.md`
- `docs/android-production-qa-execution.md`
- `docs/qa/android-production-manual-qa.md`

## Start Conditions

- Confirm `alert-quality-operations-run` is `DONE`.
- Confirm `git status --short --branch`.
- Confirm `git rev-list --left-right --count HEAD...origin/main`.
- If local and `origin/main` diverge, stop before editing and report.
- If the worktree is dirty, identify existing changes before editing.
- Process exactly one `TODO` item per turn.
- For code-changing TODOs, verify the intended files are alert settings UI/copy surfaces before editing.

## Stop Conditions

- The task requires billing, entitlement, RevenueCat, Supabase, RLS, FCM, push-cron, scanner, token, targetPath, routing, Android release, Play Console, production config, or production data changes.
- The task requires actual push sending, push-click testing, production DB/token access, purchase, restore, account deletion, or Android native/release execution.
- The task expands from UI/copy clarity into quota, delivery, entitlement, or product-policy changes.
- Sensitive values appear in docs, logs, command output, or diffs.

## Task List

| Order | Status | Task | Area | Risk | Goal | Forbidden | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | DONE | Alert settings UI location audit | Source Inspection | LOW | Identified alert settings screens/components that show Pro rule toggles or Pro limitation guidance. | No code edits. No billing or entitlement edits. | `git diff --check` |
| 2 | DONE | Basic-state Pro rule display proposal | UX Spec | LOW | Documented how Pro-only rules should appear to Basic users so they are not mistaken as enabled/deliverable. | No implementation. | `git diff --check` |
| 3 | DONE | Minimal alert settings UI/copy implementation | UI/Copy | MEDIUM | Added clear limitation guidance and locked/read-only treatment so Basic users do not see Pro rules as actually configurable. | No entitlement, billing, RevenueCat, Supabase, push-cron, scanner, FCM, targetPath, routing, or delivery logic edits. | `git diff --check`; `cmd /c npx tsc --noEmit`; `npm.cmd run build`; `npm.cmd run smoke:copy` |
| 4 | TODO | Related documentation update | Documentation | LOW | Record the implementation result and remaining risks in `docs/alert-quality-operations.md`. | No feature expansion. | `git diff --check` |
| 5 | TODO | Safe validation execution | Verification | LOW | Confirm the final change remains UI/copy/docs only and run safe checks. | No `smoke:billing`, `smoke:api`, real push, real purchase, or restore. | `git diff --check`; `cmd /c npx tsc --noEmit`; `npm.cmd run build`; optional `npm.cmd run smoke:copy` |

## Task Execution Rules

- `AUTO NEXT` handles only the next `TODO` item.
- Task 1 and Task 2 are audit/spec tasks; they must not change app/UI code.
- Task 3 may change only alert settings UI/copy needed for Basic/Pro clarity.
- Task 4 updates documentation only.
- Task 5 runs safe validation and records results; it must not broaden scope.
- Failures are documented first. Do not jump from a failing validation into high-risk billing, entitlement, Supabase, FCM, push-cron, or delivery changes.

## Task 1 Completion Note

| Field | Value |
| --- | --- |
| Task | `1. Alert settings UI location audit` |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Source inspection and documentation only. |
| Result | Alert settings UI routes, components, Pro rule toggle locations, Basic misunderstanding risks, and likely improvement positions were documented in `docs/alert-quality-operations.md`. |
| Code changed? | `No` |
| Next TODO | `2. Basic-state Pro rule display proposal` |

## Task 2 Completion Note

| Field | Value |
| --- | --- |
| Task | `2. Basic-state Pro rule display proposal` |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Design documentation only. |
| Result | Basic-state Pro rule display principles, locked/read-only state policy, copy candidates, CTA principles, implementation minimums, exclusions, and validation criteria were documented in `docs/alert-quality-operations.md`. |
| Code changed? | `No` |
| Next TODO | `3. Minimal alert settings UI/copy implementation` |

## Task 3 Completion Note

| Field | Value |
| --- | --- |
| Task | `3. Minimal alert settings UI/copy implementation` |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Alert settings UI/copy implementation only. |
| Result | Basic or wrong-market Pro rules now render as locked/read-only in `RadarAlertCenter`, do not show as enabled, and do not toggle local rule state when locked. |
| Protected areas changed? | `No` |
| Next TODO | `4. Related documentation update` |

## Verification Policy

- Always run `git diff --check`.
- For docs-only TODOs, confirm changed files remain in `docs/`.
- For UI implementation TODOs, confirm changes are limited to alert settings UI/copy and docs.
- Confirm protected areas remain unchanged:
  - billing, entitlement, RevenueCat, Supabase, RLS, FCM, push-cron, scanner, delivery logic, targetPath, routing, Android release, Play Console, production DB/token, package scripts.
- For Task 3 and Task 5, run `cmd /c npx tsc --noEmit`.
- For Task 5, run `npm.cmd run build`; run `npm.cmd run smoke:copy` if the change remains safe and relevant.
- Run sensitive-value pattern checks before commit.

## Commit And Push Policy

- Setup commit message: `Clarify Pro alert rule UI for Basic users`.
- Setup may be committed and pushed to `main` when verification passes and the branch is in sync with `origin/main`.
- Future code-changing TODOs can use the same commit message only if the representative explicitly requests committing that TODO and the final change is safe.
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
