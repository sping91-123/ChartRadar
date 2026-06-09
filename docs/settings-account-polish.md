# Settings Account Polish

## Scope Status

- Active run: `settings-account-polish-run`
- Setup date: 2026-06-09
- Run type: audit, structure planning, and first-candidate selection only.
- Previous run context:
  - Android production auto smoke is `DONE/PASS`.
  - `alert-quality-operations-run` is `DONE`.
  - `alert-pro-rule-ui-clarity-run` is `DONE`.

This document defines the audit and planning scope for improving ChartRadar settings/account trust. It does not authorize app code changes, UI implementation, auth/session changes, Supabase changes, billing or RevenueCat changes, entitlement changes, account deletion logic changes, production data access, real logout, real deletion, purchase, restore, Android release changes, or external console work.

## Purpose

- Make the settings/account area feel complete enough for a production Android app.
- Ensure essential trust and support paths are easy to find.
- Keep the first pass focused on audit and one future implementation candidate, not broad account-system changes.
- Separate high-risk surfaces before any implementation work starts.

## Background Evidence

- Android production auto smoke was recorded as `PASS`.
- Alert operations and alert Pro rule UI clarity runs are complete.
- The next user-facing trust surface is settings/account because it ties together account identity, plan visibility, alerts, support, policy links, account deletion, logout, and app version.

## Operating Rules

- Source and document inspection only until a later implementation run is opened.
- Do not modify app/UI code during this run.
- Do not modify auth, Supabase, RLS, billing, RevenueCat, entitlement, account deletion, logout/session, Android release, Play Console, or production configuration.
- Do not run real account deletion, real logout, purchase, restore, production DB/account access, or external-console actions.
- If a finding requires protected logic work, document it and split it into a separate high-risk run.

## Audit Surfaces To Inspect Later

These surfaces are not implementation approval. They are the expected inspection targets for Task 1.

| Surface | Why it matters | Guardrail |
| --- | --- | --- |
| Settings entry path | Users need a predictable way to reach account and support functions. | Inspect only; no route changes. |
| Account state | Users should know whether they are logged in and which account is active. | No auth/session edits. |
| Login/logout | Logout must be understandable but not accidentally mixed with destructive actions. | No logout logic changes or real logout tests. |
| Current plan | Users need Basic/Pro visibility for support and expectation-setting. | No billing, entitlement, RevenueCat, or plan policy edits. |
| Alert settings | Users need a route to notification controls. | No alert delivery or FCM edits. |
| Support/contact | Users need a clear path for refund/support questions. | No external support tooling changes unless separately scoped. |
| Privacy policy and terms | Production users need policy access. | No legal text edits unless separately scoped. |
| Account deletion | Destructive action must be discoverable and clearly separated. | No deletion logic changes or real deletion tests. |
| App version | Support needs a visible version/build reference. | No Android release or versioning edits in this run. |
| Business/developer info access | Production trust and support can depend on discoverable operator info. | Document access only; no listing/console changes. |

## Task Plan

| Order | Status | Task | Main question | Expected output |
| --- | --- | --- | --- | --- |
| 1 | TODO | Current settings/account screen audit | What settings/account surfaces exist today, and what is missing for production trust? | Entry-path map and missing-item notes. |
| 2 | TODO | Required settings item list finalization | Which items are required for a production-ready settings/account surface? | Required-item checklist. |
| 3 | TODO | Settings screen structure proposal | How should settings sections be grouped and worded? | Recommended section structure and copy principles. |
| 4 | TODO | Select one first implementation candidate | What is the safest first implementation candidate with the highest trust impact? | One follow-up implementation-run candidate. |

## Required Item Candidates

| Item | Why it matters | Risk boundary |
| --- | --- | --- |
| Account state | Confirms whether the user is logged in and which account is active. | Auth/session logic protected. |
| Current plan | Reduces subscription/support confusion. | Billing, RevenueCat, and entitlement logic protected. |
| Alert settings | Gives users control over notification behavior. | FCM and delivery logic protected. |
| Support/contact | Helps production users ask refund, bug, and account questions. | External support process not changed in this run. |
| Privacy policy | Required trust/legal access path. | Legal text edits out of scope unless separately requested. |
| Terms of service | Required trust/legal access path. | Legal text edits out of scope unless separately requested. |
| Account deletion | Required destructive-account path. | Deletion logic and real deletion tests protected. |
| Logout | Common account action. | Logout/session behavior protected. |
| App version | Helps support reproduce and triage issues. | Android release/versioning protected. |
| Business/developer information access | Supports production trust and store/support expectations. | Play Console/listing changes protected. |

## Recommended Structure To Evaluate

Task 3 should evaluate whether the settings/account surface should be grouped into:

- Account.
- Subscription/Plan.
- Alerts.
- Customer Support.
- Terms/Policies.
- App Information.
- Dangerous Actions: logout and account deletion.

## First Implementation Candidate Selection Method

Task 4 must select exactly one future implementation candidate. Score candidates by:

- User trust impact.
- Production readiness impact.
- Risk separation from auth, Supabase, billing, RevenueCat, entitlement, logout, and account deletion logic.
- Ability to implement as UI/copy/accessibility only.
- Verification feasibility with static checks and later mobile smoke.
- Small enough scope for one commit.

Likely candidate families:

- Current account/plan status visibility.
- Support, terms, privacy, or business/developer information accessibility.
- App version visibility.
- Logout and account deletion grouping clarity.

## High-Risk Separation

| Area | Status in this run |
| --- | --- |
| Auth/session | Protected; inspect only. |
| Supabase/RLS/production DB | Protected; no query or mutation. |
| Billing/RevenueCat/entitlement | Protected; no product, plan, price, or policy edits. |
| Account deletion | Protected; no logic changes or real deletion tests. |
| Logout/session clearing | Protected; no behavior changes or real logout tests. |
| Android release/Play Console | Protected; no native, release, listing, or console changes. |

## Result Recording Format

Use this format as each TODO completes.

| Field | Value |
| --- | --- |
| Task | `TBD` |
| Status | `TODO` / `DONE` / `BLOCKED` |
| Method | `TBD` |
| Scope inspected or decided | `TBD` |
| Finding summary | `TBD` |
| High-risk area implicated? | `No` / auth / Supabase / billing / RevenueCat / entitlement / deletion / logout |
| Recommended follow-up | `TBD` |
| Implementation allowed in this run? | `No` |

## Final Conclusion

This run is now registered. The next task is `1. Current settings/account screen audit`, and no implementation has been authorized in this run.
