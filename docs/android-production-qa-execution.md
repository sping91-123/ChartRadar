# Android Production QA Execution

## Scope Status

- Active run: `android-production-qa-execution-run`
- Setup date: 2026-06-09
- Source checklist: [Android Production Stability QA](android-production-stability-qa.md)
- Manual checklist: [Android Production Manual QA](qa/android-production-manual-qa.md)
- Current task state: Tasks 1-6 `DONE`; active run completed.

This document turns the completed Android production stability checklist into an execution plan. It is not an implementation plan and does not authorize code, service, release, or production-data changes.

## Operating Rules

- Execute one active-run task at a time.
- Treat every smoke result as evidence only. Do not fix failures inside this run.
- Use `NOT_RUN` for automatic and manual items until they are actually executed; use `NEEDS_RUN` for separate-approval or not-currently-runnable items.
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

Task 2 completed by inspecting existing docs, `package.json`, `scripts/`, and route files. No smoke command was executed and no UI code or smoke script was changed.

### Existing Mobile-Relevant Smoke Support

| Existing command or source | 360px support level | What it can confirm | What it cannot confirm |
| --- | --- | --- | --- |
| `npm.cmd run smoke:mobile` | Static mobile readiness only. | Mobile shell, PWA assets, Capacitor config, Android notification asset references, manifest, static push migration expectations. | Browser viewport rendering, text wrapping, horizontal overflow, bottom navigation overlap, safe area, Android WebView behavior. |
| `npm.cmd run smoke:routes` | Route reachability only. | Some core routes return an expected HTTP status when `SMOKE_BASE_URL` is local. | 360px layout, DOM section presence, visual hierarchy, long-text wrapping, Android WebView behavior. |
| `npm.cmd run smoke:css` | CSS asset availability only for `/crypto/home`. | `/crypto/home` HTML references CSS assets and CSS files respond with enough content. | Whether the CSS produces a usable 360px layout or avoids overflow. |
| `npm.cmd run smoke:copy` | Static copy guard only. | Some blocked advisory phrases or broken text patterns in source. | Whether copy fits inside mobile cards/buttons or overlaps UI. |
| `npm.cmd run smoke:billing` | Static billing/source guard only. | `/pro` billing/product source consistency and RevenueCat-related source markers. | Product card visual layout, mobile CTA clipping, purchase button safe visual boundary. |
| Route file inspection | Route existence only. | `src/app/coin/page.tsx`, `src/app/settings/page.tsx`, and other page files exist even when not covered by current route smoke. | Runtime render, data state, 360px viewport, Android WebView behavior. |

Task 2 conclusion:

- Existing smoke commands provide route/static preconditions, not a true 360px viewport smoke.
- No existing command was confirmed to launch a browser, set `width=360`, capture screenshots, inspect DOM bounding boxes, or compare `document.documentElement.scrollWidth` with `window.innerWidth`.
- 360px checks should be manual screenshot review or separate browser-tool QA until a dedicated viewport workflow is approved in a later run.

### Route-Level 360px Coverage

| Screen | Route | 360px elements to check | Existing smoke coverage | Manual check needed? | Automation gap | Failure suspect area | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Coin home | `/coin`; legacy/related coin home route `/crypto/home` | Today's conclusion, readiness score, direction, BTC-led versus alt-led market label, risk and next confirmation conditions, duplicate feeling between top conclusion and existing sections, long-sentence wrapping, bottom navigation overlap. | `/coin` exists by route-file inspection but is not covered by current `smoke:routes`. `/crypto/home` is covered by `smoke:routes`; `smoke:css` checks CSS asset availability for `/crypto/home`. No viewport coverage. | Yes. Required for first viewport, duplicate-feeling judgment, wrapping, and bottom-nav overlap. | Add or use separate 360px browser/screenshot/DOM overflow check; current scripts do not inspect text fit or layout. | Coin home route mapping, `CoinRadarHomePanel`, top decision model, route redirects, CSS/safe-area spacing, bottom navigation. | MEDIUM |
| Crypto overview | `/crypto`, `/crypto/home`, `/crypto/spot`, `/crypto/perpetual` | Main coin screen entry, Basic/Pro exposure differences, core signal/risk copy, empty/loading/error states, advisory wording safety, long card/list wrapping. | `smoke:routes` covers `/crypto` redirects/status and `/crypto/home`, `/crypto/spot`, `/crypto/perpetual`; `smoke:css` covers `/crypto/home` CSS assets. No viewport coverage. | Yes. Required for Basic/Pro state interpretation, chart/card usability, loading/empty/error quality, and Android WebView feel. | No existing screenshot, chart-height, wrapping, or bottom-nav overlap detection. | Crypto route shell, market data fetches, chart rendering, Basic/Pro gating, copy density, CSS asset load. | MEDIUM |
| Alts | `/alts`; detailed route `/crypto/perpetual/alts` | Alt screen entry, alt risk/strength wording, Basic/Pro restriction display, long coin names and symbols, card/list wrapping, mobile breakage. | `smoke:routes` covers `/alts` as redirect/status and `/crypto/perpetual/alts` route reachability. No viewport coverage. | Yes. Required for long symbol/name wrapping, gated-state clarity, and list/card usability. | No existing command detects horizontal overflow, clipped badges, crowded CTAs, or route-specific visual hierarchy. | Alt data availability, Pro gating, card/list layout, redirect mapping, dense labels. | MEDIUM |
| Global | `/global`; related `/global/assets` route exists but is not in current route smoke | US/global market flow entry, today's first assets to review, most important risk, Global Pro CTA, empty/loading states, asset/sector name wrapping. | `smoke:routes` covers `/global`; route-file inspection shows `/global/assets`. No viewport coverage. | Yes. Required for first-read quality, CTA placement, asset/sector wrapping, and Android safe-area/bottom-nav behavior. | No current smoke covers `/global/assets`, viewport overflow, or manual judgment of today's priority/risk. | Global data pipeline, `/global` versus `/global/assets` boundary, CTA placement, asset label width, bottom navigation. | MEDIUM |
| Alerts | `/alerts`, `/alerts?market=crypto`, `/alerts?market=global`, `/crypto/alert` | Alert list entry, empty-list state, long alert title/body wrapping, alert settings entry button, Basic/Pro alert limits, bottom navigation overlap. | `smoke:routes` covers `/alerts`, market query variants, and `/crypto/alert`; `smoke:ops` inspects push/alert source markers only. No viewport or permission dialog coverage. | Yes. Required for permission state, empty/list readability, Pro limits, settings entry, and Android notification UX. | No current smoke detects long alert text overflow, permission/status row wrapping, sticky-control overlap, OS dialog behavior, or targetPath tap behavior. | Alert UI state, permission bridge, Pro alert gating, push source assumptions, text wrapping, bottom navigation. | HIGH |
| Journal | `/journal`, `/journal?market=crypto`, `/journal?market=global` | Journal entry, empty state, record list display, write/detail entry path, long review title/body wrapping, CTA/button overlap. | `smoke:routes` covers `/journal` and market query variants. No viewport coverage. | Yes. Required for empty versus populated state, safe no-data-change navigation, long text wrapping, and button/safe-area placement. | No current smoke detects list/form overflow, detail/write layout, bottom CTA clipping, or account-state differences. | Journal persistence state, route state, empty-state copy, form/list layout, auth/account state. | MEDIUM |
| Pro | `/pro`, `/pro?market=crypto`, `/pro?market=stocks` | Basic versus Pro explanation, Coin Pro/Global Pro/All Market Pro cards, price display, CTA buttons, purchase-button visibility before checkout, long product/caution copy wrapping, no actual purchase. | `smoke:routes` covers `/pro` variants; `smoke:billing` statically audits product/billing source consistency. No viewport coverage. | Yes. Required for product-card layout, price/CTA fit, current-plan interpretation, and safe stop before checkout. | No current smoke verifies card height, price row wrapping, purchase button clipping, current-plan label fit, or Google Play sheet boundary. | Pro pricing panel, billing source mapping, current-plan state, product copy density, mobile CTA layout. | HIGH |
| Settings/account | `/settings`, `/account`, `/account/delete`, `/login`, `/menu`, `/privacy`, `/terms`, `/refund` | Entry path, account state, current plan, notification settings, contact/policy links, logout, account deletion accessibility, app version, long email/nickname wrapping, modal/confirmation bounds. | `smoke:routes` covers `/account`, `/account/delete`, `/login`, `/menu`, `/privacy`, `/terms`, and `/refund`; route-file inspection shows `/settings`, but current `smoke:routes` does not include it. No viewport coverage. | Yes. Required for signed-in/out state, long identity text, logout, deletion warning boundary, modal fit, Android back behavior, and safe-area checks. | No current smoke covers `/settings`, account-state branches, modal bounds, Android back/relaunch, Google login, or long email overflow. | Settings route coverage gap, auth/session state, account panel layout, policy links, deletion-warning UI, safe-area spacing. | HIGH |

### Coverage Classification

Existing smoke can support:

- Route reachability for most core routes when `SMOKE_BASE_URL` is local.
- Static mobile readiness through `smoke:mobile`.
- Static copy guardrails through `smoke:copy`.
- CSS asset serving for `/crypto/home` through `smoke:css`.
- Static `/pro` billing source consistency through `smoke:billing`.

Manual confirmation remains required for:

- Actual 360px screenshots or visual review of every listed route.
- Android WebView behavior, back navigation, force-close/relaunch, and safe-area/navigation-bar overlap.
- Google login, signed-in/out account states, current plan interpretation, and logout.
- Notification permission OS dialogs, settings state, and alert permission recovery.
- Empty/loading/error state quality and whether first-viewport judgment support is clear.

Separate approval remains required for:

- Actual Google Play purchase or purchase restore.
- Account deletion execution.
- Real push delivery, push-click targetPath validation, or raw token inspection.
- Production DB changes or Supabase/FCM/RevenueCat/Google Play Console/Android release configuration changes.

## Production QA Execution Table

Task 3 created the execution table only. No command, smoke, browser check, Android device check, payment, restore, account deletion, push send, production DB query, token inspection, or external console change was executed in this task.

Default status policy:

- `NOT_RUN`: planned automatic or manual item that has not been executed.
- `PASS`: executed and met the expected result.
- `FAIL`: executed and did not meet the expected result.
- `BLOCKED`: could not run because a prerequisite or guardrail stopped it.
- `NEEDS_RUN`: requires a separate approved run or is not currently runnable inside this active-run task.

### AUTO Items

| QA ID | Category | Execution item | Target route or feature | Method | Expected result | Failure record | Failure suspect area | Risk | Runnable timing | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A-001 | AUTO | Worktree whitespace safety | Documentation diff. | Run `git diff --check`. | No whitespace or patch-format errors. | Command output, affected file, line, and whether the issue is docs-only. | Markdown trailing whitespace, malformed table rows, line ending drift. | LOW | Before every docs commit. | `NOT_RUN` |
| A-002 | AUTO | Docs-only and worktree safety | Changed files and untracked files. | Check `git status --short --branch`, `git diff --name-only`, and untracked files. | Only approved `docs/` paths are changed. | Any non-doc path, staged/untracked state, and whether it touches protected areas. | Accidental app, UI, `package.json`, `scripts/`, Android, billing, auth, Supabase, or FCM changes. | LOW | Before commit and before push. | `NOT_RUN` |
| A-003 | AUTO | Sensitive-value diff scan | Documentation diff only. | Scan staged/unstaged docs diff for key, token, secret, password, private key, and JWT-like patterns. | No sensitive value pattern appears in QA notes or diffs. | Matched line without exposing additional context, file path, and stop decision. | Credential leakage, copied token, raw push token, service key, payment key. | HIGH | Before commit. | `NOT_RUN` |
| A-004 | AUTO | TypeScript no-emit check | TypeScript project. | Run `cmd /c npx tsc --noEmit`. | Typecheck completes without errors. | First error block, affected file, whether it predates this docs-only task. | Type drift, stale declarations, unsafe imports, existing app compile issue. | LOW-MEDIUM | After static safety checks, if automatic checks are selected. | `NOT_RUN` |
| A-005 | AUTO | Production build check | Next.js app build. | Run `npm.cmd run build`. | Build completes locally without deploy or release action. | First build error, route/module involved, whether protected runtime assumptions appear. | Next build config, route compile error, server/client import issue, static generation assumption. | LOW-MEDIUM | After typecheck or as selected by Task 4. | `NOT_RUN` |
| A-006 | AUTO | Lint check | App source lint quality. | Run `npm.cmd run lint`. | Lint completes without new failures. | Rule, file, first failure, whether it is unrelated existing debt. | ESLint config, source lint issue, generated output drift. | LOW | After static safety checks, if selected. | `NOT_RUN` |
| A-007 | AUTO | Static copy guard | User-facing source copy and alert copy. | Run `npm.cmd run smoke:copy`. | No blocked advisory wording, broken text, or copy guard failure. | Failing phrase/rule, file, and whether wording looks like investment instruction. | Judgment-support copy, encoded text drift, alert/pro copy regression. | LOW | Good first smoke candidate for Task 4. | `NOT_RUN` |
| A-008 | AUTO | Static mobile readiness guard | Mobile shell, PWA assets, Capacitor config, Android notification asset references. | Run `npm.cmd run smoke:mobile`. | Static mobile readiness checks pass without running Android release tooling. | Failing assertion, file/asset, and whether it touches Android/FCM protected scope. | PWA assets, mobile shell, Capacitor config, notification icon, push migration references. | LOW-MEDIUM | After copy guard or as selected by Task 4. | `NOT_RUN` |
| A-009 | AUTO | Launch-readiness static guard | High-level launch source markers. | Run `npm.cmd run smoke:launch`. | Launch-readiness score/check completes as advisory evidence. | Missing marker, score, and affected source/doc path. | Launch source marker drift, macro/news/alert/mobile/visual readiness marker, stale docs. | LOW | After static safety checks, if selected. | `NOT_RUN` |
| A-010 | AUTO | Route reachability precondition | Core routes and local guard responses. | Run `npm.cmd run smoke:routes` only with local `SMOKE_BASE_URL` and local dev server. | Core routes return expected local statuses and guarded billing endpoints remain blocked. | Base URL, failed route/status, response summary, and confirmation target was local. | Route registration, redirects, local dev server, health endpoint, local billing guard behavior. | MEDIUM | Only after Task 4 confirms local target and dev server conditions. | `NOT_RUN` |
| A-011 | AUTO | CSS/static route precondition | `/crypto/home` CSS asset availability. | Run `npm.cmd run smoke:css` only against local dev server. | CSS assets referenced by `/crypto/home` respond locally and are non-empty. | Base URL, missing CSS href/status/size, and local target confirmation. | CSS chunk generation, `/crypto/home` response, static asset serving. | LOW-MEDIUM | After local server target is confirmed. | `NOT_RUN` |
| A-012 | AUTO | Local API guard precondition | API validation and blocked-response behavior. | Run `npm.cmd run smoke:api` only with local `SMOKE_BASE_URL`. | Invalid/oversized local requests are rejected safely; no production mutation. | Base URL, endpoint, status, response summary, and mutation-risk assessment. | API validation, body-size guards, local billing guard, local service availability. | MEDIUM | Only after Task 4 confirms local target and no production endpoint. | `NOT_RUN` |

### MANUAL Items

| QA ID | Category | Execution item | Target route or feature | Method | Expected result | Failure record | Failure suspect area | Risk | Runnable timing | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M-001 | MANUAL | Play Store production first launch | Google Play installed Android app. | Install/open production app on an approved Android QA device. | App opens production build and lands on a safe first route without blank screen or crash. | Device, Android version, app version, install source, first route, screenshot/recording. | Production install state, WebView shell, initial route, app startup, network. | LOW-MEDIUM | After at least one safe automatic smoke candidate is selected or recorded. | `NOT_RUN` |
| M-002 | MANUAL | Android navigation smoke | Top/bottom navigation, `/coin`, `/crypto`, `/alts`, `/global`, `/alerts`, `/journal`, `/pro`, settings/account. | Tap primary navigation paths on device. | Each primary screen opens and user can move away without trap. | Route, tap path, actual result, screenshot/recording. | Route shell, navigation state, redirects, bottom nav, account gating. | LOW-MEDIUM | After first launch. | `NOT_RUN` |
| M-003 | MANUAL | Android back button smoke | Primary routes and nested/settings routes. | Use Android hardware/software back after visiting core screens. | Back behavior returns to prior safe screen or exits predictably without stale account data. | Start route, target route, back result, any loop or stale screen. | Client router, WebView history, auth/gating redirects, modal state. | MEDIUM | After navigation smoke. | `NOT_RUN` |
| M-004 | MANUAL | App close and relaunch smoke | Android app lifecycle. | Force close or exit app, then relaunch. | App relaunches into a stable route and preserves only expected session/settings state. | Pre-close route/account state, relaunch route, visible session state. | WebView storage, auth session restore, route persistence, loading state. | MEDIUM | After navigation/back smoke. | `NOT_RUN` |
| M-005 | MANUAL | Google login CTA visibility | Signed-out app, settings/account, `/pro`, gated surfaces if visible. | Observe signed-out state and login button/access path. | Login CTA is visible and does not block Basic browsing unnecessarily. | Entry route, CTA text/location, screenshot, any missing path. | Auth UI, settings/account links, gating copy, route-specific login state. | MEDIUM | After navigation smoke with signed-out state. | `NOT_RUN` |
| M-006 | MANUAL | Google login cancel stability | Google account picker or browser/native sign-in flow. | Start login and cancel before success. | App returns to a stable signed-out state without blank screen or loop. | Cancel step, return route, visible error/copy, screenshot/recording. | OAuth redirect, native/WebView bridge, auth error handling, route recovery. | MEDIUM | After login CTA visibility. | `NOT_RUN` |
| M-007 | MANUAL | Google login success and session | Dedicated QA Google account. | Complete login, observe user state, relaunch app. | User state is reflected and session persists after relaunch. | Account type without private identifier, route after login, relaunch state, screenshots. | Auth callback, Supabase session, profile load, WebView storage. | MEDIUM-HIGH | After cancel stability and with dedicated QA account. | `NOT_RUN` |
| M-008 | MANUAL | Logout smoke | Signed-in account/settings path. | Tap logout and revisit account/protected surfaces. | User returns to signed-out state; back/relaunch does not expose prior account screen. | Logout path, resulting route, back behavior, relaunch state. | Auth sign-out, cached profile state, route history, protected UI gating. | MEDIUM | After login success smoke. | `NOT_RUN` |
| M-009 | MANUAL | `/coin` 360px visual review | `/coin`. | Review on Android device or 360px browser screenshot if later approved. | Decision summary, readiness, direction, market label, risk, and next conditions fit without overlap. | Screenshot, viewport/device, text clipping, blank/loading/error state. | Coin home decision model, top layout, copy length, safe-area/bottom nav spacing. | MEDIUM | After route smoke or first device navigation. | `NOT_RUN` |
| M-010 | MANUAL | `/crypto` 360px visual review | `/crypto`, `/crypto/home`, crypto market surfaces. | Review screen state at 360px/device. | Core signals, Basic/Pro exposure, empty/loading/error states, and chart/card layout remain usable. | Screenshot, route, account state, broken element. | Crypto route shell, market data, chart rendering, Basic/Pro gating, copy density. | MEDIUM | After route smoke or first device navigation. | `NOT_RUN` |
| M-011 | MANUAL | `/alts` 360px visual review | `/alts`, `/crypto/perpetual/alts`. | Review screen state at 360px/device. | Alt strength/risk, gating, long symbols, and cards/lists do not break layout. | Screenshot, route, account state, overflow/clipping details. | Alt data, gating, list/card layout, symbol width, redirect mapping. | MEDIUM | After route smoke or first device navigation. | `NOT_RUN` |
| M-012 | MANUAL | `/global` 360px visual review | `/global`, related global entry paths. | Review screen state at 360px/device. | First assets/risk context, Global Pro CTA, and loading/empty states are readable. | Screenshot, route, data state, CTA placement issue. | Global data pipeline, CTA placement, asset labels, safe-area spacing. | MEDIUM | After route smoke or first device navigation. | `NOT_RUN` |
| M-013 | MANUAL | `/alerts` 360px visual review | `/alerts`, `/crypto/alert`, global alert entry. | Review alert list/settings entry at 360px/device. | Empty/list state, settings entry, long alert copy, and Pro limits remain readable. | Screenshot, permission state, plan state, clipping/overlap details. | Alert UI, permission bridge, Pro alert gating, text wrapping, bottom nav. | HIGH | After navigation smoke; before any push-delivery work. | `NOT_RUN` |
| M-014 | MANUAL | `/journal` 360px visual review | `/journal`, market variants. | Review empty/list/write/detail entry paths without creating production data unless separately approved. | Empty/list state and action paths are readable without safe-area overlap. | Screenshot, account state, route, whether data creation was avoided. | Journal persistence, list/form layout, auth state, empty-state copy. | MEDIUM | After login state is known if account-specific. | `NOT_RUN` |
| M-015 | MANUAL | `/pro` 360px and pre-checkout smoke | `/pro`, `/pro?market=crypto`, `/pro?market=stocks`. | Review cards, prices, CTAs, current-plan state, and stop before Google Play checkout. | Basic/Pro value, Coin/Global/All Market plans, prices, and buttons are visible without entering checkout. | Screenshot, account state, plan card, CTA, exact stop point. | Pricing panel, product display, current-plan state, mobile CTA layout. | MEDIUM-HIGH | After navigation smoke; before any billing test. | `NOT_RUN` |
| M-016 | MANUAL | Settings/account 360px smoke | `/settings`, `/account`, `/account/delete`, `/privacy`, `/terms`, `/refund`, settings panel. | Review account state, plan, notification settings, policy links, logout, deletion access boundary. | Controls are visible; deletion is not executed; long email/nickname and modals fit. | Screenshot, signed-in/out state, hidden/clipped control, deletion stop point. | Settings route, account session, policy links, modal layout, deletion-warning UI. | HIGH | After login/logout smoke as appropriate. | `NOT_RUN` |
| M-017 | MANUAL | Alert permission/settings smoke | Android notification permission, `/alerts`, alert settings. | Observe permission allowed/denied/pending state and settings entry; do not send push or expose token. | Permission guidance and Pro alert limits are understandable. | Device permission state, app status copy, screenshot, any mismatch. | Permission bridge, app push state, alert settings, Pro alert gating. | MEDIUM-HIGH | After device navigation; with QA device permission state known. | `NOT_RUN` |
| M-018 | MANUAL | Play Console crash/ANR read-only review | Production crash rate, ANR rate, Android vitals, warnings. | Open Play Console only for read-only observation. | Health signals and warnings are captured without changing release or listing state. | Screenshot/notes, concrete metric/warning text, date/time observed. | Production stability, Android vitals, release warnings, store metadata. | MEDIUM-HIGH | After user-path smoke; read-only only. | `NOT_RUN` |

### Manual QA Checklist Separation

Task 5 separated the Android actual-device checklist into [Android Production Manual QA Checklist](qa/android-production-manual-qa.md). That document is the operator-facing checklist for the production app on a real Android phone.

- Manual QA was not executed in Task 5.
- All manual checklist items default to `NOT_RUN`.
- Real payment, purchase restore, account deletion, real push send, production DB/token lookup or mutation, Android native/release commands, and external service or console changes remain separate-approval items with `NEEDS_RUN`.
- If a manual check fails, record evidence and suspect area first. Do not fix app code or external settings inside this QA execution run.

### APPROVAL_REQUIRED Items

| QA ID | Category | Execution item | Target route or feature | Method | Expected result | Failure record | Failure suspect area | Risk | Runnable timing | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | APPROVAL_REQUIRED | Actual Google Play purchase test | Google Play checkout and subscription activation. | Separate approved billing run with tester account and explicit stop points. | Purchase flow and entitlement update are validated without real customer impact. | Tester setup, product, checkout step, entitlement result, screenshots. | Google Play product state, RevenueCat mapping, billing client, account/session. | HIGH | Separate approved run only. | `NEEDS_RUN` |
| R-002 | APPROVAL_REQUIRED | Purchase restore test | Restore purchase path and entitlement sync. | Separate approved restore run with known purchase history. | Existing purchase restores to the intended account or explains no-purchase state. | Account/setup, restore path, result state, screenshots. | RevenueCat restore, Play account mismatch, app-store sync, Supabase entitlement state. | HIGH | Separate approved run only. | `NEEDS_RUN` |
| R-003 | APPROVAL_REQUIRED | Actual account deletion test | Account deletion flow. | Separate approved destructive test with disposable QA account. | Disposable account deletion behavior is validated and recorded. | Account type, confirmation step, result, policy evidence. | Account deletion route, Supabase data deletion, auth cleanup, policy flow. | HIGH | Separate approved run only. | `NEEDS_RUN` |
| R-004 | APPROVAL_REQUIRED | Real push delivery or push-click test | FCM delivery, notification tap, `targetPath`. | Separate approved notification delivery run with QA device/account and no-secret evidence plan. | Push arrives, tap opens expected route or safe fallback. | Device/account state, payload summary without token, target route, screenshots. | FCM delivery, push token, push-cron, alert scanner, targetPath routing, app push listener. | HIGH | Separate approved run only. | `NEEDS_RUN` |
| R-005 | APPROVAL_REQUIRED | Production DB or push token lookup/mutation | Supabase production DB, token records, account state. | Separate approved data-access run with read/minimize plan. | Any lookup is justified, minimized, and does not expose secrets in notes. | Query purpose, table/scope, redacted evidence, mutation approval if any. | Supabase policy, token storage, account binding, production data integrity. | HIGH | Separate approved run only. | `NEEDS_RUN` |
| R-006 | APPROVAL_REQUIRED | External service or release settings change | Supabase, FCM, RevenueCat, Google Play Console, Android release settings. | Separate release-ops or implementation run with rollback/verification plan. | Change is explicitly approved, bounded, and verified. | Exact setting, before/after evidence, rollback plan, approval note. | External console state, product mapping, release track, FCM config, Android signing/versioning. | HIGH | Separate approved run only. | `NEEDS_RUN` |
| R-007 | APPROVAL_REQUIRED | Android native/release commands | `app:sync`, `app:sync:prod`, `app:add:android`, `app:android`, `app:android:debug`, `app:android:release`, release scripts. | Separate Android release/device run only. | Native/release artifact changes happen only under approved Android scope. | Command, output path, generated/changed files, release risk. | Capacitor sync, Android native project, signing, AAB generation, Play Console release state. | HIGH | Separate approved run only. | `NEEDS_RUN` |

## Safe Smoke Command Candidate Selection

Task 4 selects candidates only. No smoke command, typecheck, build, lint, browser check, Android device check, payment, restore, account deletion, push send, production DB/token lookup, external console action, or Android release command was executed as QA evidence in this task. Required docs validation, such as `git diff --check`, may still run under the active-run verification policy and does not change the execution-table status.

Windows command form: use `npm.cmd run ...` in this repository. When a task description says `npm run ...`, treat the equivalent Windows command as `npm.cmd run ...`.

### First One-Time Execution Candidate

| Rank | Command | Execution purpose | Can confirm | Production data mutation risk | External API or console access risk | Payment/restore/account deletion/push risk | Android production QA safety judgment | Conditions before running | Failure suspect area | Recommended order | Risk | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `git diff --check` | Confirm the worktree diff has no whitespace or patch-format issues before any smoke evidence is trusted. | Whitespace safety for docs and code diffs. | None. Reads local diff only. | None. | None. | Safest first candidate. It is local, fast, non-mutating, and already required for every docs-only QA task. | Confirm the worktree is the intended active-run workspace. | Markdown whitespace, malformed table edits, line-ending or patch formatting issues. | Run first before any build or smoke command in the later execution task. | LOW | `NOT_RUN` |

### Sequential Safe Candidates

These candidates can be run after `git diff --check` in a later task if the operator confirms failures will be recorded only and not fixed inside this QA execution run.

| Rank | Command | Execution purpose | Can confirm | Production data mutation risk | External API or console access risk | Payment/restore/account deletion/push risk | Android production QA safety judgment | Conditions before running | Failure suspect area | Recommended order | Risk | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | `cmd /c npx tsc --noEmit` | TypeScript no-emit check. | Type safety across the configured project without writing build output. | None by command intent. | May resolve local tooling from installed dependencies; no app external console access by command intent. | None. | Safe after `git diff --check`; useful before build/smoke because it catches broad compile drift. | Run from repo root; do not edit app code in this run if failures appear. | Type errors, stale declarations, import drift, existing app compile debt. | Run second. | LOW-MEDIUM | `NOT_RUN` |
| 3 | `npm.cmd run build` | Local production build check. | Build-time route/module readiness and asset compilation. | No production mutation; writes local build output. | Build-time code may evaluate configured app assumptions, but no deploy or console action occurs by command intent. | No actual payment, restore, account deletion, or push send by command intent. | Safe as local evidence, but slower and more environment-sensitive than typecheck. | Run locally only; do not deploy; stop and record if protected runtime assumptions appear. | Next build config, route compile errors, server/client import issues, static generation assumptions. | Run third if time/environment allows. | LOW-MEDIUM | `NOT_RUN` |
| 4 | `npm.cmd run lint` | Static lint check. | ESLint quality and source consistency. | None by command intent; local cache/output only if tooling writes it. | None by command intent. | None. | Safe, but order after build/typecheck is acceptable because this run prioritizes production stability evidence. | Run from repo root; document unrelated existing failures rather than fixing them here. | ESLint config, source lint issues, generated output drift. | Run before or after build depending on desired feedback order. | LOW | `NOT_RUN` |
| 5 | `npm.cmd run smoke:copy` | Static copy guard. | Blocked advisory wording, broken encoded text patterns, and user-facing copy drift in selected app/source files. | None. Static source reads only. | None by command intent. | None. | Best first actual smoke command because it is static, fast, non-mutating, and relevant to ChartRadar judgment-support positioning. | Confirm no app code/copy edits will be made in this run; record failures only. | Judgment-support copy, blocked advisory phrasing, alert/pro copy regression, encoding drift. | First smoke command after safety/type/build checks. | LOW | `NOT_RUN` |
| 6 | `npm.cmd run smoke:mobile` | Static mobile/PWA/Android readiness guard. | Mobile shell, PWA assets, Capacitor config references, Android notification asset references, push migration markers. | None. Static file and image reads only. | None by command intent. | No push send; only static push/Android references are checked. | Safe as a static Android-adjacent guard; failures touching Android/FCM remain report-only in this run. | Confirm no Android native, FCM, or push asset edits will follow without separate approval. | PWA assets, mobile shell, Capacitor config, notification icon, push migration references. | Run after `smoke:copy`. | LOW-MEDIUM | `NOT_RUN` |
| 7 | `npm.cmd run smoke:launch` | Static launch-readiness review. | Launch source markers across brand, billing presence, API guards, macro/news/alerts/mobile/visual/ops readiness. | None. Static source/doc reads by command intent. | None by command intent. | None by command intent. | Safe as advisory readiness evidence; not a release approval. | Treat score/check as evidence only; do not modify launch, billing, ops, or alert code in this run. | Missing launch markers, stale readiness docs, macro/news/alert/mobile source marker drift. | Run after copy/mobile smoke. | LOW | `NOT_RUN` |

### Caution Candidates Not Selected For The First Run

These commands are not selected as the first one-time candidate because they require local server target confirmation, protected-domain awareness, or can be slower/flakier. They may be considered in a later task only after the stated conditions are confirmed.

| Command | Why not first | Production data mutation risk | External API or console access risk | Payment/restore/account deletion/push risk | Conditions before any later run | Failure suspect area | Risk | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `npm.cmd run smoke:routes` | Sends HTTP requests and includes local billing guard checks; useful only with confirmed local `SMOKE_BASE_URL`. | No intended mutation if local only. | Local HTTP target required; unsafe if accidentally pointed at production. | Includes local blocked-response billing POST checks; no real payment if local and guarded. | Confirm dev server is local, `SMOKE_BASE_URL` is local, and billing checks remain blocked-response tests. | Route registration, redirects, local billing guards, dev server availability. | MEDIUM | `NOT_RUN` |
| `npm.cmd run smoke:api` | Sends invalid/oversized local API requests and should not be pointed at production. | No intended mutation if local only. | Local HTTP target required; production target is out of scope. | Includes local billing/watchlist validation requests only; no real payment/push by script intent. | Confirm local `SMOKE_BASE_URL`; do not run against production. | API validation, body-size guards, local service availability, local billing guards. | MEDIUM | `NOT_RUN` |
| `npm.cmd run smoke:css` | Requires local server and only checks CSS asset availability, not visual 360px layout. | None if local only. | Local HTTP target required. | None. | Confirm local dev server and local `SMOKE_BASE_URL`. | CSS chunk generation, `/crypto/home` HTML/CSS asset serving. | LOW-MEDIUM | `NOT_RUN` |
| `npm.cmd run smoke:ops` | Touches ops, macro, alert, and push-cron source assumptions; may fetch local macro API. | No intended mutation if local only. | Local HTTP target may be used; protected ops/push scope requires caution. | No real push by script intent, but it inspects push/cron source markers. | Confirm local target and no-send interpretation; failures are report-only. | Ops config, macro freshness, push source wiring, rate limit/news/alert markers. | MEDIUM | `NOT_RUN` |
| `npm.cmd run smoke:billing` | Static and read-only, but directly audits protected billing/product/entitlement surfaces. | None by command intent. | Reads local source; no console access. | No purchase/restore by command intent, but billing domain is protected. | Run only when billing smoke evidence is explicitly selected; no billing edits in this run. | Product IDs, base plans, entitlement mapping, RevenueCat source wiring, `/pro` pricing copy. | MEDIUM | `NOT_RUN` |
| `npm.cmd run smoke:all` | Chains multiple smoke commands and restarts local dev server; too broad for first execution. | No intended mutation if local only. | Inherits local HTTP target risks from route/API/CSS/ops commands. | Inherits local billing guard checks; no actual payment by script intent if local and guarded. | Confirm every included command is acceptable and local; confirm dev server restart is acceptable. | Any included smoke area, local server restart, route/API readiness. | MEDIUM | `NOT_RUN` |
| `npm.cmd run check:app-billing` | Reads local secret-bearing env presence and protected billing setup. | None by command intent. | No console access, but local env presence is sensitive. | No purchase/restore by command intent. | Run only in a separate billing-readiness task; do not print or expose env values. | Missing env presence, billing product ID drift, RevenueCat/Supabase key presence. | MEDIUM | `NOT_RUN` |

### Run-Forbidden Or Separate-Approval Candidates

| Candidate | Classification | Why forbidden or separated | Required approval boundary | Risk | Status |
| --- | --- | --- | --- | --- | --- |
| `npm.cmd run app:sync` | APPROVAL_REQUIRED | Runs Android production sync and can mutate native project/package state. | Separate Android release/device run. | HIGH | `NEEDS_RUN` |
| `npm.cmd run app:sync:prod` | APPROVAL_REQUIRED | Same production Android sync path as `app:sync`. | Separate Android release/device run. | HIGH | `NEEDS_RUN` |
| `npm.cmd run app:add:android` | APPROVAL_REQUIRED | Adds or mutates Android platform structure; not QA smoke. | Separate Android implementation/release run. | HIGH | `NEEDS_RUN` |
| `npm.cmd run app:android` | APPROVAL_REQUIRED | Opens Android tooling and belongs to native/device operations, not docs-only QA selection. | Separate Android device/release run. | MEDIUM-HIGH | `NEEDS_RUN` |
| `npm.cmd run app:doctor` | APPROVAL_REQUIRED | Capacitor environment diagnostics can involve native setup and is outside this docs-only smoke selection. | Separate Android tooling run. | MEDIUM-HIGH | `NEEDS_RUN` |
| `npm.cmd run app:android:debug` | APPROVAL_REQUIRED | Syncs Android production assets and builds native debug artifact. | Separate Android build run. | HIGH | `NEEDS_RUN` |
| `npm.cmd run app:android:release` | APPROVAL_REQUIRED | Syncs Android production assets and generates release AAB. | Separate Android release run. | HIGH | `NEEDS_RUN` |
| `scripts/set-app-billing-env.ps1` | APPROVAL_REQUIRED | Writes billing env keys and touches secret-bearing billing setup. | Separate billing environment run with secret-handling plan. | HIGH | `NEEDS_RUN` |
| `scripts/set-owner-admin.sql` | APPROVAL_REQUIRED | Supabase SQL mutation for account/admin privileges. | Separate data/admin run with explicit approval. | HIGH | `NEEDS_RUN` |
| Actual Google Play purchase test | APPROVAL_REQUIRED | Can create subscription/account state. | Dedicated tester account and explicit purchase-test approval. | HIGH | `NEEDS_RUN` |
| Purchase restore test | APPROVAL_REQUIRED | Can mutate entitlement/account state. | Known test account history and explicit restore approval. | HIGH | `NEEDS_RUN` |
| Actual account deletion test | APPROVAL_REQUIRED | Destructive account operation. | Disposable QA account and explicit deletion approval. | HIGH | `NEEDS_RUN` |
| Real push delivery or push-click test | APPROVAL_REQUIRED | Sends notifications and can affect device/account state. | Dedicated QA device/account and explicit send-path approval. | HIGH | `NEEDS_RUN` |
| Production DB or token lookup/mutation | APPROVAL_REQUIRED | Privacy, token, and production data integrity risk. | Separate read/minimize plan and explicit approval. | HIGH | `NEEDS_RUN` |
| RevenueCat, Google Play Console, FCM, Supabase, or Android release changes | APPROVAL_REQUIRED | External service or release mutation. | Separate release-ops or implementation run with rollback and verification plan. | HIGH | `NEEDS_RUN` |

### Smoke Execution Report Format

Use this report shape when a later task actually runs the selected command. Do not use it to imply execution happened in Task 4.

| Field | Required content |
| --- | --- |
| Command executed | Exact command, for example `git diff --check` or `npm.cmd run smoke:copy`. |
| Execution time | Local date/time and approximate duration. |
| Preconditions confirmed | Worktree state, local target if any, no production mutation path, and protected-scope guardrails. |
| Status | `PASS`, `FAIL`, or `BLOCKED`. Planned-only candidates remain `NOT_RUN`; separate-approval items remain `NEEDS_RUN`. |
| Output summary | Short summary of important output; do not paste secrets, tokens, raw push token values, or credentials. |
| Protected scope touched? | Yes/No plus scope name if any protected domain was merely inspected. |
| Failure suspect area | First credible suspect area from the execution table. |
| Follow-up | Work-item or separate run candidate if needed; no implementation fix inside this QA execution run. |

## Result Template

Task 6 created the full results workbook-style template at [Android Production QA Results Template](qa/android-production-qa-results.md).

Use the dedicated results template for actual execution evidence. This inline shape remains a compact reference:

| Check | Status | Evidence | Notes | Protected area touched? | Follow-up |
| --- | --- | --- | --- | --- | --- |
| Example check | `NOT_RUN` | Command/manual evidence pending. | None. | No. | None. |

Allowed statuses:

- `NOT_RUN`: planned automatic or manual check that has not been executed.
- `PASS`: executed and met expected result.
- `FAIL`: executed and did not meet expected result.
- `BLOCKED`: could not run because a prerequisite or guardrail stopped it.
- `NEEDS_RUN`: separate-approval or not-currently-runnable item that needs a later approved run.

## Completion State

- `android-production-qa-execution-run` is complete.
- Automatic smoke, manual QA, and separate-approval result recording are documented in [Android Production QA Results Template](qa/android-production-qa-results.md).
- Actual QA execution should use the results template and the manual checklist together.
- No smoke command or manual QA was executed while creating the template.

## Current Setup Evidence

- Prior active run status: `android-production-stability-qa-run` was `DONE`.
- Repo sync before setup: local and `origin/main` were in sync.
- Setup changed docs only.
- No smoke command was executed during setup.
- No app code, smoke script, billing, auth, Supabase, FCM, Android release, Play Console, or production-data change was made.
