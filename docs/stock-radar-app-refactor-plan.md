# StockRadarApp 분리 설계 문서

## 1. 현재 구조 요약

`src/components/StockRadarApp.tsx`는 현재 1,200줄 이상이며 글로벌 자산레이더의 상태, 데이터 호출, 차트 초기화, 자산 선택 UI, 진단 패널, 모바일 하단 컨트롤까지 한 컴포넌트 안에서 처리한다.

현재 렌더링 기준 route는 다음처럼 분리되어 있다.

- `/global`은 글로벌 시장흐름 대시보드 전용 페이지다.
- `/global/assets`는 글로벌 자산레이더 전용 페이지다.
- `/global#asset-radar`는 `GlobalAssetHashRedirect`가 `/global/assets`로 이동시켜 과거 앵커 링크를 호환한다.
- `/news?market=global`은 글로벌 일정/뉴스 흐름이다.
- `/journal?market=global`은 글로벌 복기 흐름이다.

`StockRadarApp`은 `/global/assets`와 기존 `/stocks`에서 사용된다. 글로벌 제품 기준의 핵심 route는 `/global/assets`이며, `/global`에는 자산 상세 레이더가 섞이면 안 된다.

## 2. StockRadarApp이 커진 원인

`StockRadarApp`이 커진 이유는 독립적인 책임이 한 파일에 누적됐기 때문이다.

- 자산 universe, 대표 자산, 관심 자산 저장 로직이 포함되어 있다.
- 타임프레임과 분석 모드 상태를 직접 관리한다.
- `/api/stocks/candles` 호출과 loading/error/ready 상태를 직접 관리한다.
- `lightweight-charts` 생성, theme 반영, ResizeObserver, candle setData를 직접 처리한다.
- 자산별 playbook, checklist, 초보자 가이드, 기술 스냅샷, ICT 패널을 함께 렌더링한다.
- Basic/Pro gating과 `RadarInsightPanel` 표시 조건을 직접 계산한다.
- 모바일 하단 fixed control bar 표시 조건을 pathname 기준으로 직접 관리한다.
- 카드, 버튼, 검색, 필터, 차트, fallback 레이아웃 class가 한 파일에 섞여 있다.

이 상태에서 바로 대규모 분리를 진행하면 최근 수정한 `/global/assets` 차트 렌더링, 하단 패널, active 탭 흐름이 회귀할 위험이 크다.

## 3. `/global`과 `/global/assets` 분리 상태

현재 route 구조는 다음 기준을 유지해야 한다.

- `/global`은 `GlobalMarketPulse`, `MacroTicker`, `RadarTopNav`, `Header`, `AppFooter` 중심의 시장흐름 화면이다.
- `/global/assets`는 `StockRadarApp`을 포함하는 자산레이더 전용 화면이다.
- `/global/assets`에서만 모바일 하단 고정 패널이 표시된다.
- `/global`, `/news?market=global`, `/journal?market=global`에서는 자산레이더 하단 패널이 표시되면 안 된다.
- `RadarTopNav`의 active 상태는 hash가 아니라 pathname과 `market=global` query 기준이어야 한다.

리팩토링 기준 route는 `/global/assets`다. `/global`은 시장흐름 대시보드로 유지한다.

## 4. 역할별 분리 후보

`StockRadarApp.tsx` 안의 역할은 다음 단위로 분리할 수 있다.

| 역할 | 현재 위치 | 분리 후보 |
| --- | --- | --- |
| 자산 universe, 그룹 라벨, 대표 자산 | 상단 상수 | `components/global/types.ts`, `lib/stockMarket.ts` 유지 검토 |
| 자산 선택, 검색, 그룹 필터 | JSX 중단부 | `GlobalAssetSelector.tsx` |
| 관심 자산 저장/표시 | localStorage helper와 JSX | `GlobalWatchlistPanel.tsx`, 추후 hook |
| 타임프레임 선택 | 하단 control dock | `GlobalTimeframeTabs.tsx` |
| 분석 모드 선택 | 하단 control dock | `GlobalModeTabs.tsx` |
| 모바일 하단 고정 패널 | `GlobalRadarControlDock` | `GlobalControlBar.tsx` |
| 차트 컨테이너와 loading/error overlay | chart JSX | `GlobalChartPanel.tsx` |
| `lightweight-charts` 초기화 | chart effect | `useGlobalAssetChart.ts` |
| `/api/stocks/candles` fetch 상태 | `load` callback과 `LoadState` | `useGlobalAssetRadarData.ts` |
| 자산 상태/요약 | 선택 종목 카드, snapshot | `GlobalSummaryPanel.tsx`, `GlobalTechnicalSnapshot.tsx` |
| 자산별 playbook/checklist | helper와 카드 | `GlobalAssetPlaybook.tsx` |
| ICT 상세 | `GlobalIctPanel` | `GlobalIctPanel.tsx` |
| Basic/Pro gating | `isPaid`, `visibleRadarInsight` | `GlobalProGate.tsx` 또는 orchestrator 유지 |
| fallback state | loading/error 문구 | `GlobalFallbackState.tsx` |
| route 전용 동작 | `pathname === "/global/assets"` | orchestrator 또는 `useGlobalAssetRouteState.ts` |

## 5. 추천 파일 구조

1차 분리 후 목표 구조는 다음처럼 잡는다.

```txt
src/components/global/
  types.ts
  globalAssetConstants.ts
  GlobalAssetSelector.tsx
  GlobalWatchlistPanel.tsx
  GlobalChartPanel.tsx
  GlobalControlBar.tsx
  GlobalTimeframeTabs.tsx
  GlobalModeTabs.tsx
  GlobalSummaryPanel.tsx
  GlobalAssetPlaybook.tsx
  GlobalFallbackState.tsx
  GlobalProGate.tsx
  GlobalIctPanel.tsx
  useGlobalAssetRadarData.ts
  useGlobalAssetChart.ts
```

단, 처음부터 모든 파일을 만들면 회귀 위험이 커진다. 실제 구현은 단계별로 진행하고, 각 단계마다 `StockRadarApp`이 정상 orchestrator로 남아 있는지 확인한다.

## 6. 단계별 리팩토링 순서

### 1단계. 타입, 상수, helper 분리

- `GlobalRadarMode`, `LoadState`, `radarModes`, `featuredSymbols`, `groupLabels`, formatting helper를 분리한다.
- 동작 변경 없이 import 경로만 바꾼다.
- `StockRadarApp`의 상태 구조는 그대로 둔다.

### 2단계. 자산 선택 UI 분리

- 검색, 대표 자산 버튼, 그룹 필터, universe 목록을 `GlobalAssetSelector`로 이동한다.
- `symbol`, `setSymbol`, `selectedGroup`, `setSelectedGroup`, `searchQuery`, `setSearchQuery`, `visibleUniverse`, `featuredItems`를 props로 넘긴다.
- API 호출과 차트 코드는 건드리지 않는다.

### 3단계. 타임프레임과 분석 모드 컨트롤 분리

- `GlobalTimeframeTabs`와 `GlobalModeTabs`를 먼저 만든다.
- 그 다음 `GlobalControlBar`가 두 탭 컴포넌트를 조합하게 한다.
- `showMobileDock = pathname === "/global/assets"` 정책은 유지한다.

### 4단계. 차트 컨테이너와 fallback state 분리

- `GlobalChartPanel`은 항상 chart container를 렌더링해야 한다.
- loading/error/idle은 overlay로만 처리한다.
- 최근 문제였던 `chartRef.current` 초기화 타이밍을 절대 되돌리지 않는다.

### 5단계. 모바일 하단 control bar 분리

- 하단 fixed panel은 `GlobalControlBar`에서 담당한다.
- safe-area, bottom padding, 340px~360px 버튼 폭을 그대로 유지한다.
- `/global/assets` 이외 route에서 보이지 않는지 확인한다.

### 6단계. 요약/상태 패널 분리

- 선택 종목 제목, 현재가, 변동률, `StockSnapshot`, `GlobalAssetChecklist`, `GlobalPlaybook`을 작은 컴포넌트로 분리한다.
- Basic/Pro 정보 노출 범위는 변경하지 않는다.

### 7단계. 데이터 fetch hook 분리

- 마지막에 `useGlobalAssetRadarData`로 `/api/stocks/candles` 호출을 이동한다.
- 이 단계는 회귀 위험이 가장 크므로 앞 단계 안정화 후 진행한다.
- hook은 `symbol`, `timeframe`, `isPaid`를 입력받고 `state`, `load`, `universe` 업데이트 콜백을 반환하는 수준으로 제한한다.

### 8단계. `StockRadarApp`을 orchestrator로 축소

- 최종적으로 `StockRadarApp`은 상태 조합, props 전달, route 정책만 담당한다.
- 목표는 250~400줄 수준의 orchestrator다.

## 7. 회귀 위험

가장 중요한 회귀 위험은 다음이다.

- `/global/assets` 차트가 다시 안 뜨는 위험.
- `lightweight-charts`가 ref가 없는 상태나 height 0 컨테이너에서 초기화되는 위험.
- QQQ, SPY, NQ=F, ES=F, ^VIX, NVDA, SMH, GLD, CL=F 전환이 깨지는 위험.
- `5m / 15m / 1h / 4h / 1d` 전환 후 차트가 stale 상태로 남는 위험.
- `종합 / ICT / 기술지표` 모드 전환 후 패널이 사라지는 위험.
- 모바일 하단 fixed panel이 `/global` 시장 화면에 다시 표시되는 위험.
- 하단 fixed panel이 차트나 마지막 콘텐츠를 가리는 위험.
- `/news?market=global`, `/journal?market=global` active 탭 흐름에 영향이 가는 위험.
- Basic/Pro gating 누출이나 `RadarInsightPanel` 상세 조건 노출 범위가 바뀌는 위험.
- localStorage 관심 자산 저장 key가 바뀌어 기존 관심 자산이 사라지는 위험.

## 8. 단계별 검증 기준

각 단계는 최소 아래 검증을 통과해야 한다.

- `git diff --check`.
- `cmd /c npx tsc --noEmit`.
- `npm.cmd run build`.
- `npm.cmd run smoke:mobile`.
- `npm.cmd run smoke:all`.
- 340px와 360px에서 `/global/assets` 확인.
- QQQ, SPY, NVDA, ^VIX, NQ=F 전환 확인.
- `5m / 15m / 1h / 4h / 1d` 전환 확인.
- `종합 / ICT / 기술지표` 전환 확인.
- `/global` 시장 화면에 하단 패널이 안 뜨는지 확인.
- `/news?market=global`, `/journal?market=global` active 탭 영향 없음 확인.

데이터 hook을 분리하는 단계는 추가로 `/api/stocks/candles` 응답과 error fallback을 직접 확인한다.

## 9. 절대 바꾸면 안 되는 정책

리팩토링 중 다음 정책은 변경하지 않는다.

- 글로벌 데이터 로직과 API 응답 구조.
- `/api/stocks/candles`, `/api/stocks/market-board`의 의미.
- Basic/Pro gating 정책과 `visibleRadarInsightForPlan` 노출 범위.
- 타임프레임 `5m / 15m / 1h / 4h / 1d`의 의미.
- 분석 모드 `종합 / ICT / 기술지표`의 의미.
- 모바일 하단 패널은 `/global/assets`에서만 표시한다는 정책.
- `/global`은 시장흐름 대시보드로 유지한다는 정책.
- `/news?market=global`, `/journal?market=global` 글로벌 탭 흐름.
- 결제, 로그인, 푸시, Android native 설정.
- 코인/알트 레이더 구조.

## 10. 다음 구현 착수 조건

다음 방에서 실제 분리를 시작하려면 한 번에 한 단계만 진행한다. 첫 구현 PR 또는 커밋은 타입, 상수, 순수 helper 분리만 대상으로 잡고, UI와 데이터 fetch는 그대로 둔다.
