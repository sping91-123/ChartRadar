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

Status: `DONE`

Definition date: 2026-06-08

| Tier | Intended value | Should include | Should not include | Open questions |
| --- | --- | --- | --- | --- |
| Basic Radar | Let users understand ChartRadar's judgment-support value quickly and safely without payment. | First-read market state, top risk, simple watch/recheck cues, limited route access, limited refresh/usage, enough news/journal/alert experience to build trust. | Deep evidence chains, repeated high-frequency scanning, full candidate detail, multi-market synthesis, large watchlists, advanced alert delivery, performance-like promises. | Which surfaces stay fully Basic vs Basic summary plus Pro detail: `/crypto/home`, `/crypto/spot`, `/news`, `/journal`. |
| Coin Pro | Primary paid product for crypto judgment support. | Coin Radar home depth, futures/alt details, spot candidate depth, risk and invalidation criteria, condition tracking, alert rules, watchlist capacity, AI/scan depth, journal handoff from coin workflows. | Trade-direction instructions, guaranteed outcomes, unlimited access language, price/plan/id changes, Global-only features as the main selling point. | How much of Coin Radar home remains Basic, and whether spot candidates become a Pro-enhanced surface. |
| Global Pro | Independent global-market radar for users who care about overseas equities, index futures, macro pressure, sectors, and leaders. | Global 30-second check depth, full macro proxies, event risk detail, sector/leader rotation, asset radar insight, global alerts, global watchlist capacity. | Being sold only as a weaker copy of Coin Pro, or relying only on generic market news. | Its standalone value is currently weaker than Coin Pro; it needs a sharper daily workflow and clearer CTA placement. |
| All Market Pro | Bundle for users who need one connected read across crypto and global risk. | Coin Pro + Global Pro access, cross-market risk transition, combined alert coverage, market-regime context, journal/review across both markets, one account-level operating view. | Only saying "Coin Pro + Global Pro" or only offering a discount-style bundle story. | What cross-market workflow appears on screen before implementation: shared risk tape, combined alerts, combined journal, or route-level synthesis. |

### Product Direction Decision

Coin Radar should be the first paid conversion core.

Reasons:

- Coin routes have the strongest current usage loop: home, futures/alts, spot candidates, alerts, watchlist, AI briefing, and journal handoff.
- The Coin Pro value can be explained as depth, recurrence, and risk traceability rather than a new feature promise.
- The current blurred boundary is most visible in Coin Radar, especially `/crypto/home`, `/crypto/spot`, `/alts`, and `/crypto/alert`.
- Coin Radar is better suited to a Basic-to-Pro ladder: Basic shows state and risk; Coin Pro opens conditions, invalidation, repeated scanning, and alert follow-through.

Global Pro should remain an independent product, but it needs a stronger standalone narrative before heavy implementation.

All Market Pro should remain a bundle product only if the next route-level matrix gives it visible cross-market value. Without that, it reads as simple combined access.

### Basic Radar Value Definition

Basic Radar should answer: "Is this app useful enough to trust before I pay?"

Basic should provide:

- A fast first read of the current market state.
- The most important risk or caution in plain terms.
- A small number of watch/recheck cues.
- Limited scans, limited alert setup, limited AI/news interpretation, and limited watchlist capacity.
- Access to journal basics so users can understand the review workflow.
- Enough crypto and global visibility to understand the product, not enough depth to replace Pro.

Basic should not provide:

- Complete evidence chains for every route.
- Full candidate detail across many symbols.
- Repeated high-frequency checks as the default experience.
- Full alert delivery for Pro-category rules.
- Large watchlists or cross-market operating views.
- Copy that makes Basic feel broken or intentionally useless.

Basic copy principle:

- Use "summary", "first read", "top risk", "next check", "limited depth", and "judgment support".
- Avoid framing Basic as a teaser with no practical value.

### Coin Pro Value Definition

Coin Pro should answer: "What do I need to track in crypto, and what would make the current read invalid?"

Coin Pro should provide:

- Coin Radar home detail beyond the Basic first read.
- BTC/ETH and alt evidence depth.
- Futures/alt candidate detail and broader scan volume.
- Spot candidate detail if the spot route becomes part of the paid ladder.
- Risk, invalidation, confirmation, and revisit criteria.
- Alerts for crypto Pro rules and monitored conditions.
- Larger coin watchlist capacity.
- AI briefing and commentary depth where it supports interpretation.
- Journal handoff from chart/scout/alert workflows so the same criteria can be reviewed later.

Coin Pro should be described as:

- Better context.
- More repeated checks.
- More traceable criteria.
- More risk visibility.
- More continuity from scan to alert to review.

Coin Pro should not be described as:

- A promise of profit.
- A prediction product.
- A direct action instruction product.
- A replacement for user judgment.

### Global Pro Value Definition

Global Pro should answer: "What is the overseas-market backdrop, and which risk axis matters first?"

Global Pro should provide:

- Full Global Market Pulse detail.
- Index futures breadth and divergence context.
- Macro proxies such as volatility, dollar, rates, commodities, and defensive assets.
- Sector and leader rotation.
- Event risk and news pressure depth.
- Global asset radar detail and larger watchlist capacity.
- Global alert rules and follow-up conditions.

Current weak points:

- Global Pro has less obvious daily urgency than Coin Pro.
- `/global/assets` has entitlement-based depth but weak visible upgrade pressure.
- The Global Pro CTA is clearer on `/global` than on `/global/assets`.
- Global Pro can look like a secondary dashboard unless it shows why global risk changes the user's market read.

Reinforcement direction:

- Make the daily global workflow sharper: first state, first risk axis, first assets to watch, next event.
- Show how global risk affects crypto and all-market interpretation without making Global Pro dependent on Coin Pro.
- Put Global Pro CTA near locked global detail, not only on `/pro`.
- Keep Global Pro independent, but make its best value "macro and asset context for the day" rather than broad market data.

### All Market Pro Value Definition

All Market Pro should answer: "How do crypto and global risks interact today?"

All Market Pro should provide:

- Access to both Coin Pro and Global Pro scopes.
- Cross-market risk transition: when global macro pressure changes crypto conditions, or crypto volatility changes risk appetite.
- Combined alert coverage across crypto and global rules.
- A unified journal/review path across both markets.
- A shared market regime view that helps users compare whether coin and global conditions agree or conflict.
- One operating flow for users who monitor both markets rather than switching products mentally.

All Market Pro needs more than:

- "Coin Pro + Global Pro".
- A price comparison.
- Two separate route groups with no visible connection.

Minimum bundle story for the next matrix:

- Basic: sees separate first reads.
- Single-market Pro: sees depth for one market.
- All Market Pro: sees combined risk, combined follow-up, and combined review.

### Basic/Pro Boundary Principles

1. Basic shows the conclusion layer; Pro opens the evidence and follow-up layer.
2. Basic shows a small number of cues; Pro supports repeated checks and broader symbol coverage.
3. Basic identifies risk; Pro explains why the risk matters and what condition changes the read.
4. Basic can show a candidate category; Pro shows traceable criteria, invalidation, and follow-up context.
5. Basic can use journal and news as product trust builders; Pro should connect them to alerts, scans, and review continuity.
6. Basic should never feel empty; Pro should clearly feel more operational.
7. Pro value should be placed near the moment where the user needs more depth, not only on `/pro`.
8. All gating changes in future implementation must preserve current plan ids, product ids, entitlements, billing amounts, and RevenueCat behavior.

### Pro Value Wording Principles

Use wording based on:

- More context.
- More evidence.
- More follow-up criteria.
- More risk visibility.
- More repeatability.
- More continuity from scan to alert to journal.

Avoid wording based on:

- Guaranteed results.
- Certainty.
- Profit claims.
- Future price promises.
- Direct position instructions.
- Language that sounds like ChartRadar is making the final decision for the user.

Preferred phrase patterns:

- "Open the detailed criteria."
- "Check the invalidation and follow-up context."
- "Track the risk and revisit cues."
- "Review the evidence behind the first read."
- "Connect scan, alert, and journal into one workflow."

### Standards To Hand Off To Task 3

Route-level exposure matrix should use these standards:

| Standard | Basic route exposure | Pro route exposure |
| --- | --- | --- |
| First read | Always available on core routes. | Same first read plus explanation depth. |
| Evidence detail | Limited to top-level support. | Full criteria, invalidation, and risk context. |
| Repeated usage | Limited by daily/local usage gates. | Higher limits using existing entitlement checks. |
| Alerts | Basic/free rules and limited setup. | Market-specific Pro rules and delivery eligibility. |
| News | Basic market read can remain visible. | Pro value should be deeper interpretation or connection to alerts/journal if gated. |
| Journal | Basic review can remain visible. | Pro value should be workflow continuity and richer review context if gated. |
| Cross-market view | Separate Basic reads. | All Market Pro should show combined risk and review value. |

Task 3 should decide the route-level status for:

- Keep fully Basic.
- Basic summary plus Pro detail.
- Pro-enhanced but not fully gated.
- Pro-only detail.
- CTA-only copy cleanup.

## Task 3 - Route-Level Free/Paid Exposure Matrix

Status: `DONE`

Matrix date: 2026-06-08

This matrix defines product-policy intent only. It does not change route code, existing gates, billing behavior, plan ids, product ids, entitlements, RevenueCat configuration, or prices.

### Gating Strength Definitions

| Gating strength | Meaning | Allowed use in this redesign |
| --- | --- | --- |
| None | The route or surface stays fully visible in Basic. | Use for acquisition, trust-building, or plan-comparison surfaces. |
| Soft CTA | Basic stays useful, with an upgrade prompt near deeper interpretation. | Use when the current route has no hard gate but Pro value should be clearer. |
| Partial lock | Basic shows the first read, while detailed criteria, repeated use, or full history is locked. | Preferred default for core Coin/Global product routes. |
| Hard lock | Basic cannot use the main paid action or delivery path. | Use sparingly for Pro-only alert delivery, high-frequency usage, or paid plan checkout actions. |

### Product Connection Rules

| Route family | Primary product link | Secondary product link | Rationale |
| --- | --- | --- | --- |
| Coin Radar routes | Coin Pro | All Market Pro | Coin Radar is the primary paid conversion surface. |
| Global Radar routes | Global Pro | All Market Pro | Global Pro remains independent, but All Market Pro can explain cross-market context. |
| News | Coin Pro or Global Pro based on selected market | All Market Pro when both markets are visible | News is a context surface, not a standalone paywall. |
| Alerts | Coin Pro or Global Pro based on rule market | All Market Pro for mixed rule sets | Alert value comes from repeated monitoring and delivery. |
| Journal | Coin Pro or Global Pro based on saved market context | All Market Pro for cross-market review | Journal value comes from continuity from scan to alert to review. |
| `/pro` | All products | None | The route should compare products and explain the bundle story. |

### Route Exposure Matrix

| Route or surface | Basic should show | Pro should open | Hide or limit | CTA position | Product link | Gating strength | Wording caution |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/coin` | Redirect to the Coin Radar first-read experience and keep the Basic summary useful. | Same destination can expose Coin Pro detail: evidence depth, risk context, saved review, and alert handoff. | Do not hard-lock the redirect itself. Limit only deeper destination blocks. | No CTA on the redirect route; place CTA in the first locked or expandable detail block after landing. | Coin Pro primary; All Market Pro secondary if cross-market context is shown. | Soft CTA on route, partial lock in destination detail. | Say "open coin criteria and follow-up context", not outcome or action promises. |
| `/crypto` | Redirect to Coin Radar home with market state, top risk, and next check cues. | Coin Pro opens more repeatable scans, detailed criteria, invalidation context, AI depth, and alert continuity. | Keep Basic first read visible. Limit deep evidence chains and repeated scan depth. | Near Coin Radar home evidence depth, risk details, and repeated scan controls. | Coin Pro primary; All Market Pro secondary. | Soft CTA on route, partial lock in destination detail. | Emphasize "risk and revisit cues"; avoid wording that tells the user what position to take. |
| `/alts` | Show a small alt futures summary, limited candidates, top risk cues, and Basic scout/chart summaries. | Coin Pro opens broader candidate depth, chart overlays, plan/risk detail, AI briefing depth, and more scan volume. | Limit full alt candidate lists, detailed conditions, advanced chart readouts, and repeated analysis usage. | Beside locked candidate detail, advanced chart sections, AI briefing, and usage-limit messages. | Coin Pro primary; All Market Pro secondary. | Partial lock. | Use "review detailed alt conditions" and "track risk changes"; avoid certainty or momentum-chasing language. |
| Spot candidate | Show a small spot candidate preview, exchange context, and simple watch cues so the surface can acquire Basic users. | Coin Pro should open full spot candidate criteria, price-plan context, invalidation/revisit cues, watchlist handoff, and journal save context if implemented. | Limit full candidate depth, repeated refresh, detailed price-plan grids, and saved workflow depth. | Above or beside the first detailed candidate section and near repeated refresh/save actions. | Coin Pro primary; All Market Pro secondary only when global context is added. | Partial lock if spot becomes paid; soft CTA if it remains acquisition-first. | Say "view criteria and recheck points"; do not frame spot candidates as instructions. |
| `/global` | Show Global Market Pulse first read: broad state, first risk axis, trimmed macro/futures/event context. | Global Pro opens full futures detail, macro proxies, sector/leader rotation, event/news depth, and global alert follow-up. | Limit secondary futures, full macro lists, deeper sector/leader evidence, and event detail. | Already strongest near locked Global Market Pulse details; keep CTA adjacent to each hidden depth block. | Global Pro primary; All Market Pro secondary for cross-market risk comparison. | Partial lock. | Use "understand the global risk axis"; avoid implying a guaranteed market direction. |
| `/global/assets` | Show Basic asset radar with usage limits, reduced insight depth, and enough watchlist context to understand the workflow. | Global Pro opens higher usage, deeper asset insight, larger watchlist capacity, and full global radar interpretation. | Limit repeated scans, full insight depth, large watchlists, and advanced asset comparisons. | Add or keep CTA near usage-limit states, locked insight panels, and watchlist-capacity moments. | Global Pro primary; All Market Pro secondary. | Partial lock. | Say "expand asset context and follow-up checks"; avoid turning asset reads into trade calls. |
| `/news` | Show Basic market news briefing and a small set of context cards for the selected market. | Pro can open deeper interpretation, source grouping, impact history, alert handoff, and journal review context by market. | Do not make all news paid. Limit deeper interpretation, history, or workflow linkage if monetized. | After the Basic briefing and near "deeper context" or "connect to alert/journal" sections. | Coin Pro for crypto news, Global Pro for global news, All Market Pro when both markets are compared. | Soft CTA by default; partial lock only for deeper interpretation/history. | Use "connect this news to risk context"; avoid "this news means you should..." phrasing. |
| `/alerts` | Show alert categories, Basic/free rules, limited setup, Pro badges, and current usage state. | Coin Pro opens crypto Pro rule delivery; Global Pro opens global Pro rule delivery; All Market Pro opens mixed-market alert workflow. | Hard-lock Pro rule delivery without matching entitlement. Limit active rule count and repeated monitoring by plan. | In each Pro rule card, near enable/delivery controls, and in usage-limit messages. | Market-specific Pro based on rule category; All Market Pro for mixed crypto/global rule sets. | Hard lock for Pro delivery, partial lock for expanded rule capacity, soft CTA for browsing. | Say "monitor this condition" and "enable delivery"; avoid urgent action or position language. |
| `/journal` | Show basic journal capture, local review, market tags, and simple saved notes so users see the review habit. | Pro can open saved criteria from scans/alerts, richer review history, cross-market review, and outcome-neutral follow-up notes. | Do not hide basic journaling. Limit workflow continuity, advanced review filters, cross-market synthesis, and saved radar context if monetized. | Near saved radar entries, advanced filters, cross-market review, and scan/alert-to-journal handoff. | Coin Pro or Global Pro by saved market; All Market Pro for mixed-market review. | Soft CTA by default; partial lock for advanced review continuity. | Use "review your criteria and follow-up notes"; avoid performance-score or success-rate claims. |
| `/pro` | Show Basic vs Pro comparison, product scopes, current plan status, trust notes, and safe product language. | Paid checkout/actions remain tied to the existing plan list and entitlement behavior. All Market Pro should explain combined workflow, not only combined access. | Do not expose legacy ids to users. Do not change prices, product ids, plan ids, or entitlement names. | Main product cards, comparison rows, and market-specific entry links such as crypto/global plan filters. | Coin Pro, Global Pro, and All Market Pro all visible with clear scope. | None for reading; hard lock only for checkout requirements such as login or native purchase availability. | Use "choose the coverage you need" and "compare workflows"; avoid return, certainty, or entry framing. |

### CTA Placement Standards For Future Implementation

1. Put Pro CTAs at the moment a Basic user asks for more depth, not at the top of every route.
2. Prefer CTA placement near locked details, usage-limit states, Pro alert delivery controls, saved radar handoff, or advanced review filters.
3. Keep redirect routes such as `/coin` and `/crypto` free of standalone CTA clutter; place CTAs after the user lands on the actual Coin Radar surface.
4. For Global Pro, place CTAs beside locked macro, futures, asset, or event context so the standalone value is visible.
5. For All Market Pro, place CTAs only where combined coin/global workflow is visible, such as mixed alerts, cross-market review, or risk comparison.

### Matrix Hand-Off Criteria

Task 4 should use the wording cautions above when defining CTA copy. Task 5 should prefer the first implementation candidate that clarifies one of these high-impact gaps without touching billing logic:

- Coin Radar home Basic summary plus Coin Pro detail.
- Spot candidate Basic preview plus Coin Pro detail.
- Alerts Pro rule CTA and delivery explanation.
- Global asset CTA placement.
- All Market Pro cross-market workflow explanation on `/pro`.

## Task 4 - Pro CTA Wording Principles

Status: `DONE`

Definition date: 2026-06-08

These principles define wording policy only. They do not change Pro gates, billing code, RevenueCat behavior, product ids, plan ids, entitlements, or prices.

### Pro CTA Base Principles

1. Explain Pro as more judgment context, not as a better outcome.
2. Put the CTA next to the missing depth: criteria, invalidation, alerts, review history, or cross-market context.
3. Keep Basic useful and calm. Basic copy should say what is visible now before explaining what Pro adds.
4. Use neutral workflow verbs: view, check, review, track, connect, expand, compare.
5. Avoid urgency, certainty, fear, or direction. CTA copy should not push the user toward a market action.
6. Make the unlocked value concrete: more evidence, more condition tracking, more alert coverage, richer review continuity.
7. Keep product names tied to scope: Coin Pro for crypto depth, Global Pro for global market depth, All Market Pro for combined workflow.

### Forbidden Wording Patterns

| Risk area | Do not use | Reason |
| --- | --- | --- |
| Return guarantee | "Increase returns", "Make profit with Pro", "Higher win rate", "Beat the market" | Sounds like guaranteed performance or financial advice. |
| Loss avoidance guarantee | "Avoid losses", "Protect your money", "Never miss a drop", "Prevent bad trades" | Implies risk can be removed. |
| Direction instruction | "Buy now", "Sell before it falls", "Take this signal", "Enter here" | Direct investment instruction. |
| Long/short instruction | "Open long", "Open short", "Long setup", "Short now" | Position-entry guidance. |
| Coin recommendation | "Recommended coin", "Best coin to buy", "Top pick", "This coin is the answer" | Can read as a specific asset recommendation. |
| Certainty | "Confirmed breakout", "Guaranteed reversal", "Sure trend", "Safe entry" | Overstates market certainty. |
| Fear pressure | "Upgrade before you lose", "You are exposed without Pro", "Do not miss this move" | Creates anxiety instead of informed judgment. |
| App Review risk | "Financial advisor", "investment advice", "signal service", "profit prediction" | Can create regulatory or review concerns. |

### Allowed Wording Patterns

| Value area | Safe pattern | Example CTA text |
| --- | --- | --- |
| Judgment evidence | Ask the user to inspect the basis for the first read. | "View the detailed criteria." |
| Risk conditions | Frame the unlock around risk visibility. | "Check the risk conditions." |
| Invalidation | Show what would change the read. | "Open invalidation and revisit cues." |
| Alert expansion | Describe monitoring, not action. | "Expand alert conditions." |
| Journal continuity | Connect scan, alert, and review. | "Save this context for review." |
| Market evidence | Offer more context behind the summary. | "See the deeper market evidence." |
| Cross-market context | Compare conditions across markets. | "Compare coin and global risk context." |

### Product-Specific CTA Standards

| Product | CTA should emphasize | Safe CTA examples | Avoid |
| --- | --- | --- | --- |
| Coin Pro | Crypto evidence depth, invalidation criteria, repeated scans, alt/spot detail, crypto alerts, and journal handoff. | "Open Coin Pro criteria.", "Track crypto risk and revisit cues.", "Expand crypto alert conditions." | Coin picks, entry timing, long/short language, profit framing. |
| Global Pro | Macro pressure, index futures, sector/leader rotation, event risk, asset radar depth, and global alerts. | "Open Global Pro market context.", "Review macro and asset risk details.", "Expand global alert coverage." | Claims that global context predicts market direction or removes uncertainty. |
| All Market Pro | Combined coin/global workflow, mixed alerts, cross-market risk comparison, and unified review. | "Compare coin and global risk context.", "Connect mixed-market alerts and review.", "Open the all-market workflow." | Presenting the bundle only as a discount or implying one market gives certain direction for another. |

### Route-Level CTA Tone

| Route or surface | CTA tone | Preferred wording direction | Avoid |
| --- | --- | --- | --- |
| `/coin` | Light and post-redirect. | Coin first-read plus deeper criteria after landing. | Standalone redirect CTA or urgent crypto-action language. |
| `/crypto` | Decision-support depth. | "Review the evidence behind this crypto read." | "Act on this signal" style copy. |
| `/alts` | Careful and risk-first. | "Open detailed alt conditions and risk changes." | "Next alt winner" or momentum-chasing phrasing. |
| `/global` | Context and pressure. | "Review the global risk axis and macro context." | Claims that the route predicts the next market move. |
| `/global/assets` | Asset context and follow-up. | "Expand asset radar context and watch conditions." | Asset recommendations or trade-call phrasing. |
| `/news` | Interpretation, not prediction. | "Connect this news to market risk context." | "This news means buy/sell" logic. |
| `/alerts` | Monitoring and delivery. | "Enable monitoring for this condition." | "Get the next entry alert" or urgent action wording. |
| `/journal` | Review and learning loop. | "Connect this context to your review notes." | Performance-score claims or guaranteed improvement. |
| `/pro` | Comparison and scope clarity. | "Choose the coverage and workflow you need." | Legacy ids, return promises, or pressure-based plan copy. |

### Basic User Anxiety Rules

- State what Basic already provides before naming what Pro adds.
- Avoid "locked because you are missing out" framing.
- Prefer "Basic shows the first read; Pro opens the detailed criteria" over "Upgrade to unlock the real answer".
- Do not imply Basic users are unsafe, uninformed, or exposed.
- Avoid countdowns, market urgency, or loss-pressure copy.
- Keep empty and limited states factual: "Daily Basic limit reached" plus a calm Pro option.

### iOS And App Review Risk Wording

Avoid wording that can make ChartRadar look like a regulated advisory, signal, or performance-guarantee product:

- "Investment advice"
- "Financial advisor"
- "Guaranteed profit"
- "Avoid losses"
- "Buy signal"
- "Sell signal"
- "Long entry"
- "Short entry"
- "Best coin to buy"
- "This will go up"
- "This will fall"
- "Pro predicts the market"

Safer review posture:

- ChartRadar provides market context, risk conditions, and review tools.
- Users make their own decisions.
- Pro expands context, monitoring, and review continuity.
- CTA copy should stay consistent with judgment support, not portfolio advice.

### First CTA Cleanup Candidates For Future Implementation

1. `/pro` product cards: remove any wording that overstates outcomes and make All Market Pro read like a workflow bundle.
2. `/alerts` Pro rule cards: add market-specific monitoring language near Pro delivery controls.
3. Coin Radar home: add calm Coin Pro depth language near evidence or repeated-check sections.
4. `/global/assets`: add Global Pro CTA near usage limits and locked insight depth.
5. Spot candidate surface: if monetized later, use criteria and revisit language rather than candidate recommendation language.

## Task 5 - First Implementation Candidate Selection

Status: `DONE`

Selection date: 2026-06-08

Candidate options:

- Pro page copy cleanup.
- Coin Radar home Basic/Pro exposure cleanup.
- Alerts Pro gating/CTA cleanup.
- Global Pro placement/CTA adjustment.
- All Market Pro bundle value copy cleanup.

Selection criteria:

- User impact.
- Monetization clarity.
- Risk level.
- Implementation certainty.
- Verification clarity.
- Small commit size.

### Candidate Comparison

| Candidate | Advantages | Risk | Implementation scope | Verification standard |
| --- | --- | --- | --- | --- |
| Pro page copy cleanup | Directly aligns product names, CTA tone, Basic/Pro boundary, and All Market Pro bundle story in the main pricing surface. Does not need billing, RevenueCat, product id, plan id, entitlement, or price changes. Reduces iOS review wording risk before launch. | LOW if limited to presentation copy and layout text. Billing-adjacent surface requires strict no-logic-diff discipline. | `src/app/pro/page.tsx` shell copy if needed, `src/components/ProPricingPanel.tsx` user-facing copy, optional docs note after implementation. | `git diff --check`, `cmd /c npx tsc --noEmit`, `npm.cmd run build`, `npm.cmd run smoke:billing`, mobile screenshot for `/pro` and `/pro?market=crypto` / `/pro?market=stocks`. |
| Coin Radar home Basic/Pro exposure cleanup | Makes the primary paid conversion route clearer and reinforces Coin Pro as the main product. Strong user-facing value. | MEDIUM because it may touch route presentation, Basic/Pro exposure, and current home information architecture. Must avoid accidental gating changes. | Coin Radar home presentation and copy only; possible locked-detail placeholders if explicitly approved later. | `git diff --check`, typecheck, build, smoke:mobile, route screenshot for `/crypto/home` and redirect paths. |
| Alerts Pro gating/CTA cleanup | Clarifies Pro delivery rules where value is naturally tied to monitoring. Strong monetization clarity for repeated usage. | MEDIUM because alert delivery and entitlement semantics are sensitive. Copy-only changes are safe; logic changes are forbidden without a separate scoped task. | Alert rule card copy, Pro badge explanation, usage-limit wording, no server/push entitlement changes. | `git diff --check`, typecheck, build, smoke:ops or alert smoke if touched, screenshots for `/alerts?market=crypto` and `/alerts?market=global`. |
| Global Pro placement/CTA adjustment | Addresses the weakest standalone product narrative and improves Global Pro visibility. | MEDIUM because `/global/assets` currently mixes usage, insight visibility, and watchlist behavior. | CTA placement and copy near global locked detail or usage-limit states only; no entitlement or stock API changes. | `git diff --check`, typecheck, build, smoke:mobile, screenshots for `/global` and `/global/assets`. |
| All Market Pro bundle value copy cleanup | Helps the bundle read as cross-market workflow rather than only a discount or combined access. Strong strategic value for pricing structure. | LOW to MEDIUM depending on whether it stays on `/pro` copy or expands into route-level workflow. | Prefer `/pro` copy first; defer cross-route workflow implementation. | Same as Pro page cleanup if limited to `/pro`; broader route checks if expanded later. |

### Selected First Implementation Candidate

Selected candidate: `Pro page copy cleanup`

Reason:

- It is the smallest implementation that directly uses the output of Tasks 1-4.
- It clarifies Basic Radar, Coin Pro, Global Pro, and All Market Pro where users already compare plans.
- It can reduce iOS/App Review wording risk without changing billing logic.
- It can make All Market Pro's bundle value visible before deeper route changes.
- It is easy to screenshot and review on mobile and desktop.
- It has the best risk/reward balance because it can stay presentation-only.

### Suggested PR Branch

- `codex/pro-pricing-copy-cleanup`

### Candidate Implementation Files

- `src/components/ProPricingPanel.tsx`
- `src/app/pro/page.tsx` only if shell text or safe-area framing copy needs a narrow update.
- Optional post-implementation doc note in `docs/pricing-access-redesign.md`.

### Forbidden Scope For First Implementation

- Do not edit `src/lib/billing.ts`.
- Do not edit RevenueCat integration or app-store sync code.
- Do not change product ids, plan ids, entitlement names, or prices.
- Do not change checkout, confirm, subscription grant, or entitlement resolution logic.
- Do not change Basic/Pro gating behavior.
- Do not expose legacy ids such as `bundle_yearly` in user-facing copy.
- Do not add investment-advice, profit, loss-avoidance, buy/sell, long/short, or asset-recommendation wording.
- Do not redesign unrelated routes in the same PR.

### Screenshot Review Targets

- `/pro`
- `/pro?market=crypto`
- `/pro?market=stocks`
- Mobile width around 360px.
- Desktop width.
- Light and dark theme if the route supports both through the app shell.
- Native WebView safe-area check if the implementation changes page shell spacing.

### Draft Next PR Instruction

Implement only the `/pro` page copy cleanup from `pricing-access-redesign-run`.

Scope:

- Update user-facing copy in `ProPricingPanel` so Basic Radar, Coin Pro, Global Pro, and All Market Pro match the definitions in `docs/pricing-access-redesign.md`.
- Make All Market Pro read as a cross-market workflow bundle: combined risk context, mixed alerts, and unified review.
- Replace any outcome-, signal-, or urgency-oriented CTA wording with judgment-support wording based on criteria, risk, invalidation, alert conditions, and review.
- Preserve the existing plan list, prices, checkout flow, entitlement behavior, RevenueCat behavior, product ids, plan ids, and gating.

Expected verification:

- `git diff --check`
- `cmd /c npx tsc --noEmit`
- `npm.cmd run build`
- `npm.cmd run smoke:billing`
- Screenshots for `/pro`, `/pro?market=crypto`, and `/pro?market=stocks` on mobile and desktop.
