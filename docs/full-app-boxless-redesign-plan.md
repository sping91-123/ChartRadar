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

## Planning Bundle Standards

This section closes active-run tasks 1, 2, and 3 at the planning level. It is still documentation only. It does not implement UI code, does not change routes, and does not modify `DesignPrimitives`.

## Full App Design Philosophy

ChartRadar should stop looking like an AI-generated SaaS dashboard. The redesign target is a full-screen mobile app pattern used by mature consumer apps.

What changes:

- The page itself becomes the surface.
- Content flows top to bottom without being trapped in repeated cards.
- Boundaries come from spacing, typography, divider lines, sticky controls, and list rhythm.
- Major areas use fewer backgrounds, fewer borders, fewer shadows, and fewer rounded containers.
- Repeated market data becomes rows, feed items, compact report blocks, or table-like layouts.
- Bottom navigation or required bottom controls can stay fixed, but the rest of the screen should feel open.

What must disappear:

- `panel > card > card` nesting.
- Large `enterprise-panel` shells around pages.
- Repeated `PanelCard` usage for simple spacing.
- Metric tiles that could be dense rows.
- Explanatory boxes that could be plain copy under a heading.
- Heavy translucent bottom docks that cover content.

What stays:

- Clear hierarchy.
- Tap-safe controls.
- Active states.
- Warning and locked states.
- Forms and pricing comparison where boundaries are necessary.

## Screen Priority Matrix

| Screen | Remove or reduce | Keep boxed | Risk | First applicability | Screenshot checks |
| --- | --- | --- | --- | --- | --- |
| Coin Radar (`/crypto`) | Outer report panels, nested insight cards, repeated metric cards, heavy BTC/ETH selector, heavy bottom controls | Chart canvas frame if needed, Pro lock/CTA, critical risk warning | HIGH | Not first full-screen migration; use a bounded summary section only after standards are proven | 340px/360px mobile, desktop, BTC/ETH switch, timeframe switch, mode switch, no horizontal overflow, `/alts` unaffected |
| Global Radar (`/global`) | `enterprise-panel`, mini cards, market pulse cards, dashboard-style wrappers | Critical macro warning, necessary chart/data frames | MEDIUM | Good second-stage candidate after one simpler route | Mobile and desktop, Global entry preserved, global market sections still scannable |
| Market selection (`/`) | Outer card, brand frame that competes with choices, nested entry cards | Login/auth state if required | LOW | Strong candidate if it can be done without route changes | 340px/360px first screen, `/crypto` entry, `/global` entry, no overflow |
| News and schedules (`/news`) | Digest cards, nested event panels, story boxes that can become feed rows | Expanded story detail, critical event notice | LOW | Best first proof candidate because it is feed/list oriented | Mobile feed, market filter, item expansion if present, desktop density |
| Alerts (`/alerts`) | Preset cards, status cards, repeated setting panels | Permission warning, delivery error, threshold input groups | MEDIUM | Good candidate after News or Market selection | Toggle usability, status clarity, no FCM/push logic change |
| Journal (`/journal`) | History cards, outer shells, repeated entry panels | Input forms, selected segmented controls, destructive actions | MEDIUM | Later candidate because forms need boundaries | Mobile form fields, entry list, keyboard spacing, no data loss |
| Settings/account | Large account panels, explanatory cards | Login, account deletion, security warning, destructive confirmations | HIGH | Not first | Auth state, account deletion safety, no session logic change |
| Pro (`/pro`) | Supporting benefit cards, repeated copy panels | Plan comparison cards, payment status, locked state, CTA block | HIGH | Not first | Pricing clarity, Basic/Pro copy, no product/plan/entitlement change |
| Learn (`/learn`) | Big education cards, boxed detail shells | Accordion affordance if needed | LOW | Later low-risk cleanup | Mobile accordion readability, no content overlap |
| Global assets (`/global/assets`) | Main wrapper card, metric cards, selector panels, heavy mobile dock | Chart frame, selected asset controls, critical market state | HIGH | Not first because layout is dense | 340px/360px, desktop chart, dock not covering content |

Priority order for planning:

1. News and schedules.
2. Market selection.
3. Alerts.
4. Global Radar summary.
5. Coin Radar bounded summary section.
6. Learn.
7. Journal.
8. Global assets.
9. Pro.
10. Settings/account.

Reason:

- Start with screens where list/feed structure is natural.
- Delay screens with payment, auth, dense charts, or previous failed broad flatten attempts.

## Common Component Standards

These are design standards only. They do not create or modify components yet.

### AppShell

Use when:

- Defining the route-level page canvas.
- Handling safe area, max width, page padding, top spacing, and bottom spacing.

Box usage:

- No large card or panel.
- No full-page border.
- No shadow.

Border/background/shadow:

- Background is the app canvas.
- Dividers only where route context changes.
- Shadows only for a top/bottom sticky element if needed.

Mobile 340px/360px:

- Avoid horizontal padding that makes content feel squeezed.
- Reserve enough bottom padding for fixed navigation or controls.

Dark/light:

- Canvas contrast should be subtle.
- Do not make light mode look like stacked white cards on gray.

### BottomNav

Use when:

- Providing persistent top-level app navigation or required route controls.
- Keeping mobile navigation reachable.

Box usage:

- Can have a restrained fixed background.
- Should not look like a large floating card unless it is a native-style bottom sheet.

Border/background/shadow:

- Prefer top divider and slight background.
- Avoid thick borders, strong blur, and heavy shadow.

Mobile 340px/360px:

- Must not cover primary content.
- Use safe-area padding.
- Labels should not wrap awkwardly.

Dark/light:

- Active state must be clear in both modes.
- Inactive states should be quiet.

### Section

Use when:

- Grouping a screen area such as summary, events, market pulse, or settings group.

Box usage:

- Default no box.
- Use title, subtitle, spacing, and divider.

Border/background/shadow:

- Prefer `border-t`, `border-b`, or no border.
- No shadow.
- No card background by default.

Mobile 340px/360px:

- Section headings should be short.
- Long helper text should wrap below, not push controls off screen.

Dark/light:

- Divider contrast must remain subtle.

### ListRow

Use when:

- Showing repeated items: news, alerts, journal entries, market rows, assets, schedule items.

Box usage:

- No individual card by default.
- Row is separated by divider and spacing.

Border/background/shadow:

- Divider between rows.
- Background only for selected, pressed, or critical state.
- No shadow.

Mobile 340px/360px:

- Main label and key metric must fit.
- Secondary metadata can wrap or truncate.
- Touch area must remain large enough.

Dark/light:

- Selected state must be visible without becoming a card.

### MetricRow

Use when:

- Showing compact market data, score, risk, price, funding, exchange rate, RSI, trend, dominance, or status.

Box usage:

- No card by default.
- Group metrics in rows or table-like sections.

Border/background/shadow:

- Use divider lines.
- Use color only for semantic status.
- No shadow.

Mobile 340px/360px:

- Label left, value right.
- Avoid three-column layouts unless labels are very short.

Dark/light:

- Status colors must remain readable and not over-saturated.

### DividerGroup

Use when:

- Several related rows need grouping without a card.

Box usage:

- No outer card.
- Optional top and bottom divider.

Border/background/shadow:

- Divider only.
- No background unless grouping would be ambiguous.

Mobile 340px/360px:

- Avoid dense rows with too many chips.

Dark/light:

- Dividers should be visible but not dominant.

### ReportBlock

Use when:

- A summary needs narrative structure: market state, next condition, risk, invalidation, confirmation.

Box usage:

- No heavy card.
- Can use a title, a lead metric, rows, and a bottom divider.

Border/background/shadow:

- No shadow.
- No full border.
- Optional subtle background only if the report block is the main screen anchor.

Mobile 340px/360px:

- Lead line first.
- Details below as rows.
- Avoid side-by-side cards.

Dark/light:

- Text hierarchy should do more work than background.

### CriticalNotice

Use when:

- Warning, error, locked, permission, destructive action, billing/auth risk, or important limitation must be clear.

Box usage:

- Box allowed.
- This is an explicit exception.

Border/background/shadow:

- Border and tinted background allowed.
- Avoid shadow unless modal-like.
- Do not nest inside another heavy card.

Mobile 340px/360px:

- Keep copy short.
- CTA must remain visible.

Dark/light:

- Warning and error colors must meet readability expectations.

### ProCtaBlock

Use when:

- Explaining Pro access, locked details, or subscription upgrade path.

Box usage:

- Box allowed when it gates important content.
- Avoid multiple Pro cards on one screen.

Border/background/shadow:

- Border and subtle background allowed.
- No exaggerated profit or outcome implication.

Mobile 340px/360px:

- Copy must be concise.
- CTA must not cover core Basic content.

Dark/light:

- CTA hierarchy must be clear without looking like a warning.

## Box Exceptions

Keep boxes for:

- Payment plan comparison.
- Login/auth forms.
- Risk, error, warning, permission, and locked states.
- Pro lock and CTA areas.
- Modal/dialog/popover/dropdown shells.
- Input forms.
- Selectable trade, coin, market, or asset rows when the click target needs a boundary.
- Chart frame only when it improves readability.

Rules for exceptions:

- One box is acceptable; nested boxes are not.
- Boxed exception must have a reason: trust, safety, input clarity, pricing comparison, or touch target.
- Do not use a box merely for spacing.

## Global Radar Principle

Global Radar remains an independent radar for global stocks and futures users.

It is not a crypto macro supplement. It should receive the same boxless app design standard as Coin Radar while keeping its own market identity.

Global Radar implementation guardrails:

- Do not remove `/global` or `/global/assets` entry points.
- Do not hide Global Radar behind Coin Radar.
- Do not rewrite global market logic during visual redesign.
- Do not weaken global-specific news, schedule, asset, or market pulse context.

## Planning Bundle Completion

Active-run tasks completed by this planning bundle:

- Task 1: Full app boxless redesign direction documented.
- Task 2: Screen-by-screen card/panel removal priority documented.
- Task 3: Common AppShell / BottomNav / Section / ListRow design standards documented.

Still pending:

- Task 4: Select the first implementation screen.
- Task 5: Confirm the first implementation scope.

Implementation remains forbidden until the next active-run step explicitly selects and scopes the first code task.
