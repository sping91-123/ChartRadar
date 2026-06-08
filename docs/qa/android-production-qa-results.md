# Android Production QA Results Template

## Scope

- Active run source: `android-production-auto-smoke-run`
- Prepared by: `android-production-qa-execution-run`
- Execution plan: [Android Production QA Execution](../android-production-qa-execution.md)
- Manual checklist: [Android Production Manual QA Checklist](android-production-manual-qa.md)
- Stability checklist: [Android Production Stability QA](../android-production-stability-qa.md)
- Template status: auto smoke preflight safety and TypeScript static-check results recorded; build, lint, and smoke commands have not been executed yet.

This template records results after Android production QA is actually executed. It does not authorize app code changes, UI changes, smoke script changes, production data changes, actual payment, purchase restore, account deletion, real push send, production DB/token lookup or mutation, Android native/release commands, or external console changes.

## Active Auto Smoke Run Setup

| Field | Value |
| --- | --- |
| Active run | `android-production-auto-smoke-run` |
| Setup date | `2026-06-09` |
| Planned safe commands | `git status --short`; `git diff --check`; `cmd /c npx tsc --noEmit`; `npm.cmd run build`; `npm.cmd run lint`; `npm.cmd run smoke:copy`; `npm.cmd run smoke:mobile`; `npm.cmd run smoke:launch` |
| Forbidden smoke commands | `npm.cmd run smoke:all`; `npm.cmd run smoke:billing`; `npm.cmd run smoke:api`; `npm.cmd run smoke:routes`; `npm.cmd run smoke:css`; `npm.cmd run smoke:ops`; `npm.cmd run check:app-billing` |
| Forbidden Android/release commands | `npm.cmd run app:sync`; `npm.cmd run app:sync:prod`; `npm.cmd run app:add:android`; `npm.cmd run app:android`; `npm.cmd run app:doctor`; `npm.cmd run app:android:debug`; `npm.cmd run app:android:release` |
| Forbidden external actions | Actual payment, purchase restore, account deletion, real push send, production DB/token lookup or mutation, Supabase/FCM/RevenueCat/Google Play Console/Android release setting changes. |
| Setup result | `AUTO-SAFE-001` and `AUTO-TS-001` are `PASS`; remaining command evidence stays `NOT_RUN` until each task executes. |

## Status Definitions

| Status | Meaning | Use when |
| --- | --- | --- |
| `NOT_RUN` | Not executed yet. | Planned automatic or manual QA item has not been run. |
| `PASS` | Expected result matched actual result. | The check was executed and no issue was found. |
| `FAIL` | Executed but actual result differed from expectation. | The check produced a user-visible, command, or console issue. |
| `BLOCKED` | Could not execute because a prerequisite stopped it. | Environment, account, device, permission, access, local server, or console access prevented execution. |
| `NEEDS_RUN` | Requires separate approval or separate setup. | Item needs a high-risk run, test account, device setup, or external approval before execution. |

## 1. Execution Summary

Fill this section once per actual QA pass.

| Field | Value |
| --- | --- |
| Execution date | `2026-06-09 01:19:59 +09:00` |
| Executor | `Codex` |
| Target app version | `TBD` - not checked in preflight safety task. |
| Target commit | `49732b2e0b1c3fae1716666c8e1dfdf3660d9b85` |
| Test device | `N/A` - automatic local preflight only. |
| Android OS version | `N/A` - automatic local preflight only. |
| Install path | `N/A` - local repository preflight only. |
| QA account state | `N/A` - no account flow executed. |
| QA scope | Auto smoke preflight safety check and TypeScript static check only. Build, lint, smoke, manual device QA, and Play Console review were not executed. |
| Overall result | `PASS` for `AUTO-SAFE-001` and `AUTO-TS-001`; broader auto smoke run still in progress. |
| Summary counts | PASS: `2`; FAIL: `0`; BLOCKED: `0`; NOT_RUN: remaining planned checks; NEEDS_RUN: separate-approval items unchanged. |
| Protected areas touched? | `No`. |
| Notes | Branch/upstream/worktree safety was previously confirmed; `cmd /c npx tsc --noEmit` passed with no output and no emitted files. |

## 2. Automatic Smoke Results

Record command results only after a command is actually executed. Do not paste secrets, raw tokens, credentials, or private account identifiers into output summaries.

| QA ID | Category | Execution item | Execution time | Executor | Environment | Command or steps | Expected result | Actual result | Status | Evidence | Failure suspect area | Follow-up | Bugfix run needed? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AUTO-SAFE-001 | AUTO | Auto smoke preflight safety check | `2026-06-09 01:14:34 +09:00` | `Codex` | `X:\Chart-Radar`; branch `main`; upstream `origin/main`; target commit `d481bdc9f7e2a39bac489f0f501d0cdc2c755810`. | `git status --short`; `git branch --show-current`; `git rev-parse --abbrev-ref --symbolic-full-name @{u}`; `git rev-list --left-right --count HEAD...@{u}`; `git diff --check`. | Branch is `main`; upstream is `origin/main`; ahead/behind is `0/0`; working tree is clean; `git diff --check` passes; active-run is `android-production-auto-smoke-run`; forbidden commands are reflected. | Branch `main`; upstream `origin/main`; ahead/behind `0/0`; working tree clean; `git diff --check` passed with no output; active-run title confirmed; forbidden command list present. | `PASS` | Command outputs summarized in this row; no secrets or tokens present. | Branch/upstream/worktree drift, active-run mismatch, forbidden-command policy drift, whitespace errors. | Completed; TypeScript static check recorded separately as `AUTO-TS-001`. | `No` |
| A-001 | AUTO | Worktree whitespace safety | `TBD` | `TBD` | Local repo | `git diff --check` | No whitespace or patch-format errors. | `TBD` | `NOT_RUN` | screenshot/log/commit/link: `TBD` | Markdown whitespace, malformed table rows, line endings. | `TBD` | `No` |
| AUTO-TS-001 | AUTO | TypeScript static check | `2026-06-09 01:19:59 +09:00` | `Codex` | `X:\Chart-Radar`; branch `main`; target commit `49732b2e0b1c3fae1716666c8e1dfdf3660d9b85`. | `cmd /c npx tsc --noEmit` | TypeScript compile/type check passes without emitting files. | Command exited with code `0`; no stdout/stderr output; no emitted files reported. | `PASS` | Command output summarized in this row; no secrets or tokens present. | Type mismatch, stale type definitions, route/component prop mismatch, environment type mismatch, generated type mismatch. | Proceed to TODO 3, build check, only when requested. | `No` |
| A-005 | AUTO | Production build check | `TBD` | `TBD` | Local repo | `npm.cmd run build` | Build completes locally without deploy or release action. | `TBD` | `NOT_RUN` | screenshot/log/commit/link: `TBD` | Next build config, route compile errors, server/client imports. | `TBD` | `No` |
| A-006 | AUTO | Lint check | `TBD` | `TBD` | Local repo | `npm.cmd run lint` | Lint completes without new failures. | `TBD` | `NOT_RUN` | screenshot/log/commit/link: `TBD` | ESLint config, source lint issue, generated output drift. | `TBD` | `No` |
| A-007 | AUTO | Static copy guard | `TBD` | `TBD` | Local repo | `npm.cmd run smoke:copy` | No blocked advisory wording, broken text, or copy guard failure. | `TBD` | `NOT_RUN` | screenshot/log/commit/link: `TBD` | Judgment-support copy, blocked phrasing, alert/pro copy drift. | `TBD` | `No` |
| A-008 | AUTO | Static mobile readiness guard | `TBD` | `TBD` | Local repo | `npm.cmd run smoke:mobile` | Static mobile readiness checks pass without Android release tooling. | `TBD` | `NOT_RUN` | screenshot/log/commit/link: `TBD` | PWA assets, mobile shell, Capacitor config, notification icon, push references. | `TBD` | `No` |
| A-009 | AUTO | Launch-readiness static guard | `TBD` | `TBD` | Local repo | `npm.cmd run smoke:launch` | Launch-readiness check completes as advisory evidence. | `TBD` | `NOT_RUN` | screenshot/log/commit/link: `TBD` | Launch markers, macro/news/alert/mobile readiness markers. | `TBD` | `No` |

### Caution Smoke Notes

Use this section only if a caution command is later executed with explicit local-target confirmation.

| Command | Was it run? | Preconditions confirmed | Result summary | Status | Follow-up |
| --- | --- | --- | --- | --- | --- |
| `npm.cmd run smoke:routes` | No | Local `SMOKE_BASE_URL` and local dev server required. | `TBD` | `NOT_RUN` | `TBD` |
| `npm.cmd run smoke:api` | No | Local `SMOKE_BASE_URL` required; do not run against production. | `TBD` | `NOT_RUN` | `TBD` |
| `npm.cmd run smoke:css` | No | Local dev server and local `SMOKE_BASE_URL` required. | `TBD` | `NOT_RUN` | `TBD` |
| `npm.cmd run smoke:ops` | No | Local target and no-send interpretation required. | `TBD` | `NOT_RUN` | `TBD` |
| `npm.cmd run smoke:billing` | No | Protected billing scope must be explicitly selected; no billing edits. | `TBD` | `NOT_RUN` | `TBD` |
| `npm.cmd run smoke:all` | No | Every included command and dev server restart must be acceptable. | `TBD` | `NOT_RUN` | `TBD` |
| `npm.cmd run check:app-billing` | No | Secret-bearing env presence check; do not expose values. | `TBD` | `NOT_RUN` | `TBD` |

## 3. Manual Android QA Results

Use [Android Production Manual QA Checklist](android-production-manual-qa.md) for detailed execution steps. Record grouped results here after the phone check is executed.

| QA ID | Category | Execution item | Execution time | Executor | Environment | Command or steps | Expected result | Actual result | Status | Evidence | Failure suspect area | Follow-up | Bugfix run needed? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M-GROUP-001 | MANUAL | Play Store production first launch | `TBD` | `TBD` | Android production app | Manual checklist `M-001` to `M-003`. | Production app opens without crash and reaches stable first screen. | `TBD` | `NOT_RUN` | screenshot/log/commit/link: `TBD` | Play Store install state, WebView shell, startup route, network. | `TBD` | `No` |
| M-GROUP-002 | MANUAL | Navigation, back, and relaunch | `TBD` | `TBD` | Android production app | Manual checklist `M-010` to `M-020`. | Core routes open; back and relaunch are stable. | `TBD` | `NOT_RUN` | screenshot/log/commit/link: `TBD` | Navigation shell, route history, safe area, session restore. | `TBD` | `No` |
| M-GROUP-003 | MANUAL | 360px or actual-device visual review | `TBD` | `TBD` | Android production app | Manual checklist `V-001` to `V-005`. | Cards, text, CTAs, modals, and state copy fit the screen. | `TBD` | `NOT_RUN` | screenshot/log/commit/link: `TBD` | CSS layout, typography, safe-area spacing, modal bounds. | `TBD` | `No` |
| M-GROUP-004 | MANUAL | Google login and logout smoke | `TBD` | `TBD` | Android production app with QA account | Manual checklist `L-001` to `L-007`. | Login cancel/success, session, logout, and deletion boundary are safe. | `TBD` | `NOT_RUN` | screenshot/log/commit/link: `TBD` | OAuth callback, Supabase session, profile load, auth cache. | `TBD` | `No` |
| M-GROUP-005 | MANUAL | `/pro` pre-checkout review | `TBD` | `TBD` | Android production app | Manual checklist `B-001` to `B-007`; stop before checkout/restore. | Plan cards, prices, CTAs, and checkout boundary are clear. | `TBD` | `NOT_RUN` | screenshot/log/commit/link: `TBD` | Pricing panel, product display, current-plan state, CTA layout. | `TBD` | `No` |
| M-GROUP-006 | MANUAL | Notification permission and settings | `TBD` | `TBD` | Android production app | Manual checklist `N-001` to `N-008`; no push or token exposure. | Alerts, permission state, settings, and Pro limits are understandable. | `TBD` | `NOT_RUN` | screenshot/log/commit/link: `TBD` | Alert route, permission bridge, Pro gating, token readiness. | `TBD` | `No` |
| M-GROUP-007 | MANUAL | Settings and account screen | `TBD` | `TBD` | Android production app | Manual checklist `S-001` to `S-007`; do not execute deletion. | Account state, current plan, links, logout, deletion boundary, and version are clear. | `TBD` | `NOT_RUN` | screenshot/log/commit/link: `TBD` | Account panel, plan label, policy links, deletion warning, app metadata. | `TBD` | `No` |
| M-GROUP-008 | MANUAL | Play Console read-only review | `TBD` | `TBD` | Play Console read-only | Manual checklist `C-001` to `C-004`; no console changes. | Crash, ANR, warnings, and release status are recorded read-only. | `TBD` | `NOT_RUN` | screenshot/log/commit/link: `TBD` | Android vitals, production crash/ANR, release warnings, store metadata. | `TBD` | `No` |

## 4. Separate Approval Required Results

These items should remain `NEEDS_RUN` until a separate approved run exists.

| QA ID | Category | Execution item | Execution time | Executor | Environment | Command or steps | Expected result | Actual result | Status | Evidence | Failure suspect area | Follow-up | Bugfix run needed? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | APPROVAL_REQUIRED | Actual Google Play purchase test | `TBD` | `TBD` | Separate billing test run | Dedicated tester account and explicit stop points. | Purchase flow and entitlement update are validated safely. | `TBD` | `NEEDS_RUN` | screenshot/log/commit/link: `TBD` | Google Play product state, RevenueCat mapping, billing client, session. | `android-production-billing-test-run` | `No` |
| R-002 | APPROVAL_REQUIRED | Purchase restore test | `TBD` | `TBD` | Separate restore test run | Known purchase history and explicit restore approval. | Restore reconnects the intended purchase or explains no-purchase state. | `TBD` | `NEEDS_RUN` | screenshot/log/commit/link: `TBD` | RevenueCat restore, Play account mismatch, app-store sync, entitlement state. | `android-production-billing-test-run` | `No` |
| R-003 | APPROVAL_REQUIRED | Actual account deletion test | `TBD` | `TBD` | Separate destructive account test run | Disposable QA account and explicit deletion approval. | Deletion behavior is validated only for disposable account. | `TBD` | `NEEDS_RUN` | screenshot/log/commit/link: `TBD` | Account deletion route, Supabase deletion, auth cleanup, policy flow. | `android-production-account-deletion-test-run` | `No` |
| R-004 | APPROVAL_REQUIRED | Real push delivery or push-click test | `TBD` | `TBD` | Separate notification delivery run | Dedicated QA device/account and explicit send-path approval. | Push arrives and opens expected `targetPath` or safe fallback. | `TBD` | `NEEDS_RUN` | screenshot/log/commit/link: `TBD` | FCM delivery, push token, push-cron, alert scanner, targetPath routing. | `android-production-notification-delivery-run` | `No` |
| R-005 | APPROVAL_REQUIRED | Production DB or token lookup/mutation | `TBD` | `TBD` | Separate data-access run | Read/minimize plan and explicit approval. | Any lookup is justified, minimized, and redacted. | `TBD` | `NEEDS_RUN` | screenshot/log/commit/link: `TBD` | Supabase policy, token storage, account binding, production data integrity. | `android-production-data-access-review-run` | `No` |
| R-006 | APPROVAL_REQUIRED | External service or release changes | `TBD` | `TBD` | Separate release-ops or service run | Explicit approval, rollback plan, and verification plan. | Change is bounded and verified. | `TBD` | `NEEDS_RUN` | screenshot/log/commit/link: `TBD` | RevenueCat, Google Play Console, FCM, Supabase, Android release settings. | Dedicated high-risk run by surface. | `No` |
| R-007 | APPROVAL_REQUIRED | Android native/release commands | `TBD` | `TBD` | Separate Android release/device run | Explicit approval for native/release tooling. | Native/release artifact changes are intentional and verified. | `TBD` | `NEEDS_RUN` | screenshot/log/commit/link: `TBD` | Capacitor sync, Android native project, signing, AAB generation. | `android-release-ops-run` | `No` |

## 5. Failure Record Template

Copy this table once for every `FAIL` or unresolved `BLOCKED` item.

| Field | Value |
| --- | --- |
| Failure ID | `QA-F-000` |
| Related QA ID | `TBD` |
| Reproduction steps | `TBD` |
| Expected result | `TBD` |
| Actual result | `TBD` |
| Environment | Device, Android OS, app version, install path, account state, commit. |
| Screenshot/log location | `TBD` |
| Failure suspect area | `TBD` |
| Severity | `LOW` / `MEDIUM` / `HIGH` / `BLOCKER` |
| User impact | `TBD` |
| Temporary workaround available? | `Yes` / `No` / `Unknown`; details: `TBD` |
| Protected area implicated? | `No` / billing / auth / Supabase / FCM / Android release / Play Console / production DB |
| Recommended follow-up run | `TBD` |
| Separate bugfix run needed? | `Yes` / `No` / `Unknown` |

Severity guide:

- `LOW`: cosmetic, documentation, or non-blocking clarity issue.
- `MEDIUM`: user-visible route, layout, wording, or workflow issue with workaround.
- `HIGH`: login, plan display, notification, billing-adjacent, data exposure risk, or repeated core-route failure.
- `BLOCKER`: app cannot launch, primary navigation is unusable, auth is unusable, protected data is exposed, or Play Console health shows urgent production risk.

## 6. Next Active-Run Recommendation Criteria

Use this table after the QA pass is summarized.

| Condition after QA | Recommended next active-run | Notes |
| --- | --- | --- |
| No failures found | `alert-quality-operations-run` | Continue with alert quality/frequency review only after production stability has no blockers. |
| LOW or MEDIUM UI/copy/layout failures | `android-production-bugfix-triage-run` | Triage scoped UI/copy fixes; keep billing/auth/Supabase/FCM protected unless explicitly opened. |
| Billing or subscription failure | `android-production-billing-test-run` | High-risk run with tester account, no product/config edits without approval. |
| Auth, session, logout, or account-state failure | `android-production-auth-device-qa-run` | High-risk auth run; no Supabase/auth code changes without approval. |
| Notification permission, token, delivery, duplicate, or targetPath failure | `android-production-notification-delivery-run` or `alert-quality-operations-run` | Delivery/token/targetPath needs notification run; duplicate/frequency needs alert-quality run. |
| Production DB/token issue | `android-production-data-access-review-run` | Requires read/minimize plan and explicit approval. |
| Play Console crash or ANR issue | `android-production-crash-anr-triage-run` | Read-only evidence first; implementation run only after triage. |
| Android release/native tooling issue | `android-release-ops-run` | Separate Android release approval required. |
| Android production stable and iOS can resume | `ios-testflight-readiness-run` | Start only after Android stability results are reviewed. |

## Completion Notes

- This file is a template. It should be copied or filled during an actual QA execution task.
- Do not convert `NEEDS_RUN` items to `PASS` or `FAIL` without a separate approved run.
- Do not fix failures in this result file. Record evidence and open the appropriate follow-up run.
