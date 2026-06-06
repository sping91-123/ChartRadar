# Launch Checklist

Chart Radar를 공개하거나 앱 빌드를 제출하기 전에 확인할 항목입니다.

## 1. 도메인과 배포

1. Vercel Production 배포가 최신 `origin/main` 커밋 기준인지 확인합니다.
2. `https://chartradar.kr` 접속과 SSL 인증서 상태를 확인합니다.
3. `NEXT_PUBLIC_SITE_URL=https://chartradar.kr`로 설정되어 있는지 확인합니다.
4. Android 앱 빌드는 `CAPACITOR_SERVER_URL=https://chartradar.kr` 기준으로 생성합니다.

## 2. 운영 환경변수

Vercel Project Settings의 Production Environment Variables에서 최소 아래 값을 확인합니다.

```env
NEXT_PUBLIC_SITE_URL=https://chartradar.kr
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=

GROQ_API_KEY=
GROQ_MODEL=
GEMINI_API_KEY=
NEWS_TRANSLATION_PROVIDER=
ENABLE_GEMINI_NEWS_FALLBACK=

NEXT_PUBLIC_CRYPTO_MONTHLY_PAYMENT_URL=
NEXT_PUBLIC_CRYPTO_YEARLY_PAYMENT_URL=
NEXT_PUBLIC_GLOBAL_MONTHLY_PAYMENT_URL=
NEXT_PUBLIC_GLOBAL_YEARLY_PAYMENT_URL=
NEXT_PUBLIC_BUNDLE_MONTHLY_PAYMENT_URL=
NEXT_PUBLIC_BUNDLE_6MONTH_PAYMENT_URL=
NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY=
TOSS_PAYMENTS_SECRET_KEY=

NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY=
NEXT_PUBLIC_REVENUECAT_IOS_API_KEY=
REVENUECAT_REST_API_KEY=

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
CRON_SECRET=

CAPACITOR_SERVER_URL=https://chartradar.kr
```

비밀값은 브라우저에 노출되는 `NEXT_PUBLIC_` 환경변수로 옮기지 않습니다.

## 3. 현재 공개 라우트

공개 전에는 아래 라우트가 현재 제품 구조와 맞게 동작하는지 확인합니다.

- `/`
- `/crypto`
- `/alts`
- `/global`
- `/global/assets`
- `/news?market=crypto`
- `/news?market=global`
- `/alerts?market=crypto`
- `/alerts?market=global`
- `/journal?market=crypto`
- `/journal?market=global`
- `/learn`
- `/login`
- `/pro`
- `/terms`
- `/privacy`
- `/account/delete`
- `/refund`
- `/robots.txt`
- `/sitemap.xml`
- `/manifest.webmanifest`

## 4. 호환 라우트

아래 라우트는 과거 링크 호환 또는 보조 용도입니다. 새 기능 설명의 기준 라우트로 쓰지 않습니다.

- `/majors` - `/crypto`로 redirect됩니다.
- `/calculator` - `/crypto`로 redirect됩니다.
- `/diagnosis` - `/crypto`로 redirect됩니다.
- `/report` - `/crypto`로 redirect됩니다.
- `/stocks` - 해외주식 통합 화면 호환 route입니다. 사용자 기준 주 진입점은 `/global`과 `/global/assets`입니다.
- `/settings` - `/learn`으로 redirect됩니다. 실제 설정은 앱 내부 풀스크린 패널입니다.

## 5. 글로벌 화면 기준

- `/global`은 글로벌 시장흐름 대시보드입니다.
- `/global/assets`는 글로벌 자산레이더입니다.
- `/global/assets`에서만 자산 선택, 타임프레임, 분석 모드 하단 모바일 컨트롤을 표시합니다.
- `/global`, `/news?market=global`, `/journal?market=global`에서는 자산레이더 하단 컨트롤이 노출되지 않아야 합니다.
- `/news?market=global`은 단순 뉴스 목록보다 글로벌 일정, 이벤트, 뉴스 확인 흐름으로 설명합니다.

## 6. 결제와 Pro

1. `/pro?market=crypto`에서 Coin Pro와 All Market Pro 구독 진입을 확인합니다.
2. `/pro?market=global`에서 Global Pro와 All Market Pro 구독 진입을 확인합니다.
3. Android 앱에서는 Google Play 구독과 RevenueCat 동기화 흐름을 확인합니다.
4. 웹 결제는 `/api/billing/checkout`, `/checkout/success`, `/api/billing/confirm` 흐름을 확인합니다.
5. `SUPABASE_SERVICE_ROLE_KEY`가 없으면 결제 후 Pro 권한 자동 반영이 보류됩니다.
6. Google Play Console, RevenueCat, 웹 결제 링크의 실제 가격이 `src/lib/billing.ts`의 출시가 `billingAmount`와 같은지 확인합니다.

## 7. Android 앱 제출 전 확인

- `android/app/google-services.json`이 로컬에는 있고 Git에는 없는지 확인합니다.
- Android `versionCode`가 Play Console에 이미 올린 값보다 높은지 확인합니다.
- 앱은 `CAPACITOR_SERVER_URL=https://chartradar.kr` 기준으로 빌드합니다.
- Google 네이티브 로그인, FCM 토큰 저장, 테스트 푸시 수신을 확인합니다.
- 테스트 푸시 패널은 관리자 계정에서만 보여야 합니다.

## 8. 검증 명령

```powershell
git diff --check
cmd /c npx tsc --noEmit
npm.cmd run build
npm.cmd run smoke:routes
npm.cmd run smoke:mobile
npm.cmd run smoke:billing
npm.cmd run smoke:ops
```

문서만 수정한 경우 build/smoke는 생략할 수 있지만, 라우트 정합성 작업에서는 `smoke:routes`와 `smoke:mobile`을 우선 확인합니다.

## 9. 공개 후 바로 볼 지표

- `/`, `/crypto`, `/alts`, `/global`, `/global/assets` 사용 빈도
- `/news?market=crypto`, `/news?market=global` 진입 빈도
- `/alerts?market=crypto`, `/alerts?market=global` 설정 완료율
- `/journal?market=crypto`, `/journal?market=global` 저장 시도
- `/pro` 진입과 구독 버튼 클릭률
- 자동 푸시 발송, skip, 실패 로그
