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

## 시장 선택 화면 단순화 설계

시장 선택 화면은 Coin Radar와 Global Radar를 고르는 첫 관문이다. 여기서는 브랜드 설명보다 빠른 진입을 우선한다.

### 핵심 원칙

- Coin Radar와 Global Radar는 동등한 상위 시장 모드로 보여준다.
- Global Radar를 코인 보조 매크로처럼 보이게 만들지 않는다.
- 큰 외곽 테두리 박스와 중첩 카드 구조를 줄여 첫 화면의 체감 밀도를 낮춘다.
- 사용자가 마지막으로 사용한 시장을 기억해 다음 방문 때 진입 마찰을 줄인다.
- 기본 시작 화면은 대표가 선택할 수 있게 하되, 구현 전에는 `/crypto`를 Coin Radar 기준 route로 유지한다.

### 화면 구조 후보

- 상단: ChartRadar 로고와 짧은 시장 선택 타이틀.
- 본문: Coin Radar와 Global Radar를 나란히 또는 세로로 배치한 두 개의 선택 영역.
- 각 선택 영역: 시장명, 한 줄 역할 설명, 주요 진입 버튼만 표시.
- 보조 링크: Pro, Learn, 정책 문서는 첫 화면의 주 동선보다 낮은 우선순위로 둔다.

### 제거 또는 축소 후보

- 화면 전체를 감싸는 큰 외곽 테두리 박스.
- 카드 안에 또 카드가 들어가는 중첩 구조.
- 긴 설명 문단.
- 사용자가 선택하기 전부터 많은 지표나 기능을 나열하는 영역.

### 마지막 사용 시장 기억

- 사용자가 Coin Radar 또는 Global Radar로 진입하면 마지막 사용 시장을 저장한다.
- 저장 후보는 localStorage이며, 로그인 계정 동기화는 첫 구현 범위에서 제외한다.
- 저장 값은 `coin` 또는 `global`처럼 단순한 enum 형태가 적합하다.
- 저장 값이 없으면 기본 시작 화면 정책을 따른다.
- 저장 값이 잘못되었거나 route가 사라진 경우 `/crypto`로 안전하게 fallback한다.

### 기본 시작 화면 정책 후보

| 정책 | 장점 | 단점 |
| --- | --- | --- |
| 항상 시장 선택 화면 | 두 시장 모드가 명확히 보임 | 반복 방문자의 진입 속도가 느림 |
| 마지막 사용 시장으로 자동 진입 | 반복 사용성이 좋음 | 첫 화면에서 Global Radar 존재감이 약해질 수 있음 |
| `/crypto`를 기본 시작 화면으로 사용 | Coin Radar 중심 재설계와 맞음 | Global Radar 독립 모드 인지가 약해질 수 있음 |

초기 권장안은 "첫 방문은 시장 선택, 이후는 마지막 사용 시장 기억"이다. 단, 사용자가 언제든 시장 선택 화면으로 돌아갈 수 있는 명확한 전환 동선을 둔다.

### 구현 시 주의

- 이 문서는 설계만 다루며 현재 앱 코드는 수정하지 않는다.
- route 변경, redirect 변경, localStorage key 추가는 별도 구현 active run에서 처리한다.
- Global Radar 진입 동선을 숨기거나 약화하지 않는다.
- 결제/Pro gating 문구는 투자 수익을 보장하는 느낌이 없어야 한다.

## Coin Radar 내부 하단 탭 후보

초기 후보는 홈 / 현물 / 선물 / 매크로 / 복기다.

| 탭 | 역할 | 후보 route | MVP 범위 |
| --- | --- | --- | --- |
| 홈 | 대표 코인 상태와 시장 체력 요약 | `/crypto` 또는 `/home` | BTC 중심 시장 상태, 대표 코인 카드, 리스크, 다음 확인 조건 |
| 현물 | 국내 KRW 현물 후보 탐색 | `/spot` | 업비트/빗썸 KRW 기준 거래대금, 상승률, 과열/눌림 후보 |
| 선물 | 기존 BTC/ETH와 알트 선물 레이더 | `/crypto` 내부 또는 `/alts` 연결 | 메이저와 알트 구조 분리, 기존 분석 기능 보존 |
| 매크로 | 코인 판단에 필요한 외부 변수 요약 | `/macro` 또는 `/news?market=crypto` | 공포탐욕, 도미넌스, 김프, 환율, 펀딩비, 주요 이벤트 |
| 복기 | 저장, 판단 기록, 저널 | `/journal?market=crypto` | 저장한 판단과 조건 복기 |

## Coin Radar 하단 탭 라우팅 설계

하단 탭은 Coin Radar 내부 이동을 빠르게 만드는 모바일 내비게이션이다. 첫 구현에서는 기존 route를 최대한 보존하고, 새 route는 skeleton 또는 redirect 후보로만 다룬다.

### 권장 탭 구조

| 탭 | 권장 route | 초기 연결 방식 | 비고 |
| --- | --- | --- | --- |
| 홈 | `/crypto` | 기존 Coin Radar 기준 route 유지 | Coin Radar 홈 MVP가 준비되기 전까지 기존 BTC/ETH 레이더를 유지 |
| 현물 | `/spot` | 신규 route 후보 | 업비트/빗썸 KRW 현물 레이더 전용 |
| 선물 | `/crypto` 내부 segment 또는 `/alts` | 초기에는 `/crypto`와 `/alts` 기존 route 연결 | 메이저/알트 구분을 탭 내부에서 명확히 함 |
| 매크로 | `/macro` 또는 `/news?market=crypto` | 초기에는 `/news?market=crypto` 재사용 | 코인 판단용 압축 매크로만 표시 |
| 복기 | `/journal?market=crypto` | 기존 route 재사용 | 저장/복기/저널 흐름 유지 |

### 단계별 route 전략

1. 0단계: 기존 route 보존.
   - `/crypto`는 Coin Radar 기준 route다.
   - `/alts`는 알트 레이더로 유지한다.
   - `/news?market=crypto`, `/journal?market=crypto`, `/alerts?market=crypto`를 그대로 사용한다.
2. 1단계: 하단 탭 UI만 기존 route에 연결.
   - 홈은 `/crypto`.
   - 선물 메이저는 `/crypto`, 선물 알트는 `/alts`.
   - 매크로는 `/news?market=crypto`.
   - 복기는 `/journal?market=crypto`.
3. 2단계: 신규 route 후보 검증.
   - 현물 `/spot` skeleton을 별도 구현 run에서 검토한다.
   - 매크로 `/macro`는 기존 뉴스/이벤트 구조와 중복을 줄일 수 있을 때만 검토한다.
   - `/home`은 `/crypto`와 역할이 겹치므로 첫 구현 후보로는 낮은 우선순위다.
4. 3단계: route 정리.
   - 사용자 반응과 구현 안정성을 본 뒤 `/crypto`를 홈으로 유지할지, 선물 메이저로 좁힐지 결정한다.

### `/crypto`와 `/majors` 원칙

- `/crypto`는 실제 Coin Radar 기준 route다.
- `/majors`는 `/crypto` 호환/redirect로만 유지한다.
- 새 하단 탭에서 `/majors`를 직접 노출하지 않는다.
- 기존 push targetPath가 `/crypto`를 가리키는 경우 당장 바꾸지 않는다.

### 푸시 targetPath 연결

| 알림 유형 | 초기 targetPath | 향후 후보 |
| --- | --- | --- |
| BTC/ETH 메이저 알림 | `/crypto` | `/crypto` 홈 또는 선물 메이저 segment |
| 알트 알림 | `/alts` | 선물 탭의 알트 segment |
| 현물 후보 알림 | 없음 또는 `/spot` 후보 | `/spot` |
| 코인 뉴스/이벤트 | `/news?market=crypto` | `/macro` 또는 매크로 탭 |
| 복기/저널 | `/journal?market=crypto` | 복기 탭 |

targetPath 변경은 FCM, push-cron, Android intent, 설치본 푸시 탭 이동에 영향을 줄 수 있으므로 설계 run에서는 변경하지 않는다.

### 하단 탭과 Pro/BM

- 홈 Basic은 빠른 판단 보조를 제공하되 세부 조건은 Pro에서 확장한다.
- 현물 탭 Basic은 제한된 후보와 요약만 보여주고, Pro는 상세 조건과 필터를 확장한다.
- 선물 탭은 기존 Coin Pro gating을 약화시키지 않는다.
- 매크로 탭은 Coin Radar 판단용 압축 신호만 제공하고, Global Radar의 독립 가치를 침범하지 않는다.
- 복기 탭은 저장/복기 가치를 강화하되 투자 성과 보장 문구를 쓰지 않는다.

### 구현 전 결정할 것

- `/crypto`를 계속 Coin Radar 홈으로 유지할지, 선물 메이저 중심 화면으로 좁힐지.
- `/spot` 신규 route를 바로 만들지, 기존 `/crypto` 내부 탭으로 먼저 실험할지.
- `/macro` 신규 route가 필요한지, `/news?market=crypto` 재구성으로 충분한지.
- 하단 탭이 전체 앱 공통인지, Coin Radar 내부에서만 보이는지.

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

## Coin Radar 홈 MVP 상세 설계

홈 MVP는 "대표 코인 상태"와 "BTC 기준 시장 체력"을 분리해서 보여준다. 사용자가 특정 코인을 선택하더라도 시장 체력 지표는 BTC 기준으로 유지한다.

### 대표 코인 선택

- 기본 대표 코인은 BTC, ETH, XRP다.
- 대표 코인 카드는 3개를 우선 노출하고, 더 많은 코인 확장은 현물 또는 선물 탭에서 처리한다.
- 사용자가 마지막으로 본 대표 코인은 로컬에 기억할 수 있지만, 첫 구현에서는 기본값 BTC로 시작해도 된다.
- 대표 코인 선택은 "판단 대상"을 바꾸는 것이고, BTC 기준 시장 체력 지표를 바꾸는 것이 아니다.

### 대표 코인 카드 구성

| 항목 | 설명 | 표현 원칙 |
| --- | --- | --- |
| 방향성 | 선택 코인의 단기/중기 흐름 요약 | 상승/하락/횡보/불명확처럼 판단 보조형으로 표시 |
| 점수 | 내부 판단 신호를 0~100 또는 5단계로 압축 | 수익 가능성 점수가 아니라 신호 정렬도/확인도 |
| 리스크 | 변동성, 과열, 지지 이탈, 이벤트 위험 | "주의", "확인 필요", "리스크 확대" 중심 |
| 다음 확인 조건 | 추적할 가격/지표/시간 조건 | "돌파 확인", "지지 유지", "거래량 동반 여부"처럼 조건형 문구 |
| 무효화 기준 | 현재 판단이 약해지는 조건 | "이탈 시 관망 우위", "조건 무효"처럼 표현 |

### BTC 기준 시장 체력 블록

이 블록은 선택 코인과 독립적으로 BTC 기준만 사용한다.

- 공포탐욕: 시장 심리 온도. 극단 구간에서는 추격보다 확인 조건을 강조한다.
- BTC RSI: BTC 과열/침체 압력. 선택 코인의 RSI가 아니라 BTC RSI다.
- BTC 스토캐스틱: BTC 단기 과열/반등 압력. 선택 코인의 스토캐스틱이 아니다.
- BTC 트렌드: BTC의 추세 방향과 추세 강도. 선택 코인 트렌드와 분리한다.
- BTC 도미넌스: 자금이 BTC 중심인지 알트로 확산되는지 확인한다.
- 롱숏비율: 파생 포지션 쏠림과 반대 변동성 위험을 확인한다.
- 김프: 국내 수급 과열 또는 역프리미엄 위험을 확인한다.
- BTC/ETH/XRP 펀딩비: 대표 코인별 선물 포지션 쏠림을 확인한다.
- 환율: 원화 기준 체감 가격과 국내 거래대금 해석에 참고한다.

### 홈 정보 우선순위

1. 지금 시장 상태: 관망/추적/확인 필요.
2. BTC 기준 시장 체력: 위험이 커지는 구간인지 먼저 판단.
3. 대표 코인 상태: BTC, ETH, XRP의 방향성과 리스크.
4. 다음 확인 조건: 사용자가 기다릴 조건을 명확히 제시.
5. 상세 근거: Pro 또는 세부 화면에서 확장.

### Basic/Pro 노출

- Basic은 시장 상태, 대표 코인 방향성, 핵심 리스크, 제한된 다음 확인 조건까지만 보여준다.
- Pro는 점수 구성 근거, 무효화 기준, 세부 추적 조건, 펀딩비/롱숏비율 해석, 지표별 코멘트를 확장한다.
- Pro 유도 문구는 "더 많은 수익"이 아니라 "세부 조건과 리스크 기준 확인" 중심으로 쓴다.

### 금지 표현

- "매수", "매도", "진입", "익절", "수익 확정"처럼 투자 지시로 보이는 표현은 피한다.
- "급등 예상", "수익 가능", "강력 추천"처럼 성과를 보장하는 표현은 쓰지 않는다.
- 대신 "추적 후보", "확인 조건", "리스크 확대", "관망 우위", "조건 무효"를 사용한다.

## 현물 레이더 MVP 구조

현물 레이더는 국내 사용자가 바로 이해할 수 있는 KRW 시장 기준으로 시작한다.

- 대상: 업비트 KRW, 빗썸 KRW.
- 핵심 데이터: 현재가, 등락률, 거래대금, 캔들, 최근 변동성.
- 후보 그룹: 거래대금 급증, 상승률 상위, 눌림 후보, 과열 후보, 관망 후보.
- 표현 원칙: "추천 코인"이 아니라 "관심 후보", "확인 필요", "과열 주의", "거래대금 동반 여부 확인"으로 쓴다.
- 주문/계정 연동은 하지 않는다.

## 현물 레이더 데이터/UX 조사

현물 레이더는 주문 기능이 아니라 국내 KRW 현물 시장을 빠르게 훑는 판단 보조 화면이다.

### 공식 public API 후보

- Upbit Quotation API: 인증 없이 페어, 캔들(OHLCV), 체결, 현재가, 호가 데이터를 조회할 수 있다. 참고: https://docs.upbit.com/kr/reference
- Bithumb Public API: 인증 없이 종목, 캔들, 체결, 현재가, 호가 데이터를 조회할 수 있다. 참고: https://content.bithumb.com/apidocs/main.html
- 첫 구현은 서버 API route에서 거래소 public API를 호출하고, 클라이언트에는 정제된 결과만 전달한다.
- Private API, 주문, 계정 자산, 입출금 기능은 MVP 범위에서 제외한다.

### 필요한 데이터

| 데이터 | 용도 | MVP 기준 |
| --- | --- | --- |
| 종목 목록 | KRW 마켓 후보군 구성 | KRW 페어만 사용 |
| 현재가 | 후보 카드의 기준 가격 | 거래소별 최신 ticker |
| 등락률 | 상승률/하락률 후보 분류 | 24시간 또는 거래소 제공 기준 |
| 거래대금 | 관심도와 유동성 필터 | KRW 거래대금 상위 우선 |
| 캔들 | 눌림/과열/변동성 판단 | 5m, 15m, 1h, 1d 중 최소 세트 |
| 체결 또는 호가 | 단기 수급 참고 | MVP에서는 선택 데이터로 둔다 |

### 후보 분류

- 거래대금 급증: 최근 거래대금이 평소보다 커진 종목. 추격보다 지속 여부 확인을 강조한다.
- 상승률 상위: 가격 상승이 큰 종목. 과열과 거래대금 동반 여부를 함께 보여준다.
- 눌림 후보: 추세가 완전히 깨지지 않았지만 단기 조정이 나온 종목. 지지 확인 조건을 강조한다.
- 과열 후보: 단기 상승과 거래대금이 과하게 몰린 종목. 신규 추격보다 리스크 확인을 강조한다.
- 관망 후보: 방향성이나 거래대금이 부족한 종목. 조건이 생길 때까지 대기하도록 표현한다.

### 화면 구성 후보

- 상단: 거래소 선택 또는 통합 보기. 초기에는 업비트/빗썸 탭으로 단순하게 시작한다.
- 요약: 오늘 KRW 현물 시장의 거래대금, 강세 종목 수, 과열 종목 수.
- 리스트: 종목명, 현재가, 등락률, 거래대금, 후보 태그, 리스크 태그.
- 상세: 선택 종목의 캔들, 거래대금 변화, 다음 확인 조건.
- 필터: 거래대금 상위, 상승률 상위, 눌림, 과열, 관망.

### 문구 원칙

- "추천", "매수", "진입", "수익 가능" 표현을 쓰지 않는다.
- "관심 후보", "확인 필요", "거래대금 동반 여부", "과열 주의", "지지 유지 확인"을 사용한다.
- 상승률 상위 종목은 좋은 종목이 아니라 변동성이 커진 종목으로 설명한다.
- 눌림 후보는 진입 후보가 아니라 조건 확인 후보로 설명한다.

### 구현 리스크

- 거래소별 등락률 기준과 거래대금 기준이 다를 수 있다.
- public API rate limit과 장애 대응이 필요하다.
- 동일 티커라도 거래소별 가격과 거래대금이 다를 수 있다.
- 김프, 환율, 선물 펀딩비와 섞어 해석하면 현물 화면이 복잡해질 수 있으므로 MVP에서는 KRW 현물 데이터 중심으로 제한한다.
- 특정 코인을 추천하는 것처럼 보이지 않도록 정렬명과 CTA 문구를 조심해야 한다.

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

## 구현 1단계 후보 선정

설계 run 이후 첫 실제 구현은 작고 되돌리기 쉬운 작업부터 시작한다. route 신설, API adapter, push targetPath 변경은 영향 범위가 커서 첫 단계로 두지 않는다.

### 후보 비교

| 후보 | 장점 | 리스크 | 1단계 적합도 |
| --- | --- | --- | --- |
| 시장 선택 화면 큰 외곽 박스 제거 | 앱 구조 변경 없이 첫 인상과 공간감을 개선할 수 있음 | 시각 회귀만 확인하면 됨 | 높음 |
| 마지막 사용 시장 기억 | 반복 진입성이 좋아짐 | localStorage, redirect, 기본 시작 정책 결정 필요 | 중간 |
| Coin Radar 홈 MVP skeleton | 제품 방향을 가장 직접적으로 보여줌 | `/crypto` 역할 변경과 기존 BTC/ETH 레이더 충돌 가능 | 중간 |
| 현물 레이더 API adapter 설계 | 현물 레이더 기반 마련 | public API rate limit, 서버 route, 데이터 정규화 필요 | 낮음 |

### 선정 후보

첫 구현 후보는 "시장 선택 화면 큰 외곽 박스 제거"다.

선정 이유:

- 앱 코드 영향이 시장 선택 화면 UI에 제한된다.
- route, FCM, push-cron, Android intent, 결제, Supabase, Pro gating에 닿지 않는다.
- Global Radar 독립 진입 동선을 유지한 채 Coin Radar/Global Radar를 더 가볍게 보여줄 수 있다.
- 구현 후 모바일 340px/360px와 데스크톱 첫 화면만 확인하면 회귀 범위를 좁힐 수 있다.

### 구현 범위 초안

- 시장 선택 화면에서 화면 전체를 감싸는 큰 외곽 테두리 또는 중첩 카드 느낌을 줄인다.
- Coin Radar와 Global Radar 선택 영역은 유지한다.
- Global Radar 설명을 코인 보조 매크로처럼 축소하지 않는다.
- Pro, Learn, 정책 링크는 주 동선보다 낮은 우선순위로 둔다.
- route 이동, 마지막 사용 시장 저장, `/spot`, `/macro` 신규 route는 포함하지 않는다.

### 검증 후보

- `git diff --check`
- `cmd /c npx tsc --noEmit`
- `npm.cmd run build`
- `npm.cmd run smoke:mobile`
- `npm.cmd run smoke:all`
- 시장 선택 화면 340px/360px 모바일 확인
- Coin Radar와 Global Radar 진입 링크 확인

### 다음 active run 제안

설계 run이 완료되면 별도 구현 active run을 생성한다.

추천 run 이름: `coin-radar-market-selection-ui-run`

첫 작업 후보:

- 시장 선택 화면 큰 외곽 박스 제거.
- Coin Radar/Global Radar 선택 영역 간격과 우선순위 조정.
- 모바일 340px/360px overflow 확인.
- 코드 변경은 이 별도 구현 run에서만 진행한다.

## 시장 선택 화면 현재 구조 조사

현재 시장 선택 화면은 `src/app/page.tsx`에서 `HomeEntryGate`를 렌더링하고, 실제 시장 선택 UI는 `src/components/HomeEntryGate.tsx`의 `MarketSelector`가 담당한다.

### 렌더링 흐름

- `src/app/page.tsx`: 첫 진입 페이지이며 `<HomeEntryGate />`만 렌더링한다.
- `HomeEntryGate`: 스플래시, 로그인 선택, Basic 둘러보기 상태를 처리한 뒤 `MarketSelector`를 렌더링한다.
- `MarketSelector`: Coin Radar와 Global Radar 선택 화면을 구성한다.
- `marketEntries`: Coin Radar는 `/crypto`, Global Radar는 `/global`로 연결한다.

### 큰 외곽 박스를 만드는 구조

- `MarketSelector`의 최상위 `main`은 전체 viewport를 grid로 중앙 정렬한다.
- 그 안의 `section`이 `enterprise-panel`, `max-w-5xl`, `rounded-2xl`, `p-3 sm:p-6 lg:p-10`, `overflow-hidden`을 가진다.
- 이 `section`이 화면 전체를 감싸는 큰 외곽 패널처럼 보이는 핵심 wrapper다.
- 모바일에서는 `w-[calc(100vw-1.5rem)]`와 `-translate-y-[6dvh]`가 적용되어 첫 화면 안에 패널을 압축해 넣는다.

### 중첩 카드 느낌을 만드는 구조

- `section.enterprise-panel` 내부에 Coin Radar와 Global Radar 선택 `Link` 카드 2개가 있다.
- 각 `Link`는 `rounded-2xl`, `border border-white/10`, `bg-white/[0.035]`, hover shadow를 가진다.
- 결과적으로 "큰 외곽 enterprise-panel + 내부 선택 카드 2개"의 중첩 카드 구조가 된다.
- 개별 선택 카드는 유지 대상이며, 다음 구현에서는 큰 외곽 wrapper만 제거하거나 약화하는 것이 범위에 맞다.

### 다음 구현에서 건드릴 후보

- `MarketSelector`의 `section.enterprise-panel`을 제거하거나 배경/테두리/패딩을 약화한다.
- `main`의 중앙 정렬과 viewport 높이 정책은 유지하되, 모바일 공간을 더 넓게 쓰도록 내부 wrapper를 단순화한다.
- Coin Radar와 Global Radar `Link` 카드, href(`/crypto`, `/global`), 문구, 진입 동선은 유지한다.

### 다음 구현에서 건드리지 않을 것

- route 변경 없음.
- 마지막 사용 시장 기억 구현 없음.
- `/spot`, `/home`, `/macro` 신규 route 없음.
- Global Radar 진입 제거 없음.
- 결제, 인증, 푸시, Android, Supabase, production 변경 없음.

## 시장 선택 화면 외곽 박스 제거 결과

구현 커밋: `14e08f0 Remove market selection outer panel`

### 변경 결과

- `src/components/HomeEntryGate.tsx`의 `MarketSelector`에서 큰 외곽 `section.enterprise-panel` wrapper를 제거했다.
- 기존 `enterprise-panel`, 외곽 border, rounded panel, 큰 padding, overflow hidden 구조를 걷어내고, 단순한 full-width section wrapper로 바꿨다.
- Coin Radar와 Global Radar 선택 `Link` 카드는 유지했다.
- Coin Radar 진입 href `/crypto`와 Global Radar 진입 href `/global`은 유지했다.
- route, 마지막 사용 시장 기억, 하단 탭, 신규 route는 구현하지 않았다.

### 확인 결과

- 340px 시장 선택 화면에서 가로 overflow 없음.
- 360px 시장 선택 화면에서 가로 overflow 없음.
- 시장 선택 화면에서 `section.enterprise-panel`이 더 이상 존재하지 않음을 확인했다.
- Coin Radar `/crypto` 진입 확인.
- Global Radar `/global` 진입 확인.

### 검증 결과

- `git diff --check` 통과.
- `cmd /c npx tsc --noEmit` 통과.
- `npm.cmd run build` 통과.
- `npm.cmd run smoke:mobile` 통과.
- `npm.cmd run smoke:all` 통과.

### 남은 후보

- 마지막 사용 시장 기억은 이번 run에서 구현하지 않았으며, 별도 구현 run 후보로 남긴다.
- Coin Radar 홈 MVP skeleton, 현물 레이더 API adapter, 하단 탭 구조 구현은 별도 active run에서 다룬다.

## 시장 선택 화면 평면화 추가 결과

구현 커밋: `Flatten market selection screen`

### 변경 결과

- Coin Radar / Global Radar 선택 영역의 개별 카드 느낌을 줄였다.
- 선택 항목의 두꺼운 border, 강한 background, hover shadow, 중첩 rounded panel, 아이콘 프레임을 제거하거나 약화했다.
- 선택 UI를 카드 2개가 아니라 얇은 divider로 구분되는 플랫한 선택 행에 가깝게 조정했다.
- 설명 문구를 짧게 줄여 모바일 첫 화면의 밀도를 낮췄다.
- `/crypto`, `/global` 진입 링크는 유지했다.

### 유지한 범위

- route 변경 없음.
- 마지막 사용 시장 기억 구현 없음.
- 하단 탭 구현 없음.
- `/spot`, `/home`, `/macro` 신규 route 없음.
- Global Radar 진입 제거 없음.
- 결제, 인증, Supabase, Android, FCM, production 변경 없음.

## /crypto 본 화면 평면화 결과

구현 커밋: `Flatten crypto radar screen panels`

### 변경 결과

- `/crypto` 본문 큰 외곽 패널을 제거하고 화면 폭을 더 넓게 쓰도록 조정했다.
- 상단 코인 탭은 두꺼운 박스 버튼 대신 active 밑줄 중심의 얇은 탭으로 바꿨다.
- crypto 상단 내비게이션과 macro ticker compact UI는 카드형 배경, shadow, rounded 느낌을 줄이고 divider 중심으로 약화했다.
- Radar Insight summary variant는 중첩 PanelCard 대신 divider 기반 리포트형 섹션으로 바꿨다.
- 차트 wrapper와 판단 근거 요약은 `/crypto`에서 rounded card/border/background를 줄이고, thin divider와 typography 중심으로 정리했다.
- 하단 timeframe/mode control은 fixed 위치와 기능은 유지하되 큰 floating panel 느낌을 줄였다.

### 유지한 범위

- `/crypto` route 유지.
- `/majors` 호환/redirect 변경 없음.
- BTC/ETH 전환 유지.
- 5m/15m/1h/4h/1d 전환 유지.
- 종합/ICT 구조/기술지표 전환 유지.
- Basic/Pro gating 및 판단 로직 변경 없음.
- chart rendering, API fetch 변경 없음.
- `/global` 화면 변경 없음.

## 제품 구조 최신 결정

ChartRadar는 계속 Coin Radar와 Global Radar를 동등한 상위 시장 모드로 유지한다.

### 유지 원칙

- Global Radar를 버리지 않는다.
- Global Radar를 코인 보조 매크로로 격하하지 않는다.
- Global Radar는 해외주식/해외선물 사용자용 독립 레이더로 유지한다.
- 단기 개선 우선순위는 Coin Radar UX와 전체 boxless 디자인 완성이다.

### Coin Radar 내부 구조 후보

Coin Radar는 홈 / 현물 / 선물 / 매크로 / 복기 구조를 기준으로 검토한다.

- 홈: 대표 코인의 방향성, 점수, 리스크, 다음 확인 조건을 즉시 보여준다.
- 현물: 업비트/빗썸 KRW 현물 시장에서 거래대금 급증, 과열, 눌림, 관심 후보를 판단 보조 문구로 정리한다.
- 선물: 기존 `/crypto`와 `/alts`를 메이저 BTC/ETH와 알트 구조로 자연스럽게 묶는다.
- 매크로: 코인 판단 보조용 압축 신호만 제공한다.
- 복기: 기존 `/journal` 역할을 유지한다.

RSI, 스토캐스틱, 트렌드는 선택 코인이 아니라 BTC 기준 시장 체력 지표로 다룬다.

### Global Radar 강화 방향

Global Radar는 이후 별도 축으로 강화한다.

- 미국장 30초 체크.
- Risk-On / Neutral / Risk-Off.
- NQ/ES 방향 압력.
- 주도 섹터와 주도 종목.
- VIX, 금리, 달러 리스크.
- CPI/FOMC 등 이벤트 전후 변동성 경고.

Global Radar는 Coin Radar 내부 매크로와 목적이 다르므로 route, 문구, BM 구조에서 독립성을 유지한다.
