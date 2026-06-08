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

Status: `DONE`

Audit date: 2026-06-08

Audit scope:

- `src/lib/billing.ts`
- `src/lib/mobilePurchases.ts`
- `src/app/api/billing/checkout/route.ts`
- `src/app/api/billing/confirm/route.ts`
- `src/app/api/billing/app-store/sync/route.ts`
- `src/components/ProPricingPanel.tsx`
- `/pro`, `/coin`, `/crypto`, `/alts`, `/crypto/spot`, `/global`, `/global/assets`, `/news`, `/alerts`, `/journal`
- Current Pro CTA locations.
- Current Basic/Pro gating and plan/product/entitlement references.

Forbidden:

- Code edits.
- `billing.ts` edits.
- RevenueCat edits.
- Product ID, plan ID, entitlement, or price edits.

### Current Pro Product List

The current plan list is centralized in `src/lib/billing.ts`.

| User-facing product | Internal plan id | Market scope | Product id | Base plan id | Current amount reference |
| --- | --- | --- | --- | --- | --- |
| Basic Radar | `free` | `trial` | None | None | 0 |
| Coin Pro monthly | `crypto_monthly` | `crypto` | `chart_radar_crypto_monthly` | `monthly` | 29,000 |
| Coin Pro yearly | `crypto_yearly` | `crypto` | `chart_radar_crypto_yearly` | `year-1` | 290,000 |
| Global Pro monthly | `stocks_monthly` | `stocks` | `chart_radar_global_monthly` | `monthly` | 19,000 |
| Global Pro yearly | `stocks_yearly` | `stocks` | `chart_radar_global_yearly` | `yearly-1` | 190,000 |
| All Market Pro monthly | `bundle_monthly` | `bundle` | `chart_radar_bundle_monthly` | `monthly` | 39,000 |
| All Market Pro 6-month | `bundle_yearly` | `bundle` | `chart_radar_bundle_6month` | `month-6` | 199,000 |

Important current naming mismatch:

- `bundle_yearly` is a legacy internal id.
- It currently represents the user-facing All Market Pro 6-month subscription.
- This is documented in billing docs and in the billing code comment, but it remains a source of audit risk because the id reads yearly while the product is 6-month.

### Current Entitlement Structure

Current store entitlement ids are resolved in `src/lib/billing.ts`:

| Entitlement id | Meaning in current resolver |
| --- | --- |
| `coin_pro` | Opens crypto market scope. |
| `crypto_pro` | Legacy/alternate crypto entitlement that also opens crypto market scope. |
| `global_pro` | Opens stocks/global market scope. |
| `all_market_pro` | Opens bundle scope. |
| `bundle_pro` | Legacy/alternate bundle entitlement that also opens bundle scope. |

Current account-level plan handling:

- Client auth uses `useSupabaseAuth()` and applies the strongest active subscription/profile/app metadata plan to `profile.plan`.
- Server APIs use `getRequestEntitlement(request, scope)` and resolve active Supabase subscriptions plus profile/app metadata.
- Legacy `member`, `premium`, and `admin` still count as paid. `admin`, `member`, and `premium` open both crypto and stocks in `hasMarketEntitlement()`.
- If active crypto and stocks plans both exist but no bundle plan exists, `resolveCombinedBillingEntitlementPlan(..., "all")` returns `bundle_monthly` as the combined display plan.

### RevenueCat And Billing Flow References

Current native purchase flow:

- `/pro` renders `ProPricingPanel`.
- `ProPricingPanel` filters visible plans with `getBillingPlansForPage(marketScope)`.
- Native app checkout calls `purchaseNativePlan()` from `src/lib/mobilePurchases.ts`.
- Native purchase uses the billing plan's `appStoreProductId` and `appStoreBasePlanId`.
- RevenueCat package id maps directly to plan id except `bundle_yearly`, which maps to package id `bundle_6month`.
- After purchase or restore, native flow POSTs to `/api/billing/app-store/sync`.
- `/api/billing/app-store/sync` checks RevenueCat subscriber subscriptions and active entitlements, resolves plan ids, then grants Supabase billing entitlements.

Current web checkout flow:

- `/api/billing/checkout` validates plan id, login token, and returns either a payment link or native app-store metadata.
- `/api/billing/confirm` parses the plan from order id or request body, validates payment amount against `billingAmount`, confirms Toss payment when configured, then grants Supabase billing entitlement.
- This audit did not change any of the above.

### Current Route-Level Gating And CTA Locations

| Route or surface | Current route target | Current Basic exposure | Current Pro unlock | Current CTA / gating location |
| --- | --- | --- | --- | --- |
| `/coin` | Redirects to `/crypto/home`. | Same as `/crypto/home`. | Same as `/crypto/home`. | No direct CTA at redirect route. |
| `/crypto` | Redirects to `/crypto/home`. | Same as `/crypto/home`. | Same as `/crypto/home`. | No direct CTA at redirect route. |
| `/crypto/home` | `CoinRadarHomePanel`. | Decision-first Coin Radar home, representative coin tiles, collapsible evidence, market metrics, risk/recheck summaries. No explicit entitlement check. | No separate Pro unlock in the panel today. | Primary actions link to working crypto routes, not a Pro CTA. |
| `/alts` | Redirects to `/crypto/perpetual/alts`. | Alt futures page shows summaries, stablecoin/unlock context, chart/scout Basic summaries. | Coin Pro opens more alt details, detailed chart overlays/readouts, AI briefing, more scan depth, and more candidate detail. | `SetupScoutPanel` shows `AltProCta` linking to `/pro?market=crypto`; `LiveMarketChart` shows crypto Pro gate notices. |
| `/crypto/spot` | `SpotRadarPanel`. | Upbit/Bithumb spot candidate screen, personal spot watch, chart evidence, price plan grid. No entitlement check found. | No current Pro unlock found. | No Pro CTA found. This is a boundary gap. |
| `/global` | `GlobalMarketPulse`. | API returns a shaped Basic payload: core pressures trimmed, futures detail hidden, macro truncated, sector/leader items reduced, one event/news item. | Global Pro opens futures detail, full macro proxies, sector rotation, leader radar, event/news details. | `GlobalMarketPulse` shows `ProCta` linking to `/pro?market=stocks` and multiple locked detail blocks. |
| `/global/assets` | `StockRadarApp`. | Global asset radar is available with Basic usage limits and reduced visible insight depth. Watchlist limit follows plan. | Global Pro increases usage, watchlist capacity, and full radar insight visibility. | No explicit Pro CTA found in the main app panel; gating is mostly usage/visibility based. |
| `/news` | Crypto redirects to `/crypto/news`; `market=global/stocks` renders `RadarNewsPanel`. | News panel provides market news briefing and cards for both crypto and stocks. No entitlement check found. | No current Pro unlock found. | No Pro CTA found. This is a boundary gap if news is expected to support Pro value. |
| `/crypto/news` | `RadarNewsPanel` crypto. | Same as crypto news. API returns up to 24 items and panel builds up to 3 briefing cards. | No current Pro unlock found. | No Pro CTA found. |
| `/alerts` | Crypto redirects to `/crypto/alert`; global renders `RadarAlertCenter`. | Alert rules are visible with Basic/Pro badges. Basic can enable within usage limits. Free `macro-news` rule is available. | Pro alert rules exist by category: crypto rules and stock momentum. Server push delivery blocks Pro rules unless entitlement matches rule category. | No clear upgrade CTA in rule cards; Pro badge is visible. Usage gate message points to Pro when Basic limit is used. |
| `/crypto/alert` | `RadarAlertCenter` crypto. | Same alert center for crypto rules. | Coin Pro required for crypto Pro alert delivery. | No clear upgrade CTA in rule cards; Pro badges and usage limit messages only. |
| `/journal` | `JournalPage`. | Journal is available for crypto/global, localStorage fallback, Supabase remote sync when logged in. No entitlement check found. | No current Pro unlock found. Pro value is indirect because chart/scout saved entries can flow into journal. | No Pro CTA found. This is a boundary gap if journal is expected to be a Pro retention loop. |
| `/pro` | `ProPricingPanel`. | Shows Basic vs Pro difference, current plan, available paid plans, trust notes. | Shows filtered plans based on `market` query: all, crypto, or stocks. Checkout requires native app purchase availability and login. | Main plan cards provide purchase CTAs; `/pro?market=crypto` and `/pro?market=stocks` narrow the plan list. |

### Current API And Usage Gating

| Area | Current Basic limit or shape | Current Pro behavior |
| --- | --- | --- |
| `usageMeter.radarScan` | 2/day | 200/day |
| `usageMeter.altIndividualAnalysis` | 3/day | 300/day |
| `usageMeter.cryptoAiBriefing` | 1/day | 30/day |
| `usageMeter.watchlistScan` | 1/day | 100/day |
| `usageMeter.stockRadar` | 1/day | 100/day |
| `usageMeter.stocksAiBriefing` | 1/day | 30/day |
| `usageMeter.cryptoAlertRule` | 1/day | 20/day |
| `usageMeter.stocksAlertRule` | 1/day | 20/day |
| `/api/scout` | Rate limit 20/5min; top alts 3; top all 6 or 3 depending mode. | Rate limit 120/5min; top alts 5 or 3; top all 12 or 6 depending mode. |
| `/api/ai/market-briefing` | Crypto entitlement scope, 12 requests/window. | 60 requests/window. |
| `/api/ai/commentary` | Crypto entitlement scope, 30 requests/window. | 150 requests/window. |
| `/api/stocks/candles` | Stocks entitlement scope, 50 requests/window. | 160 requests/window. |
| `/api/stocks/market-board` | Stocks entitlement scope, 30/5min and Basic-shaped response. | 90/5min and full response. |

### Current Basic Exposure

Basic currently includes:

- Coin Radar home decision summary and evidence on `/crypto/home`.
- Major/alt chart Basic summaries and limited scan/AI usage.
- Alt candidate list with fewer visible candidates and hidden detailed conditions.
- Spot candidate screen with no current Pro gate.
- Global 30-second check with shaped Basic payload.
- Global asset radar with Basic usage limit and reduced insight depth.
- News briefing for crypto and global with no current Pro gate.
- Alerts setup UI with visible Basic/Pro labels and limited usage.
- Journal for both crypto and global, with local and logged-in persistence.
- `/pro` explanation of Basic vs Pro.

### Current Pro Unlocks

Coin Pro currently opens:

- Crypto market entitlement through `hasMarketEntitlement(plan, "crypto")`.
- More crypto scan usage and candidate detail.
- Alt individual analysis beyond Basic usage.
- Detailed chart overlays, advanced readouts, Pro plan/risk details, AI briefing gates.
- Crypto Pro alert delivery eligibility.
- Coin watchlist capacity by plan.

Global Pro currently opens:

- Stocks/global market entitlement through `hasMarketEntitlement(plan, "stocks")`.
- Full Global Market Pulse response and UI details.
- Higher stock radar usage.
- Global asset radar full insight depth.
- Global Pro alert delivery eligibility.
- Global watchlist capacity by plan.

All Market Pro currently opens:

- Bundle market scope, which satisfies both crypto and stocks entitlement checks.
- The Pro page positions it as a combined Coin Pro + Global Pro plan.
- The current bundle story is mostly "both markets together"; there is limited route-level evidence of a unique cross-market workflow beyond opening both scopes.

### Blurred Basic/Pro Boundary Found

1. `/crypto/home` is the main Coin Radar first viewport but does not currently distinguish Basic and Coin Pro.
2. `/crypto/spot` has rich candidate and price-plan behavior but no current entitlement gate or Pro CTA.
3. `/news` and `/crypto/news` are ungated despite being part of the market judgment loop.
4. `/journal` is ungated even though it is a retention/review loop and receives saved entries from chart/scout workflows.
5. `/alerts` shows Pro badges but does not make the upgrade action obvious near Pro rules.
6. `/global/assets` uses entitlement for usage/insight depth but lacks an obvious Global Pro CTA.
7. All Market Pro is described as a bundle, but the app currently has few visible moments that explain why combined coin/global access is better than buying one market.
8. Legacy ids and compatibility names (`bundle_yearly`, `member`, `premium`, `crypto_pro`, `bundle_pro`) increase cognitive load during audit even if they are valid compatibility paths.

### High-Risk Modification Areas To Keep Frozen

- `src/lib/billing.ts`
- `src/lib/mobilePurchases.ts`
- `/api/billing/checkout`
- `/api/billing/confirm`
- `/api/billing/app-store/sync`
- RevenueCat product/offering/package configuration.
- Google Play product ids and base plan ids.
- Supabase entitlement/profile/subscription write paths.
- `hasMarketEntitlement()`, `resolveCombinedBillingEntitlementPlan()`, and `getRequestEntitlement()` semantics.
- Push delivery entitlement filtering in `src/lib/server/push/entitlements.ts`.

### Issues For Task 2 - Basic/Pro Value Re-Definition

- Decide whether `/crypto/home` should remain fully Basic, become Basic summary plus Coin Pro detail, or only use CTA copy without hiding content.
- Decide whether `/crypto/spot` is a Basic acquisition surface or a Coin Pro feature.
- Decide whether news should stay fully Basic or become Pro-enhanced with deeper interpretation/history/source mapping.
- Decide whether journal should stay fully Basic or become a Pro retention loop through saved radar reviews, outcome analytics, or cross-market review.
- Decide whether alerts should gate by rule activation, push delivery, number of active rules, or detail explanation.
- Decide what Global Pro uniquely sells if Coin Radar remains the primary paid product.
- Decide whether All Market Pro needs a visible cross-market workflow, such as coin risk plus global risk combined context, rather than only access to both scopes.
- Decide how to explain Basic so it remains useful without giving away the exact Pro decision depth.

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
