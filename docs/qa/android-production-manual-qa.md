# Android Production Manual QA Checklist

## Scope

- Active run: `android-production-qa-execution-run`
- Source execution doc: [Android Production QA Execution](../android-production-qa-execution.md)
- Status: template created; manual QA is `NEEDS-RUN`.

This checklist covers actual Android production checks that cannot be proven by local smoke scripts. It is observation-first. It does not authorize real purchase, purchase restore, account deletion, real push send, production DB changes, or external service configuration changes.

## Manual QA Preflight

| Item | Expected confirmation | Status | Evidence |
| --- | --- | --- | --- |
| Device identified | Device model and Android version recorded. | `NEEDS-RUN` | Pending |
| Install source confirmed | App is installed from Google Play production, not debug/local build. | `NEEDS-RUN` | Pending |
| App version recorded | Visible app version or Play Store version is recorded. | `NEEDS-RUN` | Pending |
| QA account ready | Dedicated Google QA account is available. | `NEEDS-RUN` | Pending |
| Account state known | Signed-out, Basic, Pro, or unknown state is recorded before testing. | `NEEDS-RUN` | Pending |
| Evidence plan ready | Screenshots or screen recording will avoid credentials, tokens, and private account identifiers. | `NEEDS-RUN` | Pending |

## Play Store Install And First Launch

| Check | Expected result | Status | Evidence | Hard stop |
| --- | --- | --- | --- | --- |
| Install from Google Play production | App installs without sideload/debug indication. | `NEEDS-RUN` | Pending | No Play Console release or listing edits. |
| First launch | App opens to a stable first screen with readable loading or content. | `NEEDS-RUN` | Pending | No Android native or production config changes. |
| First visible route | First visible route is recorded and not blank/trapped. | `NEEDS-RUN` | Pending | Do not fix route issues inside this run. |
| Offline or slow-load observation if naturally encountered | User sees recoverable loading/error guidance. | `NEEDS-RUN` | Pending | Do not change network or production config to force state. |

## Navigation, Back, Refresh, Relaunch

| Check | Expected result | Status | Evidence | Hard stop |
| --- | --- | --- | --- | --- |
| Core navigation opens `/coin` or coin home | First viewport gives judgment-support summary without broken layout. | `NEEDS-RUN` | Pending | No UI code edits. |
| Core navigation opens `/crypto` | Main crypto screen loads or shows useful loading/error/empty state. | `NEEDS-RUN` | Pending | No market-data or gating edits. |
| Core navigation opens `/alts` | Alt market screen loads and Basic/Pro boundary is understandable. | `NEEDS-RUN` | Pending | No gating edits. |
| Core navigation opens `/global` | Global screen loads and first read is clear. | `NEEDS-RUN` | Pending | No global data or entitlement edits. |
| Core navigation opens `/alerts` | Alert state is understandable without sending push. | `NEEDS-RUN` | Pending | No push send, token access, or FCM/Supabase edits. |
| Core navigation opens `/journal` | Empty or existing state is clear without unwanted data mutation. | `NEEDS-RUN` | Pending | No journal data changes unless separately approved. |
| Core navigation opens `/pro` | Product cards and CTA states are readable before checkout. | `NEEDS-RUN` | Pending | Stop before Google Play checkout. |
| Android back behavior | Back returns to expected previous screen or exits only when expected. | `NEEDS-RUN` | Pending | Do not change navigation code. |
| Force close and relaunch | App reopens to a stable and explainable state. | `NEEDS-RUN` | Pending | Do not change session or storage logic. |

## Google Login And Account

| Check | Expected result | Status | Evidence | Hard stop |
| --- | --- | --- | --- | --- |
| Signed-out login entry | Google login path is visible from signed-out/account-gated surfaces. | `NEEDS-RUN` | Pending | No auth UI/code edits. |
| Google account picker opens | Account picker or login step opens and can return to app. | `NEEDS-RUN` | Pending | No OAuth, native Android, or Supabase config edits. |
| Login cancel path | Cancel/back returns to a safe screen without blank state. | `NEEDS-RUN` | Pending | Do not change callback handling. |
| Successful login with QA account | App shows signed-in state and expected account/plan surfaces. | `NEEDS-RUN` | Pending | Dedicated QA account only. |
| Session after relaunch | Relaunch keeps or clears session according to expected behavior. | `NEEDS-RUN` | Pending | No session/storage edits. |
| Logout | Account state switches to signed out and private state is not visible. | `NEEDS-RUN` | Pending | No auth/Supabase edits. |
| Account deletion access | Deletion guidance is reachable and warning boundary is clear. | `NEEDS-RUN` | Pending | Do not submit deletion or delete any real account. |

## Pro Pre-Checkout Review

| Check | Expected result | Status | Evidence | Hard stop |
| --- | --- | --- | --- | --- |
| `/pro` product cards | Coin Pro, Global Pro, and All Market Pro are distinguishable if visible. | `NEEDS-RUN` | Pending | No billing copy/code edits. |
| Price and period display | Product prices and periods are internally consistent. | `NEEDS-RUN` | Pending | No product or plan changes. |
| Current plan display | Known QA account state matches displayed plan state or discrepancy is logged. | `NEEDS-RUN` | Pending | No entitlement or RevenueCat changes. |
| CTA state before checkout | CTA wording is visible and does not pressure immediate action. | `NEEDS-RUN` | Pending | Stop before completing checkout. |
| Checkout boundary | Tester records exact point where purchase flow would begin. | `NEEDS-RUN` | Pending | Do not enter/complete actual Google Play purchase unless separate approval exists. |
| Restore boundary | Restore entry, if visible, is noted only. | `NEEDS-RUN` | Pending | Do not execute purchase restore. |

## Notification Permission And Settings

| Check | Expected result | Status | Evidence | Hard stop |
| --- | --- | --- | --- | --- |
| `/alerts` entry | Alert screen opens and empty/list/blocked state is clear. | `NEEDS-RUN` | Pending | No alert data mutation. |
| Permission status | Allowed, denied, pending, or unavailable state is understandable. | `NEEDS-RUN` | Pending | No permission code or native config edits. |
| Notification settings access | Settings screen is reachable and controls are readable. | `NEEDS-RUN` | Pending | Do not persist production setting changes unless separately approved. |
| Basic/Pro alert limits | Limits or gates are understandable for the known QA account state. | `NEEDS-RUN` | Pending | No entitlement/gating changes. |
| Push token handling | UI readiness is observed only if safely visible. | `NEEDS-RUN` | Pending | Do not copy, print, insert, delete, or expose raw tokens. |
| Push-click expectation | Future targetPath expectation is noted from visible routes only. | `NEEDS-RUN` | Pending | No real push send or push-cron send mode. |

## 360px Visual Review

Use a 360px-wide browser/mobile viewport or actual-device screenshots where available. If no automated screenshot runner exists, record these as manual visual checks.

| Screen | Expected result | Status | Evidence | Hard stop |
| --- | --- | --- | --- | --- |
| `/coin` or coin home | Top summary, score/labels, risk, and CTA fit without horizontal overflow. | `NEEDS-RUN` | Pending | No UI redesign. |
| `/crypto` | Chart/panels do not collapse or overflow; Pro CTA does not cover content. | `NEEDS-RUN` | Pending | No chart/data/gating edits. |
| `/alts` | List/cards, labels, badges, and CTAs fit the viewport. | `NEEDS-RUN` | Pending | No UI code edits. |
| `/global` | Market summary and asset labels are readable without bottom-nav overlap. | `NEEDS-RUN` | Pending | No global workflow edits. |
| `/alerts` | Alert rows, permission copy, and settings actions are readable and tappable. | `NEEDS-RUN` | Pending | No alert or FCM edits. |
| `/journal` | Empty/list/write/detail entry states do not clip controls. | `NEEDS-RUN` | Pending | No journal persistence changes. |
| `/pro` | Product cards, prices, current-plan labels, and CTAs fit the viewport. | `NEEDS-RUN` | Pending | No billing/gating edits. |
| Account/settings | Login, logout, account deletion guidance, policy links, and close/back controls fit safely. | `NEEDS-RUN` | Pending | No auth/account code edits. |

## Play Console Read-Only Review

| Check | Expected result | Status | Evidence | Hard stop |
| --- | --- | --- | --- | --- |
| Production crash signal | Crash trend and recent issue status are recorded. | `NEEDS-RUN` | Pending | Read-only only. |
| Production ANR signal | ANR trend and recent issue status are recorded. | `NEEDS-RUN` | Pending | No console edits. |
| Android vitals | Vitals warnings or absence of warnings are recorded. | `NEEDS-RUN` | Pending | No release or policy changes. |
| Recent release warnings | Existing warnings are recorded exactly enough for follow-up triage. | `NEEDS-RUN` | Pending | No rollout, listing, tester, country/region, product, or release edits. |

## Result Status Rules

- `PASS`: checked and met expectation.
- `FAIL`: checked and did not meet expectation.
- `BLOCKED`: could not be checked because a prerequisite, access issue, or guardrail stopped it.
- `NEEDS-RUN`: not checked yet.

## Follow-Up Rules

- Route/layout/user-visible bugs go to a separate bug-fix run or `docs/work-items/`.
- Billing/auth/Supabase/FCM/Android release/Play Console issues require separate approval before any implementation or external-console change.
- Evidence should include screen, account state, expected result, actual result, risk, and whether a protected area is implicated.
