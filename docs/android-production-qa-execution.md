# Android Production QA Execution

## Scope Status

- Active run: `android-production-qa-execution-run`
- Setup date: 2026-06-09
- Source checklist: [Android Production Stability QA](android-production-stability-qa.md)
- Manual checklist: [Android Production Manual QA](qa/android-production-manual-qa.md)
- Current task state: Task 1 `DONE`; Task 2 is the next `TODO`.

This document turns the completed Android production stability checklist into an execution plan. It is not an implementation plan and does not authorize code, service, release, or production-data changes.

## Operating Rules

- Execute one active-run task at a time.
- Treat every smoke result as evidence only. Do not fix failures inside this run.
- Use `NEEDS-RUN` until a command or manual step is actually executed.
- Use a dedicated QA account for account, login, plan, alert, and settings checks.
- Do not expose credentials, tokens, raw push tokens, service keys, payment keys, or private account identifiers in QA notes.
- Do not perform actual purchase, purchase restore, account deletion, production DB mutation, or real push send.
- Read-only Play Console review is allowed only as manual QA evidence; console changes are out of scope.

## Existing Smoke Command Audit

Task 1 completed by source inspection of `package.json` and `scripts/`. No smoke command was executed, no script was changed, and no production service was touched.

### Safe Execution Candidates

These commands are reusable for Android production QA preparation when failures are documented only and not fixed inside this run.

| Command | Purpose | Checks screens/functions | Production data change? | Payment/account deletion/push possibility? | Safe for Android production QA? | Required conditions before running | Failure suspect area | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `npm.cmd run smoke:copy` | Static user-facing copy guard. | Scans `src/app`, `src/components`, selected `src/lib` files, radar-news API copy, and alert copy for blocked wording or broken text patterns. | No. Static file reads only. | No payment, account deletion, or push send. | Yes. Good first smoke candidate. | Run from repo root; treat failures as documentation/follow-up only. | Judgment-support wording, blocked advisory phrasing, broken encoded text, alert-copy drift. | LOW |
| `npm.cmd run smoke:mobile` | Static mobile/PWA/Android readiness guard. | Checks brand icons, offline/PWA files, mobile shell, manifest, Capacitor config, Android notification icon/manifest wiring, push migrations, native Google sign-in references. It does not test a 360px viewport. | No. Static file and PNG reads only. | No payment, account deletion, or push send. | Yes, with Android-release guardrails. | Run from repo root; if Android/native/push failure appears, document it and open separate approval before editing. | PWA assets, Capacitor config, Android notification assets, mobile shell, static push migration expectations. | LOW |
| `npm.cmd run smoke:launch` | Static launch-readiness score. | Checks high-level brand, market split, billing file presence, paid-value source signals, API guard source, copy guard presence, macro/news/alerts/mobile/visual/ops readiness markers. | No. Static file reads only. | No payment, account deletion, or push send. | Yes, as a broad readiness signal. | Run from repo root; interpret score as advisory evidence, not release approval. | Missing launch-readiness source markers, stale macro source timestamp, missing route/source files. | LOW |
| `npm.cmd run lint` | Next lint. | Static lint quality for app code. | No production data change. Local cache/output only if tooling writes it. | No payment, account deletion, or push send. | Yes, as supplemental validation. | Use `npm.cmd` on Windows; failures should be triaged only if directly in scope. | ESLint config, app/source lint errors. | LOW |
| `npm.cmd run build` | Production Next build. | Build-time render/compile readiness for web app routes and assets. | No production data change. Writes local build output. | No payment, account deletion, or push send by command intent. | Yes, as supplemental validation when build evidence is needed. | Use local repo only; do not deploy; if build reaches protected runtime assumptions, stop and report. | Next build config, route compile errors, server/client import issues, static generation assumptions. | LOW-MEDIUM |
| `cmd /c npx tsc --noEmit` | TypeScript no-emit typecheck. | Type safety across configured TS project. | No. No emit. | No payment, account deletion, or push send. | Yes, although it is not currently a package script. | Use `cmd /c` on Windows if needed; no code edits inside this audit task. | Type errors, stale declarations, unsafe imports. | LOW |

### Caution Candidates

These commands can be useful, but they require local target confirmation or protected-domain awareness before execution.

| Command | Purpose | Checks screens/functions | Production data change? | Payment/account deletion/push possibility? | Safe for Android production QA? | Required conditions before running | Failure suspect area | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `npm.cmd run smoke:routes` | Local route and guard reachability smoke. | Checks `/`, `/crypto`, `/crypto/home`, `/crypto/spot`, `/crypto/perpetual`, `/crypto/perpetual/alts`, `/crypto/news`, `/crypto/alert`, `/crypto/review`, `/schedule`, `/menu`, `/account`, `/global`, `/stocks`, `/news`, `/alerts`, `/pro`, `/login`, `/journal`, `/calculator`, policy routes, health/static files, and billing guard endpoints. | No intended production data change. Sends HTTP requests to configured `SMOKE_BASE_URL`. | Includes local unauthenticated POSTs to `/api/billing/checkout` and `/api/billing/confirm`; expects blocked responses and does not complete payment. No account deletion or push send. | Safe only when pointed at local dev server. | Confirm `SMOKE_BASE_URL` is local, usually `http://127.0.0.1:3000`; confirm dev server is running; do not point at production without separate approval. | Route registration, redirects, health endpoint, local billing guard behavior, dev server availability. | MEDIUM |
| `npm.cmd run smoke:api` | Local API validation guard smoke. | Sends invalid or oversized requests to AI, scout, news, stock candles, liquidation, options, large-trade, onchain, unlocks, watchlist-scan, and billing guard APIs. | No intended production data change. Sends HTTP requests to configured `SMOKE_BASE_URL`. | Includes local POSTs to billing guard endpoints and watchlist-scan with invalid payloads; expects rejection. No account deletion or push send. | Safe only when pointed at local dev server. | Confirm `SMOKE_BASE_URL` is local; do not run against production; use only after command target and expected rejection behavior are understood. | API input validation, body-size guards, error copy/status codes, local service availability. | MEDIUM |
| `npm.cmd run smoke:css` | Local CSS asset availability smoke. | Fetches `/crypto/home`, extracts CSS links, and verifies CSS asset responses and size. | No intended production data change. Sends local GET requests. | No payment, account deletion, or push send. | Safe when local; not a viewport check. | Confirm `SMOKE_BASE_URL` is local and dev server is running. | CSS chunk generation, `/crypto/home` response, static asset serving. | LOW-MEDIUM |
| `npm.cmd run smoke:ops` | Static ops readiness plus local macro API health. | Reads rate limit, entitlement, Supabase client, billing, health/scout/macro/news/alert/push source files; fetches local `/api/macro-calendar`; checks push-cron and send-helper source references without sending push. | No intended production data change. May call local macro API. | No payment or account deletion. No real push send by script; it only inspects push source references. | Safe only with local target confirmation and no-send interpretation. | Confirm `SMOKE_BASE_URL` is local; do not use as approval to edit push/FCM/Supabase; document protected-surface failures only. | Ops config, macro-calendar freshness/headers, push source wiring, rate limit coverage, news/alert source markers. | MEDIUM |
| `npm.cmd run smoke:billing` | Static billing/product/entitlement consistency audit. | Reads `src/lib/billing.ts`, billing API routes, app-store sync route, entitlement helpers, `/pro` pricing panel, mobile purchases, usage/watchlist/global files, launch/payment/app-store docs, and product IDs. | No. Static reads only. | No actual purchase or restore is executed, but it audits purchase and restore source paths. No account deletion or push send. | Safe as read-only evidence, but protected billing scope means use caution. | Run only when billing smoke evidence is explicitly needed; failures must not trigger billing/RevenueCat/product edits inside this run. | Product ID/base-plan mapping, entitlement helper drift, RevenueCat source wiring, `/pro` billing copy, price/usage consistency. | MEDIUM |
| `npm.cmd run smoke:all` | Integrated smoke sequence. | Runs `smoke:copy`, `smoke:launch`, `smoke:ops`, `smoke:mobile`, `smoke:billing`, restarts dev server with `dev:clean`, then runs `smoke:css`, `smoke:api`, and `smoke:routes`. | No intended production data change if local only. Starts/restarts local dev server. | Inherits local billing POST guard checks and protected billing/push source audits; no actual payment, restore, account deletion, or push send by script intent. | Not a first-run candidate; use after each included command is acceptable. | Confirm no important local dev server process should be preserved; confirm `SMOKE_BASE_URL` local; confirm chained protected-domain checks are in scope. | Any included smoke area, dev server restart/readiness, local route/API availability. | MEDIUM |
| `npm.cmd run check:app-billing` | Local billing environment presence check. | Reads `.env.local` and `src/lib/billing.ts` to confirm RevenueCat/Supabase billing keys and expected product IDs are present. | No production data change. Reads local secrets file without printing values. | No purchase, account deletion, or push send. | Separate caution candidate because it touches secret-bearing env presence and protected billing setup. | Only run when billing environment readiness is explicitly in scope; do not paste or expose env values; failures require separate approval for env changes. | Missing `.env.local`, missing RevenueCat/Supabase key presence, product ID drift. | MEDIUM |
| `npm.cmd run dev`, `npm.cmd run dev:clean`, `npm.cmd run start` | Local server orchestration. | Starts or restarts local Next server; `dev:clean` runs `scripts/restart-dev.ps1`. | No production data change by command intent. Local process state changes. | No payment, account deletion, or push send by command intent. | Use only to support local smoke execution. | Confirm local server/process impact is acceptable; do not treat server startup as QA evidence by itself. | Dev server boot, port conflicts, environment assumptions, local process cleanup. | LOW-MEDIUM |

## Use-Prohibited Or Separate-Approval Commands

These commands are not reusable smoke candidates for this active-run task.

| Command or file | Reason to separate | Risk |
| --- | --- | --- |
| `npm.cmd run app:sync`, `npm.cmd run app:sync:prod`, `scripts/sync-android-production.ps1` | Runs Capacitor Android sync and touches Android production app packaging state. Android release settings are protected. | HIGH |
| `npm.cmd run app:add:android` | Adds Android platform files; not QA smoke and can mutate native project structure. | HIGH |
| `npm.cmd run app:android`, `npm.cmd run app:doctor` | Android tooling/IDE or Capacitor environment actions; useful only in separate Android release/device work. | MEDIUM-HIGH |
| `npm.cmd run app:android:debug`, `scripts/build-android-debug.ps1` | Syncs Android production assets and builds native debug artifact. Not part of docs-only QA audit. | MEDIUM-HIGH |
| `npm.cmd run app:android:release`, `scripts/build-android-release-aab.ps1` | Syncs Android production assets and generates release AAB. Android release output is protected and separate approval is required. | HIGH |
| `scripts/set-app-billing-env.ps1` | Writes billing env keys into `.env.local` and handles RevenueCat/Supabase secrets. | HIGH |
| `scripts/set-owner-admin.sql` | Supabase SQL mutation for operator account privileges. | HIGH |
| Actual Google Play purchase, purchase restore, account deletion, real push delivery, production DB writes, Supabase/FCM/RevenueCat/Google Play Console changes | Explicitly forbidden in this run and requires separate approval. | HIGH |

## Non-Smoke Scripts Not Selected For Android QA

`backtest:btc`, `scripts/backtest-btc-regimes.ts`, `scripts/research-product-setups.ts`, `scripts/research-setup-combos.ts`, `scripts/validate-current-radar.ts`, `scripts/verify-pine-parity.ts`, and `scripts/verify-scout.ts` are research or model/parity utilities. Some fetch external market data or write report files. They are not Android production QA smoke candidates for this run.

## Mobile Viewport Coverage

Current known coverage:

- `smoke:mobile` checks mobile shell, PWA, Capacitor, Android push dependency/configuration, manifest, and static migration assets.
- `smoke:routes` checks HTTP route reachability but does not render a browser viewport.
- The completed stability QA checklist defines 360px watch items for `/coin`, `/crypto`, `/alts`, `/global`, `/alerts`, `/journal`, `/pro`, settings, and account screens.

Current gap to document in Task 2:

- No existing smoke command has been confirmed to capture 360px screenshots.
- No existing smoke command has been confirmed to inspect visual overflow, bottom navigation overlap, safe-area spacing, or first-viewport hierarchy.
- Browser viewport checks should therefore be classified as manual screenshot review or separate browser-tool QA unless a local screenshot workflow is explicitly confirmed.

## Execution Table

Task 3 should promote this draft table into the final execution table.

| Order | QA item | Evidence type | Automation status | Manual status | Risk | Hard stop |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Worktree and docs safety | `git status`, `git diff --check`, docs-only diff, sensitive-value scan | Candidate automatic | Not needed | LOW | Stop if non-doc changes or sensitive values appear. |
| 2 | Static copy guard | `npm.cmd run smoke:copy` output | Candidate automatic | Not needed | LOW | Stop if command scope expands beyond static scan. |
| 3 | Static mobile readiness guard | `npm.cmd run smoke:mobile` output | Candidate automatic | Manual review still required for visual viewport | LOW | Stop if command requires code/config changes. |
| 4 | Route reachability | `npm.cmd run smoke:routes` output against local dev server | Candidate automatic | Manual navigation still required for Android WebView | LOW-MEDIUM | Use local `SMOKE_BASE_URL` only; do not point at production unless separately approved. |
| 5 | API guard smoke | `npm.cmd run smoke:api` output against local dev server | Candidate automatic | Not required for first device pass | MEDIUM | Use local `SMOKE_BASE_URL` only; no production mutation. |
| 6 | Android production first launch | Device notes, screenshots, app version | No | Required | LOW-MEDIUM | No Play Console/release changes. |
| 7 | Navigation/back/relaunch | Device notes or recording | No | Required | LOW-MEDIUM | No code changes inside this run. |
| 8 | Google login/logout | Device notes or screenshots without credentials | No | Required | MEDIUM-HIGH | Dedicated QA account only; no auth/Supabase changes. |
| 9 | `/pro` pre-checkout | Screenshots and stop-point notes | Route/static support only | Required | MEDIUM-HIGH | Stop before actual Google Play checkout, purchase, or restore. |
| 10 | Notification permission/settings | Screenshots and permission-state notes | Route/static support only | Required | MEDIUM-HIGH | No real push, token exposure, FCM/Supabase changes, or push-cron send mode. |
| 11 | Play Console health read-only | Read-only console notes/screenshots | No | Required | MEDIUM-HIGH | No rollout, listing, tester, country/region, product, warning, or release edits. |

## Safe Smoke Candidate Draft

Task 4 should select the final command candidate before execution. Based on setup review, the safest first candidates are:

| Candidate | Why it is safe to consider first | Conditions before running | Result status |
| --- | --- | --- | --- |
| `npm.cmd run smoke:copy` | Static source scan only; supports judgment-support and blocked-copy guardrails. | Confirm no app code changes are intended and failures will be documented only. | `NEEDS-RUN` |
| `npm.cmd run smoke:mobile` | Static mobile/PWA/Android asset guard; no browser viewport or production mutation. | Confirm failures will be documented only and no Android native edits will follow in this run. | `NEEDS-RUN` |
| `npm.cmd run smoke:routes` | Useful route/API guard evidence once a local dev server is available. | Confirm `SMOKE_BASE_URL` is local, dev server is running, and billing POST checks remain blocked-response tests. | `NEEDS-RUN` |

Commands that need more caution:

- `npm.cmd run smoke:billing`: read-only static audit, but protected billing domain. Use only when the task explicitly includes billing smoke evidence and no code/config changes.
- `npm.cmd run smoke:api`: sends local invalid POST requests. Use local dev server only.
- `npm.cmd run smoke:ops`: touches ops and push/cron source surfaces and may fetch local macro API. Use only after confirming no send mode or production target.
- `npm.cmd run smoke:all`: chains multiple commands and restarts local dev server. Use only after individual commands are acceptable.

## Separate Approval Required

| Item | Why separate | Required approval boundary |
| --- | --- | --- |
| Actual Google Play purchase | Can create subscription/account state. | Dedicated tester setup and explicit purchase-test approval. |
| Purchase restore | Can mutate entitlement/account state. | Known test account history and explicit restore approval. |
| Account deletion | Destructive account operation. | Disposable QA account and explicit deletion approval. |
| Real push delivery or push-click | Sends notifications and can affect device/account state. | Dedicated QA device/account, no-secret evidence plan, and explicit send-path approval. |
| Production DB or token inspection | Privacy and production-data risk. | Separate read/minimize plan and explicit approval. |
| RevenueCat, Google Play Console, FCM, Supabase, Android release changes | External service or release mutation. | Separate release-ops or implementation run with rollback and verification plan. |

## Result Template

Use this shape for later task evidence:

| Check | Status | Evidence | Notes | Protected area touched? | Follow-up |
| --- | --- | --- | --- | --- | --- |
| Example check | `NEEDS-RUN` | Command/manual evidence pending. | None. | No. | None. |

Allowed statuses:

- `PASS`: executed and met expected result.
- `FAIL`: executed and did not meet expected result.
- `BLOCKED`: could not run because a prerequisite or guardrail stopped it.
- `NEEDS-RUN`: planned but not executed yet.

## Current Setup Evidence

- Prior active run status: `android-production-stability-qa-run` was `DONE`.
- Repo sync before setup: local and `origin/main` were in sync.
- Setup changed docs only.
- No smoke command was executed during setup.
- No app code, smoke script, billing, auth, Supabase, FCM, Android release, Play Console, or production-data change was made.
