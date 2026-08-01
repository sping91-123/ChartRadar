# P0 Coin Pro 전환 cohort v2

## 상태

- 로컬 구현: `IMPLEMENTED / RELEASE_VERIFIED`
- 운영 설정: `CONFIGURED / RELEASE_PENDING`
- 신규 cohort: `NOT_STARTED`
- 기준선: 2026-08-01 16:09 KST
- 운영 mutation: additive migration 1건과 내부 QA 이벤트 12건 분류

이 문서는 Basic → Coin Pro 전환 재설계의 고정 상품 계약, cohort, 계측, 판정 기준과 출시 상태를 기록한다. 스토어·웹 출시와 별개로 신규 cohort 시작 시각은 명시적으로 기록하기 전까지 시작하지 않는다.

## 기준선과 기존 베타

| 항목 | 기준선 |
|---|---:|
| 가입자 | 73명 |
| legacy beta 권한 | 12명 |
| 실제 유료 구독 | 0명 |
| 고유 gate 사용자 | 40명 |
| 고유 paywall 사용자 | 12명 |
| gate → paywall 순차 사용자 | 10명(약 25%) |
| 구매 시작 / 유료 권한 활성화 | 0명 / 0명 |

기존 관찰은 `STOPPED_PRE_CHANGE / RELEASE_CONFOUNDED / INCONCLUSIVE`다. legacy beta 권한은 회수하지 않는다. 기준선 이후 UI 감사 이벤트 12건도 삭제하지 않고 `traffic_class='internal'`로 보존해 v2 집계에서 제외한다.

## 상품 계약

| 영역 | Basic | Coin Pro 및 검증된 14일 체험 |
|---|---|---|
| 핵심 판단 | 상태·방향·리스크·확인/무효화 조건, 15분 근거 | 1시간·4시간 정확한 가격·시각, 고급 구간·상세 근거 |
| 알트 | 개별 분석 하루 3종목, 관심목록 1개 | 상품상 일일 분석 제한 없음, 관심목록 50개 |
| AI | 신규 생성 하루 1회, 캐시 재열람 미차감 | 신규 생성 하루 24회, 캐시 재열람 미차감 |
| 자동 감시 | 공유 조건 1개 | 공유 조건 20개와 Pro 알림 규칙 |
| 홈 관심 시세 | 1개 | 5개 |
| 복기 | 수동 복기 | 알림 당시 스냅샷·뉴스·근거 연결 복기 |
| News Impact | 기본 뉴스·요약 | 운영 flag와 품질 검증 통과 전에는 판매 문구에서 제외 |

legacy 연간·Bundle·premium·admin 한도는 축소하지 않는다. Global 전용 상품은 Coin Pro 권한을 부여하지 않는다.

## 고정 퍼널과 데이터 계약

표준 순서는 다음과 같다.

`gate_viewed → pro_cta_clicked → paywall_viewed → store_opened/purchase_started → store_purchase_succeeded → verified_trial_started → entitlement_activated → monitor_created → alert_opened/journal_saved → trial_converted`

현재 이벤트 원장에서는 `gate_viewed`를 기존 호환 이름 `pro_gate_viewed`로, 알림 진입을 `news_alert_opened` 또는 snapshot 연결 `scenario_opened`로 기록한다. 결제·체험·전환·권한 활성화는 billing ledger/RevenueCat sync·webhook만 최종 근거로 사용한다.

- 허용 속성: `source`, `placement`, `routeKey`, `symbol`, `offerId`, `platform`, `authState`, `variant`.
- 원시 URL, 이메일, 결제 주문 ID, 자유 입력값은 저장하지 않는다.
- 익명→로그인은 24시간 일회성 `funnel_session_hash`만 연결한다. 영구 사용자 결합은 하지 않는다.
- `traffic_class`는 서버의 admin/tester 목록 또는 서명된 QA 요청으로만 `internal`이 된다.
- 결제 시작 문맥은 실제 store order에 귀속되는 service-role 전용 원장에 45일만 보존한다. 클라이언트의 합성 plan 이름은 최종 결제 근거로 사용하지 않는다.
- 기준선 이후 내부 QA 이벤트는 운영 적용 시 정확한 UUID 12개를 지정하는 service-role RPC로만 분류한다. 시간대 추정이나 광범위 backfill은 하지 않는다.
- 사용자·익명 이벤트는 90일 보존인 기존 원장 정책을 따른다.

## 신규 cohort

- 포함: 새 기준선 이후 가치 gate를 본 Basic 사용자 중 store 체험 적격 사용자.
- 제외: `traffic_class='internal'`, admin, `legacy_beta`, 현재/과거 유료, 과거 체험 등 store가 체험 비적격으로 판정한 사용자.
- 모집: 기술 검증과 sandbox 결제 통과 후 14일.
- 추적: 마지막 적격 체험자의 D15까지, 재시작일부터 최대 29일.
- 표본 하한: 적격 gate 50명과 검증된 체험 10명. 미달이면 모든 비율은 방향성으로만 보고 가격을 변경하지 않는다.

### 현재 측정 한계

Google Play의 최종 체험 적격 여부는 현재 paywall에서 상품 offer를 조회할 때 확정된다. 따라서 paywall에 도달하지 않은 gate 사용자는 store 기준 체험 적격/비적격을 구분할 수 없다. v2 초기 보고에서는 전체 Basic gate를 참고 분모로 표시하고, `eligible gate → paywall`은 pre-gate 적격성 계약이 생기기 전까지 `DIRECTIONAL ONLY`로만 해석한다. `offerId`만으로 체험 적격을 추정하지 않는다.

## KPI 정의와 잠정 판정선

| KPI | 분자 / 분모 | 판정선 |
|---|---|---:|
| gate → paywall | paywall을 본 고유 funnel / gate를 본 고유 funnel | ≥ 30% |
| paywall → 검증된 체험 | `verified_trial_started` 고유 사용자 / paywall 고유 사용자 | ≥ 10% |
| 24시간 첫 감시 | 체험 시작 24시간 내 `monitor_created` / 체험 시작 | ≥ 60% |
| D7 활성화 유지 | D7까지 재방문 또는 알림·복기 경험 / 첫 감시 생성 체험자 | ≥ 50% |
| D15 실제 유료 전환 | `trial_converted` / 검증된 체험 시작 | ≥ 30% |

- gate→체험이 낮으면 문구·로그인·스토어 마찰을 먼저 본다.
- 체험→첫 감시가 낮으면 복귀·조건 prefill·Push 요청 순서 등 활성화를 먼저 본다.
- 활성화가 높고 유료 전환만 낮을 때에만 차별성과 가격을 다음 문제로 본다.

## 집계 SQL 예시

다음 SQL은 운영 적용 후 읽기 전용 분석에서 사용한다. 실제 schema의 subscription provider 값과 cohort 시작 시각을 다시 확인해야 한다.

```sql
with eligible as (
  select *
  from public.product_events
  where occurred_at >= :cohort_started_at
    and traffic_class = 'user'
    and funnel_session_hash is not null
), first_event as (
  select funnel_session_hash, event_name, min(occurred_at) as first_at
  from eligible
  group by funnel_session_hash, event_name
)
select
  count(distinct funnel_session_hash) filter (where event_name = 'pro_gate_viewed') as gate_users,
  count(distinct funnel_session_hash) filter (where event_name = 'paywall_viewed') as paywall_users,
  count(distinct funnel_session_hash) filter (where event_name = 'verified_trial_started') as trial_users,
  count(distinct funnel_session_hash) filter (where event_name = 'trial_converted') as converted_users
from first_event;
```

정확한 순차 전환은 같은 funnel 안에서 각 단계의 `first_at`이 앞 단계 이후인지 검증하고, 체험·전환의 최종 분모는 billing ledger에서 검증된 사용자만 사용한다.

## 로컬 검증 결과

- `git diff --check`, `npx.cmd tsc --noEmit`, `npm.cmd run build` 통과.
- `smoke:routes`, `smoke:mobile`, `smoke:billing`, `smoke:migrations`, `smoke:copy` 통과. `smoke:ops`의 정적 계약은 통과했지만 현재 외부 매크로 API에 향후 또는 최근 확인 대상 일정이 없어 live coverage 1건만 실패했다. Coin Pro 변경과 무관한 시점 의존 상태이므로 자동 수정하지 않았다.
- `test:entitlements`, `test:product-events`, `test:coin-product-contract`, `test:coin-usage-quotas`, `test:perpetual-beta-report`, `test:perpetual-snapshot`, `test:perpetual-briefing`, `test:perpetual-monitors`, `test:push-targets` 통과.
- RevenueCat 실제 grace 만료, 일반 alias의 canonical 사용자 1명 처리, TRANSFER 출발·도착 순서, 복수 구독의 해지·만료 상품 귀속 회귀 행렬을 통과했다. AI 재열람은 production Upstash 공유 캐시를 먼저 확인해 다른 Vercel instance에서도 같은 입력을 다시 일일 생성량으로 차감하지 않는다.
- Android `:app:compileDebugJavaWithJavac` 통과. Install Referrer 저장·재시도 코드와 App Link manifest가 Java/Android resource 컴파일을 통과했다.
- CLI Playwright에서 360×800과 390×844의 Home·Perpetual·Alt·Spot을 확인했고 모든 화면의 horizontal overflow는 0이었다. 알트 Basic CTA에서 문맥형 paywall 이동도 확인했다. 로컬 sandbox의 외부 시장 API 차단으로 화면은 정상적인 지연·오류 상태를 표시했다.
- 자체 포함 보고서: `output/reports/coin-pro-conversion-v2/index.html`. 보고서 verifier의 1440px·390px 검사와 source dialog 검사를 통과했다.
- 모바일 증거: `output/playwright/coin-pro-v2/coin-pro-paywall-360.png`, `output/playwright/coin-pro-v2/alt-context-paywall-390.png`.

공식 UI의 Scout·Watchlist·알트 사용량은 계정 기준 KST 일일 서버 한도로 강제한다. production에서는 공유 Upstash backend가 없으면 fail-closed하며, Basic 알트 분석은 전체 `MarketAnalysis` localStorage cache를 삭제·비활성화한다. 다만 공개 캔들 데이터를 이용해 사용자가 별도 분석을 재구현하는 것까지 막는 DRM 경계는 아니며, 서버 한도는 ChartRadar가 제공하는 공식 분석 흐름에 대한 상품 계약이다.

`check:coin-pro-release`는 Play App Signing 인증서 SHA-256, analytics HMAC secret, signed QA secret, production Upstash URL/token 쌍, 내부 QA 이벤트 UUID 12개를 주입한 최종 release fixture에서 통과했다. 실제 값은 Vercel Production에 별도로 구성했으며 문서나 테스트 출력에 secret을 남기지 않았다.

## 운영 적용 결과와 남은 게이트

1. Supabase additive migration `20260801103109 coin_pro_conversion_v2`를 적용했다. purchase attribution 원장은 RLS가 켜져 있고 `postgres/service_role`만 접근하며, QA 분류 RPC도 `postgres/service_role`만 실행할 수 있음을 catalog에서 확인했다.
2. 기준선 이후 승인된 UI 감사 이벤트 UUID 12개만 `traffic_class='internal'`로 분류했다. 삭제·시간 범위 일괄 수정은 하지 않았다.
3. Google Play `chart_radar_crypto_monthly:monthly`에 `new-user-14d-trial-v1` offer를 활성화했다. 조건은 이 앱의 구독 이력이 없는 신규 고객, 무료 기간 14일, 이후 월 29,000원 자동 갱신이다.
4. RevenueCat `crypto_monthly → chart_radar_crypto_monthly:monthly → coin_pro` 매핑과 production/sandbox signed webhook을 확인했다.
5. Vercel Production에 Play App Signing SHA-256, 독립 QA secret과 production-only Upstash Redis를 구성했다. Redis는 Vercel이 제공한 `KV_REST_API_URL/TOKEN` alias도 서버가 허용한다.
6. Android `versionCode 13`, `versionName 1.0.9` AAB를 clean signing validation과 `jarsigner`로 검증했다. SHA-256은 `82B2843A4EC0B0997EB22D3748B3FBFEC7E999918E59CAB8F5DDF7366645BEF7`이다. Google Play가 13(1.0.9), target SDK 36, 기존 대비 지원 기기 감소 0으로 인식했으며 프로덕션 변경사항을 저장했다.
7. 대표 지시에 따라 실제 Google Play sandbox 결제 행렬은 생략했다. 따라서 체험 적격/비적격, 결제 성공, 복원, grace/account-hold의 실기기 store 증거는 없는 출시 위험으로 남긴다.
8. 웹 production 배포·실응답·Upstash canary·RevenueCat dashboard TEST와 Google Play 최종 검토 제출을 완료한 뒤에만 신규 cohort 시작 여부를 별도로 기록한다.

가격 인하, 연간 상품 재노출, 웹 결제, 새 대표 기능은 v2 첫 릴리스에서 제외한다.
