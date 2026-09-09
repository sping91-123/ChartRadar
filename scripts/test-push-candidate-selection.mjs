import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";

let scanRowsByMode = {};
const stubs = {
  "@/lib/server/supabaseAdmin": { supabaseAdminRest: async () => { throw new Error("Unexpected database access"); } },
  "@/lib/cryptoUniverse": { getLiquidCryptoSymbols: async () => ["SOLUSDT.P", "BNBUSDT.P"] },
  "@/lib/setupScout": { scanAllSetups: async ({ mode }) => scanRowsByMode[mode] ?? [] },
  "@/lib/marketAnalysis": { chartTimeframes: ["5m", "15m", "1h", "4h", "1d"] },
  "@/lib/stockMarket": { fetchStockCandles: async () => { throw new Error("Unexpected stock request"); } },
  "@/lib/technicalRadar": { analyzeTechnicalRadar: () => { throw new Error("Unexpected stock analysis"); } }
};
const cache = new Map();
function load(path) {
  path = resolve(path);
  if (cache.has(path)) return cache.get(path).exports;
  const module = { exports: {} };
  cache.set(path, module);
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  vm.runInNewContext(code, {
    exports: module.exports, module, Date, Map, Set,
    require: name => {
      if (name in stubs) return stubs[name];
      const local = name.startsWith("@/") ? resolve("src", name.slice(2)) : name.startsWith(".") ? resolve(dirname(path), name) : null;
      assert.ok(local, `Unexpected dependency: ${name}`);
      return load(`${local}.ts`);
    }
  }, { filename: path });
  return module.exports;
}
const { buildGenericPushEvents } = load("src/lib/server/push/genericEvents.ts");
const { passesSetupPushQuality } = load("src/lib/server/push/eligibility.ts");
const { scanCryptoSetups } = load("src/lib/server/push/scanners/setupScanner.ts");

function setup(symbol, timeframe, score, evidence = 2, quality = "A") {
  return {
    symbol, timeframe, mode: timeframe === "5m" || timeframe === "15m" ? "scalp" : "swing", score, status: "active",
    plan: { side: "long", quality },
    analysis: { timeframeAnalyses: [{ timeframe, msb: "bullish", condition: { volumeState: evidence >= 2 ? "high" : "normal", volatilityState: "normal" } }] }
  };
}
const qualified = rows => buildGenericPushEvents(rows, [], []).events.filter(passesSetupPushQuality);
const failures = [];
function check(label, fn) {
  try { fn(); console.log(`PASS ${label}`); }
  catch (error) { failures.push(label); console.error(`FAIL ${label}: ${error.message}`); }
}

const fast = setup("SOLUSDT.P", "5m", 95);
const slower = setup("SOLUSDT.P", "15m", 90);
scanRowsByMode = { scalp: [fast, slower] };
const scanned = await scanCryptoSetups();
check("the scanner preserves alternate timeframes for later eligibility checks", () => assert.equal(scanned.length, 2));
check("ineligible 5m cannot hide an eligible 15m of the same coin", () => {
  const events = qualified(scanned);
  assert.equal(events.length, 1);
  assert.equal(events[0].data.timeframe, "15m");
});
check("insufficient evidence cannot consume the one-alt delivery slot", () => {
  const events = qualified([setup("SOLUSDT.P", "1h", 95, 1), setup("BNBUSDT.P", "1h", 88)]);
  assert.equal(events.length, 1);
  assert.equal(events[0].symbol, "BNBUSDT.P");
});
check("eligible majors survive a leaderboard crowded with alts", () => {
  const rows = Array.from({ length: 9 }, (_, i) => setup(`ALT${i}USDT.P`, "1h", 95 - i));
  const events = qualified([...rows, setup("BTCUSDT.P", "15m", 80), setup("ETHUSDT.P", "1h", 80)]);
  assert.equal(events.length, 3);
  assert.ok(events.some(event => event.symbol === "BTCUSDT.P"));
  assert.ok(events.some(event => event.symbol === "ETHUSDT.P"));
});
check("score, evidence and 5m exclusions remain unchanged", () => {
  assert.equal(qualified([setup("SOLUSDT.P", "1h", 79)]).length, 0);
  assert.equal(qualified([fast]).length, 0);
  assert.equal(qualified([setup("SOLUSDT.P", "1h", 95, 1)]).length, 0);
  assert.equal(qualified([setup("SOLUSDT.P", "1h", 84, 2, "B")]).length, 0);
});
check("the best eligible timeframe remains unique and quotas stay bounded", () => {
  const events = qualified([setup("SOLUSDT.P", "1h", 90), setup("SOLUSDT.P", "4h", 85), setup("BNBUSDT.P", "1h", 89)]);
  assert.equal(events.length, 1);
  assert.equal(events[0].symbol, "SOLUSDT.P");
  assert.equal(events[0].data.timeframe, "1h");
  assert.equal(qualified([]).length, 0);
});
if (failures.length) process.exitCode = 1;
else console.log("Push candidate selection regression passed; no live market requests or FCM sends.");
