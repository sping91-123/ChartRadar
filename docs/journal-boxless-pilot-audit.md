# Journal Boxless Pilot Audit

## Scope

- Route: `/journal`.
- Main file: `src/app/journal/page.tsx`.
- Related persistence paths observed in the route:
  - `src/lib/journal`.
  - `src/lib/remoteJournal`.
  - `src/lib/useSupabaseAuth`.

This audit is documentation only. No app code, route, storage, Supabase, auth/session, or journal data shape was changed.

## Current Structure

`/journal` is mostly implemented in a single route file rather than through separate journal components. The page contains:

- Page shell with `Header`, `RadarTopNav`, and `AppFooter`.
- Hero/summary shell.
- Today's journal summary.
- Pending saved-radar review section.
- Quick journal form.
- Last saved feedback summary.
- Journal history list and expanded details.

## Primary Box Sources

### Route-Level Outer Shell

- `AppSurface tone="panel" padding="none"` wraps almost the entire page content.
- The hero uses a `border-b` divider inside that shell.
- This creates a large page-level card/panel even though the screen already has app shell/header boundaries.

First implementation candidate:

- Convert the route-level wrapper to a flat/report flow.
- Keep the hero as a full-width intro section separated by typography and a divider, not a boxed panel.

### Summary Section

- Today's journal summary is a `PanelCard`.
- Metrics are wrapped in `rounded-ui border border-ui-line bg-ui-inset`.
- This creates card inside card structure.

First implementation candidate:

- Convert the summary `PanelCard` to `variant="report"`.
- Convert metrics to divider rows without the inner rounded inset wrapper.

### Pending Radar Section

- Pending radar is a `PanelCard`.
- Each pending item is `AppSurface as="article" tone="inset"`.
- Each item also contains an inner `rounded-ui border border-ui-line bg-ui-panel` data-row wrapper.

First implementation candidate:

- Keep the pending section as report/list.
- Convert pending entries to list rows.
- Keep result buttons and action button touch targets.

### Quick Journal Form

- The form is inside `PanelCard className="overflow-hidden"`.
- `ChipGroup` renders a rounded inset box around every option group.
- Direction/result/R result groups include nested boxes and button chips.
- Inputs and textarea correctly need boundaries, but the outer form card and every chip group box make the form feel heavy.

First implementation candidate:

- Convert the form container to report/flat.
- Keep input and textarea boundaries.
- Change `ChipGroup` wrapper from boxed card to label + divider/list flow.
- Keep chip buttons bounded because they are interactive touch targets.

### Feedback Summary

- The saved feedback summary uses `PanelCard`.
- Feedback rows are wrapped again in `rounded-ui border border-ui-line bg-ui-inset`.

First implementation candidate:

- Convert feedback summary to report surface.
- Convert row wrapper to divider rows.

### Journal History

- History section is a `PanelCard`.
- Each history item is `AppSurface as="article" tone="inset"`.
- Each item has an inner `rounded-ui border border-ui-line bg-ui-panel` row wrapper.
- Expanded details use another `AppSurface tone="panel"`.

First implementation candidate:

- Convert history section to report/list.
- Convert each history item to a divider-separated row.
- Keep delete and expand actions clearly tappable.
- Keep expanded details visually separated, but with lighter report styling.

## Boxes That Should Stay

- Text inputs and textarea boundaries.
- Interactive chip buttons for direction, result, R result, entry reasons, kept principles, broken principles.
- Destructive delete button.
- Error, loading, empty, and saved feedback states where state clarity matters.
- Modal or confirmation surfaces if introduced later.

## Boxes That Can Be Removed or Weakened

- Page-level `AppSurface` card shell.
- Section-level default `PanelCard` wrappers.
- Nested metric wrappers such as `rounded-ui border bg-ui-inset`.
- Pending radar article cards.
- History entry article cards.
- Expanded-detail nested panel.
- ChipGroup's outer inset box, while preserving the chips themselves.

## Risk Notes

- Task 2 must not alter `appendJournalEntry`, `saveJournalEntries`, `createRemoteJournalEntry`, `loadRemoteJournalEntries`, `deleteRemoteJournalEntry`, or `updateRemoteJournalOutcome`.
- Task 2 must not alter auth/session behavior from `useSupabaseAuth`.
- Task 2 must not change journal note parsing or data shape.
- Task 2 must preserve `/journal?market=crypto` and `/journal?market=global` market scope.
- Task 2 should avoid touching unrelated `/crypto`, `/global`, `/alerts`, `/pro`, billing, Android, FCM, or production files.

## Recommended Task 2 Scope

For the first implementation pass, keep the scope limited to `src/app/journal/page.tsx` visual structure:

1. Route-level outer shell: card to flat/report.
2. Today's journal summary: metrics from inset box to divider rows.
3. Quick journal form: outer form card and ChipGroup wrapper weakened.
4. Journal history: item cards and expanded details weakened.

Do not attempt a full journal redesign in one pass. The first pass should prove that form/list surfaces can become flatter without touching persistence or auth behavior.
