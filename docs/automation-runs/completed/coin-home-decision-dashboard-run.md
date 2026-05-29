# coin-home-decision-dashboard-run

## Status

- DONE

## Purpose

- Coin Radar 홈을 정보 대시보드가 아니라 "매매 전 10초 판단 화면"으로 재정의했다.
- 홈이 답해야 할 질문을 아래 4개로 정리했다.
  - 지금 장을 봐도 되는가?
  - 내 대표 코인은 추적할 만한가?
  - 지금은 BTC장이냐, 알트장이냐?
  - 지금 가장 큰 리스크는 뭔가?

## Completed Work

1. `/coin` 홈 구조 audit
   - `/coin`, `CoinRadarHomePanel`, current APIs, Header, RadarTopNav, MacroTicker 연결 구조를 정리했다.

2. 홈 decision model 설계
   - 상태: 관망 / 조건 대기 / 추적 가능 / 리스크 확대.
   - 준비도 점수: 매매 환경 준비도 0-100.
   - 방향성: 상방 우세 / 하방 압력 / 관망 / 변동성 주의.
   - 리스크 우선순위와 Basic/Pro 구분을 정리했다.

3. 대표 코인 개인화 설계
   - 기본값 BTC/ETH/XRP.
   - 후보 BTC/ETH/XRP/SOL/DOGE/BNB.
   - localStorage 우선, 계정 동기화 후순위.
   - 현물/선물 모드 문구와 Pro 확장 기준을 정리했다.

4. BTC장 vs 알트장 판단 기준 설계
   - BTC 우세 / 알트 순환 / 혼조 / 위험 회피 라벨을 정의했다.
   - 현재 데이터 기반 MVP와 추후 필요한 데이터를 분리했다.

5. 첫 구현 후보 선정
   - 첫 구현 후보로 `오늘의 결론 + 준비도 + 시장 주도 라벨`을 선정했다.
   - 추천 branch: `codex/coin-home-decision-summary`.
   - 구현은 별도 active-run 또는 PR에서 진행한다.

## Selected First Implementation

- `오늘의 결론 + 준비도 + 시장 주도 라벨`

## Suggested Branch

- `codex/coin-home-decision-summary`

## Suggested Implementation Scope

- `src/components/coin/CoinRadarHomePanel.tsx`
- optional `src/components/coin/coinHomeDecisionModel.ts`
- docs update after implementation

## Forbidden For First Implementation

- route 변경 금지.
- 신규 API 금지.
- Supabase/auth/billing/Android/FCM 변경 금지.
- 대표 코인 선택 UI 구현 금지.
- Upbit/Bithumb breadth 추가 금지.
- ETH/BTC 신규 fetch 금지.
- Basic/Pro gating 약화 금지.
- 매수/매도/롱/숏 지시 문구 금지.

## Source Docs

- `docs/coin-home-decision-dashboard-audit.md`
- `docs/automation-runs/active-run.md`
