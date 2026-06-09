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
