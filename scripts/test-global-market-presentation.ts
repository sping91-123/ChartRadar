import assert from "node:assert/strict";
import { globalDataAsOf, globalDataReferenceLabel, globalPressureForChange, globalProxyInterpretation } from "../src/lib/globalMarketPresentation";

const observedUupChange = (28.079999923706055 - 28.010000228881836) / 28.010000228881836 * 100;
assert.equal(observedUupChange.toFixed(2), "0.25");
assert.equal(globalPressureForChange("UUP", observedUupChange), "mixed");
assert.match(globalProxyInterpretation("UUP", observedUupChange, "달러 프록시")!, /소폭 변동/);
assert.doesNotMatch(globalProxyInterpretation("UUP", observedUupChange, "달러 프록시")!, /약해|강해/);
for (const symbol of ["^VIX", "VIXY", "UUP", "TLT", "ZN=F", "IEF", "SHY"]) {
  for (const change of [-0.24999, 0, 0.24999]) {
    assert.equal(globalPressureForChange(symbol, change), "mixed");
    assert.match(globalProxyInterpretation(symbol, change, symbol)!, /소폭 변동/);
  }
  assert.notEqual(globalPressureForChange(symbol, 0.25), "mixed");
  assert.notEqual(globalPressureForChange(symbol, -0.25), "mixed");
  assert.match(globalProxyInterpretation(symbol, NaN, symbol)!, /해석을 보류/);
}
assert.match(globalProxyInterpretation("UUP", 0.3, "달러")!, /강해/);
assert.match(globalProxyInterpretation("UUP", -0.3, "달러")!, /약해/);
assert.equal(globalPressureForChange("CL=F", 1), "mixed");
assert.equal(globalPressureForChange("CL=F", 1.2), "burden");
assert.equal(globalPressureForChange("CL=F", -1.2), "supportive");
const friday = Date.parse("2026-09-04T13:30:00Z") / 1000;
const asOf = globalDataAsOf([friday, NaN, 0]);
assert.equal(asOf?.newestCandleAt, "2026-09-04T13:30:00.000Z");
assert.match(globalDataReferenceLabel(asOf), /2026.*09.*04/);
assert.match(globalDataReferenceLabel(globalDataAsOf([friday - 86400, friday])), /~/);
assert.equal(globalDataAsOf([]), null);
assert.match(globalDataReferenceLabel(null), /확인 필요/);
console.log("Global market interpretation and source-date matrix passed.");
