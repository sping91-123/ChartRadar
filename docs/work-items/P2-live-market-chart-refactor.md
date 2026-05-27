# P2 LiveMarketChart 컴포넌트 분리

- 상태: `IN_PROGRESS`
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

- 2026-05-26: `docs/live-market-chart-refactor-plan.md`에 분리 설계 문서 작성 완료. 당시에는 실제 리팩토링 미진행 상태였으며, 이후 아래 단계들이 진행되었다.
- 2026-05-26: 작업 기준 route는 `/crypto`이며 `/majors`는 호환/redirect로만 취급한다는 기준을 문서에 명시.
- 2026-05-26: `053c987`에서 `/crypto` 차트 타입과 상수 분리를 진행했다. `src/components/crypto/types.ts`, `src/components/crypto/constants.ts` 기준으로 순수 타입/상수를 분리했다.
- 2026-05-26: `492b78f`에서 `CryptoChartPanel` shell을 분리했다. 차트 lifecycle 자체는 `LiveMarketChart.tsx`에 남겨 회귀 위험을 줄였다.
- 2026-05-26: `d802f34`, `d8a533f`, `7911604`에서 코인 레이더 컨트롤, 요약 섹션 shell, 레이더 컨트롤 탭을 단계적으로 분리했다.
- 2026-05-26: `e3a4480`에서 `CryptoProGate` shell을 분리했다. Basic/Pro gating 정책 자체는 변경하지 않았다.
- 2026-05-27: `da9ba37`에서 `/crypto` data helper 분리를 진행했다. fetch와 차트 lifecycle의 큰 구조는 아직 `LiveMarketChart.tsx` 중심으로 유지한다.

## 현재 남은 분리 후보

- `LiveMarketChart.tsx`는 아직 약 3,000라인 이상이며 orchestration, fetch/data state, chart lifecycle, 일부 CTA/저널 저장 흐름이 남아 있다.
- 다음 작은 후보는 chart lifecycle을 건드리지 않는 순수 표시 helper 추가 분리 또는 저널/CTA payload helper 분리다.
- fetch hook 분리, lightweight-charts lifecycle 분리, Basic/Pro gating 정책 변경은 별도 승인 전에는 진행하지 않는다.
