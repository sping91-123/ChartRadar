# Chart Radar 결제 출시 연결 가이드

이 문서는 Chart Radar를 정식 유료 서비스로 공개하기 전에 웹 결제, 앱스토어 구독, 권한 반영, 환경변수를 빠르게 점검하기 위한 운영 가이드입니다.

## 1. 결제 상품 구조

Chart Radar는 코인과 글로벌 시장을 별도 앱처럼 운영합니다. 결제 상품도 아래 세 축으로 나눕니다.

| 상품 | 월간 가격 | 연간 가격 | 권한 범위 |
| --- | --- | --- | --- |
| Coin Pro | 14,900원 | 149,000원 | 코인 레이더, 코인 뉴스, 코인 알림, 코인 복기 |
| Global Pro | 14,900원 | 149,000원 | 글로벌 레이더, 글로벌 뉴스, 글로벌 알림, 글로벌 복기 |
| All Market Pro | 24,900원 | 249,000원 | 코인과 글로벌 전체 기능 |

월간 코인과 월간 글로벌을 따로 결제하면 29,800원이므로, 올마켓 월간 24,900원은 두 시장을 함께 보는 사용자를 위한 할인 상품입니다.

## 2. 웹 결제 환경변수

웹 결제 버튼은 `/api/billing/checkout`을 거쳐 상품별 결제 링크로 이동합니다. 운영 환경에서는 아래 여섯 개를 우선 입력합니다.

```env
NEXT_PUBLIC_CRYPTO_MONTHLY_PAYMENT_URL=https://your-crypto-monthly-link.example
NEXT_PUBLIC_CRYPTO_YEARLY_PAYMENT_URL=https://your-crypto-yearly-link.example
NEXT_PUBLIC_GLOBAL_MONTHLY_PAYMENT_URL=https://your-global-monthly-link.example
NEXT_PUBLIC_GLOBAL_YEARLY_PAYMENT_URL=https://your-global-yearly-link.example
NEXT_PUBLIC_BUNDLE_MONTHLY_PAYMENT_URL=https://your-bundle-monthly-link.example
NEXT_PUBLIC_BUNDLE_YEARLY_PAYMENT_URL=https://your-bundle-yearly-link.example
```

아래 값은 과거 호환용 fallback입니다. 정식 출시 설정에서는 상품별 URL을 우선 사용합니다.

```env
NEXT_PUBLIC_PRO_PAYMENT_URL=
NEXT_PUBLIC_PRO_MONTHLY_PAYMENT_URL=
NEXT_PUBLIC_PRO_YEARLY_PAYMENT_URL=
NEXT_PUBLIC_STOCKS_MONTHLY_PAYMENT_URL=
NEXT_PUBLIC_STOCKS_YEARLY_PAYMENT_URL=
```

`NEXT_PUBLIC_STOCKS_*`는 이전 이름 호환용입니다. 새 설정에서는 `NEXT_PUBLIC_GLOBAL_*`를 사용합니다.

## 3. 결제 승인과 권한 반영

현재 구현 흐름은 아래와 같습니다.

1. 사용자가 `/pro`에서 상품을 선택합니다.
2. `/api/billing/checkout`이 `plan`, `orderId`, `amount`를 결제 링크에 붙여 반환합니다.
3. 결제가 성공하면 결제사가 `/checkout/success`로 돌아옵니다.
4. 성공 URL에는 `paymentKey`, `orderId`, `amount`가 포함되어야 합니다.
5. `/checkout/success`가 `/api/billing/confirm`을 호출합니다.
6. `/api/billing/confirm`이 토스페이먼츠 승인 API로 결제를 다시 확인합니다.
7. 결제 금액과 주문번호가 맞으면 Supabase의 `profiles.plan`과 `subscriptions`를 갱신합니다.

서버 전용 환경변수는 아래 두 개가 필요합니다.

```env
TOSS_PAYMENTS_SECRET_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`TOSS_PAYMENTS_SECRET_KEY`가 없으면 결제 승인 확인은 보류됩니다. `SUPABASE_SERVICE_ROLE_KEY`가 없으면 결제는 확인되어도 Pro 권한 자동 반영이 보류됩니다.

두 값은 절대로 `NEXT_PUBLIC_` 이름으로 만들지 않습니다. 브라우저에 노출되면 안 되는 서버 전용 키입니다.

## Android 앱 구독 결제.

웹에서는 Toss 결제 링크를 사용하지만, Android 앱 안에서는 Google Play 구독을 사용합니다. 앱 심사에서 외부 결제 우회처럼 보이지 않도록 Pro 화면은 네이티브 앱 환경에서 RevenueCat SDK 구매 흐름으로 자동 전환됩니다.

필요한 환경변수는 아래와 같습니다.

```text
NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY=
NEXT_PUBLIC_REVENUECAT_IOS_API_KEY=
REVENUECAT_REST_API_KEY=
```

Google Play Console과 RevenueCat에는 아래 상품 ID를 동일하게 등록합니다.

```text
chart_radar_crypto_monthly
chart_radar_crypto_yearly
chart_radar_global_monthly
chart_radar_global_yearly
chart_radar_bundle_monthly
chart_radar_bundle_yearly
```

구매 성공 후 서버는 `/api/billing/app-store/sync`에서 RevenueCat 구독 상태를 확인하고 Supabase `profiles.plan`과 `subscriptions`를 갱신합니다. 이 단계가 성공해야 앱을 껐다 켜도 Pro 권한이 유지됩니다.

이미 구독한 사용자는 앱 Pro 화면의 구매 복원 버튼으로 RevenueCat 구독 상태를 다시 확인하고 같은 Supabase 계정에 Pro 권한을 재연결할 수 있습니다.

로컬에서 앱 결제 키를 안전하게 입력하고 누락 여부를 확인하려면 아래 명령을 사용합니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/set-app-billing-env.ps1
npm.cmd run check:app-billing
```

## 4. 앱스토어 구독 상품 ID

iOS 앱에서 디지털 구독을 판매하려면 Apple In-App Purchase를 사용해야 합니다. 웹 결제 링크를 iOS 앱 내부에서 디지털 구독 결제로 우회하면 심사 리스크가 큽니다.

App Store Connect에는 아래 상품 ID로 생성합니다.

| 상품 | 월간 상품 ID | 연간 상품 ID |
| --- | --- | --- |
| Coin Pro | `chart_radar_crypto_monthly` | `chart_radar_crypto_yearly` |
| Global Pro | `chart_radar_global_monthly` | `chart_radar_global_yearly` |
| All Market Pro | `chart_radar_bundle_monthly` | `chart_radar_bundle_yearly` |

이전 단일 Pro 상품 ID는 사용하지 않습니다.

## 5. 출시 전 필수 정책 페이지

현재 서비스 안에 기본 정책 페이지는 준비되어 있습니다.

| 페이지 | 경로 | 출시 전 확인할 내용 |
| --- | --- | --- |
| 이용약관 | `/terms` | 실제 사업자명, 서비스명, 결제 조건 |
| 개인정보처리방침 | `/privacy` | 실제 수집 항목, 보관 기간, 문의 이메일 |
| 구독 해지·환불 안내 | `/refund` | 웹 결제 환불 기준, 앱스토어 환불 기준 |

정식 출시 전에는 실제 사업자 정보, 고객 문의 이메일, 환불 처리 기준을 운영 값으로 바꿔야 합니다.

## 6. 운영 환경변수 체크리스트

운영 배포 전에 최소 아래 값을 확인합니다.

```env
NEXT_PUBLIC_SITE_URL=https://your-domain.kr
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=

GROQ_API_KEY=gsk_xxx
GROQ_MODEL=qwen/qwen3-32b
GEMINI_API_KEY=
NEWS_TRANSLATION_PROVIDER=
ENABLE_GEMINI_NEWS_FALLBACK=

NEXT_PUBLIC_CRYPTO_MONTHLY_PAYMENT_URL=
NEXT_PUBLIC_CRYPTO_YEARLY_PAYMENT_URL=
NEXT_PUBLIC_GLOBAL_MONTHLY_PAYMENT_URL=
NEXT_PUBLIC_GLOBAL_YEARLY_PAYMENT_URL=
NEXT_PUBLIC_BUNDLE_MONTHLY_PAYMENT_URL=
NEXT_PUBLIC_BUNDLE_YEARLY_PAYMENT_URL=
NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY=
TOSS_PAYMENTS_SECRET_KEY=

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

CAPACITOR_SERVER_URL=https://your-domain.kr
```

Upstash Redis 값이 비어 있으면 로컬 개발처럼 메모리 기반 rate limit으로 동작합니다. 공개 운영에서는 API 비용 보호를 위해 Upstash 값을 넣는 편이 안전합니다.

## 7. 정식 출시 전 스모크 테스트

배포 직전 아래 화면을 직접 열어봅니다.

```text
/
/survival
/alts
/global
/stocks
/news
/alerts
/pro
/login
/journal
/calculator
/terms
/privacy
/refund
```

그리고 아래 명령을 통과시킵니다.

```powershell
npm.cmd run lint
npm.cmd run smoke:ops
npm.cmd run smoke:billing
npm.cmd run smoke:routes
npm.cmd run build
```

브라우저에서는 다크 모드와 라이트 모드를 모두 확인합니다. 특히 `/pro`, `/news`, `/global`, `/survival`은 결제 전환과 반복 사용에 직접 연결되는 화면이므로 모바일 폭에서도 반드시 확인합니다.
