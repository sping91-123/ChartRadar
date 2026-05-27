# /alts Profile

## 담당 영역

- `/alts` 알트코인 레이더.
- 알트 후보, 알트 차트, 알트 시장 스캔 UX.

## 관련 파일/디렉터리

- `src/app/alts/page.tsx`
- `src/components/SetupScoutPanel.tsx`
- `src/components/WatchlistPanel.tsx`
- `src/lib/setupScout.ts`
- `src/lib/cryptoUniverse.ts`

## 자주 발생하는 작업

- 알트 후보 표시.
- 관심코인/저장조건 확인.
- 작은 폰 overflow 수정.
- 알트 자동 푸시 후보 정책 확인.

## 고위험 변경

- 알트 scoring.
- market scout threshold.
- 관심코인과 비관심 알트 자동 알림 구분.
- `/crypto` 공유 컴포넌트 영향.

## 추천 검증 명령

- `npm.cmd run build`
- `npm.cmd run smoke:mobile`
- `npm.cmd run smoke:all`
- 알림 영향이 있으면 `npm.cmd run smoke:ops`

## subagent 역할 설명

알트 레이더와 후보 UX 담당이다. 낮은 점수 알림 차단, market_scout와 watchlist 구분, 작은 화면 가독성을 유지한다.
