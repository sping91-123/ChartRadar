import assert from "node:assert/strict";
import { readBoundedOfficialResponseText } from "../src/lib/server/news/boundedOfficialResponse";
import { officialNewsCanonicalEventId } from "../src/lib/server/news/officialNewsIdentity";
import { runtimeAllowedNewsSourcesForPolicies } from "../src/lib/server/news/sourceCatalog";

async function main() {
  const options = {
    maxBytes: 32,
    contentType: /json/i,
    contentTypeError: "unexpected_type",
    tooLargeError: "too_large"
  };
  const valid = await readBoundedOfficialResponseText(
    new Response('{"ok":true}', { headers: { "content-type": "application/json" } }),
    options
  );
  assert.equal(valid, '{"ok":true}');

  await assert.rejects(
    readBoundedOfficialResponseText(
      new Response("<html></html>", { headers: { "content-type": "text/html" } }),
      options
    ),
    /unexpected_type:text\/html/,
    "official adapters reject an unexpected media type"
  );

  await assert.rejects(
    readBoundedOfficialResponseText(
      new Response("{}", {
        headers: { "content-type": "application/json", "content-length": "1024" }
      }),
      options
    ),
    /too_large/,
    "declared oversized payloads are rejected before parsing"
  );

  const oversizedStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("x".repeat(20)));
      controller.enqueue(new TextEncoder().encode("x".repeat(20)));
      controller.close();
    }
  });
  await assert.rejects(
    readBoundedOfficialResponseText(
      new Response(oversizedStream, { headers: { "content-type": "application/json" } }),
      options
    ),
    /too_large/,
    "chunked payloads cannot bypass the byte limit"
  );

  const policies = new Map<string, readonly string[]>([
    ["sec_press_releases", ["sec.gov"]]
  ]);
  const runtimeSec = runtimeAllowedNewsSourcesForPolicies(policies).find((source) => source.id === "sec_press_releases");
  assert.deepEqual(runtimeSec?.allowedHosts, ["sec.gov"], "the runtime fetcher uses the current DB host policy, not a wider static list");

  const firstIdentity = officialNewsCanonicalEventId({
    sourceId: "sec_press_releases",
    externalId: "stable-guid-7",
    canonicalUrl: "https://www.sec.gov/news/press-release/first-title",
    eventKind: "us_crypto_regulation",
    publishedAt: "2026-07-24T00:00:00.000Z"
  });
  const revisedIdentity = officialNewsCanonicalEventId({
    sourceId: "sec_press_releases",
    externalId: "stable-guid-7",
    canonicalUrl: "https://www.sec.gov/news/press-release/revised-title",
    eventKind: "us_crypto_regulation",
    publishedAt: "2026-07-24T00:05:00.000Z"
  });
  assert.equal(firstIdentity, revisedIdentity, "a title or URL revision with the same official GUID stays one event");

  console.log("News official runtime boundary fixtures passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
