# Completed Automation Run: boxless-alerts-list-pilot-run

## Status

- DONE

## Completed At

- 2026-05-29

## Purpose

`/alerts` 화면의 카드, 패널, 중첩 surface 의존도를 줄이고 list/row/divider 중심 UI로 전환했다. 알림 기능과 푸시 로직은 유지하고, 시각 구조만 제한적으로 검증했다.

## Completed Tasks

1. `/alerts` 현재 박스 구조 조사.
2. `/alerts` boxless list pilot 적용.
3. Pilot 결과 문서화.

## Result

- `RadarAlertCenter` 최상위 surface를 card-like shell에서 flat surface로 낮췄다.
- 앱 푸시 상태, 저장 조건, 알림 조건 섹션을 report/list flow로 전환했다.
- 저장 조건 monitor metric 3개를 nested metric cards에서 divider rows로 정리했다.
- 반복 `RuleCard`를 nested card가 아니라 list row presentation으로 바꿨다.
- Toggle touch target, enabled/disabled state, Pro/Basic pill은 유지했다.
- Admin diagnostics와 test push tools는 안전상 첫 pass에서 크게 바꾸지 않았다.

## Merge Record

- PR: #1.
- Merge commit: `53684ac`.
- Implementation commit: `09d1c43`.
- Branch: `codex/alerts-boxless-list-pilot`.

## Screenshots Reviewed

- `reports/verification/alerts-boxless-360.png`.
- `reports/verification/alerts-boxless-desktop.png`.

## Verification Summary

- `git diff --check`.
- `cmd /c npx tsc --noEmit`.
- `npm.cmd run build`.
- `npm.cmd run smoke:mobile`.
- `npm.cmd run smoke:all`.
- `npm.cmd run smoke:ops`.
- `/alerts?market=crypto` checked at 360px and desktop.
- `/alerts?market=global` checked for title, saved conditions, alert rules, enable notification UI, and no horizontal overflow.

## Preserved

- Push token storage/removal logic.
- FCM logic.
- push-cron logic.
- Notification permission request flow.
- Supabase logic.
- Billing/auth logic.
- Android and production-related files.
- Route behavior.
- Pro/Basic gating.
- Admin diagnostics/test push tools.
- Global Radar independent market scope.

## Remaining Issues

- Admin diagnostics remain intentionally boxed and should only be changed in a separate admin-tool pass.
- `UsageMeterPanel` was not changed in this pilot.
- Some status pills, buttons, and critical states remain bounded because they carry state, action, or risk.
- `/alerts` visual direction is improved, but final app-wide consistency depends on later `/journal`, `/global`, `/crypto`, and `/pro` passes.

## Recommended Next Runs

1. `/journal` form/list surface simplification.
2. `/global` body report-style redesign.
3. `/crypto` body redesign as a separate larger run.
4. `/pro` pricing/CTA boxless review without weakening plan comparison or gating.
