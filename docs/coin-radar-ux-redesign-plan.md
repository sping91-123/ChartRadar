# Coin Radar UX Redesign Plan

## 목적

Coin Radar를 국내 코인 사용자 중심으로 더 빠르고 직관적인 구조로 재설계한다.

- 사용자가 차트를 오래 보지 않아도 대표 코인 상태, 리스크, 다음 확인 조건을 빠르게 파악하게 한다.
- 정보량을 줄이고 화면 공간을 넓힌다.
- 홈에서 대표 코인과 시장 체력을 즉시 확인하게 한다.
- 투자 권유처럼 보이는 표현을 피하고 판단 보조, 추적 조건, 리스크, 무효화 기준, 확인 조건 중심으로 정리한다.

## Global Radar 독립 유지 원칙

Global Radar는 삭제하지 않는다.

- ChartRadar의 상위 시장 모드는 Coin Radar와 Global Radar를 유지한다.
- Global Radar는 코인 보조 매크로 화면이 아니라 해외주식/해외선물 사용자용 독립 레이더다.
- Coin Radar 안의 매크로는 코인 판단에 필요한 요약 신호만 다룬다.
- Global Radar의 `/global`, `/global/assets` 구조를 Coin Radar 내부 탭으로 흡수하지 않는다.
- Global Pro와 All Market Pro BM을 약화시키는 방향으로 Global Radar를 축소하지 않는다.

## Coin Radar 기준 route

- 실제 Coin Radar 기준 route는 `/crypto`다.
- `/majors`는 `/crypto` 호환 또는 redirect로만 본다.
- 기존 `/alts`는 알트코인 레이더로 유지하되, 향후 Coin Radar 내부 선물 탭의 알트 하위 화면으로 재배치할 수 있다.
- `/news?market=crypto`, `/alerts?market=crypto`, `/journal?market=crypto`는 Coin Radar 내부 흐름과 연결한다.

## Coin Radar 내부 하단 탭 후보

초기 후보는 홈 / 현물 / 선물 / 매크로 / 복기다.

| 탭 | 역할 | 후보 route | MVP 범위 |
| --- | --- | --- | --- |
| 홈 | 대표 코인 상태와 시장 체력 요약 | `/crypto` 또는 `/home` | BTC 중심 시장 상태, 대표 코인 카드, 리스크, 다음 확인 조건 |
| 현물 | 국내 KRW 현물 후보 탐색 | `/spot` | 업비트/빗썸 KRW 기준 거래대금, 상승률, 과열/눌림 후보 |
| 선물 | 기존 BTC/ETH와 알트 선물 레이더 | `/crypto` 내부 또는 `/alts` 연결 | 메이저와 알트 구조 분리, 기존 분석 기능 보존 |
| 매크로 | 코인 판단에 필요한 외부 변수 요약 | `/macro` 또는 `/news?market=crypto` | 공포탐욕, 도미넌스, 김프, 환율, 펀딩비, 주요 이벤트 |
| 복기 | 저장, 판단 기록, 저널 | `/journal?market=crypto` | 저장한 판단과 조건 복기 |

## 홈 MVP 구조

홈은 가장 먼저 정리할 화면이다. 목적은 "지금 시장을 봐도 되는지, 기다려야 하는지"를 빠르게 알려주는 것이다.

### 상단 요약

- 오늘의 코인 시장 상태.
- BTC 기준 방향성.
- 리스크 단계.
- 관망/추적/확인 필요 같은 판단 보조 문구.

### 대표 코인 카드

- BTC, ETH, XRP를 기본 대표 코인 후보로 둔다.
- 각 카드에는 방향성, 점수, 주요 리스크, 다음 확인 조건을 압축 표시한다.
- "매수", "매도", "진입" 같은 지시형 문구는 피한다.

### 시장 체력

- BTC 기준 시장 체력을 별도 블록으로 둔다.
- BTC RSI, BTC 스토캐스틱, BTC 트렌드는 선택 코인이 아니라 BTC 기준으로 해석한다.
- 공포탐욕, 도미넌스, 롱숏비율, 김프, BTC/ETH/XRP 펀딩비, 환율을 보조 신호로 배치한다.

## 현물 레이더 MVP 구조

현물 레이더는 국내 사용자가 바로 이해할 수 있는 KRW 시장 기준으로 시작한다.

- 대상: 업비트 KRW, 빗썸 KRW.
- 핵심 데이터: 현재가, 등락률, 거래대금, 캔들, 최근 변동성.
- 후보 그룹: 거래대금 급증, 상승률 상위, 눌림 후보, 과열 후보, 관망 후보.
- 표현 원칙: "추천 코인"이 아니라 "관심 후보", "확인 필요", "과열 주의", "거래대금 동반 여부 확인"으로 쓴다.
- 주문/계정 연동은 하지 않는다.

## 선물 탭 내부 구조

선물 탭은 기존 `/crypto`와 `/alts` 자산을 보존하면서 사용자가 이해하기 쉬운 내부 구분을 둔다.

- 메이저: BTC/ETH 중심. 현재 `/crypto`의 핵심 경험을 유지한다.
- 알트: 기존 `/alts` 흐름을 연결한다.
- 메이저와 알트 모두 Basic/Pro 노출 정책을 유지한다.
- 차트, 분석, Pro gating의 동작 변경은 별도 구현 run에서만 다룬다.

## Coin Radar 안의 매크로 역할

Coin Radar의 매크로는 Global Radar를 대체하지 않는다.

- 목적은 코인 판단에 영향을 주는 외부 변수만 압축해서 보여주는 것이다.
- 포함 후보: 공포탐욕, BTC 도미넌스, 김프, 환율, 펀딩비, 주요 일정, 위험 이벤트.
- 미국장 전체 흐름, 글로벌 자산별 상세 판단, 해외선물/해외주식 레이더는 Global Radar의 역할로 남긴다.
- Global Radar와 중복되는 데이터가 있어도 목적과 표현을 분리한다.

## 기존 route 영향

- `/crypto`: Coin Radar 기준 route로 유지하되, 향후 홈 또는 선물 탭의 위치를 결정해야 한다.
- `/alts`: 알트 레이더로 유지하고, 향후 선물 탭 내부 알트 화면으로 연결할 수 있다.
- `/majors`: `/crypto` 호환/redirect로만 유지한다.
- `/global`, `/global/assets`: Global Radar 독립 route로 유지한다.
- `/news?market=crypto`: Coin Radar 매크로/뉴스 후보로 재구성할 수 있다.
- `/journal?market=crypto`: Coin Radar 복기 탭 후보로 유지한다.
- `/alerts?market=crypto`: Coin Radar 알림 설정과 상태로 유지한다.

## 푸시 targetPath 영향

푸시 알림은 사용자가 탭했을 때 가장 자연스러운 Coin Radar 내부 위치로 이동해야 한다.

- 메이저 코인 알림: `/crypto` 또는 향후 Coin Radar 홈/선물 메이저 위치.
- 알트 코인 알림: `/alts` 또는 향후 선물 알트 위치.
- 현물 후보 알림: 향후 `/spot` 후보.
- 뉴스/이벤트 알림: `/news?market=crypto` 또는 향후 Coin Radar 매크로 위치.
- 저널/복기 알림: `/journal?market=crypto`.

route가 바뀌기 전에는 기존 targetPath를 유지한다. targetPath 변경은 FCM, push-cron, Android intent 흐름에 영향을 줄 수 있으므로 별도 구현 run에서 검증한다.

## Pro/BM 영향

Coin Radar UX 재구성은 Pro gating을 약화시키면 안 된다.

- Basic은 방향성 요약, 핵심 흐름, 제한된 판단을 빠르게 보여준다.
- Pro는 세부 조건, 리스크, 무효화 기준, 추적 조건, 다음 행동 기준을 보여준다.
- 현물 레이더가 추가되더라도 "수익 보장", "매수 추천", "진입 신호"처럼 보이는 문구는 피한다.
- Coin Pro는 Coin Radar의 상세 조건과 추적 기준 중심으로 강화한다.
- Global Pro는 Global Radar 독립 가치를 유지한다.
- All Market Pro는 Coin Radar와 Global Radar를 함께 쓰는 사용자에게 자연스럽게 설명한다.

## 다음 설계 작업

1. 시장 선택 화면 단순화 설계.
2. Coin Radar 홈 MVP 상세 설계.
3. 현물 레이더 데이터/UX 조사.
4. Coin Radar 하단 탭 라우팅 설계.
5. 구현 1단계 후보 선정.
