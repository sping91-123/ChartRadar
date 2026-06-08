# Android Production Stability QA

## Scope Status

- Active run: `android-production-stability-qa-run`
- Latest completed task: `Core route smoke scenario outline`
- Task status: `DONE`
- Prepared date: 2026-06-09
- Purpose: define what must be checked after Android production launch before iOS production work or new feature work.

This document is a QA scope map, not an execution log. It does not authorize code changes, production data changes, Play Console changes, billing changes, auth changes, Supabase changes, FCM changes, or Android release setting changes.

## Operating Rules

- Run one active-run task at a time.
- Use a dedicated QA account before any manual account, billing, or notification check.
- Do not use a real customer account for destructive or billing-adjacent checks.
- Do not perform an actual payment in this scope-definition task.
- Do not delete a real account. Account deletion should be checked as accessibility and warning-flow scope only until a dedicated QA account is approved for deletion.
- Do not change production data, external service settings, product IDs, plan IDs, entitlements, prices, push schedules, or release configuration.
- Record implementation defects as follow-up candidates instead of fixing them inside this QA preparation run.

## Operator Preflight

Before actual QA execution, the operator should confirm:

- Android production app is installed from Google Play, not a local debug build.
- The installed app opens the production service.
- A dedicated Google QA account is available.
- The QA account's expected plan state is known before testing.
- The operator knows whether billing checks will use Play tester flow, restore-only flow, or observation-only flow.
- Notification permission prompts can be tested on a device where app notification state can be reset.
- Play Console can be opened for production crash and ANR review.
- Any issue that requires code, config, service, or production mutation will be logged and deferred.

## QA Scope Matrix

| Area | Included scope | Check type | Risk | Operator confirmation before execution | Forbidden area |
| --- | --- | --- | --- | --- | --- |
| Install and first entry | Install from Google Play, first launch, initial loading, first visible route, offline or slow-network first impression. | Manual primary; route/mobile smoke may support. | MEDIUM | Confirm production install source and target environment. | No Android release setting edits. No Play Console release edits. No production config edits. |
| Google login | Google sign-in entry, account selection, callback return, signed-in state, error/abort state. | Manual primary. | MEDIUM | Use dedicated QA account only. | No auth code edits. No Supabase edits. No OAuth console edits. |
| Logout | Logout visibility, successful signed-out state, protected-state cleanup from the user's point of view. | Manual primary. | MEDIUM | Confirm expected signed-in state before logout. | No auth/session code edits. No storage logic edits. |
| Account deletion | Account deletion page or control access, warning clarity, policy/contact access, stop point before irreversible action. | Manual only. | HIGH | Use accessibility check only unless a disposable QA account is approved. | No real account deletion. No Supabase edits. No production data mutation. |
| Current plan display | Basic/Pro plan label, product family display, post-login plan visibility, stale or conflicting plan state. | Manual primary; billing smoke may support in later tasks. | HIGH | Know expected QA account plan state before testing. | No entitlement, plan ID, product ID, price, RevenueCat, or billing logic edits. |
| Core routes | `/coin`, `/crypto`, `/alts`, `/global`, `/alerts`, `/journal`, `/pro`, settings/account screens. | Automatic route smoke and manual WebView review. | MEDIUM | Confirm routes to capture and account state for gated pages. | No app code edits. No route redesign. No feature additions. |
| `/coin` | Decision summary, top state, loading/empty/error state, primary next action, mobile first viewport. | Automatic route smoke plus manual review. | LOW | Confirm production data freshness expectation. | No copy redesign. No data logic edits. |
| `/crypto` | Crypto overview, chart/data loading, judgment-support wording, Basic/Pro exposure. | Automatic route smoke plus manual review. | MEDIUM | Confirm Basic vs Pro account state. | No market data, billing, or gating logic edits. |
| `/alts` | Alt radar entry, list/card readability, loading/empty/error state, Pro gating display. | Automatic route smoke plus manual review. | MEDIUM | Confirm expected gated and ungated states. | No gating logic edits. No signal wording changes. |
| `/global` | Global dashboard entry, key panels, loading/empty/error state, Global Pro exposure. | Automatic route smoke plus manual review. | MEDIUM | Confirm account state and production data availability. | No global data pipeline or entitlement edits. |
| `/alerts` | Alerts page entry, alert settings visibility, Basic/Pro limit presentation, empty state. | Manual primary; route smoke support. | HIGH | Confirm notification permission state and plan state. | No FCM edits. No push-cron edits. No Supabase edits. |
| `/journal` | Journal entry, saved/review state visibility, empty state, login-required behavior if applicable. | Automatic route smoke plus manual review. | MEDIUM | Confirm whether QA account has existing entries. | No journal persistence or Supabase edits. |
| `/pro` | Plan comparison, pricing copy, current plan, CTA state, restore access if present, Basic/Pro value framing. | Manual primary; billing smoke may support in later tasks. | HIGH | Confirm no actual payment will be made in this task. | No `billing.ts`, RevenueCat, product ID, plan ID, entitlement, price, checkout, sync, or restore logic edits. |
| Settings/account screens | Account identity, plan state, notification settings, app version, contact, terms, privacy, refund/account deletion links. | Manual primary. | MEDIUM | Confirm exact screen path inside the Android app. | No auth, policy route, billing, Supabase, or native setting edits. |
| Google Play subscription flow | Product display, native subscription sheet availability, cancel/back behavior, no broken return path. | Manual later task only. | HIGH | Use approved tester flow only; do not make a real purchase in this scope task. | No actual payment here. No billing or RevenueCat edits. No product config edits. |
| Purchase restore | Restore entry visibility, user-facing result state, current plan refresh expectation. | Manual later task only. | HIGH | Confirm QA account's historical purchase state before testing. | No restore logic edits. No entitlement edits. No production account mutation. |
| Basic/Pro gating | Basic usefulness, Pro value boundary, blocked-state copy, no investment-advice wording. | Manual plus route smoke support. | HIGH | Test with known Basic and known Pro states if available. | No gating weakening. No entitlement logic edits. No buy/sell/long/short wording. |
| Notification permission | Android permission prompt, denied/granted states, in-app explanation, settings fallback. | Manual primary. | HIGH | Use device where permission state can be reset. | No FCM edits. No Android permission config edits. |
| Push token storage | User-visible readiness and diagnostics if available; server-side evidence only if already exposed safely. | Manual observation only. | HIGH | Confirm no production DB mutation or direct token inspection is required. | No token value logging. No Supabase edits. No FCM edits. |
| Notification settings | Enable/disable controls, Pro limits, empty state, saved-state feedback. | Manual primary. | HIGH | Confirm QA account plan state. | No push token, FCM, alert scanner, push-cron, or Supabase edits. |
| Notification click targetPath | Tap notification and verify expected in-app route opens. | Manual later task only. | HIGH | Use a safe test notification path if already available. | No push generation changes. No targetPath logic edits. No production push-cron changes. |
| Mobile 360px key screens | `/coin`, `/crypto`, `/alts`, `/global`, `/alerts`, `/journal`, `/pro`, settings/account first viewport and safe area. | Automatic screenshot support plus manual review. | MEDIUM | Confirm viewport and theme to capture. | No UI redesign. No safe-area/native edits in this task. |
| Play Console health | Production crash rate, ANR rate, Android vitals, recent release warnings, user-visible issue alerts. | Manual console review. | HIGH | Read-only console review only. | No release edits. No rollout changes. No store listing edits. No tester or country/region changes. |

## Automatic Versus Manual Coverage

Automatic or script-supported checks can cover:

- Route reachability for `/coin`, `/crypto`, `/alts`, `/global`, `/alerts`, `/journal`, `/pro`, and policy/account routes if included in existing smoke scripts.
- Mobile viewport rendering checks around 360px when screenshot tooling is available.
- Static checks such as `git diff --check` for QA documentation changes.
- Existing non-mutating smoke scripts in later execution tasks, if they do not touch protected services or production data.

Manual checks are required for:

- Google login, account picker, callback return, logout, and account deletion warning flow.
- Current plan display with known Basic/Pro account state.
- Google Play subscription sheet behavior, purchase cancel/back behavior, and purchase restore.
- Notification permission prompts, device notification settings, push token readiness from the user's point of view, and notification tap routing.
- Play Console crash, ANR, vitals, and warning review.
- Any final judgment about whether a mobile WebView screen feels usable to a real user.

## Screen Smoke Scenarios

These scenarios define what to check when the actual Android production QA pass starts. They are safe to prepare now because they do not require code edits, real payments, real push sends, production data edits, or external service changes.

### `/coin`

- Entry path: launch app first-entry path if it lands on Coin, bottom/top navigation to Coin, and direct route `/coin`.
- Check items: today's conclusion, readiness score, direction label, BTC-led versus alt-led market label, risk summary, next confirmation conditions, visible CTA to the next relevant check, loading/empty/error state, navigation away and back, Android back behavior, refresh behavior.
- Expected result: the first viewport gives a clear judgment-support summary within a few seconds; score, direction, market leadership, risks, and next checks do not contradict each other; repeated lower sections add evidence instead of making the top conclusion feel duplicated.
- Failure suspect area: Coin decision model, production market data freshness, route shell, top summary component, copy hierarchy, mobile safe-area spacing.
- Automatic check: route reachability and basic 360px screenshot can be automated.
- Manual check: required for conclusion quality, duplicate-feeling review, wording risk, and whether the first viewport is understandable to a real user.
- Mobile 360px watch: long conclusion sentences, score and direction chips wrapping badly, leadership label overflow, CTA crowding, top summary pushing risks below the fold.
- Risk: MEDIUM.

### `/crypto`

- Entry path: top/bottom navigation to Crypto, legacy or internal links that land on `/crypto`, and direct route `/crypto`.
- Check items: main crypto market screen entry, chart or key panels load, Basic versus Pro differences are visible, core signals are framed as conditions and risks, data-empty state is readable, navigation to related crypto detail or alert flows works, Android back and refresh do not trap the user.
- Expected result: Basic users still get useful high-level context; Pro-only sections explain the value boundary without weakening gating; no wording reads like a direct trade instruction or guaranteed outcome.
- Failure suspect area: market data fetch, chart rendering, Basic/Pro gating, local cache state, crypto route navigation, production API freshness.
- Automatic check: route reachability, no fatal render error, and screenshot smoke can be automated.
- Manual check: required for Basic/Pro comparison, wording judgment, data-empty quality, and chart usability.
- Mobile 360px watch: chart height collapse, horizontal overflow from tables or chips, Pro CTA covering content, dense signal copy becoming unreadable.
- Risk: MEDIUM.

### `/alts`

- Entry path: navigation to Alts, crypto sub-navigation where available, and direct route `/alts`.
- Check items: alt screen entry, alt strength/risk framing, Basic/Pro limit display, empty or low-data state, CTA to deeper Pro context if gated, back navigation to previous market screen, refresh behavior.
- Expected result: the page communicates alt-market condition and risk without overclaiming; gated areas are understandable; no mobile layout break blocks the main list or summary.
- Failure suspect area: alt data availability, gating rules, card/list layout, route mapping, copy density.
- Automatic check: route reachability and mobile screenshot smoke can be automated.
- Manual check: required for risk wording, gating clarity, and whether the alt list is usable on a phone.
- Mobile 360px watch: multi-column card content compressing too tightly, long symbol labels, badges wrapping into controls, CTA overlap near the bottom.
- Risk: MEDIUM.

### `/global`

- Entry path: navigation to Global, links from market selection or Pro surfaces, and direct route `/global`.
- Check items: US/global market flow screen entry, today's first assets or market areas to review, most important risk, Global Pro CTA placement, loading/empty/error state, link to deeper global asset workflow if present, Android back and refresh behavior.
- Expected result: `/global` works as a market-flow dashboard, not a dense asset radar; the first read identifies what matters today and why; Global Pro CTA feels contextual rather than disruptive.
- Failure suspect area: global data pipeline, macro/event data freshness, `/global` versus `/global/assets` route boundary, CTA placement, mobile layout.
- Automatic check: route reachability and screenshot smoke can be automated.
- Manual check: required for "what to review first" judgment, risk priority, and CTA naturalness.
- Mobile 360px watch: market summary blocks becoming too tall, risk text pushing CTA below useful context, asset labels overflowing, bottom navigation overlap.
- Risk: MEDIUM.

### `/alerts`

- Entry path: notification/settings entry, market-specific alert links, top/bottom navigation, and direct route `/alerts`.
- Check items: alert list or alert setup entry, empty-list state, notification settings entry, Basic/Pro alert limit display, disabled or permission-restricted state, safe expectation for notification targetPath after a received notification is tapped, back navigation and refresh behavior.
- Expected result: users can understand whether alerts are available, empty, limited, or blocked by permission/login/plan state; no actual push needs to be sent for this smoke scenario; targetPath expectations are documented for later manual push QA.
- Failure suspect area: alert page state, notification permission bridge, push token readiness, Basic/Pro alert limits, targetPath routing, auth state.
- Automatic check: route reachability can be automated; actual targetPath validation cannot be completed without a manual notification event.
- Manual check: required for permission state, empty-list quality, alert settings access, Pro limits, and targetPath navigation after a safe test notification in a later task.
- Mobile 360px watch: permission/status rows wrapping badly, alert rule toggles too close together, empty-state CTA overflow, sticky controls covering list content.
- Risk: HIGH.

### `/journal`

- Entry path: navigation to Journal, links from review/recap flows, and direct route `/journal`.
- Check items: journal screen entry, empty state, record list visibility, write entry path, detail/review entry path, login-required or local fallback messaging if applicable, Android back behavior from write/detail, refresh behavior.
- Expected result: a new or empty account sees a useful empty state; an account with entries can scan and open records; writing/detail entry paths are discoverable without changing saved data during smoke unless explicitly approved.
- Failure suspect area: journal persistence state, Supabase-backed entries, local storage fallback, list rendering, route state, mobile form layout.
- Automatic check: route reachability and screenshot smoke can be automated.
- Manual check: required for empty versus populated account behavior, write/detail flow clarity, and safe no-data-change review.
- Mobile 360px watch: text areas or cards exceeding viewport, action buttons below safe area, long entry titles, list controls crowding.
- Risk: MEDIUM.

### `/pro`

- Entry path: top/bottom navigation to plan page, Pro CTA from gated surfaces, account page plan link if present, and direct route `/pro`.
- Check items: Basic versus Pro explanation, Coin Pro copy, Global Pro copy, All Market Pro copy, price display, current plan display, CTA wording, purchase buttons visible, restore access if present, error/loading state for product information, navigation back to the previous page.
- Expected result: users understand Basic usefulness and each paid plan boundary; prices are visible and not internally contradictory; CTA copy remains judgment-support oriented; purchase buttons are visible but the smoke pass stops before any real payment attempt.
- Failure suspect area: pricing panel rendering, current-plan state, RevenueCat or Google Play product fetch state, billing copy, mobile button layout.
- Automatic check: route reachability and screenshot smoke can be automated; billing smoke may support later verification if non-mutating.
- Manual check: required for pricing copy, CTA safety, current-plan interpretation, Android product-loading state, and confirming the tester stops before payment.
- Mobile 360px watch: plan cards too tall, price rows wrapping into CTA, purchase buttons clipped near safe area, current-plan label overflow, restore link too hard to find.
- Risk: HIGH.
- Hard stop: do not tap through to complete purchase, do not change products, do not edit billing or RevenueCat settings.

### Settings and Account Screens

- Entry path: header settings panel, `/settings`, `/account`, `/account/delete`, `/privacy`, `/terms`, `/refund`, and related menu links.
- Check items: account state, current plan, notification settings access, app version if exposed, contact/policy access, logout control, account deletion guidance access, signed-out messaging, Android back behavior from policy/account pages.
- Expected result: signed-out users can understand how to log in; signed-in users can see account and plan state; logout is accessible; account deletion is an information/request flow, not an accidental destructive action; policy and refund links open cleanly.
- Failure suspect area: account session display, header settings panel, policy route links, logout control, account deletion page, plan label, app shell navigation.
- Automatic check: route reachability for `/settings`, `/account`, `/account/delete`, `/privacy`, `/terms`, and `/refund` can be automated.
- Manual check: required for signed-in versus signed-out account state, logout, deletion-accessibility wording, version visibility, and settings panel behavior.
- Mobile 360px watch: full-screen settings panel overflow, close/back controls hidden by safe area, account rows wrapping awkwardly, policy links too low or clipped.
- Risk: MEDIUM, with HIGH risk if any destructive account deletion path is exercised.

## Navigation And State Smoke Rules

- For every core route, check direct route entry and one in-app navigation path.
- For every core route, use Android back once and confirm the app returns to the expected previous screen or exits only when expected.
- For every core route, refresh or relaunch once if the screen has production data dependency.
- For every empty/loading/error state encountered, capture whether the user has a next step.
- For every Pro CTA, confirm it explains access without pressuring an immediate action.
- For every permission-limited state, confirm the screen says what permission/account/plan state is missing.
- Do not use smoke testing to mutate account data, complete purchases, send push notifications, edit alerts, or change production configuration unless a later approved task explicitly permits it.

## Risk Grouping

LOW risk scope:

- Docs-only QA scope definition.
- Read-only route list and first-entry scope.
- Read-only mobile viewport review planning.

MEDIUM risk scope:

- Login/logout observation.
- Core route smoke review.
- Settings/account surface review.
- Journal and global route review where user-specific state may affect what appears.

HIGH risk scope:

- Account deletion, even if only checking access and warning copy.
- Billing, subscription, restore, entitlement, and current-plan checks.
- Notification permission, push token, push routing, Pro alert limits, duplicate/cooldown checks.
- Play Console health review because console actions must remain read-only unless separately approved.

## What To Capture During Actual QA

- Device model, Android version, app install source, and app version.
- Account state before testing: signed out, Basic, Pro, or unknown.
- Route or screen checked.
- Expected result.
- Actual result.
- Evidence type: screenshot, screen recording, console observation, or smoke output.
- Whether the issue is a blocker, follow-up candidate, or no issue.
- Whether the issue touches protected areas: billing, auth, Supabase, FCM, Android release, Play Console, or production data.

## Out Of Scope For This Run

- iOS production readiness.
- New features or UI redesign.
- Real purchase attempts in this scope-definition task.
- Production data edits.
- Play Console release changes.
- RevenueCat, Google Play product, or entitlement changes.
- Auth, Supabase, FCM, push-cron, or Android native/release changes.
