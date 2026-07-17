# 2026-07-14 전체 앱 QA 후속 후보

## 상태

- 상태: LOCAL_IMPLEMENTATION_COMPLETE / EXTERNAL_GATES_PENDING
- 우선순위: P0~P2 혼합
- 담당방: 전체 앱 / Pro 권한 / 핵심 route / 모바일 / QA 자동화
- 인텔리전스: 높음
- 위험도: 높음
- 관련 route: `/crypto`, `/crypto/home`, `/crypto/spot`, `/crypto/perpetual`, `/crypto/perpetual/alts`, `/alts`, `/global`, `/global/assets`, `/alerts`, `/news`, `/journal`, `/pro`, `/account/delete`
- 관련 Issue:
- 관련 PR:

## 배경

2026-07-14에 소스, 모바일·데스크톱 화면, API·smoke, Android shell, Pro/Billing/Auth/Supabase 경계를 함께 점검했다. Codex in-app Browser는 사용하지 않았고 CLI Playwright와 기존 smoke 명령만 사용했다.

이 문서는 확인된 문제를 우선순위와 위험도로 분리한 QA 산출물이며, 2026-07-16 대표 지시에 따라 후보 중 승인된 전체 안정화 항목을 로컬 코드와 검증 게이트에 반영했다.

## 확인된 기준선

- TypeScript 검사와 production build는 통과한다.
- 현재 smoke 범위 안의 route, API, CSS, 모바일 shell, 결제 문구 검사는 통과한다.
- `/crypto/home`, `/crypto/spot`, `/crypto/perpetual`, `/crypto/perpetual/alts`, `/news`, `/journal`, `/global`, `/global/assets`, `/alerts?market=global`, `/pro`, `/account/delete`의 모바일·데스크톱 진입과 주요 첫 화면은 렌더링된다.
- 로그인 저장값이 손상된 경우 영구 빈 화면으로 남는 현상은 재현되지 않았다. 저장값을 제거하고 `/crypto/home` Basic 화면으로 복구됐다.
- BTC의 `롱 쏠림 -> 숏 우세 압력` 표시는 롱 청산 하방 압력이라는 현재 계산 모델과 일치하므로 결함 후보에서 제외했다.

## 개선 후보

### QA-P0-00 운영 profile 권한 self-upgrade 차단

- 우선순위: P0 / 즉시
- 위험도: 매우 높음
- 발견: 운영 Phase 0 inventory에서 authenticated 사용자가 본인 profile을 UPDATE할 수 있고 `membership_tier` 열에도 UPDATE privilege가 있음을 확인했다. 현재 권한 판정이 이 값을 신뢰하므로 로그인 사용자가 직접 `premium`으로 변경할 수 있다.
- 현재 관측: 실제 악용 여부는 확인하지 않았다. premium profile 12개는 대표가 의도적으로 계정 생성일부터 3개월 혜택을 부여한 베타테스터로 확인됐다.
- 관련 문서: `docs/work-items/P0-pro-entitlement-phase0-inventory-2026-07-14.md`
- 진행 상태: 운영 미적용 hotfix migration, 정적 smoke, production `membership_tier`/repo `plan` 격리 PostgreSQL 회귀 테스트를 완료했다. 실제 Supabase REST/JWT, beta backfill, 운영 적용은 포함하지 않았다.
- 권장 방향: 전체 entitlement migration과 분리해 profile UPDATE privilege·policy를 먼저 닫고 Basic 본인 tier 변경 거부, signup/profile read 회귀를 검증한다.
- 중단 조건: 운영 DB 적용, migration ledger 등록, premium profile 변경은 별도 대표 승인 전 수행하지 않는다.

### QA-P0-01 Pro 권한의 만료·환불·철회 수명주기 일원화

- 우선순위: P0
- 위험도: 높음
- 발견:
  - 활성 구독 조회는 만료일을 필터링하지만 서버 권한 판정은 `profiles.plan`도 계속 유료 권한으로 합산한다.
  - 권한 부여가 profile을 먼저 갱신한 뒤 subscription을 기록하므로 두 번째 쓰기가 실패하면 유료 profile만 남을 수 있다.
  - RevenueCat 동기화에서 활성 상품이 0개이면 기존 권한을 철회하지 않고 404만 반환한다.
- 사용자 영향: 만료, 환불 또는 스토어 철회 뒤에도 Pro 기능이 남을 수 있고, 부분 실패 시 권한 원장이 서로 어긋날 수 있다.
- 관련 파일:
  - `src/lib/server/requestEntitlement.ts`
  - `src/lib/server/billingEntitlements.ts`
  - `src/app/api/billing/app-store/sync/route.ts`
  - `src/lib/server/push/entitlements.ts`
- 설계 문서: `docs/work-items/P0-pro-entitlement-lifecycle-redesign.md`
- 운영 inventory: `docs/work-items/P0-pro-entitlement-phase0-inventory-2026-07-14.md`
- 진행 상태: 고위험 구현 전 단일 원장, 원자적 mutation, 공급자별 revoke, migration·rollback·test matrix 설계를 완료했다. 코드·schema·운영 설정 변경은 시작하지 않았다.
- 권장 방향: subscription을 권한의 단일 원장으로 정하고, profile은 표시용 캐시로만 취급하거나 DB transaction/RPC로 원자화한다. 만료·환불·취소·상품 0개 동기화에 명시적 revoke 경로와 회귀 테스트를 추가한다.
- 중단 조건: 운영 Supabase schema, RevenueCat webhook/RTDN, 기존 유료 사용자 마이그레이션 정책 확인이 필요하면 대표 승인 전 수정하지 않는다.

### QA-P0-02 premium signal RLS를 실제 entitlement 기준으로 제한

- 우선순위: P0
- 위험도: 높음
- 발견: `signals_public_or_authenticated` 정책은 `visibility = 'public'`이 아니어도 로그인 역할이면 읽을 수 있게 한다. Data API table grant가 열려 있는 배포에서는 Basic 로그인 사용자도 premium signal 행을 조회할 수 있다.
- 사용자 영향: Pro gating과 데이터 노출 정책이 UI보다 약해질 수 있다.
- 관련 파일:
  - `supabase/schema.sql`
  - 관련 migration과 signal 조회 경로
- 권장 방향: 현재 운영 grant를 먼저 확인하고, premium 행은 서버 전용 조회 또는 entitlement를 검증하는 보안 definer 함수/RLS로 제한한다.
- 중단 조건: 운영 DB 정책 변경과 기존 클라이언트 호환성 검토 전에는 적용하지 않는다.

### QA-P1-01 분석 종목과 결과를 한 단위로 결합

- 우선순위: P1
- 위험도: 중간
- 발견:
  - 알트 선물 요약은 가장 강한 청산 압력 종목과 가장 큰 체결 종목을 각각 독립 선택한 뒤 한 매매 플랜으로 합친다. 실제 화면에서 `DOGE 롱 쏠림`과 `BNB 큰 매도`가 한 판단으로 결합됐다.
  - 홈 상세 링크는 `symbol=ETHUSDT.P`를 보내지만 메이저 상세 화면은 `asset`만 읽어 ETH 링크가 BTC 기본값으로 열린다.
  - 자산을 빠르게 전환하는 데이터 요청에 취소 또는 request generation 검증이 없어 늦게 끝난 이전 응답이 새 선택에 덮일 수 있다.
- 사용자 영향: 다른 종목의 근거로 현재 종목의 롱·숏 판단을 내린 것처럼 보일 수 있다.
- 관련 파일:
  - `src/components/coin/CoinFuturesBrief.tsx`
  - `src/components/coin/CoinRadarHomePanel.tsx`
  - `src/components/MajorsApp.tsx`
  - `src/components/StockRadarApp.tsx`
- 권장 방향: 종목별 pressure+flow 쌍을 먼저 만든 뒤 같은 종목 단위로 점수화한다. URL query 계약을 `asset` 또는 `symbol` 하나로 통일하고, 요청에는 AbortController 또는 generation guard를 둔다.
- 중단 조건: `MajorsApp.tsx`, `CoinFuturesSwitch.tsx`에 기존 사용자 변경이 있으므로 변경 의도 확인 없이 수정하지 않는다.

### QA-P1-02 결제·로그아웃·RevenueCat 사용자 전환 경계 강화

- 우선순위: P1
- 위험도: 높음
- 발견:
  - 로그아웃이 로컬 세션만 지우고 Supabase `signOut`을 호출하지 않는다.
  - RevenueCat은 사용자 변경 때 `configure`를 다시 호출하며 `logIn`/`logOut` 전환 흐름이 없다.
  - 웹 결제 confirm은 서버에 미리 저장된 주문과 사용자 소유권을 대조하지 않고, 유효한 Toss 결제를 현재 로그인 사용자에게 부여하는 구조다. 현재 웹 구매 UI가 막혀 있어 조건부 위험이지만 endpoint는 별도 방어가 필요하다.
  - 로그인 `returnTo` 검사는 `/\\evil.example` 같은 역슬래시 경로를 허용하며 URL 정규화 뒤 외부 host가 될 수 있다. Kakao callback의 forwarded host 신뢰도 배포 proxy가 헤더를 정제한다는 전제에 의존한다.
- 관련 파일:
  - `src/lib/useSupabaseAuth.ts`
  - `src/lib/mobilePurchases.ts`
  - `src/app/api/billing/checkout/route.ts`
  - `src/app/api/billing/confirm/route.ts`
  - `src/lib/server/billingEntitlements.ts`
  - `src/app/login/page.tsx`
  - `src/app/auth/callback/page.tsx`
  - `src/app/api/auth/kakao/callback/route.ts`
- 권장 방향: Supabase global/local sign-out 정책을 명시하고, RevenueCat 공식 사용자 전환 흐름을 사용한다. 결제 주문은 생성 시 user/plan/amount와 묶어 저장한 뒤 confirm에서 소유권과 미사용 상태를 원자적으로 검증한다. callback 목적지는 허용된 same-origin path만 URL parser로 검증하고 forwarded host는 신뢰 가능한 proxy 계약으로 제한한다.

### QA-P1-03 앱 심사·계정 삭제·정책 문구 정합성 보완

- 우선순위: P1
- 위험도: 높음
- 발견:
  - 계정 삭제 화면은 Google 계정 이메일을 고객센터로 보내는 수동 절차만 안내하며 Kakao 로그인을 반영하지 않는다.
  - 개인정보처리방침도 Google 로그인만 기재한다.
  - iOS RevenueCat public API key가 현재 환경 검사에서 누락됐다.
  - 이용약관·환불 안내는 현재 막혀 있는 웹 결제 흐름 및 Android/Google Play 중심 설명과 어긋나는 부분이 있다.
  - 현재 보유 중이거나 이미 포함된 플랜도 구매 버튼이 활성 상태이고, 교체·일할 계산 정책이 화면과 코드에 명시되지 않는다.
- 관련 파일:
  - `src/app/account/delete/page.tsx`
  - `src/app/privacy/page.tsx`
  - `src/app/terms/page.tsx`
  - `src/app/refund/page.tsx`
  - `src/components/ProPricingPanel.tsx`
  - `src/lib/mobilePurchases.ts`
- 권장 방향: 앱 안에서 삭제 요청을 시작하고 상태를 확인할 수 있게 만들며 Google/Kakao/스토어별 절차를 정책 문서와 일치시킨다. iOS 출시 범위 확정 뒤 키와 상품 mapping을 별도로 검증한다.

### QA-P1-04 글로벌 알림 기록 route 복원

- 우선순위: P1
- 위험도: 중간
- 발견:
  - 글로벌 헤더의 알림 아이콘은 `/alerts?market=global`로 이동하지만 해당 route는 알림 기록이 아니라 설정 화면만 렌더링한다. stocks를 지원하는 `RadarAlertList`는 route에서 사용되지 않는다.
- 사용자 영향: 사용자가 글로벌 알림 발생 이력을 찾을 수 없다.
- 관련 파일:
  - `src/components/HeaderActions.tsx`
  - `src/app/alerts/page.tsx`
  - `src/components/RadarAlertList.tsx`
- 권장 방향: 글로벌 alert list와 settings 목적지를 분리한다.
- 제외: Android 뒤로가기에서 `/crypto/home`으로 이동하는 동작은 대표가 의도한 제품 정책으로 확인되어 개선 후보에서 제외한다.

### QA-P1-05 배포 검증 게이트와 route coverage 복구

- 우선순위: P1
- 위험도: 낮음
- 발견:
  - 초기 QA에서 `npm.cmd run smoke:ops`가 삭제된 `src/components/coin/coinHomeDecisionModel.ts`를 읽어 즉시 실패했다.
  - route smoke는 실제 page route 12개를 누락하며 redirect는 Location 목적지를 검증하지 않는다.
  - `smoke:all`은 TypeScript와 production build를 포함하지 않는다.
- 2026-07-14 후속 처리:
  - 삭제 모델과 기존 홈 stablecoin/large-trade/options 단언을 현재 관심코인 snapshot 구조 검증으로 교체했다.
  - snapshot, ticker, 거래소 종목 목록, 멀티타임프레임 점수, pressure, strategy radar, Basic/Pro 관심코인 제한, 메이저·알트 시장 환경 패널 연결을 검사한다.
  - `smoke:ops`와 `smoke:all`이 통과해 배포 게이트의 즉시 실패는 해결됐다.
- 관련 파일:
  - `scripts/smoke-ops.mjs`
  - `scripts/smoke-routes.mjs`
  - `scripts/smoke-all.mjs`
- 남은 방향: 파일 기반 route manifest 및 redirect Location 검증을 추가한다. release gate에 `tsc --noEmit`과 `next build`를 포함할지는 실행 시간 기준으로 결정한다.

### QA-P2-01 로딩·에러·재시도·동기화 복구 UX 추가

- 우선순위: P2
- 위험도: 낮음~중간
- 발견:
  - App Router 공통 `loading.tsx`, `error.tsx`, `global-error.tsx`가 없고 초기 인증 gate는 아무것도 렌더링하지 않는다.
  - Spot 핵심 API 에러는 재시도 버튼이 없다.
  - Journal 원격 동기화·삭제 오류가 사용자에게 드러나지 않으며 삭제 확인/undo가 없다.
  - Global pulse의 silent refresh 실패가 정상 데이터를 error 상태로 대체할 수 있다.
- 관련 파일:
  - `src/app/loading.tsx` 신규 후보
  - `src/app/error.tsx` 신규 후보
  - `src/app/global-error.tsx` 신규 후보
  - `src/components/HomeEntryGate.tsx`
  - `src/components/coin/SpotRadarPanel.tsx`
  - `src/app/journal/page.tsx`
  - `src/components/GlobalMarketPulse.tsx`
- 권장 방향: 마지막 정상 데이터를 유지하면서 비차단 오류와 재시도를 제공하고, 삭제에는 확인 또는 undo를 둔다.

### QA-P2-02 모바일 shell·접근성·PWA 실제 동작 검증

- 우선순위: P2
- 위험도: 중간
- 발견:
  - viewport `maximumScale: 1`로 확대를 막는다.
  - bottom nav와 선택 버튼 일부에 `aria-current`, `aria-pressed`, nav label이 없다.
  - fixed bottom nav와 safe-area/padding/min-height 규칙이 여러 층에서 중복돼 작은 WebView에서 여백·스크롤 회귀 위험이 있다.
  - service worker 등록 코드는 `PwaInstallPrompt` 안에 있지만 이 컴포넌트를 렌더링하는 곳이 없어 실제 등록되지 않는다. 현재 mobile smoke는 파일·문자열 존재만 검사해 이를 잡지 못한다.
  - Android `allowBackup=true`와 localStorage refresh token 조합은 최종 merged manifest와 Android 백업 범위를 출시 전 확인해야 한다.
- 관련 파일:
  - `src/app/layout.tsx`
  - `src/app/globals.css`
  - `src/components/RadarTopNav.tsx`
  - `src/components/HeaderActions.tsx`
  - `src/components/PwaInstallPrompt.tsx`
  - `scripts/smoke-mobile.mjs`
  - `android/app/src/main/AndroidManifest.xml`

### QA-P2-03 중복 문구와 오래된 fallback 정리

- 우선순위: P2
- 위험도: 낮음
- 발견:
  - `/global/assets`에서 route 소개와 panel 소개가 중복된다.
  - `/learn` 용어 설명이 현재 coin home 판단 구조와 어긋난다.
  - macro live API는 현재 정상이나 static fallback은 2026-05-25 기준이라 장애 시 오래된 일정만 남거나 빈 카드가 될 수 있다.
- 관련 파일:
  - `src/app/global/assets/page.tsx`
  - `src/components/GlobalAssetSelectionPanel.tsx`
  - `src/app/learn/page.tsx`
  - `src/data/macroEvents.ts`
- 권장 방향: 첫 화면 설명은 한 번만 제공하고, 학습 용어를 현재 판단 카드 명칭과 맞춘다. macro fallback 생성 자동화 또는 명시적 데이터 지연 상태를 도입한다.

## 권장 실행 순서

1. `QA-P0-00` profile self-upgrade 차단을 별도 보안 hotfix로 먼저 승인·검증한다.
2. 고위험 `QA-P0-01`, `QA-P0-02`는 Phase 0 결과와 legacy premium 12개 정책을 반영한 뒤 진행한다.
3. 완료: `QA-P1-05`의 `smoke:ops` 즉시 실패를 복구했다. route coverage 확대는 별도 저위험 후속 작업으로 남긴다.
4. `QA-P1-01`의 같은 종목 결합과 URL query 계약을 고친다. 기존 사용자 수정 파일과 겹치므로 diff를 먼저 합의한다.
5. 앱 심사 일정에 맞춰 `QA-P1-02`~`04`를 각각 별도 커밋 단위로 처리한다.
6. `QA-P2-01`~`03`은 route별 작은 작업으로 나눠 진행한다.

## 병렬 검토 결과 요약

### 핵심 route·분석 검토

- 조사한 범위: crypto/spot/perpetual/alts/global/news/journal 화면, 데이터 갱신, URL query, 알림 route.
- 발견한 문제: 다른 알트 종목의 pressure와 flow 결합, ETH 상세 링크가 BTC로 열림, stale response 가능성, 글로벌 알림 기록 미노출, journal/global 갱신 복구 UX 부족.
- 수정이 필요한 파일: `CoinFuturesBrief.tsx`, `CoinRadarHomePanel.tsx`, `MajorsApp.tsx`, `StockRadarApp.tsx`, `HeaderActions.tsx`, `alerts/page.tsx`, `journal/page.tsx`, `GlobalMarketPulse.tsx`.
- 고위험 여부: 분석 판단 오류는 사용자 영향이 높고, 코드 위험도는 중간.
- 추천 검증 명령: `cmd /c npx tsc --noEmit`, `npm.cmd run build`, `npm.cmd run smoke:routes`, Playwright 모바일 종목 전환/직접 링크 회귀.
- main 작업 흐름에 반영할 항목: QA-P1-01, QA-P1-04, QA-P2-01.
- 보류할 항목: 사용자 변경과 겹치는 `MajorsApp.tsx`, `CoinFuturesSwitch.tsx` 수정.

### 모바일·QA 자동화 검토

- 조사한 범위: Android back/manifest, viewport/safe area/nav, PWA 등록, route/mobile smoke coverage.
- 발견한 문제: 확대 차단, PWA 미등록, 백업 설정 점검 필요, route 누락, 삭제된 파일을 읽는 smoke. `/crypto/home`으로 보내는 Android back은 의도된 정책으로 확인되어 제외했다.
- 수정이 필요한 파일: `AndroidManifest.xml`, `layout.tsx`, `globals.css`, `RadarTopNav.tsx`, `PwaInstallPrompt.tsx`, `smoke-mobile.mjs`, `smoke-routes.mjs`, `smoke-ops.mjs`, `smoke-all.mjs`.
- 고위험 여부: Android/백업은 높음, smoke 복구는 낮음, 접근성/PWA는 중간.
- 추천 검증 명령: `npm.cmd run smoke:mobile`, `npm.cmd run smoke:routes`, `npm.cmd run smoke:ops`, `npm.cmd run build`, Android emulator/device back·safe-area·PWA 확인.
- main 작업 흐름에 반영할 항목: QA-P1-05, QA-P2-02. 글로벌 알림 route는 QA-P1-04로 별도 유지한다.
- 보류할 항목: release manifest와 실기기 백업 범위 확인 전 `allowBackup` 변경. 의도된 Android back 정책 변경.

### Pro·Auth·Billing·정책 검토

- 조사한 범위: 서버 entitlement 판정, profile/subscription 기록, RevenueCat/Toss sync, logout, RLS, 계정 삭제와 정책 문서.
- 발견한 문제: 만료 권한 잔존, 부분 쓰기, revoke 부재, premium signal RLS 과다 허용 가능성, 사용자 전환과 logout 경계, 삭제·정책 문구 불일치, iOS 키 누락.
- 수정이 필요한 파일: `requestEntitlement.ts`, `billingEntitlements.ts`, app-store sync/confirm routes, `useSupabaseAuth.ts`, `mobilePurchases.ts`, `supabase/schema.sql`, account/privacy/terms/refund pages.
- 고위험 여부: 높음.
- 추천 검증 명령: `npm.cmd run smoke:billing`, `npm.cmd run check:app-billing`, 만료·환불·취소·재로그인 통합 테스트, Supabase RLS impersonation 테스트.
- main 작업 흐름에 반영할 항목: QA-P0-01, QA-P0-02, QA-P1-02, QA-P1-03.
- 보류할 항목: 운영 DB/RevenueCat/스토어 설정과 기존 유료 계정 migration 확인 전 코드·schema 변경.

## 이번 QA 검증 결과

- PASS: `cmd /c npx tsc --noEmit`
- PASS: `npm.cmd run build`
- PASS: `npm.cmd run smoke:routes`
- PASS: `npm.cmd run smoke:api`
- PASS: `npm.cmd run smoke:css`
- PASS: `npm.cmd run smoke:copy`
- PASS: `npm.cmd run smoke:mobile`
- PASS: `npm.cmd run smoke:billing`
- PASS: `npm.cmd run smoke:supabase-security`
- PASS: `npm.cmd run test:supabase-hotfix`
- WARN: `npm.cmd run smoke:launch` — 92/100, static macro fallback freshness 경고
- WARN: `npm.cmd run check:app-billing` — iOS RevenueCat key 누락
- PASS: `npm.cmd run smoke:ops` — 현재 관심코인 홈 구조 검증으로 교체
- PASS: `npm.cmd run smoke:all`
- PASS: `git diff --check`

## 화면 증거

- `output/playwright/qa-2026-07-14/crypto-home-mobile.png`
- `output/playwright/qa-2026-07-14/crypto-alts-mobile-stable.png`
- `output/playwright/qa-2026-07-14/global-alerts-mobile.png`
- `output/playwright/qa-2026-07-14/global-assets-mobile.png`
- `output/playwright/qa-2026-07-14/pro-mobile.png`

## 완료 기준

- 각 후보를 별도 work item으로 분리하고 한 번에 하나만 처리한다.
- P0와 결제/Auth/Supabase/Android release 항목은 대표 승인 뒤 시작한다.
- 분석 카드의 symbol, label, pressure, flow가 같은 종목과 같은 request generation을 가리킨다.
- 만료·환불·취소 후 권한이 제거되고 Basic 사용자가 premium signal을 직접 읽지 못한다.
- alert list, loading/error/retry, zoom/safe-area/PWA가 실기기 또는 동등한 자동화에서 확인된다.
- 모든 필수 smoke, TypeScript, build, `git diff --check` 결과를 보고한다.

## 중단 조건

- 결제, 인증, Supabase, Android release, production 설정 변경이 필요한 경우.
- 기존 유료 사용자 migration 또는 권한 회수 정책이 정해지지 않은 경우.
- 기존 사용자 변경 파일과 충돌하는 경우.
- 수정 범위가 한 커밋을 넘는 경우.

## 완료 기록

- 완료 커밋:
- PR:
- 이번 QA에서는 앱 기능 코드는 수정하지 않았다.
- 2026-07-14 후속: `scripts/smoke-ops.mjs`를 현재 홈 구조에 맞게 복구했다.
- commit, push, deploy는 하지 않았다.

## 2026-07-16 전체 안정화 실행 결과

- 완료: subscription 단일 원장, RevenueCat snapshot reconcile, signal fail-closed RLS, profile self-upgrade 차단, 베타 3개월 이관 guard.
- 완료: 같은 알트 symbol의 pressure/flow 결합, ETH canonical `asset=eth` 진입, 비동기 요청 abort/generation, 글로벌 알림 기록 route.
- 완료: same-origin returnTo, Kakao trusted origin, Supabase local logout, RevenueCat `logIn`/`logOut`, 사용자별 Journal 저장소 격리.
- 완료: 7일 처리기한 계정 삭제 요청/취소/재시도, 관리자 worker/lease, Apple revoke, RevenueCat delete, 앱 데이터 정리, Auth hard delete 순서.
- 완료: native Apple 로그인 코드, iOS capability/entitlement/SPM 정적 설정, 플랫폼별 상품 모델과 `check:ios-billing` 출시 게이트.
- 완료: root loading/error/global-error, Spot/Journal/Global 복구 UX, 확대·ARIA·focus 복귀, native WebView 제외 PWA 등록.
- 완료: filesystem page manifest coverage, 정확한 redirect `Location`, 보호 API 경계, TypeScript/build를 포함하는 `smoke:all`.
- Android 뒤로가기의 `/crypto/home` 이동은 의도된 정책이므로 수정하지 않았다.

### 최종 로컬 검증

- PASS: `npm.cmd run test:supabase-hotfix`
- PASS: `npm.cmd run test:entitlements`
- PASS: `npm.cmd run test:futures-brief`
- PASS: `npm.cmd run test:auth-boundaries`
- PASS: `npm.cmd run smoke:supabase-security`
- PASS: `npm.cmd run smoke:billing`
- PASS: `npm.cmd run smoke:routes`
- PASS: `npm.cmd run smoke:mobile`
- PASS: `npm.cmd run smoke:all`
- PASS: `cmd /c npx tsc --noEmit`
- PASS: `npm.cmd run build` (64개 정적 페이지 생성 포함)
- PASS: `git diff --check` (CRLF 변환 경고만 존재)
- EXPECTED BLOCK: `npm.cmd run check:ios-billing` — iOS RevenueCat public key, Apple server 자격증명 5개, token encryption key, Xcode `DEVELOPMENT_TEAM` 등 외부 설정 7개가 필요하다.

### 모바일 화면 검증

- CLI Playwright만 사용해 `/crypto`, `/alts`, `/global`, `/news`, `/journal`, `/pro`, `/global/alertlist`, `/account/delete`, `/crypto/perpetual?asset=eth`를 360×800과 390×844에서 확인했다.
- 18개 화면에서 document 가로 넘침 0건, console error 0건을 확인했다.
- ETH 직접 진입은 BTC flash 없이 ETH 선택·문구·pressure·flow·차트 symbol을 표시했다.
- 증거: `output/playwright/qa-2026-07-16-stabilization/`

### 남은 외부 게이트

- 운영 적용 전 profiles 61명/Basic 49명/베타 premium 12명/subscription 0/signal 0/migration ledger 0 기준을 read-only로 다시 집계하고, 베타 대상이 정확히 12명이 아니면 중단한다.
- production migration, subscriptions-only cutover, RevenueCat/Apple/스토어 콘솔 설정, Mac archive/TestFlight, push/deploy/release는 별도 승인 후 수행한다.
- 현재 변경은 미커밋 상태이며 운영 DB와 외부 provider 상태를 변경하지 않았다.
