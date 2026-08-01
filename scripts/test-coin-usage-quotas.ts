import assert from "node:assert/strict";
import { getMarketBriefingCache, setMarketBriefingCache } from "../src/lib/ai/marketBriefingCache";
import { basicCoinCapabilityPolicy, coinProCapabilityPolicy } from "../src/lib/coinCapabilities";
import { distinctRateLimit, kstDailyRateWindow, rateLimit } from "../src/lib/server/rateLimit";

delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;

const request = new Request("https://chartradar.kr/api/test", {
  headers: { "x-forwarded-for": "203.0.113.10" }
});

assert.equal(basicCoinCapabilityPolicy.radarScanDailyLimit, 2);
assert.equal(coinProCapabilityPolicy.radarScanDailyLimit, 200);
assert.equal(basicCoinCapabilityPolicy.watchlistScanDailyLimit, 1);
assert.equal(coinProCapabilityPolicy.watchlistScanDailyLimit, 100);
assert.equal(basicCoinCapabilityPolicy.altAnalysisDailyLimit, 3);
assert.equal(coinProCapabilityPolicy.altAnalysisDailyLimit, null);

const beforeMidnight = kstDailyRateWindow(Date.parse("2026-08-01T14:59:59.000Z"));
assert.equal(beforeMidnight.dateKey, "2026-08-01");
assert.equal(new Date(beforeMidnight.resetAt).toISOString(), "2026-08-01T15:00:00.000Z");
const afterMidnight = kstDailyRateWindow(Date.parse("2026-08-01T15:00:00.000Z"));
assert.equal(afterMidnight.dateKey, "2026-08-02");
assert.equal(new Date(afterMidnight.resetAt).toISOString(), "2026-08-02T15:00:00.000Z");

async function run() {
  const counterKey = `test:coin-radar:${crypto.randomUUID()}`;
  assert.equal((await rateLimit(request, { key: counterKey, limit: 2, windowMs: 60_000 })).allowed, true);
  assert.equal((await rateLimit(request, { key: counterKey, limit: 2, windowMs: 60_000 })).allowed, true);
  const third = await rateLimit(request, { key: counterKey, limit: 2, windowMs: 60_000 });
  assert.equal(third.allowed, false, "Basic Scout allows two logical requests and blocks the third");
  assert.equal(third.count, 2, "a rejected memory request does not inflate the displayed usage");

  const distinctKey = `test:alt:${crypto.randomUUID()}`;
  const first = await distinctRateLimit(request, { key: distinctKey, subject: "ADAUSDT.P", limit: 3, windowMs: 60_000 });
  const repeated = await distinctRateLimit(request, { key: distinctKey, subject: "ADAUSDT.P", limit: 3, windowMs: 60_000 });
  assert.equal(first.newlyCounted, true);
  assert.equal(repeated.newlyCounted, false);
  assert.equal(repeated.count, 1, "reopening the same Alt symbol is not charged twice");

  const concurrentKey = `test:alt-concurrent:${crypto.randomUUID()}`;
  const results = await Promise.all(["ADAUSDT.P", "SOLUSDT.P", "LINKUSDT.P", "AVAXUSDT.P"].map((subject) =>
    distinctRateLimit(request, { key: concurrentKey, subject, limit: 3, windowMs: 60_000 })
  ));
  assert.equal(results.filter((result) => result.allowed).length, 3);
  assert.equal(results.filter((result) => !result.allowed).length, 1, "the fourth distinct Alt symbol is atomically rejected");

  const originalFetch = globalThis.fetch;
  const sharedStore = new Map<string, string>();
  process.env.KV_REST_API_URL = "https://shared-cache.example";
  process.env.KV_REST_API_TOKEN = "test-token";
  globalThis.fetch = (async (_input, init) => {
    const command = JSON.parse(String(init?.body ?? "[]")) as string[];
    if (command[0] === "GET") {
      return new Response(JSON.stringify({ result: sharedStore.get(command[1]) ?? null }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (command[0] === "SET") {
      sharedStore.set(command[1], command[2]);
      return new Response(JSON.stringify({ result: "OK" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ error: "unsupported" }), { status: 400 });
  }) as typeof fetch;
  try {
    const briefingKey = `test:market-briefing:${crypto.randomUUID()}`;
    assert.deepEqual(await getMarketBriefingCache(briefingKey), { status: "miss" });
    assert.equal(await setMarketBriefingCache(
      briefingKey,
      { briefing: "공유 캐시에 보존된 브리핑", model: "test-model" },
      300
    ), true);
    assert.deepEqual(
      await getMarketBriefingCache(briefingKey),
      {
        status: "hit",
        value: { briefing: "공유 캐시에 보존된 브리핑", model: "test-model" }
      },
      "a different server instance can reopen the same shared AI result without another quota claim"
    );
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  }

  console.log("Coin daily counter, distinct-symbol quota, shared AI cache, and KST reset contracts passed.");
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
