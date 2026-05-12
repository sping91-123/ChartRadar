# Chart Radar 결제 출시 연결 가이드

이 문서는 Chart Radar를 정식 유료 서비스로 공개하기 전에 결제, 앱스토어 구독, 정책 페이지, 환경변수를 빠르게 점검하기 위한 운영 가이드입니다.

## 1. 웹 결제 연결 순서

현재 웹 결제 버튼은 `/api/billing/checkout`을 거쳐 `NEXT_PUBLIC_PRO_PAYMENT_URL`로 이동하도록 준비되어 있습니다.

1. TossPayments, PortOne, 또는 결제 링크형 서비스에서 월간 Pro와 연간 Pro 상품을 만듭니다.
2. 운영 결제 페이지 URL을 발급받습니다.
3. 로컬 `.env.local`에 아래 값을 넣습니다.

```env
NEXT_PUBLIC_PRO_PAYMENT_URL=https://your-payment-link.example
NEXT_PUBLIC_PRO_MONTHLY_PAYMENT_URL=https://your-monthly-payment-link.example
NEXT_PUBLIC_PRO_YEARLY_PAYMENT_URL=https://your-yearly-payment-link.example
```

`NEXT_PUBLIC_PRO_MONTHLY_PAYMENT_URL`과 `NEXT_PUBLIC_PRO_YEARLY_PAYMENT_URL`이 있으면 해당 플랜 링크를 우선 사용합니다. 두 값이 비어 있으면 `NEXT_PUBLIC_PRO_PAYMENT_URL`을 공통 fallback 링크로 사용합니다.

4. Vercel 배포 환경변수에도 같은 값을 넣습니다.
5. `/pro`에서 월간 또는 연간 버튼을 누르고 실제 결제창으로 이동하는지 확인합니다.
6. 결제 위젯을 직접 붙이는 단계로 넘어가면, `src/app/api/billing/checkout/route.ts`에서 단순 링크 이동 대신 주문 생성과 결제 세션 생성 로직으로 교체합니다.

5월 출시에서는 빠르게 시장 반응을 확인해야 하므로, 우선 결제 링크 방식으로 시작하고 이후 웹훅과 구독 권한 동기화를 붙이는 흐름이 가장 현실적입니다.

## 2. 앱스토어 구독 상품 ID

iOS 앱에서 디지털 구독을 판매하려면 Apple In-App Purchase를 사용해야 합니다. 웹 결제 링크를 iOS 앱 내부에서 디지털 구독 결제로 우회하면 심사 리스크가 큽니다.

코드에 준비된 상품 ID는 아래와 같습니다.

| 플랜 | 코드 상품 ID | App Store Connect 상품 ID |
| --- | --- | --- |
| 월간 Pro | `chart_radar_pro_monthly` | `chart_radar_pro_monthly` |
| 연간 Pro | `chart_radar_pro_yearly` | `chart_radar_pro_yearly` |

App Store Connect에서 구독 상품을 만들 때 위 ID와 반드시 동일하게 맞춥니다. 나중에 Expo 또는 Capacitor 네이티브 결제 모듈을 붙일 때 이 값이 그대로 사용됩니다.

## 3. 출시 전 필수 정책 페이지

현재 서비스 안에 기본 정책 페이지는 준비되어 있습니다.

| 페이지 | 경로 | 출시 전 확인할 내용 |
| --- | --- | --- |
| 이용약관 | `/terms` | 실제 사업자명, 서비스명, 결제 조건 |
| 개인정보처리방침 | `/privacy` | 실제 수집 항목, 보관 기간, 문의 이메일 |
| 구독 해지·환불 안내 | `/refund` | 웹 결제 환불 기준, 앱스토어 환불 기준 |

정식 출시 전에는 실제 사업자 정보, 고객 문의 이메일, 환불 처리 기준을 운영 값으로 바꿔야 합니다.

## 4. 환경변수 체크리스트

운영 배포 전에 최소 아래 값이 필요합니다.

```env
NEXT_PUBLIC_SITE_URL=https://your-domain.kr
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx

GROQ_API_KEY=gsk_xxx
GROQ_MODEL=qwen/qwen3-32b
GEMINI_API_KEY=xxx

NEXT_PUBLIC_PRO_PAYMENT_URL=https://your-payment-link.example
NEXT_PUBLIC_PRO_MONTHLY_PAYMENT_URL=https://your-monthly-payment-link.example
NEXT_PUBLIC_PRO_YEARLY_PAYMENT_URL=https://your-yearly-payment-link.example

CAPACITOR_SERVER_URL=https://your-domain.kr
```

`TOSS_PAYMENTS_SECRET_KEY`처럼 결제 승인에 쓰이는 시크릿 키는 브라우저에 노출하면 안 됩니다. 실제 결제 승인과 웹훅 검증은 서버 API 또는 Supabase Edge Function에서 처리합니다.

## 5. 정식 출시 전 스모크 테스트

배포 직전 아래 화면을 직접 열어봅니다.

```text
/
/survival
/alts
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
npm.cmd run build
```

브라우저에서는 다크 모드와 라이트 모드 모두 확인합니다. 특히 `/pro`, `/news`, `/stocks`, `/survival`은 결제 전환과 반복 사용에 직접 연결되는 화면이므로 모바일 폭에서도 반드시 확인합니다.
# 2026-05-11 최신 결제 상품 구조.

현재 결제 상품은 코인과 글로벌 시장을 별도 앱처럼 운영하기 위해 아래처럼 분리합니다.

| 상품 | 월간 상품 ID | 연간 상품 ID | 권장 웹 결제 환경변수 |
| --- | --- | --- | --- |
| Crypto Radar | `chart_radar_crypto_monthly` | `chart_radar_crypto_yearly` | `NEXT_PUBLIC_CRYPTO_MONTHLY_PAYMENT_URL`, `NEXT_PUBLIC_CRYPTO_YEARLY_PAYMENT_URL` |
| Global Radar | `chart_radar_global_monthly` | `chart_radar_global_yearly` | `NEXT_PUBLIC_GLOBAL_MONTHLY_PAYMENT_URL`, `NEXT_PUBLIC_GLOBAL_YEARLY_PAYMENT_URL` |
| All Market Radar | `chart_radar_bundle_monthly` | `chart_radar_bundle_yearly` | `NEXT_PUBLIC_BUNDLE_MONTHLY_PAYMENT_URL`, `NEXT_PUBLIC_BUNDLE_YEARLY_PAYMENT_URL` |

기존 `NEXT_PUBLIC_PRO_PAYMENT_URL`, `NEXT_PUBLIC_PRO_MONTHLY_PAYMENT_URL`, `NEXT_PUBLIC_PRO_YEARLY_PAYMENT_URL`, `NEXT_PUBLIC_STOCKS_MONTHLY_PAYMENT_URL`, `NEXT_PUBLIC_STOCKS_YEARLY_PAYMENT_URL`은 과거 호환 fallback으로만 남깁니다. 정식 출시 설정에서는 상품별 URL을 우선 입력하세요.
