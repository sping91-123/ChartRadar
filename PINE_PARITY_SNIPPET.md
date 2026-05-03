# Pine-Web Parity Check Guide

Use this when the TradingView Pine indicator and the `/survival` web chart show different MSB, CHoCH, OB, FVG, OTE, Sweep, or CISD values.

## Where To Paste Values

Open the web app:

1. Go to `/survival`.
2. Open `상세 판독`.
3. Open `고급 판독 기준`.
4. Open `Pine 대조 디버그`.
5. Paste a Pine snapshot into `Pine 스냅샷 일치율`.

Tip: click `웹값 예시 채우기` first. It fills the input with the exact JSON shape the web app can compare.

## Accepted JSON Shape

```json
{
  "symbol": "BTCUSDT.P",
  "timeframe": "15m",
  "market": 1,
  "chochDir": -1,
  "msb": "bullish",
  "choch": "bearish",
  "ema200Side": "above",
  "premiumDiscount": "discount",
  "oteZone": "long",
  "h0": 104500,
  "h1": 105100,
  "l0": 103800,
  "l1": 102900,
  "hiCount": 12,
  "loCount": 12,
  "latestOb": {
    "direction": "bullish",
    "top": 104200,
    "bottom": 103900
  },
  "latestFvg": {
    "direction": "bearish",
    "state": "fvg",
    "top": 104800,
    "bottom": 104300
  },
  "latestSweep": {
    "direction": "bullish",
    "level": 103700,
    "age": 4
  },
  "latestCisd": {
    "direction": "bearish",
    "level": 104650,
    "age": 2
  }
}
```

## Accepted Key-Value Shape

You can also paste simple `key=value` lines. Nested values use dot notation.

```text
symbol=BINANCE:BTCUSDTPERP
market=1
chochDir=-1
h0=104500
h1=105100
l0=103800
l1=102900
hiCount=12
loCount=12
ema200Side=above
premiumDiscount=discount
oteZone=long
latestOb.direction=bullish
latestOb.top=104200
latestOb.bottom=103900
latestFvg.direction=bearish
latestFvg.state=fvg
latestFvg.top=104800
latestFvg.bottom=104300
latestSweep.direction=bullish
latestCisd.direction=bearish
```

The parser preserves `:` inside values, so `symbol=BINANCE:BTCUSDTPERP` is safe. It also converts `true`, `false`, `null`, and `na` into real boolean/null values.

## Existing App State JSON Also Works

`pine/Coters_v2.42.pine` already has `App State Export > App State JSON Alert`.

That JSON has multi-timeframe `msb` and `choch` objects. The web panel now reads those objects and compares the value for the currently selected web timeframe.

```json
{
  "symbol": "BINANCE:BTCUSDTPERP",
  "chartTf": "15",
  "mode": "confirmed",
  "bias": "long",
  "msb": {
    "1m": "bullish",
    "5m": "bearish",
    "15m": "bullish",
    "1h": "bullish",
    "4h": "bearish",
    "1d": "bullish"
  },
  "choch": {
    "1m": "bullish",
    "5m": "bearish",
    "15m": "bearish",
    "1h": "bullish",
    "4h": "bearish",
    "1d": "bullish"
  },
  "oteZone": "long",
  "ema200Side": "above",
  "fvgDir": "bullish",
  "fvgIsIfvg": false,
  "fvgTop": 104800,
  "fvgBottom": 104300,
  "cisd": "none"
}
```

For full parity, add the swing and zone fields from the debug snippet too: `market`, `chochDir`, `h0`, `h1`, `l0`, `l1`, `hiCount`, `loCount`, `latestOb.*`, `latestSweep.*`, and `latestCisd.*`.

## Pine Debug Snippet

Add this near the end of the Pine script after `market`, `choch_dir`, `h0`, `h1`, `l0`, `l1`, `hiPts`, and `loPts` are calculated.

This basic snippet covers structure and swing parity first. Add OB/FVG/Sweep/CISD fields later from the indicator's latest active boxes/events.

```pinescript
showParitySnapshot = input.bool(false, "Show Web Parity Snapshot", group="Debug")

if showParitySnapshot and barstate.islast
    string paritySnapshot =
      "{" +
      "\"market\":" + str.tostring(market) + "," +
      "\"chochDir\":" + str.tostring(choch_dir) + "," +
      "\"h0\":" + str.tostring(h0) + "," +
      "\"h1\":" + str.tostring(h1) + "," +
      "\"l0\":" + str.tostring(l0) + "," +
      "\"l1\":" + str.tostring(l1) + "," +
      "\"hiCount\":" + str.tostring(array.size(hiPts)) + "," +
      "\"loCount\":" + str.tostring(array.size(loPts)) +
      "}"
    label.new(
      bar_index,
      high,
      paritySnapshot,
      xloc.bar_index,
      yloc.price,
      color=color.new(color.black, 0),
      style=label.style_label_down,
      textcolor=color.white,
      size=size.tiny
    )
```

## What The Score Means

The web parity panel uses weighted scoring.

- Core: MSB direction and CHoCH direction. Weight 3 each.
- Major: swing points, EMA200 side, PD zone, OTE zone, OB/FVG direction. Weight 2 each.
- Minor: OB/FVG prices and states, Sweep/CISD direction, hiPts/loPts count. Weight 1 each.

Price values match when the difference is within 0.05%.

## Usual Causes Of Mismatch

- Different symbol: compare the same Binance perpetual symbol, e.g. `BTCUSDT.P`.
- Different timeframe: compare the exact same 5m, 15m, 1h, 4h, or 1d chart.
- Current bar handling: Pine may be showing an in-progress bar while the web panel is using confirmed data.
- ZigZag settings: `zigLen`, close-based break, and wick-based swing storage must match.
- OB/FVG lifecycle: origin candle selection, mitigation, deletion, and iFVG conversion rules must match.
- OTE/PD basis: the current web implementation uses the 4H range logic from the port; compare it with the Pine basis before judging entries.
