# 코털스 생존진단 MVP

## 현재 완성 범위

- `/` 차트 판독
  - Binance USDT-M 선물 캔들 기준 `BTCUSDT.P`, `ETHUSDT.P`, `SOLUSDT.P`, `XRPUSDT.P`, `DOGEUSDT.P` 지원
  - 5m, 15m, 1h, 4h, 1d 타임프레임 버튼
  - 닫힌 봉 기준 / 진행 중 봉 포함 모드
  - MSB, CHoCH, OB, BB 후보, FVG/iFVG, Sweep, CISD, OTE, 프리미엄/디스카운트, 4H EMA200 판독
  - 선택 TF의 EMA200, OB 상하단, FVG/iFVG 상하단을 차트 가격선으로 표시
  - 무료판 기준 롱/숏/중립 우세, 위험 신호, 관찰 구간 제공
  - PRO 예정 카드로 진입 후보, 무효화 가격, 목표 후보, 손익비 예시는 잠금 안내

- `/diagnosis` 진입 진단
  - 사용자가 직접 입력하는 항목을 줄인 리스크 체크
  - 손절, 레버리지, 상위 추세, 현재 위치, 포지션 크기 계산

- `/calculator` 계산
  - 시드, 허용 손실률, 진입가, 손절가, 레버리지 기준 적정 명목가/증거금/손익비 계산

- `/journal` 복기
  - 브라우저 localStorage 기반 간단 복기 기록

- `/learn` 학습
  - MSB/CHoCH, OB/FVG, 프리미엄/디스카운트, 킬존 기준 요약

## 고정 기준

- 킬존은 뉴욕 시간 기준:
  - Asia 20:00-22:00
  - London 02:00-05:00
  - New York 07:00-12:00
- 구조 기준:
  - ZigZag length 5
  - MSB는 종가 돌파
  - CHoCH는 윅 돌파

## 검증

- `next build` 통과
- `tsc --noEmit --pretty false` 통과
- 로컬 라우트 확인:
  - `/`
  - `/diagnosis`
  - `/calculator`
  - `/journal`
  - `/learn`

## 다음에 붙이면 좋은 것

- TradingView Pine 지표와 웹 판독값을 캔들 단위로 더 정밀 비교하는 리플레이 테스트
- 무료 크레딧/일일 조회권 UI
- 실제 결제 전환 전용 페이지
- PRO용 진입 후보/무효화/목표가/손익비 계산 모듈
- 서버 저장형 복기 및 사용자별 히스토리
