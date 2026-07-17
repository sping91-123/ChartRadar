# P0 Pro 권한 수명주기 단일 원장 재설계

## 상태

- 상태: PRODUCTION_GATE_A_B_COMPLETE / CANONICAL_LEDGER_PENDING
- 우선순위: P0
- 위험도: 높음
- 작업 유형: 구현·마이그레이션·출시 게이트
- 구현 상태: subscriptions-only 판정, service-role RPC, RevenueCat reconcile, signal RLS, 반복 가능한 PGlite 회귀까지 로컬 완료
- 운영 변경: 없음
- 관련 후보: `QA-P0-01`, `QA-P0-02`
- 운영 inventory: `docs/work-items/P0-pro-entitlement-phase0-inventory-2026-07-14.md`

## 목표

만료·취소·환불·철회 후에도 Pro 권한이 남거나, UI·서버 API·푸시가 서로 다른 권한을 판정하는 문제를 제거한다. 결제 공급자별 사실을 보존하면서 모든 소비자가 동일한 유효 권한 snapshot을 사용하도록 만든다.

이 문서는 구현 전에 고정한 설계와 2026-07-16 로컬 구현 결과를 함께 보존한다. migration과 코드는 준비했지만 운영 데이터 backfill, RevenueCat/스토어 콘솔 설정, 배포는 수행하지 않았다.

## 확인된 문제

### 1. 권한 원천이 경로마다 다르다

- 서버 API는 활성 `subscriptions`뿐 아니라 `profiles.plan`과 Auth `app_metadata.plan`의 유료 값을 합산한다.
- 브라우저는 활성 subscription, admin, 일부 legacy plan을 중심으로 판정한다.
- 푸시는 활성 subscription과 `profiles.plan`을 합산하지만 app metadata admin은 일관되게 반영하지 않는다.
- 따라서 같은 계정이 UI에서는 Basic, API와 푸시에서는 Pro가 될 수 있다.

### 2. 부여·철회가 원자적이지 않다

- 현재 공통 grant와 관리자 grant는 profile을 먼저 유료로 갱신하고 subscription을 별도 요청으로 기록한다.
- 두 번째 쓰기가 실패하면 유료 profile만 남는다.
- RevenueCat 복수 상품은 병렬 grant되어 마지막 profile write가 비결정적이다.
- RevenueCat 활성 상품이 0개인 정상 snapshot은 기존 row를 revoke하지 않고 404만 반환한다.

### 3. 실제 상품과 계산된 권한이 섞인다

- Coin Pro와 Global Pro를 별도로 구매해도 현재 합산 함수는 `bundle_monthly` 같은 하나의 표시 plan으로 축약할 수 있다.
- 이 과정에서 실제 bundle 구매 여부가 사라지고, 단일 상품에 연결된 quota가 합성 bundle quota로 바뀔 수 있다.
- 상품 ID, 시장별 권한, 표시용 plan을 분리해야 한다.

### 4. 결제·데이터 접근 경계가 약하다

- Toss checkout 주문이 사용자·상품·금액과 DB에서 먼저 결합되지 않아 confirm 시점 사용자와 주문 소유권을 안전하게 대조하기 어렵다.
- subscription 조회가 `select=*`여서 UI에 불필요한 provider 식별자까지 브라우저로 전달된다.
- `signals_public_or_authenticated` RLS는 Pro 권한이 아니라 로그인 여부만 확인한다.
- schema와 migration이 같은 index 이름에 서로 다른 unique key를 정의해 배포 이력에 따라 제약이 달라질 수 있다.

### 5. 즉시 철회와 장애 표현이 불완전하다

- 서버의 bearer token별 2분 메모리 캐시는 환불·관리자 철회 후 이전 권한을 계속 허용할 수 있고 인스턴스 간 무효화도 되지 않는다.
- 권한 조회 오류를 빈 결과와 섞으면 사용자는 실제 Basic 전환과 일시 장애를 구분하지 못한다.

## 승인할 불변식

### 권위 원천

1. 관리자 역할의 권위 원천은 Auth `app_metadata.role = 'admin'` 하나로 제한한다.
2. 정상 유료 권한의 권위 원천은 유효한 `subscriptions` row뿐이다.
3. `profiles.plan`과 admin 외 `app_metadata.plan`은 authorization 입력으로 사용하지 않는다.
4. `profiles.plan`을 한시적으로 유지하더라도 화면 호환용 파생 캐시일 뿐이며 직접 부여하거나 신뢰하지 않는다.
5. 확인된 beta `premium` 12개는 `provider = legacy_beta`, 시작 `profiles.created_at`, 종료 `profiles.created_at + interval '3 months'`인 별도 subscription으로 이관한다.

### 유효 권한 판정

기본 유효 조건은 다음과 같다.

```text
revoked_at IS NULL
AND status IN ('trialing', 'active', 'canceled')
AND current_period_end > now()
```

- `canceled`: 자동 갱신만 해제되고 이미 결제한 기간이 남았으면 기간 종료까지 유지한다.
- `refunded`, `revoked`: 남은 기간과 관계없이 즉시 차단한다.
- `expired`, `inactive`: 차단한다.
- `past_due`: 기본은 차단한다. grace 정책을 별도로 승인한 경우에만 명시적인 종료시각까지 허용한다.
- `current_period_end IS NULL`: 일반 구독 상품에서는 유효하지 않다. 영구 수동 권한을 허용하려면 별도 grant 유형과 감사 사유가 있어야 한다.
- RevenueCat payload에 만료시각이 없거나 잘못됐을 때 현재 시각 기준으로 새 이용 기간을 만들어내지 않는다.

### 유효 권한 snapshot

단일 `plan` 대신 다음 정보를 보존한다.

```ts
type EffectiveEntitlement = {
  state: 'ready' | 'unavailable';
  isAdmin: boolean;
  activePlanIds: BillingPlanId[];
  cryptoEffectivePlan: BillingPlanId | null;
  stocksEffectivePlan: BillingPlanId | null;
  markets: Array<'crypto' | 'stocks'>;
  validUntil: string | null;
  displayPlan: BillingPlanId | 'free'; // 임시 UI 호환용
};
```

- `activePlanIds`는 실제 구매·부여된 상품을 유지한다.
- 시장별 effective plan은 해당 시장 기능과 quota를 계산할 때만 사용한다.
- Coin+Global 개별 구매를 실제 bundle 구매로 기록하거나 표시하지 않는다.
- `displayPlan`은 기존 UI를 한 번에 모두 바꾸지 않기 위한 임시 adapter이며 서버 authorization에는 사용하지 않는다.
- admin override와 유료 subscription은 분리해서 관측·감사할 수 있어야 한다.

## 목표 데이터 모델

### `subscriptions` 보강

기존 table을 삭제하거나 즉시 대체하지 않고 additive migration으로 보강한다.

- `provider_product_id`: 공급자 원본 상품 식별자
- `provider_event_at` 또는 `observed_at`: snapshot/event의 공급자 관측시각
- `revoked_at`: 즉시 권한 종료시각
- `revocation_reason`: refund, chargeback, transfer, admin revoke 등의 정규화된 사유
- 필요한 경우 `provider_payment_id`: 브라우저에 노출하지 않는 결제 식별자
- 제한된 metadata: 원본 payload 전체가 아닌 조사에 필요한 비민감 값만 저장

상태 check constraint에는 최소 `inactive`, `trialing`, `active`, `past_due`, `canceled`, `expired`, `refunded`, `revoked`를 명시한다. 유효 상태가 종료시각 없이 저장되지 않도록 constraint를 추가하되, 기존 데이터 정리 전에는 `NOT VALID`로 도입한 뒤 검증한다.

충돌하는 index는 현재 정의를 읽기 전용으로 조사한 후 명시적으로 drop/recreate한다.

```text
UNIQUE (provider, provider_order_id)
WHERE provider_order_id IS NOT NULL
```

provider order가 이미 다른 사용자에게 귀속돼 있으면 `user_id`를 다시 쓰지 않고 충돌로 거부한다.

### `billing_orders` 추가

Toss 승인 전에 주문을 다음 값과 결합한다.

- 내부 order ID / provider order ID
- `user_id`
- `plan_id`
- 승인된 금액과 통화
- `pending`, `paid`, `failed`, `canceled`, `refunded` 상태
- 생성·승인·환불 시각
- idempotency key

confirm은 저장된 주문 소유자·상품·금액과 공급자 승인 결과가 모두 일치할 때만 entitlement를 반영한다.

### `billing_entitlement_events` 추가

append-only 감사·중복 방지 원장으로 사용한다.

- `(provider, event_id)` unique
- 대상 user, provider, event type, 관측시각, 처리시각
- actor admin ID 또는 시스템 actor
- 처리 결과와 사유
- 민감정보를 제외한 최소 metadata

동일 event는 재시도되어도 한 번만 반영한다.

## DB mutation 계약

세 mutation은 한 transaction 안에서 event 기록, subscription 변경, 필요한 표시 캐시 갱신까지 끝낸다.

### `apply_billing_entitlement`

- 대상: Toss의 검증된 승인·환불, 관리자 manual grant·revoke
- 입력: provider, idempotency key, user, 실제 plan, provider reference, 시작·종료시각, 상태, actor, reason
- 동일 idempotency key 재호출은 기간을 연장하지 않고 같은 결과를 반환한다.
- manual revoke는 명시한 manual grant 또는 scope만 종료하며 Toss/RevenueCat row를 건드리지 않는다.

### `reconcile_provider_entitlements`

- 대상: RevenueCat의 검증된 전체 subscriber snapshot
- 하나의 사용자와 provider에 대해 전체 활성 상품 집합을 한 번에 반영한다.
- 성공적으로 검증된 empty snapshot이면 그 사용자의 RevenueCat row만 revoke한다.
- 장애, 파싱 실패, 알 수 없는 상품은 empty로 해석하지 않고 기존 권한을 보존한 채 오류로 남긴다.
- 더 오래된 `observed_at` snapshot이 최신 상태를 덮지 못한다.
- 복수 상품 upsert와 누락 상품 revoke는 모두 성공하거나 모두 rollback한다.

### `finalize_billing_order`

- 대상: Toss confirm
- 주문 row를 lock하고 로그인 사용자, 상품, 금액, 상태를 검증한다.
- 승인 결과를 한 번 기록하고 같은 transaction에서 entitlement를 부여한다.
- 승인 재시도와 동시 요청은 기간을 다시 계산하거나 연장하지 않는다.

### 함수 권한

- 앱 소유 mutation 함수는 가능한 한 `SECURITY INVOKER`와 완전 수식 relation을 사용한다.
- `PUBLIC`, `anon`, `authenticated`의 execute를 명시적으로 revoke하고 `service_role`만 execute하도록 grant한다.
- 불가피한 `SECURITY DEFINER` 함수는 빈 `search_path`, 완전 수식 relation, 최소 execute grant를 함께 적용한다.
- 기존 `handle_new_user` trigger function도 public execute를 회수하고 동일 기준으로 강화한다.

## 공급자별 수명주기

### RevenueCat

1. 앱은 SDK를 생명주기에서 한 번 configure한다.
2. Supabase 사용자 변경은 RevenueCat의 식별된 App User ID와 `logIn` 흐름으로 맞춘다.
3. 앱 시작·구매·복원 후 전체 subscriber 상태를 서버에 전달하고 서버가 원본 상태를 다시 검증한 뒤 reconcile한다.
4. 활성 상품 0개도 정상 상태로 처리해 RevenueCat 출처만 철회한다.
5. webhook을 사용할 수 있으면 인증 header/HMAC와 event ID를 검증하고, event payload만 믿지 않고 subscriber 전체 상태를 다시 조회해 reconcile한다.
6. webhook을 사용할 수 없는 요금제라면 앱 시작 sync와 승인된 주기 reconciliation을 조합한다.
7. 자연 만료는 DB 시각 판정만으로 즉시 차단되므로 webhook 지연과 무관하게 안전해야 한다.

RevenueCat 장애와 검증된 empty snapshot은 반드시 다른 결과여야 한다.

### Toss

1. checkout 시 authenticated user에 귀속된 pending `billing_orders` row를 먼저 만든다.
2. 공급자 confirm 요청은 DB transaction 밖에서 수행한다.
3. 성공 응답은 `finalize_billing_order`에서 소유권·금액·상품을 재검증하고 원자적으로 반영한다.
4. 기간은 공급자의 `approvedAt` 등 검증된 기준시각으로 한 번만 계산한다.
5. 환불·chargeback은 검증된 webhook 또는 reconciliation 경로가 준비되기 전에는 운영 재개하지 않는다.

### 관리자 manual 권한

- request ID, actor admin ID, reason, duration을 필수화한다.
- 동일 request ID는 no-op이며, 연장은 새 event로 기록한다.
- 화면의 “Basic 전환”은 “manual 권한 철회”로 이름과 동작을 일치시킨다.
- 외부 provider 구독은 관리자 화면에서 임의 취소하지 않고 공급자 상태와 reconcile한다.
- 복수 subscription과 출처, 상태, 종료일을 모두 표시한다.

## 읽기·RLS·노출 모델

### 공통

- policy는 역할을 명시해 `TO authenticated`를 사용하고 user 비교는 `(select auth.uid())` 형태로 고정한다.
- table privilege와 RLS를 별도 보안층으로 관리한다.
- 신규 public table의 자동 Data API 노출 여부에 의존하지 않고 migration에 `GRANT`/`REVOKE`를 명시한다.

### `profiles`

- authenticated 사용자는 본인 row의 필요한 열만 읽는다.
- 브라우저 DML은 현재 실제 사용 범위를 확인한 뒤 최소 열로 제한한다.
- plan 값은 authorization에 사용하지 않는다.

### `subscriptions`

- 브라우저는 본인 row에서 `plan`, `status`, `market_scope`, `current_period_end` 등 권한 표시에 필요한 안전한 열만 읽는다.
- provider customer/payment/subscription/order 식별자는 브라우저에 노출하지 않는다.
- `select=*`를 명시적 열 목록으로 교체한다.
- anon/authenticated의 subscription mutation은 revoke한다.

### `signals`

- 현재 직접 소비 경로와 안전한 시장 분류가 확인되지 않았으므로 1차 P0에서는 anon/authenticated의 비공개 signal 접근을 fail-closed로 닫는다.
- 직접 제공이 필요하면 `access_tier`와 `market_scope`를 명시하고 public/member/premium policy를 분리한다.
- premium은 시장 scope가 일치하는 유효 subscription을 `EXISTS`로 확인한다.
- 단순 `auth.role() = 'authenticated'`는 Pro authorization으로 사용하지 않는다.
- 미분류 premium row는 노출하지 않는다.

## 오류·캐시 정책

- 서버 authorization 경로의 2분 process-local Map 캐시는 제거한다.
- UI 캐시는 표시 최적화로만 사용하고 mutation 후 refresh, 보조 polling, 가장 가까운 만료시각 timer를 둔다.
- 권한 저장소 조회 실패는 `authenticated + unavailable`로 표현한다.
- 보호 API는 권한 확인 장애에서 401/Basic으로 위장하지 않고 503을 반환한다.
- UI는 upgrade CTA 대신 “권한 확인이 지연되고 있습니다”와 재시도를 제공한다.
- 철회 직후 첫 보호 API 요청부터 거부되어야 하며 여러 서버 인스턴스에서 결과가 같아야 한다.

## 단계별 마이그레이션

### Phase 0. 운영 read-only inventory

2026-07-14 완료. 운영 결과와 다음 중단 게이트는 `docs/work-items/P0-pro-entitlement-phase0-inventory-2026-07-14.md`에 기록했다.

- 운영 migration ledger는 비어 있고 schema는 local migration의 일부만 수동 적용된 상태다.
- `profiles.plan`, `subscriptions.plan`, `market_scope`, `provider_order_id`가 운영에 없다.
- subscription은 0건이며 premium profile 12개가 모두 legacy 권한이다.
- authenticated 사용자가 본인 `membership_tier`를 직접 바꿀 수 있는 P0 권한 상승 경로가 확인됐다.
- beta 12개 정책은 계정 생성일 기준 3개월로 확정됐다. profile self-update hotfix와 production baseline 전략이 검증되기 전에는 Phase 1로 넘어가지 않는다.

개인정보나 provider secret을 출력하지 않고 count와 제약 정의를 수집한다.

- `pg_indexes`, `pg_constraint`, `pg_policies`
- table/column grants와 function execute privilege
- paid profile인데 유효 subscription이 없는 계정 수
- 만료·null 종료일·알 수 없는 status·plan/scope 불일치 row 수
- `(provider, provider_order_id)` 중복 수
- Auth app metadata의 admin·유료 plan 사용 수
- RevenueCat product/entitlement mapping과 현재 Google Play 상품 대조

이 단계에서 운영 snapshot과 복구 지점을 확보한다. 결과가 예상과 다르면 migration을 작성하지 않고 중단한다.

### Phase 1. additive schema와 테스트 기반

- 신규 열, `billing_orders`, `billing_entitlement_events`, canonical index, RPC, 명시적 privilege를 추가한다.
- 기존 열과 fallback은 아직 제거하지 않는다.
- 상태 행렬 unit test와 로컬 DB/RLS 통합 테스트를 먼저 추가한다.

### Phase 2. legacy backfill과 shadow 비교

- admin profile은 subscription으로 바꾸지 않고 Auth admin 역할로 정규화한다.
- 이미 유효 subscription이 있는 paid profile은 중복 grant하지 않는다.
- 확인된 beta premium 12개만 `provider = legacy_beta`, `current_period_start = profiles.created_at`, `current_period_end = profiles.created_at + interval '3 months'`로 이관한다.
- 원본 plan과 migration review 표시를 audit metadata에 남긴다.
- 기존 resolver와 신규 resolver 결과를 개인정보 없이 count로 비교한다.

### Phase 3. write 경로 전환

- 관리자 manual mutation을 RPC로 전환한다.
- RevenueCat을 full-state reconciliation으로 전환한다.
- Toss를 유지한다면 order binding과 atomic finalize를 먼저 적용한다.
- 각 provider 전환을 별도 검증·커밋 단위로 나눈다.

### Phase 4. read 경로 전환

- client, server API, push가 같은 snapshot 규칙을 사용하도록 함께 전환한다.
- admin 외 profile/app metadata paid fallback을 제거한다.
- quota와 시장 gating은 시장별 effective plan을 사용한다.
- 배포 관찰 기간 동안 legacy/new 판정 차이와 5xx, revoke 지연을 모니터링한다.

### Phase 5. RLS와 정리

- subscription 안전 열 노출과 signal 정책을 별도 migration으로 검증한다.
- 최소 한 release 관찰 후 `profiles.plan` 캐시 정리 여부를 결정한다.
- 오래된 호환 열과 feature flag 삭제는 별도 후속 작업으로 둔다.

## rollback 원칙

- DB migration은 additive·forward-only로 유지하고 down migration으로 신규 event/order 데이터를 삭제하지 않는다.
- read cutover는 서버 전용 `ENTITLEMENT_READ_MODE=subscriptions_only|legacy_merged` 같은 한시적 flag로 되돌릴 수 있게 한다.
- rollback은 앱 read mode를 compatibility로 되돌리되 신규 subscription/event 사실은 보존한다.
- 잘못된 migration은 compensating migration으로 수정한다.
- RLS 장애가 나도 모든 authenticated 사용자에게 premium을 다시 여는 정책으로 복구하지 않는다. premium을 일시적으로 닫는 fail-closed 정책을 사용한다.
- provider별 write 전환은 독립적으로 끌 수 있어야 하며 검증되지 않은 empty 상태를 revoke로 처리하지 않는다.

## 필수 테스트 행렬

| 영역 | 케이스 | 기대 결과 |
| --- | --- | --- |
| 기본 | free, 활성 subscription 없음 | 모든 Pro scope 거부 |
| 활성 | crypto / stocks / 실제 bundle | 구매한 scope만 허용 |
| 복수 | Coin+Global 개별 구매 | 두 scope 허용, 실제 상품 두 개 보존 |
| 경계 | `current_period_end = now()` 또는 과거 | 즉시 거부 |
| 취소 | canceled, 기간 남음 / 기간 종료 | 남은 기간만 허용 / 종료 후 거부 |
| 철회 | refunded 또는 `revoked_at` 존재 | 남은 기간과 무관하게 즉시 거부 |
| 연체 | past_due | 승인된 grace 외 거부 |
| stale | paid profile만 있고 subscription 없음 | admin/승인된 legacy 외 거부 |
| 관리자 | `app_metadata.role=admin` | 역할 override 허용, 별도 기록 |
| 장애 | entitlement 조회 실패 | API 503, UI unavailable 안내 |
| RevenueCat | 동일 snapshot 반복 | 상태·기간 변화 없음 |
| RevenueCat | 검증된 empty snapshot | RevenueCat row만 revoke |
| RevenueCat | 장애·unknown product | 기존 권한 보존, 오류 기록 |
| RevenueCat | 오래된 snapshot 도착 | 최신 상태 유지 |
| Toss | 다른 사용자가 주문 confirm | 403/409, 권한 변화 없음 |
| Toss | confirm 재시도·동시 요청 | canonical row 하나, 기간 연장 없음 |
| Manual | 동일 request ID 반복 | 한 번만 반영 |
| Manual | 특정 grant revoke | 다른 provider 권한 유지 |
| RLS | anon / Basic / Coin Pro / Global Pro | 허용 tier와 시장만 조회 |
| RLS | 타 사용자 subscription | 0행 |
| RLS | anon/authenticated mutation/RPC | 거부 |
| 노출 | 브라우저 subscription 조회 | provider 비밀 식별자 미노출 |
| 캐시 | revoke 직후·다중 인스턴스 | 첫 요청부터 동일하게 거부 |
| 호환 | read mode rollback | 데이터 삭제 없이 이전 앱 동작 복구 |

## 예상 구현 파일

### DB

- Supabase CLI로 생성할 신규 migration
- `supabase/schema.sql`
- 신규 entitlement/RLS 통합 테스트 SQL 또는 스크립트

### 모델·판정

- `src/lib/billing.ts`
- `src/lib/supabase.ts`
- `src/lib/server/requestEntitlement.ts`
- `src/lib/useSupabaseAuth.ts`
- `src/lib/server/push/entitlements.ts`
- 세 경로가 공유할 신규 순수 resolver

### mutation·공급자

- `src/lib/server/billingEntitlements.ts`
- `src/lib/server/supabaseAdmin.ts`
- `src/app/api/billing/app-store/sync/route.ts`
- `src/app/api/billing/checkout/route.ts`
- `src/app/api/billing/confirm/route.ts`
- `src/app/api/admin/entitlements/route.ts`
- 필요한 경우 별도 webhook/reconciliation route

### UI·검증

- `src/app/admin/entitlements/page.tsx`
- `src/components/ProPricingPanel.tsx`
- 실제 quota·gating 소비자
- `scripts/smoke-billing.mjs`
- 신규 entitlement unit/integration 및 Supabase security smoke

## 구현 단위와 검증

한 번에 전체를 바꾸지 않고 아래를 각각 별도 승인·검증 가능한 작업으로 나눈다.

1. read-only production inventory와 정책 결정
2. 상태 행렬 순수 resolver 테스트
3. additive schema/RPC migration과 로컬 DB 보안 테스트
4. legacy backfill dry-run과 shadow 비교
5. RevenueCat reconciliation
6. Toss order binding 또는 Toss 경로 보류 결정
7. 관리자 manual mutation
8. client/server/push read cutover
9. signal RLS와 최소 grant
10. 관찰 후 legacy/profile cache 정리

각 구현 작업의 공통 검증:

```powershell
npm.cmd run smoke:billing
npm.cmd run smoke:ops
npm.cmd run smoke:all
cmd /c npx tsc --noEmit
npm.cmd run build
git diff --check
```

DB 작업에는 해당 환경에서 지원되는 Supabase CLI 명령을 `--help`로 먼저 확인한 뒤 local reset, migration 검증, RLS role matrix, database/security advisor를 추가한다. 이번에는 `npx` Supabase CLI 2.109.1로 migration 파일만 생성했다. repo 의존성 및 `supabase/config.toml`이 없어 로컬 DB 통합 검증은 실행할 수 없다.

## 구현 전 필요한 대표 결정

결정 완료:

- beta premium 12개는 각 계정 생성일로부터 3개월간 전체 시장 혜택을 유지한다.
- backfill 공식은 `profiles.created_at + interval '3 months'`이며 출처는 `legacy_beta`로 분리한다.

추가 결정 완료:

1. `past_due`는 grace 없이 즉시 차단한다.
2. Coin+Global 개별 구매는 실제 상품 두 개를 보존하고 시장별 권한만 합성한다. 실제 bundle 구매로 기록하지 않는다.
3. 영구 manual grant는 금지하고 최대 365일로 제한한다.
4. signal은 `public | premium`과 `crypto | stocks | bundle` scope로 분리하고 기본값은 fail-closed premium이다.
5. RevenueCat webhook은 HMAC 검증 후 원본 이벤트를 직접 권한으로 쓰지 않고 최신 subscriber snapshot을 다시 조회한다.
6. Toss 웹 결제는 계속 비활성화하고 checkout/confirm은 `410 Gone`을 유지한다.
7. 운영은 과거 migration 전체 push 없이 현재 catalog 기준 forward-only migration만 순서대로 적용한다.

## 중단 조건

- 운영 DB의 실제 index·constraint·policy·grant inventory가 확보되지 않은 경우
- beta backfill dry-run이 정확히 12개를 찾지 못하거나 중복 grant를 발견한 경우
- RevenueCat empty 상태와 장애 상태를 확실히 구분할 수 없는 경우
- provider order를 기존 사용자에게서 다른 사용자로 재귀속해야 하는 결과가 나온 경우
- production snapshot·복구 지점이 없는 경우
- 수정 범위가 인증, 결제, 운영 데이터, provider 콘솔, release/deploy로 확장됐지만 별도 승인이 없는 경우

## 이번 단계 완료 기록

- P0-A self-upgrade 차단 migration과 정적 보안 smoke를 로컬 초안으로 추가했다.
- PGlite 기반 production `membership_tier`/repo `plan` 역할·RLS·signup·legacy subscription trigger 회귀 테스트를 추가해 통과했다.
- 이 초안은 profile/subscription DML을 포함하지 않으며 beta 12명의 현재 값을 바꾸지 않는다.
- 운영 DB와 사용자 결제 데이터는 조회·변경하지 않았다.
- Codex in-app Browser를 실행하지 않았다.
- 설계와 영향 범위, migration·rollback·test matrix를 확정하고 정적·앱 빌드 검증을 통과했다.
- commit, push, deploy는 수행하지 않았다.

## 2026-07-16 로컬 구현 완료 기록

- 정상 권한 판정에서 `profiles.plan`, `membership_tier`, admin 외 `app_metadata.plan` fallback을 제거하고 유효한 `subscriptions`만 신뢰하도록 통일했다.
- `past_due`, `refunded`, `revoked`, `expired`, `inactive`, 종료시각 누락을 차단하고 `canceled`는 미래 종료시각까지만 유지하는 상태 행렬을 고정했다.
- service-role 전용 `apply_billing_entitlement`, `reconcile_provider_entitlements` RPC와 `(provider, event_id)` 멱등 event 원장을 추가했다.
- RevenueCat 전체 subscriber snapshot만 reconcile하며 verified empty만 철회하고, stale/unknown/incomplete/provider 장애는 기존 원장을 덮지 않도록 했다.
- 베타 대상은 `provider=legacy_beta`, `profiles.created_at + interval '3 months'`로 이관하는 dry-run/count/cohort-hash guard를 추가했다. 실제 12명 운영 backfill은 실행하지 않았다.
- signal을 `visibility`와 `market_scope` 기준 fail-closed RLS로 바꾸고 anon/authenticated DML 및 premium 직접 읽기를 차단했다.
- 활성 migration은 4개의 forward-only 파일로 제한하고 과거 May/June 파일은 `supabase/legacy-migrations/`에 보존했다.
- PGlite에서 production-shape, repository-shape, fresh DB를 각각 반복 적용해 catalog 수렴, RPC rollback/멱등, owner transfer, grant, RLS 행렬을 검증했다.
- Toss checkout/confirm은 `410 Gone`으로 유지했으며 공급자 호출과 entitlement write를 하지 않는다.
- 운영 DB mutation, provider 콘솔 변경, push, deploy, release, commit은 수행하지 않았다.

## 2026-07-17 운영 preflight 결과

- 최신 집계는 profile 62명, free 50명, beta premium 12명, subscription 0건, signal 0건이다.
- beta 수는 계획의 필수 조건인 정확히 12명을 충족하고 non-legacy subscription 충돌도 0건이다.
- migration ledger table은 존재하지 않아 과거 migration 전체 `db push` 금지 조건을 유지한다.
- 운영에는 profile self-upgrade, broad signal policy/DML, 공개 SECURITY DEFINER 실행 취약점이 그대로 남아 있다.
- 적용 순서와 검증·중단 조건은 `docs/production-entitlement-cutover-runbook.md`에 고정했다.
- 별도 운영 승인 전까지 DDL, beta backfill, subscriptions-only cutover는 실행하지 않는다.

## 2026-07-17 Gate A+B 완료 기록

- 운영 profile self-upgrade 차단과 signal emergency fail-closed migration을 별도 승인에 따라 적용했다.
- migration ledger에는 승인된 두 항목만 존재한다.
- 실제 disposable Basic JWT 및 REST 역할 검증과 service-role 회귀가 통과했다.
- 최종 운영 기준선은 profile/auth user 62/62, free 50, beta premium 12, subscription 0, signal 0이며 beta cohort hash는 불변이다.
- signal Data API는 Gate C가 final `public/premium` market-scope 정책을 설치할 때까지 의도적으로 완전 차단 상태다.
- 남은 advisor 경고인 공개 `handle_new_user()`/`sync_membership_tier()` SECURITY DEFINER 실행과 `set_updated_at` search path는 Gate C 검토 범위다.
- Gate C schema/RPC 및 beta DML은 별도 명시 승인 전 실행하지 않는다.

### Gate C 승인 전 advisor 반영

- 운영 함수/trigger 정의를 read-only로 확인한 결과 production profile에는 `email`/`plan` 열이 없고 legacy `on_subscription_change` trigger가 남아 있었다.
- 기존 canonical 초안의 `handle_new_user()`가 production에 없는 `profiles.email`을 전제로 해 다음 signup을 깨뜨릴 수 있는 배포 차단 결함을 발견했다.
- signup 함수가 실제 profile 열을 동적으로 감지하도록 수정하고, 공개 SECURITY DEFINER 실행 회수, legacy tier-sync trigger 제거, `set_updated_at` search path 고정을 추가했다.
- `test:entitlements`, `smoke:migrations`, `smoke:supabase-security`, `git diff --check`가 통과했다.
- 이 보강된 Gate C는 아직 운영에 적용하지 않았다.

## 2026-07-17 Gate C schema/dry-run 완료와 보안 중단점

- 운영 migration ledger에 `20260717131436 canonical_entitlement_ledger`가 추가됐다.
- 첫 적용 실패는 누락된 legacy signal `triggered_at` 가정이 원인이었고 트랜잭션 전체 롤백을 확인했다. 실제 `fired_at` 보존 이관과 legacy subscription provider/tier constraint 제거를 추가한 뒤 재검증·적용했다.
- production catalog에서 profile self-update 차단, final signal SELECT RLS, DML 회수, canonical subscription constraints/index, service-role 전용 mutation RPC, legacy tier trigger 제거를 확인했다.
- publishable JWT 역할 행렬과 disposable signup/cleanup이 통과했다.
- beta dry-run 결과는 `eligible_count=12`, `conflicting_count=0`, `changed=false`, cohort hash 일치다. subscriptions와 entitlement events는 각각 0건으로 유지됐다.
- advisor에서 event ledger의 service-role 비append 권한, 중복 legacy subscription policy, authenticated SECURITY DEFINER helper를 발견했다.
- row DML 없는 `20260717133500_gate_c_advisor_hardening.sql`과 `20260717134000_lock_beta_backfill_cohort.sql`을 로컬 준비했다. 후자는 auth users → profiles → subscriptions 순서로 transaction lock을 획득해 count/hash/conflict 검사와 apply가 동일 cohort를 사용하게 한다. 별도 승인·운영 재검증 전에는 beta `p_dry_run=false`를 호출하지 않는다.

## 2026-07-17 구현·운영 완료

- Gate C advisor hardening과 beta cohort transaction lock을 운영에 적용한 뒤 동일 dry-run hash로 beta 12명 backfill을 완료했다.
- `legacy_beta` subscription과 멱등 event가 각각 12건이며, 시작은 각 `profiles.created_at`, 종료는 정확히 3개월 후다.
- 계정 삭제 요청 원장과 retry hardening을 운영에 적용하고 disposable Basic 계정으로 단건 hard-delete E2E를 완료했다. beta 12명에는 삭제 mutation을 실행하지 않았다.
- 서버 authorization, RevenueCat sync/webhook, 관리자 mutation, client display와 push entitlement를 subscriptions-only로 통일했다. profile/app metadata의 유료 fallback은 복구 경로로도 남기지 않았다.
- 최종 필수 test/smoke/TypeScript/lint/build/audit와 모바일 CLI Playwright QA가 통과했다.
- 남은 항목은 배포 환경의 RevenueCat HMAC·삭제 worker/cron 설정, Apple 외부 자격증명과 Mac archive/TestFlight뿐이며 entitlement/RLS 코드 결함은 완료 처리한다.
