# Android Production Stability QA

## Scope Status

- Active run: `android-production-stability-qa-run`
- Latest completed task: `Login/account/settings QA checklist`
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

## Login, Account, And Settings QA Checklist

Use this checklist for Android production account QA with a dedicated QA account. These checks are observation and navigation checks only. They do not permit auth code changes, Supabase changes, RLS changes, billing changes, RevenueCat changes, FCM changes, push sends, Android release changes, or production data edits.

### Google Login

| Check item | Entry path | Expected result | Failure suspect area | Automatic check | Manual check | Risk | Forbidden area |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Signed-out login CTA is visible | Fresh app launch while signed out, header/settings panel, `/login`, gated account surfaces. | User can clearly find a Google login path without losing the screen context. | Header account state, login route, settings panel state, gated copy. | Route reachability only. | Required. | MEDIUM | No auth UI/code edits inside this run. |
| Google login button is clickable | `/login` or settings login entry. | Button responds once, shows pending feedback if available, and does not double-submit visually. | Google login component, disabled/loading state, WebView event handling. | Not reliable. | Required. | MEDIUM | No OAuth config, auth code, or Supabase edits. |
| Google account picker opens | Tap Google login in Android production app. | Android/WebView opens a Google account selection or login step and can return to the app. | Native browser handoff, Capacitor/WebView redirect, OAuth provider settings, popup blocking. | No. | Required. | HIGH | No OAuth console changes. No native Android release edits. |
| Login cancel is safe | Cancel from account picker or back out before authorizing. | App returns to `/login`, previous route, or a safe default without blank screen, broken overlay, or stuck loading. | Auth callback handling, returnTo state, WebView history, error state. | No. | Required. | MEDIUM | No auth/session code edits. |
| Login failure or slow network is understandable | Use poor network or observe timeout/error if it occurs naturally. | User sees a retryable state or clear error; app remains navigable. | Auth request timeout, callback error copy, network handling, login route. | Limited via route smoke only. | Required if reproducible safely. | MEDIUM | Do not simulate by changing production config. |
| Login success updates user state | Complete Google login with dedicated QA account. | Header/account surface changes to signed-in state; `/account` shows account identity and current plan; gated surfaces refresh appropriately. | Session storage, profile fetch, `useSupabaseAuth`, entitlement refresh, callback rescue. | No. | Required. | HIGH | No Supabase, RLS, entitlement, or auth code edits. |
| Return destination is safe | Start login from `/account`, `/pro`, `/alerts`, and one core route if feasible. | After login, user returns to the original route or a safe default; no open redirect or broken blank route. | `returnTo` handling, callback route, WebView history. | Limited route-only support. | Required. | MEDIUM | No redirect/auth code edits. |
| App relaunch keeps session | Force close and reopen after successful login. | User remains signed in when expected, or sees a deliberate signed-out state with clear login path. | Session persistence, Android WebView storage, custom session helpers, profile refresh. | No. | Required. | HIGH | No local/session storage logic edits. |
| WebView redirect does not trap user | Complete or cancel login inside Android production WebView context. | No permanent external browser trap, blank WebView, repeated account picker, or lost back stack. | Capacitor redirect, OAuth callback, Android WebView history. | No. | Required. | HIGH | No Android native or OAuth setting edits. |

### Logout

| Check item | Entry path | Expected result | Failure suspect area | Automatic check | Manual check | Risk | Forbidden area |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Logout entry is discoverable | Signed-in header/auth status, settings panel, `/account`. | User can find a clearly labeled logout control. | Header account state, `/account` signed-in branch, settings panel. | Route reachability only. | Required. | MEDIUM | No account UI code edits. |
| Logout button wording is safe | `/account` or header account control. | Label clearly means logout and does not imply account deletion or subscription cancellation. | Account copy, header auth control. | No. | Required. | LOW | No copy edits in this task unless separately approved. |
| Logout switches to signed-out state | Tap logout with dedicated QA account. | User sees signed-out state; login CTA is available; account-only surfaces no longer show identity. | `signOut`, auth state refresh, profile cache, header state. | No. | Required. | HIGH | No auth code, Supabase, or storage logic edits. |
| Pro/account-only surfaces are limited | After logout, visit `/account`, `/pro`, `/alerts`, and a gated area if available. | Account identity is hidden; Pro access is not displayed as active unless public Basic state is expected. | Entitlement cache, profile state, Basic/Pro gating. | Limited route smoke support. | Required. | HIGH | No gating, entitlement, billing, or profile edits. |
| Back button does not reveal private state | Logout from `/account`, then use Android back. | Previous account details, email, and plan state are not shown as active private state. | Browser history, client cache, auth state invalidation. | No. | Required. | HIGH | No storage/session code edits. |
| Relaunch keeps logged-out state | Force close and reopen after logout. | App does not silently restore the signed-in QA account unless login is intentionally persistent. | Session clearing, WebView storage, auth refresh. | No. | Required. | HIGH | No auth/session code edits. |

### Account Deletion Access

| Check item | Entry path | Expected result | Failure suspect area | Automatic check | Manual check | Risk | Forbidden area |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Account deletion entry is reachable | `/account`, settings/menu policy links, `/account/delete`. | User can find account and data deletion guidance from account/settings surfaces. | Account page link, policy footer/menu links, route availability. | Route reachability can be automated. | Required. | MEDIUM | No account deletion implementation edits. |
| Mistake-prevention copy is visible | `/account` deletion section and `/account/delete`. | Copy distinguishes account deletion from Google Play subscription cancellation and warns about saved data. | Account deletion copy, policy page content. | No. | Required. | HIGH | No production account deletion. No legal/policy changes without approval. |
| Confirmation boundary is clear | `/account` deletion section. | If a checkbox, link, form, or destructive button appears, tester knows where to stop before irreversible action. | Account page state, deletion request UX. | No. | Required. | HIGH | Do not submit a real deletion request. Do not click any destructive final action. |
| Privacy/policy accessibility is intact | `/privacy`, `/terms`, `/account/delete`, `/refund`. | User can read deletion, privacy, terms, and refund guidance from Android app without broken navigation. | Policy routes, internal links, WebView navigation. | Route reachability can be automated. | Required. | MEDIUM | No policy route edits in this task. |
| Separate destructive QA is deferred | Any need to verify actual deletion. | Actual deletion testing is moved to a separate run with disposable account, explicit approval, and production-data risk review. | QA process control. | Not applicable. | Required decision. | HIGH | No real production account deletion in this run. No Supabase or RLS edits. |

### Current Plan Display

| Check item | Entry path | Expected result | Failure suspect area | Automatic check | Manual check | Risk | Forbidden area |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Basic state is visible | Signed-out state and known Basic QA account on `/account`, header/auth status, `/pro`. | Basic appears as useful baseline, not broken or unknown, and does not expose Pro-only access. | Profile plan mapping, header auth status, pricing panel current-plan row. | Route screenshot support only. | Required. | HIGH | No entitlement, billing, RevenueCat, or Supabase edits. |
| Pro state location is visible | Known Pro QA account on `/account`, header/auth status, `/pro`. | Current plan appears in predictable places and does not require digging through checkout. | Profile fetch, plan label mapping, entitlement refresh. | No. | Required with known Pro account. | HIGH | No plan or entitlement edits. |
| Coin/Global/All Market labels are distinguishable | `/account` and `/pro`. | Coin Pro, Global Pro, and All Market Pro labels do not collapse into ambiguous generic Pro when specific scope is known. | Plan label helper, market entitlement display, pricing panel copy. | No. | Required. | HIGH | No product ID, plan ID, entitlement, price, or `billing.ts` edits. |
| Expired or restore-needed state is handled | Use account state only if already available. | If entitlement cannot be confirmed, user sees a safe refresh/restore/login-needed path rather than conflicting active Pro. | RevenueCat sync state, entitlement refresh, profile stale state. | No. | Required only with suitable test account. | HIGH | No RevenueCat dashboard edits. No entitlement mutation. |
| `/pro` and account plan labels are consistent | Compare `/account`, header/auth status, `/pro`. | Same account does not show Basic in one place and paid plan in another, except during a clearly labeled loading state. | Profile cache, entitlement refresh interval, pricing panel state. | Screenshot support only. | Required. | HIGH | No billing, profile, or entitlement writes. |

### Notification Settings Access

| Check item | Entry path | Expected result | Failure suspect area | Automatic check | Manual check | Risk | Forbidden area |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Notification settings entry is reachable | Header bell, settings panel alert link, `/alerts`, market-specific alert routes. | User can reach alert settings from common Android app paths. | Header alert link, settings panel, alert route mapping. | Route reachability can be automated. | Required. | MEDIUM | No FCM, push-cron, or alert route edits. |
| Permission pre-request state is clear | Fresh install or reset notification permission state. | Screen explains that app push requires permission and account/device connection where applicable. | Permission bridge, alert copy, platform detection. | No. | Required. | HIGH | No Android permission config edits. |
| Permission denied state is understandable | Deny permission if safe on QA device. | User sees blocked/denied state and knows Android settings may be needed; page remains usable. | Permission state handling, toast/copy, settings fallback. | No. | Required if permission can be reset. | HIGH | No FCM or native permission code edits. |
| Pro alert limits are visible | Basic and Pro account states on alert surfaces. | Basic limits and Pro value are visible without weakening gating. | Alert limit copy, entitlement state, gating. | Limited screenshot support. | Required. | HIGH | No entitlement, gating, or billing edits. |
| Market/type settings are visible if supported | `/alerts`, `/alerts?market=global`, `/crypto/alert`. | Market-specific or type-specific controls appear in expected market context and do not conflict. | Alert route mapping, market preference, settings panel link. | Route reachability can be automated. | Required. | MEDIUM | No alert persistence or Supabase edits. |
| No real push is sent | Any alert settings or diagnostic area. | QA stops before test push or production push send unless a later approved notification task explicitly allows it. | QA process control, admin-only controls. | Not applicable. | Required. | HIGH | No actual push send. No push-cron call. No FCM changes. |

### App Version, Contact, And Policy Access

| Check item | Entry path | Expected result | Failure suspect area | Automatic check | Manual check | Risk | Forbidden area |
| --- | --- | --- | --- | --- | --- | --- | --- |
| App version is visible if exposed | Settings panel app info, app menu, Android app info if needed. | Operator can record app version or note that in-app version is not visible. | Settings app info, version display constant, package metadata. | Screenshot support only. | Required. | MEDIUM | No version or release setting edits. |
| Contact path is visible | `/privacy`, `/refund`, menu/policy pages, account deletion guidance. | User can find a support/contact route without copying hidden internal values from logs. | Policy copy, menu links, footer links. | Route reachability can be automated. | Required. | MEDIUM | Do not edit contact/policy content in this task. |
| Privacy policy opens | `/privacy` and links from footer/menu/settings where available. | Privacy page opens inside app WebView or safe in-app browser flow without losing navigation. | Policy route, WebView link handling, footer/menu links. | Route reachability can be automated. | Required. | MEDIUM | No policy route edits. |
| Terms open | `/terms` and links from footer/menu/settings where available. | Terms page opens cleanly and Android back returns to the previous app context. | Policy route, WebView history, footer/menu links. | Route reachability can be automated. | Required. | MEDIUM | No terms edits. |
| Refund/subscription policy opens | `/refund` and links from `/pro` or policy surfaces. | User can find Google Play subscription cancellation/refund guidance. | Refund route, pricing page links, WebView navigation. | Route reachability can be automated. | Required. | MEDIUM | No billing or policy edits. |
| Developer/business info need is identified | Settings/menu/policy surfaces. | If required information is missing or hard to find, record as follow-up candidate instead of editing now. | Store compliance content, policy copy, footer. | No. | Required judgment. | MEDIUM | No store listing, Play Console, or legal copy changes in this task. |
| External links are safe | Any mail, store, or external policy link if present. | Link opens predictably and Android back can return, or the limitation is recorded. | WebView external link handling, mail intent, browser handoff. | No. | Required if external link exists. | MEDIUM | No Android intent or native config edits. |

### Account And Settings 360px Mobile Check

| Check item | Entry path | Expected result | Failure suspect area | Automatic check | Manual check | Risk | Forbidden area |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Buttons are not clipped | Settings panel, `/account`, `/login`, `/account/delete`, `/privacy`, `/terms`, `/refund`. | Primary actions fit within 360px width and are not hidden by safe area or bottom navigation. | Responsive spacing, fixed widths, safe-area padding. | Screenshot support can help. | Required. | MEDIUM | No UI code edits in this checklist task. |
| Long email or nickname wraps safely | `/account`, header/auth status, settings account section. | Long identity text truncates or wraps without pushing buttons offscreen. | Account row layout, header auth chip, settings panel width. | Screenshot support with seeded account only. | Required with suitable account. | MEDIUM | No account data edits. |
| Policy/contact links are tappable | Settings/menu and policy pages. | Links have enough touch area and are not overlapped by navigation or sticky controls. | Link spacing, footer/menu layout, safe-area spacing. | Screenshot support can help. | Required. | MEDIUM | No policy UI edits in this task. |
| Modal or full-screen panel stays inside viewport | Header settings panel and any account confirmation panel. | Close/back controls remain reachable; content scrolls; no horizontal overflow. | Settings portal, safe-area CSS, sticky header. | Screenshot support can help. | Required. | MEDIUM | No app shell or CSS edits. |
| Back navigation remains predictable | Settings panel, `/account`, `/login`, policy pages. | Android back closes panel or returns to previous route without showing stale private state. | History state, auth state, WebView back stack. | No. | Required. | HIGH after login/logout. | No routing/auth code edits. |

### Account QA Hard Stops

- Stop before any real account deletion request, destructive submit, or production data mutation.
- Stop before any real payment attempt, purchase confirmation, product change, or entitlement modification.
- Stop before any real push send, push diagnostics send, push-cron call, or FCM configuration change.
- If a bug appears to require auth, Supabase, RLS, billing, RevenueCat, FCM, Android release, or production config changes, record it as a follow-up candidate and stop.

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
