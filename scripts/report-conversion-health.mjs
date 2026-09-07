import { readFile } from "node:fs/promises";
import { buildConversionHealth } from "./conversion-health-core.mjs";
const [inputPath, startAt, endAt] = process.argv.slice(2);
if (!inputPath || !startAt || !endAt) {
  console.error("Usage: node scripts/report-conversion-health.mjs <events-json> <start-ISO> <end-exclusive-ISO>");
  process.exitCode = 1;
} else {
  const events = JSON.parse(await readFile(inputPath, "utf8"));
  if (!Array.isArray(events)) throw new Error("Input must be a product_events array.");
  console.log(JSON.stringify(buildConversionHealth({ events, startAt, endAt }), null, 2));
}
