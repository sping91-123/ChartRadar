# Completed Automation Run: pricing-access-redesign-run

## Status

- DONE

## Completed At

- 2026-06-08

## Purpose

Define ChartRadar's Basic/Pro pricing-access boundary after Android production launch and before iOS production release.

This run was documentation-first. It did not change app code, billing logic, RevenueCat behavior, product ids, plan ids, entitlements, or prices.

## Completed Tasks

1. Current pricing/access structure audit.
2. Basic/Pro value re-definition.
3. Route-level free/paid exposure matrix.
4. Pro CTA wording principles.
5. First implementation candidate selection.

## Key Decisions

- Coin Radar remains the first paid conversion core.
- Basic Radar should stay useful as a first-read and trust-building experience.
- Coin Pro should sell crypto depth, criteria, invalidation, alerts, repeated checks, and review continuity.
- Global Pro remains an independent product, but its standalone story needs clearer CTA placement and daily workflow framing.
- All Market Pro should be explained as a cross-market workflow bundle, not only combined access or a discount.
- Pro CTA copy must avoid investment-advice, guaranteed-return, buy/sell, long/short, and asset-recommendation language.

## Selected First Implementation

- `Pro page copy cleanup`

## Selection Reason

- It aligns directly with the pricing/access document.
- It can clarify all products in the main plan-comparison surface.
- It can reduce iOS/App Review wording risk before launch.
- It should not require billing, RevenueCat, product id, plan id, entitlement, price, or gating changes.
- It is small enough for one PR and easy to verify with screenshots.

## Suggested Branch

- `codex/pro-pricing-copy-cleanup`

## Suggested Implementation Scope

- `src/components/ProPricingPanel.tsx`
- `src/app/pro/page.tsx` only if narrow shell copy or safe-area presentation text needs adjustment.
- Optional docs note after implementation.

## Forbidden For First Implementation

- No `src/lib/billing.ts` changes.
- No RevenueCat changes.
- No product id, plan id, entitlement, or price changes.
- No checkout, confirm, sync, grant, or entitlement-resolution logic changes.
- No Basic/Pro gating changes.
- No legacy id exposure in user-facing copy.
- No investment-advice, profit, loss-avoidance, buy/sell, long/short, or asset-recommendation wording.

## Screenshot Review Targets

- `/pro`
- `/pro?market=crypto`
- `/pro?market=stocks`
- Mobile around 360px.
- Desktop.
- Light and dark theme if available.
- Native WebView safe-area if page shell spacing changes.

## Recommended Verification For First Implementation

- `git diff --check`
- `cmd /c npx tsc --noEmit`
- `npm.cmd run build`
- `npm.cmd run smoke:billing`
- Mobile and desktop screenshots for `/pro`, `/pro?market=crypto`, and `/pro?market=stocks`.

## Source Docs

- `docs/pricing-access-redesign.md`
- `docs/automation-runs/active-run.md`
