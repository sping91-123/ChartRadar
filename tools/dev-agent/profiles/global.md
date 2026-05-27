# /Global Profile

## 담당 영역

- `/global` 시장흐름 대시보드.
- `/global/assets` 글로벌 자산 레이더.
- 글로벌 탭, 하단 고정 패널, 자산 차트.

## 관련 파일/디렉터리

- `src/app/global/page.tsx`
- `src/app/global/assets/page.tsx`
- `src/components/StockRadarApp.tsx`
- `src/components/GlobalMarketPulse.tsx`
- `src/app/api/stocks/`
- `src/lib/stockMarket.ts`

## 자주 발생하는 작업

- 글로벌 시장/자산 route 분리 유지.
- 자산 차트 표시 문제.
- timeframe/mode 하단 컨트롤.
- 글로벌 상단 탭 정렬.

## 고위험 변경

- `/global`과 `/global/assets` 역할 혼합.
- lightweight-charts ref/height.
- 특수 심볼 처리.
- 글로벌 자동 푸시 targetPath.

## 추천 검증 명령

- `cmd /c npx tsc --noEmit`
- `npm.cmd run build`
- `npm.cmd run smoke:mobile`
- `npm.cmd run smoke:all`
- `/global`, `/global/assets` 340px/360px 확인.

## subagent 역할 설명

글로벌 시장과 자산 레이더 담당이다. `/global`은 시장흐름, `/global/assets`는 자산레이더라는 경계를 유지한다.
