# Chart Radar 결제 출시 연결 가이드

이 문서는 Chart Radar를 유료 서비스로 운영하기 전에 결제, 구독, 권한 반영, 환경변수를 점검하기 위한 운영 가이드입니다.

## 1. 결제 상품 구조

Chart Radar는 코인과 글로벌 시장을 별도 판단 도구로 운영합니다.

| 상품 | 월간 출시가 | 장기권 출시가 | 권한 범위 |
| --- | --- | --- | --- |
| Coin Pro | 29,000원 | 290,000원 / 1년 | BTC/ETH 판단, 알트 기회/위험 필터, 코인 상세 조건, 무효화 기준, 상세 리스크 |
| Global Pro | 19,000원 | 190,000원 / 1년 | 미국장 30초 체크, 지수선물 판단, 매크로 압력, 이벤트 리스크, 섹터 로테이션, 대장주 레이더 |
| All Market Pro | 39,000원 | 199,000원 / 6개월 | Coin Pro + Global Pro 통합, 코인과 글로벌 전체 시장 판단 |

위 금액은 대표 확정 출시가 기준입니다. 앱 내부 `billingAmount`, 웹 결제 링크 금액, Google Play Console 기본 요금제 가격, RevenueCat 상품 표시 가격은 같은 금액으로 맞춰야 합니다. All Market Pro의 내부 legacy plan id가 `bundle_yearly`로 남아 있을 수 있지만, 사용자 화면과 Store 상품은 All Market Pro 6개월 구독 기준으로 설명합니다.

## 2. 웹 결제 환경변수

웹 결제 버튼은 `/api/billing/checkout`을 거쳐 상품별 결제 링크로 이동합니다. 운영 환경에서는 상품별 URL을 우선 사용합니다.

```env
NEXT_PUBLIC_CRYPTO_MONTHLY_PAYMENT_URL=https://your-crypto-monthly-link.example
NEXT_PUBLIC_CRYPTO_YEARLY_PAYMENT_URL=https://your-crypto-yearly-link.example
NEXT_PUBLIC_GLOBAL_MONTHLY_PAYMENT_URL=https://your-global-monthly-link.example
NEXT_PUBLIC_GLOBAL_YEARLY_PAYMENT_URL=https://your-global-yearly-link.example
NEXT_PUBLIC_BUNDLE_MONTHLY_PAYMENT_URL=https://your-bundle-monthly-link.example
NEXT_PUBLIC_BUNDLE_6MONTH_PAYMENT_URL=https://your-bundle-6month-link.example
```

아래 값은 과거 호환 fallback입니다. 정식 출시 설정에서는 상품별 URL을 우선 사용합니다.

```env
NEXT_PUBLIC_PRO_PAYMENT_URL=
NEXT_PUBLIC_PRO_MONTHLY_PAYMENT_URL=
NEXT_PUBLIC_PRO_YEARLY_PAYMENT_URL=
NEXT_PUBLIC_STOCKS_MONTHLY_PAYMENT_URL=
NEXT_PUBLIC_STOCKS_YEARLY_PAYMENT_URL=
```

`NEXT_PUBLIC_STOCKS_*`는 이전 이름 호환용입니다. 새 설정에서는 `NEXT_PUBLIC_GLOBAL_*`를 사용합니다.

## 3. 결제 승인과 권한 반영

현재 웹 결제 흐름은 아래와 같습니다.

1. 사용자가 `/pro`에서 상품을 선택합니다.
2. `/api/billing/checkout`이 로그인 세션을 확인하고 결제 URL을 반환합니다.
3. 결제가 성공하면 결제사가 `/checkout/success`로 돌아옵니다.
4. 성공 URL에는 `paymentKey`, `orderId`, `amount`가 포함되어야 합니다.
5. `/checkout/success`가 `/api/billing/confirm`을 호출합니다.
6. `/api/billing/confirm`은 토스페이먼츠 승인 API로 결제를 다시 확인합니다.
7. 결제 금액과 주문번호가 맞으면 Supabase의 `profiles.plan`과 `subscriptions` 권한을 갱신합니다.

서버 전용 환경변수는 아래 값이 필요합니다.

```env
TOSS_PAYMENTS_SECRET_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`TOSS_PAYMENTS_SECRET_KEY`가 없으면 결제 승인 확인이 보류됩니다. `SUPABASE_SERVICE_ROLE_KEY`가 없으면 결제가 확인되어도 Pro 권한 자동 반영이 보류됩니다.

## 4. Android 앱 구독 결제

Android 앱에서는 웹 결제 링크를 사용하지 않고 Google Play 구독을 사용합니다. 앱의 Pro 화면은 Capacitor native 환경에서 RevenueCat SDK 구매 흐름으로 전환됩니다.

필요 환경변수는 아래와 같습니다.

```env
NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY=
NEXT_PUBLIC_REVENUECAT_IOS_API_KEY=
REVENUECAT_REST_API_KEY=
```

`NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY`는 SDK 공개 키입니다. `REVENUECAT_REST_API_KEY`는 서버 검증용 비밀 키이므로 브라우저에 노출하면 안 됩니다.

Google Play Console과 RevenueCat에는 아래 상품 ID와 기본 요금제 ID를 동일하게 등록합니다.

| 상품 | 상품 ID | 기본 요금제 ID |
| --- | --- | --- |
| Coin Pro 월간 | `chart_radar_crypto_monthly` | `monthly` |
| Coin Pro 연간 | `chart_radar_crypto_yearly` | `year-1` |
| Global Pro 월간 | `chart_radar_global_monthly` | `monthly` |
| Global Pro 연간 | `chart_radar_global_yearly` | `yearly-1` |
| All Market Pro 월간 | `chart_radar_bundle_monthly` | `monthly` |
| All Market Pro 6개월 | `chart_radar_bundle_6month` | `month-6` |

구매 성공 후 서버는 `/api/billing/app-store/sync`에서 RevenueCat 구독 상태를 확인하고 Supabase 권한을 갱신합니다.

## 5. 현재 라우팅 기준

결제와 출시 문서에서 사용하는 현재 주요 라우트는 아래 기준입니다.

```text
/
/crypto
/alts
/global
/global/assets
/news?market=crypto
/news?market=global
/alerts?market=crypto
/alerts?market=global
/journal?market=crypto
/journal?market=global
/learn
/login
/pro
/terms
/privacy
/account/delete
/refund
```

호환 라우트는 새 작업의 기준으로 쓰지 않습니다.

- `/majors`는 `/crypto`로 redirect됩니다.
- `/calculator`는 `/crypto`로 redirect됩니다.
- `/diagnosis`는 `/crypto`로 redirect됩니다.
- `/report`는 `/crypto`로 redirect됩니다.
- `/stocks`는 해외주식 통합 화면 호환 route입니다. 사용자 기준 주 진입점은 `/global`과 `/global/assets`입니다.
- `/settings`는 `/learn`으로 redirect됩니다. 실제 설정은 앱 내부 풀스크린 패널입니다.

## 6. 글로벌 화면 기준

- `/global`은 글로벌 시장흐름 대시보드입니다.
- `/global/assets`는 글로벌 자산레이더입니다.
- `/news?market=global`은 글로벌 일정, 이벤트, 뉴스 확인 흐름입니다.
- `/journal?market=global`은 글로벌 복기/저널 화면입니다.
- `/global/assets`에서만 자산레이더 하단 모바일 컨트롤이 표시되어야 합니다.

## 7. Android 앱 기준

Android 앱은 Capacitor WebView가 `https://chartradar.kr`을 여는 하이브리드 구조입니다.

```env
CAPACITOR_SERVER_URL=https://chartradar.kr
```

로컬 AAB 빌드 전에 아래를 확인합니다.

- `android/app/google-services.json`이 로컬에는 있고 Git에는 없는지 확인합니다.
- Android `versionCode`가 Play Console에 이미 올린 값보다 높은지 확인합니다.
- Google 네이티브 로그인과 FCM 토큰 저장이 동작하는지 확인합니다.
- 테스트 푸시 패널은 관리자 계정에만 보여야 합니다.

## 8. 정식 출시 전 확인 명령

```powershell
git diff --check
cmd /c npx tsc --noEmit
npm.cmd run build
npm.cmd run smoke:ops
npm.cmd run smoke:billing
npm.cmd run smoke:routes
npm.cmd run smoke:mobile
```

Android 빌드 전에는 아래 명령도 확인합니다.

```powershell
npm.cmd run check:app-billing
npm.cmd run app:sync
npm.cmd run app:android:debug
```
