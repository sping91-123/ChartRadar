import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeTimeframe, type Candle } from "../src/lib/marketAnalysis";
import { buildPerpetualDecisionSnapshot, type PerpetualTimeframeObservation, type SourceStatus } from "../src/lib/perpetualDecisionSnapshot";
import { buildPerpetualBriefingInput, fallbackPerpetualBriefing } from "../src/lib/server/perpetualBriefing";

const generatedAt = "2026-07-21T01:15:00.000Z";
const ready: SourceStatus = { status: "ready", observedAt: generatedAt, detail: "fixture" };

function candles(seconds: number, slope: number): Candle[] {
  return Array.from({ length: 320 }, (_, index) => {
    const base = 118_000 + index * slope;
    return {
      time: 1_752_000_000 + index * seconds,
      open: base,
      high: base + 60,
      low: base - 45,
      close: base + slope * 0.8,
      volume: 200 + index
    };
  });
}

function observation(timeframe: "15m" | "1h" | "4h", seconds: number, slope: number): PerpetualTimeframeObservation {
  const rows = candles(seconds, slope);
  const latest = rows.at(-1)!;
  return {
    timeframe,
    analysis: analyzeTimeframe(timeframe, rows),
    observedAt: generatedAt,
    closedPrice: latest.close,
    rangeHigh: latest.high,
    rangeLow: latest.low,
    candleTimes: rows.map((row) => row.time)
  };
}

const snapshot = buildPerpetualDecisionSnapshot({
  id: "33333333-3333-4333-8333-333333333333",
  fingerprint: "briefing-fixture",
  asset: "btc",
  price: 118_640,
  chartCandles: candles(15 * 60, 2),
  generatedAt,
  sourceStatus: { candles: ready, pressure: ready, flow: ready },
  timeframes: [
    observation("15m", 15 * 60, 2),
    observation("1h", 60 * 60, 1.5),
    observation("4h", 4 * 60 * 60, 1)
  ],
  pressure: null,
  flow: null,
  previousSnapshot: null
});

assert.equal(snapshot.pro?.detailVersion, 1);
const input = buildPerpetualBriefingInput(snapshot);
assert.equal(input.symbol, "BTCUSDT");
assert.equal(input.hideNumericScores, true, "the beginner AI prompt must not present internal model scores as user evidence");
assert.equal(input.scenario, null, "snapshot-native AI must not invent an entry or target scenario");
assert.match(input.analysisScope ?? "", /저장한 15분·1시간·4시간 분석/);
assert.ok(input.timeframes.every((item) => !/bullish|bearish|unknown/.test(`${item.msb} ${item.choch}`)), "AI input should receive beginner-facing direction labels");

const fallback = fallbackPerpetualBriefing(snapshot);
assert.match(fallback, /현재/);
assert.match(fallback, /가장 조심할 점/);
assert.doesNotMatch(fallback, /스냅샷|상방 구조|하방 구조|유지 조건|진입가|손절가|익절가/, "fallback copy must remain useful to beginners and avoid trade instructions");

const routeSource = readFileSync(join(process.cwd(), "src/app/api/crypto/perpetual/briefing/route.ts"), "utf8");
assert.match(routeSource, /getPerpetualDecisionSnapshotById\(body\.snapshotId\)/, "the route must load the exact stored analysis by ID");
assert.doesNotMatch(routeSource, /resolvePerpetualDecisionSnapshot|body\.(analysis|symbol|price|userId)/, "the route must not refetch current analysis or trust client-supplied market data");
assert.match(routeSource, /isPerpetualRevenueCoreUserEnabled\(entitlement\.userId\)/, "the AI route must obey the same rollout gate as the UI");
assert.match(routeSource, /readJsonBodyLimited/, "the AI route must enforce a streaming body-size limit");
assert.match(routeSource, /Object\.keys\(body\)/, "the AI route must reject client-supplied fields beyond the analysis ID");
assert.match(routeSource, /private, no-store, max-age=0/);
assert.match(routeSource, /Vary", "Authorization/);
assert.match(routeSource, /snapshot\.pro\?\.detailVersion !== 1/);
assert.match(routeSource, /code: "pro_required"/);
assert.match(routeSource, /code: "snapshot_detail_unavailable"/);

const clientSource = readFileSync(join(process.cwd(), "src/components/coin/PerpetualSnapshotBriefing.tsx"), "utf8");
assert.match(clientSource, /payload\.snapshotId !== snapshotId/, "a late AI response must not overwrite a newly selected analysis");
assert.match(clientSource, /controllerRef\.current\?\.abort\(\)/, "asset or analysis changes must cancel the old AI request");
assert.match(clientSource, /20_000/, "the client must stop an AI request that never returns");
const workbenchSource = readFileSync(join(process.cwd(), "src/components/coin/PerpetualEvidenceWorkbench.tsx"), "utf8");
assert.match(workbenchSource, /key=\{snapshot\.id\}/, "a new analysis must remount the explanation state before paint");
assert.match(workbenchSource, /timeZone: "Asia\/Seoul"/, "structure events must show their actual KST occurrence time");

console.log("Perpetual beginner briefing contract passed.");
