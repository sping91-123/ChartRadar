# Android Production Manual QA Checklist

## Scope

- Active run: `android-production-qa-execution-run`
- Source execution doc: [Android Production QA Execution](../android-production-qa-execution.md)
- Source stability checklist: [Android Production Stability QA](../android-production-stability-qa.md)
- Checklist status: prepared only; actual manual QA has not been executed.

This checklist is for the Android production app installed from Google Play. It is designed for an operator to follow on a real phone. It does not authorize app code changes, UI changes, smoke script changes, production data changes, actual payment, purchase restore, account deletion, real push send, token lookup/mutation, Android release changes, or external console changes.

Allowed statuses:

- `NOT_RUN`: planned manual check that has not been executed.
- `PASS`: checked and met expectation.
- `FAIL`: checked and did not meet expectation.
- `BLOCKED`: could not be checked because a prerequisite, access issue, or guardrail stopped it.
- `NEEDS_RUN`: requires a separate approved run.

## Operator Preflight

Complete these before starting manual QA. Do not continue if the device/account setup would require production mutation.

| QA ID | Check item | Prerequisites | Steps | Expected result | Failure record | Failure suspect area | Risk | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P-001 | QA device identity | Android phone available. | Record device model and Android OS version. | Device and OS version are known before evidence capture. | Device model, OS version, and missing info. | QA setup. | LOW | `NOT_RUN` |
| P-002 | Production install source | Google Play access. | Confirm app is installed or updated from Google Play production, not a debug/local build. | Install source is production Play Store. | Play Store page, installed version, screenshot if unclear. | Play Store install state, tester enrollment, account cache. | LOW-MEDIUM | `NOT_RUN` |
| P-003 | App version evidence | App or Play Store version is visible. | Record app version from the app, settings page, or Play Store. | Version is recorded before route checks. | Version source and screenshot. | App settings display, Play Store metadata. | LOW | `NOT_RUN` |
| P-004 | QA account readiness | Dedicated QA Google account. | Confirm account is suitable for login checks and does not belong to a real customer. | Manual login checks can run without real customer data exposure. | Account state without private email/token values. | QA account setup, Google account availability. | MEDIUM | `NOT_RUN` |
| P-005 | Evidence safety | Screenshot or recording plan. | Confirm evidence will not expose credentials, private account identifiers, raw tokens, payment details, or service keys. | Evidence capture is safe and redacted where needed. | Evidence type and redaction note. | QA process, privacy handling. | HIGH | `NOT_RUN` |

## 1. Play Store Production First Launch

| QA ID | Check item | Prerequisites | Steps | Expected result | Failure record | Failure suspect area | Risk | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M-001 | Install or update production app | Preflight complete; Play Store available. | Open Play Store, find ChartRadar, install or update if needed. | App installs or is already up to date as production app. | Device name, OS version, app version, Play Store state, screenshot. | Play Store availability, account/tester state, production rollout, device compatibility. | LOW-MEDIUM | `NOT_RUN` |
| M-002 | First launch | Production app installed. | Launch the app from icon or Play Store Open button. | App opens without crash and shows splash/loading/content. | Device/OS/app version, screen capture, crash/blank step. | App startup, WebView shell, network, production route boot. | LOW-MEDIUM | `NOT_RUN` |
| M-003 | First screen after loading | App launched. | Wait for splash/loading to settle; record first visible screen. | First route is stable, readable, and not trapped in blank/loading forever. | First route, elapsed wait, screenshot/recording. | Initial route, data loading, auth restore, network response. | MEDIUM | `NOT_RUN` |

## 2. Android Navigation, Back, And Relaunch

| QA ID | Check item | Prerequisites | Steps | Expected result | Failure record | Failure suspect area | Risk | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M-010 | Primary navigation map | App open on stable route. | Identify bottom/top navigation and settings/account entry. | Navigation controls are visible and not hidden by safe area. | Screenshot, route, control that is hidden or clipped. | App shell, safe-area spacing, bottom navigation, header menu. | MEDIUM | `NOT_RUN` |
| M-011 | Open `/coin` | Navigation available. | Navigate to Coin screen. | Coin screen opens with readable first viewport. | Route, screenshot, blank/loading/error state. | Coin route, decision summary, data loading. | MEDIUM | `NOT_RUN` |
| M-012 | Open `/crypto` | Navigation available. | Navigate to Crypto screen. | Crypto screen opens with usable content or clear loading/empty/error state. | Route, screenshot, account state. | Crypto route shell, market data, chart rendering, Basic/Pro gating. | MEDIUM | `NOT_RUN` |
| M-013 | Open `/alts` | Navigation available. | Navigate to Alts screen. | Alts screen opens and risk/strength context is readable. | Route, screenshot, gating or blank state. | Alts route, list/card layout, data availability. | MEDIUM | `NOT_RUN` |
| M-014 | Open `/global` | Navigation available. | Navigate to Global screen. | Global screen opens and first-read market context is understandable. | Route, screenshot, loading/empty/error state. | Global route, macro/global data, CTA placement. | MEDIUM | `NOT_RUN` |
| M-015 | Open `/alerts` | Navigation available. | Navigate to Alerts screen. | Alerts screen opens without requiring push send. | Route, screenshot, permission/list state. | Alert UI, permission bridge, plan gating. | HIGH | `NOT_RUN` |
| M-016 | Open `/journal` | Navigation available. | Navigate to Journal screen. | Journal screen opens with clear empty/list state without unwanted data creation. | Route, screenshot, account state. | Journal route, persistence state, auth state. | MEDIUM | `NOT_RUN` |
| M-017 | Open `/pro` | Navigation available. | Navigate to Pro screen. | Pro screen opens and purchase-related controls are visible before checkout. | Route, screenshot, plan state. | Pro pricing panel, product display, current-plan state. | MEDIUM-HIGH | `NOT_RUN` |
| M-018 | Open settings/account | Navigation available. | Open settings/account screen or panel. | Account/settings controls are reachable and readable. | Entry path, screenshot, missing control. | Settings route, account panel, auth state. | MEDIUM | `NOT_RUN` |
| M-019 | Android back behavior | At least three routes visited. | Press Android back from core and nested/settings routes. | App returns to previous safe screen or exits predictably without loop or stale account exposure. | Start route, target route, back result, screenshot/recording. | Client router, WebView history, modal state, auth/gating redirect. | MEDIUM | `NOT_RUN` |
| M-020 | App close and relaunch | App reached stable route. | Close or force-close app, then reopen. | App relaunches to a stable route and preserves only expected session/settings state. | Before route, after route, account state, screenshot. | WebView storage, session restore, route persistence, startup loading. | MEDIUM | `NOT_RUN` |

## 3. 360px Or Actual-Device Visual Review

Use the actual phone screen as primary evidence. If a 360px browser viewport is used later, record it as supplemental evidence, not as Android WebView proof.

| QA ID | Check item | Prerequisites | Steps | Expected result | Failure record | Failure suspect area | Risk | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| V-001 | Narrow-screen clipping | Core routes reachable. | On `/coin`, `/crypto`, `/alts`, `/global`, `/alerts`, `/journal`, `/pro`, and settings/account, scan for clipped cards, text, buttons, or icons. | No critical content is clipped or horizontally overflowing. | Route, screenshot, clipped element, viewport/device. | CSS layout, card widths, bottom navigation, safe-area spacing. | MEDIUM | `NOT_RUN` |
| V-002 | Long text wrapping | Core routes reachable. | Check long Korean/English copy, labels, plan names, alert titles, and account text. | Long text wraps cleanly without overlapping controls. | Route, text area, screenshot, language/copy involved. | Typography, line clamp, badge/chip width, account identity display. | MEDIUM | `NOT_RUN` |
| V-003 | CTA and bottom navigation overlap | Core routes reachable. | Check CTAs and bottom controls near the device safe area. | Buttons remain tappable and do not overlap bottom navigation or OS controls. | Route, button/control, screenshot. | Safe-area padding, sticky controls, bottom navigation, scroll container. | HIGH | `NOT_RUN` |
| V-004 | Modal and confirmation bounds | Settings/account/pro/login flows visible. | Open only non-destructive panels/modals; do not confirm deletion/payment/restore. | Modal content stays within screen and close/back controls are visible. | Modal name, route, screenshot, hidden control. | Modal layout, viewport height, keyboard/safe-area behavior. | HIGH | `NOT_RUN` |
| V-005 | Empty/loading/error copy | Routes naturally showing empty/loading/error state. | Observe states without forcing production data changes. | State copy is readable and gives safe next step. | Route, state type, screenshot, elapsed wait. | Data loading, empty-state copy, API response, network. | MEDIUM | `NOT_RUN` |

## 4. Google Login Smoke

Use only a dedicated QA account. Do not test account deletion execution here.

| QA ID | Check item | Prerequisites | Steps | Expected result | Failure record | Failure suspect area | Risk | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| L-001 | Signed-out login CTA | Signed-out state. | Visit account/settings, gated areas, and `/pro` if needed. | Login CTA or account entry path is visible and clear. | Route, screenshot, missing/unclear CTA. | Auth UI, settings/account links, gating copy. | MEDIUM | `NOT_RUN` |
| L-002 | Google account selection entry | QA account available. | Tap Google login button and observe account picker or sign-in step. | Account selection opens and can return to app. | Entry route, screenshot, error/cancel point. | Google sign-in bridge, OAuth config, Android WebView/Capacitor handling. | MEDIUM-HIGH | `NOT_RUN` |
| L-003 | Login cancel stability | Account picker/sign-in step open. | Cancel or back out before successful login. | App returns to stable signed-out state without blank screen or loop. | Cancel step, return route, screenshot/recording. | Auth callback handling, route recovery, session state. | MEDIUM | `NOT_RUN` |
| L-004 | Login success state | Dedicated QA account. | Complete login and return to app. | User state, account/settings, and plan-related surfaces reflect signed-in state. | Return route, account state without private identifier, screenshot. | Auth callback, Supabase session, profile load, plan fetch. | MEDIUM-HIGH | `NOT_RUN` |
| L-005 | Session after relaunch | Signed-in QA account. | Close/relaunch app. | Session remains or refreshes according to expected behavior without exposing wrong account state. | Before/after route, visible account state, screenshot. | WebView storage, session restore, auth refresh, profile cache. | MEDIUM-HIGH | `NOT_RUN` |
| L-006 | Logout state transition | Signed-in QA account. | Use logout control; revisit account/protected surfaces and back button if safe. | App shows signed-out state and previous account screen is not exposed. | Logout path, result route, back result, screenshot. | Auth sign-out, cached profile state, route history. | MEDIUM | `NOT_RUN` |
| L-007 | Account deletion accessibility boundary | Signed-in QA account. | Find deletion entry and warning copy only. Stop before final destructive confirmation. | Deletion access and warning are clear, but deletion is not executed. | Entry path, warning screenshot, exact stop point. | Account deletion route, policy copy, modal/confirmation layout. | HIGH | `NOT_RUN` |

## 5. `/pro` Pre-Checkout Review

Stop before entering Google Play checkout. Do not execute payment or restore.

| QA ID | Check item | Prerequisites | Steps | Expected result | Failure record | Failure suspect area | Risk | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B-001 | `/pro` route entry | App open; signed-out or signed-in state recorded. | Navigate to `/pro`. | Pro screen loads without blank or fatal error. | Account state, route, screenshot. | Pro route, pricing panel, product loading state. | MEDIUM-HIGH | `NOT_RUN` |
| B-002 | Basic vs Pro explanation | `/pro` open. | Read plan comparison and value boundaries. | Basic remains useful; Pro value is clear without guaranteed-return wording. | Screenshot, unclear/crowded copy, wording concern. | Pricing copy, plan comparison, CTA hierarchy. | MEDIUM-HIGH | `NOT_RUN` |
| B-003 | Product card visibility | `/pro` open. | Check Coin Pro, Global Pro, and All Market Pro cards if visible. | Product families are distinguishable and scoped correctly. | Visible cards, missing/ambiguous product, screenshot. | Product display mapping, plan filter, pricing panel layout. | HIGH | `NOT_RUN` |
| B-004 | Price display | `/pro` open. | Check prices, periods, and renewal/caution text. | Prices and periods are readable and not contradictory. | Price/period text, screenshot, account state. | Billing display, product price fallback, local copy. | HIGH | `NOT_RUN` |
| B-005 | Login before purchase behavior | Signed-out and signed-in states if available. | Compare purchase CTA/button state before checkout. | Signed-out state guides login; signed-in state shows safe purchase entry without forcing checkout. | Account state, CTA/button screenshot, stop point. | Auth gate, purchase button state, current-plan state. | HIGH | `NOT_RUN` |
| B-006 | Checkout hard stop | `/pro` visible. | Do not tap through to Google Play checkout. If an entry point is obvious, record its presence only. | Tester stops before checkout sheet. | Exact stop point and screenshot. | QA process control. | HIGH | `NOT_RUN` |
| B-007 | Restore hard stop | Restore entry visible if present. | Record restore entry visibility only. Do not run restore. | Restore is not executed. | Restore location, screenshot, stop point. | QA process control, restore control placement. | HIGH | `NOT_RUN` |

## 6. Notification Permission And Settings

Do not send push, do not inspect raw token values, and do not change Supabase/FCM console settings.

| QA ID | Check item | Prerequisites | Steps | Expected result | Failure record | Failure suspect area | Risk | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| N-001 | `/alerts` entry | App navigation available. | Open `/alerts` or alert entry. | Alert screen opens with empty/list/blocked state. | Route, account state, permission state, screenshot. | Alert route, alert center state, auth/plan gating. | HIGH | `NOT_RUN` |
| N-002 | Alert list state | `/alerts` open. | Observe empty list, existing list, or recent-match state if visible. | State is readable and does not imply a push was sent. | State type, screenshot, missing/unclear copy. | Alert list rendering, data loading, empty-state copy. | HIGH | `NOT_RUN` |
| N-003 | Notification settings entry | Alerts or settings screen open. | Find and open notification settings if available. | Settings entry is reachable and controls are readable. | Entry path, screenshot, missing control. | Alert settings route, navigation, account state. | HIGH | `NOT_RUN` |
| N-004 | Android OS permission state | QA device permission state known or observable. | Check app notification permission state in app and OS settings if needed. | App and OS states are understandable and not contradictory. | OS state, app state, screenshot, mismatch. | Android permission bridge, cached app push state, settings deep link. | HIGH | `NOT_RUN` |
| N-005 | Permission allowed/denied guidance | Permission state observed. | Review guidance for denied, allowed, pending, or unavailable state. | User knows whether alerts are enabled, blocked, or need action. | State, guidance text, screenshot. | Permission-state copy, WebView/native bridge, settings recovery path. | HIGH | `NOT_RUN` |
| N-006 | Pro alert limit guidance | Known Basic/Pro state if available. | Review Coin Pro, Global Pro, or All Market Pro alert limits if shown. | Limits are contextual and do not make Basic app feel unusable. | Account plan state, screenshot, unclear gate. | Entitlement display, alert gate copy, CTA target. | HIGH | `NOT_RUN` |
| N-007 | Push hard stop | Any alert path. | Do not send admin/test/real push and do not use push-cron send mode. | No push is sent. | If blocked, record attempted boundary only. | QA process control. | HIGH | `NOT_RUN` |
| N-008 | Token hard stop | Any alert/token readiness path. | Do not copy, print, manually insert, delete, or query raw push token. | No token value is exposed or mutated. | If blocked, record visible UI state only. | QA process control, token privacy. | HIGH | `NOT_RUN` |

## 7. Settings And Account Screen

Do not execute account deletion. Check accessibility and warning boundary only.

| QA ID | Check item | Prerequisites | Steps | Expected result | Failure record | Failure suspect area | Risk | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S-001 | Account state display | Signed-out or signed-in state recorded. | Open settings/account screen. | Account state is clear and does not expose wrong account data. | Account state without private ID, screenshot, route. | Account panel, auth session, profile cache. | MEDIUM | `NOT_RUN` |
| S-002 | Current plan display | Known plan state if available. | Check current plan on account/settings and compare with `/pro`. | Basic/Pro or product family display is consistent or discrepancy is logged. | Expected state, displayed state, screenshot. | Plan label mapping, entitlement refresh, profile cache. | HIGH | `NOT_RUN` |
| S-003 | Notification settings link | Settings/account open. | Find notification settings entry. | Entry is reachable and does not require push send. | Entry path, screenshot, missing link. | Settings links, alert settings route. | MEDIUM | `NOT_RUN` |
| S-004 | Contact and policy links | Settings/account open. | Open or verify access to contact, privacy, terms, refund/policy links without changing state. | Links are readable and open safely. | Link name, result, screenshot. | Policy routes, external link handling, WebView. | MEDIUM | `NOT_RUN` |
| S-005 | Logout access | Signed-in QA account. | Find logout control; execute logout only if this step is in the planned login/logout pass. | Logout is accessible and state changes safely if executed. | Control location, result route, screenshot. | Auth sign-out, account panel, route history. | MEDIUM | `NOT_RUN` |
| S-006 | Account deletion access only | Signed-in QA account. | Find deletion entry and warning text; stop before final confirm. | Deletion warning is clear and destructive action is not executed. | Entry path, warning text, screenshot, stop point. | Account deletion page, modal copy, policy route. | HIGH | `NOT_RUN` |
| S-007 | App version display | Settings/account or Play Store version available. | Record app version source. | App version is visible or Play Store version is recorded as fallback. | Version text/source, screenshot. | Settings metadata, Play Store listing state. | LOW | `NOT_RUN` |

## 8. Play Console Read-Only Review

This is read-only. Do not change Play Console settings, rollout state, country/region, tester enrollment, app content, store listing, products, pricing, or release artifacts.

| QA ID | Check item | Prerequisites | Steps | Expected result | Failure record | Failure suspect area | Risk | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C-001 | Production crash status | Play Console read access. | Open Android vitals/crashes for production app. | Crash trend and recent issue status are recorded without changes. | Date/time, metric/warning text, screenshot. | Production crash, release artifact, device-specific issue. | MEDIUM-HIGH | `NOT_RUN` |
| C-002 | Production ANR status | Play Console read access. | Open ANR/vitals area. | ANR trend and issue status are recorded without changes. | Date/time, metric/warning text, screenshot. | Android vitals, performance issue, device/OS-specific ANR. | MEDIUM-HIGH | `NOT_RUN` |
| C-003 | Warning/policy alerts | Play Console read access. | Review visible warnings or policy alerts. | Warnings are recorded exactly enough for later triage. | Warning title/text, affected version/track, screenshot. | Play Console warning, policy/vitals issue, release metadata. | MEDIUM-HIGH | `NOT_RUN` |
| C-004 | App version and release status | Play Console read access. | Confirm production release version/status read-only. | Current version/release state is recorded without changes. | Version code/name if visible, track, screenshot. | Release state, store listing cache, rollout status. | MEDIUM-HIGH | `NOT_RUN` |

## Separate Approval Required

These items are intentionally not part of the manual phone checklist. They need a separate approved run and explicit stop conditions.

| QA ID | Item | Why separate | Required approval boundary | Risk | Status |
| --- | --- | --- | --- | --- | --- |
| R-001 | Actual Google Play purchase test | Can create subscription/account state. | Dedicated tester account, license tester setup, and explicit purchase-test approval. | HIGH | `NEEDS_RUN` |
| R-002 | Purchase restore test | Can mutate entitlement/account state and depends on purchase history. | Known test account history and explicit restore approval. | HIGH | `NEEDS_RUN` |
| R-003 | Actual account deletion test | Destructive account operation. | Disposable QA account and explicit deletion approval. | HIGH | `NEEDS_RUN` |
| R-004 | Real push delivery or push-click test | Sends notifications and can affect device/account state. | Dedicated QA device/account, no-secret evidence plan, and explicit send-path approval. | HIGH | `NEEDS_RUN` |
| R-005 | Production DB or token lookup/mutation | Privacy, token, and production-data integrity risk. | Separate read/minimize plan and explicit approval. | HIGH | `NEEDS_RUN` |
| R-006 | RevenueCat, Google Play Console, FCM, Supabase, or Android release changes | External service or release mutation. | Separate release-ops or implementation run with rollback and verification plan. | HIGH | `NEEDS_RUN` |
| R-007 | Android native/release commands | Can mutate native project or release artifacts. | Separate Android device/release run. | HIGH | `NEEDS_RUN` |

## Evidence Record Shape

Use this shape when manual QA is later executed:

| Field | Required content |
| --- | --- |
| QA ID | Checklist item ID, such as `M-001` or `B-006`. |
| Status | `PASS`, `FAIL`, or `BLOCKED`. Leave unexecuted items as `NOT_RUN`; approval-only items stay `NEEDS_RUN`. |
| Device and app | Device model, Android version, app version, and install source. |
| Account state | Signed out, Basic, Pro, or unknown. Do not record private account identifiers. |
| Evidence | Screenshot, screen recording, or concise observation note. |
| Actual result | What happened on the phone. |
| Failure suspect area | First credible suspect area from the checklist. |
| Protected area touched? | Yes/No. If yes, name the protected area and stop before mutation. |
| Follow-up | Work item or separate run candidate. Do not fix inside manual QA. |
