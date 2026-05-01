# Coters v2.42 Safety Patch

이 문서는 채팅에 공유된 `Coters [v2.41]` Pine Script를 v2.42로 올릴 때 바로 적용할 핵심 패치입니다.

목표:

- OB/BB 거래량 필터 시점 불일치 수정
- MTF `request.security`의 `lookahead_off` 명시
- HTF 미확정값 사용 여부를 옵션화할 준비
- `na`를 자동 숏으로 취급하던 Bias 점수 문제 수정
- CISD가 MSB와 동시에 뜨는 문제 완화
- Weekly Open 라벨 누적 방지
- POC/Value Area 계산의 0 나눗셈 방지
- 실시간 봉에서 CHoCH/CISD 신호를 확정봉 기준으로 제한할 수 있게 함

## 1. Indicator Version

찾기:

```pine
indicator("Coters [v2.41] ", overlay=true, max_lines_count=500, max_bars_back=2000, max_boxes_count=500, max_labels_count=500)
```

교체:

```pine
indicator("Coters [v2.42] ", overlay=true, max_lines_count=500, max_bars_back=2000, max_boxes_count=500, max_labels_count=500)
```

## 2. Add Confirmation Inputs

`groupC = "Bias / Killzone"` 블록 이후 또는 Alert 입력 전 아무 입력 섹션에 추가:

```pine
groupConfirm = "Signal Confirmation"
useConfirmedHTF = input.bool(true, "Use Confirmed HTF Values", group=groupConfirm, tooltip="켜면 MTF MSB/CHoCH/FVG/EMA/OTE 판단에 닫힌 상위 시간대 봉 기준 값을 사용합니다. 앱/AI 판단용 기본값으로 권장합니다.")
confirmRealtimeSignals = input.bool(true, "Confirm CHoCH/CISD On Bar Close", group=groupConfirm, tooltip="켜면 현재 진행 중인 봉의 wick 변화로 생긴 CHoCH/CISD 라벨과 알림을 봉 마감 전까지 보류합니다.")
useCloseForMSB = input.bool(true, "Use Close For MSB Break", group=groupConfirm, tooltip="켜면 MSB는 종가 돌파로만 인정합니다. 끄면 wick 돌파도 MSB로 인정합니다.")
```

## 3. Add Confirm Helper Functions

`Signal Confirmation` input 블록 바로 아래에 추가:

```pine
f_confirm_int(int value) =>
    useConfirmedHTF ? value[1] : value

f_confirm_float(float value) =>
    useConfirmedHTF ? value[1] : value

f_confirm_bool(bool value) =>
    useConfirmedHTF ? value[1] : value

f_dir_score(int dir, float weight) =>
    na(dir) ? 0.0 : dir == 1 ? weight : dir == -1 ? -weight : 0.0
```

주의: 이 함수들은 반드시 `useConfirmedHTF` 입력 뒤에 위치해야 합니다.

## 4. POC / Value Area 0-Divide Guard

찾기:

```pine
float interval = (highest_p - lowest_p) / (num_bars - 1)
```

교체:

```pine
float interval = math.max((highest_p - lowest_p) / math.max(num_bars - 1, 1), 1e-10)
```

## 5. MSB Break Mode Option

찾기:

```pine
bool msb_bull_break = market == -1 and not na(h0) and close > h0
bool msb_bear_break = market == 1  and not na(l0) and close < l0
```

교체:

```pine
float msbBullBreakSource = useCloseForMSB ? close : high
float msbBearBreakSource = useCloseForMSB ? close : low
bool msb_bull_break = market == -1 and not na(h0) and msbBullBreakSource > h0
bool msb_bear_break = market == 1  and not na(l0) and msbBearBreakSource < l0
```

## 6. `request.security` Lookahead And Confirmed HTF Values

각 `request.security()` 호출에 `lookahead=barmerge.lookahead_off`를 명시하세요.

예:

```pine
[sec1_msb, sec1_choch, poc0_val] = request.security(syminfo.tickerid, "1", _get1m(), lookahead=barmerge.lookahead_off)
```

그리고 `_get*()` 함수는 MTF 판단값에 `f_confirm_*()`를 적용합니다.

찾기:

```pine
_get1m() =>
    [p, h, l] = f_get_vp_data(tf0_lookback, vp_num_bars)
    [market, choch_dir, p]
```

교체:

```pine
_get1m() =>
    [p, h, l] = f_get_vp_data(tf0_lookback, vp_num_bars)
    [f_confirm_int(market), f_confirm_int(choch_dir), p]
```

찾기:

```pine
_get5m() => [market, choch_dir]
```

교체:

```pine
_get5m() => [f_confirm_int(market), f_confirm_int(choch_dir)]
```

찾기:

```pine
_get15m() =>
    [b, be, mx, mn, ts] = f_detect_optimized(thresholdPer, auto)
    [p, h, l] = f_get_vp_data(tf1_lookback, vp_num_bars)
    [market, choch_dir, p, h, l, b, be, mx, mn, ts]
```

교체:

```pine
_get15m() =>
    [b, be, mx, mn, ts] = f_detect_optimized(thresholdPer, auto)
    [p, h, l] = f_get_vp_data(tf1_lookback, vp_num_bars)
    [f_confirm_int(market), f_confirm_int(choch_dir), p, h, l, f_confirm_bool(b), f_confirm_bool(be), f_confirm_float(mx), f_confirm_float(mn), f_confirm_int(ts)]
```

찾기:

```pine
_get1h() =>
    [b, be, mx, mn, ts] = f_detect_optimized(thresholdPer, auto)
    [p, h, l] = f_get_vp_data(tf2_lookback, vp_num_bars)
    [market, choch_dir, p, h, l, b, be, mx, mn, ts]
```

교체:

```pine
_get1h() =>
    [b, be, mx, mn, ts] = f_detect_optimized(thresholdPer, auto)
    [p, h, l] = f_get_vp_data(tf2_lookback, vp_num_bars)
    [f_confirm_int(market), f_confirm_int(choch_dir), p, h, l, f_confirm_bool(b), f_confirm_bool(be), f_confirm_float(mx), f_confirm_float(mn), f_confirm_int(ts)]
```

찾기:

```pine
_get4h() =>
    [b, be, mx, mn, ts] = f_detect_optimized(thresholdPer, auto)
    ema_v    = ta.ema(close, emaLen)
    h4_hi_v  = ta.highest(high, oteRange)
    h4_lo_v  = ta.lowest(low, oteRange)
    [p, h, l] = f_get_vp_data(tf3_lookback, vp_num_bars)
    [market, choch_dir, p, h, l, b, be, mx, mn, ts, ema_v, h4_hi_v, h4_lo_v]
```

교체:

```pine
_get4h() =>
    [b, be, mx, mn, ts] = f_detect_optimized(thresholdPer, auto)
    ema_v    = ta.ema(close, emaLen)
    h4_hi_v  = ta.highest(high, oteRange)
    h4_lo_v  = ta.lowest(low, oteRange)
    [p, h, l] = f_get_vp_data(tf3_lookback, vp_num_bars)
    [f_confirm_int(market), f_confirm_int(choch_dir), p, h, l, f_confirm_bool(b), f_confirm_bool(be), f_confirm_float(mx), f_confirm_float(mn), f_confirm_int(ts), f_confirm_float(ema_v), f_confirm_float(h4_hi_v), f_confirm_float(h4_lo_v)]
```

찾기:

```pine
_get1d() =>
    [b, be, mx, mn, ts] = f_detect_optimized(thresholdPer, auto)
    [market, choch_dir, b, be, mx, mn, ts, open]
```

교체:

```pine
_get1d() =>
    [b, be, mx, mn, ts] = f_detect_optimized(thresholdPer, auto)
    [f_confirm_int(market), f_confirm_int(choch_dir), f_confirm_bool(b), f_confirm_bool(be), f_confirm_float(mx), f_confirm_float(mn), f_confirm_int(ts), open]
```

그리고 모든 security 호출은 아래처럼 바꿉니다.

```pine
[sec1_msb, sec1_choch, poc0_val] = request.security(syminfo.tickerid, "1", _get1m(), lookahead=barmerge.lookahead_off)
[sec5_msb, sec5_choch] = request.security(syminfo.tickerid, "5", _get5m(), lookahead=barmerge.lookahead_off)
[sec15_msb, sec15_choch, poc1_val, vah1_val, val1_val, fvg15_b, fvg15_be, fvg15_n_max, fvg15_n_min, fvg15_n_t] = request.security(syminfo.tickerid, "15", _get15m(), lookahead=barmerge.lookahead_off)
[sec60_msb, sec60_choch, poc2_val, vah2_val, val2_val, fvg1h_b, fvg1h_be, fvg1h_n_max, fvg1h_n_min, fvg1h_n_t] = request.security(syminfo.tickerid, "60", _get1h(), lookahead=barmerge.lookahead_off)
[sec240_msb, sec240_choch, poc3_val, vah3_val, val3_val, fvg4h_b, fvg4h_be, fvg4h_n_max, fvg4h_n_min, fvg4h_n_t, htfEMA, h4_high_20, h4_low_20] = request.security(syminfo.tickerid, "240", _get4h(), lookahead=barmerge.lookahead_off)
[secD_msb, secD_choch, fvg1d_b, fvg1d_be, fvg1d_n_max, fvg1d_n_min, fvg1d_n_t, dOpen] = request.security(syminfo.tickerid, "1D", _get1d(), lookahead=barmerge.lookahead_off)
wOpen = request.security(syminfo.tickerid, "W", open, lookahead=barmerge.lookahead_off)
```

## 7. Weekly Open Label Leak Fix

찾기:

```pine
var line wOpenLine = na
if showWeeklyOpen
    if barstate.islast
        if not na(wOpenLine)
            line.delete(wOpenLine)
        wOpenLine := line.new(bar_index, wOpen, bar_index + 50, wOpen, color=wOpenCol, width=1, style=line.style_dashed, extend=extend.left)
        label.new(bar_index + 52, wOpen, "W.Open", color=color.new(color.white,100), style=label.style_none, textcolor=wOpenCol, size=size.tiny)
```

교체:

```pine
var line wOpenLine = na
var label wOpenLabel = na
if showWeeklyOpen
    if barstate.islast
        if not na(wOpenLine)
            line.delete(wOpenLine)
        if not na(wOpenLabel)
            label.delete(wOpenLabel)
        wOpenLine := line.new(bar_index, wOpen, bar_index + 50, wOpen, color=wOpenCol, width=1, style=line.style_dashed, extend=extend.left)
        wOpenLabel := label.new(bar_index + 52, wOpen, "W.Open", color=color.new(color.white,100), style=label.style_none, textcolor=wOpenCol, size=size.tiny)
else
    if not na(wOpenLine)
        line.delete(wOpenLine)
        wOpenLine := na
    if not na(wOpenLabel)
        label.delete(wOpenLabel)
        wOpenLabel := na
```

## 8. Bias Score `na` Neutral Fix

찾기:

```pine
float structureScore = _htfMarket == 1 ? 2.0 : -2.0
```

교체:

```pine
float structureScore = f_dir_score(_htfMarket, 2.0)
```

찾기:

```pine
mtfAlignScore += sec15_msb == 1 ? 0.5 : -0.5
mtfAlignScore += sec60_msb == 1 ? 0.5 : -0.5
mtfAlignScore += secD_msb  == 1 ? 0.5 : -0.5
```

교체:

```pine
mtfAlignScore += f_dir_score(sec15_msb, 0.5)
mtfAlignScore += f_dir_score(sec60_msb, 0.5)
mtfAlignScore += f_dir_score(secD_msb, 0.5)
```

## 9. OB / BB Volume Filter Indexing Fix

찾기:

```pine
buObVolSpike    = buObSince > 0 and volume[buObSince] > _cachedSmaVol * volMult
```

교체:

```pine
buObVolSpike    = buObSince > 0 and not na(_cachedSmaVol[buObSince]) and volume[buObSince] > _cachedSmaVol[buObSince] * volMult
```

찾기:

```pine
beObVolSpike    = beObSince > 0 and volume[beObSince] > _cachedSmaVol * volMult
```

교체:

```pine
beObVolSpike    = beObSince > 0 and not na(_cachedSmaVol[beObSince]) and volume[beObSince] > _cachedSmaVol[beObSince] * volMult
```

찾기:

```pine
buBbVolSpike    = buBbSince > 0 and volume[buBbSince] > _cachedSmaVol * volMult
```

교체:

```pine
buBbVolSpike    = buBbSince > 0 and not na(_cachedSmaVol[buBbSince]) and volume[buBbSince] > _cachedSmaVol[buBbSince] * volMult
```

찾기:

```pine
beBbVolSpike    = beBbSince > 0 and volume[beBbSince] > _cachedSmaVol * volMult
```

교체:

```pine
beBbVolSpike    = beBbSince > 0 and not na(_cachedSmaVol[beBbSince]) and volume[beBbSince] > _cachedSmaVol[beBbSince] * volMult
```

## 10. CHoCH / CISD Signal Confirmation

`chochOnly` 선언 바로 아래에 추가:

```pine
bool signalBarConfirmed = not confirmRealtimeSignals or barstate.isconfirmed
bool chochChangedForSignal = chochChanged and signalBarConfirmed
bool chochOnlyForSignal = chochOnly and signalBarConfirmed
```

찾기:

```pine
if chochOnly and showMSB
```

교체:

```pine
if chochOnlyForSignal and showMSB
```

찾기:

```pine
bool bull_cisd = chochChanged and choch_dir == 1 and in_bu_ob
bool bear_cisd = chochChanged and choch_dir == -1 and in_be_ob
```

교체:

```pine
bool bull_cisd = chochOnlyForSignal and choch_dir == 1 and in_bu_ob
bool bear_cisd = chochOnlyForSignal and choch_dir == -1 and in_be_ob
```

찾기:

```pine
bool _tfChanged = mChanged or mChanged1 or mChanged5 or mChanged15 or mChanged1h or mChanged4h or mChangedD or chochOnly or chochChanged1 or chochChanged5 or chochChanged15 or chochChanged1h or chochChanged4h or chochChangedD
```

교체:

```pine
bool _tfChanged = mChanged or mChanged1 or mChanged5 or mChanged15 or mChanged1h or mChanged4h or mChangedD or chochOnlyForSignal or chochChanged1 or chochChanged5 or chochChanged15 or chochChanged1h or chochChanged4h or chochChangedD
```

## 11. CHoCH Alert Confirmation

아래 CHoCH alert block에서 각 조건에 `signalBarConfirmed`를 추가하세요.

예:

```pine
if choch_alert_enabled and signalBarConfirmed
    if chochChanged1
        array.push(alert_messages, "1m CHoCH 변경! (MSB 미변경)\n" + tfText)
    if chochChanged5
        array.push(alert_messages, "5m CHoCH 변경! (MSB 미변경)\n" + tfText)
    if chochChanged15
        array.push(alert_messages, "15m CHoCH 변경! (MSB 미변경)\n" + tfText)
    if chochChanged1h
        array.push(alert_messages, "1h CHoCH 변경! (MSB 미변경)\n" + tfText)
    if chochChanged4h
        array.push(alert_messages, "4h CHoCH 변경! (MSB 미변경)\n" + tfText)
    if chochChangedD
        array.push(alert_messages, "1D CHoCH 변경! (MSB 미변경)\n" + tfText)
```

## 12. Recommended Follow-up For v2.43

v2.42에서는 안전 패치를 우선합니다. 다음은 백테스트/실차트 검증 후 적용 권장:

- 4H `structureScore` age decay
- OTE를 고정 20봉 range가 아니라 MSB impulse leg 기준으로 계산하는 옵션
- 1m/5m MTF alignment 가중치 옵션화
- FVG/OB/Sweep 상태값을 앱 연동용 JSON-like alert message로 별도 출력
- `barsSinceSweep`, `nearestOB`, `inFVG`, `inIFVG`, `pdZone`, `ema200Side` 상태 패널 추가
