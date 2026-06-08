# Android Production Stability QA

## Scope Status

- Active run: `android-production-stability-qa-run`
- Current task: `Android production QA scope definition`
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
