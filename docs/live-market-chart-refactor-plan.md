# LiveMarketChart 분리 설계 문서

## 1. 현재 구조 요약

`src/components/LiveMarketChart.tsx`는 약 3,800라인 규모의 클라이언트 컴포넌트이며, 현재 `/crypto`의 BTC/ETH 코인 레이더 화면과 `/alts`의 알트코인 레이더 화면을 동시에 담당한다.

- 실제 작업 기준 route는 `/crypto`다.
- `/crypto`는 `src/app/crypto/page.tsx`에서 `MajorsApp`을 렌더링한다.
- `MajorsApp`은 `Header`, `RadarTopNav`, `MacroTicker`, `<LiveMarketChart majorOnly />`, `AppFooter` 순서로 코인 레이더 화면을 구성한다.
- `/majors`는 현재 기준 route가 아니며, `src/app/majors/page.tsx`에서 `/crypto`로 redirect되는 호환 route로만 취급한다.
- `/alts`는 `Header`, `RadarTopNav`, `MacroTicker`, `SetupScoutPanel excludeMajor`, `WatchlistPanel`, `<LiveMarketChart altOnly />`, `AppFooter` 순서로 구성된다.
- 같은 `LiveMarketChart` 안에서 `majorOnly`, `altOnly`, `hasCoinPro`, `canShowMajorProDetails`, `canShowAltProDetails`, `canShowDetailedAnalysis` 분기로 화면과 정보 노출 범위가 결정된다.
- `RadarInsightPanel`은 상단 판단 패널로 분리되어 있지만, 그 아래 근거/브리핑/상세 패널 대부분은 `LiveMarketChart.tsx` 내부 JSX와 helper에 남아 있다.
- `TechnicalRadarPanel`, `LiquidationPressurePanel`, `BeginnerActionGuide`는 외부 컴포넌트로 호출되지만, 표시 조건과 전달 데이터는 `LiveMarketChart.tsx`가 직접 통제한다.
- `SetupScoutPanel`, `WatchlistPanel`, `Header`, `AppFooter`는 `/alts` 또는 앱 레이아웃에서 별도로 연결되며, `LiveMarketChart.tsx` 내부에 직접 렌더링되지는 않는다.

## 2. LiveMarketChart가 커진 원인

`LiveMarketChart.tsx`가 커진 핵심 원인은 화면 orchestration과 세부 기능 구현이 한 파일에 공존하기 때문이다.

- 데이터 fetch, 캐시, localStorage 마이그레이션, 알트 무료 분석 gate가 같은 파일에 있다.
- Lightweight Charts 생성, resize, candle setData, price line, marker, overlay 설정이 컴포넌트 본문에 결합되어 있다.
- `/crypto` BTC/ETH 전용 UX와 `/alts` 알트 전용 UX가 같은 JSX tree에서 조건부 렌더링된다.
- Basic/Pro gating이 요약 패널, 차트 overlay, 브리핑, 시나리오, 체크포인트, 저널 저장, 알트 분석 제한에 분산되어 있다.
- 판단 표시 helper, 라벨 formatter, 상태 class helper, 브리핑 문단화, Pine parity 비교 helper가 모두 같은 파일에 있다.
- 모바일 차트 높이, 모바일 하단 타임프레임 컨트롤, 상단 심볼 선택, 고급 설정 UI가 한 컴포넌트 안에서 서로 영향을 준다.

## 3. /crypto 기준 작업 원칙

이번 분리 설계와 후속 리팩토링의 주 기준은 `/crypto`다.

- 리팩토링 기준 화면은 `/crypto` BTC/ETH 코인 레이더다.
- 문서, 검증, 수동 QA의 기본 표현은 `/crypto`를 사용한다.
- `majorOnly`는 `/crypto`에서 BTC/ETH만 보여주기 위한 내부 props로 다룬다.
- `/crypto` 상단 판단, BTC/ETH 전환, 타임프레임 전환, Basic/Pro 노출 경계를 먼저 보호한다.
- `/crypto`를 개선하더라도 같은 `LiveMarketChart`를 공유하는 `/alts` 회귀 검증은 매 단계 필수다.
- `/crypto`와 `/alts`를 완전히 분리하는 것은 별도 승인 전에는 하지 않는다.

## 4. /majors 호환/redirect 취급

`/majors`는 현재 작업 기준 route가 아니다.

- `/majors`는 `redirect("/crypto")`로 연결되는 호환 route다.
- 문서와 후속 작업에서는 `/majors`를 주 기준으로 쓰지 않는다.
- `/majors` 관련 확인은 `/crypto` redirect가 유지되는지 확인하는 수준으로 제한한다.
- 실제 UI 검증, 모바일 검증, Basic/Pro 검증은 `/crypto`에서 수행한다.

## 5. 역할별 분리 후보

| 역할 | 현재 책임 | 분리 후보 |
| --- | --- | --- |
| 차트 렌더링 | `chartRef`, `createChart`, candle series, marker, price line, resize, chart height | `CryptoChartPanel.tsx`, 이후 `useCryptoChart.ts` |
| 심볼 선택 | BTC/ETH, 알트 기본 심볼, 기타 심볼 검색, `majorOnly`/`altOnly` 강제 보정 | `CryptoSymbolSelector.tsx`, `useCryptoSymbolState.ts` |
| 타임프레임 선택 | `5m`, `15m`, `1h`, `4h`, `1d` 상태와 저장 | `CryptoTimeframeTabs.tsx` |
| 분석 모드 선택 | 닫힌 봉/진행 중 봉, 레이더 프로필, 구조 감도 | `CryptoModeTabs.tsx`, `CryptoAdvancedControls.tsx` |
| 코인 레이더 요약 패널 | `RadarInsightPanel` 전달 props, summary metrics, 판단 강도 도움말 | `CryptoSummaryPanel.tsx` |
| Basic/Pro gating | `hasCoinPro`, `/crypto` 상세 노출, `/alts` 상세 노출, Basic 안내 CTA, Pro 잠금 문구 | `CryptoProGate.tsx`, `cryptoGating.ts` |
| 리스크/근거 표시 | 판단 근거 요약, 체크포인트, long/short scenario, proPlan | `CryptoEvidencePanel.tsx`, `CryptoRiskPanel.tsx` |
| 청산/거래량/변동성 표시 | `LiquidationPressurePanel`, volume profile, volatility, liquidity, OB/FVG/POC/OTE 표시 | `CryptoMarketPressureSection.tsx`, `CryptoStructureEvidence.tsx` |
| 알림/저널/저장 CTA | 저널 payload 생성, local/remote 저장, 저장 상태 메시지 | `CryptoJournalActions.tsx`, 이후 `useCryptoJournalSave.ts` |
| 모바일 하단 컨트롤 | fixed bottom timeframe tabs, safe area, overflow 영향 | `CryptoMobileControlBar.tsx` |
| API fetch/data state | Binance candle fetch, multi-timeframe 분석, cache fallback, auto-refresh | `useCryptoRadarData.ts` |
| loading/error/fallback state | 로딩 overlay, 캐시 사용 안내, 에러 메시지, 알트 limit 안내 | `CryptoFallbackState.tsx` |
| 디자인/레이아웃 전용 코드 | 카드, 섹션 제목, 안내 박스, helper class | `CryptoSectionCard.tsx`, `cryptoDisplayHelpers.ts` |

## 6. 추천 파일 구조

초기에는 public import를 깨지 않기 위해 `LiveMarketChart.tsx`를 유지하고, 내부 구현만 `src/components/crypto/` 아래로 단계적으로 이동한다.

```txt
src/components/crypto/
  types.ts
  constants.ts
  cryptoDisplayHelpers.ts
  cryptoGating.ts
  CryptoChartPanel.tsx
  CryptoSummaryPanel.tsx
  CryptoSymbolSelector.tsx
  CryptoTimeframeTabs.tsx
  CryptoModeTabs.tsx
  CryptoAdvancedControls.tsx
  CryptoMobileControlBar.tsx
  CryptoFallbackState.tsx
  CryptoEvidencePanel.tsx
  CryptoRiskPanel.tsx
  CryptoStructureEvidence.tsx
  CryptoMarketPressureSection.tsx
  CryptoJournalActions.tsx
  useCryptoRadarData.ts
  useCryptoChart.ts
  useCryptoPersistence.ts
  useCryptoJournalSave.ts
```

권장 원칙은 `LiveMarketChart.tsx`를 마지막까지 orchestrator로 남기는 것이다.

- `/crypto`, `/alts` import 경로는 최종 단계까지 바꾸지 않는다.
- `majorOnly`와 `altOnly` prop의 의미를 바꾸지 않는다.
- `/majors`는 redirect 호환 확인만 하고, 컴포넌트 분리 기준으로 삼지 않는다.
- hook 분리는 마지막 단계에 가깝게 진행한다. 데이터 fetch와 차트 lifecycle은 회귀 위험이 크기 때문이다.

## 7. 단계별 리팩토링 순서

### 0단계. 기준 동작 고정

- 리팩토링 전 `/crypto` Basic/Pro, `/alts` Basic/Pro, 340px/360px 모바일 화면을 캡처한다.
- BTC/ETH 전환, 알트 심볼 전환, `5m/15m/1h/4h/1d` 전환의 현재 동작을 기록한다.
- `/majors`는 `/crypto`로 redirect되는지만 확인한다.
- 이 단계는 코드 이동 없이 회귀 기준만 만든다.

### 1단계. 타입/상수/표시용 helper 분리

- `symbols`, `majorSymbols`, `altSymbols`, storage key, 옵션 배열, 순수 formatter를 `constants.ts`, `types.ts`, `cryptoDisplayHelpers.ts`로 이동한다.
- `analyzeTimeframe`, `summarizeMarket`, `marketAnalysisToRadarInsight` 호출 방식은 바꾸지 않는다.
- JSX와 state 구조는 유지한다.

### 2단계. 차트 컨테이너와 fallback state 분리

- `CryptoChartPanel.tsx`로 `chartRef` container, 높이 class, loading overlay, chart wrapper만 먼저 이동한다.
- `createChart`, series, price line, marker lifecycle은 처음에는 parent에 남긴다.
- 로딩, 에러, 캐시 사용, 알트 분석 제한, Basic 안내 CTA를 `CryptoFallbackState.tsx`로 이동한다.
- 모바일 높이 정책은 `/crypto` 기준 `h-[260px] sm:h-[520px]`, 알트 기준 `h-[420px] sm:h-[520px]`를 유지한다.

### 3단계. 타임프레임/분석 모드 컨트롤 분리

- 상단 타임프레임 탭과 모바일 하단 컨트롤을 각각 `CryptoTimeframeTabs.tsx`, `CryptoMobileControlBar.tsx`로 분리한다.
- 분석 모드, 레이더 프로필, 구조 감도 컨트롤은 `CryptoModeTabs.tsx`, `CryptoAdvancedControls.tsx`로 분리한다.
- BTC/ETH 및 알트 심볼 선택은 `CryptoSymbolSelector.tsx`로 분리한다.
- `activeTimeframe`, `analysisMode`, `radarProfile`의 의미와 저장 key는 유지한다.

### 4단계. 상단 요약 패널 분리

- `RadarInsightPanel` 전달 데이터를 `CryptoSummaryPanel.tsx`에서 구성한다.
- `RadarInsightPanel` 자체는 수정하지 않는다.
- `/crypto`의 첫 화면 판단 위계를 유지하고, `/alts`의 기존 표시 정책을 우회하지 않는다.

### 5단계. Pro gating/CTA 분리

- `canShowMajorProDetails`, `canShowAltProDetails`, `canShowDetailedAnalysis`, `isBasicAltView` 계산을 `cryptoGating.ts` 또는 `CryptoProGate.tsx`로 정리한다.
- Basic에서는 구체 조건, 무효화, 가격 레벨, `analysis.proPlan`, `analysis.checkpoints`, `analysis.actionGuide`가 렌더링되지 않는 조건을 유지한다.
- `/crypto` 전용 gating이 `/alts` 정책을 우회하지 않는지 검증한다.
- 저널 저장 CTA와 Pro 잠금/열림 문구는 표시 컴포넌트로만 이동하고 정책은 동일하게 유지한다.

### 6단계. 데이터 fetch hook 분리

- 마지막에 `useCryptoRadarData.ts`로 Binance candle fetch, multi-timeframe 분석, cache fallback, auto-refresh를 이동한다.
- 이 단계는 회귀 위험이 가장 높으므로 별도 커밋으로 분리한다.
- hook 입력은 `symbol`, `activeTimeframe`, `analysisMode`, `msbMode`, `structureSensitivity`, `effectiveTradingMode`, `altOnly`, `hasCoinPro`로 명시한다.
- API 응답 구조와 분석 엔진 호출 순서는 바꾸지 않는다.

### 7단계. LiveMarketChart orchestrator 축소

- `LiveMarketChart.tsx`는 상태 조합, gating 조합, 주요 섹션 배치만 담당한다.
- 목표는 500~900라인 안팎의 orchestrator로 축소하는 것이다.
- 이 단계에서도 public API는 `LiveMarketChart({ majorOnly, altOnly })` 그대로 유지한다.

## 8. 회귀 위험

| 위험 | 원인 | 예방책 |
| --- | --- | --- |
| 차트가 안 뜸 | `chartRef`, `createChart`, series lifecycle, cleanup 순서 변경 | 차트 hook 분리는 후순위로 미루고, 먼저 container만 분리한다. |
| BTC/ETH 전환 깨짐 | `majorOnly`, stored symbol, `selectSymbol`, 강제 보정 effect 변경 | `/crypto`에서 BTC와 ETH 전환을 매 단계 확인한다. |
| `5m/15m/1h/4h/1d` 전환 깨짐 | `activeTimeframe`, cache key, multi-timeframe fetch 의존성 변경 | 모든 timeframe 전환 후 차트와 상단 판단 갱신을 확인한다. |
| Basic/Pro gating 깨짐 | `canShowMajorProDetails`, `canShowAltProDetails`, `visibleRadarInsightForPlan` 이동 중 조건 누락 | Basic에서 Pro 가격 레벨과 구체 조건이 실제 렌더링되지 않는지 확인한다. |
| 모바일 하단 컨트롤 깨짐 | fixed bottom, safe area, `pb-*`, overflow 변경 | 340px/360px 실기기 또는 브라우저 모바일 폭에서 확인한다. |
| `/alts` 영향 발생 | 같은 `LiveMarketChart`를 `altOnly`로 공유 | 모든 분리는 `majorOnly`와 `altOnly` props를 명시적으로 전달하고 `/alts`를 회귀 확인한다. |
| 차트 높이/overflow 회귀 | chart wrapper 분리 중 height class 변경 | 현재 모바일/데스크톱 높이 class를 별도 상수로 고정한다. |
| smoke에서 안 잡히는 실기기 회귀 | Pro 세션, Android Chrome 주소창, touch target, safe-area 문제 | smoke 외에 실기기 Basic/Pro 확인을 유지한다. |

## 9. 단계별 검증 기준

각 단계는 작은 커밋 단위로 진행하고, 최소 아래 검증을 수행한다.

```txt
git diff --check
cmd /c npx tsc --noEmit
npm.cmd run build
npm.cmd run smoke:mobile
npm.cmd run smoke:all
```

수동 확인 기준은 다음과 같다.

- 340px/360px 모바일 폭에서 `/crypto` 확인.
- BTC/ETH 전환 확인.
- `5m/15m/1h/4h/1d` 전환 확인.
- `/crypto` Basic 상태에서 구체 조건, 무효화, 가격 레벨, Pro 세부 정보가 렌더링되지 않는지 확인.
- `/crypto` Pro 상태에서 상세 근거, 추적 조건, 무효화 조건, 리스크 점검이 유지되는지 확인.
- `/alts`에서 기존 무료/유료 노출 정책과 알트 분석 제한이 유지되는지 확인.
- `/majors`는 `/crypto` redirect가 유지되는지 확인.
- 모바일 하단 컨트롤이 차트 또는 CTA와 겹치지 않는지 확인.
- 데스크톱에서 차트가 과하게 작아지거나 레이아웃이 무너지지 않는지 확인.

## 10. 절대 바꾸면 안 되는 정책

리팩토링 중 아래 정책은 변경하지 않는다.

- 레이더 계산 로직.
- `radarDecisionEngine.ts`, `marketAnalysis.ts`, `technicalRadar.ts`, `radarInsight.ts`의 판단 의미.
- API 응답 구조와 `/api/*` fetch 계약.
- Basic/Pro gating 정책.
- `visibleRadarInsightForPlan`을 통한 Basic/Pro 정보 노출 경계.
- 타임프레임 의미와 `5m/15m/1h/4h/1d` 선택 정책.
- 분석 모드 의미인 닫힌 봉 기준과 진행 중 봉 포함.
- `/crypto` 모바일 차트 높이 정책.
- `/alts` 화면의 무료/유료 정책, 분석 제한, 알트 심볼 선택 정책.
- `/majors` redirect 호환 정책.
- 결제, 로그인, 푸시, 알림, 저널, 스캐너, 매크로 캘린더 로직.
- 투자 자문처럼 보이는 문구 금지 정책.

## 11. 권장 운영 방식

- 한 단계는 한 커밋으로 끝낸다.
- 차트 lifecycle, data fetch hook, Basic/Pro gating은 서로 다른 커밋으로 분리한다.
- 리팩토링 중 디자인 변경은 하지 않는다.
- 새 컴포넌트는 먼저 props-only presentational component로 만들고, hook 이동은 후순위로 둔다.
- `/crypto` 개선 목적으로 시작하더라도 `LiveMarketChart`가 `/alts`와 공유된다는 점을 매 단계 검증한다.
