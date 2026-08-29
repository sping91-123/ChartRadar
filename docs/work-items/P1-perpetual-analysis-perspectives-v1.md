# P1 선물 상세 분석 관점 복원 v1

## 상태

- 상태: `DONE`
- 우선순위: `P1`
- 시작일: 2026-08-29
- 완료일: 2026-08-29
- 담당 화면: `/crypto/perpetual` BTC·ETH 상세 분석
- 위험도: 중간

## 문제

현재 BTC·ETH 상세 화면은 ICT 구조, 포지션 쏠림, 큰 체결, 감시 조건을 한 흐름으로 잘 연결하지만 사용자가 일반 기술지표를 독립적으로 교차 확인할 수 없습니다. 과거의 `종합 / ICT / 기술지표` 구성을 통째로 되돌리면 현재의 저장 스냅샷, 확정봉 시각, Pro 권한, 감시 조건과 다른 계산 경로가 다시 생겨 같은 화면에서 서로 다른 결론이 나올 수 있습니다.

## 제품 결정

- 하나의 저장된 선물 판단을 `통합 판단 / ICT 구조 / 기술지표` 세 관점으로 읽습니다.
- 세 관점은 표시 방식만 바꾸며 `summary.state`, 가장 큰 위험, 다음 확인 조건, 감시·알림·복기 결과를 바꾸지 않습니다.
- 첫 진입과 BTC·ETH 전환의 기본값은 항상 `통합 판단`입니다.
- 자동 스냅샷 갱신 중에는 사용자가 보고 있던 관점을 유지합니다.
- 기술지표는 통합 판단을 설명하거나 반대 근거를 확인하는 보조 자료이며 별도 매수·매도 판정, 확률, 종합 점수를 만들지 않습니다.

## 화면 구조

1. 공통 상단
   - 현재 판단, 가격, 가장 큰 위험, 다음 확인 조건, 감시·복기 버튼
   - 세 관점 어디에서도 동일하게 유지
2. 공통 차트
   - 현재의 15분·1시간·4시간 확정봉 차트와 가격 조건
   - 선택한 관점에 따라 별도 캔들 요청이나 다른 기준 시각을 만들지 않음
3. 분석 관점 선택
   - `통합 판단`: 구조, 기술지표 교차 확인, 포지션·큰 체결, AI 설명을 함께 읽음
   - `ICT 구조`: MSS·MSB·CHoCH, OB·FVG·Sweep·CISD·PD·POC·OTE만 집중해서 읽음
   - `기술지표`: RSI·MACD·EMA·ADX/DMI·Supertrend·Donchian·Keltner·ATR·Bollinger·거래량을 교차 확인
4. 공통 하단
   - Pro 확인·무효화 조건과 저장한 감시 목록

## 데이터 계약

- 판단 기준은 기존대로 `primaryTimeframe: 15m`, `contextTimeframes: [1h, 4h]`를 유지합니다.
- 모든 기술지표는 현재 스냅샷 생성 시 이미 분석한 확정봉 데이터에서 가져옵니다.
- 기존 `LiveMarketChart`와 `technicalRadar`의 별도 실시간 계산 경로는 BTC·ETH 상세에 다시 연결하지 않습니다.
- 새 공개 기술지표 요약은 15분 기준의 부가 필드로 추가합니다.
- Pro 상세는 같은 스냅샷에 저장된 15분·1시간·4시간 `condition` 값을 사용합니다.
- 이전 스냅샷에 새 필드가 없으면 잘못 추정하지 않고 `다음 갱신부터 표시` 상태를 보여줍니다.

## Basic / Pro 경계

| 기능 | Basic | Coin Pro |
| --- | --- | --- |
| 세 분석 관점 전환 | 제공 | 제공 |
| 15분 기술지표 핵심 요약 | 제공 | 제공 |
| 15분 RSI·MACD·추세·변동성·거래량 교차 확인 | 제공 | 제공 |
| 15분·1시간·4시간 선택 | 미제공 | 제공 |
| EMA·DMI·밴드 등 정확한 상세 수치 | 미제공 | 제공 |
| ICT의 정확한 시간·가격·반응 구간 | 기존 공개 범위 | 기존 Pro 범위 유지 |
| AI 맞춤 설명·상세 포지션·큰 체결·감시 한도 | 기존 정책 유지 | 기존 정책 유지 |

## 접근성·모바일 계약

- 탭은 `tablist / tab / tabpanel` 의미를 갖습니다.
- 좌우 방향키, Home, End 키로 관점을 이동할 수 있으며 위아래 방향키는 페이지 스크롤에 남깁니다.
- 선택된 탭만 키보드 초점을 받고 각 버튼은 최소 44px 높이를 유지합니다.
- 탭 이름 아래 현재 관점의 설명과 `한 지표만으로 최종 방향을 바꾸지 않는다`는 경계를 항상 표시합니다.
- 360px과 390px 화면에서 가로 스크롤, 하단 잘림, 과도한 숫자 밀집이 없어야 합니다.

## 함께 수정하는 신뢰성 문제

- 최신 스냅샷 갱신에 실패해 화면이 `stale` 상태가 되면 같은 스냅샷 ID의 과거 AI 설명이 현재 설명처럼 남을 수 있습니다.
- 데이터 품질이 `ready`가 아니면 진행 중 AI 요청을 중단하고 설명을 지우며 새 요청 버튼을 비활성화합니다.
- AI 프롬프트에는 저장된 판단·위험·다음 확인 조건이 권위값이고 보조지표가 이를 새로 만들거나 뒤집지 않는다는 규칙을 추가합니다.
- 프롬프트 버전을 올려 이전 캐시와 새 설명을 섞지 않습니다.

## 수정 범위

- `src/lib/perpetualAnalysisPerspective.ts` 신규
- `src/lib/perpetualDecisionSnapshot.ts`
- `src/components/coin/PerpetualAnalysisWorkspace.tsx` 신규
- `src/components/coin/PerpetualAnalysisTabs.tsx` 신규
- `src/components/coin/PerpetualTechnicalEvidencePanel.tsx` 신규
- `src/components/coin/PerpetualEvidenceWorkbench.tsx`
- `src/components/coin/PerpetualDecisionExperience.tsx`
- `src/components/coin/PerpetualSnapshotBriefing.tsx`
- `src/components/MajorsApp.tsx`
- `src/lib/ai/groq.ts`, `src/lib/ai/gemini.ts`
- `src/lib/server/perpetualBriefing.ts`
- `src/app/api/crypto/perpetual/briefing/route.ts`
- 관련 단위·계약 테스트와 smoke 목록

## 비범위

- Home 카드와 홈 판단 엔진 변경
- 방향 판정, 모니터 조건 ID, 알림 평가, 저널 저장 규칙 변경
- 새 지표 계산식 추가 또는 기존 지표 가중치 변경
- 결제, 인증, Supabase, Android release 변경
- 배포, push, production 데이터 마이그레이션

## 완료 기준

- 같은 스냅샷에서 세 관점을 전환해도 상단 판단과 조건이 변하지 않습니다.
- Basic은 15분 기술지표 핵심 근거를 실제로 읽을 수 있고 Pro CTA만 남는 빈 화면이 아닙니다.
- Pro는 15분·1시간·4시간 상세 수치를 정확한 해당 시간대 데이터로 읽습니다.
- ICT 화면에 RSI·MACD·ATR·거래량 카드가 섞이지 않습니다.
- 15분 데이터가 없을 때 1시간 데이터를 15분처럼 대신 표시하지 않습니다.
- stale 상태에서 이전 AI 설명이 남거나 새 AI 요청이 시작되지 않습니다.
- 타입 검사, production build, 관련 단위 테스트, copy/ops/routes/mobile smoke, 360px·390px Playwright 확인을 통과합니다.

## 중단 조건

- 기존 판단 엔진이나 감시 조건 의미를 바꿔야만 구현할 수 있는 경우
- Basic/Pro 응답에서 현재 권한 정책보다 더 민감한 상세 가격·시각이 노출되는 경우
- 이전 저장 스냅샷 호환을 위해 payload schema나 monitor version 마이그레이션이 필요한 경우

## 완료 검증

- `npm.cmd run test:perpetual-perspectives`
- `npm.cmd run test:perpetual-snapshot`
- `npm.cmd run test:perpetual-briefing`
- `npm.cmd run test:perpetual-mss`
- `npm.cmd run test:perpetual-chart-overlays`
- `npx.cmd tsc --noEmit`
- `npm.cmd run smoke:copy`
- `npm.cmd run smoke:ops`
- `npm.cmd run smoke:routes`
- `npm.cmd run smoke:mobile`
- `npm.cmd run build`
- CLI Playwright 실데이터 확인
  - 360×800, 390×844 가로 넘침 없음
  - 관점 탭 44px 높이, 좌우·Home·End 이동, 위아래 키 비점유
  - 긴 화면에서 관점 탭 sticky 상단 `0px` 유지
  - 자동 스냅샷 갱신 시 선택 관점 유지
  - BTC→ETH 변경 시 `통합 판단` 초기화
  - 개발 콘솔 오류 없음

배포, push, production 변경은 수행하지 않았습니다.
