# Launch Checklist

Chart Radar를 정식 공개하기 전 마지막으로 확인할 항목입니다.

## 1. 도메인과 배포

1. 도메인을 구매합니다.
2. Vercel 프로젝트에 도메인을 연결합니다.
3. Vercel이 안내하는 DNS 레코드를 도메인 관리 페이지에 추가합니다.
4. `https://도메인` 접속과 SSL 인증서 발급을 확인합니다.
5. `NEXT_PUBLIC_SITE_URL`을 실제 도메인으로 설정합니다.

## 2. 운영 환경변수

Vercel Project Settings → Environment Variables에 아래 값을 넣습니다.

```env
NEXT_PUBLIC_SITE_URL=https://your-domain.kr
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=

GROQ_API_KEY=gsk_xxx
GROQ_MODEL=qwen/qwen3-32b
GEMINI_API_KEY=xxx
NEWS_TRANSLATION_PROVIDER=
ENABLE_GEMINI_NEWS_FALLBACK=

NEXT_PUBLIC_PRO_PAYMENT_URL=
NEXT_PUBLIC_PRO_MONTHLY_PAYMENT_URL=
NEXT_PUBLIC_PRO_YEARLY_PAYMENT_URL=
NEXT_PUBLIC_CRYPTO_MONTHLY_PAYMENT_URL=
NEXT_PUBLIC_CRYPTO_YEARLY_PAYMENT_URL=
NEXT_PUBLIC_GLOBAL_MONTHLY_PAYMENT_URL=
NEXT_PUBLIC_GLOBAL_YEARLY_PAYMENT_URL=
NEXT_PUBLIC_STOCKS_MONTHLY_PAYMENT_URL=
NEXT_PUBLIC_STOCKS_YEARLY_PAYMENT_URL=
NEXT_PUBLIC_BUNDLE_MONTHLY_PAYMENT_URL=
NEXT_PUBLIC_BUNDLE_YEARLY_PAYMENT_URL=
NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY=
TOSS_PAYMENTS_SECRET_KEY=

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

CAPACITOR_SERVER_URL=https://your-domain.kr
```

코인, 글로벌, 올마켓 상품 링크가 따로 있으면 상품별 환경변수를 우선 사용합니다. 기존 `NEXT_PUBLIC_PRO_*` 값은 임시 공통 결제 링크 fallback으로만 남깁니다.

`SUPABASE_SERVICE_ROLE_KEY`, `TOSS_PAYMENTS_SECRET_KEY`, `UPSTASH_REDIS_*` 값은 서버에서만 사용합니다. 브라우저 코드나 `NEXT_PUBLIC_` 환경변수로 노출하지 않습니다.

## 3. Supabase Auth 설정

Supabase Dashboard → Authentication → URL Configuration에서 아래 값을 확인합니다.

- Site URL은 실제 도메인입니다.
- Redirect URL에는 `https://도메인/auth/callback`을 넣습니다.
- 로컬 개발을 위해 `http://127.0.0.1:3000/auth/callback`도 유지합니다.

Google OAuth 설정에서도 Supabase가 제공하는 callback URL이 등록되어 있어야 합니다.

## 4. 결제 확인

1. `/pro?market=crypto`에서 코인 월간, 코인 연간, 올마켓 플랜 버튼을 누릅니다.
2. `/pro?market=global`에서 글로벌 월간, 글로벌 연간, 올마켓 플랜 버튼을 누릅니다.
3. 각 버튼이 상품별 결제창으로 이동하는지 확인합니다.
4. 결제 성공 URL은 `/checkout/success`, 실패 URL은 `/checkout/fail`로 연결합니다.
5. 결제 성공 URL에는 결제사가 `paymentKey`, `orderId`, `amount`를 넘겨야 합니다.
6. `/checkout/success`는 `/api/billing/confirm`을 호출해 결제사 승인과 Supabase 권한 반영을 확인합니다.
7. `TOSS_PAYMENTS_SECRET_KEY`가 없으면 결제 승인 확인이 보류됩니다.
8. `SUPABASE_SERVICE_ROLE_KEY`가 없으면 결제가 확인되어도 Pro 권한 자동 반영이 보류됩니다.
9. 웹 결제 전후에는 `npm run smoke:billing`과 `npm run smoke:routes`를 실행합니다.

## 5. 앱스토어 확인

앱스토어 제출 전에는 `docs/app-store-release.md`를 기준으로 확인합니다.

- iOS 디지털 구독은 App Store In-App Purchase를 사용합니다.
- 상품 ID는 코인, 글로벌, 올마켓 App Store 상품 ID와 일치해야 합니다.
- 개인정보처리방침 URL과 이용약관 URL이 실제 도메인으로 열려야 합니다.
- 스크린샷은 다크 모드 중심으로 준비합니다.

## 6. 공개 전 필수 페이지

아래 페이지가 모두 200으로 열리는지 확인합니다.

- `/`
- `/survival`
- `/alts`
- `/stocks`
- `/news`
- `/alerts`
- `/pro`
- `/login`
- `/journal`
- `/calculator`
- `/terms`
- `/privacy`
- `/account/delete`
- `/refund`
- `/robots.txt`
- `/sitemap.xml`
- `/manifest.webmanifest`

로컬에서 공개 전 점검을 할 때는 개발 서버를 켠 뒤 `npm run smoke:routes`를 실행합니다. 이 명령은 위 공개 페이지와 월간, 연간 결제 진입 API가 정상 응답하는지 함께 확인합니다.

앱 출시 전에는 `npm run smoke:mobile`도 실행합니다. 이 명령은 앱 아이콘, PWA manifest, service worker, offline 화면, Capacitor 설정, 모바일 shell 파일을 확인합니다.

결제 연결 전후에는 `npm run smoke:billing`도 실행합니다. 이 명령은 월간, 연간 플랜 ID와 실제 청구 금액, App Store 상품 ID, 결제 환경변수 문서가 서로 맞는지 확인합니다.

## 7. 개발 중 텍스트만 보일 때

dev 서버가 켜진 상태에서 `npm run build`를 실행하면 `.next` 안의 개발용 CSS 경로와 빌드 결과가 섞여 페이지가 스타일 없이 텍스트처럼 보일 수 있습니다.

해결 순서입니다.

1. 3000번 포트의 dev 서버를 끕니다.
2. `.next` 폴더를 삭제합니다.
3. `npm run dev`를 다시 실행합니다.
4. 브라우저를 새로고침합니다.

저장소 안에서는 아래 명령을 사용하면 위 과정을 한 번에 처리할 수 있습니다.

```powershell
npm run dev:clean
```

바탕화면의 `차트레이더 서버 켜기.bat`은 위 과정을 자동으로 처리합니다.

## 8. 공개 후 바로 볼 지표

- 홈 관제실 재방문 수.
- `/survival`, `/alts`, `/stocks` 사용 빈도.
- `/news` AI 브리핑 클릭 수.
- `/alerts` 알림 조건 설정 수.
- `/pro` 진입률과 결제 버튼 클릭률.
- 실제 결제 전환 수.
