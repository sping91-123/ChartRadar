# Production entitlement cutover runbook

## 상태

- 상태: `GATE_D_COMPLETE / LEGACY_BETA_BACKFILL_COMPLETE / SUBSCRIPTIONS_ONLY_READY`
- 기준 시각: 2026-07-17 KST
- 대상 project: `dbdouafktptajamanyno`
- 실행 원칙: 단계별 승인, forward-only, fail-closed, 과거 migration 전체 `db push` 금지
- 현재 운영 변경: Gate A~D, advisor hardening, cohort lock, beta 12명 backfill, account-deletion retry hardening 적용 완료

## 현재 운영 기준선

| 항목 | 값 |
| --- | ---: |
| profiles / auth users | 63 / 63 |
| Basic / non-admin beta premium | 51 / 12 |
| admin | 1 |
| premium 생성 월 | 2026-05: 12 |
| beta cohort hash | `23514409169df37bd42368113e94cb60` |
| non-legacy subscription 충돌 | 0 |
| subscriptions / signals | 12 / 0 |
| migration ledger | 승인된 7건 |
| entitlement events / deletion requests | 12 / 0 |

profile 61명/Basic 49명이었던 최초 기준선에서 신규 Basic 2명이 증가했다. beta 12명과 cohort hash는 변하지 않았으므로 beta-count 중단 조건은 발생하지 않았다.

## 절대 금지

- `supabase db push`로 archive migration을 포함한 전체 이력을 재생하지 않는다.
- 한 번에 네 migration을 적용하지 않는다.
- dry-run cohort hash를 확인하지 않고 beta backfill을 실행하지 않는다.
- 실제 Basic JWT, service-role, signup trigger 검증 없이 다음 단계로 넘어가지 않는다.
- unknown RevenueCat 상품이나 snapshot 부재 상태에서 기존 권한을 철회하지 않는다.
- 운영 ledger와 로컬 파일명이 다르므로 이후에도 전체 `supabase db push`를 실행하지 않는다.

## Gate A — profile self-upgrade 즉시 차단

적용 파일:

- `supabase/migrations/20260714120423_close_profile_entitlement_self_upgrade.sql`

적용 전 확인:

- non-admin premium = 12
- beta cohort hash가 기준선과 일치
- profiles/auth users = 동일
- service role과 signup trigger 정의가 존재

적용 후 필수 확인:

1. 실제 publishable JWT의 Basic 계정 `membership_tier` UPDATE가 `42501` 또는 0행으로 거부된다.
2. Basic 본인 profile SELECT는 유지된다.
3. service-role profile 작업과 신규 signup profile 생성은 정상이다.
4. beta 12명의 tier/created_at aggregate와 cohort hash가 불변이다.
5. security advisor를 다시 실행한다.

Gate A는 권한 상승 차단이므로 적용 후 broad UPDATE 권한을 다시 열어 rollback하지 않는다. 오류는 compensating forward migration으로 수정한다.

## Gate B — signal fail-closed

적용 파일:

- `supabase/migrations/20260715164519_close_signal_entitlement_gap.sql`

적용 후 필수 확인:

1. anon/authenticated INSERT/UPDATE/DELETE 권한이 없다.
2. anon/authenticated SELECT도 임시로 모두 차단된다.
3. signal 0건 기준선은 불변이다.

이 migration은 emergency fail-closed 단계다. `public/premium` 및 market-scope SELECT 정책은 Gate C의 canonical ledger migration이 설치한다. 현재 운영 signal이 0건이므로 Gate B와 Gate C 사이에 사용자 데이터 손실은 없지만, Gate C 전까지 Data API signal 읽기는 의도적으로 닫힌다.

Gate B도 fail-closed 보안 변경이므로 broad authenticated policy로 되돌리지 않는다.

## Gate A+B 적용 결과

- Gate A migration ledger: `20260717092124 close_profile_entitlement_self_upgrade`
- Gate B migration ledger: `20260717092324 close_signal_entitlement_gap`
- Gate A catalog: public/anon/authenticated profile UPDATE와 authenticated `membership_tier` UPDATE 모두 제거, profile UPDATE policy 0개.
- Gate A 실제 REST: disposable Basic 가입 profile `free` 생성, self-upgrade HTTP 403, service-role profile UPDATE 정상.
- Gate B catalog: public/anon/authenticated signal SELECT·DML 제거, service-role SELECT·DML 유지, policy 0개.
- Gate B 실제 REST: anon SELECT HTTP 401, authenticated SELECT/DELETE HTTP 403.
- 두 disposable Auth user와 profile은 각 검증 직후 삭제했으며 최종 profiles/auth users는 62/62로 복원됐다.
- beta 12명, cohort hash, 2026-05 생성 월, subscription 0건, signal 0건은 모두 불변이다.
- advisor의 `signals RLS enabled/no policy` 정보는 Gate B의 의도된 emergency fail-closed 상태다. 공개 SECURITY DEFINER 함수와 mutable search path는 Gate C 전 남은 보안 항목이다.
- Gate C 및 beta backfill은 실행하지 않았다.

## Gate C — canonical entitlement ledger와 beta 이관

적용 파일:

- `supabase/migrations/20260715164522_canonical_entitlement_ledger.sql`

Gate A+B 적용 후 advisor/운영 shape 재검토로 다음 항목을 canonical migration에 추가했다.

- production `profiles`에 `email` 또는 `plan` 열이 없어도 동작하는 동적 signup trigger
- `handle_new_user()`의 empty search path와 public/anon/authenticated EXECUTE 회수
- legacy `on_subscription_change` profile tier-sync trigger 제거
- legacy `sync_membership_tier()`의 public/anon/authenticated EXECUTE 회수
- 기존 `set_updated_at()`의 empty search path 고정
- production legacy signal의 `fired_at`을 보존하는 additive `triggered_at` 이관
- legacy `subscriptions_provider_check`와 `subscriptions_tier_check` 제거

첫 적용은 production legacy signal에 `triggered_at` 열이 없어 트랜잭션 전체가 롤백됐다. 실제 운영 signal/subscription shape를 fixture로 재현해 위 두 호환 보강을 추가한 뒤 PGlite production/repository/fresh shape 반복 적용, 신규 signup, 함수 ACL, legacy trigger 제거 테스트를 통과했다. 보강본은 migration ledger `20260717131436 canonical_entitlement_ledger`로 운영에 적용됐다.

schema 적용 후 beta DML 전에 다음 dry-run을 실행했다.

```sql
select public.backfill_legacy_beta_entitlements(12, true, null);
```

실제 결과:

- `eligible_count = 12`
- `conflicting_count = 0`
- `cohort_hash = 23514409169df37bd42368113e94cb60`
- `changed = false`

세 값이 모두 일치할 때만 별도 승인 후 동일 hash로 apply한다.

실제 publishable JWT/REST 결과:

- disposable Basic signup과 `free` profile 생성 정상
- authenticated profile self-upgrade HTTP 403
- anon/Basic signal SELECT HTTP 200, signal 0건으로 빈 배열
- authenticated signal DELETE HTTP 403
- beta backfill RPC anon HTTP 401, authenticated HTTP 403
- disposable user/profile 삭제 확인

dry-run 직후에도 subscriptions 0건, `legacy_beta` 0건, entitlement events 0건, signals 0건이며 profile/auth user 63/63, Basic 51명, beta 12명과 cohort hash가 불변이다. `p_dry_run=false`는 호출하지 않았다.

Gate C 적용 후 advisor는 다음 후속 보강을 요구한다.

- `billing_entitlement_events`에서 service-role의 `TRUNCATE/REFERENCES/TRIGGER` 권한 회수
- 중복 legacy policy `본인 구독 읽기` 제거
- `has_effective_market_entitlement`을 SECURITY INVOKER로 전환

위 세 항목은 row DML이 없는 `20260717133500_gate_c_advisor_hardening.sql`로 로컬 준비하고 회귀 테스트를 통과했다. dry-run 검증과 실제 apply 사이의 cohort 경쟁도 막기 위해 `20260717134000_lock_beta_backfill_cohort.sql`에서 auth users → profiles → subscriptions 순서의 transaction lock을 추가했다. 두 후속 migration은 별도 운영 승인 전에는 적용하지 않으며, 적용·advisor/JWT·재-dry-run 검증 전 beta backfill도 실행하지 않는다.

```sql
select public.backfill_legacy_beta_entitlements(
  12,
  false,
  '23514409169df37bd42368113e94cb60'
);
```

적용 후 확인:

- provider `legacy_beta` 12건, 중복 0건
- 시작일 `profiles.created_at`, 종료일 `created_at + interval '3 months'`
- 이미 종료된 혜택은 활성 권한으로 판정되지 않음
- profile 값은 authorization 원천으로 사용되지 않음
- RPC는 service-role만 실행 가능하고 event 원장은 append-only

## Gate D — 계정 삭제 원장

적용 파일:

- `supabase/migrations/20260715164525_account_deletion_requests.sql`

production worker는 migration과 별개로 `ACCOUNT_DELETION_PROCESSING_ENABLED`, cron secret, Apple/RevenueCat 자격증명을 모두 검증한 뒤 활성화한다. disposable 계정 외 실제 삭제 테스트는 금지한다.

## 앱 cutover와 외부 설정

DB Gate A~D와 실제 JWT/REST 행렬이 통과한 뒤에만 다음을 진행한다.

1. RevenueCat 상품/entitlement mapping과 HMAC webhook secret 설정
2. shadow 비교에서 legacy/new 판정 차이 0 확인
3. 서버·클라이언트·push를 `subscriptions_only`로 배포
4. 24시간 또는 정상 refresh 주기 관찰
5. Apple 자격증명/Xcode team/Mac archive/TestFlight 검증

## 즉시 중단 조건

- non-admin premium이 12명이 아님
- cohort hash 불일치
- subscription 충돌 또는 provider order owner 충돌
- migration 적용 후 Basic JWT/REST 역할 행렬 실패
- signup trigger 또는 service-role 경로 실패
- beta aggregate 변경
- RevenueCat unknown product, stale/missing snapshot, provider 장애
- 예상하지 못한 advisor security error

중단 시 신규 DB 사실은 삭제하지 않고 feature flag를 끄거나 compensating migration으로 roll-forward한다.

## 2026-07-17 최종 운영 적용 결과

대표의 전체 승인 후에도 각 단계의 count/hash/JWT 역할 검증을 유지한 채 다음 순서로 적용했다.

| 운영 ledger | 로컬 forward migration | 결과 |
| --- | --- | --- |
| `20260717092124 close_profile_entitlement_self_upgrade` | `20260714120423_close_profile_entitlement_self_upgrade.sql` | profile self-upgrade 차단 |
| `20260717092324 close_signal_entitlement_gap` | `20260715164519_close_signal_entitlement_gap.sql` | signal emergency fail-closed |
| `20260717131436 canonical_entitlement_ledger` | `20260715164522_canonical_entitlement_ledger.sql` | canonical subscription/RPC/RLS 설치 |
| `20260717132758 gate_c_advisor_hardening` | `20260717133500_gate_c_advisor_hardening.sql` | event ACL·중복 policy·helper 보강 |
| `20260717132902 lock_beta_backfill_cohort` | `20260717134000_lock_beta_backfill_cohort.sql` | beta cohort transaction lock |
| `20260717133217 account_deletion_requests` | `20260715164525_account_deletion_requests.sql` | 삭제 요청 원장/RPC 설치 |
| `20260717134623 harden_account_deletion_retry` | `20260717143000_harden_account_deletion_retry.sql` | deadline 멱등·실패 backoff·수동 retry |

운영 ledger 버전은 실제 적용 시각을 사용하고 로컬 파일은 repository의 forward-only 이력을 유지한다. 두 버전이 다르므로 전체 migration replay나 `supabase db push`는 계속 금지한다.

beta apply 직전 dry-run은 `eligible_count=12`, `conflicting_count=0`, cohort hash `23514409169df37bd42368113e94cb60`이었다. 동일 hash를 필수 인자로 실제 apply한 결과 `legacy_beta` subscription 12건과 멱등 event 12건이 생성됐다. 각 기간은 `profiles.created_at`부터 정확히 3개월이며 다른 provider/order 충돌은 0건이다.

최종 운영 집계는 auth users/profiles 63/63, Basic 51명, beta premium 12명, subscriptions 12건, entitlement events 12건, signals 0건, account deletion requests 0건, OAuth provider credentials 0건이다. beta cohort hash는 불변이다.

실제 publishable JWT로 profile self-upgrade 거부, signal 역할 행렬, mutation RPC의 authenticated 거부, signup trigger와 service-role 경로를 재검증했다. 표시 있는 일회용 Basic 계정을 생성해 삭제 요청·취소·processing lock·실패 backoff·수동 retry·최종 hard delete를 단건 `requestId` 경로로 검증했고, 종료 후 Auth/profile/deletion row가 모두 제거되고 beta 12명 aggregate가 유지됨을 확인했다.

Security advisor의 남은 항목은 append-only 내부 원장과 Apple OAuth credential table의 의도된 no-policy INFO, leaked-password protection 비활성화 WARN이다. performance advisor의 기존 initplan/unused-index 경고는 기능·권한 차단과 분리해 후속 성능 작업으로 관리한다.

## 배포 전 운영 설정 게이트

- `ACCOUNT_DELETION_PROCESSING_ENABLED=true`, `CRON_SECRET`, RevenueCat webhook signing secret과 provider REST 자격증명을 실제 배포 환경에서 확인하기 전에는 삭제 worker를 production에 활성화하지 않는다.
- RevenueCat 장애·unknown product·stale/missing snapshot은 기존 entitlement를 덮거나 철회하지 않는다.
- iOS Apple server credentials와 Xcode Team 설정이 없으면 iOS release gate를 실패시킨다.
- 실제 사용자나 beta 12명으로 계정 삭제를 검증하지 않는다.

## 2026-07-17 provider cutover 완료 상태

- RevenueCat webhook은 production/sandbox 이벤트에 대해 `https://chartradar.kr/api/billing/app-store/webhook`으로 활성화했고 HMAC signing secret은 Vercel Production sensitive 변수로 배치했다.
- dashboard signed `TEST`는 HTTP 200을 받았고 TEST 분기는 snapshot 조회나 entitlement RPC를 실행하지 않는다. 테스트 직후 subscriptions/events는 기존 `legacy_beta` 12/12건 그대로였고 RevenueCat 행은 0건이었다.
- 실제 RevenueCat 이벤트는 raw body HMAC 검증, event ID 검증, subscriber snapshot 재조회 순서를 통과해야 하며 raw webhook product payload로 권한을 부여하거나 철회하지 않는다.
- 운영 deployment는 main `f3772145471d31d52243bb4f6b762a250c339169`, Vercel `dpl_BEhuUNepvK4W9tJdxFrfCFmArAEr`에서 READY다.
- `ACCOUNT_DELETION_PROCESSING_ENABLED=true`가 production에 배치되었고 무인증 processor/request 접근은 401이다. 실제 사용자 및 beta 계정 삭제 검증은 계속 금지한다.
