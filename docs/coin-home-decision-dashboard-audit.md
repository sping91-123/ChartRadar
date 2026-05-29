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

## Home Decision Model

The Coin Radar home should not behave like a dense information dashboard. Its top section should answer the user's pre-trade context in about 10 seconds. The model below is a decision-support model, not a buy/sell signal.

### Top Decision State

Use one of four states at the top of the home screen:

1. `관망`
   - Meaning: market conditions are unclear or risk is not compensated by structure.
   - Typical causes:
     - BTC trend is flat or weakening.
     - readiness score is low-to-mid.
     - macro event risk is close.
     - derivatives crowding or FX/kimchi premium risk is elevated.
   - Recommended wording:
     - "지금은 관망 우위입니다."
     - "방향 확인 전까지 추적 조건만 정리합니다."

2. `조건 대기`
   - Meaning: structure is forming, but one or more confirmation conditions are missing.
   - Typical causes:
     - BTC trend is improving but not confirmed.
     - representative coin is moving but overheat risk exists.
     - market leadership is mixed.
   - Recommended wording:
     - "조건 대기 구간입니다."
     - "BTC 추세 유지와 거래대금 동반 여부를 확인합니다."

3. `추적 가능`
   - Meaning: market environment is organized enough to watch selected coins actively.
   - Typical causes:
     - BTC trend is constructive.
     - readiness score is high.
     - risk priority is not severe.
     - derivatives crowding is not extreme.
   - Recommended wording:
     - "추적 가능한 환경입니다."
     - "확인 조건이 유지되는지 관찰합니다."

4. `리스크 확대`
   - Meaning: there is a dominant risk that should be seen before coin-specific interpretation.
   - Typical causes:
     - BTC trend breaks down.
     - funding/long-short is crowded.
     - macro event is imminent.
     - kimchi premium or FX risk is elevated.
     - broad alt weakness is visible.
   - Recommended wording:
     - "리스크가 먼저 보이는 구간입니다."
     - "추격보다 변동성 확대 가능성을 먼저 확인합니다."

### Readiness Score

The readiness score is a 0-100 environment score. It is not a buy score, sell score, or expected profit score.

Recommended label:

- `매매 환경 준비도`

Recommended score bands:

- `0-29`: 리스크 우선
- `30-49`: 관망 우위
- `50-69`: 조건 대기
- `70-84`: 추적 가능
- `85-100`: 추적 가능 but 과열 점검 필수

MVP input groups:

1. BTC trend and structure
   - BTC trend label.
   - BTC RSI.
   - BTC stochastic.
   - BTC 1h technical summary.
   - Purpose: decide whether the market backbone is constructive.

2. Market risk
   - macro event proximity from `MacroTicker` / macro calendar.
   - BTC trend breakdown.
   - extreme BTC move.
   - Purpose: prevent the score from rising only because price already moved.

3. Derivatives crowding
   - BTC long/short ratio.
   - BTC/ETH/XRP funding rates.
   - Purpose: reduce readiness when positioning is too one-sided.

4. Market strength
   - BTC fear/greed score from the current technical report.
   - BTC dominance.
   - BTC 24h change.
   - Purpose: summarize whether the market has enough strength to monitor.

5. Alt participation
   - count of market-board alt symbols with positive 24h change.
   - count of alt symbols above a threshold such as `+2.5%`.
   - quote-volume concentration among movers.
   - Purpose: identify whether the move is BTC-only or broader.

MVP scoring approach:

- Start from a neutral base around 50.
- Add points for constructive BTC trend, healthy momentum, and broad participation.
- Subtract points for major risk priority, event proximity, derivatives crowding, excessive kimchi premium, and BTC trend deterioration.
- Cap the final label so a severe top risk can force `리스크 확대` even when raw score is high.

### Direction Model

Direction should describe market pressure, not command action.

Allowed states:

1. `상방 우세`
   - BTC trend is constructive.
   - BTC momentum is positive but not extremely overheated.
   - representative coin direction is aligned.

2. `하방 압력`
   - BTC trend is weakening or broken.
   - representative coin change is negative with risk expansion.
   - broad market participation is weak.

3. `관망`
   - BTC trend is mixed.
   - representative coin signal is unclear.
   - upcoming event or derivatives crowding makes confirmation necessary.

4. `변동성 주의`
   - event risk, liquidation pressure, funding crowding, or abnormal move dominates.
   - This state can override directional labels when risk is high.

Do not use direct trade wording such as:

- "매수"
- "매도"
- "롱 진입"
- "숏 진입"
- "지금 들어가도 됨"

### Market Leadership Model

Use one of four leadership labels:

1. `BTC 우세`
   - BTC trend is stronger than broad alt participation.
   - BTC dominance is rising or relatively high.
   - ETH/BTC or alt participation is not strong enough.

2. `알트 순환`
   - multiple alt symbols are positive.
   - high-volume alt movers are visible.
   - BTC is stable enough to support rotation.
   - later model can add Upbit/Bithumb spot breadth.

3. `혼조`
   - BTC and alt signals conflict.
   - BTC dominance, BTC trend, and alt participation do not agree.
   - representative coin movement may be individual rather than market-wide.

4. `위험 회피`
   - BTC trend is weak.
   - broad alt participation is weak.
   - risk priority is severe.
   - macro or derivatives risk is dominant.

MVP criteria available now:

- BTC trend from `analyzeTechnicalRadar`.
- BTC dominance from `/api/coin-market-metrics`.
- market-board alt symbol changes from `/api/market-board`.
- market-board quote volume from `/api/market-board`.

Later criteria:

- ETH/BTC relative strength.
- broader alt riser ratio.
- Upbit/Bithumb KRW spot breadth.
- top alt relative performance vs BTC.

### Risk Priority

The top home section should pick one primary risk first, then show secondary risks in Pro.

Risk priority candidates:

1. `과열`
   - representative coin move is too extended.
   - BTC RSI/stochastic is stretched.
   - readiness score is high but chasing risk is also high.

2. `이벤트 대기`
   - important macro event is near.
   - recently released event is still inside the interpretation window.
   - home should lean toward condition waiting.

3. `펀딩비/롱숏 쏠림`
   - funding rate is elevated.
   - BTC long/short ratio is one-sided.
   - liquidation pressure suggests crowded positioning.

4. `김프`
   - kimchi premium is elevated or abnormal.
   - domestic spot interpretation needs extra caution.

5. `환율`
   - USD/KRW movement creates local market distortion.
   - this is a context risk, not a coin direction signal.

6. `BTC 추세 이탈`
   - BTC trend weakens or breaks.
   - this should override representative coin optimism.

Priority order for MVP:

1. BTC trend breakdown.
2. imminent high-impact event.
3. derivatives crowding.
4. overheat.
5. kimchi premium / FX.

### Home Copy Principles

The first screen should sound like an analyst checklist, not a trading instruction.

Use:

- "준비도"
- "추적 조건"
- "관망 우위"
- "조건 대기"
- "리스크 우선"
- "확인 조건"
- "무효화 기준"

Avoid:

- "매수 추천"
- "매도 추천"
- "롱 진입"
- "숏 진입"
- "수익 가능"
- "기회"
- "지금 들어가도 됨"

Example home copy:

- "지금은 조건 대기 구간입니다."
- "BTC 추세 유지와 알트 참여도 개선을 확인합니다."
- "가장 큰 리스크는 이벤트 대기입니다."
- "대표 코인은 추적 가능하지만, 과열 구간에서는 확인 조건이 먼저입니다."

### Basic And Pro Split

Basic should keep the home fast and decisive:

- top decision state.
- readiness score band.
- representative coin summary.
- BTC market strength summary.
- one top risk.
- one next confirmation condition.

Pro should explain why:

- score component breakdown.
- invalidation criteria.
- BTC vs alt leadership details.
- derivatives crowding details.
- kimchi premium and FX context.
- macro event interpretation.
- alert condition suggestions.
- representative coin customization details.

Do not weaken Pro gating by moving detailed evidence, invalidation, and alert logic into Basic.

### MVP Versus Later Data

MVP can be built from current data:

- BTC technical report from `/api/crypto-candles`.
- BTC/ETH/XRP price and 24h change from `/api/market-board`.
- market-board alt participation and quote volume from `/api/market-board`.
- BTC dominance, kimchi premium, and USD/KRW from `/api/coin-market-metrics`.
- BTC long/short ratio and BTC/ETH/XRP funding rates from `/api/liquidation-pressure`.
- compact macro event state from the existing macro calendar flow.

Later data/API needs:

- ETH/BTC relative strength.
- broader alt universe breadth.
- Upbit/Bithumb KRW spot radar.
- user-selected representative coin persistence.
- spot/futures mode distinction.
- account sync for representative coin settings.
- richer macro risk scoring.

## Next Work Candidate

Next active-run task should be `대표 코인 개인화 설계`.

Recommended focus:

1. Define default representative coins: BTC, ETH, XRP.
2. Define how users choose "내 대표 코인".
3. Define localStorage-first persistence.
4. Define spot/futures mode distinction.
5. Keep account sync as a later step.
