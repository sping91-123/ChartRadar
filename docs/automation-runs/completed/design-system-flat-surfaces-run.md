# Completed Automation Run: design-system-flat-surfaces-run

## Status

- Closed as superseded.
- Closed date: 2026-05-28.
- Replaced by active run: `full-app-boxless-redesign-run`.

## Reason For Closure

- 대표가 ChartRadar 전체 디자인을 카드/박스/패널 중심 구조에서 벗어나 풀스크린 앱 구조로 전면 전환하기로 결정했다.
- 기존 run은 flat surface 기준을 정리하는 데 유효했지만, 이후 방향은 부분 flat variant가 아니라 전 화면 boxless redesign이다.
- 기존 조사와 설계 문서는 새 run의 참고 자료로 유지한다.

## Preserved Documents

- `docs/app-wide-box-source-audit.md`
- `docs/app-wide-boxless-ui-plan.md`

## Completed Tasks

| Order | Status | Task | Commit | Result |
| --- | --- | --- | --- | --- |
| 1 | DONE | App-wide box source audit | `93ec55a` | 앱 전체 박스/카드/패널 발생 원인과 화면별 주요 컴포넌트를 조사했다. |
| 2 | DONE | Flat surface design rule 문서화 | `87aec8e` | 유지할 박스, 줄일 박스, route별 우선순위, 스크린샷 검수 기준을 정리했다. |
| 3 | DONE | DesignPrimitives variant 설계 | `28d4e4e` | `AppSurface` / `PanelCard`의 future variant API 방향을 문서화했다. |
| 4 | SUPERSEDED | First implementation candidate 선정 | - | 전 화면 boxless redesign 결정으로 새 active run에서 다시 선정한다. |

## Notes

- 앱 코드 수정은 없었다.
- push, deploy, production DB migration, AAB 생성, Play Console 업로드는 진행하지 않았다.
- Global Radar는 독립 시장 레이더로 유지한다.
