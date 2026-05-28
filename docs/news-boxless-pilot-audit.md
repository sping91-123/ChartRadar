# News Boxless Pilot Audit

Date: 2026-05-28

Active run: `boxless-news-pilot-run`

Task: `/news` 현재 박스 구조 조사

## Scope

This audit reviews the current `/news` UI structure before the first boxless visual pilot. It does not change app code.

Files reviewed:

- `src/app/news/page.tsx`
- `src/components/RadarNewsPanel.tsx`
- `src/components/RadarDigestPanel.tsx`
- `src/components/MacroTicker.tsx`

Search patterns:

- `AppSurface`
- `PanelCard`
- `rounded-*`
- `border`
- `shadow`
- `bg-ui-panel`
- `bg-ui-inset`
- `bg-surface-card`
- `enterprise-panel`

## Route Structure

`src/app/news/page.tsx` composes the page as:

- `Header`
- `RadarTopNav`
- `RadarNewsPanel`
- `afterBriefing` macro schedule block
- `AppFooter`

The route already has a simple page canvas. The most visible boxed treatment comes from child components, not from the page-level `<main>`.

## Main Box Sources

### `src/app/news/page.tsx`

Current box source:

- The macro schedule block passed through `afterBriefing` is wrapped in `PanelCard`.

Why it matters:

- It creates a full card section immediately after the news briefing.
- Since `MacroTicker compact` also has internal boxed rows, this can feel like card inside card.

Pilot candidate:

- Convert the wrapper to `PanelCard variant="report"` or `AppSurface variant="report"`.
- Keep `SectionHeader` and `MacroTicker compact`.
- Do not change route or market parameter behavior.

### `src/components/RadarNewsPanel.tsx`

Current box sources:

- `MarketRadarCard` uses `PanelCard`, then includes an inner `AppSurface tone="inset"` checkpoint block.
- `EmptyBriefingCard` uses `PanelCard` with a boxed icon.
- `BriefingDetail` uses `AppSurface tone="inset"` and internal divider sections.
- `BriefingCardView` uses `PanelCard` for each briefing card.
- `SourceReferenceList` uses `AppSurface as="details" tone="panel"`.
- The top page intro uses `PanelCard`.
- Error/loading states use `AppSurface tone="inset"`.
- The bottom interpretation note uses `PanelCard`.

Why it matters:

- `PanelCard` is repeated around intro, radar summary, each briefing card, source references, macro schedule, and bottom notes.
- Some inner areas already use divider-like sections, so they are good candidates for `report` or `list` variants.
- Briefing cards still read as repeated cards rather than feed/report rows.

Pilot candidates:

- Change the top intro `PanelCard` to `variant="report"` or `variant="flat"`.
- Change `MarketRadarCard` outer `PanelCard` to `variant="report"`.
- Change `BriefingCardView` outer `PanelCard` to `variant="list"` or `variant="report"`.
- Change `SourceReferenceList` `AppSurface` to `variant="list"`.
- Keep error/loading surfaces visibly bounded.

Avoid in the first visual pass:

- Changing fetch logic.
- Changing `NewsPayload`, `RadarNewsBriefing`, or `RadarNewsItem` shape.
- Changing cache keys.
- Changing market routing.
- Rewriting copy logic.

### `src/components/RadarDigestPanel.tsx`

Current box sources:

- The root section is a strong dashboard card: `rounded-lg border bg-surface-card shadow-glow`.
- The status, volume leader, setup leader, and question sections are all nested cards.
- Loading/error states are boxed.
- Question buttons are bordered cards.

Why it matters:

- This is the most dashboard-like section in the `/news` orbit.
- It is also data-fetching and interactive, so broad changes here are higher risk than simple `PanelCard` variant opt-ins.

Pilot recommendation:

- Do not make `RadarDigestPanel` the first `/news` visual pilot unless it is visibly rendered on the route and scoped separately.
- If touched later, convert metric cards to `MetricRow`/list rows and keep loading/error boxes.

### `src/components/MacroTicker.tsx`

Current box sources relevant to `/news`:

- `MacroNewsItem` uses `rounded-ui-sm border bg-ui-inset`.
- Compact news macro report uses a grid of `MacroNewsItem` cards.
- Empty macro states use boxed inset divs.
- The non-news ticker is heavily boxed but is outside this `/news` pilot unless directly rendered.

Why it matters:

- `/news` uses `MacroTicker compact`.
- On `/news`, `isNewsMacroReport` renders macro rows as small cards.
- This is a second-level pilot candidate after the `PanelCard` wrappers are flattened.

Pilot candidate:

- Keep `MacroTicker` unchanged in the first implementation if possible.
- First reduce the parent macro schedule wrapper.
- If the section still looks boxed, later convert `MacroNewsItem` to a divider row.

## Recommended First Implementation Scope

Start with a small `/news` visual pilot:

1. `src/app/news/page.tsx`
   - Change the macro schedule wrapper from default `PanelCard` to `variant="report"` or `variant="flat"`.

2. `src/components/RadarNewsPanel.tsx`
   - Change the intro `PanelCard` to `variant="report"`.
   - Change `MarketRadarCard` outer `PanelCard` to `variant="report"`.
   - Change `BriefingCardView` outer `PanelCard` to `variant="list"` or `variant="report"`.
   - Keep error/loading and critical notices bounded.

Do not touch in the first implementation:

- `RadarDigestPanel.tsx`, unless it is confirmed as the visible main blocker.
- `MacroTicker.tsx`, unless wrapper-only changes are insufficient.
- Any `/crypto`, `/global`, `/alerts`, `/journal`, `/pro`, or route files outside `/news`.

## Verification Requirements For Task 2

Required:

- `cmd /c npx tsc --noEmit`
- `npm.cmd run build`
- `npm.cmd run smoke:mobile`
- `npm.cmd run smoke:all`
- `git diff --check`
- `/news` 360px screenshot
- `/news` desktop screenshot
- `/news?market=crypto` check
- `/news?market=global` check
- Horizontal overflow check

Visual pass criteria:

- `/news` reads more like a feed/report page than a stack of cards.
- Macro schedule is not visually trapped in nested boxes.
- Briefing cards feel closer to report/list rows.
- Error/loading/critical states still have clear boundaries.
- Global market news remains independent and not a crypto helper.

## Risks

- `RadarNewsPanel.tsx` contains a mix of data fetch, cache, copy cleanup, and layout code. Keep visual changes narrow.
- `MacroTicker.tsx` is reused outside `/news`; avoid broad changes until explicitly scoped.
- `RadarDigestPanel.tsx` has its own API calls and interactive question state; avoid it in the first pass unless necessary.

No app code was changed in this audit.
