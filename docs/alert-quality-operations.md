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
| 2 | DONE | Alert copy quality review | Does alert copy avoid investment instruction, guarantee, urgency, or excessive trading pressure? | Copy-risk findings and wording guardrails. |
| 3 | DONE | Duplicate and cooldown policy review | Can the same user receive too many or repeated alerts? | Repetition/cooldown risk map. |
| 4 | DONE | Basic/Pro alert limit review | Are free and paid alert limits consistent between UI and intended behavior? | Basic/Pro consistency findings. |
| 5 | DONE | targetPath routing quality review | Where should alert taps land, and what should happen for login-required or missing routes? | Routing expectation table. |
| 6 | DONE | Alert improvement candidate selection | What is the one safest first improvement candidate? | One implementation-run candidate with rationale. |

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

## Task 2 - Alert Copy Quality Audit

| Field | Value |
| --- | --- |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Source inspection only. No push endpoint, admin diagnostics endpoint, browser notification, OS permission prompt, database, token, external console, Android device, or production-mutating command was executed. |
| Scope inspected | Push notification title/body, alert settings UI, browser notification preview, admin/test/diagnostic copy, Pro/Basic limit copy, targetPath/fallback related copy. |
| Implementation allowed in this run? | `No` |

### Copy Sources Inspected

| Source | Copy surface | Assessment |
| --- | --- | --- |
| `src/lib/server/push/eventBuilders.ts` | Server push title/body for market scout, watchlist, risk-off, semiconductor, global momentum, and global asset events. | Mostly safe. Uses candidate, detected, evidence, risk, and confirmation language. Some momentum adjectives need caution. |
| `src/lib/server/push/personalization.ts` | Personalized alt-market scout body for watched/unwatched symbols. | Mostly safe. Uses candidate and evidence confirmation language. |
| `src/lib/server/push/scanners/liquidationScanner.ts` | Liquidation pressure push title/body. | Safe. Framed as risk and volatility confirmation. |
| `src/lib/server/push/scanners/macroScanner.ts` | News and macro-calendar push title/body. | Mixed. Calendar copy is safe; news copy can pass through external headline/key-issue text and should be treated as uncertain. |
| `src/lib/pushTestMessages.ts` | Admin/browser test notification examples. | Mostly safe, but one alt sample uses "strong candidate" language. Admin-only Android path, but still useful to normalize. |
| `src/components/RadarAlertCenter.tsx` | Alert settings page, permission/status/toast/CTA, admin diagnostics/test panels, saved alert section. | Mostly safe. Caution around "매수가/무효화 알림" because it contains explicit buy-price framing. |
| `src/components/RadarAlertMonitor.tsx` | Browser-local setup match notification and stock setup labels. | Caution. Browser notification can show "롱 우세" or "숏 우세", which is directional and closer to trading-language than server push copy. |
| `src/lib/radarAlerts.ts` | User-facing alert rule title, description, trigger, cadence, value, summary. | Mostly safe. Some urgency/FOMO phrasing should be softened in a later copy run. |
| `src/lib/usageMeter.ts` | Basic/Pro alert-rule usage limit messages. | Safe to low caution. It states limits and Pro re-check availability without direct purchase pressure. |
| `src/lib/appPush.ts` | Android push permission, token sync, disable, test, channel description, fallback notification title. | Safe. Operational permission/status language, not investment copy. |
| `src/app/api/admin/push-diagnostics/route.ts` | Admin diagnostic response fields and recent event copy passthrough. | Admin-only. It can expose generated alert title/body in the UI, so copy quality depends on upstream event builders. |
| `src/lib/pushTargetPath.ts` | targetPath fallback routing. | No user-facing fallback text found; routing fallback is path-based only. |
| `src/components/HeaderActions.tsx` | Settings menu link to alert settings. | Safe. Neutral "condition/status 확인" wording. |

### Classification Summary

| Classification | Pattern | Examples observed | Operational read |
| --- | --- | --- | --- |
| Safe | "감지", "확인", "근거", "조건", "리스크", "변동성", "일정", "권한", "연결" | "점수와 조건을 확인해 주세요", "리스크 확인이 필요합니다", "발표 전후 변동성 확대 가능성을 확인하세요" | Judgment-support framing. It asks the user to review context rather than act immediately. |
| Safe | Permission and status copy | "권한 확인 중", "연결 저장 중", "앱 푸시 연결이 완료되지 않았습니다", "브라우저 알림은 ... 미리보기 수준" | Operationally clear and not trade-inducing. |
| Safe | Admin diagnostics copy | "실제 발송 없이 후보와 제외 사유를 확인합니다", "기기 식별값, 이메일, 사용자 ID는 표시하지 않습니다" | Good operational guardrail. Continue keeping admin-only language clear. |
| Caution | "후보", "강한 흐름", "강한 움직임", "주도력 강화" | Global and alt push samples/events use candidate and strength wording. | Can be acceptable with "확인" wording, but repeated push delivery could make it feel like opportunity chasing. |
| Caution | "매수가/무효화 알림" | Saved-condition section title and button in `RadarAlertCenter`; related links from coin home. | "무효화" is good risk framing, but "매수가" can read more actionable than "판단 기준". |
| Caution | "롱 우세", "숏 우세" | Browser-local `RadarAlertMonitor` notification and stock setup labels. | Not a direct entry instruction, but closer to position language than server push copy. |
| Caution | External news headline passthrough | `macroScanner` uses `firstIssue` or `headline` as the push body. | Runtime copy may be longer or less bounded than first-party copy; cannot be fully judged by source inspection alone. |
| Caution | Basic/Pro limit copy | "Pro에서는 장중 재확인이 가능합니다." | Not aggressive, but should stay factual and avoid implying Pro is required for urgent trading. |
| High risk | Direct instruction or guarantee | No confirmed alert-specific match found for "지금 매수", "지금 매도", "롱 진입", "숏 진입", "확정 수익", "무조건", or "급등 보장". | No immediate high-risk implementation run is required from this audit alone. |

### Safe Copy Patterns To Preserve

- Use "감지되었습니다" with "확인해 주세요" rather than action verbs.
- Pair directional or strength wording with evidence/risk confirmation.
- Prefer "조건", "근거", "리스크", "변동성", "무효화", "흐름", and "다시 확인" over entry language.
- Keep browser preview and Android app push distinction explicit.
- Keep admin diagnostics clear that no real push send happens during diagnostics.
- Keep Pro/Basic limit copy factual: quota, availability, and scope rather than urgency.

### Caution Patterns To Review In A Separate Copy Run

- Replace or soften "강한 후보" and "강한 움직임" where a mobile push could read as chasing momentum.
- Consider changing "매수가/무효화 알림" to a less trade-direct label such as "판단 기준/무효화 알림" or "조건/무효화 알림".
- Normalize browser-local "롱 우세"/"숏 우세" to less position-like wording if it appears in user notifications.
- Wrap external news headline push bodies with first-party context and length limits instead of sending raw headline/key-issue text directly.
- Review "먼저 봐야 할 코인을 놓치지 않게" because it can read as mild FOMO even though it is not a direct trading instruction.

### Confirmed High-Risk Findings

- No confirmed alert-specific high-risk copy was found in the inspected source set.
- No inspected alert copy promised profit, guaranteed return, risk-free outcome, urgent entry, or immediate buy/sell action.
- No code or user-facing copy was changed in this task.

### Improvement Candidates For A Later Implementation Run

| Candidate | Why | Risk | Implementation allowed now? |
| --- | --- | --- | --- |
| Alert copy normalization pass for "candidate/strong" wording | Keeps push copy from feeling like momentum chasing, especially on mobile where body text is short. | LOW | No |
| Rename "매수가/무효화 알림" to less buy-action wording | Improves judgment-support framing on the alert settings screen and related CTAs. | MEDIUM because it touches user-facing UI copy | No |
| Replace browser notification "롱/숏 우세" with safer direction wording | Reduces perceived position instruction in browser-local notifications. | MEDIUM because it touches notification copy | No |
| Add first-party wrapper/length cap for macro/news push body | Reduces external headline copy risk and mobile truncation risk. | MEDIUM because it touches server push copy | No |

### Next TODO - Duplicate And Cooldown Policy Points

- Check whether repeated "후보", "강한", or "감지" alerts could create pressure even if each individual message is safe.
- Inspect whether global batching already reduces repeated momentum/asset wording enough for a single user.
- Verify whether cooldown and duplicate keys cover both market-wide scout events and saved-condition events.
- Keep copy findings separate from cooldown implementation; do not edit cooldown or push-cron logic in the next audit task.

## Task 3 - Duplicate And Cooldown Policy Audit

| Field | Value |
| --- | --- |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Source inspection only. No push endpoint, admin diagnostics endpoint, browser notification, OS permission prompt, database, token, external console, Android device, or production-mutating command was executed. |
| Scope inspected | Duplicate guard, cooldown decision, send flow, push event key buckets, scan-level limits, diagnostics counters, push token preferences, local browser notification dedupe, and schema references. |
| Implementation allowed in this run? | `No` |

### Sources Inspected

| Source | Relevance |
| --- | --- |
| `src/lib/server/pushAlertScanner.ts` | Main per-user scan flow, recent sent-event lookup, cooldown gate, duplicate gate, dry-run simulation, send accounting, and diagnostics counters. |
| `src/lib/server/push/cooldown.ts` | Current symbol cooldown, crypto alt market-scout cooldown, and market-scout global cooldown rules. |
| `src/lib/server/push/duplicateGuard.ts` | `eventBucket`, `alreadySent`, `recentSentEvents`, and `recordSentEvent` helpers. |
| `src/lib/server/push/sendPush.ts` | Per-user target-token filtering, duplicate re-check before FCM send, FCM result accounting, and sent-event recording. |
| `src/lib/server/push/eventBuilders.ts` | Event-key construction, time buckets, scan-level event limits, and global batching helpers. |
| `src/lib/server/push/genericEvents.ts` | Generic crypto/global event assembly and market-scout/global batch limit output. |
| `src/lib/server/push/preferences.ts` | Token market/rule filtering before delivery. |
| `src/lib/server/push/types.ts` | Duplicate, cooldown, rate-limit, and global-batch diagnostics fields. |
| `src/components/RadarAlertMonitor.tsx` | Browser-local notification interval and localStorage notified-id dedupe. |
| `src/lib/setupAlertPresets.ts` | Local setup match ids and visible-match dedupe used by browser/setup alert surfaces. |
| `src/app/api/push-tokens/route.ts` | Token preference merge and preset sync flow that affects later delivery targeting. |
| `supabase/migrations/20260519_push_tokens.sql` | `push_alert_events` table and unique `(user_id, event_key)` index reference. |

### Current Duplicate Prevention

- Server push dedupe is primarily per user and per `eventKey`.
- `eventKey` values include a time bucket from `eventBucket(minutes)`. Source inspection found 15-minute buckets for setup, watchlist, global momentum, and global asset events; 30-minute buckets for risk-off, semiconductor leadership, and liquidation events; 180-minute buckets for macro news; and 360-minute buckets for macro calendar reminders.
- `alreadySent(userId, eventKey)` checks `push_alert_events` before delivery, and `sendEventToUser` performs this duplicate re-check immediately before FCM send.
- `recordSentEvent(userId, event, sentCount)` writes one sent-event row when at least one FCM target succeeds.
- The migration defines a unique index on `(user_id, event_key)`, which is a second-layer duplicate record guard after application-level checks.
- `runPushAlertScan` reads recent sent events once per user and keeps an in-memory `recentRowsForUser` list. In dry-run and send paths, successfully sendable events are added to that list so later candidates in the same scan can be blocked by cooldown.
- Setup candidate selection also reduces repeated symbols before delivery. `topPushSetups` removes duplicate symbols before selecting top setup candidates.
- Market-wide scan limits reduce same-scan repetition: crypto alt market-scout events are limited to one per scan, crypto major market-scout events to two per scan, global momentum events to one batched event per scan, and global asset events to one batched event per scan.
- Browser-local notifications are separate from Android FCM. `RadarAlertMonitor` runs every five minutes while the app is open, skips Android native browser notifications, stores notified match ids in localStorage, and keeps the latest 80 ids per market.

### Current Cooldown And Rate-Limit Policy

| Policy | Current behavior from source inspection | Risk read |
| --- | --- | --- |
| Recent-event lookback | Server scanner loads each user's sent events from the last 6 hours. | Supports short-term cooldown only; not a daily fatigue cap. |
| Setup score events | Events with `score !== undefined` use a same-market, same-kind, same-symbol cooldown of 120 minutes. | Good symbol-level repetition guard for setup/watchlist-like events. |
| Liquidation pressure | Liquidation events use a 180-minute same-symbol cooldown. | Good for a high-volatility source, but still no cross-family user cap. |
| Crypto alt market scout | Same-symbol alt market-scout cooldown is 360 minutes. | Strong guard for repeated alt suggestions. |
| Crypto alt market-scout global limit | Any recent crypto alt `market_scout` event in the last 60 minutes blocks another alt market-scout candidate. | Good user-fatigue guard for noisy alt conditions. |
| Market scout scan limit | At event-build time, alt market-scout events are capped to 1 per scan and major crypto market-scout events to 2 per scan. | Reduces burst volume before user-specific gates. |
| Global momentum batch | Global momentum candidates are compacted into at most one batched event per scan. | Strong safety element for global repetition. |
| Global asset batch | Global asset candidates are compacted into at most one batched event per scan. | Strong safety element for asset-list repetition. |
| Macro news | Macro news uses a 180-minute event-key bucket. No separate cooldown rule was found when the event has no score. | Repetition depends on event key construction and source content. |
| Macro calendar | Macro calendar reminder uses a 360-minute event-key bucket. No separate cooldown rule was found when the event has no score. | Usually acceptable for scheduled reminders, but no user-level daily cap. |
| Basic/Pro cooldown difference | No plan-specific cooldown difference was found. Entitlement gates decide allowed rules, not cooldown duration. | Continue in TODO 4; this may be okay, but it should be explicit. |
| User global cap | No explicit per-user hourly or daily total push cap was found. | Main fatigue-risk gap. |
| Server-side vs local | Android FCM cooldown is server-side through `push_alert_events`; browser preview dedupe is localStorage only. | The two alert surfaces can differ by device and session. |

### Confirmed Safety Elements

- Real FCM send is isolated behind `/api/push-cron` send mode and `sendEventToUser`; this audit did not run those paths.
- Per-user event-key duplicate checks happen before FCM send, not only after.
- The database unique index on `(user_id, event_key)` protects the sent-event history from duplicate records.
- Same-scan in-memory recent-row updates reduce repeated sends from multiple candidates in a single scan.
- Crypto alt and global market-scout sources have scan-level caps before user-specific delivery.
- Global momentum and global asset alerts are batched rather than sending every individual asset candidate.
- Diagnostics counters separately track duplicate, cooldown, rate-limit, global batch, and skipped samples, which supports future dry-run review without changing logic.
- Browser-local notification dedupe records notified ids and sends at most one fresh browser notification per market check.

### Risks And Uncertain Areas

- No explicit per-user hourly or daily push volume cap was found. If several alert families fire together, a user could still receive multiple pushes in a short window.
- Cooldown is not plan-specific. Basic/Pro differences appear to come from entitlement and rule gating, not different noise controls.
- Optional macro, news, liquidation, setup, market-scout, and global sources can all contribute events in the same scan. Some are capped, but no cross-family priority queue or total cap was found.
- Macro/news copy and uniqueness are partly dependent on external source content. A new headline or key issue can create a new event key even if the user-facing meaning is similar.
- Concurrent cron executions can race. Two runs can pass `alreadySent` before either records the sent event; the DB unique index can prevent duplicate history rows, but it does not necessarily prevent duplicate FCM sends that already happened.
- If FCM succeeds but `recordSentEvent` fails afterward, later scans may not know the user already received that event. This is a duplicate-risk and accounting-risk case.
- If all FCM sends fail, no sent-event row is recorded, so a later retry may send again. That is reasonable for delivery recovery, but it still needs operational monitoring.
- If some tokens succeed and some fail, the user-level event record blocks the same event later for all tokens. This favors duplicate prevention over retrying failed devices.
- Users with multiple enabled devices can receive the same event on more than one device. This is expected token behavior, but the user can perceive it as duplicate delivery.
- Token preferences are read at scan time. Setting changes during a scan may not affect that in-flight scan.
- User-level event history can block a newly enabled token from receiving the same event if another token already recorded the event in the same bucket.
- Browser-local notification dedupe is localStorage-scoped. It does not share server push history and can reset by browser/device/storage state.
- Browser setup match ids include dynamic scan context, so the same semantic condition could appear as a new match if generated with a different id.

### User Fatigue Operating Criteria Candidates

- Default target: keep ordinary users near 3 to 5 push notifications per day unless they explicitly save many watchlist conditions.
- Burst target: avoid more than 1 to 2 non-critical pushes per hour.
- Highest priority: major risk-off, liquidation pressure, macro-calendar/news items with broad market impact, and user-saved watchlist matches.
- Medium priority: global momentum or global asset summary events, especially when batched.
- Lower priority: broad market-scout candidates that are not tied to a saved symbol or watched condition.
- Repetition rule candidate: avoid sending the same-market, same-meaning alert family repeatedly even when event keys differ.
- Bundling rule candidate: combine lower-priority market-wide alerts into a summary instead of sending separate pushes.
- Retry rule candidate: make post-FCM sent-event recording failures visible in diagnostics before changing retry behavior.

### Improvement Candidates For A Later Implementation Run

| Candidate | Why | Risk | Implementation allowed now? |
| --- | --- | --- | --- |
| Add a per-user hourly/daily push volume cap | Directly limits fatigue across alert families. | MEDIUM because it changes delivery behavior and needs careful diagnostics. | No |
| Add a cross-family priority queue before sending | Prevents macro/news/setup/global events from all arriving together. | MEDIUM to HIGH because it changes alert ordering and user expectations. | No |
| Add a concurrency/idempotency guard around cron send attempts | Reduces duplicate FCM sends during overlapping cron executions. | HIGH because it likely touches push-cron, DB, or locking strategy. | No |
| Track sent-event recording failures explicitly | Improves detection of FCM-success/history-write-failure mismatch. | MEDIUM because it changes send accounting and diagnostics. | No |
| Add semantic cooldown for macro/news alerts | Prevents similar headline/key-issue pushes from repeating with different event keys. | MEDIUM because it touches scanner/event-key policy. | No |
| Document multi-device delivery expectations in settings/help copy | Reduces perceived duplicate confusion when one user has several devices. | LOW to MEDIUM because it touches user-facing copy. | No |

### Next TODO - Basic/Pro Alert Limit Points

- Verify whether Basic/Pro gating is consistent between `RadarAlertCenter`, `radarAlertRules`, `usageMeter`, token preferences, and server `ruleAllowed`.
- Pay special attention to system events: `tokenWants` bypasses rule preferences for non-watchlist system events, so market preference and entitlement gates matter more than individual rule toggles for those events.
- Confirm whether Basic users can see, save, or sync settings for rules that server delivery later blocks.
- Confirm whether Pro plan differences should affect only rule availability or also noise controls such as cooldown, scan caps, or total alert volume.
- Keep this as an audit only. Do not edit entitlement, RevenueCat, billing, RLS, token preference, or push logic.

## Task 4 - Basic/Pro Alert Limit Audit

| Field | Value |
| --- | --- |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Source inspection only. No push endpoint, admin diagnostics endpoint, billing endpoint, purchase, restore, database, token, external console, Android device, or production-mutating command was executed. |
| Scope inspected | Billing plan scopes, alert rule tiers, UI alert settings gate, local usage gate, Android token preference sync, server push entitlement gate, token preference gate, subscription/profile plan resolution, and Pro pricing display references. |
| Implementation allowed in this run? | `No` |

### Sources Inspected

| Source | Relevance |
| --- | --- |
| `src/lib/billing.ts` | Plan ids, market scopes, alert limit labels, store entitlement mapping, combined plan resolution, and `hasMarketEntitlement`. |
| `src/lib/radarAlerts.ts` | Alert rule ids, categories, `free`/`pro` tier labels, default-enabled rules, and summary counts. |
| `src/components/RadarAlertCenter.tsx` | UI rule display, market scoping, Pro/Basic badges, local usage gate, notification permission flow, Android push connect flow, and preference sync. |
| `src/lib/usageMeter.ts` | Local daily usage buckets for `cryptoAlertRule` and `stocksAlertRule`. |
| `src/lib/server/push/entitlements.ts` | Server-side `userPlan` and `ruleAllowed` before push delivery. |
| `src/lib/server/pushAlertScanner.ts` | Runtime order: profiles/subscriptions, quality gate, entitlement gate, token preference, cooldown, duplicate, send. |
| `src/lib/server/push/preferences.ts` | Token market/rule preference filtering and system-event rule-preference bypass. |
| `src/lib/server/push/genericEvents.ts` | Generic market-scout/global event construction path. |
| `src/lib/server/push/eventBuilders.ts` | System market-scout/global event flags and watchlist event flags. |
| `src/lib/server/push/presetEvents.ts` | Saved preset events mapped to watchlist rule ids. |
| `src/lib/server/push/scanners/liquidationScanner.ts` | Liquidation pressure event rule id and `system` flag. |
| `src/lib/server/push/scanners/macroScanner.ts` | Macro/news event rule id and `system` flag. |
| `src/lib/appPush.ts` | Android token sync payload: `market`, `ruleIds`, `presets`, and login requirement. |
| `src/app/api/push-tokens/route.ts` | Token market/rule/preset merge and persistence path. |
| `src/lib/useSupabaseAuth.ts` | Client-side entitlement refresh and profile plan resolution from active subscriptions/profile/metadata. |
| `src/components/ProPricingPanel.tsx` | Pro plan display, alert limit rows, scope-specific plan cards, purchase/restore surfaces. |
| `src/app/alerts/page.tsx`, `src/app/crypto/alert/page.tsx`, `src/app/pro/page.tsx` | Alert and Pro route scoping. |

### Basic/Pro Alert Limit Structure Summary

- Plan scopes are defined in `billing.ts`: Basic has `trial`, Coin Pro has `crypto`, Global Pro has `stocks`, and All Market Pro has `bundle`.
- `hasMarketEntitlement(plan, "crypto" | "stocks")` returns market-specific access for current paid plan ids, while legacy `member`, `premium`, and `admin` return broad market access.
- Alert rules are defined separately from billing plans. `macro-news` is the only `free` rule in `radarAlertRules`; `radar-grade`, `liquidation-pressure`, `watchlist-surge`, and `stock-momentum` are `pro`.
- The alert settings UI filters rules by current market plus `news`/`system` categories. It displays `Pro`/`Basic` badges, but source inspection did not find a hard disabled state for Pro rule toggles when `isPaid` is false.
- The UI uses `getUsageGate(alertUsageBucketId, isPaid)` when enabling a rule or requesting browser preview permission. This is localStorage-based usage gating, not the same as server entitlement.
- Android push registration requires login and sends the current market, enabled rule ids, and saved presets to `/api/push-tokens`. The token API authenticates the user but does not perform plan entitlement checks; server push scanning is the later enforcement point.
- Server push scanning resolves plan from active/trialing subscriptions and profile, then calls `ruleAllowed(event, plan)` before token preferences and send attempts.
- `ruleAllowed` allows `free` rules and market-matching Pro rules for entitled plans. However, it returns `true` for `event.system` before checking rule tier or market entitlement.
- Token preferences also bypass rule-id matching for non-watchlist system events. Those events still need a matching token market, but not a matching rule id.

### Product Allow/Limit Table

| User state | Billing plan scope and displayed alert limit | UI alert settings behavior from source | Server non-system rule behavior | System-event behavior to verify |
| --- | --- | --- | --- | --- |
| Basic | `free`; plan copy says market-level basic alerts and `alerts: "market별 1개"`. | `isPaid` is false; local usage gate uses 1 daily crypto alert-rule action and 1 daily stocks alert-rule action. Pro rules are still visible with Pro badges and can appear enabled by defaults/local storage. | `macro-news` free rule allowed. Crypto/stocks Pro rules should be blocked by `ruleAllowed` when event is not system. | System market-scout, liquidation, macro, and global composite events can bypass `ruleAllowed` tier checks if the token market matches. This is the highest-risk consistency gap. |
| Coin Pro monthly/yearly | `crypto`; billing copy says crypto alert conditions 20 monthly or 30 yearly. | Crypto alert page sees `isPaid` true and local usage gate uses 20. Global alert page sees `isPaid` false and uses Basic gate. | Crypto non-system Pro rules allowed. Stocks non-system Pro rules blocked. | If the user also has a stocks token market, stock/global system events may bypass tier checks despite Coin-only entitlement. |
| Global Pro monthly/yearly | `stocks`; billing copy says global alert conditions 20 monthly or 30 yearly. | Global alert page sees `isPaid` true and local usage gate uses 20. Crypto alert page sees `isPaid` false and uses Basic gate. | Stocks non-system Pro rules allowed. Crypto non-system Pro rules blocked. | If the user also has a crypto token market, crypto system events may bypass tier checks despite Global-only entitlement. |
| All Market Pro monthly | `bundle`; billing copy says market-level alert conditions 30. | Both crypto and global alert pages see `isPaid` true, but local alert-rule gate uses 20 for each market. | Crypto and stocks non-system Pro rules allowed. | System events also allowed; this is consistent with broad entitlement, but count labels differ from local gate. |
| All Market Pro 6-month | `bundle`; billing copy says market-level alert conditions 40. | Both crypto and global alert pages see `isPaid` true, but local alert-rule gate uses 20 for each market. | Crypto and stocks non-system Pro rules allowed. | System events also allowed; this is consistent with broad entitlement, but count labels differ from local gate. |
| Legacy `member`/`premium`/`admin` | Treated as paid broad access by `hasMarketEntitlement`; `admin` label resolves to All Market Pro. | Both markets should see paid access if profile is one of these legacy/admin plans. | Crypto and stocks non-system Pro rules allowed. | Broad system-event delivery is consistent with broad access, but legacy plan copy may be less explicit. |

### UI Gating / Server Gating Comparison

| Layer | Current behavior | Safety read |
| --- | --- | --- |
| Plan display | `/pro` uses billing plan scopes and shows alert limit rows for Basic, Coin Pro, Global Pro, and All Market Pro. | Clear product-level source of truth for user-facing plan scope, but local alert usage limits do not fully match yearly/bundle limit labels. |
| Alert settings route | `/crypto/alert` shows crypto rules; `/alerts?market=global` shows stocks/global rules; `/alerts` redirects crypto to `/crypto/alert`. | Route scoping is clear. |
| Rule visibility | Rules are filtered by market and display `Pro` or `Basic` badges. | The badge is informative, not a hard gate. Basic users can still see Pro toggles. |
| Rule toggle | Enabling a rule uses local usage gate. It does not check `rule.tier` against `profile.plan` before allowing the toggle state. | Risk of "it looks enabled" for Basic users even when server later blocks non-system Pro delivery. |
| Browser preview permission | Non-Android browser permission request also uses local usage gate and can create a browser notification preview. | Browser preview is not the same as server FCM entitlement enforcement. |
| Android push registration | Requires login, Android support, permission, token registration, and `/api/push-tokens` sync. | Good login/token safety. Plan enforcement is not in token registration. |
| Token persistence | `/api/push-tokens` merges existing and new `markets`/`rule_ids`; it syncs presets by market when provided. | Existing market/rule state can persist across plan changes or later UI changes until sync updates it. |
| Server plan resolution | Scanner reads active/trialing subscriptions and profiles, then combines plans with `resolveCombinedBillingEntitlementPlan`. | Stronger than client-only gate and handles active subscription state. |
| Server rule gate | `ruleAllowed` gates non-system Pro rules by `hasMarketEntitlement`. | Good for watchlist/preset Pro rules and non-system rule events. |
| Server system-event gate | `ruleAllowed` returns true for `event.system`; `tokenPreferenceDecision` also bypasses rule preference for non-watchlist system events. | High-risk consistency gap. Market preference still applies, but plan tier and selected rule id may not. |
| Saved preset events | Server `buildUserPresetEvents` maps saved conditions to watchlist rules without `system: true`. | Safer: Basic or wrong-market plans should be blocked by `ruleAllowed`. |
| Client entitlement refresh | `useSupabaseAuth` refreshes profile/subscription entitlement on load, focus, visibility, auth refresh event, and 30-second interval. | Helps reduce stale UI plan state, but server remains the final authority. |

### Confirmed Safety Elements

- Market entitlement helpers correctly distinguish `crypto`, `stocks`, and `bundle` plan scopes for non-system checks.
- Server push scan applies entitlement before token preference, cooldown, duplicate guard, and send attempts.
- Active/trialing subscriptions are read separately from profile plan during server scan; expired subscription rows are filtered by `current_period_end`.
- Saved preset/watchlist push events are non-system and should pass through normal Pro entitlement gates.
- Android push registration requires a logged-in Supabase session before token sync.
- The alert settings UI shows Pro/Basic badges beside each rule, so the tier distinction is at least visible.
- `/pro` plan cards show market scope and alert limit copy before checkout.
- Purchase, restore, RevenueCat, billing sync, Supabase, and RLS code paths were not executed or modified.

### Risks And Uncertain Areas

- Basic users can see Pro rule toggles and may have Pro default rule ids stored locally. This can make the UI look more enabled than server delivery actually permits.
- Billing plan copy and local usage gate counts are not fully aligned. Yearly Coin/Global plans show 30 alert conditions, All Market monthly shows 30, and All Market 6-month shows 40, but `usageMeter` uses `proDailyLimit: 20` for both crypto and stocks alert-rule buckets.
- `/api/push-tokens` accepts and merges markets/rule ids/presets after authentication without checking entitlement. That is acceptable if scanner enforcement is complete, but it makes server push gating the only real paid boundary.
- `event.system` bypasses `ruleAllowed` entirely. Current generic market-scout, liquidation, macro/news, macro calendar, risk-off, and semiconductor/global composite events include system-style paths, so paid-boundary consistency depends on whether those events are intended to be free operational alerts or Pro market alerts.
- Token preferences bypass rule ids for non-watchlist system events. A disabled Pro rule may not block a system event with the same rule id if the token market still matches.
- Cross-market risk exists if a user has previously synced both markets on one token and later has only Coin Pro or only Global Pro. Non-system wrong-market Pro events should be blocked, but system wrong-market events may still pass if market preference remains.
- Plan downgrade, subscription expiry, restore delay, or RevenueCat/App Store sync delay can leave the UI and token preferences out of sync until entitlement refresh and token sync complete.
- Existing token `markets` and `rule_ids` are merged rather than replaced. This reduces accidental loss of preferences, but can keep stale market/rule preferences after plan or UI changes.
- Local browser notification behavior and Android FCM behavior are not equivalent. Browser preview/local monitor can make alerts appear available even when Android server delivery would be filtered.
- This audit did not verify live production subscriptions, token rows, or actual RevenueCat/Google Play entitlement state.

### Improvement Candidates For A Later Implementation Run

| Candidate | Why | Risk | Implementation allowed now? |
| --- | --- | --- | --- |
| Decide and document whether system market-scout/liquidation/global events are free or Pro-gated | The current `event.system` bypass is the largest Basic/Pro consistency question. | HIGH because it touches push entitlement policy and possibly alert delivery. | No |
| Add a server-side entitlement check to system events that represent Pro market alerts | Aligns server delivery with Pro rule tiers if those events are not intended as free alerts. | HIGH because it changes delivery behavior. | No |
| Make UI Pro rule toggles clearly locked or explanatory for Basic users | Reduces "enabled but not delivered" confusion. | MEDIUM because it touches user-facing alert settings UI. | No |
| Align alert limit numbers between `billing.ts` plan copy and `usageMeter` buckets | Prevents paid users from seeing 30/40 in plan copy but 20 in local gate. | MEDIUM because it affects quota semantics. | No |
| Replace merge-only token preference sync with market-scoped replacement or explicit stale preference cleanup | Reduces cross-market and downgrade drift. | MEDIUM to HIGH because it changes token persistence semantics. | No |
| Add plan-state messaging for expired/restoring/delayed entitlement | Reduces "I paid but alerts did not come" support risk. | MEDIUM because it touches auth/billing/alert UX. | No |

### High-Risk Areas To Keep Protected

- `src/lib/billing.ts`, `src/lib/mobilePurchases.ts`, billing API routes, RevenueCat product/entitlement mapping, Google Play product/base-plan ids, prices, and restore flow.
- `src/lib/server/push/entitlements.ts`, `src/lib/server/pushAlertScanner.ts`, `src/lib/server/push/preferences.ts`, and `/api/push-tokens`.
- Supabase `profiles`, `subscriptions`, `push_tokens`, `push_alert_presets`, `push_alert_events`, and RLS policies.
- Android native/release settings, FCM configuration, Play Console, RevenueCat dashboard, and production DB/token rows.

### Next TODO - targetPath Routing Quality Points

- Inspect where each alert type sends users: `/crypto`, `/alerts?market=crypto`, `/alerts?market=global`, `/global`, `/global/assets`, `/schedule`, and news routes.
- Check whether Basic/Pro-gated target screens could create confusion after a notification tap.
- Verify fallback behavior for missing or absent `targetPath` through source only.
- Keep routing audit separate from entitlement fixes; do not edit routes, targetPath helpers, push listeners, or Android back-stack behavior.

## Task 5 - targetPath Routing Quality Audit

| Field | Value |
| --- | --- |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Source inspection only. No push endpoint, push send, push click test, browser navigation, Android device, database, token, external console, or production-mutating command was executed. |
| Scope inspected | Push payload metadata, targetPath generation, targetPath allowlist, metadata fallback, Capacitor click listener, FCM data payload, admin test payload, route existence, login returnTo behavior, and Basic/Pro target-screen expectations. |
| Implementation allowed in this run? | `No` |

### Sources Inspected

| Source | Relevance |
| --- | --- |
| `src/lib/pushTargetPath.ts` | Central allowlist, sanitizer, metadata fallback, and final fallback for notification navigation. |
| `src/lib/appPush.ts` | Capacitor push action data merge and `window.location.assign(targetPath)` on notification tap. |
| `src/lib/server/firebaseMessaging.ts` | FCM HTTP v1 payload passes `event.data` into message `data`; Android notification uses `click_action: "OPEN_ALERTS"`. |
| `src/lib/server/push/sendPush.ts` | Server send path passes generated event metadata into FCM. |
| `src/lib/server/push/targets.ts` | Symbol-to-target helpers for crypto major/alt and global index/asset routes. |
| `src/lib/server/push/eventBuilders.ts` | Setup, watchlist, global momentum, global asset, risk-off, and semiconductor targetPath generation. |
| `src/lib/server/push/scanners/liquidationScanner.ts` | Liquidation targetPath generation. |
| `src/lib/server/push/scanners/macroScanner.ts` | News and macro-calendar targetPath generation. |
| `src/lib/pushTestMessages.ts` and `src/app/api/push-test/route.ts` | Admin/test targetPath examples and test FCM payload shape. |
| `src/app/alerts/page.tsx`, `src/app/crypto/alert/page.tsx` | Alert settings route and `/alerts` crypto redirect behavior. |
| `src/app/alts/page.tsx`, `src/app/crypto/page.tsx`, `src/app/global/page.tsx`, `src/app/global/assets/page.tsx` | Current allowed route existence and redirect behavior. |
| `src/app/news/page.tsx`, `src/app/schedule/page.tsx`, `src/app/journal/page.tsx` | Current news, schedule, and journal targets. |
| `src/app/login/page.tsx`, `src/app/auth/callback/page.tsx`, `src/components/GoogleLoginButton.tsx`, `src/components/AuthStatus.tsx` | Login `returnTo` behavior and safe internal-path checks. |
| `src/components/GlobalMarketPulse.tsx`, `src/components/StockRadarApp.tsx`, `src/components/SetupScoutPanel.tsx`, `src/components/crypto/CryptoProGate.tsx` | Basic/Pro target-screen gating expectations. |

### targetPath Generation Summary

| Alert source/type | Generated targetPath | Route behavior from source inspection |
| --- | --- | --- |
| Crypto major market scout | `/crypto` via `setupTargetPath` and `cryptoSetupTargetPath`. | `/crypto` exists and redirects to `/crypto/home`. |
| Crypto alt market scout | `/alts` via `setupTargetPath` for non-major crypto symbols. | `/alts` exists and redirects to `/crypto/perpetual/alts`. |
| Crypto saved/watchlist setup | `/crypto` for major symbols or `/alts` for alt symbols. | Same as crypto market scout. |
| Global index momentum | `/global` via `stockSetupTargetPath` for index symbols. | `/global` exists. |
| Global asset momentum | `/global/assets` via `stockSetupTargetPath` for non-index global symbols. | `/global/assets` exists. |
| Global risk-off composite | `/global`. | `/global` exists. |
| Semiconductor leadership composite | `/global/assets`. | `/global/assets` exists. |
| Global momentum batch | `/global`. | `/global` exists. |
| Global asset batch | `/global/assets`. | `/global/assets` exists. |
| Liquidation pressure | `/crypto`. | `/crypto` redirects to `/crypto/home`. |
| News/macro event | `/news?market=crypto` or `/news?market=global`. | Global news route exists; crypto news query redirects to `/crypto/news`. |
| Macro calendar reminder | `/schedule`. | `/schedule` exists and derives market from query when present. |
| Admin/default push test | `/alerts` or metadata-derived crypto/global route. | `/alerts` exists; no market query means crypto redirect to `/crypto/alert`. |
| Journal allowlist entries | `/journal?market=crypto`, `/journal?market=global`. | Routes exist, but current inspected push generators do not appear to emit journal targetPath. |
| Pro/settings/account | No allowed targetPath found. | Notifications do not directly route to `/pro`, `/settings`, `/account`, or `/menu` by allowlist. |

### Allowlist And Fallback Structure

- `sanitizePushTargetPath` accepts only strings that start with `/`, do not start with `//`, do not contain backslashes, and do not contain ASCII control characters.
- The sanitizer is exact-match only against `allowedPushTargetPaths`: `/alerts`, `/crypto`, `/alts`, `/global`, `/global/assets`, `/schedule`, `/news?market=global`, `/news?market=crypto`, `/journal?market=global`, and `/journal?market=crypto`.
- External URLs, protocol-relative paths, paths with backslashes, arbitrary unknown paths, and unlisted query strings are rejected.
- `resolvePushTargetPath` prefers a valid explicit `targetPath` unless it is `/alerts`.
- If explicit `targetPath` is `/alerts`, the resolver first tries metadata-based routing from `type`, `alertKind`, `alert_kind`, `kind`, `market`, and `symbol`.
- If metadata can resolve a route, it wins over `/alerts` and over many generic target values.
- If metadata cannot resolve a route, the resolver falls back to explicit `/alerts`, then sanitized `target`, then final `/alerts`.
- Because target query strings are exact-match allowlisted, `target: "/alerts?market=global"` is not accepted by the sanitizer. It only reaches a global destination when metadata itself resolves to a global route.

### Notification Click Flow

- `sendEventToUser` passes `event.data` to `sendFcmMessage`; FCM sends it as Android `message.data`.
- The Android notification includes `click_action: "OPEN_ALERTS"` and the same data payload.
- `registerAppPushListeners` registers a Capacitor `pushNotificationActionPerformed` listener.
- On tap, `pushActionData` merges nested notification data and top-level event data. Top-level `event.data` wins if the same key appears in more than one place.
- The merged data is resolved through `resolvePushTargetPath`.
- The app then calls `window.location.assign(targetPath)`.
- No source-level retry, pending navigation queue, or post-login redirect is attached to the push click itself.

### Login Needed State Expectations

- Current allowlisted target paths mostly point to public or Basic-capable app pages rather than strictly login-only pages.
- `/journal?market=...` uses `useSupabaseAuth`; when no session is present, source inspection shows local entries are loaded and remote sync is skipped. That means a notification tap to journal is not a hard login redirect.
- Alert settings require login for Android push token sync, but `/alerts` and `/crypto/alert` still render the settings UI and show login CTAs for app push connection.
- Login pages support safe internal `returnTo` parameters, and OAuth callback returns to a sanitized internal path. However, a push click does not automatically route to `/login?returnTo=<targetPath>`.
- If a future notification target becomes truly login-required, source inspection found no dedicated push-click path preservation beyond the page's own login link behavior.

### Pro Limited State Expectations

- The allowlist does not send users directly to `/pro`, so push taps land on market/news/schedule/journal/alert pages first.
- Coin target routes such as `/crypto` and `/alts` can show Basic-access summaries and Coin Pro CTAs through existing crypto Pro gate components.
- Global target routes such as `/global` and `/global/assets` can show Basic-access summaries and Global Pro CTAs through `GlobalMarketPulse` and `StockRadarApp` gating.
- This is safer than routing straight to checkout, but users can still experience "alert opened a page where details are locked" if the alert was generated for a Pro-level condition.
- The previous Basic/Pro audit still matters here: if system events bypass entitlement, a Basic user could tap into a Pro-limited market page and see only Basic summaries.

### Confirmed Safety Elements

- External URL navigation is blocked by the sanitizer because only exact internal allowlist paths are accepted.
- Protocol-relative URLs, backslash paths, control-character paths, unknown paths, and arbitrary query strings are rejected.
- All currently allowlisted route bases exist in the repo. `/crypto` and `/alts` intentionally redirect to current crypto home/perpetual-alt routes.
- Metadata fallback reduces bad generic `/alerts` landings for events that include market, symbol, and alert kind.
- Missing or invalid target data falls back to `/alerts`, which is an internal app route.
- No notification can directly open `/pro`, checkout, account deletion, settings, admin, billing, or external console paths through the current allowlist.
- This audit did not send a push, click a push, query production data, or change routing code.

### Risks And Uncertain Areas

- `/alerts?market=global` is used as a `target` value in several payloads, but it is not an allowed sanitized path. It depends on metadata fallback to reach the right global route.
- The allowlist includes `/journal?market=crypto` and `/journal?market=global`, but inspected push generators do not currently use those paths. The intended journal notification use case is unclear.
- If an allowlisted route is later deleted or converted to a different redirect, the resolver will still consider it valid. There is no route-existence check at runtime.
- `window.location.assign` is simple and predictable, but cold-start/background Android timing was not verified. A push action before listeners are registered or before web state is ready remains a manual QA question.
- The click listener does not preserve targetPath through login automatically. Future login-required alert targets need explicit handling.
- Existing fallback to `/alerts` without query redirects to `/crypto/alert`, so a malformed global alert can land on the crypto alert settings page.
- Query strings are exact-match allowlisted. This is safe, but brittle if future routes need additional query parameters such as symbol, id, source, or tab.
- `pushActionData` merge precedence makes top-level event data override nested notification data. This is reasonable, but source inspection cannot prove every Capacitor/FCM payload shape in production.
- Multiple devices can have different login/session/plan states; the same targetPath may display different Basic/Pro or local/remote journal states.
- No actual Android WebView deep-link, back-stack, app relaunch, or safe-area behavior was verified.

### Improvement Candidates For A Later Implementation Run

| Candidate | Why | Risk | Implementation allowed now? |
| --- | --- | --- | --- |
| Add `/alerts?market=global` and `/alerts?market=crypto` to explicit allowlist or stop using them as `target` values | Reduces reliance on metadata fallback and prevents malformed global alerts from landing on crypto alert settings. | MEDIUM because it touches routing resolver or payload conventions. | No |
| Add route-existence smoke coverage for allowed push target paths | Catches deleted/renamed allowlisted routes before release. | LOW to MEDIUM depending on smoke scope. | No |
| Add post-login return handling for future login-required notification targets | Prevents losing a notification destination if a route starts requiring login. | MEDIUM because it touches auth/navigation behavior. | No |
| Add a small targetPath matrix to admin diagnostics | Makes dry-run target outcomes visible without real push clicks. | MEDIUM because it touches diagnostics output. | No |
| Decide whether journal targetPath should be used or removed from allowlist | Clarifies whether journal notification routing is part of product scope. | LOW if documentation-only, MEDIUM if code changes. | No |
| Add Android manual QA cases for cold start, background tap, current-screen tap, and back behavior | Covers platform-specific behavior that source inspection cannot prove. | LOW as QA planning, MEDIUM if implemented as automation. | No |

### Next TODO - Alert Improvement Candidate Selection Points

- Strong candidates now documented across this run include system-event Basic/Pro gate ambiguity, alert limit copy vs usage-gate mismatch, `/alerts?market=global` target allowlist mismatch, and missing per-user total push cap.
- Choose exactly one first improvement candidate in Task 6.
- Favor a small, high-confidence implementation run candidate over broad alert redesign.
- Keep any actual code change, push delivery, billing, entitlement, routing, or production data work for a separate approved run.

## Task 6 - Alert Improvement Candidate Selection

| Field | Value |
| --- | --- |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Documentation synthesis only. No code, UI copy, alert logic, push endpoint, production data, token, external console, Android device, or production-mutating command was executed. |
| Scope synthesized | Task 1 alert structure, Task 2 copy quality, Task 3 duplicate/cooldown, Task 4 Basic/Pro gating, and Task 5 targetPath routing findings. |
| Selected follow-up run | `alert-pro-rule-ui-clarity-run` |
| Implementation allowed in this run? | `No` |

### TODO 1-5 Audit Summary

| Area | Key result | First-order risk |
| --- | --- | --- |
| Alert structure | Browser-local alert preview, Android FCM delivery, token sync, server scan, preferences, entitlement, cooldown, duplicate guard, and targetPath resolution are split across multiple surfaces. | Users may see settings as enabled while server delivery later filters them. |
| Copy quality | Most alert copy is judgment-support oriented, but several phrases can be softened, including candidate strength, invalidation-price framing, and directional long/short wording. | Alert copy can feel like trade instruction if phrasing becomes too strong. |
| Duplicate/cooldown | Existing event keys, sent-event history, symbol cooldowns, and scan-level batching reduce repetition. | There is no explicit per-user hourly/daily total push cap, and macro/news semantic repetition remains possible. |
| Basic/Pro gating | Non-system Pro events are server-gated by entitlement, but Basic users can still see Pro rules in the UI and system events bypass `ruleAllowed`. | The Basic/Pro boundary can look inconsistent before any server-side delivery decision. |
| targetPath routing | Internal allowlist and metadata fallback are generally safe, but `/alerts?market=global` relies on metadata fallback and push-click login returnTo is not preserved by the click listener itself. | Notification taps can land in a less expected route under malformed metadata or future login-required paths. |

### Consolidated Risk List

- Basic users may think Pro alert rules are enabled because Pro rules remain visible/toggle-like in the alert settings UI.
- Plan copy advertises alert limits such as 30 or 40 while local `usageMeter` Pro limits use 20 for alert-rule buckets.
- System events can bypass entitlement rule checks, making the free/paid alert boundary a policy question.
- No explicit user-level hourly or daily total push cap was found.
- Macro/news alerts may repeat semantically even when event keys differ.
- `/alerts?market=global` target values depend on metadata fallback instead of direct allowlist acceptance.
- Push-click login `returnTo` preservation is not implemented by the notification click listener itself.
- Android cold start or background push tap behavior cannot be proven from source inspection alone.
- Phrases such as strong candidate, invalidation-price alert, and long/short dominance should be softened in a later copy pass.

### Priority Evaluation

| Priority | Candidate | User impact | Implementation scope | Protected-surface risk | Verification feasibility | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Clarify Basic UI so Pro alert rules do not appear enabled for Basic users | HIGH | SMALL to MEDIUM UI/copy-only | LOW if entitlement, billing, Supabase, push-cron, and delivery logic stay untouched | High with source review plus static UI checks | Selected |
| 2 | Align `/alerts?market=global|crypto` targetPath allowlist or payload convention | MEDIUM to HIGH | MEDIUM routing/targetPath work | MEDIUM because navigation behavior changes | Good with route/static checks; push-click still separate | Defer |
| 3 | Resolve alert limit copy 30/40 vs usageMeter Pro 20 mismatch | HIGH | MEDIUM policy/copy/gating review | MEDIUM to HIGH because billing/plan copy and quota semantics are adjacent | Needs policy confirmation before edit | Defer |
| 4 | Decide system-event entitlement bypass policy | HIGH | MEDIUM to LARGE server policy work | HIGH because entitlement and delivery behavior can change | Needs design and server dry-run plan | Separate design run |
| 5 | Add per-user hourly/daily total cap | MEDIUM | LARGE server/data policy work | HIGH because push scanner and possibly DB semantics change | Needs dry-run diagnostics and rollout safety | Later operations run |
| 6 | Reduce macro/news semantic repetition | MEDIUM | MEDIUM scanner/copy/filter work | MEDIUM because generated events can change | Needs sample-based review and dry-run evidence | Later quality run |
| 7 | Preserve push-click returnTo for future login-required routes | MEDIUM | MEDIUM auth/navigation work | MEDIUM because auth routing changes | Needs manual and route checks | Later navigation run |
| 8 | Prove Android cold-start/background push tap behavior | MEDIUM | QA-only first | LOW for manual QA, MEDIUM for automation | Requires real device/manual run | Separate manual QA |
| 9 | Soften strong trade-like phrases | MEDIUM | SMALL copy-only | LOW if message generation semantics stay unchanged | Good with copy smoke | Later copy pass |

### Selected First Implementation Candidate

The first recommended implementation candidate is:

`Basic users should not see Pro alert rules as if they are enabled or deliverable.`

Proposed follow-up active-run name:

`alert-pro-rule-ui-clarity-run`

Recommended scope for that future run:

- Review `RadarAlertCenter` and related alert settings display only.
- Make Pro-only alert rules read as locked, unavailable, or explanatory for Basic users instead of enabled/deliverable.
- Keep Basic users aware that Pro alert rules exist without implying active delivery.
- Preserve current entitlement, billing, RevenueCat, Supabase, RLS, push-cron, scanner, token sync, and delivery behavior.
- Do not send push, query production DB/token rows, or modify actual alert delivery logic.
- Verify with `git diff --check`, type/build as appropriate for a UI-only change, and static copy checks.

### Selection Rationale

- It addresses immediate user trust: the user can understand why a Pro alert rule is visible but not active for Basic.
- It can be implemented as a small UI/copy clarification without changing payment, entitlement, RevenueCat, Supabase, push-cron, FCM, or production data.
- It reduces support risk around "I turned this on but did not receive alerts."
- It fits naturally after Android production auto smoke because it improves alert settings clarity without reopening Android release work.
- It is easier to roll back and verify than server entitlement, cooldown, DB, or targetPath changes.

### Guardrails For The Future Implementation Run

- Do not edit `src/lib/server/pushAlertScanner.ts`, `/api/push-cron`, FCM send helpers, `src/lib/appPush.ts`, token persistence, or cooldown/duplicate logic.
- Do not edit billing products, prices, plan IDs, product IDs, entitlements, RevenueCat mapping, Supabase RLS, or production data.
- Do not run actual push sends, purchase tests, restore tests, account deletion tests, or production DB/token queries.
- Treat any change to server-side delivery, entitlement filtering, targetPath routing, or quota policy as a separate high-risk run.

### Final Run Conclusion

`alert-quality-operations-run` completed as an audit and prioritization run. The first implementation candidate is `alert-pro-rule-ui-clarity-run`; it has now been registered separately after explicit implementation-run setup. No code, app UI, package, script, alert logic, push-cron, targetPath, billing, entitlement, Supabase, FCM, RevenueCat, Android release, production DB/token, or real push action was changed or executed in the original audit run.

### Follow-Up Active Run Registration

The follow-up implementation run `alert-pro-rule-ui-clarity-run` was registered on 2026-06-09. Its scope is intentionally narrow: clarify the alert settings UI/copy so Basic users do not interpret Pro alert rules as enabled or deliverable. The run excludes billing, entitlement, RevenueCat, Supabase, FCM, push-cron, scanner delivery logic, targetPath/routing, production DB/token work, real push sends, purchase/restore tests, and Android release changes.

## Follow-Up Run Task 1 - Alert Settings UI Location Audit

| Field | Value |
| --- | --- |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Source inspection only. No app code, UI code, copy, alert logic, route, targetPath, billing, entitlement, Supabase, FCM, push-cron, production DB/token, external console, purchase, restore, or real push action was changed or executed. |
| Active run | `alert-pro-rule-ui-clarity-run` |
| Next TODO | `2. Basic-state Pro rule display proposal` |

### Checked Alert Settings Routes

| Route | Source file | Finding |
| --- | --- | --- |
| `/crypto/alert` | `src/app/crypto/alert/page.tsx` | Directly renders `RadarAlertCenter` with `market="crypto"`. This is the primary crypto alert settings surface. |
| `/alerts?market=global` | `src/app/alerts/page.tsx` | Renders `RadarAlertCenter` with `market="stocks"` when the query market is `global` or `stocks`. This is the global or stocks alert settings surface. |
| `/alerts` | `src/app/alerts/page.tsx` | Defaults to crypto and redirects to `/crypto/alert`; it is not a separate alert settings UI. |

### Checked Files And Components

| File or component | Alert settings role | Basic/Pro clarity relevance |
| --- | --- | --- |
| `src/components/RadarAlertCenter.tsx` | Main alert settings UI for permission request, Android push status, rule list, Pro/Basic badges, rule toggles, saved-condition actions, and admin-only diagnostics. | Primary place where Basic users can see Pro rules and toggle-like controls. |
| `RuleCard` in `RadarAlertCenter` | Displays a single rule row with category, Pro/Basic badge, enabled state, and toggle button. | The toggle button is always rendered through `onToggle(rule.id)` and does not receive a disabled or locked reason prop. |
| `visibleRules` mapping in `RadarAlertCenter` | Renders market-scoped rules plus news/system category rules. | Source inspection found rule visibility is not filtered by Basic/Pro entitlement. |
| `toggleRule` in `RadarAlertCenter` | Enables or disables local rule ids and runs usage gating before enabling. | The enabling path checks the usage bucket with `isPaid`, but does not directly block `rule.tier === "pro"` for Basic users in the UI layer. |
| Android push preference sync in `RadarAlertCenter` | Sends selected `ruleIds` to app push registration or preference sync when push token support is available. | Locally enabled Pro rule ids can be passed as preferences, while server-side delivery later applies entitlement filtering. |
| `src/lib/radarAlerts.ts` | Defines alert rule ids, tiers, markets, categories, and default-enabled state. | Pro rules are default-enabled in the rule definitions, so Basic users can start from a UI state that appears to include Pro rules. |
| `src/lib/usageMeter.ts` | Defines local usage gate buckets for alert rule actions. | It gates action volume by paid state, not individual Pro rule display clarity. |
| `src/lib/server/push/entitlements.ts` | Server-side reference for `ruleAllowed`. | Non-system Pro delivery is entitlement-gated on the server, which can differ from what the Basic UI appears to allow. This was inspected only as context. |
| `src/lib/server/push/preferences.ts` and `src/lib/server/pushAlertScanner.ts` | Server-side reference for preference and scan filtering. | Confirms that final delivery decisions are separate from the client UI. These files are high-risk and were not changed. |

### Basic Misunderstanding Positions

| Position | Current display or behavior | Why Basic users can misunderstand it | Implementation risk |
| --- | --- | --- | --- |
| Pro rule row toggle | `RuleCard` shows a button that switches between enabled and off for every visible rule. | A Basic user can interpret the Pro row as configurable because the control looks actionable instead of locked or read-only. | LOW to MEDIUM if limited to UI display state; HIGH if it changes server entitlement or delivery. |
| Pro badge near enabled badge | Pro rules show a `Pro` badge and can also show an enabled status badge. | The badge identifies tier, but does not clearly say that Basic cannot receive the rule. The enabled badge can overpower the Pro limitation message. | LOW if clarified with UI/copy only. |
| Default rule ids | `getDefaultRadarAlertRuleIds` includes default-enabled Pro rules. | First-time or reset states can look like Pro rules are already part of the user's active alert setup. | MEDIUM if UI maps Pro defaults to a Basic locked display; HIGH if changing rule defaults or delivery. |
| Local storage rule ids | Stored rule ids are filtered for validity and market/category, not paid entitlement. | A previously stored Pro rule can remain visually enabled after a user is Basic or after plan state changes. | MEDIUM for UI normalization; HIGH if modifying entitlement or server persistence. |
| Usage gate only | `toggleRule` uses the alert-rule usage bucket and `isPaid`, but does not present a rule-tier lock before toggle. | Basic users may see usage-limit messaging instead of a clear "Pro-only rule" boundary. | LOW to MEDIUM for explanatory UI; HIGH for quota or billing policy changes. |
| Android push preference sync | Enabled rule ids can be passed into app push preference registration or sync. | The UI can suggest the preference is saved even though non-system Pro delivery is blocked later by server entitlement. | MEDIUM for UI warning; HIGH if changing token preference or scanner logic. |
| Alert summary counts | Summary action text includes counts such as Pro and Basic enabled rules. | A Basic user may read the Pro count as active deliverable rules rather than locked or unavailable rules. | LOW if summary wording is clarified. |

### Improvement Positions For The Next TODO

| Improvement position | Possible direction | Protected surface to avoid |
| --- | --- | --- |
| Pro rule row state | Make Basic-state Pro rules read as locked, unavailable, or read-only instead of enabled/deliverable. | Do not edit entitlement, billing, RevenueCat, Supabase, FCM, push-cron, server scanner, or delivery logic. |
| Toggle affordance | Replace or disable the toggle affordance for Basic-state Pro rows, with a visible reason. | Do not change product IDs, plan IDs, quota policy, or server `ruleAllowed`. |
| Rule-level explanation | Add a concise explanation near the Pro row that the rule requires the matching Pro plan. | Do not broaden into general pricing or billing copy changes. |
| Summary/header copy | Clarify that Pro rule counts are locked or unavailable for Basic users if the UI still shows them. | Do not change usageMeter limits or plan copy limits in this run. |
| Pro CTA placement | If a CTA is needed, keep it adjacent to the locked rule context and avoid implying investment results. | Do not alter `/pro` pricing, purchase flow, RevenueCat mapping, or checkout behavior. |
| Stored/default rule drift | Display Basic-state Pro defaults as locked rather than silently enabled. | Do not mutate saved preferences, token rows, or production DB values. |

### Task 2 Proposal Inputs

- Decide whether the preferred Basic-state Pro display is disabled, locked/read-only, or enabled-looking with an explicit warning. Locked/read-only is the lowest-risk direction from this audit.
- Define the exact UI states for Basic, matching Pro entitlement, and wrong-market Pro entitlement without changing entitlement logic.
- Keep the proposal limited to `RadarAlertCenter` display behavior and supporting copy.
- Treat any server-side delivery, quota, token preference, targetPath, route, billing, or entitlement change as a separate high-risk run.

## Follow-Up Run Task 2 - Basic-State Pro Rule Display Proposal

| Field | Value |
| --- | --- |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Design documentation only. No app code, UI code, user-facing code copy, alert logic, route, targetPath, billing, entitlement, Supabase, FCM, push-cron, production DB/token, external console, purchase, restore, or real push action was changed or executed. |
| Active run | `alert-pro-rule-ui-clarity-run` |
| Next TODO | `3. Minimal alert settings UI/copy implementation` |

### Improvement Goal

Basic users should understand that Pro alert rules exist, but should not read them as currently enabled, saved, or deliverable under the Basic plan. The UI should make the paid boundary visible before any server-side entitlement filter silently blocks delivery.

### Basic-State Display Principles

| Principle | Decision |
| --- | --- |
| Primary state | Show Pro rules to Basic users as locked or read-only, not as ordinary configurable rules. |
| Toggle affordance | The Pro rule control should not visually behave like an active on/off toggle for Basic users. Disabled or locked treatment is preferred. |
| Status priority | `Locked` or `Pro required` should take priority over `Enabled` or `Off` for Basic-state Pro rows. |
| Badge relationship | Avoid showing `Pro` and `Enabled` in a way that implies the Basic user will receive that rule. |
| Local/default drift | If localStorage or defaults include a Pro rule id, the Basic UI should still display the rule as locked, not active. |
| Server consistency | A rule blocked by server entitlement should also look unavailable in the Basic UI. |
| Scope boundary | The display change must not alter actual entitlement, billing, RevenueCat, Supabase, FCM, push-cron, token, scanner, or delivery behavior. |

### Pro Rule State Policy

| Viewer state | Rule tier or market | Recommended UI state | Toggle behavior | Status text intent |
| --- | --- | --- | --- | --- |
| Basic user | Pro rule for current market | Locked/read-only | Do not toggle the rule id. If clickable, open Pro context instead of changing state. | Pro alert available with matching Pro plan. |
| Basic user | Basic/free rule | Normal configurable row | Existing on/off behavior can remain. | On/off state can be shown normally. |
| Coin Pro user | Crypto Pro rule | Normal configurable row | Existing on/off behavior can remain. | Enabled/off state can be shown normally. |
| Coin Pro user | Global/stocks Pro rule | Locked/read-only in global context | Do not toggle as deliverable unless matching entitlement exists. | Global Pro or All Market Pro needed. |
| Global Pro user | Global/stocks Pro rule | Normal configurable row | Existing on/off behavior can remain. | Enabled/off state can be shown normally. |
| Global Pro user | Crypto Pro rule | Locked/read-only in crypto context | Do not toggle as deliverable unless matching entitlement exists. | Coin Pro or All Market Pro needed. |
| All Market Pro user | Any market Pro rule | Normal configurable row | Existing on/off behavior can remain. | Enabled/off state can be shown normally. |

### Copy Candidates

Preferred short copy candidates:

- `Pro에서 받을 수 있는 알림입니다`
- `현재 플랜에서는 이 알림이 잠겨 있습니다`
- `Pro로 업그레이드하면 이 조건의 알림을 받을 수 있습니다`
- `Coin Pro에서 열리는 알림입니다`
- `Global Pro에서 열리는 알림입니다`
- `All Market Pro에서 열리는 알림입니다`

Avoid these directions:

- `설정은 표시되지만 Basic에서는 발송되지 않습니다`
- Copy that sounds like a system failure or hidden mismatch.
- Copy that implies guaranteed profit, trade entry, or urgent action.
- Copy that pressures payment before explaining the alert capability.

### CTA Principles

| CTA principle | Decision |
| --- | --- |
| Tone | Explain the capability first; avoid checkout pressure. |
| Suggested labels | `Pro 알림 기준 확인`, `Pro에서 열리는 알림 보기`, or market-specific equivalents. |
| Market context | Crypto Pro rules should point to Coin Pro context; global/stocks Pro rules should point to Global Pro context; cross-market rules should point to All Market Pro context when applicable. |
| Behavior | CTA can route to an explanatory Pro context, but must not start checkout directly from a locked rule row. |
| Copy safety | Keep wording as judgment support. Avoid investment instruction, guaranteed returns, or aggressive trading language. |

### Minimal Implementation Scope For TODO 3

| Area | Minimum implementation direction |
| --- | --- |
| `RuleCard` props/state | Add or derive a display state such as locked for plan, using existing profile plan and rule tier data. |
| Pro rule row display | For Basic or wrong-market entitlement, show Pro rules as locked/read-only instead of enabled/off. |
| Toggle affordance | Disable or replace the toggle for locked rows so clicking does not change the local enabled rule id. |
| Status badges | Prevent locked Pro rows from showing an enabled badge as the primary state for Basic users. |
| Locked reason | Add a concise reason near the row explaining that the alert opens with the matching Pro plan. |
| Local/default drift handling | Even if a Pro rule id exists in defaults or localStorage, Basic UI should render it as locked rather than active. |
| Scope limit | Keep changes inside `RadarAlertCenter` display/copy unless route wrapper context is strictly needed. |

### Explicit Implementation Exclusions

- Do not change `ruleAllowed` or server entitlement filtering.
- Do not change auth, entitlement refresh, billing, RevenueCat, product IDs, plan IDs, entitlement names, prices, or purchase/restore behavior.
- Do not change Supabase, RLS, production DB rows, token storage, or token preference persistence.
- Do not change FCM, push-cron, scanner generation, cooldown, duplicate guards, event keys, or real alert sending.
- Do not resolve alert limit copy 30/40 versus local Pro 20 quota mismatch in this run.
- Do not resolve system-event entitlement bypass in this run.
- Do not change targetPath allowlist, route resolution, push-click behavior, or login returnTo handling.
- Do not run actual push, purchase, restore, account deletion, production DB/token, Android native/release, or external-console tests.

### Validation Criteria For TODO 3

- Basic-state Pro rules no longer look enabled or deliverable.
- Basic/free rules still remain configurable.
- Matching Pro users still see their market's Pro rules as configurable.
- Wrong-market Pro users see the other market's Pro rules as locked or unavailable.
- No billing, entitlement, Supabase, FCM, push-cron, scanner, targetPath, route, production DB/token, package, or script changes are included.
- Verification should include `git diff --check` and `cmd /c npx tsc --noEmit`; build can remain for later safe validation unless TODO 3 scope or reviewer preference requires it.

### TODO 3 Implementation Instruction Summary

For TODO 3, implement only the alert settings UI/copy clarity required to make Basic or wrong-market Pro rules read as locked/read-only. Prefer a small `RadarAlertCenter` display-state change that prevents locked Pro rows from toggling local state and prioritizes a Pro-required status over enabled/off badges. Do not alter server delivery, entitlement, billing, RevenueCat, Supabase, FCM, push-cron, targetPath, route behavior, token storage, production data, or purchase flows.

## Follow-Up Run Task 4 - Related Documentation Update

| Field | Value |
| --- | --- |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Documentation update only. No additional app code, UI code, user-facing code copy, alert logic, route, targetPath, billing, entitlement, Supabase, FCM, push-cron, production DB/token, external console, purchase, restore, or real push action was changed or executed. |
| Active run | `alert-pro-rule-ui-clarity-run` |
| Next TODO | `5. Safe validation execution` |

### Task 3 Implementation Summary

| Item | Result |
| --- | --- |
| Changed file | `src/components/RadarAlertCenter.tsx` |
| Locked display | Basic or wrong-market Pro rules now render as locked/read-only in the alert rule list. |
| Primary status | Locked Pro rows show `Pro 필요`; `켜짐/꺼짐` no longer has priority for those rows. |
| Toggle affordance | Locked rows render a read-only pill instead of the normal on/off switch. |
| Locked explanation | Locked rows show a short explanation that the alert is available with the matching Pro plan. |
| CTA | Locked rows show a function-explanation CTA such as Pro alert criteria review, routed to the relevant Pro context. |
| Local state protection | `toggleRule` now returns before changing local rule state when the rule is locked for the current plan/market. |
| Scope boundary | The change stays in alert settings UI/copy and active-run documentation. |

### Risks Reduced By Task 3

| Risk | Reduction |
| --- | --- |
| Basic users may think Pro rules are actually enabled. | Locked Pro rows no longer display as ordinary enabled/off toggles. |
| Pro badge and enabled/off badge can conflict. | Locked rows prioritize `Pro 필요` over enabled/off state. |
| localStorage/default Pro ids can look active for Basic users. | Locked display is derived from current plan/market, so Basic UI does not present those ids as active. |
| UI settings can appear inconsistent with server `ruleAllowed`. | The UI now shows the paid boundary before server delivery filtering happens. |
| "I configured this but no alert arrived" trust risk. | Pro-only delivery limits are visible at the rule row before the user treats the rule as active. |

### High-Risk Areas Not Changed

| Area | Status |
| --- | --- |
| Billing, product ids, plan ids, entitlement names, prices | Not changed |
| RevenueCat or native purchase mapping | Not changed |
| Supabase, RLS, production DB rows | Not changed |
| Push token storage, lookup, insertion, deletion, or rotation | Not changed |
| FCM, push-cron, scanner delivery logic, cooldown, duplicate guards | Not changed |
| Server `ruleAllowed` or entitlement policy | Not changed |
| targetPath, routing, push-click behavior, login returnTo | Not changed |
| Actual push, admin test push, purchase, restore, Android native/release, external console tests | Not executed |

### Recorded Task 3 Validation Results

| Command | Result |
| --- | --- |
| `git diff --check` | PASS |
| `cmd /c npx tsc --noEmit` | PASS |
| `npm.cmd run build` | PASS |
| `npm.cmd run smoke:copy` | PASS |

### Remaining Risks After Task 3

- Alert limit copy 30/40 versus `usageMeter` Pro 20 mismatch is still unresolved.
- System-event entitlement bypass policy is still unresolved.
- `/alerts?market=global|crypto` targetPath allowlist or payload convention is still unresolved.
- Per-user hourly/daily total push cap is still absent.
- Macro/news semantic repetition can still happen when event keys differ.
- Android push tap cold start/background behavior still needs real-device or manual QA confirmation.

### Task 5 Safe Validation Check Points

- Reconfirm the diff remains limited to alert settings UI/copy and documentation.
- Reconfirm billing, entitlement, RevenueCat, Supabase, FCM, push-cron, scanner delivery logic, targetPath/routing, package scripts, Android release, production DB/token surfaces remain unchanged.
- Re-record TypeScript, build, and copy-smoke status for the final run evidence.
- Decide whether `npm.cmd run smoke:mobile` is useful and safe as an optional final check; do not run high-risk smoke commands such as billing, API, push, Android native, or release commands.

## Follow-Up Run Task 5 - Safe Validation Execution

| Field | Value |
| --- | --- |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Safe validation and documentation only. No additional app code, UI code, user-facing code copy, alert logic, route, targetPath, billing, entitlement, Supabase, FCM, push-cron, production DB/token, external console, purchase, restore, or real push action was changed or executed. |
| Active run | `alert-pro-rule-ui-clarity-run` |
| Run status | `DONE` |

### Final Validation Results

| Command | Result |
| --- | --- |
| `git diff --check` | PASS |
| `cmd /c npx tsc --noEmit` | PASS |
| `npm.cmd run build` | PASS |
| `npm.cmd run smoke:copy` | PASS |
| `npm.cmd run smoke:mobile` | PASS |

### Final Scope Check

| Area | Result |
| --- | --- |
| Final implementation scope | Alert settings UI/copy and run documentation only. |
| Protected path diff after validation | No tracked diff in billing, entitlement, RevenueCat/native purchase mapping, Supabase/RLS, push-cron, FCM/server alert sending, targetPath/routing, Android release, package scripts, production DB/token, or build output paths. |
| High-risk commands | `smoke:billing`, `smoke:api`, `check:app-billing`, Android native/release commands, real push, purchase, restore, account deletion, and production DB/token work were not executed. |
| Additional code after Task 3 | None. Task 4 and Task 5 only updated documentation/run records. |

### Final Run Conclusion

`alert-pro-rule-ui-clarity-run` is complete. Basic or wrong-market Pro alert rules now have a locked/read-only presentation in the alert settings UI, and safe validation passed. The run did not change billing, entitlement, RevenueCat, Supabase/RLS, push-cron, FCM/server alert sending, targetPath/routing, production DB/token, Android release, product IDs, plan IDs, prices, or package scripts.

### Remaining Follow-Up Candidates

- Resolve alert limit copy 30/40 versus `usageMeter` Pro 20 mismatch in a separate policy/copy run.
- Decide system-event entitlement bypass policy in a separate high-risk design run.
- Align `/alerts?market=global|crypto` targetPath allowlist or payload convention in a routing-focused run.
- Evaluate per-user hourly/daily total push cap in a push operations run.
- Review macro/news semantic repetition with sample-based evidence.
- Verify Android push tap cold start/background behavior in a real-device manual QA run.

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

## Final Conclusion

The audit run is complete. All six tasks were handled as audit, documentation, and prioritization work only. The selected first implementation candidate, `alert-pro-rule-ui-clarity-run`, has now been registered as a separate active run. Any code, UI, database, token, push delivery, billing, entitlement, routing, or external service change must remain within that new run's explicit scope and guardrails.
