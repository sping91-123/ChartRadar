# Active Automation Run

## Run Title

- `coin-home-decision-dashboard-run`

## Purpose

- Coin Radar 홈을 정보 대시보드가 아니라 "매매 전 10초 판단 화면"으로 재정의한다.
- 사용자가 앱을 열었을 때 아래 4가지 질문에 바로 답할 수 있게 홈 구조를 설계한다.
  - 지금 장을 봐도 되는가?
  - 내 대표 코인은 추적할 만한가?
  - 지금은 BTC장이냐, 알트장이냐?
  - 지금 가장 큰 리스크는 뭔가?
- 표현은 투자 권유가 아니라 준비도, 추적 조건, 관망, 리스크, 확인 조건 중심으로 정리한다.

## Background

- 현재 `/coin` 홈은 `Header`, `RadarTopNav`, `MacroTicker`, `CoinRadarHomePanel`로 구성되어 있다.
- 현재 `CoinRadarHomePanel`은 대표 코인 상태, BTC 기준 시장 체력, 펀딩비를 보여준다.
- 하지만 사용자가 즉시 "지금 볼 장인지, 관망인지, BTC장인지 알트장인지, 내 대표 코인은 추적할 만한지" 판단하기에는 화면의 결론성이 약하다.
- 이번 run은 설계 run이며 앱 코드, route, API, 결제, 인증, Supabase, Android, FCM은 변경하지 않는다.

## Product Principles

- ChartRadar는 Coin Radar와 Global Radar를 모두 유지한다.
- 이 run은 Coin Radar 홈에 집중하되 Global Radar를 코인 보조 매크로로 격하하지 않는다.
- Coin Radar 홈은 매수/매도 지시가 아니라 판단 보조, 준비도, 추적 조건, 관망 조건, 리스크 기준을 보여준다.
- RSI, 스토캐스틱, 트렌드는 선택 코인이 아니라 BTC 기준 시장 체력 지표로 다룬다.
- 사용자의 대표 코인은 개인화할 수 있지만 계정 동기화는 후순위로 둔다.

## Start Conditions

- 작업 전 `git status --short --branch`와 `git rev-list --left-right --count HEAD...origin/main`을 확인한다.
- local과 `origin/main`이 불일치하면 새 작업을 시작하지 않고 보고한다.
- 대표가 `AUTO RUN ACTIVE PLAN - one small step only`라고 입력하면 첫 `TODO` 하나만 처리한다.

## Stop Conditions

- 작업트리가 dirty이고 기존 변경의 정체가 불명확함.
- local과 `origin/main`이 불일치함.
- 코드 수정, route 변경, 신규 API 추가가 필요해짐.
- 결제, 인증, Supabase, Android, FCM, production 로직 변경이 필요해짐.
- 투자 권유처럼 보이는 문구가 필요해짐.
- 여러 작업이 충돌 가능함.

## Task List

| Order | Status | Task | Area | Risk | Goal | Forbidden | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | DONE | 현재 `/coin` 홈 구조 audit | Coin Home / Audit | LOW | `/coin`, `CoinRadarHomePanel`, 관련 API 사용 구조를 조사하고 현재 홈이 어떤 질문에 답하는지 `docs/coin-home-decision-dashboard-audit.md`에 정리했다. | 코드 수정 금지. route 변경 금지. API 변경 금지. | `git diff --check` |
| 2 | DONE | 홈 decision model 설계 | Coin Home / Decision Model | MEDIUM | 홈 최상단 판단 모델을 `docs/coin-home-decision-dashboard-audit.md`에 문서화했다. 상태, 준비도 점수, 방향성, 시장 주도, 리스크 우선순위, Basic/Pro 구분, MVP/추후 데이터를 포함한다. | 코드 수정 금지. 투자 권유 문구 금지. RSI/스토캐스틱/트렌드를 선택 코인 기준으로 설계 금지. | `git diff --check` |
| 3 | DONE | 대표 코인 개인화 설계 | Coin Home / Personalization | MEDIUM | BTC/ETH/XRP 고정 구조를 내 대표 코인 구조로 확장하는 설계를 `docs/coin-home-decision-dashboard-audit.md`에 문서화했다. 기본값, 사용자 선택 후보, 현물/선물 모드, localStorage 우선, 계정 동기화 후순위, Basic/Pro 구분을 포함한다. | 코드 수정 금지. Supabase/계정 동기화 구현 금지. | `git diff --check` |
| 4 | DONE | BTC장 vs 알트장 판단 기준 설계 | Coin Home / Market Leadership | MEDIUM | BTC 우세, 알트 순환, 혼조, 위험 회피 상태와 현재 데이터 기반 MVP 기준, 추후 데이터, UI 반영 방식, Basic/Pro 구분을 `docs/coin-home-decision-dashboard-audit.md`에 문서화했다. | 코드 수정 금지. 신규 데이터 API 구현 금지. 투자 권유 문구 금지. | `git diff --check` |
| 5 | DONE | 첫 구현 후보 선정 | Coin Home / Implementation Planning | LOW | 실제 구현 1단계로 `오늘의 결론 + 준비도 + 시장 주도 라벨`을 선정하고 PR branch, 수정 파일 후보, 금지 범위, 검증 기준, PR 지시 초안을 `docs/coin-home-decision-dashboard-audit.md`에 문서화했다. | 코드 수정 금지. route 변경 금지. 신규 API 추가 금지. | `git diff --check` |

## Run Status

- Status: DONE.
- Selected first implementation: `오늘의 결론 + 준비도 + 시장 주도 라벨`.
- Suggested PR branch: `codex/coin-home-decision-summary`.
- Implementation should be handled in a separate active-run or PR branch.

## Validation Commands

- 설계 문서 작업 기본 검증:
  - `git diff --check`
  - 변경 파일 docs 범위 확인
  - 민감값 패턴 검사
- 이 run에서는 앱 코드 검증 명령을 기본 요구하지 않는다. 코드 파일을 수정해야 할 상황이면 작업을 중단하고 별도 구현 run으로 분리한다.

## Push / PR Policy

- 이번 run은 설계 run이므로 docs-only 작업만 허용한다.
- docs-only safe 작업은 대표가 허용한 경우에만 push할 수 있다.
- 실제 홈 UI 구현은 별도 active-run 또는 PR 기반 작업으로 분리한다.
- UI/디자인 구현은 스크린샷 확인 전 push/merge 금지다.

## Completion Report Format

- 선택한 작업.
- 선택 이유.
- 수정 파일.
- 설계 내용.
- 건드리지 않은 고위험 영역.
- 검증 결과.
- 커밋 해시.
- push 여부.
- 다음 추천 작업.

## Completion Criteria

- `/coin` 홈이 답해야 할 4가지 질문이 문서화됨.
- 홈 decision model, 대표 코인 개인화, BTC장 vs 알트장 판단 기준이 문서화됨.
- 첫 구현 후보 1개가 선정됨.
- 앱 코드, route, API, 결제, 인증, Supabase, Android, FCM 로직 변경이 없음.
