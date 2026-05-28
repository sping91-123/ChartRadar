# App Shell Boxless Audit

## Scope

- Active run: `boxless-app-shell-run`
- Task: `Header/Nav/AppShell 구조 조사`
- Date: 2026-05-28
- Code changes: none

## Files Reviewed

- `src/components/Header.tsx`
- `src/components/RadarTopNav.tsx`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/components/MajorsApp.tsx`
- `src/app/alts/page.tsx`
- `src/app/global/page.tsx`
- `src/app/global/assets/page.tsx`
- `src/app/news/page.tsx`
- `src/app/alerts/page.tsx`
- `src/app/journal/page.tsx`
- `src/app/learn/page.tsx`
- `src/app/pro/page.tsx`
- `src/components/HomeEntryGate.tsx`
- `src/app/globals.css`

## Header Box Sources

`Header.tsx` is the primary shared source of the boxed top-shell feeling.

- The header wraps all content in `AppSurface` with default `variant="card"`.
- Because `AppSurface` defaults to the card variant, it adds border, background, radius, and shadow through `DesignPrimitives`.
- The logo mark adds another nested surface through `rounded-ui`, `border-ui-lineStrong`, and `bg-ui-inset`.
- `backdrop-blur` reinforces the floating panel feeling.
- The subtitle area makes the header visually taller on desktop, so the shell reads as a card-like banner rather than a light app header.

Impact:

- Appears on `/crypto`, `/alts`, `/global`, `/global/assets`, `/news`, `/alerts`, `/journal`, `/learn`, `/pro`, policy pages, login/account pages, and admin pages.
- A single Header style change will affect nearly every major screen.
- Header actions must be preserved because notification, settings, account, and plan entry points live there.

## RadarTopNav Box Sources

`RadarTopNav.tsx` is the second major shared source.

- Crypto nav already uses a flatter `nav` element with `border-y`, `bg-transparent`, and bottom-border active state.
- Stocks/global and all-market nav still use `AppSurface` with default card behavior.
- Non-crypto active state uses `bg-ui-active` plus `ring-1 ring-inset ring-ui-lineStrong`, which creates a segmented-card look.
- The fallback uses `rounded-ui border border-ui-line bg-ui-panel`, so loading state also appears as a boxed shell.
- `sticky top-2`, `overflow-hidden`, `backdrop-blur-xl`, and radius from `AppSurface` make the nav look like a floating panel.

Impact:

- `/crypto` and `/alts` are closer to boxless than Global/All nav because crypto nav is already divider-based.
- `/global`, `/global/assets`, `/news?market=global`, `/journal?market=global`, and `/pro?market=global` show the stronger boxed nav.
- `/pro` with all-market scope also uses the boxed `AppSurface` nav.

## Layout and App Shell Sources

`src/app/layout.tsx` itself does not create visible boxes.

- `.app-shell` isolates the app and controls full viewport overflow.
- `.app-scroll-root` owns vertical scrolling and hides horizontal overflow.
- These wrappers are structural and should be preserved.

`src/app/globals.css` contains global visual primitives that amplify card-heavy UI:

- `.enterprise-panel` adds border, gradient background, inset highlight, and large shadow.
- `.bg-surface-card` and `.bg-surface-cardSoft` force strong background and shadow treatment.
- `.border-surface-line` standardizes visible card borders.

These CSS primitives are not AppShell-specific, but route wrappers and content sections still use them heavily.

## Route Wrapper Impact

Most major routes follow this structure:

```tsx
<main className="min-h-screen px-3 ...">
  <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
    <Header />
    <RadarTopNav />
    ...
  </div>
</main>
```

This creates a consistent app width and spacing, but it also means Header/Nav boxes are repeated at the top of nearly every screen.

Screen notes:

- Market selection `/`: `HomeEntryGate` does not use shared Header/Nav, but login prompt still uses `enterprise-panel`.
- `/crypto`: `MajorsApp` uses shared Header, crypto-style `RadarTopNav`, `MacroTicker`, and `LiveMarketChart`.
- `/alts`: same shared shell pattern as `/crypto`, plus `SetupScoutPanel` and `WatchlistPanel`.
- `/global`: shared Header plus boxed stocks `RadarTopNav`, `MacroTicker`, and `GlobalMarketPulse`.
- `/global/assets`: shared Header plus boxed stocks `RadarTopNav`; also has a local hero section with `rounded-2xl border bg-surface-card`.
- `/news`: recently reduced content boxes, but shared Header and market nav still remain visually boxed.
- `/alerts`: shared Header/Nav plus many alert-center `PanelCard` and inset surfaces.
- `/journal`: shared Header/Nav plus form/list surfaces; overflow controls are important and should not be disrupted casually.
- `/learn`: shared Header and a large `AppSurface tone="panel"` guide shell.
- `/pro`: shared Header/Nav plus pricing panel; Pro plan comparison boxes should remain an exception area.

## AppSurface and PanelCard Usage

`DesignPrimitives` now has `card`, `flat`, `report`, and `list` variants, but default call-sites still use `card`.

Important source:

- `AppSurface` default variant: `card`
- `PanelCard` default variant: `card`
- `Header` and non-crypto `RadarTopNav` do not pass a variant, so they inherit card visuals.

This is the main reason the app shell still looks boxed after the `/news` pilot.

## What Should Be Fixed in Common Components

Best common fixes for the next tasks:

- Add an App Shell rule that Header uses a lighter surface, likely `variant="flat"` or a dedicated shell style.
- Reduce Header background, border, shadow, and radius while preserving HeaderActions.
- Keep the brand mark but weaken its nested box treatment.
- Align RadarTopNav behavior so crypto, global, and all-market nav use divider or underline states instead of card/ring states.
- Replace RadarTopNav fallback with a divider-style skeleton instead of a boxed skeleton.
- Keep `.app-shell` and `.app-scroll-root` unchanged unless a screenshot proves they cause layout issues.

## What Should Stay Screen-Specific

The following should not be solved in the App Shell pilot:

- `/crypto` summary/chart/control redesign.
- `/global` pulse and asset radar content redesign.
- `/alerts` condition cards and event history redesign.
- `/journal` form field and entry list redesign.
- `/pro` pricing comparison redesign.
- Login/auth forms, payment confirmation, admin entitlement panels, and critical notices.

Those areas need separate screen-level runs because they carry higher visual and functional risk.

## Keep vs Remove Criteria

Keep boxes when:

- A modal/dialog, form, payment plan, login form, critical warning, Pro lock, or explicit selectable row needs a boundary.
- The element is a true interactive control group and needs a visible touch target.
- The screen would lose hierarchy or accessibility without a clear region.

Remove or weaken boxes when:

- The box is only used to separate ordinary sections.
- A `PanelCard` wraps another `PanelCard` or an already boxed component.
- Header/Nav looks like a floating card before content starts.
- A route wrapper adds border/background/shadow without semantic need.

## Next Task Candidates

1. Document App Shell boxless rules before implementation.
2. Pilot Header with a flatter surface while preserving HeaderActions.
3. Pilot RadarTopNav global/all-market states with divider/underline navigation.
4. If task 3 is too broad, split Header and RadarTopNav into two separate implementation tasks.
