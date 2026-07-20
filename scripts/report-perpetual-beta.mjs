import { createRequire } from "node:module";
import { buildPerpetualBetaReport, kstStudyWindow } from "./perpetual-beta-report-core.mjs";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());

const expectedProjectRef = "dbdouafktptajamanyno";
const argument = (name) => process.argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3);
const startDateKst = argument("start");
const phase = argument("phase") ?? "progress";
const deploymentSha = argument("deployment-sha") ?? "";
const confirmedProject = argument("confirm-project");
if (!startDateKst) throw new Error("Use --start=YYYY-MM-DD for a KST-midnight study start.");
if (phase !== "progress" && phase !== "final") throw new Error("Use --phase=progress or --phase=final.");
if (confirmedProject !== expectedProjectRef) throw new Error(`Use --confirm-project=${expectedProjectRef} to confirm the production target.`);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey || new URL(supabaseUrl).hostname !== `${expectedProjectRef}.supabase.co`) {
  throw new Error("Production Supabase URL and service-role key are required.");
}

async function rest(path) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Read-only beta report query failed with HTTP ${response.status}.`);
  return response.json();
}

const window = kstStudyWindow(startDateKst);
const cohortRows = await rest("subscriptions?select=user_id,current_period_end&provider=eq.legacy_beta&order=user_id.asc");
const userIds = Array.from(new Set(cohortRows.map((row) => row.user_id).filter(Boolean)));
if (userIds.length !== 12 || cohortRows.length !== 12) throw new Error("Production legacy beta cohort is not exactly 12 unique users.");
const inUsers = `(${userIds.join(",")})`;
const range = `occurred_at=gte.${encodeURIComponent(window.start.toISOString())}&occurred_at=lt.${encodeURIComponent(window.end.toISOString())}`;
const [events, monitors, journals] = await Promise.all([
  rest(`product_events?select=event_id,event_name,user_id,asset,snapshot_id,attribution_id,properties,occurred_at&user_id=in.${inUsers}&${range}&order=occurred_at.asc`),
  rest(`perpetual_scenario_monitors?select=id,user_id,snapshot_id,created_at&user_id=in.${inUsers}&created_at=gte.${encodeURIComponent(window.start.toISOString())}&created_at=lt.${encodeURIComponent(window.end.toISOString())}`),
  rest(`journals?select=id,user_id,decision_snapshot_id,monitor_id,created_at&user_id=in.${inUsers}&created_at=gte.${encodeURIComponent(window.start.toISOString())}&created_at=lt.${encodeURIComponent(window.end.toISOString())}`)
]);
const snapshotIds = Array.from(new Set(events.map((row) => row.snapshot_id).filter(Boolean)));
const snapshots = snapshotIds.length
  ? await rest(`perpetual_decision_snapshots?select=id,asset,quality&id=in.(${snapshotIds.join(",")})`)
  : [];
const report = buildPerpetualBetaReport({
  startDateKst,
  now: new Date(),
  cohortRows,
  events,
  snapshots,
  monitors,
  journals,
  deploymentSha
});

console.log(JSON.stringify(report, null, 2));
if (!report.gates.cohortExactly12 || !report.gates.duplicateSubscriptionsZero || !report.gates.entitlementCoversStudy) {
  throw new Error("Beta study gate failed. No user identifiers were printed.");
}
if (phase === "final" && !report.gates.finalAvailable) {
  throw new Error("Day 14 has not elapsed; final beta judgment is unavailable.");
}
