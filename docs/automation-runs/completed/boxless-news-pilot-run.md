# Completed Automation Run: boxless-news-pilot-run

## Status

- Completed.
- Completed date: 2026-05-28.

## Purpose

- Apply the first bounded boxless visual pilot to `/news`.
- Reduce nested `AppSurface` / `PanelCard` card weight in a low-risk feed/report screen.
- Preserve `/news?market=crypto` and `/news?market=global`.

## Completed Tasks

| Order | Status | Task | Commit | Result |
| --- | --- | --- | --- | --- |
| 1 | DONE | `/news` 현재 박스 구조 조사 | `5115748` | Main box sources were documented across `news/page.tsx`, `RadarNewsPanel`, `RadarDigestPanel`, and `MacroTicker`. |
| 2 | DONE | `/news` boxless pilot 적용 | `80c1147` | Applied `report`, `list`, and `flat` variants to bounded `/news` surfaces without API, route, or data shape changes. |
| 3 | DONE | pilot 결과 문서화 | pending current commit | Recorded pilot outcome, remaining app-shell issue, and next implementation candidates. |

## Verification Summary

- `git diff --check` passed.
- `cmd /c npx tsc --noEmit` passed for the implementation commit.
- `npm.cmd run build` passed for the implementation commit.
- `npm.cmd run smoke:mobile` passed for the implementation commit.
- `npm.cmd run smoke:all` passed for the implementation commit.
- `/news` 360px and desktop screenshots were captured for the implementation commit.
- `/news?market=crypto` and `/news?market=global` were checked.

## Outcome

- The `DesignPrimitives` variants are viable for a bounded report/list screen.
- `/news` now reads less like nested cards and more like a market report flow.
- `MacroTicker` internals and `RadarDigestPanel` remain intentionally untouched.

## Remaining Issues

- Shared `Header` and `RadarTopNav` still create a boxed app-shell feel.
- This should be handled in a separate app-shell run, not inside `/news`.

## Recommended Next Runs

- `boxless-app-shell-run`
- `boxless-market-selection-run`
- `boxless-alerts-list-pilot-run`

## Notes

- No push, deploy, production DB migration, AAB generation, Play Console upload, billing, auth, Supabase, Android, or FCM work was part of this run.
