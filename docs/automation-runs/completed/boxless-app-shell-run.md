# Completed Automation Run: boxless-app-shell-run

## Status

- DONE

## Completed At

- 2026-05-28

## Purpose

ChartRadar 전 화면에서 공통으로 보이는 Header, Nav, AppShell의 박스 느낌을 줄이고, boxless redesign 방향에 맞는 상단 구조를 검증했다.

## Completed Tasks

1. Header/Nav/AppShell 구조 조사
2. App shell boxless 기준 문서화
3. Header/Nav boxless pilot 적용
4. Pilot 결과 문서화

## Result

- `Header`를 기본 card shell에서 flat divider-only shell로 낮췄다.
- Header logo의 nested inset box 느낌을 줄였다.
- Header alert/settings buttons는 기능을 유지하면서 transparent circular icon button으로 가볍게 정리했다.
- `RadarTopNav`는 crypto, global, all-market 공통 underline/nav-row model로 정리했다.
- Global/all-market nav에서 card `AppSurface`, active ring, pill-like card state를 제거했다.
- Suspense fallback도 boxed skeleton에서 divider-style row skeleton으로 변경했다.

## Screenshots Reviewed

- `reports/verification/app-shell-crypto-360.png`
- `reports/verification/app-shell-global-360.png`
- `reports/verification/app-shell-news-360.png`
- `reports/verification/app-shell-desktop.png`

## Verification Summary

- `/crypto` 360px: no horizontal overflow.
- `/global` 360px: no horizontal overflow, Global Radar remains independent.
- `/news` 360px: no horizontal overflow, works with news boxless pilot.
- Desktop: Header, plan/status, alert, settings, and nav remain visible.

## Preserved

- Route behavior.
- Auth/session behavior.
- Plan/billing logic.
- Notification logic.
- `/crypto`, `/global`, `/news` body content.
- Coin Radar and Global Radar independent top-level market modes.

## Remaining Issues

- `/crypto` body still needs a separate larger redesign run.
- `/global` body still has strong panel/card treatment.
- `/alerts` and `/journal` remain card/form heavy.
- Market selection can receive a final boxless pass.

## Recommended Next Runs

1. Market selection screen final boxless pass.
2. `/alerts` list-centered pilot.
3. `/journal` form/list surface simplification.
4. `/global` body report-style redesign.
5. `/crypto` body redesign as a separate larger run.
