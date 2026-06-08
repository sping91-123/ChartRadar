# Active Automation Run

## Run Title

- `pricing-access-redesign-run`

## Run State

- Status: `ACTIVE`
- Setup date: 2026-06-08
- Current phase: pricing/access structure design before iOS production release.
- Execution mode: planning and documentation first.

## Purpose

- Re-define the value boundary between Coin Basic, Coin Pro, Global Pro, and All Market Pro after Android production launch.
- Clarify where each product is exposed across major ChartRadar routes.
- Make Pro CTA standards consistent without implying guaranteed returns, investment advice, or entry instructions.
- Treat Coin Radar as the primary paid conversion surface while re-checking whether Global Radar has enough standalone product value.
- Confirm whether All Market Pro has a strong bundle story before iOS production release.

## Background

- Android production launch is complete, but the free/paid boundary became less clear as Coin Radar and Global Radar evolved.
- Remaining product concerns:
  - Coin Radar and Global Radar product differentiation.
  - Blurred Basic and Pro feature boundaries.
  - Unclear Pro CTA placement and wording.
  - Global Pro standalone sales strength.
  - Coin Radar home, alerts, spot, and futures structure changes affecting monetization.
  - Need to settle product structure before iOS production release.

## High-Risk Guardrails

- Do not edit app code during this run unless a later explicit task reopens implementation.
- Do not edit `src/lib/billing.ts`.
- Do not edit RevenueCat integration code or configuration.
- Do not change product IDs, plan IDs, entitlement names, or prices.
- Do not weaken Basic/Pro exposure policy through implementation side effects.
- Do not use wording that looks like investment advice, guaranteed returns, or entry instructions.
- Keep payment, auth, Supabase, Android release, FCM, and production deployment out of scope.

## Scope

- Primary files:
  - `docs/automation-runs/active-run.md`
  - `docs/pricing-access-redesign.md`
- Allowed work:
  - Audit notes.
  - Product value definitions.
  - Route exposure matrix.
  - CTA copy principles.
  - First implementation candidate selection.
- Forbidden work:
  - App code edits.
  - Billing logic edits.
  - RevenueCat edits.
  - Price edits.
  - Product ID, plan ID, or entitlement edits.
  - Push, release, deploy, or Play Console changes outside docs-only auto push.

## Start Conditions

- Confirm `git status --short --branch`.
- Confirm `git rev-list --left-right --count HEAD...origin/main`.
- If local and `origin/main` diverge, stop before making implementation changes and report.
- If the worktree is dirty, identify existing changes before editing.
- For `AUTO RUN ACTIVE PLAN`, process exactly one `TODO` item per turn.

## Stop Conditions

- Any task requires editing billing, RevenueCat, entitlement, product ID, plan ID, price, auth, Supabase, Android, FCM, or production code.
- Any task requires adding a new app feature rather than documenting the pricing/access decision.
- Route exposure decisions require representative approval because they change monetization policy.
- Existing user changes overlap the target docs in a way that cannot be safely merged.
- Sensitive values appear in docs, logs, or diffs.

## Task List

| Order | Status | Task | Area | Risk | Goal | Forbidden | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | DONE | Current pricing/access structure audit | Pricing / Access Audit | LOW | Document current Pro products, plan IDs, entitlements, route gating, and Pro CTA locations. | No code edits. No `billing.ts` edits. No RevenueCat edits. No product ID, plan ID, entitlement, or price edits. | `git diff --check` |
| 2 | DONE | Basic/Pro value re-definition | Product / Monetization | MEDIUM | Define what Coin Basic, Coin Pro, Global Pro, and All Market Pro should each provide. | No code edits. No price changes. No billing logic changes. | `git diff --check` |
| 3 | DONE | Route-level free/paid exposure matrix | Product / Route Policy | MEDIUM | Document Basic and Pro exposure for `/coin`, `/crypto`, `/alts`, spot candidate, `/global`, `/global/assets`, `/news`, `/alerts`, `/journal`, and `/pro`. | No code edits. | `git diff --check` |
| 4 | TODO | Pro CTA wording principles | Copy / Compliance | LOW | Define CTA wording rules that explain Pro value without implying guaranteed returns or entry instructions. | No code edits. No entry-instruction phrasing. | `git diff --check` |
| 5 | TODO | First implementation candidate selection | Planning / Next Step | LOW | Select the first implementation candidate from Pro page copy cleanup, Coin Radar home Basic/Pro exposure cleanup, alerts Pro gating cleanup, or Global Pro placement adjustment. | No code edits. | `git diff --check` |

## Route Coverage For Task 3

- `/coin`
- `/crypto`
- `/alts`
- Spot candidate route or surface.
- `/global`
- `/global/assets`
- `/news`
- `/alerts`
- `/journal`
- `/pro`

## Verification Policy

- Always run `git diff --check`.
- Confirm changed files stay inside the docs scope.
- Run a sensitive-value pattern check before commit.
- For this setup task, app build and TypeScript checks are not required because app code is not changed.
- If future implementation starts, add checks appropriate to the touched surface, especially `npm.cmd run smoke:billing` for Pro or billing-adjacent UI work.

## Commit And Push Policy

- Commit after verification passes.
- Commit message for setup: `Define pricing access redesign run`.
- Docs-only safe changes may be pushed automatically when verification passes and the branch is in sync with `origin/main`.
- Do not release, deploy, submit Play Console changes, or alter production configuration during this run.

## Completion Report Format

- New active-run name.
- Registered task list.
- Whether high-risk forbidden scope is reflected.
- Verification results.
- Commit hash.
- Automatic push status.
- Final git status.
