# Active Automation Run

## Run Title

- `alert-quality-operations-run`

## Run State

- Status: `ACTIVE`
- Setup date: 2026-06-09
- Previous run context: `android-production-auto-smoke-run` is `DONE` and its recorded automatic checks are `PASS`.
- Current phase: Tasks 1-5 are `DONE`; Task 6 is the next `TODO`.
- Execution mode: `AUTO RUN ACTIVE PLAN` processes exactly one `TODO` task per turn.
- This setup registers the run only. No alert code, push command, production DB/token access, FCM, Supabase, RevenueCat, billing, Android release, or Android phone manual QA action was executed during setup.

## Purpose

- Audit ChartRadar alert quality from an operations point of view.
- Check whether current alerts look trustworthy, bounded, and useful to users.
- Prioritize documentation and first improvement selection over alert logic rewrites.
- Split any actual implementation into a separate approved run.

## Background

- Android production auto smoke is complete and recorded as `PASS`.
- TypeScript, production build, lint, `smoke:copy`, `smoke:mobile`, and `smoke:launch` are recorded as `PASS` in `docs/qa/android-production-qa-results.md`.
- Actual Android phone manual QA is intentionally deferred by representative direction.
- The next chosen work is alert operations quality, not manual-device QA.

## High-Risk Guardrails

- Do not modify app code, UI code, `package.json`, or `scripts/`.
- Do not modify FCM code, push-cron, push alert scanner, targetPath logic, cooldown logic, Supabase, RLS, RevenueCat, billing, entitlement, Android native files, Android release settings, Play Console settings, or production config.
- Do not send real push notifications, admin test pushes, or production push-cron send-mode requests.
- Do not query, insert, delete, rotate, copy, print, or expose raw push tokens.
- Do not query or mutate production DB records.
- Do not execute actual purchase, purchase restore, account deletion, or Android release/native commands.
- If an improvement or bug is found, document it and recommend a separate implementation or high-risk triage run.

## Scope

- Primary planning file:
  - `docs/automation-runs/active-run.md`
- Companion operations document:
  - `docs/alert-quality-operations.md`
- Optional future QA companion if needed:
  - `docs/qa/alert-quality.md`

## Reference Documents

- `docs/qa/android-production-qa-results.md`
- `docs/android-production-qa-execution.md`
- `docs/qa/android-production-manual-qa.md`
- `docs/push-alert-scanner-refactor-plan.md`
- `docs/push-cron-vercel-audit.md`

## Start Conditions

- Confirm `git status --short --branch`.
- Confirm `git rev-list --left-right --count HEAD...origin/main`.
- If local and `origin/main` diverge, stop before editing and report.
- If the worktree is dirty, identify existing changes before editing.
- For `AUTO RUN ACTIVE PLAN`, process exactly one `TODO` item per turn.
- Before any source inspection, confirm the task is audit/documentation-only and does not require running push-cron or querying production data.

## Stop Conditions

- Any task requires code, UI, `package.json`, script, FCM, push-cron, Supabase, RLS, RevenueCat, billing, entitlement, Android release, Play Console, production config, or production data changes.
- Any task requires real push sending, push-click testing, raw token inspection, production DB access, or Android phone manual QA.
- Any task expands from audit into implementation.
- Sensitive values appear in docs, logs, command output, or diffs.

## Task List

| Order | Status | Task | Area | Risk | Goal | Forbidden | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | DONE | Current alert structure audit | Alert Structure | MEDIUM | Document alert generation, permission request, push token save, targetPath routing, Pro limits, and alert settings flow. | No FCM edits. No push-cron edits. No Supabase edits. No production DB edits. No real push send. | `git diff --check` |
| 2 | DONE | Alert copy quality review | Alert Copy | LOW | Check whether alert wording could read as investment instruction, guaranteed return, or excessive trade inducement. | No alert send logic edits. No real push send. | `git diff --check` |
| 3 | DONE | Duplicate and cooldown policy review | Dedupe/Cooldown | MEDIUM | Check whether the same user can receive repetitive or too-frequent alerts from current structure. | No cooldown logic edits. No push-cron edits. No production DB edits. | `git diff --check` |
| 4 | DONE | Basic/Pro alert limit review | Entitlement/Gating | HIGH | Check whether free/paid alert limits are consistent between screen design and expected runtime behavior. | No entitlement edits. No RevenueCat edits. No Supabase RLS edits. No billing edits. | `git diff --check` |
| 5 | DONE | targetPath routing quality review | Notification Routing | MEDIUM | Document expected destination, fallback, login-required state, and missing-route behavior after alert click. | No routing code edits. No real push-click test. | `git diff --check` |
| 6 | TODO | Alert improvement candidate selection | Prioritization | LOW | Select exactly one first alert-quality improvement candidate; implementation remains a separate run. | No multiple simultaneous improvements. No code edits. | `git diff --check` |

## Task 1 Completion Note

- Completed date: 2026-06-09
- Completed task: `Current alert structure audit`
- Output document: `docs/alert-quality-operations.md`
- Scope inspected by source inspection only:
  - alert generation through `/api/push-cron` and `runPushAlertScan`
  - permission request and Android push registration through `src/lib/appPush.ts`
  - token save and disable flow through `/api/push-tokens`
  - targetPath sanitize/resolve flow through `src/lib/pushTargetPath.ts`
  - Pro/Basic gating through `radarAlerts`, usage gating, `entitlements`, and token preferences
  - alert settings through `RadarAlertCenter`, `/crypto/alert`, and `/alerts?market=global`
- Protected actions not performed:
  - no real push send
  - no admin test push
  - no push-cron call
  - no production DB or raw token query
  - no Supabase, FCM, RevenueCat, billing, entitlement, Android release, Play Console, app code, UI code, package, or script changes
- Task 1 handoff at completion: `2. Alert copy quality review`

## Task 2 Completion Note

- Completed date: 2026-06-09
- Completed task: `Alert copy quality review`
- Output document: `docs/alert-quality-operations.md`
- Scope inspected by source inspection only:
  - FCM payload title/body generation in server push event builders and scanners
  - alert rule title, description, trigger, cadence, and value copy
  - Android/browser permission, connection, disable, and test-status copy
  - alert settings screen copy, saved-condition copy, Pro/Basic status copy, and admin diagnostics copy
  - targetPath/fallback related copy surfaces
- Result summary:
  - no confirmed alert-specific high-risk copy found
  - safe pattern is mostly condition, evidence, risk, volatility, and confirmation wording
  - caution patterns documented for `candidate/strong` wording, `매수가/무효화 알림`, browser-local `롱/숏 우세`, and external news headline passthrough
- Protected actions not performed:
  - no user-facing copy edits
  - no real push send
  - no admin test push
  - no browser notification or OS permission prompt
  - no production DB or raw token query
  - no Supabase, FCM, RevenueCat, billing, entitlement, Android release, Play Console, app code, UI code, package, or script changes
- Task 2 handoff at completion: `3. Duplicate and cooldown policy review`

## Task 3 Completion Note

- Completed date: 2026-06-09
- Completed task: `Duplicate and cooldown policy review`
- Output document: `docs/alert-quality-operations.md`
- Scope inspected by source inspection only:
  - per-user scanner flow, recent sent-event lookup, and same-scan cooldown state in `runPushAlertScan`
  - cooldown rules in `src/lib/server/push/cooldown.ts`
  - duplicate event-key helpers and sent-event history recording in `src/lib/server/push/duplicateGuard.ts`
  - FCM send accounting and duplicate re-check in `src/lib/server/push/sendPush.ts`
  - event-key buckets, market-scout limits, and global batching in event builders and generic events
  - browser-local notification dedupe in `RadarAlertMonitor`
  - `push_alert_events` schema reference and unique `(user_id, event_key)` index
- Result summary:
  - duplicate prevention uses per-user `eventKey`, pre-send `alreadySent`, sent-event recording, and a DB unique index
  - cooldown is server-side for Android FCM and localStorage-based for browser preview
  - current safeguards include same-symbol cooldowns, crypto alt market-scout global limit, scan-level market-scout caps, and global event batching
  - no explicit per-user hourly or daily total push cap was found
  - concurrency, post-FCM sent-event recording failure, multi-device delivery, and macro/news semantic repetition remain documented risks
- Protected actions not performed:
  - no cooldown, dedupe, rate-limit, push-cron, scanner, FCM, token preference, or alert code edits
  - no real push send
  - no admin test push
  - no push-cron call
  - no admin diagnostics call
  - no production DB or raw token query
  - no Supabase, RLS, RevenueCat, billing, entitlement, Android release, Play Console, app code, UI code, package, or script changes
- Task 3 handoff at completion: `4. Basic/Pro alert limit review`

## Task 4 Completion Note

- Completed date: 2026-06-09
- Completed task: `Basic/Pro alert limit review`
- Output document: `docs/alert-quality-operations.md`
- Scope inspected by source inspection only:
  - plan scopes, alert limit copy, store entitlement mapping, and `hasMarketEntitlement` in `src/lib/billing.ts`
  - `free`/`pro` alert rule tiers and default-enabled rules in `src/lib/radarAlerts.ts`
  - alert settings UI gating, local usage gate, Pro/Basic badges, and Android push preference sync in `RadarAlertCenter`
  - server-side `userPlan` and `ruleAllowed` entitlement gate
  - push scanner order from profile/subscription lookup through entitlement, token preferences, cooldown, duplicate, and send
  - token preference market/rule filtering and system-event rule preference bypass
  - Android token sync and `/api/push-tokens` market/rule/preset merge behavior
  - Pro pricing plan display and alert limit rows
- Result summary:
  - market entitlement helpers distinguish Coin Pro, Global Pro, and All Market Pro for non-system checks
  - UI shows Pro/Basic badges but does not hard-lock Pro rule toggles for Basic users
  - local alert-rule usage gate uses Basic 1 and Pro 20 per market, which does not fully match yearly/bundle alert limit copy
  - server `ruleAllowed` blocks non-system Pro events by market entitlement
  - system events bypass `ruleAllowed`, and token preferences also bypass rule ids for non-watchlist system events; this is the main Basic/Pro consistency risk
  - token registration is authenticated but not entitlement-gated, so scanner-side enforcement remains the paid boundary
- Protected actions not performed:
  - no entitlement, RevenueCat, billing, product id, plan id, price, Supabase, RLS, token, push scanner, cooldown, dedupe, push-cron, or alert logic edits
  - no real push send
  - no admin test push
  - no push-cron call
  - no billing endpoint call
  - no purchase or restore test
  - no production DB or raw token query
  - no Android release, Play Console, app code, UI code, package, or script changes
- Task 4 handoff at completion: `5. targetPath routing quality review`

## Task 5 Completion Note

- Completed date: 2026-06-09
- Completed task: `targetPath routing quality review`
- Output document: `docs/alert-quality-operations.md`
- Scope inspected by source inspection only:
  - central resolver and allowlist in `src/lib/pushTargetPath.ts`
  - Capacitor notification tap listener and `window.location.assign` in `src/lib/appPush.ts`
  - FCM data payload path in `src/lib/server/firebaseMessaging.ts` and `src/lib/server/push/sendPush.ts`
  - setup/watchlist/global/liquidation/macro/admin test targetPath generators
  - allowed route existence and redirects for `/crypto`, `/alts`, `/global`, `/global/assets`, `/schedule`, `/news`, `/journal`, and `/alerts`
  - login `returnTo` behavior and Basic/Pro target-screen gate expectations
- Result summary:
  - targetPath sanitizer only accepts exact internal allowlist entries and rejects external URL, `//`, backslash, control-character, unknown, and arbitrary query paths
  - metadata fallback maps alert type, market, symbol, and alert kind to crypto, alt, global, global asset, news, schedule, or alerts routes
  - Android notification tap merges push action data, resolves targetPath, then uses `window.location.assign`
  - no direct notification route to `/pro`, checkout, settings, account deletion, billing, admin, or external console was found
  - `/alerts?market=global` appears as a payload `target` value but is not directly allowlisted; it depends on metadata fallback
  - no source-level post-login preservation for push targetPath was found beyond normal page login links
- Protected actions not performed:
  - no targetPath, routing, push listener, push scanner, push-cron, alert logic, FCM, Supabase, RLS, billing, entitlement, RevenueCat, Android release, Play Console, app code, UI code, package, or script changes
  - no real push send
  - no push click test
  - no admin test push
  - no push-cron call
  - no production DB or raw token query
  - no browser navigation or Android device test
- Next task remains: `6. Alert improvement candidate selection`

## Documentation Policy

- This run is audit, documentation, and prioritization only.
- Findings should describe user trust, alert usefulness, repetition risk, copy risk, routing expectation, and protected-surface risk.
- Keep ChartRadar framed as judgment support. Avoid buy, sell, long, short, guaranteed return, urgent entry, or profit-guarantee framing.
- Do not weaken Basic/Pro policy or paid entitlement boundaries while documenting alert quality.
- Do not treat Android phone manual QA as part of this run.

## Verification Policy

- Always run `git diff --check`.
- Confirm changed files stay inside `docs/`.
- Confirm `package.json`, `scripts/`, app/UI code, Android files, Supabase files, `mobile-shell`, and `public` are unchanged unless explicitly approved.
- Run a sensitive-value pattern check before commit.

## Commit And Push Policy

- Setup commit message: `Define alert quality operations run`.
- Docs-only setup may be committed and pushed to `main` when verification passes and the branch is in sync with `origin/main`.
- Do not release, deploy, submit Play Console changes, alter production configuration, or run production-mutating operations during this run.

## Completion Report Format

- New active-run name.
- Registered task list.
- Whether Android auto smoke `PASS` is reflected.
- Whether Android phone manual QA is excluded.
- Whether high-risk forbidden scope is reflected.
- Verification results.
- Commit hash.
- Push status.
- Final git status.
