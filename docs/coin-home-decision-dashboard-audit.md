# Coin Home Decision Dashboard Audit

## Scope

- Route: `/coin`
- Main page: `src/app/coin/page.tsx`
- Main panel: `src/components/coin/CoinRadarHomePanel.tsx`
- Shared shell:
  - `src/components/Header.tsx`
  - `src/components/RadarTopNav.tsx`
  - `src/components/MacroTicker.tsx`
- APIs read by the current home panel:
  - `/api/market-board`
  - `/api/crypto-candles?symbol=BTCUSDT&timeframe=1h&limit=180`
  - `/api/coin-market-metrics`
  - `/api/liquidation-pressure?symbol=BTCUSDT&period=1h`
  - `/api/liquidation-pressure?symbol=ETHUSDT&period=1h`
  - `/api/liquidation-pressure?symbol=XRPUSDT&period=1h`

This audit is documentation-only. No app code, API, route, billing, auth, Supabase, Android, or FCM logic was changed.

## Current Structure

`/coin` renders a simple vertical stack:

1. `Header market="crypto"`
2. `RadarTopNav market="crypto"`
3. `MacroTicker compact`
4. `CoinRadarHomePanel`
5. `AppFooter`

`CoinRadarHomePanel` loads all home data client-side with one `Promise.all` call. It then renders:

1. Home summary
2. Representative coins
3. BTC market strength
4. Representative coin funding
5. Judgment helper disclaimer

## Current Data Sources

### `/api/market-board`

- Source: Binance ticker endpoints.
- Shape used by home:
  - `symbol`
  - `name`
  - `price`
  - `changePercent`
  - `quoteVolume`
- Current home use:
  - BTC/ETH/XRP current price.
  - BTC/ETH/XRP 24h change.
  - Representative coin direction, score, risk, and next check text.
- Gap:
  - `quoteVolume` is loaded but not used in the current home decision model.
  - It does not currently calculate broad alt participation or top alt relative strength.

### `/api/crypto-candles`

- Current request: `BTCUSDT`, `1h`, `180` candles.
- Current home use:
  - Runs `analyzeTechnicalRadar(candles)` locally.
  - Provides BTC trend label, technical summary, RSI, stochastic, volatility/trend/momentum readings, and fear/greed score from the technical report.
- Gap:
  - Only BTC is analyzed.
  - The result is presented as market strength, but not converted into a single "시장 볼만함" decision.

### `/api/coin-market-metrics`

- Source candidates:
  - CoinGecko global market cap for BTC dominance.
  - Frankfurter USD/KRW.
  - Upbit BTC/KRW.
  - Binance BTCUSDT.
- Current home use:
  - BTC dominance.
  - Kimchi premium.
  - USD/KRW.
- Gap:
  - Dominance is displayed but not classified into BTC-led, alt-led, mixed, or risk-off regimes.
  - FX and kimchi premium are displayed as raw support metrics, not integrated into risk state.

### `/api/liquidation-pressure`

- Current requests:
  - BTCUSDT 1h
  - ETHUSDT 1h
  - XRPUSDT 1h
- Current home use:
  - Funding rate for BTC/ETH/XRP.
  - BTC long/short ratio in market strength.
- Gap:
  - Funding and long/short data are not yet converted into a derivatives crowding risk label.
  - No combined risk priority is shown at the top.

### `MacroTicker compact`

- Current home use:
  - Shows the nearest/recent macro event as a compact link to `/news?market=crypto#macro-calendar`.
- Gap:
  - Macro event is visually present but not part of the home decision state.
  - The home does not yet say whether an upcoming event should shift the user into wait mode.

## Questions The Current Home Answers

### 1. What are BTC/ETH/XRP doing now?

Partially answered.

- The representative coin section shows price, 24h change, direction label, score, risk text, and next check text for BTC/ETH/XRP.
- Direction is based on each coin's 24h `changePercent`.
- Score is based on each coin's `changePercent` plus a small bias from the BTC technical fear/greed score.

### 2. What is BTC market strength?

Partially answered.

- The BTC market strength section shows:
  - Fear/greed score.
  - BTC RSI.
  - BTC stochastic.
  - BTC trend.
  - BTC dominance.
  - BTC long/short ratio.
  - Kimchi premium.
  - USD/KRW.
- These are shown as separate rows, not as one action-oriented decision.

### 3. Is derivatives positioning stretched?

Partially answered.

- BTC long/short ratio and BTC/ETH/XRP funding rates are displayed.
- The home does not yet turn them into a clear "파생 쏠림 리스크" state.

### 4. What should I check next?

Partially answered.

- Each representative coin has a simple next check sentence.
- This check is generated from 24h price change only, not from a combined model using BTC trend, macro event risk, dominance, funding, and market breadth.

## Questions The Current Home Does Not Answer Well

### 1. 지금 장을 봐도 되는가?

Not answered clearly.

- The home has a market tone from BTC technical fear/greed:
  - high score: tracking possible
  - low score: risk first
  - middle score: watch first
- This is not enough for a 10-second decision because it ignores:
  - upcoming macro events.
  - BTC dominance regime.
  - alt breadth.
  - derivatives crowding.
  - kimchi premium and FX stress.
- There is no top-level state such as:
  - 관망
  - 조건 대기
  - 추적 가능
  - 리스크 확대

### 2. 내 대표 코인은 추적할 만한가?

Partially answered, but not personalized.

- The home currently uses fixed representative symbols: BTC, ETH, XRP.
- There is no "내 대표 코인" selection.
- There is no localStorage preference.
- There is no spot/futures mode distinction.
- The representative coin score does not consider whether the user actually cares about that coin.

### 3. 지금은 BTC장이냐, 알트장이냐?

Not answered.

- BTC dominance is displayed, but there is no market leadership label.
- The home does not compare:
  - BTC trend vs alt participation.
  - ETH/BTC relative strength.
  - alt riser ratio.
  - number of high-volume alt movers.
  - top alt relative returns.
- The current market board already includes several alt symbols and `quoteVolume`, so the first leadership model can start from existing data before adding new APIs.

### 4. 지금 가장 큰 리스크는 뭔가?

Not answered as a priority.

- Risk is scattered across:
  - representative coin risk text.
  - BTC technical rows.
  - long/short ratio.
  - funding rates.
  - macro ticker.
  - kimchi premium.
  - USD/KRW.
- The home does not pick the top risk category:
  - 과열
  - 이벤트
  - 파생 쏠림
  - 김프
  - 환율

## Current Score, Direction, And Risk Logic

### Representative coin direction

- Input: 24h `changePercent`.
- Current thresholds:
  - `>= 2.5%`: upward bias.
  - `<= -2.5%`: downside pressure.
  - otherwise: watch.
- Limitation:
  - Direction is short-term price-change based only.
  - It does not use BTC trend, market leadership, funding, or macro state.

### Representative coin score

- Input:
  - representative coin 24h `changePercent`.
  - BTC technical fear/greed score.
- Formula shape:
  - base 50.
  - coin change multiplied.
  - market score adds a small bias.
  - clamped between low and high bounds.
- Limitation:
  - The score is readable but not yet a readiness score.
  - It can rise from price momentum even when macro or derivatives risk should suggest waiting.

### Representative coin risk

- Input: 24h `changePercent`.
- Current mapping:
  - strong rise: chase risk.
  - strong fall: volatility expansion.
  - moderate rise: alert confirmation.
  - moderate fall: support reaction check.
  - flat: direction confirmation wait.
- Limitation:
  - Good as a quick sentence, but not enough for a single "biggest risk" field.

### BTC market tone

- Input: BTC technical fear/greed score.
- Current mapping:
  - high score: tracking possible.
  - low score: risk priority.
  - middle score: watch priority.
- Limitation:
  - Too narrow for the home-level market decision.

## Data Candidates For The Next Decision Model

### Already available in `/coin`

- BTC/ETH/XRP prices.
- BTC/ETH/XRP 24h change.
- Broader market-board symbols and `quoteVolume`.
- BTC 1h candle-based technical report.
- BTC fear/greed score from the current technical report.
- BTC RSI.
- BTC stochastic.
- BTC trend label.
- BTC dominance.
- Kimchi premium.
- USD/KRW.
- BTC long/short ratio.
- BTC/ETH/XRP funding rates.
- Current compact macro event from `MacroTicker`.

### Possible derived values without a new API

- Home readiness score.
- Top-level decision state:
  - 관망
  - 조건 대기
  - 추적 가능
  - 리스크 확대
- BTC-led vs mixed rough label using BTC trend and BTC dominance.
- Alt participation rough label using existing market board:
  - number of alt symbols with positive 24h change.
  - number of alt symbols above a change threshold.
  - high quote-volume movers.
- Top risk priority:
  - overheated move.
  - derivatives crowding.
  - macro event.
  - kimchi premium.
  - FX pressure.

### Data likely needed later

- ETH/BTC relative strength.
- Alt riser ratio across a broader universe.
- Upbit/Bithumb spot breadth.
- Spot/futures mode preference.
- User-selected representative coin list.
- Optional account sync for representative coins after localStorage proves useful.

## Next Work Candidate

Next active-run task should be `홈 decision model 설계`.

Recommended focus:

1. Define the top state: 관망 / 조건 대기 / 추적 가능 / 리스크 확대.
2. Define readiness score inputs and weights.
3. Define market leadership label: BTC 우세 / 알트 순환 / 혼조 / 위험 회피.
4. Define top risk priority.
5. Keep all output phrasing as decision support, not trade instruction.
