# Chart Radar 앱스토어 출시 준비 가이드

이 문서는 Chart Radar를 Google Play와 App Store에 제출하기 전에 필요한 등록 자료와 점검 순서를 정리합니다. 실제 등록 전에는 사업자 정보, 고객센터 이메일, 개인정보 처리 항목, 가격, 환불 기준을 운영 값으로 다시 확인해야 합니다.

## 1. 앱 기본 정보

| 항목 | 권장 값 |
| --- | --- |
| 앱 이름 | Chart Radar |
| 패키지명 | `com.staronlabs.chartradar` |
| 카테고리 | Finance |
| 지원 언어 | 한국어 우선 |
| 고객센터 URL | `https://your-domain.kr` |
| 개인정보 처리방침 URL | `https://your-domain.kr/privacy` |
| 이용약관 URL | `https://your-domain.kr/terms` |
| 계정·데이터 삭제 안내 URL | `https://your-domain.kr/account/delete` |
| 구독 해지와 환불 안내 URL | `https://your-domain.kr/refund` |

## 2. 스토어 소개 문구

Chart Radar는 코인과 글로벌 시장을 빠르게 점검하는 시장 분석 앱입니다. 실시간 시세, ICT 구조 판독, 기술지표 레이더, 청산 압력 추정, AI 뉴스 브리핑, 관심종목, 알림 설정을 한 화면 흐름으로 묶어 매일 시장을 확인할 이유를 만들어 줍니다.

Chart Radar는 매수·매도 신호를 보장하거나 자동매매를 실행하지 않습니다. 사용자가 시장 구조, 변동성, 주요 일정, 위험 요소를 더 빠르게 정리하도록 돕는 분석 보조 도구입니다.

## 3. 키워드 초안

```text
차트, 코인, 비트코인, 이더리움, 글로벌시장, 미국주식, 투자분석, 기술지표, ICT, AI뉴스, 트레이딩, 알림
```

## 4. 스크린샷 구성

스토어 첫인상은 기능 나열보다 사용 장면이 중요합니다. 아래 순서로 캡처합니다.

1. 시장 선택 홈.
   - 코인과 글로벌 시장이 분리되어 보이는 첫 화면.
2. 코인 레이더.
   - Majors, 타임프레임, 종합 / ICT / 기술지표 전환이 보이는 화면.
3. 알트코인 레이더.
   - 여러 코인 중 강한 후보를 찾는 화면.
4. 글로벌 레이더.
   - 주요 미국주식, ETF, 선물 대체 지표 요약이 보이는 화면.
5. 레이더 뉴스.
   - 매크로 일정과 AI 시장 브리핑이 함께 보이는 화면.
6. 알림 센터.
   - Pro 가치가 보이는 조건 알림 설정 화면.
7. Pro 구독.
   - Coin Pro, Global Pro, All Market Pro 가격과 가치가 보이는 화면.

다크 모드 이미지를 중심으로 준비하고, 라이트 모드는 보조 스크린샷으로 사용합니다.

## 5. 개인정보 라벨 초안

| 항목 | 사용 목적 | 비고 |
| --- | --- | --- |
| 이메일 | 로그인과 계정 식별 | Google 로그인 사용 시 수집 |
| 사용자 ID | 복기, 관심종목, 구독 권한 연결 | Supabase 계정 ID |
| 관심종목 | 개인화된 레이더 화면 제공 | 사용자가 직접 저장 |
| 매매 복기 | 사용자가 입력한 기록 저장 | 사용자가 직접 입력 |
| 사용량 기록 | Free 기준과 Pro 권한 안내 | 기능 사용 횟수 |
| 결제 상태 | Pro 권한 확인 | 웹 결제 또는 앱 구독 |

현재 제품 방향에서는 정확한 위치 정보, 연락처, 건강 정보, 광고 추적 ID를 수집하지 않는 편이 좋습니다.

## 6. Google Play 구독 상품

Google Play Console에는 아래 상품 ID를 그대로 만듭니다. 코드의 `src/lib/billing.ts`에 들어 있는 `appStoreProductId`와 반드시 같아야 합니다.

| 상품 | 상품 ID | 표시 이름 |
| --- | --- | --- |
| Coin Pro 월간 | `chart_radar_crypto_monthly` | Chart Radar Coin Pro 월간 |
| Coin Pro 연간 | `chart_radar_crypto_yearly` | Chart Radar Coin Pro 연간 |
| Global Pro 월간 | `chart_radar_global_monthly` | Chart Radar Global Pro 월간 |
| Global Pro 연간 | `chart_radar_global_yearly` | Chart Radar Global Pro 연간 |
| All Market Pro 월간 | `chart_radar_bundle_monthly` | Chart Radar All Market Pro 월간 |
| All Market Pro 연간 | `chart_radar_bundle_yearly` | Chart Radar All Market Pro 연간 |

## 7. RevenueCat 연결 순서

1. RevenueCat 프로젝트 이름은 `Chart Radar`로 둡니다.
2. Android 앱은 패키지명 `com.staronlabs.chartradar`로 추가합니다.
3. Google Play Console 신원 확인이 끝나면 Google Play 앱과 RevenueCat을 연결합니다.
4. 위 6개 상품 ID를 RevenueCat Product catalog에 등록합니다.
5. Entitlement는 아래처럼 분리합니다.
   - Coin Pro는 `coin_pro`.
   - Global Pro는 `global_pro`.
   - All Market Pro는 `all_market_pro`.
6. Offering은 기본값 하나로 시작해도 되지만, 상품은 월간과 연간을 모두 포함해야 합니다.
7. RevenueCat의 Android Public SDK key를 `.env.local`과 배포 환경변수의 `NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY`에 넣습니다.
8. RevenueCat Secret API key를 `REVENUECAT_REST_API_KEY`에 넣습니다.

### RevenueCat 화면에서 키를 찾는 법

RevenueCat에는 키가 두 종류라서 헷갈리기 쉽습니다.

| 필요한 값 | RevenueCat 위치 | Chart Radar 환경변수 |
| --- | --- | --- |
| Android Public SDK key | 왼쪽 메뉴 `Apps & providers` → `API keys` → `SDK API keys` 영역의 Android 앱 행에서 `Show key` | `NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY` |
| Secret API key | 왼쪽 메뉴 `Apps & providers` → `API keys` → `Secret API keys` 영역의 `+ New secret API key` | `REVENUECAT_REST_API_KEY` |

`Test Store`만 있는 상태에서는 Android 앱 키가 아니라 테스트용 SDK 키만 보일 수 있습니다. Google Play Console 앱을 만든 뒤 RevenueCat에 Android 앱을 추가해야 `com.staronlabs.chartradar`용 Public SDK key를 받을 수 있습니다.

Secret API key는 서버에서 구독 상태를 확인할 때만 씁니다. 이 값은 `.env.local`과 배포 서버 환경변수에만 넣고, 앱 코드나 브라우저 코드에는 넣지 않습니다.

## 7-1. Android 앱 푸시 연결 순서

1. Firebase Console에서 Android 앱 `com.staronlabs.chartradar`를 추가합니다.
2. Firebase에서 받은 `google-services.json`을 `android/app/google-services.json`에 둡니다. 이 파일은 저장소에 커밋하지 않습니다.
3. Supabase SQL Editor에서 `supabase/migrations/20260519_push_tokens.sql`을 적용합니다.
4. 배포 서버 환경변수에 아래 중 하나를 설정합니다.
   - `FIREBASE_SERVICE_ACCOUNT_JSON`
   - 또는 `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
5. Vercel 환경변수에 `CRON_SECRET`을 설정합니다. Vercel Cron은 이 값을 `Authorization` 헤더로 보내며 `/api/push-cron`이 검증합니다.
6. Android 앱에서 알림 화면을 열고 `앱 푸시 켜기`를 눌러 FCM 토큰이 발급되는지 확인합니다.
7. 로그인 상태에서 `테스트 발송`을 눌러 실제 Android 알림 수신을 확인합니다.
8. Vercel Cron Jobs에서 `/api/push-cron`이 5분마다 실행되는지 확인합니다. 이 작업은 저장한 레이더 조건, A급 코인 감지, 청산 압력, 뉴스/매크로, 글로벌 모멘텀을 서버에서 다시 확인해 조건이 맞으면 앱 푸시를 보냅니다.

로컬에 키를 넣을 때는 아래 명령을 쓰면 `.env.local`에 필요한 줄만 안전하게 반영됩니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/set-app-billing-env.ps1
```

입력이 끝난 뒤 아래 명령으로 기본 설정을 확인합니다.

```powershell
npm run check:app-billing
```

## 8. 심사 메모 초안

```text
Chart Radar is a market analysis and education tool. It provides market structure summaries, technical indicator dashboards, AI news briefings, watchlists, and alert settings for crypto and selected global markets. It does not execute trades, connect to exchanges for trading, or provide guaranteed buy/sell signals. Subscriptions unlock higher usage limits and advanced analysis screens.
```

테스트 계정이 필요하면 Google 계정 하나를 심사용으로 만들고, 필요 시 Supabase에서 임시 Pro 권한을 부여합니다.

## 9. 제출 전 최종 점검

- `NEXT_PUBLIC_SITE_URL`이 실제 도메인으로 설정되어 있습니다.
- `/privacy`, `/terms`, `/account/delete`, `/refund`가 실제 운영 정보로 채워져 있습니다.
- 앱 아이콘은 1024px 정사각형 기준으로 깨지지 않습니다.
- 모바일 Chrome과 Android 앱에서 로그인, Pro 화면, 뉴스, 알림, 주요 레이더 화면이 열립니다.
- Android 앱에서는 Google Play 구독 결제가 RevenueCat으로 연결됩니다.
- 결제 성공 후 `/api/billing/app-store/sync`가 RevenueCat 구독 상태를 확인하고 Supabase 권한을 반영합니다.
- `TOSS_PAYMENTS_SECRET_KEY`와 `SUPABASE_SERVICE_ROLE_KEY`는 서버 환경변수에만 들어 있습니다.
- AI API와 스캐너 API의 호출 제한이 켜져 있습니다.
- 앱 설명에 수익 보장, 확정 매수 신호, 자동매매처럼 오해될 표현이 없습니다.
