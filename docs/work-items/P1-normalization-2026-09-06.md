# 차트 레이더 주요 문제 정상화 계획

요청일: 2026-09-06. 근거: 같은 날 운영 API·DB·모바일 화면 진단. 대표 요청에 따라 문제별로 계획 → 구현 → 검증 → 남은 운영 확인을 순서대로 진행한다.

## 진행 원칙

- 이번 요청은 아래 문제의 로컬 수정과 검증을 승인한 것으로 처리한다. 상품 가격, 확정봉 판단 기준, DB 원장, 실제 결제/발송은 임의로 변경하지 않는다.
- 문제별 테스트를 먼저 통과한 뒤 다음 문제로 이동한다. 최종 통합 타입·빌드·관련 smoke·모바일 검증을 진행한다.
- 코드 검증 완료와 운영 배포 완료, 실제 전환 성과 확인을 구분한다. 2026-09-07 KST 대표 승인에 따라 운영 배포와 공개 경계 검증까지 완료했다.
- 수익화 수치를 인위적으로 올리거나 기존 데이터를 수정하지 않는다. 적격 사용자와 성숙한 체험 cohort로 판단한다.

| 순서 | 문제 | 계획 | 위험 | 상태 |
|---|---|---|---|---|
| 1 | 이전 API의 유료 상세 노출 | 서버 권한/공개 serializer 통일, 구형 무료 홈 호환 처리 | 높음: Pro 경계 | 운영 배포·익명 경계 확인 완료 |
| 2 | 글로벌 해석/데이터 시각 불일치 | 상승·중립·하락 분기 분리, 실제 거래 기준일과 조회 시각 구분 | 중간 | 운영 배포 완료 · 장기 관찰 대기 |
| 3 | 결제 실패 원인 unknown | 민감정보 없이 SDK 코드·오류 범주·재시도 여부 보존, 복구 안내 | 높음: 결제 진단 | 로컬 완료 · 실기기 확인 대기 |
| 4 | 관망 조건이 추상적 | 확정봉 판단은 유지, 충돌 시간대·해소 조건·다시 볼 기준 표시 | 중간 | 운영 배포 완료 · 사용자 관찰 대기 |
| 5 | 감시·유료 전환 흐름 약함 | 첫 감시까지 연결, 문맥과 복귀 경로 유지, 측정 누락/보고 기준 보강 | 중간~높음 | 로컬 완료 · 운영 성과 추적 대기 |

## 1. 유료 분석 정보 보호

- 수정 대상: `src/app/api/crypto-home-snapshot/route.ts`, `src/lib/server/homeInterestAnalysis.ts`, 구형 홈 호출부와 `HomePerpetualDecisionFlow.tsx`, 관련 계약 테스트.
- 완료 기준: 익명/Basic/Global 전용/권한 확인 실패 응답에 Pro 상세 없음. Coin Pro는 기존 필요한 상세 유지. mode off/shadow의 Basic 홈도 분석·코인 선택 유지. 개인화 응답은 private/no-store.
- 검증: serializer 회귀, 권한 계약, 실제 로컬 Basic API, `smoke:billing`, 타입·빌드, 모바일 홈.
- 중단 조건: 기존 상품 권한이나 DB schema 변경이 필요해지면 수정 경계를 재검토.

## 2. 글로벌 해석과 기준 시각

- 수정 대상: stocks market-board route의 순수 해석 helper, `GlobalMarketPulse.tsx`, 관련 회귀 테스트. Basic에서 가려진 분석 업데이트 시각도 공개 정보로 정리.
- 완료 기준: ±0.25% 경계 안팎에서 숫자·문구가 모순되지 않음. 휴장/거래일 데이터를 현재 조회 시각과 구분. 없는 시각을 만들어내지 않음.
- 검증: 양수/음수/0/반올림 경계, 누락·서로 다른 거래일 사례, 모바일 Global/Alt, 관련 API 계약.

## 3. 결제 실패 진단

- 수정 대상: mobilePurchases, 오류 정규화 helper, ProPricingPanel, 허용된 product event 속성/테스트.
- 완료 기준: 알려진 SDK 오류가 unknown으로 소실되지 않음. 취소와 실패 분리. 결제 완료 후 권한 동기화 대기는 재구매로 유도하지 않음. raw message/주문번호/토큰/개인정보를 telemetry에 기록하지 않음.
- 검증: SDK 오류 행렬, timeout/cancel/network/configuration/store/sync 사례, `smoke:billing`, entitlement/product-event 회귀.
- 외부 완료 조건: 배포 후 실기기 실패 단계 재현, 구매·취소·복원 경로 확인. 기존 unknown 오류의 과거 원인은 복구 불가할 수 있음.

## 4. 관망 안내 구체화

- 수정 대상: perpetual snapshot/표현 helper, 홈·상세 확인 조건 표시, 관련 테스트.
- 완료 기준: 방향·점수·확정봉·monitor trigger 계약 유지. macro/current/flow/데이터 부족 원인별로 지금 충돌하는 항목과 다음 확인을 구체적으로 표시. 오래된 분석에는 현재 판단처럼 표시하지 않음. Basic에는 공개 가능한 방향 조건만 제공.
- 검증: 상승/하락/엇갈림/데이터 지연 fixture, 기존 snapshot/monitor/Pine 관련 회귀, 모바일 Home/Perpetual.

## 5. 첫 감시와 전환 측정

- 수정 대상: Home/Perpetual의 첫 감시 연결과 요금제 문구, product event/report 경로, cohort 문서.
- 완료 기준: 홈의 다음 확인 조건에서 관련 감시 저장까지 경로가 명확함. 로그인·권한 확인 후 원래 문맥으로 복귀. 이미 감시 중이면 중복 생성을 유도하지 않음. 무료 한도/기존 Pro 권한 유지. 측정은 session/사람/적격 체험을 구분하고 내부 트래픽 제외.
- 검증: 비로그인/Basic 미사용/한도 도달/Pro/이미 저장 fixture, 로그인 returnTo, CTA→상세→감시·요금제 연결, product event/보고서 계약.
- 성과 완료 조건: 운영 배포 시점을 새 변경 기준으로 기록하고, 적격 gate와 검증된 체험/첫 감시/재방문을 추적. 표본과 체험 기간 충족 전 매출 정상화를 선언하지 않음.

## 실행 기록

- 시작 상태: `5bdb24c`, 작업 트리 깨끗함. 운영 배포 및 실결제는 아직 실행하지 않음.

### 로컬 구현 결과

1. 이전 홈 API에 crypto 권한 확인과 공개 allowlist serializer를 적용했다. 익명·Basic·Global 전용·권한 확인 실패는 공개 요약만 받고, Coin Pro의 기존 상세 응답은 유지한다. off/shadow 모드의 무료 홈은 안전한 요약 화면을 사용한다. 모든 응답에 private/no-store와 Authorization Vary를 적용했다.
2. VIX/UUP/채권의 상승·중립·하락 해석을 분리했다. 0.24991%가 +0.25%로 표시돼도 하락으로 설명하지 않는다. 글로벌 데이터의 실제 일봉 기준일과 서버 조회 시각을 구분하고, Basic의 분석 생성 시각을 공개한다.
3. 설치된 RevenueCat SDK 코드 목록을 검증하는 오류 분류를 추가했다. 네트워크·스토어·승인 대기·이미 구매·설정·구매 제한·진행 중·취소를 구분하며 SDK 코드/범주/재시도 여부만 허용 속성으로 기록한다. purchase_error가 원래 실패 작업 단계를 덮지 않는다. 승인 대기·결과 불확실·기구매는 새 구매보다 내역/권한 확인을 안내한다.
4. 시간대 충돌은 실제 1일/4시간 또는 1시간/15분 방향과 다음 확정봉 확인 항목을 표시한다. 체결 충돌과 데이터 누락은 각각 다른 안내를 제공한다. 판단 엔진 버전, 방향, 점수, 조건 ID, 가격 threshold와 monitor 발동 판정은 변경하지 않았다.
5. 홈의 조건에서 감시 섹션으로 바로 이동하고 로그인 returnTo에도 코인·snapshot·source·섹션을 유지한다. 같은 조건은 저장 직후와 새로고침 이후에도 기존 감시로 연결한다. 공유 무료/Pro 한도를 유지하며 다른 조건이 한도를 넘을 때만 업그레이드를 안내한다. gate 플랫폼과 홈 클릭 의도를 보존하고, 세션/사용자·24시간/D15 성숙 분모를 구분하는 읽기 전용 보고 스크립트를 추가했다.

### 검증 결과

- `npm.cmd run test:normalization`: 공개 serializer, 글로벌 경계값/기준일, SDK 오류·민감정보 차단, 첫 감시 링크·기존 조건, 전환 집계 행렬 통과.
- `npx.cmd tsc --noEmit`: 통과.
- `npm.cmd run build`: 통과. off 모드와 on 모드에서 빌드했다. 마지막 on 빌드는 lint/타입 경고 없이 통과했으며 process 환경만 지정하고 `.env.local`은 수정하지 않았다.
- entitlement·RevenueCat webhook·account deletion·product event·coin product contract·perpetual snapshot/MSS/briefing/monitors·ledger 회귀 통과. PostgreSQL 원장 검증은 기존 로컬 fixture 검사이며 운영 DB를 수정하지 않는다.
- `smoke:billing`, `smoke:mobile`, `smoke:copy`: 통과. `smoke:mobile`은 정적 앱 포장 검증이며 실기기 결제를 대신하지 않는다.
- 실제 로컬 production 서버: BTC/SOL 익명 및 잘못된 인증 토큰의 이전 API 응답 200, canSeeProDetail=false, 금지 상세 필드 0개, private/no-store 확인. `/api/health` 200.
- 실제 로컬 Global API/외부 Chrome: 2026-09-04 거래 자료와 2026-09-06 조회 시각 구분, UUP +0.25%의 중립 문구 확인. 390px 가로 넘침 없음, 확인한 브라우저 오류 0개.
- production 빌드의 모바일 UI fixture: 비로그인 Home → 감시 조건 → 로그인 returnTo → Basic 첫 감시 저장 → 새로고침 후 기존 감시 열기 통과. 감시 POST 정확히 1회. Basic 한도/Pro/지연 데이터 비활성 상태 통과, 가로 넘침·pageerror 없음. 인증·감시·결제는 fixture이며 실제 OAuth/스토어/운영 저장을 실행하지 않았다.
- 360px `/pro`, `/crypto/perpetual/alts`, `/crypto/news`, `/crypto/review` route 진입 시 가로 넘침·pageerror 없음. 전체 장기 갱신 또는 모든 상품의 수동 상세 QA를 의미하지 않는다.
- 브라우저 자동화 중 CLI 환경의 URL 전역 미지원과 같은 문서 hash 이동으로 생긴 fixture 대기 실패는 검증 스크립트에서 수정 후 통과했다. 앱 검증 실패를 숨기거나 성공으로 바꾸지 않았다.
- 결과 파일: `output/playwright/normalization-2026-09-06/`의 API 경계 JSON, Home/첫 감시/Global/Pro PNG 및 검증 스크립트. 이 폴더는 gitignore 산출물이다.

### 운영 반영과 실제 정상화 완료 조건

- 커밋 `affa6f040f7218f2ec00dcacac8260fa8ba49ecb`를 push했고 upstream SHA 일치, Vercel production `dpl_ELUhGd2zMZ9ruY1hViPAseUv3MmN`, `https://chartradar.kr` alias, health `ok=true`를 확인했다.
- 운영 익명 snapshot은 `access=basic`, Pro `pro` 속성 없음, private/no-store와 Authorization Vary를 반환했다. 외부 Chrome 390×844의 Basic 진입·Pro 가격/체험/해지 CTA, 콘솔 오류·경고 0건, 새 Vercel error log 없음도 확인했다.
- Android 실기기에서 결제 취소·오프라인·이미 구매·권한 복원·승인 대기 경로를 확인한다. 수정은 진단 보존과 복구 안내이며 과거 unknown 실패의 원인이나 모든 결제 성공을 보장하지 않는다.
- 관망 빈도는 판단을 느슨하게 만들어 낮추지 않았다. 개선 대상은 원인과 다음 확인의 설명이다.
- 전환·매출 정상화는 운영 배포 후 별도 판단한다. 신규 기준 시각, 적격 cohort, 성숙한 체험 표본을 확보하기 전에는 성과 완료로 표시하지 않는다. 기존 체험/취소/구매 원장과 가격은 변경하지 않았다.
