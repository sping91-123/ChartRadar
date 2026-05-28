# Full App Boxless Redesign Plan

Date: 2026-05-28

Active run: `full-app-boxless-redesign-run`

## Decision

ChartRadar will move away from a card-heavy dashboard look and toward a full-screen app experience.

The new direction is not "make cards prettier." The direction is to remove the visual habit of putting every piece of information inside a bordered panel. The app should feel closer to large consumer apps where the screen itself is the layout surface and content is separated by spacing, typography, dividers, tabs, and list rhythm.

Reference direction:

- 당근마켓: local, list-first, minimal visual boxes.
- 토스: full-screen financial flows, strong typography, restrained dividers.
- 유튜브: content-first feed and clear fixed navigation.
- 인스타그램: full-screen rhythm, minimal container chrome.
- 쿠팡: commerce-density without nesting every item in a heavy panel.

These are direction references, not visual copies.

## Scope

The redesign applies to:

- Market selection.
- Coin Radar.
- Global Radar.
- Global assets.
- News and schedules.
- Alerts.
- Journal.
- Learn.
- Pro.
- Settings and account-related entry points.

Coin Radar and Global Radar remain equal top-level market modes.

Global Radar remains an independent radar for global stocks and futures users. It must not become a crypto macro helper.

## Boxless Means

Boxless means:

- The page canvas is the primary container.
- Large page-level cards are not the default.
- Section boundaries come from spacing, typography, and thin dividers.
- Repeated data is shown as list rows, table-like rows, or compact report sections.
- Important controls can be sticky or fixed, but should not make the whole screen feel trapped inside panels.
- A screen should not look like `panel > card > card > chip > mini-card`.

Boxless does not mean:

- No structure.
- No hierarchy.
- No tap affordance.
- No warning state.
- No form boundaries.
- No pricing comparison cards.

## Default Layout Model

Each major screen should move toward this model:

1. Top app bar or compact header.
2. Optional horizontal market/context tabs.
3. Full-width content flow.
4. Section heading.
5. Divider/list/report content.
6. Sticky or fixed bottom navigation/control only when needed.

The visual weight should sit in:

- Text hierarchy.
- Active tab state.
- Key metric scale.
- Thin dividers.
- Icon and label rhythm.
- Bottom navigation or bottom controls.

The visual weight should not sit in:

- Outer cards.
- Nested cards.
- Heavy borders.
- Repeated rounded panels.
- Shadows around every section.
- Dark translucent dock panels covering content.

## Allowed Boxes

Keep visible container boundaries for:

- Login and auth forms.
- Account deletion and destructive confirmation.
- Payment result and checkout states.
- Pro plan comparison cards.
- Critical warning, locked, permission, or error states.
- Modals, dialogs, dropdowns, and popovers.
- Inputs and controls where boundaries are required for touch accuracy.
- Chart canvases when a minimal frame is needed for readability.

Even in these cases:

- Avoid nesting strong cards.
- Use one clear container, not a container inside another container.
- Keep radius and border restrained.

## Remove Or Reduce First

Prioritize removing or weakening:

- Page-level `enterprise-panel`.
- Page-level `PanelCard`.
- Full-width `rounded-lg border bg-surface-card shadow-glow` wrappers.
- Nested `AppSurface` inside `PanelCard`.
- Repeated metric cards where rows would work.
- Explanation boxes that can become text below a heading.
- Large mobile control docks that hide content.
- Duplicate visual boundaries around tabs and selectors.

## Screen Direction

### Market Selection

Direction:

- Full-screen entry page.
- Coin Radar and Global Radar as equal large entry rows or simple full-width actions.
- No outer card.
- No nested brand frame that competes with the choices.

Keep:

- `/crypto` entry.
- `/global` entry.
- Clear product identity.

### Coin Radar

Direction:

- Report-like market screen.
- Top area shows selected market, current state, and key next condition.
- BTC/ETH switch should feel like a lightweight segmented tab, not a card group.
- Summary and indicators should become compact report rows.
- Chart remains a key visual element but should not sit inside several nested wrappers.
- Bottom timeframe/mode controls can remain fixed only if they do not cover content.

Keep:

- `/crypto` route.
- `/majors` compatibility.
- BTC/ETH switch.
- Timeframe and mode switch.
- Basic/Pro gating.
- Existing judgment logic.

### Alts

Direction:

- Scanner/list-first layout.
- Candidate rows replace repeated candidate cards where possible.
- Filters are compact controls, not full panels.

Keep:

- Existing scanner logic.
- Watchlist behavior.
- `/alts` route.

### Global Radar

Direction:

- Independent global market dashboard.
- Market pulse should read like a report feed.
- Sessions, indexes, FX, yields, and risk signals should be rows or grouped report sections.

Keep:

- Global Radar's independent positioning.
- `/global` route.
- Global market logic.

### Global Assets

Direction:

- Dense asset radar with full-width table/list and chart.
- Asset selector and timeframe controls should be compact.
- Mobile dock must be lighter and must not cover key content.

Keep:

- `/global/assets` route.
- Chart visibility.
- Global asset analysis logic.

### News And Schedules

Direction:

- Feed/list style.
- News, events, and schedules should be scan-first.
- Avoid nested digest cards unless a single story needs expansion.

Keep:

- Market-specific news context.
- Crypto/global separation.

### Alerts

Direction:

- Settings list style.
- Alert status and thresholds should read like grouped setting rows.
- Avoid large preset cards unless a preset is actively selected.

Keep:

- Delivery logic.
- Threshold logic.
- Permission and delivery status clarity.

### Journal

Direction:

- Form and history hybrid.
- Form fields can keep boundaries.
- History entries should move toward timeline/list rows.

Keep:

- Entry creation workflow.
- Review/history clarity.

### Learn

Direction:

- Reference list and accordion style.
- Avoid big educational cards.

Keep:

- Expandable indicator explanations.

### Pro

Direction:

- Pro page can keep plan comparison cards because pricing needs containment.
- Supporting copy and benefits should not all become separate cards.

Keep:

- Basic/Pro gating clarity.
- Conservative payment copy.
- Product/plan mapping untouched.

## Common Structure To Design Next

The next design tasks should define:

- `AppShell`: page canvas, spacing, max width, safe area, route header rules.
- `BottomNav`: fixed app navigation or route controls, with restrained background.
- `Section`: heading plus divider/list rhythm, not a card.
- `ListRow`: title, meta, metric, status, optional action.
- `MetricRow`: compact market data row.
- `ReportBlock`: summary group with no outer card.
- `CriticalCard`: explicit exception for warning, auth, billing, Pro, and destructive states.

## Implementation Policy

- Do not implement the whole redesign in one commit.
- Do not touch billing, auth, Supabase, Android, FCM, production DB, or release files as part of design work.
- Do not change routes during the first visual implementation.
- Do not remove Global Radar entry points.
- Do not weaken Basic/Pro gating.
- Do not push UI implementation before screenshot review.

## Recommended Next Step

Before code implementation, define screen-by-screen priority and choose the first implementation screen.

The first implementation should prove the design direction on one bounded surface, not the entire app.
