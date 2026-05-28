# Completed Automation Run: coin-radar-market-selection-ui-run

## Status

- Completed.
- Completed date: 2026-05-28.
- Replaced by active run: `design-system-flat-surfaces-run`.

## Purpose

- 시장 선택 화면의 큰 외곽 테두리 박스와 중첩 카드 느낌을 줄여 모바일 첫 화면 공간감을 개선한다.
- Coin Radar와 Global Radar를 동등한 상위 시장 모드로 유지한다.
- Global Radar 독립 진입 동선을 훼손하지 않는다.

## Completed Tasks

| Order | Status | Task | Area | Risk | Commit | Result |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | DONE | 시장 선택 화면 현재 구조 조사 | 홈 랜딩 / 시장 선택 화면 | LOW | `92fce58` | 첫 진입 페이지와 실제 시장 선택 UI 구조를 확인하고, 큰 외곽 박스 원인을 문서화했다. |
| 2 | DONE | 큰 외곽 박스 제거 | 홈 랜딩 / 시장 선택 화면 | MEDIUM | `14e08f0` | 시장 선택 화면의 큰 외곽 `enterprise-panel` wrapper를 제거하고 Coin Radar / Global Radar 진입 링크를 유지했다. |
| 3 | DONE | 구현 결과 문서 정리 | 문서 / UX | LOW | `27f6e14` | 구현 결과와 남은 과제를 문서화하고 run을 완료했다. |

## Notes

- 마지막 사용 시장 기억, 하단 탭 구조, `/spot`, `/home`, `/macro` 신규 route는 구현하지 않았다.
- 결제, 인증, Supabase, Android, FCM, production 변경은 없었다.
- 이후 `/crypto` flatten 시도 2개는 main에서 제거하고 `backup/failed-crypto-flatten-20260528` 브랜치에 보존했다.
- 다음 run은 앱 전역 flat surface 디자인 기준을 먼저 정리한다.
