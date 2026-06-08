# Android Production QA Execution

## Scope Status

- Active run: `android-production-qa-execution-run`
- Setup date: 2026-06-09
- Source checklist: [Android Production Stability QA](android-production-stability-qa.md)
- Manual checklist: [Android Production Manual QA](qa/android-production-manual-qa.md)
- Current task state: all execution tasks are `TODO`.

This document turns the completed Android production stability checklist into an execution plan. It is not an implementation plan and does not authorize code, service, release, or production-data changes.

## Operating Rules

- Execute one active-run task at a time.
- Treat every smoke result as evidence only. Do not fix failures inside this run.
- Use `NEEDS-RUN` until a command or manual step is actually executed.
- Use a dedicated QA account for account, login, plan, alert, and settings checks.
- Do not expose credentials, tokens, raw push tokens, service keys, payment keys, or private account identifiers in QA notes.
- Do not perform actual purchase, purchase restore, account deletion, production DB mutation, or real push send.
- Read-only Play Console review is allowed only as manual QA evidence; console changes are out of scope.

## Existing Smoke Command Inventory

This setup records the initial command inventory so later active-run tasks have a starting point. Task 1 still owns the final audit and status updates.

| Command | Script | Current behavior observed from source | Android production QA reuse | Mutation risk | Setup status |
| --- | --- | --- | --- | --- | --- |
| `npm.cmd run smoke:routes` | `scripts/smoke-routes.mjs` | Fetches local routes from `SMOKE_BASE_URL` or `http://127.0.0.1:3000`; includes expected unauthenticated billing guard POST checks. | Useful for local route/API guard reachability after a dev server is running. | LOW-MEDIUM because it sends local POST requests to billing guard endpoints, but expects blocked responses and does not complete payment. | `NEEDS-AUDIT` |
| `npm.cmd run smoke:mobile` | `scripts/smoke-mobile.mjs` | Static checks for PWA/mobile shell, Capacitor config, Android notification assets, dependencies, and migration files. | Useful as a mobile readiness guard. It is not a 360px viewport or screenshot smoke. | LOW; static file reads only. | `NEEDS-AUDIT` |
| `npm.cmd run smoke:billing` | `scripts/smoke-billing.mjs` | Static billing/product/entitlement/source consistency checks. | Useful for read-only product mapping sanity checks when billing scope is approved for smoke review. | MEDIUM because it audits protected billing logic; no purchase is executed. | `NEEDS-AUDIT` |
| `npm.cmd run smoke:api` | `scripts/smoke-api.mjs` | Sends local invalid/oversized API requests and expects validation failures. | Useful for local API guard checks with a dev server. | MEDIUM because it sends local POST requests, including billing guard endpoints; no production target should be used. | `NEEDS-AUDIT` |
| `npm.cmd run smoke:css` | `scripts/smoke-css.mjs` | Fetches local page/CSS assets from `SMOKE_BASE_URL`. | Useful for local CSS asset loading. | LOW if pointed at local dev server only. | `NEEDS-AUDIT` |
| `npm.cmd run smoke:copy` | `scripts/smoke-copy.mjs` | Static scan for blocked user-facing copy and mojibake-like patterns. | Useful for judgment-support wording guard. | LOW; static file reads only. | `NEEDS-AUDIT` |
| `npm.cmd run smoke:launch` | `scripts/launch-review.mjs` | Static launch-readiness scoring across source files. | Useful as a broad readiness signal, not a route or Android-device smoke. | LOW; static file reads only. | `NEEDS-AUDIT` |
| `npm.cmd run smoke:ops` | `scripts/smoke-ops.mjs` | Static ops checks plus a local `/api/macro-calendar` fetch if the dev server is reachable. | Useful for local ops guard checks after confirming target URL. | MEDIUM because it inspects push/cron surfaces and may fetch local API; no push send should occur. | `NEEDS-AUDIT` |
| `npm.cmd run smoke:all` | `scripts/smoke-all.mjs` | Runs multiple smoke scripts, restarts dev server, waits for health, then runs CSS/routes/API checks. | Useful only after individual command risks are understood. | MEDIUM because it starts/stops local dev flow and chains billing/api/ops checks. | `NEEDS-AUDIT` |

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
