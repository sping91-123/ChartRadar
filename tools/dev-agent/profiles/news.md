# 뉴스 레이더 범위 정리 Profile

## 담당 영역

- `/news` 코인/글로벌 뉴스.
- 매크로 캘린더.
- 경제지표 발표 상태와 freshness.

## 관련 파일/디렉터리

- `src/app/news/page.tsx`
- `src/components/RadarNewsPanel.tsx`
- `src/components/MacroTicker.tsx`
- `src/components/GlobalMarketPulse.tsx`
- `src/lib/macro/`
- `src/lib/macroCalendar.ts`
- `src/app/api/macro-calendar/route.ts`
- `src/app/api/radar-news/route.ts`

## 자주 발생하는 작업

- 경제지표 발표값 상태 보정.
- 매크로 일정 stale/cache 문제 수정.
- 뉴스 제목 한국어 표시.
- 글로벌 일정/이벤트 흐름 정리.

## 고위험 변경

- macro cache 정책.
- official source adapter.
- 발표 직후 actual/forecast/previous 상태.
- smoke:ops freshness 기준.

## 추천 검증 명령

- `cmd /c npx tsc --noEmit`
- `npm.cmd run build`
- `npm.cmd run smoke:ops`
- `npm.cmd run smoke:all`
- `/news?market=global`, `/news?market=crypto` 확인.

## subagent 역할 설명

뉴스와 매크로 레이더 담당이다. 경제지표는 캐시와 발표 상태 회귀가 잦으므로 API 응답과 UI 문구를 함께 확인한다.
