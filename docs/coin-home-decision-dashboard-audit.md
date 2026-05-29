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

## Representative Coin Personalization

The current home uses fixed representative coins: BTC, ETH, and XRP. This is useful as a default because it gives every user a working home screen immediately, but it does not yet answer the more personal question: "내가 보는 코인은 지금 추적할 만한가?"

### Limits Of The Current Fixed Structure

- BTC/ETH/XRP are hardcoded as `representativeSymbols`.
- Funding requests are also fixed to BTC/ETH/XRP.
- The home cannot reflect a user's preferred coin such as SOL, DOGE, or BNB.
- The home cannot distinguish whether the user is watching a spot setup or futures setup.
- The current representative score may highlight a coin the user does not actually care about.
- The same three coins appear for Basic and Pro users, so personalization is not yet a monetization lever.

### "My Representative Coins" Structure

The home should evolve from "default representative coins" to "my representative coins".

Recommended structure:

1. Default list
   - BTC
   - ETH
   - XRP

2. User-selected list
   - Basic: fixed default list at first.
   - Pro: user can select and reorder representative coins.
   - Future: account sync can restore the list across devices.

3. Display rule
   - Always show at least one representative coin.
   - If stored values are invalid, fall back to BTC/ETH/XRP.
   - If a selected coin cannot load, show an unavailable state and keep the rest of the list usable.

### Default Representative Coin Candidates

Initial default:

- BTC
- ETH
- XRP

Reasoning:

- BTC is the market backbone.
- ETH gives broad risk-on/risk-off context beyond BTC.
- XRP is a common domestic interest coin for Korean users and already exists in the current home funding requests.

### User Selection Candidates

First selectable candidates:

- BTC
- ETH
- XRP
- SOL
- DOGE
- BNB

Later:

- user-entered symbol.
- exchange-specific KRW spot symbols.
- frequently watched symbols from saved alerts or journal entries.

Validation principles for user-entered symbols:

- normalize to uppercase.
- strip `/`, `.P`, and whitespace.
- allow only known supported symbols in the first implementation.
- if unsupported, do not save and show a plain "지원 예정" style message.
- never treat a user-entered symbol as a trading recommendation.

### Spot And Futures Mode

The representative coin can have a mode:

1. Spot mode
   - Purpose: domestic KRW spot watch context.
   - Copy direction:
     - "현물 관심 후보"
     - "거래대금 확인"
     - "추격 리스크"
     - "눌림 대기"
   - Avoid:
     - "매수 후보"
     - "진입 기회"

2. Futures mode
   - Purpose: BTC/ETH/alt futures structure and derivatives risk context.
   - Copy direction:
     - "선물 추적 조건"
     - "레버리지 주의"
     - "펀딩비 쏠림"
     - "청산 압력 확인"
   - Avoid:
     - "롱 진입"
     - "숏 진입"

MVP recommendation:

- Keep the first implementation mode-light.
- Store a `mode` value but do not overbuild separate data models yet.
- Use current Binance-based data for futures-style context.
- Add KRW spot-specific data only in a later spot radar implementation.

### Storage Model

Phase 1: localStorage

- Store representative coin preferences locally.
- No Supabase or account sync in the first implementation.
- Suggested conceptual key:
  - `chart-radar:coin-home:representative-coins`
- Suggested value shape:
  - version number.
  - selected symbols.
  - mode per symbol or global mode.
  - updated timestamp.

Fallback policy:

- Missing value: use BTC/ETH/XRP.
- Malformed JSON: ignore and use BTC/ETH/XRP.
- Empty list: use BTC/ETH/XRP.
- Unsupported symbol: drop the invalid symbol.
- All symbols invalid: use BTC/ETH/XRP.
- Duplicate symbols: keep first occurrence only.

Phase 2: account sync

- Sync only after the local model proves useful.
- Treat this as a separate high-risk-adjacent design because it touches auth/session and persistence.
- Do not mix Supabase sync with the first UI implementation.

### Basic And Pro Split

Basic:

- Shows the default BTC/ETH/XRP representative list.
- May allow temporary view changes later, but should not weaken Pro value.
- Shows top-level summary, readiness, and one risk/confirmation condition.

Pro:

- Allows direct representative coin selection.
- Allows expanded saved count.
- Allows reordering.
- Can connect representative coins to alert conditions.
- Can show detailed rationale, invalidation, and risk breakdown for selected coins.

Suggested Pro boundaries:

- Basic: 3 default coins.
- Pro: custom representative list and more saved slots.
- Pro: alert condition suggestions tied to the selected coins.
- Pro: deeper derivatives/funding explanation.

### Copy Principles

Use:

- "내 대표 코인"
- "관심 코인"
- "추적 조건"
- "확인 조건"
- "리스크"
- "관망"
- "눌림 대기"
- "거래대금 확인"

Avoid:

- "추천 코인"
- "매수 후보"
- "진입 기회"
- "롱 추천"
- "숏 추천"
- "수익 가능"

Example copy:

- "내 대표 코인은 추적 조건을 확인하는 용도입니다."
- "조건이 맞지 않으면 관망으로 표시합니다."
- "현물 모드는 거래대금과 과열 여부를 먼저 봅니다."
- "선물 모드는 펀딩비와 청산 압력을 함께 봅니다."

### First Implementation Candidate

Recommended first implementation:

1. Add localStorage-based representative coin preference.
2. Keep BTC/ETH/XRP as the default fallback.
3. Add a small representative coin selector UI.
4. Limit first selectable symbols to BTC, ETH, XRP, SOL, DOGE, BNB.
5. Do not add account sync.
6. Do not add Supabase writes.
7. Do not add new route.
8. Do not change billing logic.

Why this should be first:

- It directly improves the home purpose.
- It is reversible.
- It can be implemented without production DB migration.
- It avoids auth/session and Supabase risk.
- It can later connect naturally to alerts, journal, and Pro gating.

## BTC Versus Alt Market Leadership Model

The home screen should answer whether the current coin market is BTC-led, alt-rotation-led, mixed, or risk-off. This label is market context only. It must not imply that the user should buy BTC, chase alts, or enter a futures position.

### Market Leadership States

1. `BTC 우세`
   - Meaning: BTC is leading the market while alt participation is weak or selective.
   - Typical environment:
     - BTC trend is constructive.
     - BTC 24h change is stronger than most tracked alts.
     - BTC dominance is high or rising.
     - alt riser ratio is low-to-moderate.
   - Home copy:
     - "BTC 주도 흐름입니다."
     - "알트 참여는 아직 제한적입니다."
   - Avoid:
     - "비트 매수"
     - "BTC 진입"

2. `알트 순환`
   - Meaning: BTC is not breaking down, and alt participation is spreading through volume and price movement.
   - Typical environment:
     - BTC trend is stable or constructive.
     - several major alts show positive change.
     - alt quote volume is concentrated in movers.
     - BTC dominance is not aggressively rising.
   - Home copy:
     - "알트 참여 확산이 확인됩니다."
     - "거래대금 동반 여부를 함께 봅니다."
   - Avoid:
     - "알트 추격"
     - "알트 매수 후보"

3. `혼조`
   - Meaning: BTC and alt signals do not agree, or only a small number of coins are moving.
   - Typical environment:
     - BTC trend is flat or conflicting.
     - alt participation is narrow.
     - one or two coins move without broad market support.
     - risk metrics are not severe enough for risk-off.
   - Home copy:
     - "주도 흐름이 뚜렷하지 않습니다."
     - "개별 움직임과 시장 전체 흐름을 분리해서 봅니다."

4. `위험 회피`
   - Meaning: BTC weakness and alt weakness appear together, or volatility risk dominates the screen.
   - Typical environment:
     - BTC trend weakens or breaks.
     - broad alt participation is negative.
     - funding/long-short crowding is elevated.
     - macro event risk or volatility expansion is dominant.
   - Home copy:
     - "위험 회피 흐름이 우선입니다."
     - "대표 코인보다 BTC 추세와 리스크를 먼저 확인합니다."

### MVP Criteria Available Now

The first model can be implemented without a new API by deriving rough labels from current home data.

1. BTC 1h trend
   - Source: `/api/crypto-candles` and `analyzeTechnicalRadar`.
   - Use:
     - constructive trend supports `BTC 우세` or `알트 순환`.
     - weak or broken trend supports `위험 회피`.
     - unclear trend supports `혼조`.

2. BTC `changePercent`
   - Source: `/api/market-board`.
   - Use:
     - positive BTC with weak alts suggests `BTC 우세`.
     - negative BTC with weak alts suggests `위험 회피`.
     - flat BTC with active alts can support `알트 순환` if risk is contained.

3. ETH, XRP, and tracked alt `changePercent`
   - Source: `/api/market-board`.
   - Use:
     - count positive alt symbols.
     - count alts above a rough threshold such as `+2.5%`.
     - compare BTC change with ETH/XRP/SOL/DOGE/BNB and other tracked alts.

4. Rough rising ratio inside market-board
   - Source: existing market-board symbols.
   - Use:
     - `positiveAltCount / trackedAltCount`.
     - rough participation buckets:
       - low: fewer than one-third positive.
       - mixed: one-third to two-thirds positive.
       - broad: more than two-thirds positive.
   - Note:
     - This is not full market breadth. It is an MVP proxy.

5. Quote volume candidates
   - Source: `quoteVolume` from `/api/market-board`.
   - Use:
     - identify whether positive alts also have meaningful volume.
     - avoid labeling `알트 순환` when only low-volume alts are moving.

6. BTC dominance
   - Source: `/api/coin-market-metrics`.
   - Use:
     - high or rising dominance supports BTC-led interpretation.
     - dominance level alone should not decide the label.
   - Limitation:
     - current API gives point-in-time dominance, not dominance change rate.

7. Fear/greed
   - Source: current BTC technical report.
   - Use:
     - extreme greed increases overheat risk.
     - low fear/greed with weak trend supports caution.
   - Limitation:
     - this is a risk context input, not a leadership input by itself.

8. Funding and long-short crowding
   - Source: `/api/liquidation-pressure`.
   - Use:
     - extreme crowding can force `위험 회피` or reduce confidence in `알트 순환`.
     - should be shown as risk context rather than direction.

### Suggested MVP Label Logic

This is a design-level outline, not implementation code.

1. Force `위험 회피` when:
   - BTC trend is weak or broken.
   - and alt participation is weak.
   - or derivatives/macro risk is severe.

2. Prefer `BTC 우세` when:
   - BTC trend is constructive.
   - BTC 24h change is positive.
   - alt participation is low or narrow.
   - BTC dominance context is not alt-friendly.

3. Prefer `알트 순환` when:
   - BTC trend is stable or constructive.
   - alt participation is broad enough.
   - several alts show positive change with quote volume.
   - derivatives and macro risk are not dominant.

4. Use `혼조` when:
   - BTC trend and alt participation conflict.
   - only a few names are moving.
   - data is incomplete.
   - no clear force rule applies.

### Later Data Needs

The MVP should stay honest about its limits. More accurate leadership detection will need:

- ETH/BTC relative strength.
- top 30-50 alt riser ratio.
- alt quote-volume growth rate, not only absolute quote volume.
- Upbit/Bithumb KRW spot breadth.
- BTC dominance change rate.
- sector/theme strength for alts.
- separate spot and futures breadth.

### Home UI Integration

The top home block should show market leadership as a compact label:

- `주도: BTC 우세`
- `주도: 알트 순환`
- `주도: 혼조`
- `주도: 위험 회피`

Suggested placement:

- next to the readiness state, or directly under it as a secondary label.
- keep it above detailed BTC market strength rows.
- show one Basic reason below the label.

Basic copy examples:

- `BTC 우세`: "BTC가 시장을 이끄는 흐름입니다. 알트 참여는 제한적입니다."
- `알트 순환`: "BTC가 무너지지 않는 가운데 알트 참여가 확산됩니다."
- `혼조`: "BTC와 알트 흐름이 엇갈립니다. 확인 조건을 먼저 봅니다."
- `위험 회피`: "BTC 약세와 변동성 리스크가 먼저 보입니다."

Do not use:

- "BTC 매수"
- "알트 추격"
- "지금 알트장 진입"
- "비트 롱"
- "알트 추천"

### Basic And Pro Split

Basic:

- market leadership label.
- one core reason.
- no detailed breadth table.
- no alert automation details.

Pro:

- BTC trend, dominance, alt participation, and quote-volume evidence.
- alt participation details.
- breadth and volume breakdown.
- leadership invalidation condition.
- alert condition suggestions.

Pro value should not be weakened by exposing full breadth evidence and invalidation logic in Basic.

### First Implementation Candidate

Recommended first implementation:

1. Create a small helper from existing home data.
2. Use `/api/market-board` and current market metrics only.
3. Generate a rough leadership label and one reason.
4. Display it in the top home conclusion block.
5. Do not add a new API.
6. Do not add Upbit/Bithumb breadth yet.
7. Keep ETH/BTC relative strength as a later enhancement.

## First Implementation Selection

The first implementation should be a small PR, not a full `/coin` home redesign. It should create immediate user value, use current data, avoid high-risk systems, and be easy to screenshot-review and revert.

### Candidate Comparison

| Candidate | Benefit | Risk | Scope | Validation |
| --- | --- | --- | --- | --- |
| 1. Improve top `오늘의 결론` block | Highest immediate value. Directly answers whether the user should watch, wait, or treat risk first. | MEDIUM. Copy and visual hierarchy must avoid trade instruction. | `CoinRadarHomePanel` top summary and small helper. | tsc, build, smoke:mobile, smoke:all, `/coin` 360px and desktop screenshots. |
| 2. Add readiness score/state helper | Strong foundation for decision dashboard. Reusable in later Pro explanations. | MEDIUM. If over-weighted, can look like a buy/sell score. | Pure helper using current data. | unit-style logic review through TypeScript, screenshot label review. |
| 3. Add `시장 주도` label | Clear answer to BTC장 vs 알트장. Uses existing market-board data. | LOW-MEDIUM. Rough label may be imperfect without ETH/BTC and broader breadth. | Small derived label and one reason. | `/coin` screenshots and data fallback review. |
| 4. Compress representative coin cards | Improves readability and mobile density. | LOW. Visual-only if logic is untouched. | UI layout only. | screenshots at 360px and desktop. |
| 5. localStorage representative coin selector | Strong personalization value. | MEDIUM-HIGH. Adds state persistence and UI complexity; Pro gating must be handled carefully. | selector UI, localStorage parser, fallback behavior. | tsc, build, smoke, persistence manual check. |
| 6. Compress BTC market strength | Makes home faster to scan. | LOW. Risk of hiding useful context if over-compressed. | UI layout and summary rows. | screenshots and content review. |
| 7. Full `/coin` home rearrangement | Could solve the whole screen direction at once. | HIGH. Too broad for first PR and harder to review/revert. | Multiple sections and visual hierarchy. | broad screenshot and interaction review. |

### Selected First Implementation

Selected priority:

- `오늘의 결론 + 준비도 + 시장 주도 라벨`

This combines candidates 1, 2, and 3 in a narrow way:

1. Add a top conclusion block.
2. Add a readiness state/score helper using current data.
3. Add a rough market leadership label using current data.
4. Keep representative coin personalization for a later run.
5. Do not add a new API.

### Selection Reason

- It answers the most important first-screen question immediately.
- It can be built from existing `/coin` data.
- It does not require route changes.
- It does not require Supabase, auth, billing, Android, FCM, or production migration.
- It is easy to review in screenshots.
- It is easy to revert if the tone or visual result is not right.
- It improves the home purpose before adding personalization complexity.

### Proposed PR Branch

- `codex/coin-home-decision-summary`

### Proposed Files For The First PR

Expected app files:

- `src/components/coin/CoinRadarHomePanel.tsx`

Possible helper file if needed:

- `src/components/coin/coinHomeDecisionModel.ts`

Expected docs:

- `docs/coin-home-decision-dashboard-audit.md`
- `docs/automation-runs/active-run.md` or a new implementation active-run.

### Forbidden Scope For The First PR

- No route changes.
- No new API.
- No Supabase.
- No auth/session changes.
- No billing, RevenueCat, planId, productId, entitlement changes.
- No Android, Capacitor, AAB, Play Console changes.
- No FCM or push-cron changes.
- No production migration.
- No representative coin localStorage selector in the first PR.
- No account sync.
- No Upbit/Bithumb breadth.
- No ETH/BTC data fetch.
- No Basic/Pro gating weakening.
- No buy/sell/long/short instruction wording.

### Screenshot Review Targets

- `/coin` at 360px mobile.
- `/coin` at desktop width.
- Optional `/crypto` and `/global` quick check to ensure common shell is unaffected.

Screenshot criteria:

- top conclusion is visible without feeling like another heavy card.
- no investment instruction wording appears.
- readiness score is clearly environment readiness, not buy/sell score.
- market leadership label is compact and understandable.
- representative coin section remains readable below the top conclusion.
- no horizontal overflow.

### Verification For The First PR

- `git diff --check`
- `cmd /c npx tsc --noEmit`
- `npm.cmd run build`
- `npm.cmd run smoke:mobile`
- `npm.cmd run smoke:all`
- `/coin` 360px screenshot
- `/coin` desktop screenshot

### Draft PR Instruction

Use this as the next implementation prompt:

```text
PR MODE - implement coin home decision summary

Branch: codex/coin-home-decision-summary

Goal:
Implement the first Coin Home decision dashboard step on `/coin`.
Add a top conclusion area that shows:
- decision state: 관망 / 조건 대기 / 추적 가능 / 리스크 확대
- readiness score as "매매 환경 준비도"
- direction: 상방 우세 / 하방 압력 / 관망 / 변동성 주의
- market leadership: BTC 우세 / 알트 순환 / 혼조 / 위험 회피
- one top risk and one next confirmation condition

Constraints:
- Use only current `/coin` data.
- No new API.
- No route changes.
- No Supabase/auth/billing/Android/FCM changes.
- Do not implement representative coin selector yet.
- Do not weaken Basic/Pro gating.
- Avoid buy/sell/long/short instruction wording.

Expected files:
- src/components/coin/CoinRadarHomePanel.tsx
- optional src/components/coin/coinHomeDecisionModel.ts
- docs/coin-home-decision-dashboard-audit.md
- docs/automation-runs/active-run.md or a new implementation active-run

Validation:
- git diff --check
- cmd /c npx tsc --noEmit
- npm.cmd run build
- npm.cmd run smoke:mobile
- npm.cmd run smoke:all
- /coin 360px screenshot
- /coin desktop screenshot

Do not merge to main without screenshot review.
```

## Next Work Candidate

This design run is complete. The next step should be a separate implementation active-run or PR using `codex/coin-home-decision-summary`.

Recommended focus:

1. Create an implementation active-run for the selected first PR.
2. Keep the implementation branch-based.
3. Require screenshots before merge.
4. Keep representative coin personalization as a later run.
