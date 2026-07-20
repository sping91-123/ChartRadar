# Home → Perpetual 수익화 코어 v1

## 상태

- 상태: `LOCAL_IMPLEMENTATION_COMPLETE / EXTERNAL_GATES_PENDING`
- 우선순위: P0 수익화 코어
- 구현·검증일: 2026-07-20 KST
- 운영 DB 변경: 없음
- 실제 Push 발송: 없음
- Vercel flag·deploy: 없음
- AAB·스토어·iOS 작업: 없음
- beta 12명 mutation: 없음
- commit·push: 없음

## 결과

Home과 Perpetual이 같은 `PerpetualDecisionSnapshot`을 사용해 `상태 → 위험 → 다음 조건 → 최대 5분 간격 감시 → 알림 → 복기`로 이어지는 로컬 구현을 완료했다. 유료 판단 범위는 Binance USDT-M BTC·ETH, 15분 확정 구조와 1시간·4시간 맥락으로 제한했다. Basic 응답에는 현재 상태·위험·이유 2개·primary condition만 포함하고 `pro` 속성은 반환하지 않는다.

기능 플래그는 `off | shadow | on`을 지원한다. production에서 값이 없으면 `off`이며, `.env.example`의 rollout 예시는 `shadow`다. 현재 `.env.local`의 `off` 값은 변경하지 않았다.

## 완료 범위

### 1. 공통 판단 스냅샷

- BTC·ETH 공통 타입, 결정론적 resolver, source freshness, quality, continuity 계약을 추가했다.
- 미완성 캔들을 제외하고 Binance USDT-M의 15분·1시간·4시간 캔들, 청산 압력, 대형 체결 흐름을 사용한다.
- 동일 1분 bucket을 중복 제거하고 유효한 요청 snapshot은 그대로 재사용한다.
- 저장소 장애 시 마지막 정상 상태를 유지하되 `stale`로 fail-closed하며 monitor 생성을 막는다.
- 신규 DB가 아직 없는 로컬 환경에서는 읽기 QA를 위한 process memory fallback을 사용한다. Next 개발 서버의 route 재컴파일 뒤에도 ID 연속성이 유지되도록 global store로 고정했다. monitor 저장은 DB/RPC가 없으면 계속 fail-closed다.

### 2. Home

- 첫 화면을 BTC/ETH 선택, Binance 기준·생성 시각·품질, 상태·결론, 최대 위험, 이유 2개, 다음 조건, 단일 CTA 순으로 재구성했다.
- CTA는 asset·15m·snapshot UUID·`source=home`을 포함하며 상세 진입 전 Pro gate를 두지 않는다.
- 중요 macro만 Hero 위에 두고 일반 일정은 아래 한 줄로 내렸다.
- 거래소·알트 시세는 `관심코인 시세`로 분리하고 유료 BTC·ETH 판단과 구분했다.
- 판단 근거는 같은 snapshot을 쓰는 접이식 영역으로 묶었다.

### 3. Perpetual

- 서버 page가 canonical `asset=btc|eth`, snapshot, source를 검증해 초기 자산을 전달한다.
- 유효한 Home snapshot은 그대로 유지하고, 만료·없는 ID는 최신 snapshot으로 교체한 뒤 갱신 배너를 표시한다.
- asset과 snapshot asset이 다르면 요청 snapshot을 무시한다.
- Hero, 차트 조건선, 다중 시간대·압력·flow evidence가 한 snapshot을 공유한다.
- 알림 당시 snapshot은 가능한 한 보존하고, 찾지 못한 알림 snapshot은 최신 상태로 전환하면서 `source=alert`를 URL에서 제거해 현재 상태를 과거 알림으로 오인하지 않게 했다.
- 매매 지시처럼 보이는 용어를 리스크·확인 시나리오·판단 변경 기준 중심으로 교체했다.

### 4. Monitor·Push·Journal

- snapshotId·conditionId만 받는 monitor API와 service-role RPC를 추가했다.
- Basic 1개, Coin Pro·bundle·admin 20개이며 기존 preset과 합산하는 shared quota를 적용했다.
- 이미 충족된 조건, non-actionable snapshot, 한도 초과, terminal condition 재무장을 서버에서 거부한다.
- pause·resume·cancel과 live monitor 목록 UI를 연결했다.
- 15분 24시간, 1시간 72시간, 4시간 invalidation 14일 만료와 구독 종료 시 1개 유지·나머지 `paused_entitlement`를 구현했다.
- scanner가 FCM 토큰과 무관하게 active monitor를 평가하고 atomic claim·delivery lease 뒤 앱 내 알림을 기록한다.
- push target에 asset·snapshot·monitor를 구조화해 동일 Perpetual로 복귀하고 Journal에 snapshot·monitor·source를 연결한다.
- Journal API의 4xx는 로컬 성공으로 위장하지 않고, 네트워크·5xx만 명시적 미동기화 fallback으로 처리한다.

### 5. 제품 이벤트·결제 귀속

- 허용 이벤트·속성만 받는 `202` product event API와 90일 retention을 추가했다.
- IP, 원본 토큰, 결제·주문 ID, 레버리지, 금액, 손익, 자유 입력은 저장하지 않는다.
- 익명 식별자와 rate key는 서버 HMAC으로 변환한다.
- 구매 시도 attribution source를 RevenueCat native purchase → verified sync/webhook까지 전달하며, 구매 성공 이벤트는 검증된 billing 경로에서만 기록한다.
- `shadow/on` 활성화 전 Supabase service role·analytics HMAC을, `on` 전 cron·Firebase 자격증명을 확인하는 preflight를 추가했다.

### 6. DB·RLS·삭제 연동

- snapshot, scenario monitor, outcome, product event와 Journal FK를 additive migration으로 추가했다.
- 신규 테이블 RLS, public/anon/authenticated 직접 접근·RPC 실행 회수, service-role 전용 mutation을 선언했다.
- migration은 fresh/repo/production-shape에서 반복 적용되며 기준 `schema.sql`과 RPC·index·policy parity를 검사한다.
- 계정 삭제 purge에 monitor, product event, Journal 연결 정리를 포함하고 전역 snapshot·outcome은 유지한다.

## 모바일 QA

Codex in-app Browser는 사용하지 않고 CLI Playwright만 사용했다.

| 화면/흐름 | 결과 |
| --- | --- |
| Home 360×800 | 상태·위험·조건·CTA가 첫 viewport 안, CTA bottom 510px, overflow 0 |
| Home 390×844 | 상태·위험·조건·CTA가 첫 viewport 안, overflow 0 |
| BTC Home → Perpetual | Home/detail snapshot UUID 동일, 갱신 배너 0 |
| ETH Home → Perpetual | `asset=eth`, ETH selected, snapshot UUID 동일, BTC flash 없음 |
| 없는/만료 Home snapshot | 최신 ID로 교체, Home 갱신 배너 표시 |
| 없는 alert snapshot | 최신 ID로 교체, alert 안내 표시, `source=alert` 제거, 안전한 login returnTo |
| asset 불일치 | ETH snapshot을 BTC URL에서 무시하고 BTC 최신 ID로 교체 |
| 360·390 가로폭 | `body`와 root scroll width가 viewport와 동일 |
| 콘솔 | 최종 clean session error 0건 |

증거는 `output/playwright/perpetual-revenue-core-v1/`에 저장했다.

## 자동 검증

다음 검증이 모두 통과했다.

- `npm.cmd run test:supabase-hotfix`
- `npm.cmd run test:entitlements`
- `npm.cmd run test:futures-brief`
- `npm.cmd run test:auth-boundaries`
- `npm.cmd run test:perpetual-snapshot`
- `npm.cmd run test:perpetual-monitors`
- `npm.cmd run test:product-events`
- `npm.cmd run test:push-targets`
- `npm.cmd run smoke:supabase-security`
- `npm.cmd run smoke:billing`
- `npm.cmd run smoke:ops`
- `npm.cmd run smoke:migrations`
- `npm.cmd run smoke:mobile`
- `npm.cmd run smoke:routes`: page manifest 43개, redirect Location, 보호 API 통과
- `npm.cmd run smoke:all`
- `cmd /c npx tsc --noEmit`
- `npm.cmd run build`: Next.js 64개 static page 생성 및 전체 route build 통과
- `git diff --check`

## 외부 게이트와 남은 검증

다음은 구현 완료 범위가 아니며 실행하지 않았다.

- production Supabase migration 적용과 advisor/JWT RLS 재검증
- Vercel `PERPETUAL_REVENUE_CORE_V1=shadow|on` 변경 및 production deploy
- 실제 5분 cron 실행과 disposable Android 계정 FCM 수신
- authenticated disposable Basic의 1개 monitor·두 번째 Pro 안내 실동작
- disposable Coin Pro의 20개 조건, Push → Perpetual → Journal 실동작
- 14일 beta 관찰과 활성화 기준 집계
- AAB, Play Console, App Store, iOS

운영 활성화 순서는 migration 적용·검증 → HMAC 등 preflight → `shadow` 비교 → 실제 cron/FCM disposable 검증 → 승인 후 `on`이다. DB가 적용되지 않은 상태에서 monitor 저장은 의도적으로 실패한다. FCM은 외부 provider 특성상 at-least-once 잔여 위험이 있으므로 atomic claim·delivery lease와 앱 내 기록을 기준으로 관찰해야 한다.
