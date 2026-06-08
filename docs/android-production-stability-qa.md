# Android Production Stability QA

## Scope Status

- Active run: `android-production-stability-qa-run`
- Latest completed task: `First actual QA batch selection`
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

## Billing And Subscription QA Checklist

Use this checklist for Android production billing QA planning only. This run does not execute a real purchase, does not execute a purchase restore, and does not change RevenueCat, Google Play Console, Supabase, RLS, auth, Android release settings, product IDs, plan IDs, entitlements, or prices.

### Billing Smoke Boundaries

| Boundary | Allowed in this run | Requires separate approved run |
| --- | --- | --- |
| `/pro` visibility | Open `/pro`, inspect product cards, current plan panel, CTA wording, Basic/Pro comparison, 360px layout. | None. |
| Logged-out purchase CTA | Document expected login guidance; click only in a future QA execution if the operator confirms it cannot open a real payment sheet. | Any click that can enter Google Play checkout. |
| Logged-in purchase CTA | Inspect button presence and wording only. | Opening Google Play payment sheet, completing purchase, cancelling inside the sheet, or validating billing callbacks. |
| Google Play purchase flow | Document prerequisites and failure suspects. | Tester account, license tester setup, approved payment test path, and separate run. |
| Purchase restore | Document entry path and expected states. | Any restore attempt, especially after reinstall or device change. |
| Entitlement verification | Compare visible plan labels if a known QA account already has state. | Editing Supabase, RevenueCat, entitlements, product mapping, or console settings. |

### Product And Price Display Reference

The operator should compare `/pro` against the current published product structure without changing any identifiers or prices.

| Product | Periods to verify on `/pro` | Current price expectation | Notes |
| --- | --- | --- | --- |
| Basic Radar | Free baseline | Free | Basic should remain useful and should not look broken. |
| Coin Pro | Monthly, yearly | 29,000 KRW monthly; 290,000 KRW yearly | Crypto criteria, risk, invalidation, alerts, repeated checks, and review continuity. |
| Global Pro | Monthly, yearly | 19,000 KRW monthly; 190,000 KRW yearly | Macro, asset, event, sector, index futures, and global-market context. |
| All Market Pro | Monthly, 6-month | 39,000 KRW monthly; 199,000 KRW for 6 months | Cross-market risk comparison, mixed alerts, and unified review. |

Hard rule: if price, product ID, plan ID, entitlement, renewal period, or displayed product family looks wrong, record the mismatch. Do not edit `billing.ts`, `mobilePurchases`, RevenueCat, Google Play Console, product IDs, plan IDs, entitlements, prices, checkout, sync, or grant logic inside this run.

### `/pro` Price And Product Display

| Check item | Entry path | Expected result | Failure suspect area | Automatic check | Manual check | Risk | Forbidden area |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/pro` route opens | Direct route `/pro`, plan CTA from gated areas, account current-plan link if present. | Pricing surface loads without fatal render error or blank state. | Pro page shell, pricing panel render, auth/profile loading, native purchase availability state. | Route reachability can be automated. | Required. | HIGH | No `/pro` code edits. |
| Basic versus Pro explanation is visible | `/pro`, `/pro?market=crypto`, `/pro?market=stocks`. | Basic is described as useful first-read support; Pro adds criteria, risk context, alerts, and review depth. | Pricing copy, plan comparison section, product filter state. | Screenshot support can help. | Required. | HIGH | No Basic/Pro gating or copy implementation changes in this task. |
| Product families are distinguishable | `/pro` all-market view and market-filtered views. | Coin Pro, Global Pro, and All Market Pro are visibly different and scoped to the right market workflow. | Plan filter, product card copy, display labels, plan ordering. | Screenshot support can help. | Required. | HIGH | No product ID, plan ID, or entitlement edits. |
| Current operating prices are visible | `/pro` product cards. | Monthly, yearly, and 6-month prices match the current published structure and do not contradict renewal text. | Billing model display, RevenueCat price label override, local display fallback, product card rendering. | Screenshot support can help. | Required. | HIGH | No price edits. No Google Play Console product edits. |
| CTA wording stays judgment-support oriented | `/pro` product cards and comparison panels. | CTA copy does not read as investment instruction, return guarantee, buy/sell signal, long/short prompt, or urgent market action. | CTA copy, product-card copy, trust notes. | No. | Required. | HIGH | No CTA code/copy edits in this checklist task. |
| Product identifiers are not exposed to users | `/pro`, account/settings plan display. | User-facing UI shows product names and plan scope, not internal IDs or legacy IDs. | Pricing panel display, current plan label, fallback error copy. | Screenshot support can help. | Required. | HIGH | No product ID, plan ID, entitlement, or label logic edits. |

### Purchase Button Visibility

| Check item | Entry path | Expected result | Failure suspect area | Automatic check | Manual check | Risk | Forbidden area |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Purchase buttons appear on plan cards | `/pro` while signed out and signed in. | Each paid plan card has a clear action, or a clear unavailable/loading state if native billing cannot be used. | Pricing panel state, native purchase availability, product load state, login state. | Screenshot support can help. | Required. | HIGH | No purchase code edits. |
| Logged-out purchase path guides login | Signed-out `/pro`; observe or, in a later execution task, test only the login-gate behavior before any payment sheet. | User is asked to log in before purchase entitlement can be attached to an account. | Login gate, checkout state, account/session readiness. | No. | Required. | HIGH | No auth, checkout, billing, or Supabase edits. |
| Logged-in button wording is clear | Signed-in `/pro`. | Buttons say what product or market scope the user is choosing and do not imply market action. | Product-card CTA copy, market filter, current plan state. | Screenshot support can help. | Required. | HIGH | No CTA or pricing implementation changes. |
| Safe smoke stop point is explicit | `/pro` during QA execution. | Tester stops before opening a real Google Play payment sheet unless a separate billing test run approves it. | QA process control. | Not applicable. | Required. | HIGH | No actual purchase attempt in this run. |
| Current-plan product button state is sensible | Known Basic and known Pro accounts if available. | Current plan is identified; unavailable or duplicate purchase states are explained without hiding other useful product context. | Current entitlement state, plan label mapping, product-card state. | Screenshot support can help. | Required with suitable account. | HIGH | No entitlement or RevenueCat edits. |

### Google Play Subscription Purchase Flow

| Check item | Entry path | Expected result | Failure suspect area | Automatic check | Manual check | Risk | Forbidden area |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Purchase prerequisites are known | Before any live billing QA. | Operator confirms production app install, signed-in QA account, Play Store account, approved tester status if testing purchase, and network state. | QA setup, tester enrollment, Play account mismatch. | No. | Required. | HIGH | No Google Play Console or tester changes in this run. |
| Google Play sheet entry condition is documented | Signed-in Android production app on `/pro`. | Payment sheet should only be opened in a separate approved run with test account and tester setup. | Billing client, RevenueCat configuration, Android package/signing, login/session. | No. | Required as checklist only. | HIGH | No real production checkout here. |
| Payment sheet missing failure suspects are clear | If future billing QA cannot open Google Play sheet. | Suspects include Play Console product status, RevenueCat product/offering/package mapping, Android package/signing, billing client state, login/session state, network, and product not available to account/region. | External product setup, native purchase bridge, session, network. | No. | Required if issue appears later. | HIGH | Do not fix by editing console/config/code in this run. |
| Cancel/back behavior is scoped | Future separate tester run only. | Cancelling from Google Play should return to `/pro` with a non-destructive message and no entitlement granted. | Native purchase error normalization, purchase cancel state, UI feedback. | No. | Separate run only. | HIGH | No purchase attempt or cancellation test in this run. |
| Purchase completion is out of scope | Future separate tester run only. | Real or tester purchase completion needs explicit approval, evidence capture, and entitlement verification plan. | RevenueCat, app-store sync, Supabase entitlement grant. | No. | Separate run only. | HIGH | No actual payment. No purchase completion. |

### Post-Purchase Plan Reflection

| Check item | Entry path | Expected result | Failure suspect area | Automatic check | Manual check | Risk | Forbidden area |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Success state expectation is documented | Future approved purchase test. | After successful purchase, `/pro` and `/account` should show the purchased plan scope or an understandable sync-in-progress state. | RevenueCat customer info, app-store sync API, entitlement refresh, profile cache. | No. | Separate run only. | HIGH | No RevenueCat, Supabase, RLS, or entitlement edits. |
| Basic to Pro transition is visible | Known test purchase or pre-provisioned test account. | Basic indicators update to Coin Pro, Global Pro, or All Market Pro where applicable. | Entitlement resolver, current-plan label, profile refresh, market-scope gating. | Screenshot support can help with pre-existing state. | Required only with suitable account. | HIGH | No entitlement mutation. |
| `/pro` and account/settings agree | `/pro`, `/account`, header/auth status, settings panel. | Same account shows consistent plan labels across surfaces after refresh/relaunch. | Current-plan display, profile cache, entitlement refresh event, local storage. | Screenshot support can help. | Required. | HIGH | No billing/profile writes. |
| Relaunch preserves entitlement | Future approved purchase or known Pro account. | After app force close/reopen, plan state remains consistent or clearly refreshes. | WebView storage, auth session, entitlement refresh, RevenueCat sync. | No. | Required with suitable account. | HIGH | No auth/session or entitlement code edits. |
| Delayed sync state is understandable | If plan does not immediately update after purchase in future run. | User sees a retry/restore/check state rather than contradictory Basic and Pro labels. | Sync endpoint, network, RevenueCat delay, profile refresh. | No. | Separate run only. | HIGH | Do not manually edit Supabase or RevenueCat to force state. |

### Purchase Restore

| Check item | Entry path | Expected result | Failure suspect area | Automatic check | Manual check | Risk | Forbidden area |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Restore entry is visible if supported | `/pro`, account/settings billing surfaces if present. | User can find restore purchase or entitlement refresh wording where appropriate. | Pricing panel restore control, native purchase availability, signed-in state. | Screenshot support can help. | Required. | HIGH | No restore code edits. |
| Restore success expectation is documented | Future approved restore test. | Existing Google Play subscription should reconnect to the signed-in account and update `/pro` and `/account`. | RevenueCat restore, app-store sync, account mismatch, entitlement resolver. | No. | Separate run only. | HIGH | No actual restore in this run. No RevenueCat/Supabase edits. |
| No-purchase restore state is understandable | Future approved restore test with account lacking purchases. | User sees a clear "no active subscription found" style state and remains on a safe screen. | Restore error copy, native bridge, sync API. | No. | Separate run only. | HIGH | No test restore execution now. |
| Device change or reinstall is considered | Future approved restore test after reinstall or different Android device. | Restore path should recover entitlement for the same Play account and app account, or explain mismatch. | Play account, RevenueCat app user ID, login account, sync endpoint. | No. | Separate run only. | HIGH | No reinstall/restore execution in this run. |
| Restore does not expose internal IDs | `/pro` restore result if observed later. | User-facing result names product scope, not product IDs, plan IDs, or entitlement IDs. | Error/result copy, mapping fallback. | No. | Required if restore is tested later. | HIGH | No identifier mapping edits. |

### Basic And Pro Gating Display

| Check item | Entry path | Expected result | Failure suspect area | Automatic check | Manual check | Risk | Forbidden area |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Basic gating remains useful | Basic account on `/coin`, `/crypto`, `/alts`, `/global`, `/alerts`, `/journal`, `/pro`. | Basic users can still understand the app, see first-read value, and know what Pro adds. | Route copy, usage gates, entitlement state, CTA placement. | Route and screenshot smoke can help. | Required. | HIGH | No gating rule changes. |
| Coin Pro gates match crypto context | Crypto and alt routes, crypto alert surfaces, `/pro?market=crypto`. | Locked/limited crypto details point to Coin Pro or All Market Pro in context. | Crypto entitlement mapping, route CTA copy, usage limits. | Limited screenshot support. | Required. | HIGH | No entitlement or billing edits. |
| Global Pro gates match global context | `/global`, `/global/assets`, global alert surfaces, `/pro?market=stocks`. | Locked/limited global details point to Global Pro or All Market Pro in context. | Global entitlement mapping, route CTA copy, usage limits. | Limited screenshot support. | Required. | HIGH | No stock/global entitlement edits. |
| All Market Pro reads as combined workflow | `/pro`, mixed-market alert/review contexts if visible. | All Market Pro is presented as cross-market risk comparison, mixed alerts, and unified review, not only a discount. | Bundle copy, plan card presentation, CTA placement. | Screenshot support can help. | Required. | MEDIUM | No bundle product/plan/entitlement edits. |
| Pro CTA is contextual, not coercive | Gated surfaces and `/pro`. | CTA appears near missing depth and avoids urgency, profit, loss-avoidance, buy/sell, long/short, or asset-pick wording. | CTA copy, gate copy, plan-card copy. | No. | Required. | HIGH | No copy implementation changes in this checklist task. |
| Gating does not make app unusable | Basic account on primary routes. | User can still navigate, read available context, and understand next checks without paying. | Over-gating, blank states, missing Basic fallback. | Route smoke can help. | Required. | HIGH | No gating weakening or strengthening in this run. |

### Subscription State Exceptions

| Check item | Entry path | Expected result | Failure suspect area | Automatic check | Manual check | Risk | Forbidden area |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Expired subscription state | Known expired tester account, future separate run. | App shows Basic or restore-needed state clearly without pretending Pro is active. | RevenueCat expiration, profile stale state, sync endpoint, entitlement resolver. | No. | Separate run only. | HIGH | No manual entitlement edits. |
| Purchase cancelled state | Future approved purchase-cancel test. | App stays on `/pro`, no entitlement is granted, and message is not alarming. | Native purchase cancel handling, checkout state. | No. | Separate run only. | HIGH | No purchase/cancel test in this run. |
| Payment failed or interrupted state | Future approved tester run or naturally observed failure. | User gets retryable guidance and no false Pro access. | RevenueCat purchase error, billing client, network, sync endpoint. | No. | Separate run only. | HIGH | No real payment attempt. |
| Network failure during product load | `/pro` under naturally poor network or future controlled QA. | Product loading delay or failure copy explains retry/network/Play account context without crashing. | RevenueCat product fetch, timeout handling, pricing fallback. | Route smoke may catch fatal errors only. | Required if safely reproducible. | HIGH | No config edits to simulate. |
| RevenueCat response delay | `/pro` Android production app. | User sees understandable loading or delayed product state; buttons do not enter broken purchase path. | RevenueCat SDK, product fetch timeout, native purchase availability. | No. | Required if observed. | HIGH | No RevenueCat config edits. |
| Relaunch mismatch | After login, known plan state, or future approved purchase/restore. | App resolves to one consistent plan state after refresh/relaunch, or gives a clear sync/restore path. | Auth session, profile cache, RevenueCat, app-store sync. | No. | Required with suitable account. | HIGH | No Supabase/RevenueCat edits. |
| Play Store and app plan mismatch | Future approved billing QA with Play subscription evidence. | Mismatch is recorded with screenshots and not "fixed" by direct production mutation. | Play subscription status, RevenueCat mapping, sync endpoint, account mismatch. | No. | Separate run only. | HIGH | No console, product, entitlement, or database changes. |

### Billing And Subscription 360px Mobile Check

| Check item | Entry path | Expected result | Failure suspect area | Automatic check | Manual check | Risk | Forbidden area |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Price cards are not clipped | `/pro` at 360px and market-filtered variants. | Product cards fit width, scroll vertically, and do not create horizontal overflow. | Plan card layout, price row width, badge/chip wrapping. | Screenshot support can help. | Required. | MEDIUM | No UI code edits in this checklist task. |
| Long product descriptions stay readable | `/pro` plan cards and comparison sections. | Descriptions wrap cleanly and do not push buttons into unsafe or hidden positions. | Card typography, line length, section spacing. | Screenshot support can help. | Required. | MEDIUM | No copy/layout edits here. |
| CTA buttons avoid bottom overlap | `/pro` on Android production app. | Purchase and restore buttons are tappable and not covered by bottom navigation or safe area. | Safe-area padding, bottom nav overlap, sticky controls. | Screenshot support can help. | Required. | HIGH | No safe-area/native edits. |
| Monthly/yearly/6-month pricing is unambiguous | `/pro` plan cards. | Period labels and renewal text do not make monthly, yearly, or 6-month products look interchangeable. | Price label rendering, period label, renewal copy. | Screenshot support can help. | Required. | HIGH | No price/period edits. |
| Restore and caution text are readable | `/pro` lower sections and any restore state. | Restore link/button and subscription cautions are visible, readable, and tappable at 360px. | Restore control placement, trust notes, mobile spacing. | Screenshot support can help. | Required. | HIGH | No restore logic edits. |

### Billing QA Hard Stops

- Do not execute a real payment, real Google Play checkout, real purchase restore, or real subscription cancellation inside this run.
- Do not change `src/lib/billing.ts`, `src/lib/mobilePurchases.ts`, RevenueCat, Google Play Console products, product IDs, plan IDs, entitlements, prices, auth, Supabase, RLS, Android release settings, checkout, sync, grant, or entitlement-resolution logic.
- If actual purchase or restore validation is required, create a separate run with an approved test account, license tester setup, evidence plan, and explicit stop conditions.
- If a mismatch appears between Google Play, RevenueCat, Supabase, and app UI, record evidence and stop before mutating any external system.

## Notification QA Checklist

Use this checklist for Android production notification QA planning only. This run does not send real push notifications, does not call production push-cron in send mode, does not manually insert or delete push tokens, and does not change FCM, Supabase, RLS, auth, entitlement, RevenueCat, billing, Android release settings, or production DB state.

### Notification Smoke Boundaries

| Boundary | Safe in this run | Requires separate approved run |
| --- | --- | --- |
| Permission and settings review | Inspect Android permission prompts, denied/granted states, in-app status rows, alert settings, Pro limits, `/alerts` entry, and 360px layout. | Reset device permission state only when the QA device and account are approved for that manual pass. |
| Push token readiness | Observe user-facing readiness or approved non-sensitive diagnostics without printing raw token values. | Any direct production DB query, token inspection, token insertion, token deletion, or server-side mutation. |
| Push delivery and click routing | Document expected `targetPath` behavior and inspect list-item navigation where visible. | Real push send, test push send, push notification tap test, or production `push-cron` send-mode invocation. |
| Duplicate and cooldown review | Review visible alert repetition risk and record suspected quality issues. | Any change to scanner thresholds, duplicate guards, cooldown rules, targetPath payloads, FCM, Supabase, or push-cron. |

### Notification Permission Request

| Check item | Entry path | Expected result | Failure suspect area | Automatic check | Manual check | Risk | Forbidden area |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Permission prompt appears from a relevant user path | First Android app entry if notification onboarding appears, `/alerts`, `/crypto/alert`, global alert entry, settings/account notification entry. | User can reach a permission request or a clear state explaining why alerts need permission. | Android permission bridge, app notification onboarding, alert settings shell, route state. | Route reachability can help only. | Required. | HIGH | No Android permission config, FCM, or app code edits. |
| Permission allowed state is understandable | Android OS prompt, then return to alert settings or current route. | App shows notification-ready or enabled state without requiring another unclear action. | Permission state sync, WebView/native bridge, push registration state, UI refresh. | No. | Required. | HIGH | No real push send. No token edits. |
| Permission denied state gives recovery path | Deny the OS prompt on an approved QA device or observe existing denied state. | App explains that alerts are blocked and points to settings or a retry path when available. | Denied-state copy, Android app settings deep link, permission-state cache. | No. | Required. | HIGH | No native setting edits. No forced permission changes in code. |
| OS permission and in-app status agree | Android app notification settings and in-app notification status. | OS-level blocked/allowed state does not contradict the app's displayed alert state. | Native bridge, cached permission state, WebView reload timing, OS notification state. | No. | Required. | HIGH | No production config or Android release edits. |
| Real push remains out of scope | Any permission review path. | QA stops after permission and state display checks; no notification is sent to prove delivery. | QA process control. | Not applicable. | Required. | HIGH | No FCM send, test push, or production push-cron send-mode call. |

### Push Token Storage

| Check item | Entry path | Expected result | Failure suspect area | Automatic check | Manual check | Risk | Forbidden area |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Logged-out token expectation is clear | Signed-out app, alert settings, `/alerts`. | App does not imply account-attached alert delivery is ready before login; login requirement is understandable if token/account binding is needed. | Session state, account gate, push registration copy, alert settings state. | No. | Required. | HIGH | No auth, Supabase, or token handling edits. |
| Logged-in token readiness is visible without exposing token value | Signed-in QA account with permission allowed, alert settings or approved diagnostics surface. | User-facing state indicates alerts are ready, pending, denied, or unavailable without printing raw token strings. | FCM initialization, Supabase save, session state, Android permission state, network. | Existing non-mutating diagnostics may support only if already safe and approved. | Required. | HIGH | No raw token logging. No direct production DB token inspection. |
| Token save failure suspects are recorded | If alert readiness stays failed or pending. | Suspects are narrowed to FCM initialization, Supabase storage, login/session state, Android permission state, or network state. | FCM, Supabase, auth session, Android permission, network. | No. | Required if failure appears. | HIGH | No FCM/Supabase/code changes in this run. |
| Token values are not mutated manually | Any token-related investigation. | Operator records visible symptoms and stops before token insertion, deletion, or direct production mutation. | QA process control. | Not applicable. | Required. | HIGH | No production DB edits. No token insert/delete. |
| Token renewal is considered as a later case | App reinstall, device change, force-close/relaunch, long-lived session. | Checklist records that token refresh or rebinding may need a separate approved execution pass. | Token refresh listener, session binding, Supabase save, network delay. | No. | Separate run if needed. | HIGH | No manual token rotation or backend mutation. |

### Notification Settings Screen

| Check item | Entry path | Expected result | Failure suspect area | Automatic check | Manual check | Risk | Forbidden area |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Alert settings are reachable | `/alerts`, `/crypto/alert`, global alert entry, header or settings/account notification link. | User can find alert settings without relying on hidden admin-only paths. | Route mapping, settings panel links, market-specific alert page, navigation shell. | Route reachability can help. | Required. | HIGH | No route or navigation code edits. |
| Permission state is displayed | Alert settings screen after allowed, denied, or not-yet-requested state. | The screen clearly distinguishes allowed, denied, pending, and unavailable notification states. | Permission bridge, copy, cached app push state. | No. | Required. | HIGH | No permission logic edits. |
| Alert on/off state is visible | Alert settings screen for a known QA account. | User can tell whether alerts are enabled, disabled, or blocked by plan/permission. | Alert preference state, profile/session load, save feedback. | Screenshot support can help. | Required. | HIGH | No production preference mutation unless separately approved. |
| Market or type settings are understandable if present | Crypto, global, mixed-market alert settings if visible. | Market/type choices are labeled clearly and do not expose internal IDs or scanner names. | Alert rule display, market filter, product scope copy. | Screenshot support can help. | Required. | MEDIUM | No scanner, threshold, or alert-rule edits. |
| Settings-change persistence is scoped | Any toggle or selector on alert settings. | If a setting change would persist to production, the test is either observation-only or moved to a separate approved run with a QA account. | QA process control, preference save API, Supabase state. | Not applicable. | Required. | HIGH | No unapproved production settings changes. |

### Pro Notification Limits

| Check item | Entry path | Expected result | Failure suspect area | Automatic check | Manual check | Risk | Forbidden area |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Basic alert limits are clear | Basic account on `/alerts`, `/crypto/alert`, global alert surfaces, settings notification entry. | Basic users understand which alerts are available, limited, or Pro-only. | Entitlement state, alert limit copy, settings gate, plan label mapping. | Screenshot support can help. | Required. | HIGH | No entitlement, RevenueCat, Supabase, or billing edits. |
| Coin Pro alert scope is contextual | Crypto alert surfaces and `/pro?market=crypto` links if present. | Crypto alert limits point to Coin Pro or All Market Pro where appropriate. | Crypto entitlement mapping, CTA target, product-family copy. | Limited screenshot support. | Required. | HIGH | No plan ID, entitlement, or gating changes. |
| Global Pro alert scope is contextual | Global alert surfaces and `/pro?market=stocks` links if present. | Global alert limits point to Global Pro or All Market Pro where appropriate. | Global entitlement mapping, CTA target, product-family copy. | Limited screenshot support. | Required. | HIGH | No product or entitlement edits. |
| All Market Pro alert scope is understandable | Mixed-market or cross-market alert surfaces if visible. | All Market Pro reads as combined market alert coverage, not a vague upgrade. | Bundle copy, plan mapping, mixed alert gate. | Screenshot support can help. | Required if visible. | MEDIUM | No billing or gating implementation changes. |
| Basic users can still use the app | Basic account on alert and primary routes. | Alert limitations do not make ChartRadar feel unusable; available context remains understandable. | Over-gating, empty-state copy, CTA placement, disabled controls. | Route and screenshot smoke can help. | Required. | HIGH | No gating weakening or strengthening in this checklist task. |

### Notification List Display

| Check item | Entry path | Expected result | Failure suspect area | Automatic check | Manual check | Risk | Forbidden area |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/alerts` route opens | Direct route `/alerts`, bottom/top navigation, notification settings entry. | Alerts surface loads without a blank screen or fatal route error. | Route shell, market redirect, alert center render, auth state. | Route reachability can be automated. | Required. | HIGH | No route code edits. |
| Empty list state is useful | QA account with no visible alerts or no recent matches. | Empty state explains whether alerts are unavailable, not configured, permission-blocked, or simply quiet. | Empty-state copy, alert data load, permission state, plan gate. | Screenshot support can help. | Required. | HIGH | No data or push generation changes. |
| Existing alert or recent-match rows are readable | Account/state where alert rows, preset rows, diagnostics, or recent matches are visible. | Title, body, time, market/type, and status labels are readable and scoped to the right market. | Alert list rendering, market label mapping, timestamp formatting, server response. | Screenshot support can help. | Required if rows exist. | HIGH | No production data edits. No token or push send. |
| Notification copy remains judgment-support oriented | Alert title/body, list rows, preview copy, Pro limit copy. | Copy avoids buy, sell, long, short, guaranteed return, urgent entry, or profit-guarantee framing. | Alert template copy, scanner labels, UI display copy. | No. | Required. | HIGH | No copy or scanner edits in this run. |
| Long alert text works at 360px | `/alerts` and market-specific alert pages at 360px. | Long titles and bodies wrap without clipping controls or hiding timestamps. | Alert card layout, line clamp, badge width, safe-area spacing. | Screenshot support can help. | Required. | MEDIUM | No UI code edits in this checklist task. |

### Notification targetPath Navigation

| Check item | Entry path | Expected result | Failure suspect area | Automatic check | Manual check | Risk | Forbidden area |
| --- | --- | --- | --- | --- | --- | --- | --- |
| List-item navigation expectation is documented | Alert rows or recent-match rows where a route link is visible. | Tapping a visible item opens the intended in-app route or a safe detail/fallback route. | Route mapping, target path construction, market-specific navigation, client router. | Route smoke may support destination reachability. | Required if clickable rows exist. | HIGH | No targetPath or routing logic edits. |
| Push notification tap expectation is documented | Future approved push-click QA only. | Tapping a received notification should open the Android app and route to its `targetPath` when present. | App push listener, payload `targetPath`, WebView routing, notification payload construction. | No. | Separate run if real push is needed. | HIGH | No real push send in this run. No payload code edits. |
| Missing targetPath fallback is defined | Future notification payload or visible alert lacking a path. | App should open a safe default alerts or market screen instead of crashing or landing on a blank route. | Fallback routing, payload normalization, default route selection. | No. | Separate run or observation only. | HIGH | No fallback logic edits here. |
| Login-required target is handled safely | Future notification path to account-gated or Pro-gated screen. | User is guided through login or gating and then lands on a safe route; previous account data is not exposed. | Auth gate, redirect state, entitlement gate, cached route state. | No. | Separate run with QA account. | HIGH | No auth or entitlement edits. |
| Unknown or stale targetPath does not trap the user | Future payload or manually observed stale route link. | App shows a safe fallback, navigation recovery, or route-not-found state without a loop. | Route registry, redirect logic, payload versioning, client router. | Route smoke can test known routes only. | Separate run if needed. | HIGH | No targetPath mutation or route edits in this checklist task. |

### Duplicate And Cooldown Review

| Check item | Entry path | Expected result | Failure suspect area | Automatic check | Manual check | Risk | Forbidden area |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Repeated same-signal risk is reviewed | `/alerts`, visible recent matches, approved no-send diagnostics if separately allowed. | Same signal does not appear to spam the user in the visible list or operator evidence. | Duplicate guard, alert event key, cooldown window, scanner family grouping. | Existing dry-run diagnostics may support in a separate approved no-send check. | Required if repeated rows appear. | HIGH | No duplicate guard or cooldown logic edits. |
| Same market/type repetition is understandable | Market-specific alert surfaces and recent activity. | Repeated market/type alerts have clear time separation, status, or reason. | Scanner grouping, market/type labels, cooldown criteria, event timestamps. | No. | Required if visible. | HIGH | No threshold, scanner, or push-cron edits. |
| User fatigue criteria are recorded | Any alert review evidence. | Excessive frequency or low-value repetition is logged as a quality issue, not fixed in this run. | Alert thresholds, cooldown policy, message templates, market volatility handling. | No. | Required. | HIGH | No alert-quality logic edits here. |
| Follow-up run boundary is explicit | If duplicate/cooldown issue is suspected. | Create or propose an `alert-quality-operations-run` candidate with evidence and no production mutation. | Run planning and issue triage. | Not applicable. | Required if issue appears. | MEDIUM | No production push, DB, scanner, or FCM changes. |

### Notification Exception Cases

| Check item | Entry path | Expected result | Failure suspect area | Automatic check | Manual check | Risk | Forbidden area |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Network failure or slow response | Alert settings, `/alerts`, permission or token readiness state under naturally poor network. | App shows pending, retry, or unavailable state without crashing or implying alerts are active when they are not. | Network timeout, Supabase response, FCM initialization, UI loading state. | Route smoke catches fatal render only. | Required if safely observable. | HIGH | No network/config changes to force production state. |
| Permission denied | Android denied notification state. | Alert UI explains the block and gives a recovery path if available. | Permission bridge, denied-state copy, settings deep link. | No. | Required. | HIGH | No permission code edits. |
| Logged-out state | Signed-out `/alerts` and alert settings entry. | User sees login requirement or limited state without account-specific alert data exposure. | Auth state, alert query gating, cached account state. | Route reachability can help. | Required. | HIGH | No auth, Supabase, or cached-session edits. |
| App reinstall or device change | Future approved device pass only. | App should require login, permission, and token refresh as needed, without stale device assumptions. | Token refresh, session restore, permission state, account binding. | No. | Separate run if needed. | HIGH | No token mutation or backend edits. |
| Force close and relaunch | Android app after permission/settings observation. | Notification settings and displayed readiness return to a consistent state after relaunch. | Local cache, session restore, permission refresh, app push state refresh. | No. | Required if safe to execute. | HIGH | No app lifecycle or native code edits. |
| Token expiry or renewal need | Long-lived account or future device pass. | Renewal need is logged as a follow-up if readiness becomes stale. | FCM token refresh, Supabase save, session binding. | No. | Separate run if needed. | HIGH | No manual token rotation, insertion, or deletion. |
| Supabase or FCM delay | Alert readiness remains pending or delayed. | User-facing UI remains stable and issue evidence is recorded without forcing state. | Supabase latency, FCM latency, retry timing, network. | No. | Required if observed. | HIGH | No Supabase/FCM console or DB changes. |

### Notification 360px Mobile Check

| Check item | Entry path | Expected result | Failure suspect area | Automatic check | Manual check | Risk | Forbidden area |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Alert cards and lists fit width | `/alerts`, `/crypto/alert`, global alert pages at 360px. | Cards, rows, badges, and timestamps do not create horizontal overflow or clipped controls. | Alert card layout, badge width, timestamp text, list container. | Screenshot support can help. | Required. | MEDIUM | No UI code edits in this checklist task. |
| Long title and body wrap cleanly | Visible alert rows, preset rows, permission copy, Pro limit copy. | Long Korean or English text wraps without overlapping buttons or hiding market labels. | Typography, line clamp, card spacing, chip wrapping. | Screenshot support can help. | Required. | MEDIUM | No copy/layout edits here. |
| Settings actions avoid bottom navigation overlap | Alert settings lower area and sticky/bottom controls. | Toggle rows, save buttons, permission buttons, and Pro CTAs remain tappable above bottom navigation and safe area. | Safe-area padding, sticky controls, bottom nav, scroll container height. | Screenshot support can help. | Required. | HIGH | No safe-area/native edits. |
| Permission guidance is readable | Denied, unavailable, pending, and allowed states at 360px. | Guidance can be read without opening a hidden panel or rotating the device. | Status-row copy, icon/button alignment, alert settings layout. | Screenshot support can help. | Required. | HIGH | No permission UI implementation changes. |
| Pro CTA does not crowd the alert workflow | Basic account with Pro alert limits at 360px. | CTA is visible and contextual but does not push the available alert state out of view. | Gate layout, CTA placement, plan-card copy, scroll spacing. | Screenshot support can help. | Required. | HIGH | No Pro gating or CTA implementation changes. |

### Notification QA Hard Stops

- Do not send real push notifications, admin test pushes, or production push-cron send-mode requests inside this run.
- Do not manually insert, delete, rotate, copy, print, or expose push tokens.
- Do not edit FCM, push-cron, push alert scanner, targetPath construction, duplicate guards, cooldown rules, Supabase, RLS, production DB records, auth, entitlement, RevenueCat, billing, or Android release settings.
- If delivery, token storage, duplicate prevention, cooldown behavior, or targetPath routing requires live validation, create a separate approved run with a dedicated QA account, no-secret evidence plan, and explicit stop conditions.
- If alert quality issues appear, record evidence and split them into an `alert-quality-operations-run` candidate instead of fixing notification logic here.

## First Actual QA Execution Candidates

Recommended next active-run: `android-production-qa-execution-run`.

The first execution run should begin with non-mutating checks that have high user impact and low recovery risk. It should not include real payment, purchase restore, account deletion, push delivery, push token mutation, production DB inspection/mutation, or external console configuration changes.

### Recommended Execution Order

| Order | QA bundle | Main scope | Check type | Risk | Why first | Hard stop |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Browser/mobile viewport smoke | `/coin`, `/crypto`, `/alts`, `/global`, `/alerts`, `/journal`, `/pro`, settings/account screens, 360px viewport. | Automatic smoke plus manual screenshot review. | LOW | Finds broken routes, layout overflow, blank states, loading/error regressions, navigation traps, and first-viewport issues without touching production data. | No app code edits, no production data changes, no destructive account/billing/push actions. |
| 2 | Android actual-device first-entry smoke | Google Play production install, first app launch, first visible route, top/bottom navigation, key screen moves, Android back, app relaunch. | Manual device check. | LOW-MEDIUM | Confirms the shipped Android production app is usable on a real device before testing account, billing, or notification state. | No Play Console release edits, no Android native edits, no production config changes. |
| 3 | Login smoke | Google login CTA, account picker entry, cancel stability, successful login state, post-login return path, session after relaunch, logout state. | Manual device check. | MEDIUM | Login affects plan display, alerts, journal, and settings, but can be checked with a dedicated QA account without production data mutation. | No auth code edits, no Supabase edits, no account deletion. |
| 4 | `/pro` pre-purchase smoke | `/pro` entry, Basic/Pro comparison, Coin Pro/Global Pro/All Market Pro cards, prices, CTA copy, login before purchase, purchase button visibility before checkout. | Manual device check with screenshot support. | MEDIUM-HIGH | Verifies monetization presentation before any billing action and catches product-copy or mobile layout issues early. | Do not enter Google Play checkout, do not execute purchase, do not restore purchase, do not edit billing/RevenueCat/Google Play. |
| 5 | Notification permission/settings smoke | `/alerts`, `/crypto/alert`, global alert entry, empty/existing list state, notification settings entry, permission status, Pro alert limits, 360px alert layout. | Manual device check with route/screenshot support. | MEDIUM-HIGH | Alerts are user-visible and high-risk, but screen/permission/status review can run without sending push or touching tokens. | No real push send, no admin test push, no push-cron send-mode, no token insert/delete, no Supabase/FCM console edits. |
| 6 | Play Console health read-only review | Production crash rate, ANR rate, Android vitals, recent release warnings, user-visible issue alerts. | Manual console review only. | MEDIUM-HIGH | Confirms production health signals after user-path smoke without changing release state. | Read-only only; no rollout, release, store listing, country/region, tester, product, or policy changes. |

### Automatic Smoke Candidates

| Candidate | Scope | Expected evidence | Risk | Include in first run |
| --- | --- | --- | --- | --- |
| Route reachability smoke | `/coin`, `/crypto`, `/alts`, `/global`, `/alerts`, `/journal`, `/pro`, settings/account routes if existing scripts support them. | Command output or route list showing pass/fail without production mutation. | LOW | Yes. |
| 360px mobile viewport smoke | Same core routes, especially first viewport, bottom navigation, Pro cards, alert settings, and account/settings panels. | Screenshot set or smoke output with noted overflow/blank-state findings. | LOW | Yes. |
| Static docs/worktree safety checks | `git diff --check`, docs-only confirmation, sensitive-value pattern check for QA documentation commits. | Pass/fail command output. | LOW | Yes for documentation changes. |
| Existing non-mutating diagnostics | Only diagnostics that are already known to avoid sends or writes, and only if separately approved for the execution run. | No-secret summary counts or safe UI-visible state. | MEDIUM | Optional; not required for the first browser/device smoke bundle. |

### Manual Device Confirmation Candidates

| Candidate | Scope | Expected evidence | Risk | Include in first run |
| --- | --- | --- | --- | --- |
| Android production first launch | Install/open from Google Play production app, first route, loading state, first navigation. | Device, Android version, app version, screenshots or screen recording. | LOW-MEDIUM | Yes. |
| Navigation and relaunch | Top/bottom navigation, Android back, refresh/reopen, app force-close and relaunch where safe. | Screen recording or concise route result table. | LOW-MEDIUM | Yes. |
| Google login cancel and success smoke | Login CTA, Google account picker, cancel path, successful login with QA account, session after relaunch, logout. | Screenshots/recording; no credentials or tokens. | MEDIUM | Yes, after route/device smoke. |
| `/pro` pre-checkout review | Product cards, prices, plan labels, CTAs, signed-out versus signed-in button state before checkout. | Screenshots; no checkout sheet entry. | MEDIUM-HIGH | Yes, but stop before Google Play checkout. |
| Alert permission/settings review | `/alerts`, settings entry, permission status, Pro limit copy, empty/list state, 360px layout. | Screenshots/recording; no push send and no raw token evidence. | MEDIUM-HIGH | Yes, after login smoke if account state is needed. |
| Play Console health read-only | Crash, ANR, Android vitals, recent warnings, production issue alerts. | Read-only notes and screenshots without changing console state. | MEDIUM-HIGH | Yes, after user-path smoke. |

### Separate Approval Required

| Separate run candidate | Reason to separate | Required guardrails |
| --- | --- | --- |
| Actual Google Play purchase test | Opens or completes billing flow and can create real subscription/account state. | Dedicated tester account, license tester setup, evidence plan, explicit stop points, no product/config edits without approval. |
| Purchase restore test | Can mutate entitlement/account state and may depend on historical Play purchases. | Dedicated account, known purchase history, restore-only plan, no RevenueCat/Supabase manual fixes. |
| Actual account deletion test | Destructive account operation. | Disposable QA account, deletion evidence plan, explicit approval, no real customer account. |
| Real push delivery or push-click test | Sends notification and can affect device/account state. | Dedicated QA device/account, no production push-cron send-mode unless explicitly approved, no token exposure. |
| Production DB or push token inspection/mutation | High risk for secrets, privacy, account state, and production data integrity. | Separate approved run, read/minimize plan, no manual token insert/delete unless explicitly approved. |
| RevenueCat, Google Play Console, FCM, Supabase, or Android release changes | External service or release configuration mutation. | Separate implementation or release-ops run with approval and rollback/verification plan. |

### Proposed Next Active Runs

| Candidate run | Purpose | First task suggestion | Risk |
| --- | --- | --- | --- |
| `android-production-qa-execution-run` | Execute the safe first QA sequence selected above. | Browser/mobile viewport smoke for core routes and 360px screenshots. | LOW |
| `android-production-auth-device-qa-run` | Isolate Google login, session persistence, logout, and account settings if the first execution run finds account-state uncertainty. | Google login cancel/success smoke on Android production app. | MEDIUM |
| `android-production-billing-test-run` | Separately validate Google Play purchase/restore with approved tester setup. | Confirm tester account, product availability, and strict stop conditions before opening checkout. | HIGH |
| `android-production-notification-delivery-run` | Separately validate real push delivery, push-click `targetPath`, and token refresh if screen-only alert QA is insufficient. | Confirm QA device/account, no-secret evidence plan, and approved send path. | HIGH |
| `alert-quality-operations-run` | Investigate duplicate/cooldown/frequency issues without changing signal definitions casually. | Review no-send diagnostics and visible alert repetition evidence. | HIGH |

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
