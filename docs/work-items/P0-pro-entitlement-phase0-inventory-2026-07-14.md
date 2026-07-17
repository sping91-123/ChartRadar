# P0 Pro 권한 Phase 0 운영 inventory

## 상태

- 상태: PRODUCTION_GATE_A_B_COMPLETE / GATE_C_PENDING
- 우선순위: P0
- 위험도: 매우 높음
- 조사 시각: 2026-07-14 20:47 KST
- 조사 방식: 운영 Supabase read-only catalog·aggregate 조회
- 운영 변경: 없음
- 사용자·결제 식별자 출력: 없음
- 관련 설계: `docs/work-items/P0-pro-entitlement-lifecycle-redesign.md`
- P0-A 초안: `supabase/migrations/20260714120423_close_profile_entitlement_self_upgrade.sql`

> 내부 운영 자료다. 작은 사용자 cohort 수가 포함되어 있으므로 공개 PR 본문이나 외부 문서에 그대로 복사하지 않는다.

## 결론

현재 운영 DB는 repo의 billing schema보다 오래된 legacy 구조이며 migration ledger가 비어 있다. `subscriptions` row는 0개이고 기존 premium 계정 12개는 모두 `profiles.membership_tier`만으로 권한을 얻는다. 대표 확인 결과 이 12개 계정은 의도적으로 3개월 혜택을 제공한 앱 베타테스터다. 따라서 subscription-only cutover 전에 기간이 보존되는 beta grant로 이관해야 한다.

그보다 먼저 처리해야 할 문제가 있다. 운영의 authenticated 역할은 본인 profile을 UPDATE할 수 있고 `membership_tier` 열에도 UPDATE privilege가 있다. 현재 authorization이 이 값을 신뢰하므로 로그인 사용자가 직접 `premium`으로 바꿀 수 있는 권한 상승 경로가 성립한다. 실제 악용 여부와 profile 값이 변경된 DB 경로는 이 inventory만으로 증명할 수 없지만, 12개 계정의 비즈니스상 부여 목적은 정상 베타 혜택으로 확인됐다.

## 프로젝트 식별과 조사 안전성

- 연결된 Supabase 프로젝트는 repo의 `.env.local`에 설정된 project ref와 일치했다.
- project ref, URL, key, 이메일, UUID, provider customer/order/subscription ID는 문서에 기록하지 않았다.
- 실행한 SQL은 catalog metadata와 고정 분류 count만 반환하는 `SELECT`였다.
- migration, DDL, DML, RPC, Auth 변경, provider 설정 변경은 실행하지 않았다.
- Codex in-app Browser는 사용하지 않았다.

## 운영 schema와 repo의 차이

| 영역 | 운영 DB | 현재 repo 기대값 | 판정 |
| --- | --- | --- | --- |
| `profiles` 권한 열 | `membership_tier` | `plan`과 legacy fallback | drift |
| `profiles.plan` | 없음 | 있음 | migration 선행 불가 |
| `subscriptions` 상품 열 | `tier` | `plan` | drift |
| `subscriptions.market_scope` | 없음 | 있음 | Coin/Global 구분 불가 |
| `subscriptions.provider_order_id` | 없음 | 있음 | idempotency·귀속 제약 없음 |
| `signals.visibility` | 없음 | 있음 | public/member/premium 분리 불가 |
| migration ledger | 0건 | 로컬 SQL 6개 | 추적 불가 |

일부 후속 객체는 수동 또는 별도 경로로 적용된 흔적이 있다.

- `push_tokens`, `push_alert_presets`: 운영에 존재
- `macro_events`: 운영에 없음
- `journals.market`: 운영에 없음
- 2026-05-13 billing column: 운영에 없음

즉, local migration 전체를 순서대로 재실행할 수 없다. 특히 `20260513_billing_entitlements.sql`은 운영에 없는 `profiles.plan`과 `subscriptions.plan`을 전제로 constraint를 추가하므로 현재 운영 DB에 그대로 적용하면 실패한다.

## 사용자·권한 집계

| 지표 | 결과 |
| --- | ---: |
| Auth 사용자 | 60 |
| profile | 60 |
| Auth 사용자 중 profile 없음 | 0 |
| `free` profile | 48 |
| `member` profile | 0 |
| `premium` profile | 12 |
| subscription row | 0 |
| target lifecycle 기준 유효 subscription 사용자 | 0 |
| Auth `app_metadata.role=admin` | 1 |
| admin 역할이면서 premium profile | 0 |
| non-admin premium profile | 12 |
| signal row | 0 |

추가 관측:

- premium profile 12개는 모두 2026-05 생성 cohort다.
- 12개 모두 subscription 근거가 없어 새 원장 기준 beta backfill 대상이 된다.
- 혜택 시작은 각 `profiles.created_at`, 종료는 `profiles.created_at + interval '3 months'`로 확정했다.
- admin 역할 계정의 profile은 `free`다. 이는 admin 역할과 유료 상품을 분리해야 한다는 설계와 맞는다.
- app metadata에 알려진 유료 product plan이나 알 수 없는 비어 있지 않은 plan은 없었다.
- provider/order 중복은 subscription 자체가 0건이므로 현재는 0건이다.

### 해석 제한

- premium 12개가 정상 베타 혜택이라는 비즈니스 목적은 대표가 확인했다. 다만 현재 schema에 감사 로그와 `updated_at`이 없어 각 profile 값의 실제 DB 변경 경로는 복원할 수 없다.
- count만으로 계정별 유지·종료 정책을 자동 결정하지 않는다.
- `revoked_at`이 없으므로 현재 DB는 환불·철회 사실을 별도 권한 상태로 표현할 수 없다.

## 접근 제어 inventory

세 table 모두 RLS 자체는 켜져 있다. 그러나 table privilege, policy, function execute를 함께 보면 최소 권한이 아니다.

### `profiles`

- `anon`, `authenticated`, `service_role`에 table-level `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`가 모두 grant되어 있다.
- UPDATE policy는 본인 row에서 `auth.uid() = id`만 확인하고 authenticated 역할을 명시하지 않는다.
- `authenticated`가 `membership_tier`를 UPDATE할 수 있음이 privilege 검사에서 확인됐다.
- `membership_tier`의 명시적 column ACL은 없었고 현재 권한은 table-level UPDATE grant에서 상속된다. hotfix는 향후 별도 column grant가 생긴 환경도 막도록 table·column UPDATE를 모두 회수한다.
- 따라서 로그인 사용자는 본인 ID를 유지한 채 `membership_tier='premium'`으로 바꿀 수 있다.
- repo의 현재 `supabase/schema.sql`은 이 위험을 인지해 profile UPDATE policy를 열지 않지만 운영에는 반영되지 않았다.

### `subscriptions`

- authenticated 사용자는 본인 row 전체를 SELECT할 수 있다.
- `provider_subscription_id`에도 SELECT privilege가 있다.
- 현재 row는 0개라 실제 노출 데이터는 없지만 향후 provider 식별자가 저장되면 `select=*` 클라이언트를 통해 전달된다.
- table-level mutation privilege는 넓지만 현재 mutation policy가 없어 RLS가 쓰기를 막는다. privilege 자체도 최소화해야 한다.

### `signals`

- authenticated `SELECT USING (true)`다.
- 현재 row는 0개라 즉시 노출되는 signal은 없다.
- 향후 row가 들어오면 Basic과 anonymous-auth 사용자를 포함한 모든 authenticated 역할이 전부 읽는다.
- 운영 table에는 `visibility`와 `market_scope`가 없어 현재 설계의 tier·시장별 정책을 바로 적용할 수 없다.

## 함수·trigger inventory

| 함수 | 실행 특성 | 운영 상태 |
| --- | --- | --- |
| `handle_new_user()` | `SECURITY DEFINER`, `search_path=public` | PUBLIC/anon/authenticated execute 가능 |
| `sync_membership_tier()` | `SECURITY DEFINER`, `search_path=public` | PUBLIC/anon/authenticated execute 가능 |
| `set_updated_at()` | invoker, 고정 `search_path` 없음 | PUBLIC/anon/authenticated execute 가능 |

- `handle_new_user`는 `auth.users` insert trigger다.
- `sync_membership_tier`는 `subscriptions` 변경 trigger이며 active tier를 profile에 복사한다.
- 두 definer 함수는 trigger function이라 일반 RPC 직접 호출이 정상 동작한다고 단정할 수는 없다. 그래도 exposed `public` schema에서 불필요한 execute grant를 유지할 이유가 없으며 Supabase security advisor도 이를 경고한다.
- trigger 정상 동작을 로컬 역할 행렬로 검증한 뒤 PUBLIC/anon/authenticated execute를 회수해야 한다.

## Supabase advisor 결과

### Security

- `handle_new_user`: anon이 실행 가능한 `SECURITY DEFINER`
- `handle_new_user`: authenticated가 실행 가능한 `SECURITY DEFINER`
- `sync_membership_tier`: anon이 실행 가능한 `SECURITY DEFINER`
- `sync_membership_tier`: authenticated가 실행 가능한 `SECURITY DEFINER`
- `set_updated_at`: mutable search path
- Auth leaked password protection 비활성

관련 공식 remediation:

- [Anon executable SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [Authenticated executable SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Mutable function search path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)

### Performance

현재 P0와 직접 관련된 경고는 profile SELECT/UPDATE와 subscription SELECT policy가 `auth.uid()`를 row마다 다시 평가한다는 것이다. 향후 policy는 `TO authenticated`와 `(select auth.uid())`를 함께 사용한다.

journal·push policy, journals foreign key, unused index 경고도 있었지만 이번 entitlement 작업 범위에는 섞지 않는다.

## 위험도와 우선순위 재정렬

### P0-A. profile self-upgrade 차단

가장 먼저 처리한다. 최소 변경 후보는 다음과 같다.

1. authenticated/anon의 profile table UPDATE privilege 회수
2. 기존 본인 profile UPDATE policy 제거
3. 실제 profile 편집 기능이 필요할 때만 `display_name`, `avatar_url` 같은 안전 열을 별도 서버 경로 또는 column grant로 재개방
4. Basic 계정으로 `membership_tier` 직접 변경이 거부되는 regression test 추가

repo 검색에서는 공개 클라이언트가 profile을 PATCH하는 현재 경로를 찾지 못했다. 그래도 운영 적용 전 signup, 로그인, account 표시를 검증한다.

로컬 hotfix 초안은 다음 범위로 준비했다.

- `public.profiles` RLS를 명시적으로 활성화한다.
- `PUBLIC`, `anon`, `authenticated`의 table-level UPDATE와 `membership_tier`/`plan`의 별도 column UPDATE를 회수한다.
- 운영·repo 호환 본인 profile UPDATE policy를 제거한다.
- profile/subscription DML은 포함하지 않아 beta 12개의 현재 값과 만료일은 변경하지 않는다.
- `scripts/smoke-supabase-security.mjs`가 현재 및 후속 migration의 공개 UPDATE 재허용을 정적으로 차단한다.

운영 적용과 migration ledger 등록은 수행하지 않았다.

PGlite 0.5.4 기반 격리 PostgreSQL 회귀 테스트는 다음을 통과했다.

- production legacy `membership_tier`와 repo 호환 `plan` schema에서 취약한 self-upgrade를 먼저 재현
- hotfix migration 두 번 적용 성공
- migration 직후 profile·beta fixture snapshot 불변
- `PUBLIC`/`anon`/`authenticated` table UPDATE 및 entitlement column UPDATE 회수
- authenticated 본인 profile SELECT 유지
- anon, Basic 본인, 타인 profile UPDATE의 `42501` 거부와 값 불변
- service-role profile UPDATE 유지
- 운영 정의와 같은 `handle_new_user` signup trigger가 기본 `free` profile 생성
- 운영 정의와 같은 legacy subscription INSERT/UPDATE/DELETE trigger가 premium/member/free를 정상 재계산
- synthetic beta의 `premium`과 `created_at` 불변

운영 catalog read-only 확인에서도 `profiles`, `handle_new_user`, `sync_membership_tier`의 owner가 모두 `postgres`이고 두 함수는 `SECURITY DEFINER`였다. service-role은 직접 SELECT/INSERT/UPDATE grant와 `BYPASSRLS`를 보유하며, profile은 RLS 활성·`FORCE RLS` 비활성이다.

이 결과는 PostgreSQL 역할·ACL·RLS·trigger 회귀를 증명하지만 실제 Supabase PostgREST/JWT 요청은 증명하지 않는다. 운영 적용 전에는 실제 publishable-key/service-key 경계에서 동일한 행렬을 마지막으로 확인해야 한다.

### P0-B. production baseline 확정

- 빈 migration ledger에 과거 local migration을 그대로 재생하지 않는다.
- 운영 schema snapshot을 기준으로 forward-only baseline 또는 reconciler migration 전략을 먼저 정한다.
- billing, push, macro, journal artifact가 부분 적용된 상태를 migration별로 표시한다.
- migration 파일 생성 방식과 ledger 등록은 별도 승인 후 수행한다.

### P0-C. beta premium 12개 정책

대표 결정이 완료됐다.

- 출처: `provider = legacy_beta`
- 대상: Phase 0에서 확인한 non-admin premium profile 12개
- 시작: `profiles.created_at`
- 종료: `profiles.created_at + interval '3 months'`
- 권한: 기존 legacy premium과 같은 전체 시장 beta 혜택
- 만료 처리: backfill 실행시각에 종료일이 지났으면 활성 권한을 만들지 않는다.

이번 self-upgrade hotfix에는 backfill을 포함하지 않는다. 별도 dry-run에서 대상 12개, 시작·종료 공식, 중복 0건을 검증한 뒤 원자적 beta grant migration으로 처리한다.

### P0-D. 함수·subscription·signal 최소 권한

- trigger 함수 execute와 search path 강화
- subscription의 안전 열만 client SELECT
- signal은 현재 0건인 동안 fail-closed 정책과 시장 분류 schema를 먼저 준비

## 다음 구현 작업의 안전한 경계

첫 구현은 전체 entitlement migration이 아니라 별도 보안 hotfix로 분리한다.

예상 범위:

- production actual schema를 전제로 한 신규 forward-only migration 초안
- profile self-update 차단
- 정적 Supabase security smoke
- 향후 역할 기반 RLS regression 행렬 명시

trigger function execute/search path 강화는 signup trigger 실검증이 필요한 별도 P0-D 작업으로 유지한다.

이 단계에서는 다음을 하지 않는다.

- premium 12개 값 변경
- subscription backfill
- `profiles.plan` 도입
- RevenueCat/Toss mutation 변경
- signal row 또는 policy의 운영 적용
- migration ledger 임의 등록
- production apply, deploy, push

## 필수 검증 행렬

| 역할/경로 | 기대 결과 |
| --- | --- |
| anon profile SELECT/UPDATE | 0행 또는 거부 |
| Basic 본인 profile SELECT | 허용 |
| Basic 본인 `membership_tier` UPDATE | 거부 |
| Basic 본인 안전 profile 열 UPDATE | 현재 기능 요구에 따라 명시적으로 허용 또는 거부 |
| Basic 타인 profile SELECT/UPDATE | 0행 또는 거부 |
| anon/authenticated trigger function RPC | 거부 |
| signup trigger | profile 정상 생성 |
| subscription trigger | service 경로에서 정상 동작 |
| Basic subscription SELECT | 안전 열만 본인 row 허용 |
| Basic signal SELECT | premium row 거부 |
| service role mutation | 승인된 RPC에서만 정상 |

## 완료·중단 기록

- Phase 0 read-only inventory는 완료했다.
- profile self-upgrade 차단 migration과 정적 보안 smoke의 로컬 초안을 완료했다.
- `npm.cmd run smoke:supabase-security`, `npm.cmd run test:supabase-hotfix`, `npm.cmd run smoke:billing`, `npm.cmd run smoke:ops`, `npm.cmd run smoke:all`, `cmd /c npx tsc --noEmit`, `npm.cmd run build`, `git diff --check`를 통과했다.
- 운영 사용자·권한·schema는 변경하지 않았다.
- PostgreSQL 역할 권한 행렬과 신규 가입·legacy subscription trigger는 PGlite에서 검증했다. 실제 Supabase REST/JWT 회귀는 보류했다.
- 실제 self-upgrade 시도나 사용자별 premium 출처 조회는 수행하지 않았다.
- profile self-upgrade 차단과 beta 12개 backfill dry-run이 완료되기 전에는 subscription-only read cutover를 시작하지 않는다.
- commit, push, deploy는 수행하지 않았다.

## 2026-07-17 운영 read-only 재확인

- Supabase project 상태: `ACTIVE_HEALTHY`, Postgres `17.6`.
- 사용자 기준선: profile 62명, Auth user 62명, `free` 50명, non-admin `premium` 12명, admin 1명.
- 2026-07-16 계획 기준선보다 Basic 가입자 1명이 증가했지만 premium beta 수와 구성 월은 변하지 않았다.
- beta 12명은 전원 2026-05 생성, non-legacy subscription 충돌 0건이다.
- dry-run 비교용 cohort hash: `23514409169df37bd42368113e94cb60`.
- subscription 0건, signal 0건이며 `entitlement_events`, `account_deletion_requests`는 아직 운영에 없다.
- migration ledger는 0행이 아니라 `supabase_migrations.schema_migrations` 자체가 없는 legacy 상태다.
- 운영 취약점 재확인:
  - authenticated 역할이 `profiles` table UPDATE 및 `membership_tier` column UPDATE 가능.
  - 본인 profile UPDATE policy 존재.
  - anon/authenticated 모두 `signals` SELECT 가능하고 authenticated는 INSERT/UPDATE/DELETE도 가능.
  - authenticated 전체 signal SELECT를 허용하는 `USING (true)` policy 존재.
  - `handle_new_user()`와 `sync_membership_tier()`는 `SECURITY DEFINER`이며 anon/authenticated가 직접 실행 가능.
- Supabase security advisor는 위 두 SECURITY DEFINER 함수의 공개 실행과 `set_updated_at` mutable search path를 경고했다.
- 운영 쿼리는 집계·catalog·advisor 읽기만 수행했으며 row mutation, DDL, migration 등록은 수행하지 않았다.

## 2026-07-17 운영 Gate A+B 적용

- 대표의 명시적 `운영 Gate A+B 적용 승인` 후 두 migration만 순서대로 적용했다.
- Gate A `20260717092124`: profile UPDATE grant와 entitlement column UPDATE grant를 회수하고 공개 UPDATE policy를 제거했다.
- Gate B `20260717092324`: signal의 public/anon/authenticated 권한과 기존 policy를 제거해 emergency fail-closed로 전환했다.
- 실제 publishable JWT 검증:
  - disposable Basic signup profile이 `free`로 정상 생성됨.
  - authenticated `membership_tier='premium'` self-upgrade가 HTTP 403으로 거부됨.
  - service-role profile UPDATE 정상.
  - anon signal SELECT HTTP 401, authenticated signal SELECT/DELETE HTTP 403.
- disposable user/profile은 즉시 삭제했고 profiles/auth users 62/62, free 50, beta 12로 복원됐다.
- beta hash `23514409169df37bd42368113e94cb60`, subscription 0건, signal 0건은 불변이다.
- Gate C canonical ledger, beta backfill, account deletion migration, deploy/push/release는 실행하지 않았다.

## 2026-07-17 운영 Gate C schema와 dry-run

- 대표의 명시적 승인 범위대로 canonical schema/RPC와 beta dry-run만 진행했다.
- 첫 migration 시도는 production legacy signal에 `triggered_at`이 없어 원자적으로 롤백됐고 migration ledger와 사용자 데이터는 변하지 않았다.
- 실제 legacy signal의 `fired_at`과 subscription constraint를 fixture에 반영해 additive timestamp 이관과 old provider/tier constraint 제거를 보강했다.
- 보강본은 `20260717131436 canonical_entitlement_ledger`로 적용됐다.
- 실제 JWT/REST 검증은 self-upgrade 403, signal SELECT anon/Basic 200, signal DELETE 403, beta RPC anon 401/authenticated 403을 확인했고 disposable user/profile을 삭제했다.
- dry-run은 eligible 12, conflict 0, changed false, cohort hash `23514409169df37bd42368113e94cb60`을 반환했다.
- 직후 profile/auth user 63/63, Basic 51, beta 12, subscriptions 0, entitlement events 0, signals 0으로 실제 beta DML이 없음을 확인했다.
- advisor 후속 3건(event ledger service-role 권한, legacy subscription policy 중복, authenticated SECURITY DEFINER helper)과 beta 검증/apply 사이 cohort 경쟁 방지 lock을 두 로컬 migration으로 준비했으나 운영에는 적용하지 않았다.
- beta apply, account deletion migration, deploy/push/release는 실행하지 않았다.
