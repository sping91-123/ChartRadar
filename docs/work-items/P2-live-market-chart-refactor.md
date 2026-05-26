# P2 LiveMarketChart 컴포넌트 분리

- 상태: `TODO`
- 담당방: 코인 레이더 /crypto
- 인텔리전스: 높음
- 우선순위: P2

## 목표

`LiveMarketChart`가 너무 커져 UI, 판단, 차트, CTA, Pro gate가 섞여 있습니다. 기능 변경 없이 단계적으로 분리해 유지보수성을 높입니다.

## 분리 후보

- `CryptoChartPanel`
- `CryptoSummaryPanel`
- `CryptoRiskPanel`
- `CryptoModeControls`

## 완료 기준

- 기능 변경 없이 유지보수성이 좋아져야 합니다.
- 기존 BTC/ETH 전환, timeframe 전환, Basic/Pro 노출 정책이 유지되어야 합니다.
- 340px~360px 모바일 overflow가 없어야 합니다.

## 검증 기준

- `git diff --check`
- `cmd /c npx tsc --noEmit`
- `npm.cmd run build`
- `npm.cmd run smoke:mobile`
- `npm.cmd run smoke:all`

## 진행 메모

- 2026-05-26: `docs/live-market-chart-refactor-plan.md`에 분리 설계 문서 작성 완료. 실제 리팩토링은 미진행이며, 단계별 구현 예정.
- 2026-05-26: 작업 기준 route는 `/crypto`이며 `/majors`는 호환/redirect로만 취급한다는 기준을 문서에 명시.
