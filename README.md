# Chart Radar

Chart Radar는 코인과 글로벌 시장을 나눠 보여주는 판단 보조형 시장 레이더 앱입니다.

이 서비스는 투자 자문, 매수/매도 지시, 수익 보장을 제공하지 않습니다. 핵심 가치는 사용자가 시장 구조, 기술 지표, 뉴스/매크로 이벤트, 청산 압력, 관심 종목 알림을 한곳에서 반복 확인하도록 돕는 것입니다.

## 현재 앱 구조

- `/` - 시장 선택 홈. 코인과 글로벌 진입을 나누는 첫 화면입니다.
- `/crypto` - BTC/ETH 중심 코인 레이더입니다.
- `/alts` - 알트코인 시장 레이더와 후보 감지 화면입니다.
- `/global` - 글로벌 시장 흐름 대시보드입니다.
- `/global/assets` - 글로벌 자산레이더입니다. QQQ, SPY, NVDA, SMH, VIX, 지수선물, 원자재 등을 자산별로 확인합니다.
- `/news?market=crypto` - 코인 뉴스와 이벤트 흐름입니다.
- `/news?market=global` - 글로벌 일정, 이벤트, 뉴스 확인 흐름입니다. 글로벌 화면에서는 뉴스보다 일정/이벤트 맥락으로 다룹니다.
- `/alerts?market=crypto` - 코인 앱 푸시 알림 조건과 상태 확인 흐름입니다.
- `/alerts?market=global` - 글로벌 앱 푸시 알림 조건과 상태 확인 흐름입니다.
- `/journal?market=crypto` - 코인 복기/저널 화면입니다.
- `/journal?market=global` - 글로벌 복기/저널 화면입니다.
- `/learn` - 지표 안내 카테고리 화면입니다.
- `/login` - 로그인 화면입니다.
- `/pro` - Pro 구독과 결제 진입 화면입니다.
- `/terms` - 이용약관입니다.
- `/privacy` - 개인정보 처리방침입니다.
- `/account/delete` - 계정과 사용자 데이터 삭제 안내입니다.

## 호환 라우트

아래 라우트는 과거 구조 호환을 위해 남아 있거나 보조 용도로만 사용합니다. 새 작업의 기준 라우트로 사용하지 않습니다.

- `/majors` - 과거 BTC/ETH 주소이며 현재 `/crypto`로 redirect됩니다.
- `/calculator` - 과거 수량 계산기 주소이며 현재 `/crypto`로 redirect됩니다.
- `/diagnosis` - 과거 진입 진단 주소이며 현재 `/crypto`로 redirect됩니다.
- `/report` - 과거 리포트 주소이며 현재 `/crypto`로 redirect됩니다.
- `/stocks` - 해외주식 통합 화면 호환 route입니다. 사용자 기준 주 진입점은 `/global`과 `/global/assets`입니다.
- `/settings` - 독립 설정 페이지가 아니라 `/learn`으로 redirect됩니다. 실제 설정 UI는 앱 내부 풀스크린 패널 구조입니다.

## Android 앱 구조

Android 앱은 네이티브 전용 화면을 별도로 복제하지 않습니다. Capacitor WebView가 `https://chartradar.kr` 웹앱을 여는 하이브리드 구조입니다.

- 운영 앱 서버 URL은 `CAPACITOR_SERVER_URL=https://chartradar.kr` 기준입니다.
- `android/app/google-services.json`은 로컬 빌드에는 필요하지만 Git에 커밋하지 않습니다.
- Google 네이티브 로그인, FCM 앱 푸시, RevenueCat/Google Play 구독은 Capacitor 환경에서 동작합니다.

## 개발

```bash
npm install
npm run dev
```

개발 중 페이지가 스타일 없이 텍스트처럼 보이거나 라우트가 500으로 열리면, dev 서버가 켜진 상태에서 `npm run build`를 실행해 `.next` 캐시가 섞인 경우일 수 있습니다. 이때는 아래 명령으로 개발 서버와 `.next`를 정리한 뒤 다시 실행합니다.

```powershell
npm run dev:clean
```

## 검증

```bash
npm run lint
npm run build
npm run smoke:routes
npm run smoke:css
npm run smoke:mobile
npm run smoke:billing
npm run smoke:ops
```

- `npm run smoke:routes`는 현재 공개 라우트와 호환 redirect가 응답하는지 확인합니다.
- `npm run smoke:mobile`은 앱 아이콘, PWA manifest, service worker, offline 화면, Capacitor 설정, Android push 기본 연결을 확인합니다.
- `npm run smoke:billing`은 구독 플랜 ID, 청구 금액, Store 상품 ID, 결제 환경변수 문서가 서로 맞는지 확인합니다.
- `npm run smoke:ops`는 운영/크론/매크로/자동 알림 관련 기본 점검을 수행합니다.

## 출시 문서

- 결제 연결은 `docs/payment-launch.md`를 봅니다.
- 스토어 제출 준비는 `docs/app-store-release.md`를 봅니다.
- 공개 전 점검은 `LAUNCH_CHECKLIST.md`를 봅니다.
- 작업 큐는 `docs/work-queue.md`를 봅니다.

필수 환경변수 예시는 `.env.example`에 있습니다.
