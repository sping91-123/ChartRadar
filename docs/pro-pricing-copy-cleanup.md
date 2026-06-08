# Pro Pricing Copy Cleanup

## Purpose

This document tracks `pro-pricing-copy-cleanup-run`.

The run implements the first candidate selected by `pricing-access-redesign-run`: cleanup of `/pro` pricing copy and CTA wording. The implementation must preserve billing logic, RevenueCat behavior, product ids, plan ids, entitlements, prices, checkout flow, and Basic/Pro gating.

## Source Decision

`pricing-access-redesign-run` selected `/pro` page copy cleanup because it can clarify product value and reduce iOS/App Review wording risk without touching billing or entitlement logic.

Suggested implementation branch:

- `codex/pro-pricing-copy-cleanup`

## Non-Negotiable Guardrails

- Do not edit `src/lib/billing.ts`.
- Do not edit RevenueCat integration or configuration.
- Do not change product ids, plan ids, entitlement names, or prices.
- Do not edit checkout, confirm, app-store sync, grant, or entitlement-resolution logic.
- Do not change Basic/Pro gating behavior.
- Do not push implementation work directly to `main`.
- Do not use investment-advice, guaranteed-return, loss-avoidance, buy/sell, long/short, or specific asset-recommendation wording.

## Task 1 - `/pro` Current Copy Audit

Status: `TODO`

Expected output:

- Current `/pro` page shell copy.
- Current `ProPricingPanel` product descriptions.
- Current CTA labels and trust notes.
- Any copy that conflicts with pricing-access wording principles.
- Safe implementation notes for Task 2.

## Task 2 - `/pro` Pricing Copy Cleanup

Status: `TODO`

Expected output:

- Basic Radar wording stays useful and calm.
- Coin Pro wording emphasizes crypto criteria, risk context, alerts, repeated checks, and review continuity.
- Global Pro wording emphasizes macro, asset, event, and global-market context.
- All Market Pro wording emphasizes cross-market workflow, mixed alerts, and unified review.
- CTA wording uses judgment-support language: criteria, risk, invalidation, alert conditions, review.
- Existing billing and entitlement behavior is preserved.

Required verification:

- `git diff --check`
- `cmd /c npx tsc --noEmit`
- `npm.cmd run build`
- `npm.cmd run smoke:billing`
- `npm.cmd run smoke:mobile`
- `npm.cmd run smoke:all`
- `/pro` 360px screenshot
- `/pro` desktop screenshot

## Task 3 - Result Documentation

Status: `TODO`

Expected output:

- Summary of `/pro` copy changes.
- Confirmation of preserved billing/product/entitlement scope.
- Screenshot review notes.
- Remaining pricing/access candidates:
  - Coin Radar home Basic/Pro exposure cleanup.
  - Alerts Pro gating/CTA cleanup.
  - Global Pro placement/CTA adjustment.
  - All Market Pro cross-market workflow follow-up.
