# P2 StockRadarApp 컴포넌트 분리

- 상태: `IN_PROGRESS`
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

## 분리 설계 메모

- 분리 설계 문서 작성 완료, 단계별 구현 예정.
- 작업 기준 route는 `/global/assets`이며 `/global`은 시장흐름 대시보드로 유지한다.
- 설계 문서: `docs/stock-radar-app-refactor-plan.md`.
- 2026-05-29: 관심 자산 localStorage helper를 `src/components/global/globalWatchlist.ts`로 분리했다. 저장 key, 기본 관심 자산, 최대 개수 제한은 변경하지 않았다.
- 2026-05-29: 글로벌 자산 checklist/playbook 표시 컴포넌트를 `src/components/global/GlobalAssetPlaybook.tsx`로 분리했다. 가격 계산, 차트, 데이터 fetch, Basic/Pro gating은 변경하지 않았다.
- 2026-05-29: 글로벌 초보자 가이드 렌더링과 step 생성 로직을 `src/components/global/GlobalBeginnerGuide.tsx`로 분리했다. session timer와 데이터 계산은 변경하지 않았다.
