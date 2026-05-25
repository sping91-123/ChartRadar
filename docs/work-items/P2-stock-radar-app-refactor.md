# P2 StockRadarApp 컴포넌트 분리

- 상태: `TODO`
- 담당방: /Global
- 인텔리전스: 높음
- 우선순위: P2

## 목표

`StockRadarApp`의 글로벌 자산 선택, 차트, 컨트롤바, 요약, fallback 상태를 분리합니다.

## 완료 기준

- 글로벌 시장/자산 구조가 더 안정적으로 유지되어야 합니다.
- `/global`과 `/global/assets` 역할 분리가 유지되어야 합니다.
- `/global/assets`에서 하단 고정 패널, timeframe, 분석 모드 전환이 유지되어야 합니다.
- 340px~360px 모바일 overflow가 없어야 합니다.

## 검증 기준

- `git diff --check`
- `cmd /c npx tsc --noEmit`
- `npm.cmd run build`
- `npm.cmd run smoke:mobile`
- `npm.cmd run smoke:all`
