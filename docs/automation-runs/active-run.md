# Active Automation Run

## Run Title

- `pro-pricing-copy-cleanup-run`

## Run State

- Status: `ACTIVE`
- Setup date: 2026-06-08
- Current phase: `/pro` pricing copy cleanup before iOS production release.
- Execution mode: audit first, PR-based implementation for UI copy changes.

## Purpose

- Implement the first candidate selected by `pricing-access-redesign-run`: `/pro` page copy cleanup.
- Clarify Basic Radar, Coin Pro, Global Pro, and All Market Pro value in the pricing surface.
- Improve Pro CTA wording without touching billing logic, prices, product ids, plan ids, or entitlements.
- Keep ChartRadar positioned as judgment support, not investment advice or a signal service.

## Background

- `pricing-access-redesign-run` selected `Pro page copy cleanup` as the first implementation candidate.
- The reason was that `/pro` can clarify product value and CTA tone without changing billing or entitlement behavior.
- iOS production readiness benefits from removing wording that could imply investment advice, return guarantees, or entry instructions.

## High-Risk Guardrails

- Do not edit `src/lib/billing.ts`.
- Do not edit RevenueCat integration or configuration.
- Do not change product IDs, plan IDs, entitlement names, or prices.
- Do not edit checkout, confirm, app-store sync, grant, or entitlement-resolution logic.
- Do not change Basic/Pro gating behavior.
- Do not use wording that implies investment advice, guaranteed returns, loss avoidance, buy/sell instruction, long/short entry, or specific asset recommendation.
- Do not push implementation work directly to `main`; the UI copy implementation must be PR-based.
- Do not merge before screenshot review.

## Scope

- Primary planning files:
  - `docs/automation-runs/active-run.md`
  - `docs/pro-pricing-copy-cleanup.md`
- Expected implementation files for Task 2:
  - `src/components/ProPricingPanel.tsx`
  - `src/app/pro/page.tsx` only if narrow shell copy or safe-area presentation copy needs adjustment.
- Forbidden implementation files:
  - `src/lib/billing.ts`
  - `src/lib/mobilePurchases.ts`
  - `src/app/api/billing/checkout/route.ts`
  - `src/app/api/billing/confirm/route.ts`
  - `src/app/api/billing/app-store/sync/route.ts`
  - RevenueCat configuration files or external settings.

## Start Conditions

- Confirm `git status --short --branch`.
- Confirm `git rev-list --left-right --count HEAD...origin/main`.
- If local and `origin/main` diverge, stop before editing and report.
- If the worktree is dirty, identify existing changes before editing.
- For `AUTO RUN ACTIVE PLAN`, process exactly one `TODO` item per turn.

## Stop Conditions

- Any task requires billing, RevenueCat, product id, plan id, entitlement, price, checkout, confirm, sync, grant, auth, Supabase, Android, FCM, or production changes.
- Any implementation would require weakening or changing Basic/Pro gating behavior.
- UI copy work expands into route redesign outside `/pro`.
- Screenshot verification cannot be completed for the implementation task.
- Sensitive values appear in docs, logs, or diffs.

## Task List

| Order | Status | Task | Area | Risk | Goal | Forbidden | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | TODO | `/pro` current copy audit | Pricing Copy Audit | LOW | Audit `/pro`, `ProPricingPanel`, and related CTA wording. | No code edits. | `git diff --check` |
| 2 | TODO | `/pro` pricing copy cleanup implementation | Pricing UI Copy | MEDIUM | Align Coin Pro, Global Pro, All Market Pro value descriptions and CTA wording with `pricing-access-redesign-run`. | No `billing.ts` edits. No RevenueCat edits. No product ID, plan ID, entitlement, or price edits. No checkout/confirm/sync/grant edits. No investment-advice, return-guarantee, or entry-instruction wording. No direct push to `main`. | `git diff --check`; `cmd /c npx tsc --noEmit`; `npm.cmd run build`; `npm.cmd run smoke:billing`; `npm.cmd run smoke:mobile`; `npm.cmd run smoke:all`; `/pro` 360px screenshot; `/pro` desktop screenshot |
| 3 | TODO | Result documentation | Documentation | LOW | Document `/pro` copy cleanup result and remaining pricing/access candidates. | No app code edits. | `git diff --check` |

## Screenshot Policy

- Required for Task 2 before merge:
  - `/pro` at 360px.
  - `/pro` desktop.
  - `/pro?market=crypto` if plan filtering copy is touched.
  - `/pro?market=stocks` if plan filtering copy is touched.
- Check CTA wording, plan comparison readability, button text fit, mobile safe area, and absence of investment-advice wording.

## Verification Policy

- Always run `git diff --check`.
- Confirm changed files stay inside the task scope.
- Run a sensitive-value pattern check before commit.
- Task 1 and Task 3 are docs-only and do not require build checks.
- Task 2 is billing-adjacent UI copy work and must include `smoke:billing`.

## Commit And Push Policy

- Setup commit message: `Define pro pricing copy cleanup run`.
- Docs-only setup may be pushed to `main` when verification passes and branch is in sync with `origin/main`.
- Task 2 implementation must be PR-based and must not push directly to `main`.
- Do not release, deploy, submit Play Console changes, or alter production configuration during this run.

## Completion Report Format

- New active-run name.
- Registered task list.
- Whether high-risk forbidden scope is reflected.
- Verification results.
- Commit hash.
- Automatic push status.
- Final git status.
