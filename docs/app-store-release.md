# Chart Radar 앱스토어 출시 준비 가이드

이 문서는 Chart Radar를 5월 안에 App Store와 Google Play에 정식 출시하기 위한 제출 자료 초안입니다. 실제 등록 전에는 사업자 정보, 고객지원 이메일, 개인정보 처리 항목을 최종 운영 값으로 바꿉니다.

## 1. 앱 기본 정보 초안

| 항목 | 권장 값 |
| --- | --- |
| 앱 이름 | Chart Radar |
| 부제 | 시장 구조와 위험 신호를 빠르게 확인하는 AI 레이더 |
| 카테고리 | Finance |
| 연령 등급 | 투자 정보와 금융 데이터가 포함되므로 성인 사용자 기준으로 점검 |
| 지원 언어 | 한국어 우선 |
| 고객지원 URL | `https://your-domain.kr` |
| 개인정보처리방침 URL | `https://your-domain.kr/privacy` |
| 이용약관 URL | `https://your-domain.kr/terms` |

## 2. 앱 소개 문구 초안

Chart Radar는 코인과 글로벌 시장을 빠르게 점검할 수 있는 시장 분석 앱입니다. 실시간 시세, ICT 구조 판독, 기술지표 레이더, 청산 압력 추정, AI 뉴스 브리핑, 관심종목 알림을 통해 사용자가 매일 시장을 확인할 이유를 만들어줍니다.

Chart Radar는 매수·매도 신호를 대신 내려주는 앱이 아닙니다. 사용자가 차트 구조, 변동성, 시장 뉴스, 위험 요소를 더 빠르게 정리할 수 있도록 돕는 분석 보조 도구입니다.

## 3. 키워드 초안

```text
차트, 코인, 비트코인, 이더리움, 글로벌시장, 투자분석, 기술지표, ICT, 레이더, AI뉴스, 트레이딩, 알림
```

## 4. 스크린샷 구성

스토어 첫인상은 기능 나열보다 사용 장면이 더 중요합니다. 아래 순서로 캡처합니다.

1. 홈 관제실.
   - 시장 온도, 거래대금 중심, 오늘의 레이더 노트가 보이는 화면.
2. BTC / ETH 레이더.
   - 코인 선택, 타임프레임, ICT / 기술지표 전환이 보이는 화면.
3. 알트코인 레이더.
   - 전체 알트 중 강한 감지 후보를 찾는 화면.
4. 글로벌 레이더.
   - 주요 미국 주식, 지수, ETF, 섹터 요약이 보이는 화면.
5. 레이더뉴스.
   - 매크로 전광판과 AI 시장 브리핑이 함께 보이는 화면.
6. 알림 센터.
   - Pro 가치가 되는 조건 알림 설정 화면.
7. Pro 구독.
   - 월간, 연간 플랜과 제공 가치가 한눈에 보이는 화면.

라이트 모드와 다크 모드가 모두 있지만 스토어 스크린샷은 다크 모드 중심으로 통일하는 편이 브랜드 아이콘과 더 잘 맞습니다.

## 5. 개인정보 라벨 초안

실제 수집 항목은 최종 구현 기준으로 다시 점검해야 합니다. 현재 앱 기준으로는 아래 항목을 예상합니다.

| 항목 | 사용 목적 | 비고 |
| --- | --- | --- |
| 이메일 | 로그인과 계정 식별 | Google 로그인 사용 시 수집 |
| 사용자 ID | 복기, 관심종목, 사용량 연결 | Supabase 계정 ID |
| 관심종목 | 개인화된 레이더 화면 | 사용자가 직접 저장 |
| 매매 복기 | 사용자의 기록 저장 | 사용자가 직접 입력 |
| 사용량 기록 | 무료 체험과 Pro 전환 안내 | 기능 사용 횟수 |
| 결제 상태 | Pro 권한 확인 | 웹 결제 또는 앱스토어 구독 |

정확한 위치 정보, 연락처, 건강 정보, 광고 추적 ID는 현재 제품 방향상 수집하지 않는 것이 좋습니다.

## 6. 구독 상품 심사 체크

App Store Connect에 아래 상품을 만듭니다.

| 상품 | 상품 ID | 표시 이름 |
| --- | --- | --- |
| 코인 월간 | `chart_radar_crypto_monthly` | Chart Radar Coin 월간 |
| 코인 연간 | `chart_radar_crypto_yearly` | Chart Radar Coin 연간 |
| 글로벌 월간 | `chart_radar_global_monthly` | Chart Radar Global 월간 |
| 글로벌 연간 | `chart_radar_global_yearly` | Chart Radar Global 연간 |
| 올마켓 월간 | `chart_radar_bundle_monthly` | Chart Radar All Market 월간 |
| 올마켓 연간 | `chart_radar_bundle_yearly` | Chart Radar All Market 연간 |

구독 설명에는 아래 내용을 포함합니다.

- 전체 코인 레이더 감지.
- 글로벌 레이더 확장.
- AI 브리핑 사용량 확대.
- 관심종목과 조건 알림.
- 반복 확인용 시장 관제실.

구독은 앱스토어 계정에서 해지할 수 있다는 문구를 반드시 포함합니다.

## 7. 심사 메모 초안

아래 내용은 App Review 메모에 넣을 수 있는 초안입니다.

```text
Chart Radar is a market analysis and education tool. It provides market structure summaries, technical indicator dashboards, AI news briefings, watchlists, and alert settings for crypto and selected US stocks. It does not execute trades, connect to exchanges for trading, or provide guaranteed buy/sell signals. Subscription unlocks higher usage limits and advanced analysis screens.
```

테스트 계정이 필요하면 심사용 Google 계정을 하나 만들고, Pro 권한이 필요한 경우 임시 테스트 권한을 부여합니다.

## 8. 제출 전 최종 확인

아래 항목이 모두 준비되어야 앱 심사 지연을 줄일 수 있습니다.

- `NEXT_PUBLIC_SITE_URL`이 실제 도메인으로 설정되어 있음.
- `/privacy`, `/terms`, `/refund`가 운영 정보로 채워져 있음.
- 앱 아이콘이 1024px 정사각형 기준으로 깨지지 않음.
- 모바일 Safari와 Android Chrome에서 결제, 로그인, 주요 페이지가 열림.
- iOS 앱에서는 디지털 구독 결제가 App Store IAP로 연결됨.
- 웹에서는 `NEXT_PUBLIC_PRO_PAYMENT_URL`이 실제 결제 링크로 연결됨.
- 알림 기능은 브라우저 알림 권한 요청 실패 시에도 앱이 멈추지 않음.
- AI API 호출 제한이 켜져 있음.
- 앱 설명에 수익 보장, 매수 신호, 자동매매처럼 오해될 표현이 없음.
# 2026-05-11 App Store 상품 ID 최신 구조.

정식 출시용 구독 상품은 코인, 글로벌, 올마켓으로 나눕니다.

| 상품 | 상품 ID | 표시 이름 |
| --- | --- | --- |
| Crypto 월간 | `chart_radar_crypto_monthly` | Chart Radar Crypto 월간 |
| Crypto 연간 | `chart_radar_crypto_yearly` | Chart Radar Crypto 연간 |
| Global 월간 | `chart_radar_global_monthly` | Chart Radar Global 월간 |
| Global 연간 | `chart_radar_global_yearly` | Chart Radar Global 연간 |
| Bundle 월간 | `chart_radar_bundle_monthly` | Chart Radar All Market 월간 |
| Bundle 연간 | `chart_radar_bundle_yearly` | Chart Radar All Market 연간 |

기존 `chart_radar_pro_monthly`, `chart_radar_pro_yearly`는 이전 설계 메모로만 남기고 새 상품 생성에는 사용하지 않습니다.
