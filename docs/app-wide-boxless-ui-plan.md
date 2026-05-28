# App-wide Boxless UI Plan

Date: 2026-05-28

Active run: `design-system-flat-surfaces-run`

Task: `Flat surface design rule 문서화`

Status: Superseded by `full-app-boxless-redesign-run`.

This document remains as a reference for surface and primitive design. The current product direction is broader: remove the AI-made SaaS dashboard feeling across the full app and redesign ChartRadar as a full-screen consumer-style mobile app.

First implementation direction from the superseding run:

- Start with a backward-compatible `DesignPrimitives` foundation.
- Do not visually migrate `/crypto` or the full app first.
- Use the new primitive variants in a later bounded pilot after screenshot review.

Implementation update:

- `AppSurface` now supports `variant="card" | "flat" | "report" | "list"`.
- `PanelCard` now accepts compatible `tone`, `variant`, and `padding` props.
- Default behavior remains `variant="card"`, preserving existing call-site visuals.
- Existing screens do not opt into the new variants yet.

## Purpose

ChartRadar should read more like a fast market report than a stack of nested cards. This plan defines when to keep boxed surfaces and when to reduce card, border, shadow, and nested panel treatment across the app.

This document is a design rule and implementation guardrail. It does not change app code.

## Product Principles

- Coin Radar and Global Radar remain equal top-level market modes.
- Global Radar remains an independent radar for global stocks and futures users, not a crypto macro helper.
- UI changes must not change routing, market logic, billing, authentication, Supabase, Android, FCM, push-cron, or production data behavior.
- Investment copy must remain judgment-support oriented: conditions, risk, invalidation, confirmation, and watch criteria.
- UI polish work requires screenshot review before push when visual quality is involved.

## Surface Hierarchy

Use four levels of visual weight.

### Level 1: Page Canvas

Purpose:

- Main page background and broad layout.
- Should feel open, not boxed.

Rules:

- Avoid page-level `enterprise-panel`, `PanelCard`, heavy `bg-surface-card`, strong border, or shadow.
- Use spacing, typography, and section rhythm instead of outer wrappers.
- Keep content width controlled by layout containers, not by visual boxes.

Examples:

- Market selection page body.
- `/crypto` main report body.
- `/global` dashboard body.

### Level 2: Report Section

Purpose:

- Group related information without making every group look like a card.

Rules:

- Prefer transparent or near-transparent background.
- Prefer top/bottom dividers over full borders.
- Use `border-y` or `border-t` only when needed.
- Avoid shadow.
- Use smaller radius or no radius.
- Keep section headings compact.

Examples:

- 판단 요약.
- 시장 체력 summary.
- 뉴스 digest group.
- 글로벌 시장 pulse group.

### Level 3: Interactive Surface

Purpose:

- Clickable or touchable controls that need clear boundaries.

Rules:

- Borders are allowed for tap affordance.
- Active state should be clear.
- Inactive state should be light.
- Avoid nested cards around controls.
- Fixed bottom controls must not obscure content.

Examples:

- BTC/ETH selector.
- Timeframe tabs.
- Mode tabs.
- Alert toggles.
- Journal form segmented controls.

### Level 4: Critical Card

Purpose:

- Content that needs containment, comparison, confirmation, or strong attention.

Rules:

- Boxed treatment is allowed.
- Use only one strong container at a time.
- Avoid putting critical cards inside another heavy card.
- Keep warning and destructive action states visually clear.

Examples:

- Pricing plan cards.
- Login and account forms.
- Delete account confirmation.
- Payment status.
- Pro gating notice.
- Modal/dialog shells.

## Keep Boxed

Keep card or panel treatment for:

- Pricing plan comparison in `/pro`.
- Login, account, checkout, and destructive account actions.
- Modals, dialogs, popovers, and dropdown results.
- Form groups where field boundaries matter.
- Critical warning, error, locked, and permission states.
- Mobile touch controls that would be ambiguous without a boundary.
- Plan or quota status when it affects access.

Reason:

- These areas need containment, trust, clarity, or touch safety.

## Reduce Or Flatten

Reduce boxed treatment for:

- Page-level outer wrappers.
- Non-interactive summary cards.
- Repeated metric tiles.
- Nested `PanelCard` inside `AppSurface`.
- Explanatory copy blocks.
- Large outer `enterprise-panel` shells.
- Repeated `rounded-lg border bg-surface-card shadow-glow` wrappers.
- Fixed bottom bars when they visually cover the report.

Preferred replacements:

- Report sections.
- Divider lists.
- Inline metric rows.
- Compact segmented controls.
- Typographic hierarchy.
- Small status pills only where they add meaning.

## AppSurface And PanelCard Rules

Current issue:

- `AppSurface` and `PanelCard` default to boxed surfaces.
- `PanelCard` always uses `AppSurface tone="panel"`.
- This makes many screens card-heavy even when the content should be report-like.

Use `AppSurface` or `PanelCard` when:

- The section is a form, modal-like shell, pricing card, critical state, or isolated tool.
- A visible boundary improves comprehension or interaction.
- The content has separate ownership from surrounding content.

Avoid `AppSurface` or `PanelCard` when:

- It is only wrapping a page section.
- It contains another surface with similar visual weight.
- It is used only for spacing.
- It contains repeated summary metrics that could be rows.

Future variant need:

- `flat`: no shadow, no full border, minimal or transparent background.
- `report`: section spacing plus top/bottom divider, suitable for market summaries.
- `list`: row-based layout with dividers, suitable for repeated items.
- `critical`: intentionally boxed, for warnings, billing, auth, and destructive actions.

## DesignPrimitives Variant API Design

This section defines the intended API shape only. It does not implement the change.

### Current API

Current types:

```ts
type Tone = "panel" | "elevated" | "inset";
type Padding = "none" | "sm" | "md" | "lg";
```

Current behavior:

- `AppSurface` always includes `rounded-ui`.
- `tone="panel"` always adds border, panel background, and panel shadow.
- `tone="elevated"` always adds border, elevated background, and elevated shadow.
- `tone="inset"` always adds border and inset background.
- `PanelCard` always renders `AppSurface tone="panel" padding="md"`.

Problem:

- `tone` currently mixes semantic emphasis with visual density.
- There is no first-class way to say "this is still a section, but it should read flat."

### Implemented API

Add a visual `variant` separate from `tone`.

```ts
type SurfaceTone = "panel" | "elevated" | "inset" | "critical";
type SurfaceVariant = "card" | "flat" | "report" | "list";
type SurfacePadding = "none" | "sm" | "md" | "lg";
type SurfaceRadius = "none" | "sm" | "md";

interface AppSurfaceProps {
  as?: ElementType;
  tone?: SurfaceTone;
  variant?: SurfaceVariant;
  padding?: SurfacePadding;
  radius?: SurfaceRadius;
  className?: string;
  children: ReactNode;
}
```

Default behavior:

- `variant` defaults to `card`.
- Existing `AppSurface` and `PanelCard` call sites keep their current visual behavior unless explicitly changed.
- `tone="panel"` remains compatible.
- `radius` defaults to the existing radius for `variant="card"` and a lighter radius for flat/report/list variants.
- `flat`, `report`, and `list` are opt-in only.

### Variant Intent

`card`:

- Current boxed behavior.
- Keeps border, background, radius, and optional shadow.
- Best for pricing, forms, critical states, modals, and isolated tools.

`flat`:

- Minimal visual treatment.
- No shadow.
- No full border by default.
- Transparent or near-transparent background.
- Best for page sections that only need spacing and typography.

`report`:

- Market-report style section.
- Uses top/bottom divider or a single divider, not full card borders.
- No shadow.
- Compact heading and dense content rhythm.
- Best for `/crypto`, `/news`, `/alerts`, and Global Radar summary blocks.

`list`:

- Row-based surface.
- No outer card weight.
- Uses internal row dividers.
- Best for repeated metrics, news items, alert rows, journal summaries, and asset rows.

### Tone Intent

`tone` should describe semantic emphasis, not box density.

- `panel`: neutral default content.
- `elevated`: visually emphasized content, still subject to variant rules.
- `inset`: secondary or subordinate content.
- `critical`: warning, locked, error, destructive, billing, auth, or permission state.

Rules:

- `critical` can stay visibly boxed even when other sections become flat.
- `elevated + flat` should be used carefully; it may need only stronger text or divider color, not a box.
- `inset + list` is suitable for subordinate rows inside a larger report.

### PanelCard Direction

Keep `PanelCard` for backward compatibility, but avoid making it the default new layout primitive.

Implemented compatible type direction:

```ts
interface PanelCardProps {
  variant?: SurfaceVariant;
  tone?: SurfaceTone;
  padding?: SurfacePadding;
  className?: string;
  children: ReactNode;
}
```

Rules:

- `PanelCard` defaults to `variant="card"` for existing behavior.
- New report-like UI should prefer `AppSurface variant="report"` or a future `ReportSection`.
- `PanelCard variant="list"` is allowed only when a migration would otherwise duplicate row divider logic.

### Optional Future Primitives

Consider adding these only if they reduce duplication after one or two route migrations:

```ts
function ReportSection(props: AppSurfaceProps) {}
function MetricList(props: AppSurfaceProps) {}
```

Do not add these before real duplication appears.

### Backward Compatibility

Implementation must preserve current visuals by default:

- No existing call site should visually change when the new props are added.
- `AppSurface` without `variant` should behave like current `AppSurface`.
- `PanelCard` without `variant` should behave like current `PanelCard`.
- Changes should be committed separately from route-level visual migrations.

### Migration Order

1. Add variant support to `AppSurface` and optionally `PanelCard` without changing call sites.
2. Add focused smoke/build checks.
3. Apply `variant="report"` to one low-risk route section.
4. Screenshot-review that route.
5. Apply to `/crypto` only after the primitive behavior is proven.

### Screens To Avoid Initially

Avoid first migration on:

- `/pro`, because pricing cards should remain clearly boxed.
- Checkout/account/admin screens, because trust and error states need containment.
- `/global/assets`, because dense controls and chart layout make visual regression risk higher.
- Full `/crypto`, because previous broad flattening was not satisfactory.

Better first targets:

- One `/news` digest section.
- One `/alerts` status summary section.
- One `/crypto` summary subsection only after representative review.

Next pilot recommendation:

- Apply `variant="report"` or `variant="list"` to one bounded `/news` section first.
- Market selection is the next possible pilot if the goal is first-screen impact.
- Do not use `/crypto` as the first broad visual migration.

News pilot implementation note:

- `/news` route macro schedule wrapper now uses `PanelCard variant="report"`.
- `RadarNewsPanel` intro, market radar summary, briefing rows, source references, and bottom note now use `report`, `list`, or `flat` variants where safe.
- `MacroTicker` internals and `RadarDigestPanel` were intentionally left unchanged in the first pass.
- API fetch, news payload shape, market query handling, and routing were not changed.

News pilot result:

- The first `/news` pass confirmed that the new variants can reduce nested card weight without changing data flow.
- `report` works well for page-level sections where the content should read like a market report.
- `list` works well for source/reference rows where the old boxed link style made the section feel crowded.
- `flat` is useful for small helper states inside a section, but critical errors and loading states should stay visibly bounded.
- The remaining visual issue is outside the pilot scope: the global `Header` and `RadarTopNav` still carry a boxed app-shell feel and should be handled in a separate app-shell run.
- Next suitable candidates are a small market selection pass or a dedicated app shell/header/nav cleanup run. Avoid broad `/crypto` redesign until the app-shell pattern is stable.

## Route Priority

### Priority 1: Information-reading screens

Routes:

- `/crypto`
- `/news`
- `/alerts`

Reason:

- These screens should be scanned quickly.
- They contain many summary and status sections that can become report/list surfaces.

Guardrails:

- Do not change insight logic, Basic/Pro gating, API fetch, FCM, push token, or push-cron behavior.
- Screenshot review required before push for visible UI changes.

### Priority 2: Dense dashboard screens

Routes:

- `/global`
- `/global/assets`
- `/alts`

Reason:

- These screens have dense controls and market data.
- They need design consistency but have higher layout risk.

Guardrails:

- Keep Global Radar independent.
- Do not remove Global Radar entry points.
- For `/global/assets`, preserve mobile dock usability and chart visibility.
- For `/alts`, avoid breaking shared crypto components.

### Priority 3: Utility and reference screens

Routes:

- `/journal`
- `/learn`
- `/pro`

Reason:

- Some boxed UI is correct here.
- Journal has forms and history cards.
- Learn has expandable reference content.
- Pro needs pricing comparison cards.

Guardrails:

- Do not weaken plan comparison or Pro gating.
- Do not change billing copy, product IDs, plan IDs, entitlements, or RevenueCat mapping.

## Screenshot Review Criteria

For any visual implementation, capture at least:

- Mobile 340px or 360px viewport for the touched route.
- Desktop viewport for the touched route.
- One adjacent route if shared components are affected.

Check:

- No horizontal overflow.
- Fixed bottom controls do not cover important content.
- Tap targets remain usable.
- Active/inactive states remain clear.
- Chart canvas or main data area is visible.
- Text does not overlap or wrap awkwardly.
- Basic/Pro gating remains visible and correctly scoped.
- Coin Radar and Global Radar remain distinct and accessible.

For `/crypto`, also check:

- BTC/ETH switch.
- `5m`, `15m`, `1h`, `4h`, `1d` switch.
- 종합 / ICT 구조 / 기술지표 switch.
- `/alts` mobile view if shared components changed.

For `/global/assets`, also check:

- 340px and 360px mobile.
- Desktop chart visibility.
- Mobile dock does not block core content.

## Implementation Guardrails

- Do not remove borders, radius, and shadows globally without a route-level review.
- Do not apply a visual variant to every `PanelCard` at once.
- Do not combine visual cleanup with routing, data, auth, billing, push, Android, or DB changes.
- Do not push UI taste work before screenshot review unless the representative explicitly approves.
- Keep changes small enough to review visually.
- Prefer one route or one shared primitive per implementation commit.

## First Likely Implementation Paths

Candidate A: Add common surface variants first.

- Best when the next step is to reduce repeated class churn.
- Needs careful API design before code.

Candidate B: Apply a report variant to `/news` first.

- Lower visual risk than `/crypto`.
- Good for proving report/list surfaces.

Candidate C: Apply a report variant to `/crypto` summary only.

- Higher product impact.
- Requires screenshot review and stricter regression checks.

Candidate D: Flatten selected `/alerts` status sections.

- Useful because alerts are box-heavy.
- Must avoid push, FCM, entitlement, and threshold logic.

## Recommended Next Step

Design the `AppSurface` and `PanelCard` variant API before implementation.

The next active-run task should define:

- Variant names.
- Intended class behavior.
- Backward compatibility.
- Migration order.
- Screens that should not use flat variants yet.

No app code was changed in this document.
