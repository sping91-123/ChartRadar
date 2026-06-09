# Alert Quality Operations

## Scope Status

- Active run: `alert-quality-operations-run`
- Setup date: 2026-06-09
- Run type: audit, documentation, and improvement-candidate selection only.
- Previous run context: Android production auto smoke is complete and recorded as `PASS`.
- Android phone manual QA: intentionally excluded from this run.

This document defines how to review ChartRadar alert quality from an operations perspective. It does not authorize alert implementation changes, real push sends, production DB or token access, FCM changes, Supabase changes, RevenueCat changes, billing changes, Play Console changes, or Android release changes.

## Purpose

- Check whether current alert behavior appears trustworthy to users.
- Identify copy, repetition, Basic/Pro boundary, and routing quality risks.
- Preserve current alert delivery safety while selecting one first improvement candidate.
- Keep implementation in a later, explicitly approved run.

## Background Evidence

- `docs/qa/android-production-qa-results.md` records the automatic smoke set as `PASS`.
- Safe automatic checks included TypeScript, build, lint, `smoke:copy`, `smoke:mobile`, and `smoke:launch`.
- Manual Android production device QA remains `NOT_RUN`.
- Previous alert/push planning docs already identify push scanner, cron, diagnostics, targetPath, duplicate guard, and dry-run boundaries as important alert-operation surfaces.

## Operating Rules

- Use source and document inspection only unless a later task explicitly allows a non-mutating command.
- Do not run `/api/push-cron` in send mode.
- Do not send real or test push notifications.
- Do not inspect, print, copy, insert, delete, or rotate raw push tokens.
- Do not query or mutate production DB records.
- Do not change FCM, Supabase, RevenueCat, billing, Android release, Play Console, or production configuration.
- Do not change alert code, thresholds, cooldown, duplicate guards, targetPath, Pro gates, or copy during this run.

## Audit Surfaces To Inspect Later

These are candidate surfaces for future TODO tasks. Listing them here is not approval to edit them.

| Surface | Why it matters | Guardrail |
| --- | --- | --- |
| Alert generation | Determines what alert event reaches a user and why. | Inspect only; no threshold or event-builder changes. |
| Permission request and app push state | Determines whether a user understands alert availability. | No FCM/native permission changes. |
| Push token save path | Determines whether alert delivery is possible. | Do not expose or mutate tokens. |
| targetPath routing | Determines where a user lands after tapping an alert. | No routing edits or real push-click test. |
| Pro and Basic alert limits | Determines free/paid trust boundary. | No entitlement, billing, RevenueCat, or Supabase RLS edits. |
| Alert settings UI flow | Determines whether users can understand and control alerts. | No UI or persistence changes. |
| Duplicate and cooldown policy | Determines whether alerts feel noisy or repetitive. | No cooldown or push-cron changes. |
| Alert copy | Determines whether alerts read as judgment support rather than trade instruction. | No send logic or live message changes. |

## Task Plan

| Order | Status | Task | Main question | Expected output |
| --- | --- | --- | --- | --- |
| 1 | DONE | Current alert structure audit | How are alerts generated, permissioned, stored, routed, gated, and configured today? | Structure map and protected-surface notes. |
| 2 | TODO | Alert copy quality review | Does alert copy avoid investment instruction, guarantee, urgency, or excessive trading pressure? | Copy-risk findings and wording guardrails. |
| 3 | TODO | Duplicate and cooldown policy review | Can the same user receive too many or repeated alerts? | Repetition/cooldown risk map. |
| 4 | TODO | Basic/Pro alert limit review | Are free and paid alert limits consistent between UI and intended behavior? | Basic/Pro consistency findings. |
| 5 | TODO | targetPath routing quality review | Where should alert taps land, and what should happen for login-required or missing routes? | Routing expectation table. |
| 6 | TODO | Alert improvement candidate selection | What is the one safest first improvement candidate? | One implementation-run candidate with rationale. |

## Task 1 - Current Alert Structure Audit

| Field | Value |
| --- | --- |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Source inspection only. No push endpoint, admin diagnostics endpoint, database, token, external console, Android device, or production-mutating command was executed. |
| Scope inspected | Alert generation, permission request, push token save, targetPath resolution, Pro gating, alert settings, admin-only diagnostics/test surfaces. |
| Implementation allowed in this run? | `No` |

### Alert Structure Summary

- ChartRadar has two alert surfaces: client-side browser preview/setup monitoring and server-side Android FCM push delivery.
- Client alert settings live mainly in `RadarAlertCenter`. The crypto route is `/crypto/alert`; global alert settings use `/alerts?market=global`. `/alerts` redirects crypto users to `/crypto/alert`.
- Android push permission, token registration, token save, disable, test send request, and click listener registration live in `src/lib/appPush.ts`.
- Server automatic push generation is entered through `/api/push-cron`, which calls `runPushAlertScan`. Actual FCM sending is isolated in `sendEventToUser` and `sendFcmMessage`.
- Push token and saved alert preset persistence is handled through `/api/push-tokens`; source inspection found writes to `push_tokens` and `push_alert_presets`, but this audit did not query or mutate production data.
- Alert click routing is normalized by `resolvePushTargetPath`, which allowlists known routes and falls back to metadata-derived routes or `/alerts`.
- Basic/Pro gating is split between UI usage gating (`RadarAlertCenter`) and server entitlement filtering (`ruleAllowed`, `userPlan`, `hasMarketEntitlement`).

### Major Files, Components, And Scripts

| Path | Role | Operational note |
| --- | --- | --- |
| `src/components/RadarAlertCenter.tsx` | Main alert settings UI for rule toggles, permission request, Android push connect/disconnect, admin-only test push and diagnostics controls. | High-risk actions are reachable only through UI handlers; this run did not trigger them. |
| `src/components/RadarAlertMonitor.tsx` | Client-side setup match monitor for saved conditions; creates browser `Notification` only outside Android native when browser permission is granted. | Browser/PWA preview behavior is separate from Android FCM delivery. |
| `src/app/alerts/page.tsx` | Global alert settings page; redirects crypto market to `/crypto/alert`. | Route entry only; no delivery logic. |
| `src/app/crypto/alert/page.tsx` | Crypto alert settings page. | Route entry only; no delivery logic. |
| `src/app/settings/page.tsx` | Redirects to `/menu`. | Settings/account route is not the primary alert settings surface. |
| `src/lib/appPush.ts` | Android native push permission, registration, local state, token sync, disable, test send request, and notification click listeners. | Protected surface: FCM/token flow. Do not edit in this run. |
| `src/lib/pushTargetPath.ts` | Sanitizes and resolves notification tap destination. | Protected surface: routing expectation; no edits in this run. |
| `src/app/api/push-cron/route.ts` | Cron endpoint with authorization and dry-run handling; calls `runPushAlertScan`. | Send mode can send real push. Do not execute in this run. |
| `src/lib/server/pushAlertScanner.ts` | Main server scan orchestrator for tokens, profiles, subscriptions, presets, scanners, quality filters, entitlement gates, preferences, cooldown, duplicate guard, dry-run diagnostics, and send attempts. | Protected surface: push logic. Document only. |
| `src/lib/server/push/eventBuilders.ts` | Builds push event titles, bodies, `eventKey`, metadata, and target paths for setup/global events. | Next TODO should inspect wording here. |
| `src/lib/server/push/genericEvents.ts` | Builds generic crypto/global event candidates and applies market-scout/global batching limits. | Relevant to noise control and duplicate/cooldown TODOs. |
| `src/lib/server/push/presetEvents.ts` | Converts saved user preset matches into watchlist push events. | Links local saved conditions to server push candidates after token sync. |
| `src/lib/server/push/scanners/setupScanner.ts` | Scans crypto and stock setup candidates used by automatic push generation. | Inspection only; no scanner execution in this run. |
| `src/lib/server/push/scanners/liquidationScanner.ts` | Optional liquidation-pressure event source. | Protected external-data/push surface. |
| `src/lib/server/push/scanners/macroScanner.ts` | Optional news and macro-calendar event sources. | Protected external-data/push surface. |
| `src/lib/server/push/eligibility.ts` | Score, quality, evidence, timeframe, and market-specific event quality filters. | Important for operations quality but not edited. |
| `src/lib/server/push/entitlements.ts` | Combines profile/subscription plans and decides whether a rule is allowed. | High-risk Basic/Pro entitlement surface. |
| `src/lib/server/push/preferences.ts` | Filters events against token `markets` and `rule_ids`. | Settings-to-delivery consistency surface. |
| `src/lib/server/push/cooldown.ts` | Symbol cooldown and crypto alt market-scout cooldown decisions. | Next duplicate/cooldown TODO should inspect deeper. |
| `src/lib/server/push/duplicateGuard.ts` | Reads recent sent events and records sent event keys. | Writes to `push_alert_events` only during actual send or test paths; not run here. |
| `src/lib/server/push/sendPush.ts` | Sends FCM messages to target tokens and records sent events. | Real push surface. Do not run or edit in this run. |
| `src/app/api/push-tokens/route.ts` | Authenticated Android token registration, token disable, market/rule preference merge, and preset sync endpoint. | Writes token/preset tables; source-inspection only. |
| `src/app/api/push-test/route.ts` | Admin-only Android test push endpoint. | Sends real FCM and may log test events; explicitly out of scope. |
| `src/app/api/admin/push-diagnostics/route.ts` | Admin-only dry-run diagnostics plus recent event readback. | Useful future read-only admin surface, but it queries production records and was not called. |
| `src/lib/radarAlerts.ts` | User-facing alert rule definitions and Basic/Pro labels. | Next copy review should inspect rule copy. |
| `src/lib/setupAlertPresets.ts` | Local setup alert preset/match storage and match detection helpers. | Client-local saved condition source for both UI and token sync. |
| `supabase/migrations/20260519_push_tokens.sql` | Defines `push_tokens`, `push_alert_presets`, `push_alert_events`, indexes, and RLS policies. | Schema reference only; no migration or DB command was run. |
| `supabase/migrations/20260519_android_push_platform_guard.sql` | Constrains Android tokens to FCM and adds Android FCM index. | Schema reference only. |
| `capacitor.config.ts` | Configures Capacitor PushNotifications presentation options. | Android/native config protected from changes. |

### Flow Responsibilities

| Flow | Current responsibility split | Safety and uncertainty notes |
| --- | --- | --- |
| Alert generation | `/api/push-cron` authorizes the request and calls `runPushAlertScan`. The scanner reads enabled Android FCM tokens, profiles, active/trialing subscriptions, saved presets, setup scanners, optional liquidation/news/macro sources, generic events, and preset events. | Send mode can deliver real FCM. This audit did not call the endpoint or scanners. |
| Candidate filtering | `passesSetupPushQuality`, `ruleAllowed`, `tokenPreferenceDecision`, `cooldownDecisionForEvent`, and `alreadySent` gate candidates before delivery. | Filtering spans quality, entitlement, user preferences, cooldown, and duplicate event keys. Later TODOs should inspect repetition and Basic/Pro consistency in more detail. |
| Actual push delivery | `sendEventToUser` filters target tokens, calls `sendFcmMessage`, and records sent events through `recordSentEvent` when at least one send succeeds. | High-risk real-send path. Do not execute during audit runs. |
| Browser/display alert logic | `RadarAlertMonitor` scans local saved setup presets while the app is open and can create browser `Notification` previews when not Android native. | This is not the same as Android production FCM delivery. Android WebView/PWA behavior may differ. |
| Permission request | `RadarAlertCenter.requestNotificationPermission` uses `registerAndroidAppPush` for Android native and `Notification.requestPermission` for browser preview. | Android requires login before token sync; browser notification is local preview only. |
| Push token save | `registerAndroidAppPush` gets a Capacitor registration token and posts to `/api/push-tokens` with market, rule ids, and presets. The API authenticates via bearer token and writes/merges `push_tokens` and `push_alert_presets`. | Raw tokens must not be printed or queried. This audit only read code/schema references. |
| targetPath movement | Event builders/scanners include `targetPath`; notification click listeners call `resolvePushTargetPath` and then `window.location.assign`. Invalid or absent paths fall back through metadata or `/alerts`. | Missing-route/login-required behavior is not fully proven by source inspection and belongs to targetPath TODO 5. |
| Pro limits | UI uses `hasMarketEntitlement(profile?.plan, market)` plus usage gating. Server uses `userPlan` from active subscriptions/profile and `ruleAllowed` against `radarAlertRules`. System events bypass rule gating; watched/preset events rely on rule and token preferences. | High-risk entitlement surface; no billing, RevenueCat, plan id, or subscription code changed. |
| Alert settings | Rule toggles are stored in localStorage by market. If Android token exists, toggles sync to `/api/push-tokens` as `ruleIds`; saved presets also sync when present. The other market has a separate settings route. | Local setting and server token preference drift is possible if sync fails or login/session state changes. |

### Operating Risks Found

- The app has two materially different notification behaviors: browser-local preview while the app is open, and Android FCM delivery from server cron. Users may interpret them as the same unless UI copy keeps the distinction clear.
- Token preference and saved preset sync depends on login/session state, Android native support, a valid token, and `/api/push-tokens` success. Failed sync can leave local UI state ahead of server delivery state.
- Admin-only test push is present in the UI and API. It is gated by admin checks, but it is a real-send path and should stay excluded from automated QA runs unless separately approved.
- Admin diagnostics runs a dry-run scan and reads recent event logs. It is useful operationally, but it still touches production-backed data and should be treated as separate approval/read-only QA.
- `targetPath` allowlisting reduces unsafe navigation, but not all UX outcomes are proven by inspection: logged-out landing, missing route fallback, and Android back/relaunch behavior need a later routing/manual QA pass.
- Pro gating is intentionally split between UI, usage meter, server entitlements, token preferences, and rule definitions. This is operationally sensitive because any mismatch can make users see a setting that delivery later filters out, or vice versa.
- Several alert titles/bodies are built in code paths rather than a single copy registry. The next copy review should inspect `radarAlerts`, `eventBuilders`, scanner event bodies, and `pushTestMessages` together.

### Confirmed Gaps Or Uncertain Areas

- No actual Android device/WebView permission dialog, OS notification channel, tap routing, back stack, relaunch, or safe-area behavior was verified in this task.
- No production `push_tokens`, `push_alert_presets`, or `push_alert_events` rows were queried; table names and fields are documented from code and migrations only.
- No dry-run diagnostics endpoint was called because the task forbids production DB/token access.
- Browser notification preview behavior was inspected from source only; no browser permission prompt or notification was triggered.
- Exact runtime subscription/profile combinations were not verified; only code-level `userPlan` and `ruleAllowed` behavior was mapped.
- Actual copy rendering may differ where source strings are generated dynamically from symbols, scores, scanner outputs, and optional source payloads.

### High-Risk Areas To Keep Protected

- `src/lib/appPush.ts`, `src/app/api/push-tokens/route.ts`, `src/app/api/push-cron/route.ts`, `src/app/api/push-test/route.ts`, `src/lib/server/pushAlertScanner.ts`, `src/lib/server/push/sendPush.ts`.
- Supabase tables and policies for `push_tokens`, `push_alert_presets`, `push_alert_events`, `profiles`, and `subscriptions`.
- FCM configuration and `sendFcmMessage`.
- Billing, RevenueCat, entitlement, plan id, product id, price, subscription, and RLS logic.
- Android native/release settings and Capacitor push notification config.

### Next TODO - Alert Copy Quality Points

- Inspect user-facing rule text in `src/lib/radarAlerts.ts`.
- Inspect server push title/body generation in `src/lib/server/push/eventBuilders.ts`, `src/lib/server/push/scanners/liquidationScanner.ts`, and `src/lib/server/push/scanners/macroScanner.ts`.
- Inspect admin/browser test samples in `src/lib/pushTestMessages.ts` without sending any push.
- Check for wording that could sound like investment instruction, guaranteed outcome, excessive urgency, or trade inducement.
- Preserve the product framing as judgment support: conditions, evidence, risk, invalidation, and revisit cues.

## Out Of Scope

- Real push send.
- Push-click testing.
- Production DB or token lookup.
- Token insertion, deletion, rotation, or exposure.
- FCM, Supabase, RevenueCat, billing, Play Console, Android release, or production config changes.
- App/UI/script/package changes.
- Android phone manual QA.
- Multiple alert improvements at once.

## Result Recording Format

Use this format as each TODO completes.

| Field | Value |
| --- | --- |
| Task | `TBD` |
| Status | `TODO` / `DONE` / `BLOCKED` |
| Scope inspected | `TBD` |
| Finding summary | `TBD` |
| User trust risk | `LOW` / `MEDIUM` / `HIGH` |
| Protected area implicated? | `No` / FCM / Supabase / RevenueCat / billing / Android release / production DB / token |
| Recommended follow-up | `TBD` |
| Implementation allowed in this run? | `No` |

## Initial Conclusion

The run is ready to start with Task 1. The first task should map the current alert structure and stop at documentation. Any code, database, token, push delivery, or external service change must be split into a separate approved run.
