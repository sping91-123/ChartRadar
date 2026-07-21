import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { selectFuturesBriefCandidate } from "../src/lib/futuresBriefSelection";
import { resolveMajorAsset } from "../src/lib/majorAssetRoute";

assert.equal(resolveMajorAsset({ asset: "eth" }), "eth");
assert.equal(resolveMajorAsset({ asset: "btc", symbol: "ETHUSDT.P" }), "btc", "canonical asset wins");
assert.equal(resolveMajorAsset({ symbol: "ETHUSDT.P" }), "eth", "legacy symbol remains compatible");
assert.equal(resolveMajorAsset({ symbol: "SOLUSDT.P" }), "btc");

const symbols = [
  { symbol: "DOGEUSDT", label: "DOGE" },
  { symbol: "BNBUSDT", label: "BNB" },
  { symbol: "SOLUSDT", label: "SOL" }
];
const pressure = (symbol: string, score: number) => ({ symbol, upsideShortPressure: score, downsideLongPressure: 10 });
const flow = (symbol: string, notional: number, thresholdUsd = 100) => ({ symbol, thresholdUsd, totalLargeNotionalUsd: notional, imbalancePercent: 50 });

const mixed = selectFuturesBriefCandidate(symbols, [pressure("DOGEUSDT", 90), pressure("BNBUSDT", 60)], [flow("BNBUSDT", 1_000)]);
assert.equal(mixed?.symbol, "DOGEUSDT");
assert.equal(mixed?.flow, undefined, "another symbol's flow must never be borrowed");

const tiedWithFlow = selectFuturesBriefCandidate(symbols, [pressure("DOGEUSDT", 80), pressure("BNBUSDT", 80)], [flow("BNBUSDT", 100)]);
assert.equal(tiedWithFlow?.symbol, "BNBUSDT", "same-symbol flow presence breaks a pressure tie");

const tiedFlowStrength = selectFuturesBriefCandidate(symbols, [pressure("DOGEUSDT", 80), pressure("BNBUSDT", 80)], [flow("DOGEUSDT", 100), flow("BNBUSDT", 300)]);
assert.equal(tiedFlowStrength?.symbol, "BNBUSDT", "normalized flow strength breaks the next tie");

const stable = selectFuturesBriefCandidate(symbols, [pressure("DOGEUSDT", 80), pressure("BNBUSDT", 80)], []);
assert.equal(stable?.symbol, "DOGEUSDT", "input order is the final deterministic tie-breaker");

const briefSource = readFileSync(join(process.cwd(), "src/components/coin/CoinFuturesBrief.tsx"), "utf8");
assert.doesNotMatch(briefSource, /선물 리스크 스냅샷|상방 확인 시나리오|하방 확인 시나리오|판단 변경 기준/);
assert.match(briefSource, /가격이 오를 때 확인할 흐름/);
assert.match(briefSource, /가격이 내릴 때 확인할 흐름/);

console.log("Futures brief same-symbol selection matrix passed.");
