# Alerts Boxless Pilot Audit

## Scope

- Active run: `boxless-alerts-list-pilot-run`
- Task: `/alerts` 현재 박스 구조 조사
- Date: 2026-05-28
- Code changes: none

## Files Reviewed

- `src/app/alerts/page.tsx`
- `src/components/RadarAlertCenter.tsx`
- `src/components/UsageMeterPanel.tsx`
- `src/components/ui/DesignPrimitives.tsx` usage through `AppSurface`, `PanelCard`, `DataRow`, `MetricRow`, `StatusPill`, `ActionButton`

## Route Structure

`src/app/alerts/page.tsx` is a thin wrapper:

- Uses shared `Header`.
- Uses shared `RadarTopNav`.
- Renders `RadarAlertCenter market={market}`.
- Preserves `market=crypto` and `market=global/stocks` separation.

The route wrapper is not the main box source. The heavy card feeling comes from `RadarAlertCenter`.

## Primary Box Sources

### Top-level alert surface

`RadarAlertCenter` returns:

- `AppSurface padding="lg" className="space-y-4"`

Because `AppSurface` defaults to the `card` variant, the entire alert center becomes one large outer card. Inside it, most sections are additional `PanelCard` or `AppSurface` blocks. This is the main nested-panel source.

### Push permission and device status

The first major content block uses:

- `PanelCard className="bg-ui-inset shadow-none"`
- nested `DataRow` status rows
- nested `AppSurface tone="inset"` for app push stage and warning notes
- conditional login `PanelCard`

This area carries high functional risk because it displays:

- push support state
- permission state
- registration stage
- token/sync-derived status
- market-specific push state
- enable/disable controls

The logic must not change in the pilot.

### Saved setup conditions

The saved setup section uses:

- `PanelCard` for the whole section
- three nested metric `PanelCard className="bg-ui-inset p-3 shadow-none"`
- `AppSurface tone="inset"` for empty states and recent matches
- nested `article` cards for matched setups
- nested `article` cards for saved presets

This is the best pilot candidate because it is visually busy but mostly presentational. It can move toward list rows and divider groups without touching push permission logic.

### Alert rule list

The alert rule section uses:

- `PanelCard` for the section
- `RuleCard` for every rule
- `RuleCard` itself is another `PanelCard`
- status pills for category, tier, enabled state
- toggle switch controls
- `DataRow` for trigger and cadence

This creates repeated card rows. It is a strong candidate for a list-row transformation, but each row includes an enabled toggle, so touch target and accessibility must be preserved.

### Admin diagnostics

Admin-only diagnostics use:

- `AppSurface tone="inset"`
- nested `PanelCard` for test push tools
- `details` with `rounded-ui border bg-ui-panel`
- multiple diagnostic metric `PanelCard`
- candidate event `article` cards

This area should be left alone in the first visual pilot. It is admin-only and touches push diagnostics. It should stay boxed enough to separate operational tools from user-facing settings.

## UsageMeterPanel Findings

`UsageMeterPanel` is not directly rendered by `src/app/alerts/page.tsx` or `RadarAlertCenter` in the current code path.

It is still relevant as a shared Pro/Basic usage pattern:

- Outer `section` uses `enterprise-panel`.
- Each usage row uses `rounded-xl border bg-surface-cardSoft`.
- CTA uses `enterprise-button`.
- Advisory note uses `rounded-xl border bg-accent-blue/10`.

If a future alerts screen adds usage/Pro guidance, it should use list/report treatment instead of importing the current `enterprise-panel` shape unchanged.

## Permission UI

Keep stronger boundaries around:

- enable push button
- disable push button
- permission denied/unsupported warning
- login-required state
- app push stage/error message

Reason:

- These are functional state and recovery controls.
- The user needs clear touch targets.
- Visual weakening must not make permission or failure states ambiguous.

Possible pilot:

- Keep the controls as buttons.
- Convert surrounding explanatory container from card to report/list section.
- Convert status facts to `DataRow` divider rows.

## Push Token Status UI

Do not expose or alter token values.

Current UI displays derived status only:

- connection label
- permission label
- last update time
- current market enablement
- registration stage
- last error text, if present

Keep:

- status labels
- market-specific push state
- enable/disable controls

Avoid:

- adding raw token display
- changing sync conditions
- changing `syncAndroidAppPushPreferences`
- changing registration or listener behavior

## Pro/Basic and Usage UI

Within `RadarAlertCenter`, Pro/Basic appears mostly as:

- `StatusPill` counts in alert rule section
- rule-level tier pills
- entitlement check through `hasMarketEntitlement`

Keep:

- Pro/Basic labels
- paid entitlement logic
- disabled/locked semantics where present

Can weaken:

- repeated rule cards
- nested tier/status pill density if list rows remain readable

Do not change:

- `hasMarketEntitlement`
- billing plan copy
- plan routing
- entitlement checks

## Keep Boxes

Keep or preserve strong boundaries for:

- push permission enable/disable action area
- permission denied, unsupported, failed, or warning states
- login-required callout
- admin diagnostics and push test tools
- toggle switches and any direct state-changing controls
- critical state/error messages

## Remove or Weaken Boxes

Best candidates for the first implementation pass:

1. Change the top-level `RadarAlertCenter` outer `AppSurface` from default card to report/list style.
2. Convert saved setup condition section from `PanelCard` plus nested cards into a report section with divider rows.
3. Replace the three monitor metric `PanelCard`s with inline `MetricRow` or `DataRow` rows.
4. Convert setup match and preset `article` cards into list rows with thin dividers.
5. Convert alert rule `RuleCard` from a card grid into row/list items while keeping toggle touch targets.

## First Pilot Recommendation

Start with the lowest-risk visible change:

- Make `RadarAlertCenter` use a non-card outer surface.
- Convert the saved setup condition section to `variant="report"` or `variant="list"`.
- Keep permission/device status controls visually clear.
- Keep admin diagnostics unchanged.

This should reduce visible nesting without touching push token, FCM, permission, Supabase, billing, auth, or Android logic.

## Hard No-change Areas

The implementation pilot must not change:

- `registerAndroidAppPush`
- `disableAndroidAppPush`
- `syncAndroidAppPushPreferences`
- `registerAppPushListeners`
- `sendAndroidAppPushTest`
- `subscribeAppPushState`
- `Notification.permission` request flow
- `/api/admin/push-diagnostics`
- Supabase session/auth usage
- billing entitlement logic
- route/query handling
