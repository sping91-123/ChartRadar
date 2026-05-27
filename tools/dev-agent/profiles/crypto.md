# /crypto Profile

## 담당 영역

- `/crypto` BTC/ETH 레이더.
- `LiveMarketChart`와 crypto component 분리.
- 코인 차트, 타임프레임, 분석 모드, Pro gate.

## 관련 파일/디렉터리

- `src/app/crypto/page.tsx`
- `src/components/LiveMarketChart.tsx`
- `src/components/crypto/`
- `src/app/api/crypto-candles/route.ts`
- `src/app/api/crypto-symbols/route.ts`

## 자주 발생하는 작업

- 차트 blank/height 문제 수정.
- BTC/ETH 전환.
- timeframe, 분석 모드 컨트롤.
- Basic/Pro 상세 근거 노출 점검.

## 고위험 변경

- lightweight-charts 초기화.
- fetch/useEffect dependency.
- Basic/Pro gating.
- `/alts`와 공유되는 차트 영향.

## 추천 검증 명령

- `cmd /c npx tsc --noEmit`
- `npm.cmd run build`
- `npm.cmd run smoke:mobile`
- `npm.cmd run smoke:all`
- `/crypto` 340px/360px, BTC/ETH, 5m~1d 전환 확인.

## subagent 역할 설명

코인 메인 레이더 담당이다. 차트 렌더링과 Pro gate 회귀를 최우선으로 확인하고, 리팩토링은 단계별 shell 분리 방식으로 수행한다.
