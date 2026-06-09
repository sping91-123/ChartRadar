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
| 1 | DONE | Current settings/account screen audit | What settings/account surfaces exist today, and what is missing for production trust? | Entry-path map and missing-item notes. |
| 2 | TODO | Required settings item list finalization | Which items are required for a production-ready settings/account surface? | Required-item checklist. |
| 3 | TODO | Settings screen structure proposal | How should settings sections be grouped and worded? | Recommended section structure and copy principles. |
| 4 | TODO | Select one first implementation candidate | What is the safest first implementation candidate with the highest trust impact? | One follow-up implementation-run candidate. |

## Task 1 - Current Settings/Account Screen Audit

| Field | Value |
| --- | --- |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Source inspection only. No app code, UI code, user-facing code copy, auth/session logic, Supabase, RLS, billing, RevenueCat, entitlement, account deletion logic, logout/session behavior, production DB, purchase, restore, Android release, Play Console, or external console work was changed or executed. |
| Scope inspected | Settings/account routes, header settings entry, account page, account deletion page, login page, Pro page, alert settings routes, policy/support pages, footer links, app version constant. |
| Next TODO | `2. Required settings item list finalization` |

### Confirmed Routes

| Route | File | Current role |
| --- | --- | --- |
| `/settings` | `src/app/settings/page.tsx` | Redirects to `/menu`; not a standalone settings page. |
| `/menu` | `src/app/menu/page.tsx` | Standalone menu page with links to account, learn, FAQ, Pro, terms, privacy, and refund. |
| Header settings panel | `src/components/Header.tsx`, `src/components/HeaderActions.tsx` | Primary in-app settings entry from the header menu button; pushes browser history to `/menu` while the modal panel is open. |
| `/account` | `src/app/account/page.tsx` | Main account management page for login state, email, provider, current plan, market access, logout, admin entitlement link, and account deletion guide. |
| `/account/delete` | `src/app/account/delete/page.tsx` | Account/data deletion request guide. No direct destructive delete button found in inspected UI. |
| `/login` | `src/app/login/page.tsx` | Google/Kakao login entry with safe `returnTo` handling. |
| `/pro` | `src/app/pro/page.tsx`, `src/components/ProPricingPanel.tsx` | Current plan, Basic/Pro differences, plan cards, Android Google Play purchase flow, and subscription restore entry. |
| `/alerts` | `src/app/alerts/page.tsx` | Alert settings route; defaults crypto users to `/crypto/alert` and uses global/stocks mode when `market=global`. |
| `/crypto/alert` | `src/app/crypto/alert/page.tsx`, `src/components/RadarAlertCenter.tsx` | Crypto alert settings surface. |
| `/terms` | `src/app/terms/page.tsx` | Terms of service page. |
| `/privacy` | `src/app/privacy/page.tsx` | Privacy policy page and account deletion guide link. |
| `/refund` | `src/app/refund/page.tsx` | Subscription cancellation and refund guide. |
| `/faq` | `src/app/faq/page.tsx` | Support-style FAQ with Pro, alerts, data, and policy links. |

### Confirmed Components And Files

| File or component | Current finding |
| --- | --- |
| `src/components/HeaderActions.tsx` | Header menu includes account/login, display settings, alert settings, learn, FAQ, and app version. It does not directly show terms, privacy, refund, account deletion, or support email inside the modal. |
| `src/components/AuthStatus.tsx` | Header compact state shows Basic or plan label. Default variant includes sign-out, but current source usage found only compact variant in `HeaderActions`. |
| `src/components/AppFooter.tsx` | Footer links to terms, privacy, account/data deletion, and refund. It includes investment-risk copy but only the brand name as operator info. |
| `src/components/ProPricingPanel.tsx` | Shows current plan label, market access, purchase buttons, and native restore action `구독 권한 불러오기` when native purchase is available. |
| `src/lib/appVersion.ts` | Defines `APP_VERSION_DISPLAY` as `앱 버전 1.0.8 / 빌드 11`; displayed in `HeaderActions` AppInfo section. |
| `src/app/account/delete/page.tsx` | Provides deletion request email `staronlabs@gmail.com`, deletion scope, retained data scope, and Google Play subscription separation guidance. |

### Current Provided Items

| Area | Current coverage |
| --- | --- |
| Settings entry | Header menu button opens a full-screen settings panel. `/settings` redirects to `/menu`. `/menu` exists as a route-based menu page. |
| Account state | `/account` shows loading, logged-in, and logged-out states. Logged-in state includes display name/email/provider/current plan/join date/last login when available. |
| Login | Header settings panel links to login when logged out. `/account` logged-out state links to `/login?returnTo=%2Faccount`. `/login` offers Google and Kakao login buttons. |
| Logout | `/account` has a logout button in the logged-in account section. `AuthStatus` default variant also has logout behavior, but inspected usage currently uses compact variant only. |
| Current plan | `/account` shows plan label plus Coin Pro and Global Pro access rows. `/pro` shows current plan and market access rows. |
| Purchase/restore | `/pro` contains purchase flow and native subscription restore button when native purchase is available. `/account` links to Pro range for Basic users but does not expose restore directly. |
| Alerts | Header has a bell shortcut to market alert settings. Header settings panel includes `알림 설정`. Alert routes connect to `/crypto/alert` and `/alerts?market=global`. |
| Alert Pro clarity | `RadarAlertCenter` is connected to the recent locked Pro rule UI clarity work; settings/account only links into alert settings and does not repeat that state itself. |
| Support/FAQ | Header settings panel links to FAQ and learn. `/faq` links to terms, privacy, and refund. Refund and privacy pages include support-oriented guidance. |
| Privacy/terms/refund | Footer links to terms, privacy, account deletion, and refund. `/menu` links to terms, privacy, and refund. |
| Account deletion | `/account` separates deletion guidance into a lower dangerous section with a checkbox before linking to `/account/delete`. Footer and privacy page also link to deletion guide. |
| App version | Header settings panel displays `APP_VERSION_DISPLAY`. `/menu` and `/account` do not show app version directly. |

### Missing Or Ambiguous Items

| Area | Missing or ambiguous item | User trust risk |
| --- | --- | --- |
| Settings route model | `/settings` redirects to `/menu`, while the header settings panel uses browser history state and `/menu` while open. | Users or support docs may not know whether Settings means modal panel or `/menu` route. |
| Header settings completeness | Header settings panel has account, display, alerts/learn/FAQ, and version, but not terms/privacy/refund/account deletion/support email. | Production users may need to hunt through footer or `/menu` for policy and deletion paths. |
| `/menu` completeness | `/menu` has account, Pro, policies, refund, FAQ, learn, but does not include alert settings or app version. | Route-based menu is less complete than header modal; support guidance may depend on which entry path the user found. |
| Support/contact | No dedicated support/contact screen found. Support email appears in privacy and account deletion pages, but not as a clear settings item. | Users with billing/account issues may not find a direct contact path quickly. |
| Business/developer information | App version is visible, and app id exists in code, but no clear in-app business/developer information section was found. | Store/support trust can feel incomplete if users need operator/developer details. |
| Plan and restore from account | `/account` shows plan and market access, but restore/subscription management is only found in `/pro` and refund copy. | A user checking account status may not know where to restore or manage a Google Play subscription. |
| Logout grouping | `/account` puts logout in the logged-in account block, while deletion is separated lower down. | Separation is mostly clear, but Task 2 should decide if logout belongs in a dedicated dangerous/account-actions section. |
| App version placement | Version is in header settings modal only. | Users on `/account` or `/menu` may not see version when support asks for it. |

### High-Risk Areas Identified But Not Touched

| Area | Audit note |
| --- | --- |
| Auth/session | `useSupabaseAuth` drives user/profile/session and sign-out. No auth code was changed and no real logout was executed. |
| Supabase/RLS/production DB | Account, profile, subscription, and deletion semantics depend on protected data surfaces. No DB or console access was performed. |
| Billing/RevenueCat/entitlement | `/account` and `/pro` read plan/market access through existing billing helpers; restore and native purchase code remain untouched. |
| Account deletion | `/account/delete` documents manual email-based deletion request. No deletion logic or real deletion test was performed. |
| Android/Play Console | App version is sourced from code; Play Console listing/developer contact was not inspected or changed. |

### Candidate Inputs For TODO 2

- Decide whether the required settings surface should be the header modal, `/menu`, `/account`, or a clearer combination of these.
- Treat app version, support/contact, policy links, account deletion, and subscription restore/manage paths as required-item candidates.
- Consider adding account/status and app-info visibility to route-based pages, because modal-only information is harder to reference in support.
- Keep the next tasks design-only; any implementation should stay UI/copy/accessibility-only unless a separate high-risk run is opened.

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

Task 1 is complete. The next task is `2. Required settings item list finalization`, and no implementation has been authorized in this run.
