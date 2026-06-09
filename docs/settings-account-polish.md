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
| 2 | DONE | Required settings item list finalization | Which items are required for a production-ready settings/account surface? | Required-item checklist. |
| 3 | DONE | Settings screen structure proposal | How should settings sections be grouped and worded? | Recommended section structure and copy principles. |
| 4 | DONE | Select one first implementation candidate | What is the safest first implementation candidate with the highest trust impact? | One follow-up implementation-run candidate. |

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
| `src/app/account/delete/page.tsx` | Provides deletion request email `support@staronlabs.com`, deletion scope, retained data scope, and Google Play subscription separation guidance. |

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

## Task 2 - Required Settings Item List Finalization

| Field | Value |
| --- | --- |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Documentation and prioritization only. No app code, UI code, user-facing code copy, auth/session logic, Supabase, RLS, billing, RevenueCat, entitlement, account deletion logic, logout/session behavior, production DB, purchase, restore, Android release, Play Console, or external console work was changed or executed. |
| Input | Task 1 settings/account source inspection and production Android trust requirements. |
| Next TODO | `3. Settings screen structure proposal` |

### Required Settings Item Matrix

| Item | Current provided? | Current location | Missing or unclear point | Priority | Implementation risk | Separate run needed? |
| --- | --- | --- | --- | --- | --- | --- |
| Account state | Partially yes | `/account`, `HeaderActions`, `AuthStatus` compact state | Header modal and route page show different levels of detail; `/menu` does not summarize account state. | Required | LOW if display-only; HIGH if auth/session changes | No for UI/copy display; yes for auth logic |
| Current plan/subscription state | Partially yes | `/account`, `/pro`, `ProPricingPanel`, `AuthStatus` compact state | `/account` shows plan/access, but restore/manage entry is only obvious on `/pro`; plan support path is split. | Required | LOW for links/copy; HIGH for billing/RevenueCat/entitlement behavior | No for links/copy; yes for billing/restore logic |
| Alert settings | Yes, but fragmented | Header bell, `HeaderActions`, `/alerts`, `/crypto/alert` | `/menu` does not include alert settings, and settings/account does not summarize Android push status. | Required | LOW for navigation links; HIGH for FCM/token behavior | No for navigation; yes for delivery/token logic |
| Support/contact | Partially yes | `/faq`, `/privacy`, `/account/delete`, `/refund` | No dedicated support/contact settings item; support email is not easy to find from settings modal. | Required | LOW if link/email display only; MEDIUM if support workflow changes | No for display-only |
| Terms/policies | Yes, but uneven | Footer, `/menu`, `/faq`, `/terms`, `/privacy`, `/refund` | Header settings modal omits terms/privacy/refund/deletion links. | Required | LOW | No |
| Account deletion | Yes | `/account`, `/account/delete`, footer, `/privacy` | Discoverable, but not present in header settings modal or `/menu`; destructive action grouping should be standardized. | Required | LOW for link/grouping; HIGH for deletion logic | No for link/grouping; yes for deletion behavior |
| Logout | Yes | `/account`; default `AuthStatus` variant has logout but current header usage is compact | Logout is not visible in header settings modal; it is separate from deletion but not in a dedicated account-actions group. | Required | LOW for placement/copy; HIGH for session behavior | No for placement; yes for logout behavior |
| App information/version | Partially yes | `HeaderActions` AppInfo section via `APP_VERSION_DISPLAY` | Version is modal-only; `/menu` and `/account` do not expose it for support references. | Required | LOW for display-only; HIGH for Android release/version changes | No for display-only |
| Settings structure itself | Partially yes | Header modal, `/settings` redirect, `/menu`, footer | Users may see different settings inventories depending on entry path; `/settings` redirect makes the model less explicit. | Required | LOW for structure/linking; MEDIUM if route behavior changes | No for docs/UI structure; yes for route behavior changes |
| Business/developer information | Mostly unclear | Footer brand text, account deletion email, app id in code | No clear in-app business/developer information section was found. | Recommended | LOW for display-only; MEDIUM if legal/listing details need confirmation | No for placeholder/link structure; yes for Play Console/legal updates |
| Subscription restore/manage shortcut | Partially yes | `/pro`, `/refund` | Account page users may not know restore/manage lives on Pro/refund surfaces. | Recommended | LOW for link/copy; HIGH for restore implementation | No for link/copy; yes for restore logic |

### High-Risk Items To Split

| High-risk item | Why it is separate | Required current action |
| --- | --- | --- |
| Auth/session behavior changes | `useSupabaseAuth` drives session, profile, sign-out, and entitlement refresh. | Do not modify in this run; only document display gaps. |
| Logout behavior or real logout testing | Real logout changes/session clearing can affect account persistence and support recovery. | Keep as future high-risk run if behavior changes are needed. |
| Account deletion logic or real deletion testing | Destructive account/data action requires policy, DB, and recovery handling. | Keep current guide; do not execute deletion. |
| Billing, RevenueCat, entitlement, product/plan/price changes | Subscription state and restore behavior cross paid-access boundaries. | Only link or describe existing surfaces in low-risk work. |
| Supabase/RLS/production DB work | Account, profile, subscription, and deletion state depend on protected data. | No DB/query work in this run. |
| Android release or Play Console changes | App version and developer info may need store/listing verification. | Document as external follow-up only. |

### Low-Risk First Implementation Candidate Pool

| Candidate | Why it is low-risk | Notes for Task 4 |
| --- | --- | --- |
| Add policy/support links to the header settings panel | Link-only UI change; does not change legal text or protected logic. | High trust impact because it reduces hunting from the main settings entry. |
| Add alert settings and app version to `/menu` | Route-page link/display parity with header modal. | Good if Task 3 chooses `/menu` as the durable settings route. |
| Add support/contact item that points to existing email or FAQ context | Display-only if it reuses existing `contact@staronlabs.com` / `support@staronlabs.com` and FAQ/refund pages. | Avoid creating new external tooling. |
| Add app version to `/account` or `/menu` | Display-only using existing `APP_VERSION_DISPLAY`. | Strong support value with minimal risk. |
| Add subscription manage/restore link from `/account` to `/pro` or `/refund` | Link-only; does not invoke restore or billing APIs. | Keep wording clear that actual restore remains on `/pro`. |
| Standardize account deletion/logout grouping labels | UI/copy-only if actions and routes stay unchanged. | Avoid changing `signOut` or delete request behavior. |

### Section Candidates For TODO 3

- Account: login state, email, provider, account page link.
- Subscription/Plan: current plan, market access, Pro page, restore/manage guidance link.
- Alerts: alert settings route for current market and global/crypto access.
- Support: FAQ, support email, refund guidance.
- Terms/Policies: terms, privacy, refund, account deletion guide.
- App Information: app version/build, brand/developer info access.
- Dangerous Actions: logout and account deletion separated from ordinary settings.

### Task 2 Conclusion

For production trust, the required settings surface should include account state, current plan/subscription state, alert settings, support/contact, terms/policies, account deletion, logout, app information/version, and a clear settings structure. The first implementation should prefer link/display parity and app-info/support discoverability over auth, billing, deletion, or session behavior changes.

## Task 3 - Settings Screen Structure Proposal

| Field | Value |
| --- | --- |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Structure and wording-principle documentation only. No app code, UI code, user-facing code copy, auth/session logic, Supabase, RLS, billing, RevenueCat, entitlement, account deletion logic, logout/session behavior, production DB, purchase, restore, Android release, Play Console, or external console work was changed or executed. |
| Input | Task 1 route/component audit and Task 2 required settings item matrix. |
| Next TODO | `4. Select one first implementation candidate` |

### Current Structure Problem Summary

| Problem | Current shape | Production risk |
| --- | --- | --- |
| Settings route identity is unclear | `/settings` redirects to `/menu`, while the header settings panel opens as a modal and also pushes `/menu` into browser history. | Users and support docs may not have one stable place to describe as "Settings". |
| Header panel is incomplete for trust links | Header panel includes account, display, alerts, learn, FAQ, and version, but not policy, refund, deletion, or support contact links. | Users can enter settings from the most visible path and still miss required trust actions. |
| `/menu` is incomplete as a route-based hub | `/menu` includes account, Pro, FAQ, learn, terms, privacy, and refund, but not alert settings or app version. | The route page is less useful than the modal for app-support tasks. |
| `/account` mixes status and actions | `/account` is the richest account page, but restore/manage guidance is not obvious and logout/deletion grouping can be clearer. | Users checking account state may not know where to manage subscription or distinguish logout from deletion. |
| Support and developer information are not first-class | Support email appears inside policy/deletion pages; business/developer information is not clearly grouped. | Production trust and support recovery require extra hunting. |

### Recommended Information Architecture

Preferred target model:

- `/settings` should be treated as the durable, support-friendly settings hub in a future implementation. It can group account, subscription, alerts, support, policies, app information, and dangerous actions in one route.
- `/menu` should be treated as a quick navigation or legacy auxiliary hub. Until route behavior is changed, it should mirror the most important settings links enough that route users do not lose alert settings, app version, support, or policy access.
- Header settings panel should stay a quick summary and shortcut surface: current account/plan cue, display controls, alert shortcut, support/FAQ/policy shortcuts, app version, and a route link into the durable settings/account surface.
- `/account` should remain the detailed account page: identity, login state, current plan/access, subscription support links, logout, and account deletion guidance. It should not become the general settings inventory.

Route behavior changes such as making `/settings` a standalone page or changing `/menu` redirects are implementation decisions for a later run. For the first low-risk implementation, link/display parity is safer than route remapping.

### Route Role Definitions

| Route or surface | Recommended role | Should contain | Should avoid | Implementation risk |
| --- | --- | --- | --- | --- |
| `/settings` | Canonical settings hub candidate for support docs and Android users. | All required sections or links to them: account, plan, alerts, support, policies, app info, dangerous actions. | Direct billing, auth, deletion, or token behavior changes. | LOW for page/link content; MEDIUM if changing redirects or route ownership. |
| `/menu` | Quick menu and compatibility route while `/settings` role is clarified. | Account, Pro, alerts, FAQ/support, terms, privacy, refund, app version, settings hub link. | Becoming a second inconsistent settings inventory. | LOW for link/display parity. |
| Header settings panel | Fast-access summary panel. | Compact account/plan state, display controls, alert shortcut, support/FAQ, policy links, app version, settings/account route links. | Deep account management or destructive actions as primary controls. | LOW for links and display-only additions. |
| `/account` | Account detail and account actions. | Login state, email/provider, plan/access state, Pro/manage guidance, logout, deletion guide. | General app navigation unrelated to account trust. | LOW for grouping/links; HIGH for auth, logout, billing, or deletion behavior. |
| `/pro` | Subscription explanation and purchase/restore surface. | Plan cards, current plan, restore/manage entry, billing support guidance. | Moving billing actions into settings without a billing-specific run. | HIGH for purchase/restore behavior; LOW for links to existing route. |
| `/alerts` and `/crypto/alert` | Alert configuration surfaces. | Notification settings and market-specific alert controls. | FCM/token/delivery policy changes inside settings-polish work. | LOW for links; HIGH for push/token behavior. |

### Recommended Section Structure

| Section | Included items | Primary route or entry | Wording principle | Risk level |
| --- | --- | --- | --- | --- |
| Account | Login state, account identifier, provider, account detail link, login CTA when logged out. | Header panel, `/settings`, `/account`. | Show current state first: logged in, logged out, or checking session. | LOW for display/linking; HIGH for auth/session changes. |
| Subscription/Plan | Current plan, Coin/Global/All Market access cue, Pro page link, restore/manage guidance link. | `/account`, `/settings`, `/pro`. | Use "manage" and "confirm" language, not pressure or guarantee language. | LOW for links; MEDIUM for plan display copy; HIGH for billing/RevenueCat/entitlement changes. |
| Alerts | Alert settings link, Coin/Global alert links, Android push permission guidance as a pointer. | Header panel, `/settings`, `/menu`, `/alerts`, `/crypto/alert`. | Frame as notification control, not trade instruction. | LOW for links; HIGH for FCM/token/push delivery changes. |
| Customer Support | FAQ, support contact, refund/subscription guide. | `/settings`, header panel, `/menu`, `/faq`, `/refund`. | Make help discoverable without creating a new support workflow. | LOW if reusing existing email/pages. |
| Terms/Policies | Terms, privacy, refund policy, account deletion guide. | `/settings`, header panel, `/menu`, footer. | Keep labels plain and easy to scan. | LOW for links; MEDIUM if legal text changes are requested. |
| App Information | App version/build display, service name, developer/business information access. | Header panel, `/settings`, `/menu`, `/account` support area. | Support-friendly: make version and operator context easy to quote. | LOW for display; HIGH for Android release or Play Console changes. |
| Dangerous Actions | Logout and account deletion separated from ordinary settings. | `/account`, `/settings` dangerous-action group. | Clear but calm; deletion must remain visibly different from logout. | LOW for grouping; HIGH for logout/deletion behavior. |

### Wording Principles

- Lead with the user's current state: account, plan, notification access, and app version.
- Use "manage", "check", "view", and "guide" for subscription/account support paths.
- Keep logout and account deletion labels explicit, but avoid alarmist copy.
- Keep policy and support labels short enough for 360px screens.
- Do not use investment-instruction, profit-guarantee, or trade-entry language in settings or alert settings links.
- Do not imply a paid feature is active when the current plan only shows an upgrade path.

### Mobile And Android Considerations

- Section labels should remain readable at 360px without relying on long single-line copy.
- Long email addresses, plan names, and policy links should wrap without pushing action buttons off-screen.
- Dangerous actions should not sit under sticky navigation or look like ordinary navigation items.
- Header panel shortcuts should not be the only place where version/support/policy information exists.
- If `/settings` becomes a standalone route later, it should be easier to screenshot and share with support than the transient header modal.

### Implementation Risk Separation

| Risk level | Examples | Allowed direction for a later low-risk implementation |
| --- | --- | --- |
| LOW | Add links, add section labels, show existing `APP_VERSION_DISPLAY`, expose existing FAQ/privacy/terms/refund/deletion routes, mirror alert settings links. | Safe candidate pool for Task 4. |
| MEDIUM | Improve current plan display, add subscription manage/restore guidance from account, reposition logout area, clarify `/settings` versus `/menu` route behavior. | Requires tighter diff review and static/mobile verification. |
| HIGH | Auth/session changes, real logout behavior changes, account deletion logic, billing/RevenueCat/entitlement changes, Supabase/RLS/production DB changes, Android release or Play Console changes. | Split into separate high-risk run; do not select as first implementation candidate. |

### Criteria For TODO 4 First Candidate Selection

Task 4 should select one candidate that:

- Improves the most visible production trust gap.
- Can be implemented as link/display/section structure only.
- Does not touch auth, session, billing, RevenueCat, entitlement, Supabase, account deletion behavior, logout behavior, Android release, or Play Console.
- Has a clear verification path with `git diff --check`, TypeScript/build if code is later changed, and mobile smoke if UI is later changed.
- Reduces inconsistency between header settings panel, `/menu`, `/settings`, and `/account`.

The strongest low-risk candidates after this structure proposal are:

- Add missing support/policy/deletion links and app version visibility to the most-used settings entry.
- Add alert settings and app version parity to `/menu`.
- Add a subscription manage/restore guidance link from `/account` to existing `/pro` or `/refund` surfaces.

### Task 3 Conclusion

The recommended structure is to treat `/settings` as the future canonical settings hub, `/menu` as a quick or compatibility menu, the header panel as a summary/shortcut surface, and `/account` as account detail plus account actions. The first implementation candidate should be link/display parity rather than route remapping or protected account/billing logic.

## Task 4 - First Implementation Candidate Selection

| Field | Value |
| --- | --- |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Candidate prioritization and run closure documentation only. No app code, UI code, user-facing code copy, auth/session logic, Supabase, RLS, billing, RevenueCat, entitlement, account deletion logic, logout/session behavior, production DB, purchase, restore, Android release, Play Console, or external console work was changed or executed. |
| Input | Task 1 audit, Task 2 required settings item list, and Task 3 structure proposal. |
| Selected future implementation run | `settings-support-links-polish-run` |
| Opened automatically? | `No` |

### TODO 1-3 Synthesis

| Source | Main finding | Implication for first implementation |
| --- | --- | --- |
| Task 1 audit | Header settings panel is the most visible entry but lacks policy, refund, deletion, and clear support contact links. `/menu` lacks alert settings and app version. | Fix discoverability before touching account, billing, or route ownership behavior. |
| Task 2 required items | Support/contact, terms/policies, account deletion, app version, alerts, and settings structure are required production trust items. | A link/display-only polish can cover several required items with low risk. |
| Task 3 structure proposal | `/settings` can become the future canonical hub, `/menu` can stay quick/compatibility, header panel should be summary/shortcut, `/account` should remain account detail. | The first implementation should improve shortcut parity rather than remap routes or change protected logic. |

### Candidate Evaluation

| Rank | Candidate run | Scope | User trust impact | Implementation risk | Protected-area separation | Verification clarity | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `settings-support-links-polish-run` | Improve access to support, FAQ, terms, privacy, refund, account deletion guide, alert settings, and app version from settings/menu surfaces. | HIGH: users can find production support and policy paths faster. | LOW if limited to links, section labels, and existing version display. | Strong: no auth, billing, Supabase, entitlement, logout, deletion behavior, or DB changes required. | Clear: static diff plus TypeScript/build/mobile smoke in the implementation run if UI code changes. | SELECTED |
| 2 | `settings-app-info-developer-info-run` | Improve app version, service name, and developer/operator information access. | MEDIUM: improves support and store trust. | LOW to MEDIUM because business/developer wording may need confirmation. | Strong if display-only; weaker if Play Console/legal wording changes are needed. | Clear for display-only changes. | Defer; can be included only if info is already confirmed. |
| 3 | `settings-account-status-polish-run` | Clarify account state and current plan display. | HIGH: directly affects account confidence. | MEDIUM because plan/access display can touch entitlement or billing-adjacent assumptions. | Needs careful boundary around `useSupabaseAuth`, billing helpers, and entitlement reads. | Good, but requires broader code review. | Defer. |
| 4 | `settings-danger-zone-polish-run` | Separate logout and account deletion into a clearer dangerous-actions area. | MEDIUM to HIGH for account safety. | MEDIUM to HIGH because logout/deletion behavior must remain untouched. | Possible but fragile near auth/session and deletion routes. | Good only if grouping is UI-only. | Defer. |
| 5 | `settings-subscription-management-entry-run` | Clarify subscription management and restore entry from account/settings. | HIGH for paying users. | HIGH because it is billing, RevenueCat, Google Play, and entitlement adjacent. | Weak unless strictly link-only. | Requires billing-specific review and possibly `smoke:billing`. | Separate high-risk or billing-adjacent run. |

### Selected First Implementation Candidate

Selected candidate: `settings-support-links-polish-run`.

Recommended implementation goal:

- Improve production-trust link discoverability across the most visible settings entry points.
- Prefer header settings panel and `/menu` parity because those are the surfaces where current users are most likely to look first.
- Reuse existing routes and constants only: `/faq`, `/terms`, `/privacy`, `/refund`, `/account/delete`, `/alerts` or `/crypto/alert`, and `APP_VERSION_DISPLAY`.
- Keep changes limited to links, labels, section grouping, and app-version visibility.

### Selection Rationale

- It addresses the clearest user-trust gap found in Task 1: users can open settings but still miss support, policy, refund, deletion, or app-version paths.
- It covers multiple required Task 2 items without changing protected systems.
- It aligns with Task 3's model of header panel as a summary/shortcut surface and `/menu` as quick/compatibility route.
- It avoids auth/session, billing, RevenueCat, entitlement, Supabase, production DB, logout behavior, account deletion behavior, Android release, and Play Console changes.
- It is small enough for one implementation commit and easy to revert.

### Allowed Scope For The Future Run

| Allowed item | Boundary |
| --- | --- |
| Add or reorganize links to existing support/policy routes | Do not edit legal text or create a new support backend. |
| Add app version visibility using existing `APP_VERSION_DISPLAY` | Do not change Android version, build number, package metadata, or release config. |
| Add alert settings link parity to `/menu` or header settings panel | Do not change FCM, push token, notification permission, or alert delivery logic. |
| Improve section labels and grouping | Keep wording support-oriented and non-investment-advice. |
| Reuse existing account deletion guide link | Do not change deletion behavior or execute deletion. |

### Forbidden Scope For The Future Run

| Forbidden item | Reason |
| --- | --- |
| Auth/session changes, real login/logout tests, or logout behavior changes | Protected account behavior. |
| Billing, RevenueCat, product/plan/price, entitlement, purchase, or restore changes | Paid-access boundary. |
| Supabase, RLS, production DB, account data, or production token work | Production data boundary. |
| Account deletion logic changes or real deletion tests | Destructive account boundary. |
| Android native/release, Play Console, or external console changes | Release/store boundary. |
| Route ownership remapping such as making `/settings` standalone | MEDIUM route behavior work; not needed for first low-risk polish. |

### Final Run Conclusion

`settings-account-polish-run` is complete. The selected next active-run candidate is `settings-support-links-polish-run`; it has now been registered separately after explicit setup. The next run should implement only the low-risk support/policy/app-version/link-accessibility polish unless the owner explicitly expands scope.

## Follow-Up Active Run Registration

| Field | Value |
| --- | --- |
| Registered date | 2026-06-09 |
| Active run | `settings-support-links-polish-run` |
| Source candidate | Task 4 from `settings-account-polish-run` |
| Intended scope | Low-risk settings/menu/header UI link and copy polish for support, FAQ, terms, privacy, refund guidance, alert settings, account deletion guidance, and app version. |
| Excluded high-risk areas | Auth/session, logout/session logic, account deletion logic, billing, RevenueCat, entitlement, Supabase/RLS, production DB, Android release, Play Console, purchase, restore, and external console work. |

## Settings Support Links Polish - Task 1 Link Location Audit

| Field | Value |
| --- | --- |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Source inspection and documentation only. No app code, UI code, user-facing code copy, auth/session logic, Supabase, RLS, billing, RevenueCat, entitlement, account deletion logic, logout/session behavior, production DB, purchase, restore, Android release, Play Console, or external console work was changed or executed. |
| Scope inspected | `/settings`, `/menu`, header settings panel, `/account`, `AppFooter`, FAQ/privacy/refund/account deletion pages, and existing app version constant usage. |
| Next TODO | `2. Support and policy link proposal` |

### Current Link Location Table

| Route or surface | Currently present links or information | Missing or low-accessibility items |
| --- | --- | --- |
| `/settings` | `src/app/settings/page.tsx` redirects to `/menu`. It has no standalone settings content. | No direct FAQ, support contact, privacy, terms, refund, alert settings, account deletion guide, or app version display except what `/menu` provides after redirect. |
| `/menu` | Links to `/account`, `/learn`, `/faq`, `/pro`, `/terms`, `/privacy`, and `/refund`. | No direct alert settings link, no direct support/contact item, no account deletion guide link, and no app version display. |
| Header settings panel | Shows compact account/login section, display settings, alert settings link through `marketAlertHref`, `/learn`, `/faq`, and `APP_VERSION_DISPLAY`. | No terms, privacy, refund/subscription guide, account deletion guide, or direct support/contact item. |
| `/account` | Shows login/account state, email/provider details, current plan/access rows, Basic-to-`/pro` link, logout button, gated `/account/delete` guide link, and `AppFooter`. | No app version display on the account page itself, no explicit FAQ/support item, no alert settings link, and no direct subscription restore/manage entry beyond `/pro`/refund context. |
| `AppFooter` | Links to `/terms`, `/privacy`, `/account/delete`, and `/refund`. Shows service-risk copy and `Chart Radar.` service name. | No FAQ link, no direct support/contact item, no app version/build display, and no clear business/developer information beyond service name. |
| `/faq` | Provides FAQ content and links to `/terms`, `/privacy`, and `/refund`. | No direct support email/contact callout and no app version. |
| `/privacy` | Mentions contact email `contact@staronlabs.com` for privacy inquiries and links to `/account/delete`. | Contact path is deep inside policy copy, not exposed as a settings/contact item. |
| `/refund` | Explains subscription cancellation/refund guidance and what to include when contacting support. | Does not show a direct support email in the inspected page body. |
| `/account/delete` | Shows account/data deletion request guidance and support email `support@staronlabs.com`; clarifies store subscription cancellation is separate. | Delete support path is available only after reaching a destructive-action guide. |
| App version source | `APP_VERSION_DISPLAY` exists in `src/lib/appVersion.ts` and is rendered in header settings panel `AppInfoSection`. | Version is not shown in `/menu`, `/account`, footer, FAQ, privacy, or refund pages. |

### Missing Or Low-Accessibility Items

| Item | Current state | Why it matters |
| --- | --- | --- |
| Direct support/contact | Contact/support emails exist in privacy and account deletion guide, but not as first-class settings/menu/header items. | Users with billing, account, or app-version questions may not find contact guidance quickly. |
| Alert settings from `/menu` | Header panel and header bell expose alert settings, but `/menu` does not. | Users who land on the route-based menu lose a settings function available in the modal. |
| Account deletion guide from `/menu` and header panel | Footer, `/account`, and privacy expose deletion guide, but main settings/menu shortcuts do not. | Production account-management expectations are harder to satisfy from the most visible settings entry. |
| Terms/privacy/refund from header settings panel | Present in `/menu`, footer, and FAQ, but absent from the header settings panel. | The most visible settings panel is incomplete for trust/policy paths. |
| App version outside header panel | Present only in header settings panel. | Support cannot reliably tell users to find version on route-based pages. |
| Business/developer information | Service name exists, app id appears in code, and support email exists in policy/deletion pages, but no clear developer/business info section was found. | This should not be invented; it needs confirmed source information before display. |

### Duplicated But Different-Role Items

| Item | Current duplicates | Role difference |
| --- | --- | --- |
| FAQ | `/menu`, header settings panel, and FAQ page footer links to policies. | FAQ is both a support entry point and a bridge to policy pages. |
| Terms/privacy/refund | `/menu`, `AppFooter`, `/faq`; privacy also links to deletion. | `/menu` is route navigation, footer is global policy access, FAQ is support context. |
| Account deletion guide | `/account`, `/privacy`, `AppFooter`, `/account/delete`. | `/account` is guided account action; footer/privacy are policy access; deletion page is the full request guide. |
| Alert settings | Header bell, header settings panel, `/alerts`, `/crypto/alert`. | Header is quick access; alert routes are actual configuration surfaces. |
| App version | Header settings panel only. | No duplicated support-friendly route location yet. |

### Low-Risk Improvement Candidates For TODO 2

| Candidate | Why low-risk |
| --- | --- |
| Add alert settings and app version to `/menu` | Link/display-only parity with header settings panel. |
| Add FAQ/support, terms, privacy, refund, and account deletion guide links to header settings panel | Existing route links only; no account, billing, or deletion behavior changes. |
| Add direct contact/support items that reuse `contact@staronlabs.com` and `support@staronlabs.com` context | Uses already published contact/support text; avoid creating a new support workflow. |
| Add FAQ and app version to `AppFooter` or route-based settings surfaces | Display/link-only; improves support discoverability. |
| Add support/policy/app-version block to `/account` | Useful when users are already checking account state, as long as logout/deletion/auth behavior is untouched. |

### Needs Confirmation Or Higher-Risk Items

| Item | Reason |
| --- | --- |
| Business/developer information display | Confirm exact legal/operator details before showing anything beyond existing service name/email. |
| Standalone `/settings` route | Changing redirect/route ownership is broader than link polish and should be handled separately if selected. |
| Subscription restore/manage behavior | Billing/RevenueCat/Google Play adjacent; do not add new restore behavior in this run. |
| Account deletion flow changes | Only link to existing guide; do not change confirmation, deletion request, or execution behavior. |
| Logout placement or behavior changes | Link polish should not alter `signOut`, reload, or session clearing behavior. |

### Task 1 Handoff To TODO 2

TODO 2 should propose the smallest implementation set around route/link parity: header settings panel policy/support links, `/menu` alert settings and app version, and optionally a footer or account support/app-version cue. It should avoid standalone `/settings` route changes, support workflow creation, billing restore behavior, logout behavior, account deletion behavior, and unconfirmed business/developer information.

## Settings Support Links Polish - Task 2 Support And Policy Link Proposal

| Field | Value |
| --- | --- |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Improvement proposal and implementation-boundary documentation only. No app code, UI code, user-facing code copy, auth/session logic, Supabase, RLS, billing, RevenueCat, entitlement, account deletion logic, logout/session behavior, production DB, purchase, restore, Android release, Play Console, or external console work was changed or executed. |
| Input | Task 1 link-location audit for `/settings`, `/menu`, header settings panel, `/account`, `AppFooter`, and support/policy pages. |
| Next TODO | `3. Minimal support/policy link implementation` |

### Current Problem Summary

- `/settings` currently redirects to `/menu`, so the route-based settings experience depends on `/menu` completeness.
- `/menu` has account, FAQ, Pro, terms, privacy, and refund links, but lacks alert settings, account deletion guide, app version, and direct support/contact.
- Header settings panel already has alert settings, FAQ, and app version, so adding every policy link there could make the panel too heavy.
- `/account` should stay focused on account state, plan, logout, and account deletion guidance rather than becoming the full support directory.
- `AppFooter` is already the global policy surface, but it lacks FAQ, direct support/contact, and app version.

### Improvement Goals

- Make support and policy routes findable from route-based settings/menu surfaces.
- Preserve the header settings panel as a light summary/shortcut surface.
- Reuse existing routes and constants only: `/faq`, `/terms`, `/privacy`, `/refund`, `/account/delete`, `/alerts` or `/crypto/alert`, and `APP_VERSION_DISPLAY`.
- Reuse existing contact information only if it already appears in source (`contact@staronlabs.com` for inquiries and `support@staronlabs.com` for customer support); do not invent business/developer information.
- Keep the implementation link/display/copy-only and avoid account, billing, deletion, logout, session, push delivery, or route-ownership behavior changes.

### Route And Surface Proposal

| Route or surface | Proposed direction | Include in TODO 3? | Rationale | Risk |
| --- | --- | --- | --- | --- |
| `/menu` | Add alert settings, account deletion guide, support/contact, and app version visibility while keeping existing account, FAQ, Pro, terms, privacy, and refund links. | Yes | `/settings` redirects here, so `/menu` should be the reliable route-based support/settings hub for Android users. | LOW if link/display-only. |
| Header settings panel | Keep current account/display/alert/learn/FAQ/version structure. Optionally add one lightweight path to the route-based menu or support/policy hub only if implementation stays compact. | Not first priority | The panel is already a modal shortcut; overloading it with every policy link can reduce scanability. | LOW for one link; MEDIUM for broad panel restructuring. |
| `/account` | Keep account state, plan, logout, and deletion guide focus. Do not add restore/manage behavior. A later UI-only support block can be considered if `/menu` and footer are not enough. | No for TODO 3 | Account is auth/billing-adjacent; avoid expanding the first low-risk implementation into account semantics. | MEDIUM if touching plan/account copy; HIGH if behavior changes. |
| `AppFooter` | Add FAQ, support/contact cue, and app version display while keeping terms, privacy, account deletion, and refund links. | Yes | Footer already acts as global policy/trust surface; adding FAQ/contact/version improves production support discoverability without route behavior changes. | LOW if display-only. |
| `/settings` | Keep redirect behavior unchanged in this run. | No | Making `/settings` standalone is broader route ownership work and not required for support-link polish. | MEDIUM route behavior risk. |

### Minimum Implementation Scope For TODO 3

Recommended TODO 3 scope:

1. `/menu`
   - Add an alert settings link that points to an existing alert settings route.
   - Add account deletion guide access via existing `/account/delete`.
   - Add support/contact items that reuse existing `contact@staronlabs.com` and `support@staronlabs.com` context or point to FAQ/support guidance.
   - Show existing app version using `APP_VERSION_DISPLAY`.
   - Keep existing FAQ, Pro, terms, privacy, and refund links.

2. `AppFooter`
   - Add FAQ link.
   - Add support/contact cue using existing contact information only.
   - Add app version display using `APP_VERSION_DISPLAY`.
   - Keep existing terms, privacy, account deletion, and refund links.

3. Header settings panel
   - Leave as-is unless a small link to `/menu` is needed after implementation review.
   - Do not add a dense list of every policy link to the modal.

4. `/account`
   - Leave account behavior and layout untouched in TODO 3.
   - Do not add subscription restore/manage behavior.

### Excluded Implementation Scope

| Excluded item | Reason |
| --- | --- |
| Auth/session, login/logout, or `useSupabaseAuth` behavior changes | Protected account state and session behavior. |
| Billing, RevenueCat, product/plan/price, entitlement, purchase, or restore behavior | Paid-access and store-purchase boundary. |
| Supabase, RLS, production DB, account data, or production token access | Production data boundary. |
| Account deletion logic, confirmation behavior, or real deletion testing | Destructive account boundary; link to existing guide only. |
| Standalone `/settings` route or redirect behavior change | Broader route ownership decision, not link polish. |
| Business/developer information not already confirmed in source | Avoid inventing legal/operator details. |
| Android release, Play Console, external console, or store-listing changes | Release/store boundary. |

### High-Risk Or Confirmation-Needed Items

| Item | Handling |
| --- | --- |
| Business/developer details | Leave as "needs confirmed source" unless owner provides exact text. Existing service name and support email can be reused. |
| Mailto behavior on Android WebView | If a `mailto:` link is used later, record it as needing manual Android QA. A plain text email avoids WebView handoff risk. |
| Alert settings route choice | Prefer existing route behavior; do not alter FCM, token, permission, or delivery logic. |
| Subscription management wording | Keep refund/subscription guidance as links to existing `/refund` or `/pro`; do not imply new restore/manage behavior. |

### TODO 3 Implementation Instruction Summary

Implement a low-risk link/display polish centered on `/menu` and `AppFooter`. Use only existing routes and `APP_VERSION_DISPLAY`. Reuse `contact@staronlabs.com` for inquiries and `support@staronlabs.com` for customer support because they are confirmed contact channels. Do not change header panel density unless a single lightweight `/menu` or support entry is clearly needed. Do not touch `/account`, auth/session, billing, RevenueCat, entitlement, Supabase, account deletion logic, logout/session logic, Android release, Play Console, production DB, or actual login/logout/delete/payment/restore flows.

## Settings Support Links Polish - Task 4 Documentation Update

| Field | Value |
| --- | --- |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Documentation update only. No additional app code, UI code, user-facing code copy, email value, auth/session logic, Supabase, RLS, billing, RevenueCat, entitlement, account deletion logic, logout/session behavior, production DB, purchase, restore, Android release, Play Console, or external console work was changed or executed. |
| Input | Task 3 implementation results and follow-up email-role correction. |
| Next TODO | `5. Safe validation execution` |

### Implementation Summary

| Area | Result |
| --- | --- |
| `/menu` | Added access to alert settings, inquiry/customer support, account/data deletion guidance, and app version display while preserving existing account, FAQ, Pro, terms, privacy, and refund links. |
| `AppFooter` | Added FAQ, inquiry, customer support, and app version visibility while preserving terms, privacy, account deletion, and refund links. |
| Policy/account guide pages | Updated privacy inquiry contact and account/data deletion support contact to StarOn Labs domain emails. |
| Version source | Reused existing `APP_VERSION_DISPLAY`; no new versioning system was added. |
| Contact role split | `contact@staronlabs.com` is used for general inquiries. `support@staronlabs.com` is used for customer support and account/data deletion requests. |
| Removed legacy contact | Existing legacy Gmail address references were removed from the repository. |

### Resolved Risks

| Resolved risk | How it was reduced |
| --- | --- |
| Low alert-settings discoverability from `/menu` | `/menu` now includes an alert settings entry. |
| Unclear inquiry/customer support path | `/menu` and `AppFooter` now expose StarOn Labs domain contact/support entries. |
| Limited app-version visibility | `/menu` and `AppFooter` now show `APP_VERSION_DISPLAY`. |
| Footer missing FAQ/contact access | `AppFooter` now links to FAQ and contact/support channels. |
| Gmail-based trust concern | Repository references were moved from the legacy Gmail address to StarOn Labs domain emails. |
| Production trust information scattered across surfaces | Route-based menu and global footer now cover the main support/policy/app-info paths more consistently. |

### High-Risk Areas Not Changed

| Area | Status |
| --- | --- |
| Auth/session | No changes. |
| Logout/session behavior | No changes. |
| Account deletion logic or execution | No changes; only the existing guide/contact copy was updated. |
| Billing, RevenueCat, product ID, plan ID, entitlement, price, purchase, or restore behavior | No changes. |
| Supabase, RLS, production DB, account data, or production tokens | No changes. |
| Android native/release settings or Play Console | No changes. |
| `/settings` standalone route | Not created; `/settings` still follows existing redirect behavior. |
| Real login/logout/deletion/payment/restore tests | Not executed. |

### Verification Results Recorded

| Check | Result |
| --- | --- |
| `git diff --check` | PASS |
| `cmd /c npx tsc --noEmit` | PASS |
| `npm.cmd run build` | PASS |
| `npm.cmd run smoke:copy` | PASS |
| Protected area diff check | PASS - no auth, Supabase, billing, RevenueCat, entitlement, account deletion logic, logout/session, Android release, Play Console, package script, or production DB changes. |
| Legacy contact scan | PASS - the legacy Gmail address no longer remains in the repository. |

### Remaining Risks

| Remaining risk | Follow-up |
| --- | --- |
| `/settings` still redirects to `/menu` | Keep as-is for this run; standalone settings route should be a separate route-structure task if needed. |
| Header settings panel still has limited direct policy links | Keep panel lightweight; reassess only if users still miss policy/support paths after `/menu` and footer polish. |
| Business/developer information display is not finalized | Requires confirmed legal/operator text before display. |
| Subscription restore/manage entry remains billing-adjacent | Separate high-risk or billing-adjacent run required. |
| Account deletion/logout real behavior not manually validated | Separate manual QA required; do not combine with link polish. |
| `mailto:` behavior in Android WebView is not device-tested | Record for Android manual QA or a later WebView-specific check. |

## Settings Support Links Polish - Task 5 Safe Validation Execution

| Field | Value |
| --- | --- |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Final validation and run-closure documentation only. No additional app code, UI code, copy, email value, auth/session logic, logout/session behavior, account deletion logic, Supabase, RLS, billing, RevenueCat, entitlement, production DB, Android release, Play Console, purchase, restore, or external console work was changed or executed. |
| Input | Final state after Task 3 implementation, email-role correction, and Task 4 documentation. |
| Run result | `PASS` |

### Final Validation Results

| Check | Result |
| --- | --- |
| `git diff --check` | PASS |
| `cmd /c npx tsc --noEmit` | PASS |
| `npm.cmd run build` | PASS - production build completed and generated static pages `57/57`. |
| `npm.cmd run smoke:copy` | PASS - no prohibited or broken user-facing copy was detected. |
| `npm.cmd run smoke:mobile` | PASS - mobile/PWA packaging readiness checks passed. |
| Legacy Gmail scan | PASS - no legacy Gmail address matches remain in the repository. |
| Protected path diff check | PASS - no auth/session, logout/session, account deletion logic, Supabase/RLS, billing/RevenueCat/entitlement, production DB, Android release, Play Console, package, or script changes were present in this TODO. |
| Final worktree before documentation | PASS - no build artifacts or temporary validation files were left after validation. |

### Final Email State

| Role | Address |
| --- | --- |
| General inquiries | `contact@staronlabs.com` |
| Customer support and account/data deletion support | `support@staronlabs.com` |
| Legacy Gmail address | Removed from source and docs without reintroducing the old address text. |

### Run Closure Conclusion

`settings-support-links-polish-run` is complete. Support, policy, account/data deletion guide, and app-version link polish has been implemented, documented, and safely validated. This run does not open further automatic implementation work.

### Remaining Risks Kept For Follow-Up

| Remaining risk | Follow-up |
| --- | --- |
| `/settings` still redirects to `/menu` | Keep as-is unless a separate route-structure run is opened. |
| Header settings panel direct policy links remain limited | Keep the panel lightweight; reassess only if `/menu` and footer access are still insufficient. |
| Business/developer information display is not finalized | Requires confirmed legal/operator text before display. |
| Subscription restore/manage entry remains billing-adjacent | Separate high-risk or billing-adjacent run required. |
| Account deletion/logout real behavior is not manually validated | Separate manual QA required. |
| Android WebView `mailto:` behavior is not device-tested | Real-device QA required before claiming full Android handoff coverage. |

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

Task 4 is complete. `settings-account-polish-run` is done. The selected future implementation candidate is `settings-support-links-polish-run`, and it has now been opened as the current active run after explicit setup.
