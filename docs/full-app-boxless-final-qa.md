# Full App Boxless Final QA

Date: 2026-05-29

Branch: `codex/journal-boxless-form-list-pilot`

Active run: `full-app-boxless-implementation-run`

## Scope

This QA pass verifies the boxless redesign work completed across the main ChartRadar surfaces.

The pass is visual and structural. It does not change app logic, routes, billing, auth, Supabase, Android, FCM, or production behavior.

## Route Screenshot Inventory

All routes below were checked at 360px. The final browser check reported `scrollWidth === clientWidth` for every route.

| Route | Screenshot | Horizontal overflow |
| --- | --- | --- |
| `/` | `reports/verification/final-boxless-entry-360.png` | No |
| `/crypto` | `reports/verification/final-boxless-crypto-360.png` | No |
| `/alts` | `reports/verification/final-boxless-alts-360.png` | No |
| `/global` | `reports/verification/final-boxless-global-360.png` | No |
| `/global/assets` | `reports/verification/final-boxless-global-assets-360.png` | No |
| `/news?market=crypto` | `reports/verification/final-boxless-news-crypto-360.png` | No |
| `/news?market=global` | `reports/verification/final-boxless-news-global-360.png` | No |
| `/alerts?market=crypto` | `reports/verification/final-boxless-alerts-crypto-360.png` | No |
| `/alerts?market=global` | `reports/verification/final-boxless-alerts-global-360.png` | No |
| `/journal?market=crypto` | `reports/verification/final-boxless-journal-crypto-360.png` | No |
| `/journal?market=global` | `reports/verification/final-boxless-journal-global-360.png` | No |
| `/learn` | `reports/verification/final-boxless-learn-360.png` | No |
| `/pro` | `reports/verification/final-boxless-pro-360.png` | No |
| `/account` | `reports/verification/final-boxless-account-360.png` | No |
| `/login` | `reports/verification/final-boxless-login-360.png` | No |
| `/terms` | `reports/verification/final-boxless-terms-360.png` | No |
| `/privacy` | `reports/verification/final-boxless-privacy-360.png` | No |
| `/refund` | `reports/verification/final-boxless-refund-360.png` | No |

Desktop spot checks:

| Route | Screenshot | Horizontal overflow |
| --- | --- | --- |
| `/` | `reports/verification/final-boxless-entry-desktop.png` | No |
| `/crypto` | `reports/verification/final-boxless-crypto-desktop.png` | No |
| `/global` | `reports/verification/final-boxless-global-desktop.png` | No |
| `/pro` | `reports/verification/final-boxless-pro-desktop.png` | No |

## Allowed Remaining Boxes

Boxes are still allowed when they carry a clear interaction, safety, or state boundary:

- Bottom fixed controls and chart controls.
- Primary CTA buttons and segmented controls.
- Login provider buttons.
- Pro checkout and payment action controls.
- Critical, warning, error, and permission notices.
- Destructive-account-delete confirmation.
- Form inputs, textarea fields, select-like controls, modals, and dialogs.
- Admin-only operational tools.

## Removed Or Weakened Box Patterns

Across the run, the implementation reduced:

- Route-level `enterprise-panel` wrappers.
- Repeated card grids for read-only content.
- Nested `PanelCard` and `AppSurface` stacks where list flow was enough.
- Inset metric cards that were better represented as rows.
- Policy, learn, footer, and fallback card shells.

## Preserved Behavior

The run intentionally preserved:

- Coin Radar and Global Radar as equal top-level market modes.
- Global Radar as an independent overseas stocks/futures radar.
- `/crypto`, `/alts`, `/global`, `/global/assets`, `/news`, `/alerts`, `/journal`, `/learn`, `/pro`, account, login, and policy routes.
- Basic/Pro gating.
- Billing plan/product/entitlement mappings.
- Auth/session behavior.
- Supabase data behavior.
- FCM, push token, and push-cron behavior.
- Android and Play Console release behavior.

## Remaining Design Candidates

These can be handled later if more visual tightening is needed:

- Deeper chart internals in `/crypto` and `/global/assets`.
- Admin-only entitlement screens.
- Legacy compatibility routes that render minimal redirect/fallback pages.
- Fine-grained control density on very long mobile screens.

## Validation

- `git diff --check`: passed for the final docs pass.
- Final route screenshot inventory: passed with no horizontal overflow.
