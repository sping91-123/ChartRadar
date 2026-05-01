# Pine-Web 일치율 검증 스냅샷

웹앱의 `상세 판독 > 고급 판독 기준 > Pine 대조 디버그`에 아래 값들을 붙여넣으면 MSB, CHoCH, h0/h1/l0/l1, 피벗 수를 비교할 수 있습니다.

## TradingView에서 붙일 스냅샷 형식

아래처럼 한 줄 JSON으로 붙여넣으면 됩니다.

```json
{"market":1,"chochDir":1,"h0":104500,"h1":105100,"l0":103800,"l1":102900,"hiCount":12,"loCount":12}
```

또는 key=value 형식도 됩니다.

```text
market=1
chochDir=1
h0=104500
h1=105100
l0=103800
l1=102900
hiCount=12
loCount=12
```

## Pine 지표에 임시로 추가할 코드

`h0`, `h1`, `l0`, `l1`, `market`, `choch_dir`, `hiPts`, `loPts`가 계산된 뒤, 패널 업데이트 이후 아무 곳에나 임시로 넣으면 됩니다.

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

## 비교 기준

- 웹앱과 TradingView는 같은 심볼, 같은 타임프레임, 같은 `Confirmed/Aggressive`, 같은 `MSB 종가/윅 기준`으로 맞춰야 합니다.
- 가격값은 0.05% 이내 오차를 일치로 봅니다.
- `market=1`은 상승 MSB, `market=-1`은 하락 MSB입니다.
- `chochDir=1`은 상승 CHoCH, `chochDir=-1`은 하락 CHoCH입니다.

