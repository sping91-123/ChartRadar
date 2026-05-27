# Active Automation Run

## Run Title

- `coin-radar-ux-redesign-run`

## Purpose

- Coin Radar를 국내 코인 사용자 중심으로 더 빠르고 직관적인 앱 구조로 재설계한다.
- 정보를 줄이고, 화면 공간을 넓히고, 홈에서 대표 코인 상태를 즉시 파악하게 한다.
- Global Radar는 삭제하거나 코인 보조 매크로로 격하하지 않는다.

## Product Direction

- ChartRadar는 상위 시장 모드로 Coin Radar와 Global Radar를 유지한다.
- Global Radar는 코인 보조 매크로가 아니라 해외주식/해외선물 사용자용 독립 레이더다.
- Coin Radar 안에서는 국내 코인 사용자 중심으로 홈/현물/선물/매크로/복기 구조를 검토한다.
- `/majors`는 `/crypto` 호환/redirect로만 본다.
- 실제 Coin Radar 기준 route는 `/crypto`다.

## Start Conditions

- 대표가 `AUTO RUN ACTIVE PLAN - one small step only`라고 입력하면 작업 목록의 첫 `TODO`부터 처리한다.
- 한 턴에는 하나의 `TODO`만 처리한다.
- 작업 전 `git status --short --branch`와 `git rev-list --left-right --count HEAD...origin/main`이 정상이어야 한다.
- 이번 active run은 설계 문서 작업만 진행한다.
- 코드 작업은 설계 작업이 끝난 뒤 별도 active run으로 진행한다.

## Stop Conditions

- 작업트리가 dirty이고 기존 변경의 정체가 불명확함.
- local과 `origin/main`이 불일치함.
- 앱 코드 수정이 필요함.
- 고위험 변경이 필요함.
- Global Radar를 삭제하거나 코인 보조 매크로로 격하해야만 하는 설계가 필요함.
- production DB migration, versionCode 변경, AAB 생성, Play Console 업로드, deploy가 필요함.
- 비밀값 파일 또는 민감값 추적이 감지됨.
- 검증 실패 원인이 불명확함.
- 같은 턴에 여러 작업을 처리해야만 하는 상태임.

## Task List

| Order | Status | Task | Area | Risk | Goal | Forbidden | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | DONE | Coin Radar UX 구조 문서화 | 제품 구조 / Coin Radar | LOW | `docs/coin-radar-ux-redesign-plan.md`를 생성해 Global Radar 독립 유지 원칙, Coin Radar 내부 하단 탭 후보, 홈 MVP, 현물 레이더 MVP, 선물 탭 내부 구조, Coin Radar 안의 매크로 역할, 기존 route 영향, 푸시 `targetPath` 영향, Pro/BM 영향을 정리한다. | 앱 코드 수정 금지. | `git diff --check` |
| 2 | DONE | 시장 선택 화면 단순화 설계 | 홈 랜딩 / 시장선택화면 | LOW | 시장 선택 화면의 큰 외곽 테두리 박스 제거, 마지막 사용 시장 기억, 기본 시작 화면 설정 방식을 문서화한다. | 코드 수정 금지. | `git diff --check` |
| 3 | TODO | Coin Radar 홈 MVP 설계 | Coin Radar | MEDIUM | 홈에서 대표 코인 선택, 방향성, 점수, 리스크, 다음 확인 조건, BTC 기준 시장 체력, 공포탐욕, BTC RSI, BTC 스토캐스틱, BTC 트렌드, 도미넌스, 롱숏비율, 김프, BTC/ETH/XRP 펀딩비, 환율을 어떻게 보여줄지 설계한다. | 코드 수정 금지. RSI/스토캐스틱/트렌드는 선택 코인이 아니라 BTC 기준으로 정리한다. | `git diff --check` |
| 4 | TODO | 현물 레이더 데이터/UX 조사 | Coin Spot / 현물 | MEDIUM | 업비트/빗썸 KRW 현물 레이더 MVP에 필요한 public API, 현재가, 캔들, 거래대금, 상승률, 과열/눌림/관심 후보 기준, 투자 추천처럼 보이지 않는 문구 원칙을 문서화한다. | 코드 구현 금지. 주문/계정 연동 금지. | `git diff --check` |
| 5 | TODO | Coin Radar 하단 탭 라우팅 설계 | 모바일 내비게이션 | MEDIUM | 홈/현물/선물/매크로/복기 구조를 route와 연결한다. 후보는 홈 `/home` 또는 `/`, 현물 `/spot`, 선물 `/crypto` 내부 메이저/알트, 매크로 `/macro` 또는 `/news?market=crypto`, 복기 `/journal?market=crypto`다. | 코드 수정 금지. | `git diff --check` |
| 6 | TODO | 구현 1단계 후보 선정 | 전략실 메인 | LOW | 위 설계 문서들을 바탕으로 첫 실제 구현 작업 1개를 선정한다. 후보는 시장 선택 화면 큰 외곽 박스 제거, 마지막 사용 시장 기억, Coin Radar 홈 MVP skeleton, 현물 레이더 API adapter 설계다. | 코드 수정 금지. | `git diff --check` |

## Status Values

- `TODO`: 아직 착수하지 않은 작업.
- `IN_PROGRESS`: 현재 처리 중인 작업.
- `DONE`: 검증과 커밋까지 완료한 작업.
- `BLOCKED`: 대표 확인, 외부 권한, 운영 데이터, 고위험 승인 등이 필요해 멈춘 작업.

## Risk Values

- `LOW`: 문서, 작은 구조 정리, 앱 동작 영향이 낮은 변경.
- `MEDIUM`: 앱 코드 또는 사용자 흐름에 영향을 줄 수 있으나 고위험 영역은 아닌 설계 변경.
- `HIGH`: 결제, 인증, Supabase, Android release, Play Console, FCM, production DB, 비밀값과 관련된 변경.

## Completion Report Format

- 선택한 active run 작업.
- 선택 이유.
- 수정 파일.
- 변경 내용.
- Global Radar 독립 유지 원칙 훼손 여부.
- 건드리지 않은 고위험 영역.
- 검증 결과.
- active run 상태 갱신 여부.
- 커밋 해시 또는 미커밋 상태.
- `git status --short --branch`.
- push 여부. 대표 승인 전에는 하지 않음.
- 다음 active run 작업.

## Push Policy

- 기본 동작은 commit까지만 진행한다.
- `git push`는 대표가 명시적으로 요청한 경우에만 실행한다.
- push 전에는 Git 상태, ahead/behind, 최근 커밋, 비밀값 추적 여부를 확인한다.
