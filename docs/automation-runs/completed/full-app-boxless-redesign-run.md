# Completed Automation Run: full-app-boxless-redesign-run

## Status

- Completed at planning level.
- Completed date: 2026-05-28.
- Next recommended run: `boxless-design-primitives-foundation-run`.

## Purpose

- Define ChartRadar's full-app boxless redesign direction.
- Move away from AI-like SaaS dashboard cards and toward full-screen consumer app structure.
- Preserve Coin Radar and Global Radar as equal top-level modes.
- Preserve Global Radar as an independent global stocks/futures radar.

## Completed Tasks

| Order | Status | Task | Result |
| --- | --- | --- | --- |
| 1 | DONE | 전체 앱 boxless redesign 방향 문서화 | Full-screen app design philosophy, box exceptions, and forbidden implementation areas documented. |
| 2 | DONE | 화면별 카드/패널 제거 우선순위 재정리 | Screen-by-screen priority, risk, first applicability, and screenshot criteria documented. |
| 3 | DONE | 공통 AppShell / BottomNav / Section / ListRow 디자인 기준 설계 | Common AppShell, BottomNav, Section, ListRow, MetricRow, DividerGroup, ReportBlock, CriticalNotice, and ProCtaBlock standards documented. |
| 4 | DONE | 첫 구현 화면 선정 | First implementation selected as backward-compatible `DesignPrimitives` foundation. |
| 5 | DONE | 첫 구현 범위 확정 | Scope, forbidden files, validation, screenshot policy, and push policy documented. |

## Selected First Implementation

- `boxless-design-primitives-foundation-run`

Scope:

- Add backward-compatible `flat`, `report`, and `list` variant support to common design primitives.
- Do not change route files or visual call sites in the first foundation step unless separately approved.
- Do not redesign `/crypto` first.

## Notes

- This run was documentation-only.
- No app code was changed.
- No route, billing, auth, Supabase, Android, FCM, or production DB changes were made.
- UI implementation should be handled in a separate active-run.
