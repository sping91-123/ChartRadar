# Active Automation Run

## Run Title

- `full-app-boxless-implementation-run`

## Purpose

- ChartRadar의 모든 주요 화면을 카드/박스/패널 중심 구조에서 벗어나 full-screen app flow로 전환한다.
- 경계는 큰 박스가 아니라 여백, 타이포그래피, divider, list/report 흐름으로 만든다.
- 이미 완료된 `/news`, 공통 Header/Nav, `/alerts` pilot을 기준으로 나머지 화면에 순차 적용한다.

## Background

- 대표는 `/journal`만이 아니라 Coin Radar, Global Radar, 시장 선택, 자산, 일정/뉴스, 복기, 설정/알림, Pro까지 전 화면을 boxless 방향으로 전환하기로 결정했다.
- 기존 `boxless-journal-pilot-run`은 범위가 너무 좁으므로 이 full-app implementation run으로 대체한다.
- 진행 연속성은 채팅방이 아니라 이 active-run, completed 기록, PR, 검증 스크린샷에 저장한다.

## Already Completed Pilots

- `/news` boxless pilot.
- 공통 Header/Nav/AppShell boxless pilot.
- `/alerts` boxless list pilot, PR #1 merged.

## Product Principles

- Coin Radar와 Global Radar는 동등한 상위 시장 모드로 유지한다.
- Global Radar는 해외주식/해외선물 사용자용 독립 레이더이며, 코인 보조 매크로로 격하하지 않는다.
- 투자 권유처럼 보이는 문구를 추가하지 않는다.
- 결제, 인증, Supabase, Android, FCM, production 로직은 디자인 작업과 섞지 않는다.
- UI 구현 작업은 PR 기반을 기본값으로 한다.

## Start Conditions

- 작업 전 `git status --short --branch`와 `git rev-list --left-right --count HEAD...origin/main`을 확인한다.
- local과 `origin/main`이 불일치하면 새 작업을 시작하지 않고 보고한다.
- 대표가 `AUTO RUN ACTIVE PLAN - one small step only`라고 입력하면 첫 `TODO` 하나만 처리한다.

## Stop Conditions

- 작업트리가 dirty이고 기존 변경 정체가 불명확함.
- local과 `origin/main`이 불일치함.
- 저장/복기, 결제, 인증/session, Supabase, Android, FCM, production 로직 변경이 필요해짐.
- route 변경이 필요해짐.
- UI 작업에서 스크린샷 확인 없이 push/merge가 필요해짐.
- Global Radar 독립성이 약화될 가능성이 있음.

## Task List

| Order | Status | Task | Area | Risk | Goal | Forbidden | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | DONE | Full app implementation map 정리 | App-wide design ops | LOW | 전 화면 boxless 구현 순서와 page groups를 `docs/full-app-boxless-implementation-plan.md`에 정리했다. `/journal` audit도 `docs/journal-boxless-pilot-audit.md`에 기록했다. | 앱 코드 수정 금지. | `git diff --check` |
| 2 | DONE | `/journal` boxless form/list pilot 적용 | Journal UI implementation | HIGH | `/journal` 화면의 outer surface, summary, pending radar, quick form, feedback, history 영역을 `report`/`flat` surface와 divider/list 흐름으로 정리했다. | 저장 로직 변경 금지. Supabase 변경 금지. 인증/session 변경 금지. journal API/data shape 변경 금지. 결제/Android/FCM 변경 금지. 자동 push 금지. | `cmd /c npx tsc --noEmit`; `npm.cmd run build`; `npm.cmd run smoke:mobile`; `npm.cmd run smoke:all`; `git diff --check`; `/journal` 360px screenshot; `/journal` desktop screenshot |
| 3 | DONE | `/global` 본문 report/list pilot 적용 | Global Radar UI | HIGH | Global Radar 본문과 compact macro ticker의 큰 panel/card 중첩을 divider/report/list 흐름으로 정리했다. | Global Radar 독립성 훼손 금지. API/fetch/chart logic 변경 금지. 결제/인증/Supabase 변경 금지. 자동 push 금지. | `cmd /c npx tsc --noEmit`; `npm.cmd run build`; `npm.cmd run smoke:mobile`; `npm.cmd run smoke:all`; `git diff --check`; `/global` 360px screenshot; `/global` desktop screenshot |
| 4 | DONE | `/global/assets` 자산 레이더 boxless pilot 적용 | Global Assets UI | HIGH | 자산 선택, 관심 종목, 체크리스트, 차트 wrapper, control dock을 divider/list/chart 중심 화면으로 정리했다. | chart rendering/data fetch 변경 금지. 모바일 dock이 content를 가리지 않게 확인. 자동 push 금지. | `cmd /c npx tsc --noEmit`; `npm.cmd run build`; `npm.cmd run smoke:mobile`; `npm.cmd run smoke:all`; `git diff --check`; `/global/assets` 340px/360px/desktop screenshots |
| 5 | DONE | `/crypto` 본문 redesign run 준비 및 1차 적용 | Coin Radar UI | HIGH | Coin Radar 본문 AI briefing, ICT, combined, detailed readout, plan sections를 major screen 기준 report/divider 흐름으로 정리했다. | 판단 로직, chart rendering, API fetch, Basic/Pro gating 변경 금지. 자동 push 금지. | `cmd /c npx tsc --noEmit`; `npm.cmd run build`; `npm.cmd run smoke:mobile`; `npm.cmd run smoke:all`; `git diff --check`; `/crypto` 360px/desktop screenshots; BTC/ETH/timeframe/mode checks |
| 6 | DONE | `/alts` boxless 적용 | Alt Radar UI | MEDIUM | 알트 필터, 관심 코인, 알트 전용 `LiveMarketChart` shell을 list/report 흐름으로 정리했다. | scanner/data/gating 변경 금지. 자동 push 금지. | `cmd /c npx tsc --noEmit`; `npm.cmd run build`; `npm.cmd run smoke:mobile`; `npm.cmd run smoke:all`; `git diff --check`; `/alts` 360px/desktop screenshots |
| 7 | DONE | `/pro` boxless pricing review | Pro / Billing UI | HIGH | Pro intro, current/difference, plan limits, trust notes wrapper를 report/list variant로 약화하고 가격/CTA는 유지했다. | billing.ts, RevenueCat, productId, planId, entitlement, 결제 API 변경 금지. 자동 push 금지. | `cmd /c npx tsc --noEmit`; `npm.cmd run build`; `npm.cmd run smoke:billing`; `git diff --check`; `/pro` 360px/desktop screenshots |
| 8 | TODO | `/learn`, account/settings/support surfaces 정리 | Learn / Account UI | MEDIUM | 학습/계정/정책/설정성 화면에서 불필요한 card wrapper를 줄인다. | auth/account deletion policy 변경 금지. route 변경 금지. 자동 push 금지. | `cmd /c npx tsc --noEmit`; `npm.cmd run build`; `git diff --check`; touched routes screenshots |
| 9 | TODO | 시장 선택과 공통 footer/fallback 최종 정리 | Entry / Common Shell | MEDIUM | 시장 선택, footer, empty/loading/fallback surfaces를 앱다운 full-screen 흐름으로 정리한다. | route 변경 금지. 마지막 사용 시장 구현 금지 unless 별도 승인. 자동 push 금지. | `cmd /c npx tsc --noEmit`; `npm.cmd run build`; `npm.cmd run smoke:mobile`; `git diff --check`; `/` 360px/desktop screenshots |
| 10 | TODO | 전체 route boxless QA 및 잔여 박스 목록 정리 | Final QA | LOW | 모든 주요 route를 스크린샷/검색 기준으로 점검하고 남은 허용 박스와 제거 후보를 기록한다. | 앱 코드 수정 금지. | `git diff --check`; route screenshot inventory |

## Push / PR Policy

- 실제 UI 구현 작업은 branch/PR 기반으로 진행한다.
- UI/디자인 작업은 스크린샷 확인 전 push/merge 금지.
- docs-only 작업만 대표가 safe push를 허용한 경우 main push 가능.
- 결제, 인증, Supabase, Android, FCM, production 관련 변경은 자동 push 금지.

## Completion Criteria

이 run은 다음이 모두 끝나야 완료로 볼 수 있다:

- 시장 선택, `/crypto`, `/alts`, `/global`, `/global/assets`, `/news`, `/alerts`, `/journal`, `/learn`, `/pro`, account/settings/support성 화면이 boxless 원칙에 맞게 검토 또는 적용됨.
- 각 UI 구현 PR마다 모바일/desktop 스크린샷 검수 완료.
- 남아 있는 박스는 결제/인증/위험/폼/모달/critical/touch target 등 명확한 이유가 있는 경우로 제한됨.
- 앱 기능, 데이터, 결제, 인증, Supabase, Android, FCM 로직 변경이 디자인 작업에 섞이지 않음.
