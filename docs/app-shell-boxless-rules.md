# App Shell Boxless Rules

## Scope

- Active run: `boxless-app-shell-run`
- Task: `App shell boxless 기준 문서화`
- Date: 2026-05-28
- Code changes: none

This document defines the app-wide rules for Header, RadarTopNav, and shared shell surfaces before any visual implementation.

## Design Goal

ChartRadar should read like a full-screen mobile app, not a dashboard made of stacked cards.

The common shell must:

- Stay lighter than the content below it.
- Preserve fast access to alerts, settings, account, and plan actions.
- Preserve Coin Radar and Global Radar as independent top-level market modes.
- Use spacing, typography, divider lines, and active underlines before using boxed surfaces.
- Avoid nested card, panel, border, shadow, and blur treatment unless there is a functional reason.

## Header Background and Border Rules

Header may use background or border only when it solves a functional shell problem.

Use light background or divider when:

- The header is sticky or visually overlaps scrolling content.
- Text/icons need contrast against a busy chart or content area.
- The screen has a dense top control area and needs a clear touch target boundary.
- The header is in a high-risk flow such as login, account, billing, admin, or critical error handling.

Avoid boxed background and border when:

- The header is only a brand/action row at the top of a normal screen.
- The next element is already a nav row, ticker, chart, or section header.
- The shell creates card-on-card stacking before the user reaches content.
- The same hierarchy can be shown with padding, typography, and a single bottom divider.

Preferred default:

- Header should move toward a flat app bar:
  - transparent or very subtle background
  - no large radius
  - no panel shadow
  - optional bottom divider only
  - compact height on mobile

## Divider-Only Header Rules

Use a divider-only header when:

- The route has normal app navigation and no special form/payment state.
- Header actions remain visible without needing a background block.
- The content below starts with another strong component, such as a chart, ticker, news feed, or market summary.
- The mobile width is 340px or 360px and vertical space is more valuable than decorative containment.

Divider-only means:

- No outer card radius.
- No outer panel shadow.
- No strong `bg-ui-panel` or `bg-surface-card` block.
- A single `border-b` or low-contrast divider is allowed.
- Brand mark may keep a minimal icon boundary only if it remains visually small.

## RadarTopNav Rules

RadarTopNav should behave like an app navigation row, not a group of cards.

Preferred direction:

- Use underline or bottom-border active state.
- Use transparent or lightly tinted row background.
- Use equal-width tabs for 4-item market nav.
- Avoid `ring`, strong active pills, card radius, and floating panel shadows.
- Keep icon and label compact.
- Keep horizontal scroll only for nav sets that cannot fit safely.

Use a boxed nav only when:

- The nav is inside a modal, settings panel, or form-like flow.
- The active state would be unclear without a bounded touch target.
- Accessibility or tap accuracy would suffer on small screens.

For this run:

- Crypto nav is already closer to the target because it uses bottom-border active state.
- Global/all-market nav should move toward the same divider or underline model.
- The Suspense fallback should not render as a boxed card; it should resemble the final nav row height and divider.

## Coin Radar and Global Radar Independence

The shared shell must not make Global Radar look like a secondary macro tab for Coin Radar.

Rules:

- Coin Radar and Global Radar remain equal top-level market modes.
- Header copy, nav labels, and active states must not imply one mode belongs inside the other.
- `/crypto` remains the primary Coin Radar route.
- `/global` remains the primary Global Radar route.
- `/majors` remains compatibility/redirect only.
- Shared shell styling may be common, but route intent and market-specific nav items stay separate.

## Header Action Rules

The following actions must remain available and discoverable:

- Alerts / notification entry.
- Settings / account controls.
- Plan / Pro entry.
- Login/account state actions where currently available.

Rules:

- Do not remove buttons to make the shell visually cleaner.
- Do not change auth, plan, notification, or routing logic.
- Icon buttons may become visually lighter, but tap targets must remain at least practical for mobile.
- Active plan or upgrade affordance must remain understandable without implying profit guarantees.
- Any action popover or settings fullscreen panel is outside the first shell pilot unless required for layout safety.

## Mobile 340px and 360px Rules

Mobile shell must be compact and stable.

Header:

- Target one-row layout on 340px and 360px.
- Avoid long subtitle text on mobile.
- Keep brand text short: `ChartRadar` is acceptable on mobile.
- Keep action buttons visible without wrapping.
- Avoid a large vertical card before content.

Nav:

- Prefer 44px to 52px effective row height.
- Use short labels.
- Avoid active pill styles that make each tab read as a card.
- Avoid horizontal overflow.
- Avoid top sticky nav overlapping content.

Spacing:

- Reduce duplicated gaps between Header, RadarTopNav, MacroTicker, and first content block.
- Preserve enough safe-area and touch spacing for Android WebView.

## Desktop Rules

Desktop shell may use more horizontal space but should not become a dashboard frame.

- Header can show subtitle text if it does not create a large banner.
- Nav should align with content width but not need an outer card.
- Avoid heavy shadows and large rounded shell containers.
- Keep focus on the report/chart/feed content.

## Next Pilot File Candidates

Task 3 should stay narrow and avoid route or logic changes.

Primary candidates:

- `src/components/Header.tsx`
- `src/components/RadarTopNav.tsx`

Secondary candidates only if needed for spacing or screenshot safety:

- `src/components/HeaderActions.tsx`
- `src/app/globals.css`

Do not modify in task 3 unless the need is explicit:

- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/components/MajorsApp.tsx`
- `src/components/LiveMarketChart.tsx`
- `src/components/GlobalMarketPulse.tsx`
- `src/components/RadarNewsPanel.tsx`
- billing, auth, Supabase, Android, FCM, push, or production code

## Pilot Split Recommendation

If the implementation looks too broad, split task 3 into two commits or two active-run items:

1. Header-only shell pilot.
2. RadarTopNav-only shell pilot.

Header-only should be preferred first because it appears on the widest set of routes and is the clearest current shell box source.

## Pilot Application Notes

Task 3 applied the first shared shell pilot:

- `Header` moved from the default card surface to a flat divider-only surface.
- Header logo treatment was reduced from a bordered inset box to a smaller rounded mark.
- Header alert and settings buttons kept their routes and click logic, but their visual treatment moved from boxed soft-card buttons to transparent circular icon buttons.
- `RadarTopNav` now uses one underline/nav-row model for crypto, global, and all-market modes.
- The global/all-market nav no longer uses the card `AppSurface`, active ring, or pill-like card state.
- The Suspense fallback was changed from a boxed panel skeleton to a divider-style row skeleton.

The pilot intentionally did not change:

- route behavior
- auth/session behavior
- plan or billing logic
- notification logic
- `/crypto`, `/global`, or `/news` body content
- bottom tabs or new routes

## Pilot Result Summary

The `boxless-app-shell-run` pilot is complete.

Applied scope:

- `/crypto` 360px mobile
- `/global` 360px mobile
- `/news` 360px mobile
- `/crypto` desktop

Improved areas:

- The shared Header no longer reads as a large floating card before content.
- Header/Nav hierarchy is now closer to a native app bar plus nav row.
- Crypto, Global, and all-market nav states share the same underline-based pattern.
- The top shell uses less vertical and visual weight, so the first content block appears sooner.
- Alert and settings entry points stayed visible.
- Plan/status visibility followed the existing responsive behavior.

Screenshot review:

- `/crypto` 360px: Header and nav are flatter, no horizontal overflow.
- `/global` 360px: Global Radar keeps independent nav labels and entry flow, no horizontal overflow.
- `/news` 360px: News pilot content and new shell direction work together, no horizontal overflow.
- Desktop: Header, plan/status, alert, settings, and nav remain visible without boxed shell framing.

Remaining issues:

- Content surfaces below the shell are still mixed: some routes remain card-heavy.
- `/global` body still has strong panel/card treatment in the main radar sections.
- `/crypto` body still has chart, insight, and fixed control areas that need a separate redesign run.
- `/alerts` and `/journal` still rely heavily on `PanelCard`, inset surfaces, and form boxes.
- Market selection screen is already flatter than before, but still needs a dedicated final pass.

Recommended next candidates:

1. Market selection screen final boxless pass.
2. `/alerts` list-centered pilot.
3. `/journal` form/list surface simplification.
4. `/global` body report-style redesign.
5. `/crypto` body redesign as a separate larger run.
