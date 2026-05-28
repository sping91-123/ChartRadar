# Active Automation Run

## Run Title

- `boxless-app-shell-run`

## Status

- DONE

## Purpose

- ChartRadar 전 화면에서 공통으로 보이는 Header, Nav, AppShell의 박스 느낌을 줄인다.
- 개별 콘텐츠 카드보다 먼저 공통 상단 구조를 가볍게 만들어 boxless redesign 방향을 막는 요소를 제거한다.
- Coin Radar와 Global Radar를 동등한 상위 시장 모드로 유지하면서, 대기업 앱처럼 화면 전체를 쓰는 상단 구조를 설계하고 검증한다.

## Completion Summary

- Header/Nav/AppShell 구조 조사를 완료했다.
- App shell boxless 기준 문서화를 완료했다.
- Header/Nav boxless pilot을 적용하고 push했다.
- Pilot 결과 문서화와 completed 기록을 완료했다.

## Completed Artifacts

- `docs/app-shell-boxless-audit.md`
- `docs/app-shell-boxless-rules.md`
- `docs/automation-runs/completed/boxless-app-shell-run.md`

## Task List

| Order | Status | Task | Area | Risk | Result |
| --- | --- | --- | --- | --- | --- |
| 1 | DONE | Header/Nav/AppShell 구조 조사 | App shell audit | LOW | Header, RadarTopNav, AppSurface 기반 shell, route wrapper에서 박스 느낌을 만드는 요소를 조사했다. |
| 2 | DONE | App shell boxless 기준 문서화 | Design system docs | LOW | Header/Nav의 background, border, divider-only, underline nav, mobile spacing 기준을 정리했다. |
| 3 | DONE | Header/Nav boxless pilot 적용 | App shell implementation | HIGH | Header를 flat divider-only shell로 낮추고 RadarTopNav를 crypto/global/all 공통 underline nav row로 정리했다. |
| 4 | DONE | pilot 결과 문서화 | Docs / UX | LOW | 적용 결과, 좋아진 점, 남은 문제, 화면별 검수 결과, 다음 후보를 문서화했다. |

## Push Policy

- Task 3 실제 UI 변경은 대표 확인 후 push 완료.
- Task 4는 문서-only 작업이며 safe 조건 충족 시 자동 push 가능.

## Next Candidate Runs

- Market selection screen final boxless pass.
- `/alerts` list-centered pilot.
- `/journal` form/list surface simplification.
- `/global` body report-style redesign.
- `/crypto` body redesign as a separate larger run.
