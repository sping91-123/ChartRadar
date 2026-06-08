# Pricing Access Redesign

## Purpose

This document is the working ledger for `pricing-access-redesign-run`.

The run settles the product and route-level boundary between Coin Basic, Coin Pro, Global Pro, and All Market Pro before iOS production release. It is documentation-first. It must not change billing code, RevenueCat behavior, product IDs, plan IDs, entitlements, or prices.

## Non-Negotiable Guardrails

- Do not edit app code while completing the planning tasks.
- Do not edit `src/lib/billing.ts`.
- Do not edit RevenueCat integration code or configuration.
- Do not change product IDs, plan IDs, entitlement names, or prices.
- Do not weaken Basic/Pro exposure policy through accidental implementation changes.
- Do not use investment-advice wording, guaranteed-return wording, or entry-instruction wording.
- Keep payment, auth, Supabase, Android release, FCM, and production deployment out of scope.

## Product Question

ChartRadar should remain a judgment-support product. The pricing boundary should answer:

- What is still useful in Basic?
- What makes Coin Pro worth paying for as the primary paid product?
- What makes Global Pro worth selling on its own?
- What extra combined value makes All Market Pro more than a simple bundle?
- Where should Pro CTAs appear without interrupting the user's market read?

## Task 1 - Current Pricing/Access Structure Audit

Status: `TODO`

Expected output:

- Current Pro product list.
- Current product IDs, plan IDs, and entitlement names as references only.
- Current route-level gating behavior.
- Current Pro CTA locations and wording patterns.
- Gaps or conflicts between current docs, app UI, and expected product structure.

Forbidden:

- Code edits.
- `billing.ts` edits.
- RevenueCat edits.
- Product ID, plan ID, entitlement, or price edits.

## Task 2 - Basic/Pro Value Re-Definition

Status: `TODO`

Expected output:

| Tier | Intended value | Should include | Should not include | Open questions |
| --- | --- | --- | --- | --- |
| Coin Basic | TBD | TBD | TBD | TBD |
| Coin Pro | TBD | TBD | TBD | TBD |
| Global Pro | TBD | TBD | TBD | TBD |
| All Market Pro | TBD | TBD | TBD | TBD |

## Task 3 - Route-Level Free/Paid Exposure Matrix

Status: `TODO`

Expected output:

| Route or surface | Basic exposure | Coin Pro exposure | Global Pro exposure | All Market Pro exposure | CTA rule | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `/coin` | TBD | TBD | TBD | TBD | TBD | TBD |
| `/crypto` | TBD | TBD | TBD | TBD | TBD | TBD |
| `/alts` | TBD | TBD | TBD | TBD | TBD | TBD |
| Spot candidate | TBD | TBD | TBD | TBD | TBD | TBD |
| `/global` | TBD | TBD | TBD | TBD | TBD | TBD |
| `/global/assets` | TBD | TBD | TBD | TBD | TBD | TBD |
| `/news` | TBD | TBD | TBD | TBD | TBD | TBD |
| `/alerts` | TBD | TBD | TBD | TBD | TBD | TBD |
| `/journal` | TBD | TBD | TBD | TBD | TBD | TBD |
| `/pro` | TBD | TBD | TBD | TBD | TBD | TBD |

## Task 4 - Pro CTA Wording Principles

Status: `TODO`

Expected output:

- Explain Pro value through better context, traceability, risk visibility, and follow-up conditions.
- Avoid promises about profit, hit rate, certainty, or future price movement.
- Avoid wording that tells users to enter a position.
- Prefer conditions, invalidation, risk, confirmation, and revisit cues.
- Keep Basic useful enough to support trust.
- Make Pro value concrete without making Basic feel broken.

## Task 5 - First Implementation Candidate Selection

Status: `TODO`

Candidate options:

- Pro page copy cleanup.
- Coin Radar home Basic/Pro exposure cleanup.
- Alerts Pro gating cleanup.
- Global Pro placement adjustment.

Selection criteria:

- User impact.
- Monetization clarity.
- Risk level.
- Implementation certainty.
- Verification clarity.
- Small commit size.

Selected first implementation candidate: `TBD`
