# Active Automation Run

## Run Title

- `android-production-stability-qa-run`

## Run State

- Status: `TODO`
- Setup date: 2026-06-08
- Current phase: Android production QA scope definition completed; core route smoke scenario outline pending.
- Execution mode: QA preparation and checklist documentation first. `AUTO RUN ACTIVE PLAN` processes exactly one `TODO` task per turn.

## Purpose

- Prepare a post-Android-production stability QA pass from an actual user point of view.
- Verify that core ChartRadar surfaces remain stable after recent `/coin`, `/pro`, pricing/access, and boxless UI work.
- Keep this run focused on QA scope definition, checklist preparation, and first QA batch selection before iOS production or new feature work.
- Avoid feature additions and avoid app code, production data, billing, auth, Supabase, FCM, and Android release changes.

## Background

- Android production release is complete.
- Recent `main` changes include `/coin` home decision summary, `/pro` pricing copy cleanup, pricing/access redefinition, and partial boxless UI improvements.
- Before iOS production or new feature work, ChartRadar needs one Android production stability pass across sign-in, billing, alerts, settings, and primary route entry.

## High-Risk Guardrails

- Do not modify app code.
- Do not edit auth, Google sign-in, Supabase, session, account deletion, or policy logic.
- Do not edit billing, RevenueCat, product IDs, plan IDs, entitlements, prices, checkout, restore, or plan-display logic.
- Do not edit FCM, push token handling, push-cron, alert scanner, targetPath handling, cooldown, or notification routing logic.
- Do not edit Android native files, Android release settings, Play Console configuration, app signing, AAB generation, or versioning.
- Do not touch production data, production config, secrets, tokens, keys, or external service settings.
- Do not add iOS scope.
- Do not add new features.
- Document findings and candidates only. Implementation requires a separate approved task or run.

## Scope

- Primary planning file:
  - `docs/automation-runs/active-run.md`
- Optional companion QA document as tasks complete:
  - `docs/android-production-stability-qa.md`
- Core route and feature coverage:
  - `/coin`
  - `/crypto`
  - `/alts`
  - `/global`
  - `/alerts`
  - `/journal`
  - `/pro`
  - Settings and account-related screens.
- QA focus:
  - Android production user-path stability.
  - Login, account, and settings access.
  - Billing, subscription visibility, and Basic/Pro gating display.
  - Notification permission, settings, routing, duplicate, and cooldown behavior.
  - Empty, loading, and error state readiness.
  - Mobile WebView layout and safe-area behavior.

## Start Conditions

- Confirm `git status --short --branch`.
- Confirm `git rev-list --left-right --count HEAD...origin/main`.
- If local and `origin/main` diverge, stop before editing and report.
- If the worktree is dirty, identify existing changes before editing.
- For `AUTO RUN ACTIVE PLAN`, process exactly one `TODO` item per turn.
- For high-risk checklist tasks, docs-only checklist creation is allowed. Code, config, service, or production changes are not allowed.

## Stop Conditions

- Any task requires app code changes, production data changes, deploys, release submissions, Play Console changes, or external service settings changes.
- Any task requires modifying billing, auth, Supabase, FCM, Android release, or production configuration.
- QA preparation uncovers an implementation issue. Record it as a work-item candidate instead of fixing it inside this run.
- The requested QA scope expands into iOS release work or new feature work.
- Sensitive values appear in docs, logs, or diffs.

## Task List

| Order | Status | Task | Area | Risk | Goal | Forbidden | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | DONE | Android production QA scope definition | QA Scope | LOW | Document the screens and functions to check after Android production launch. | No code edits. | `git diff --check` |
| 2 | TODO | Core route smoke scenario outline | Smoke Scenarios | LOW | Define QA scenarios for `/coin`, `/crypto`, `/alts`, `/global`, `/alerts`, `/journal`, `/pro`, and settings/account screens. | No code edits. | `git diff --check` |
| 3 | TODO | Login/account/settings QA checklist | Account QA | MEDIUM | Create checklist items for Google login, logout, account deletion, current plan, notification settings, app version, contact, and policy access. | No auth code edits. No Supabase edits. | `git diff --check` |
| 4 | TODO | Billing/subscription QA checklist | Billing QA | HIGH | Create checklist items for Google Play subscription, Pro purchase, restore purchase, current plan display, and Basic/Pro gating display. | No `billing.ts` edits. No RevenueCat edits. No product ID, plan ID, entitlement, or price edits. | `git diff --check` |
| 5 | TODO | Notification QA checklist | Notification QA | HIGH | Create checklist items for notification permission, push token, alert settings, Pro notification limits, targetPath navigation, duplicates, and cooldown. | No FCM edits. No push-cron edits. No Supabase edits. | `git diff --check` |
| 6 | TODO | First actual QA batch selection | QA Execution Planning | LOW | Select the first QA bundle to run on an actual device or browser. | No code edits. | `git diff --check` |

## QA Documentation Policy

- This run is preparation-first. Tasks should produce QA scope, checklists, and execution candidates.
- Findings that imply implementation should be recorded as work-item candidates in `docs/work-items/` or as a separate approved follow-up.
- If `docs/android-production-stability-qa.md` is created, keep it limited to scope, scenarios, checklists, execution notes, evidence, and findings.
- Keep ChartRadar positioned as judgment support. Do not introduce buy, sell, long, short, guaranteed return, or investment-advice wording.

## Verification Policy

- Always run `git diff --check`.
- Confirm changed files stay inside `docs/`.
- Run a sensitive-value pattern check before commit.
- Docs-only setup and checklist tasks do not require TypeScript, build, or smoke commands.
- If app code changes appear necessary, stop and report instead of changing code.

## Commit And Push Policy

- Setup commit message: `Define Android production stability QA run`.
- Docs-only setup may be committed and pushed to `main` when verification passes and the branch is in sync with `origin/main`.
- Do not release, deploy, submit Play Console changes, alter production configuration, or run production-mutating operations during this run.

## Completion Report Format

- New active-run name.
- Registered task list.
- Whether high-risk forbidden scope is reflected.
- Verification results.
- Commit hash.
- Automatic push status.
- Final git status.
