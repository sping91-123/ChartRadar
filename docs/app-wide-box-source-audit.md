# App-wide Box Source Audit

Date: 2026-05-28

Active run: `design-system-flat-surfaces-run`

Task: `App-wide box source audit`

## Scope

This audit identifies the main sources of heavy card, box, border, and nested panel styling across ChartRadar. It does not change app code.

Search patterns:

- `AppSurface`
- `PanelCard`
- `enterprise-panel`
- `enterprise-card`
- `rounded-2xl`
- `rounded-xl`
- `border`
- `shadow`
- `ring`
- `bg-ui-panel`
- `bg-ui-inset`
- `bg-surface-card`

Primary screens reviewed:

- Market selection
- `/crypto`
- `/alts`
- `/global`
- `/global/assets`
- `/news`
- `/alerts`
- `/journal`
- `/learn`
- `/pro`

## Common Sources

### Design primitives

- `src/components/ui/DesignPrimitives.tsx`
  - `AppSurface` applies `rounded-ui` by default.
  - `panel` tone applies `border`, `bg-ui-panel`, and `shadow-ui-panel`.
  - `elevated` tone applies `border`, `bg-ui-elevated`, and `shadow-ui-elevated`.
  - `inset` tone applies `border` and `bg-ui-inset`.
  - `PanelCard` always wraps content in `AppSurface tone="panel"`.

Impact: screens that use `AppSurface` or `PanelCard` inherit boxed UI even when the page itself should read like a report, list, or dashboard.

### Global CSS tokens

- `src/app/globals.css`
  - `.enterprise-panel` adds border and box shadow.
  - `.bg-surface-card` and `.bg-surface-cardSoft` add surface depth and inset shadow.
  - light theme variants amplify several surface, border, and shadow styles.

Impact: direct utility classes and CSS aliases both create similar panel weight, making the app feel card-heavy even after individual screen changes.

### Repeated utility pattern

Many components use direct combinations like:

- `rounded-lg border ... bg-surface-card ... shadow-glow`
- `rounded-xl border ... bg-surface-cardSoft`
- `rounded-md border ... bg-black/20`
- `rounded-ui border border-ui-line bg-ui-panel`

Impact: even without `PanelCard`, many screens rebuild the same boxed visual pattern locally.

## Screen Findings

### Market selection

Primary files:

- `src/app/page.tsx`
- `src/components/HomeEntryGate.tsx`

Findings:

- The main market selection state is already flatter than before.
- Remaining boxed sources are mostly the login state, brand frame decoration, and action controls.
- Coin Radar and Global Radar entry links should remain equally prominent.

Recommendation:

- Keep market selection rows flat.
- Avoid reintroducing a full outer panel.
- Treat login/auth panels separately because they are functional forms.

### `/crypto`

Primary files:

- `src/app/crypto/page.tsx`
- `src/components/MajorsApp.tsx`
- `src/components/LiveMarketChart.tsx`
- `src/components/RadarInsightPanel.tsx`
- `src/components/TechnicalRadarPanel.tsx`
- `src/components/BeginnerActionGuide.tsx`
- `src/components/ChartStateReader.tsx`
- `src/components/crypto/CryptoControlBar.tsx`
- `src/components/crypto/CryptoTimeframeTabs.tsx`
- `src/components/crypto/CryptoModeTabs.tsx`
- `src/components/crypto/CryptoProGate.tsx`

Findings:

- `LiveMarketChart.tsx` is the largest source of crypto screen box density.
- It contains outer section panels, symbol selectors, dropdown/search panels, summary boxes, chart wrappers, analysis blocks, and technical condition cards.
- `RadarInsightPanel.tsx` has a compact path, but default rendering still uses card-like surfaces.
- `CryptoControlBar.tsx` uses a fixed bottom bar with border, dark background, and blur.
- `CryptoProGate.tsx` uses warning/info boxes that are visually heavy but must preserve gating logic.

Recommendation:

- Do not remove classes ad hoc.
- First define a common report or flat variant, then apply it to crypto summary and insight sections.
- Preserve `/crypto`, `/majors` compatibility, BTC/ETH switching, timeframe/mode switching, chart rendering, API fetch, and Basic/Pro gating.

### `/alts`

Primary files:

- `src/app/alts/page.tsx`
- `src/components/SetupScoutPanel.tsx`
- `src/components/WatchlistPanel.tsx`
- shared crypto components

Findings:

- `/alts` inherits some crypto styling through shared components.
- `SetupScoutPanel.tsx` contains many candidate cards, scanner panels, mode controls, and signal badges.
- `WatchlistPanel.tsx` uses watchlist cards, modal cards, and section surfaces.

Recommendation:

- Treat `/alts` as a second-pass screen after common primitives are defined.
- Candidate list rows can move toward table/list surfaces, while important modal shells can remain boxed.

### `/global`

Primary files:

- `src/app/global/page.tsx`
- `src/components/GlobalMarketPulse.tsx`
- `src/components/MarketBoardPanel.tsx`

Findings:

- `GlobalMarketPulse.tsx` uses `enterprise-panel` and many nested mini cards.
- `MarketBoardPanel.tsx` uses `rounded-lg border bg-surface-card shadow-glow`.

Recommendation:

- Global Radar remains an independent market mode, not a crypto macro helper.
- Apply the same design rules to Global Radar, but avoid weakening its distinct market dashboard role.

### `/global/assets`

Primary files:

- `src/app/global/assets/page.tsx`
- `src/components/StockRadarApp.tsx`

Findings:

- `StockRadarApp.tsx` has many metric cards, chart wrappers, mobile and desktop control docks, and asset selector panels.
- The mobile dock and desktop sticky dock both use strong background, border, shadow, and blur.
- The main asset radar wrapper uses `rounded-lg border bg-surface-card shadow-glow`.

Recommendation:

- This is a medium-risk UI area because it has dense controls and mobile constraints.
- Apply variants only after the common primitive API is decided.

### `/news`

Primary files:

- `src/app/news/page.tsx`
- `src/components/RadarNewsPanel.tsx`
- `src/components/RadarDigestPanel.tsx`

Findings:

- `RadarNewsPanel.tsx` uses `AppSurface` and `PanelCard` heavily, often nested with inset surfaces.
- `RadarDigestPanel.tsx` uses card-like digest containers and detail boxes.

Recommendation:

- Good candidate for early flat/report variant testing because it is mostly information display.
- Preserve market-specific news routing and copy restrictions.

### `/alerts`

Primary files:

- `src/app/alerts/page.tsx`
- `src/components/RadarAlertCenter.tsx`
- `src/components/UsageMeterPanel.tsx`

Findings:

- `RadarAlertCenter.tsx` uses many nested `AppSurface` and `PanelCard` components.
- Alert preset and status areas are card-heavy.
- `UsageMeterPanel.tsx` uses `enterprise-panel` and usage summary boxes.

Recommendation:

- Keep clear affordances for toggles, thresholds, and alert status.
- Avoid changing FCM, push token, push-cron, entitlement, or delivery logic.

### `/journal`

Primary files:

- `src/app/journal/page.tsx`

Findings:

- Journal uses `AppSurface`, `PanelCard`, `bg-ui-panel`, `bg-ui-inset`, form fields, pills, and entry cards heavily.
- Some boxing is appropriate because journal is a form and history tool.

Recommendation:

- Keep form containers and selected states clear.
- Flatten only outer shells and repeated history rows after higher-priority report screens are addressed.

### `/learn`

Primary files:

- `src/app/learn/page.tsx`

Findings:

- Learn uses `AppSurface` plus nested `details` blocks with borders and inset backgrounds.
- The screen is information-heavy but low-risk.

Recommendation:

- Good later candidate for a list/report variant.
- Keep expandable affordances visible.

### `/pro`

Primary files:

- `src/app/pro/page.tsx`
- `src/components/ProPricingPanel.tsx`
- `src/components/UsageMeterPanel.tsx`

Findings:

- Pricing cards and plan comparison surfaces are intentionally card-like.
- `UsageMeterPanel.tsx` shares the same `enterprise-panel` source seen in alerts.

Recommendation:

- Keep plan cards boxed enough for plan comparison and conversion clarity.
- Do not weaken Basic/Pro gating or payment copy rules.
- Do not change RevenueCat, planId, productId, entitlement, or billing logic during visual cleanup.

## Cross-cutting Root Causes

1. `AppSurface` and `PanelCard` have no flat/report/list variant, so the default shared primitive encourages boxed layouts.
2. Direct Tailwind utility combinations duplicate the same heavy visual treatment outside the design primitives.
3. Controls, status blocks, detail blocks, and page sections often share the same visual weight, so hierarchy is unclear.
4. Fixed bottom control docks often use strong background, border, shadow, and blur, which can feel like another panel on top of the content.
5. Some boxes are necessary for forms, modals, pricing cards, and destructive actions; removing all boxes would reduce usability.

## Keep vs. Reduce

Keep boxed treatment for:

- Modals and dialogs.
- Pricing plan comparison cards.
- Forms and destructive account actions.
- Critical warnings, errors, and permission states.
- Interactive controls where boundaries are needed for touch accuracy.

Reduce boxed treatment for:

- Page-level outer shells.
- Repeated summary cards that can become report rows.
- Nested cards inside another panel.
- Non-interactive explanatory copy blocks.
- Metric groups where divider/list layout is clearer.
- Mobile fixed docks when they hide content or dominate the viewport.

## Handoff to Next Task

Next active-run task should create `docs/app-wide-boxless-ui-plan.md` and define:

- Common flat/report/list surface rules.
- `AppSurface` and `PanelCard` usage criteria.
- Route-by-route application order.
- Screenshot review criteria.
- First implementation guardrails.

No app code was changed in this audit.
