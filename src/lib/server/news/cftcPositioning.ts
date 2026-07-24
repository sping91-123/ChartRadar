import {
  cftcContractCode,
  normalizeCftcPositioning,
  type CftcPositioningRow
} from "../../cftcPositioning";
import type { PerpetualAsset } from "../../perpetualDecisionSnapshot";
import {
  readEnabledNewsSourcePolicies,
  readNewsSourceHealth,
  recordNewsSourceFailure,
  recordNewsSourceSuccess
} from "./newsImpactStore";
import { isAllowedUrlForHosts, newsSourceById } from "./sourceCatalog";
import { readBoundedOfficialResponseText } from "./boundedOfficialResponse";
import { supabaseAdminRest } from "../supabaseAdmin";

const SOURCE_ID = "cftc_cot_positioning";
const source = newsSourceById(SOURCE_ID);
const ENDPOINT = source?.endpoint ?? "";
const MAX_RESPONSE_BYTES = 128 * 1024;

interface StoredCftcPositioningRow {
  asset: PerpetualAsset;
  report_date: string;
  observed_at: string;
  raw_payload: CftcPositioningRow;
}

async function readBoundedJson(response: Response) {
  const text = await readBoundedOfficialResponseText(response, {
    maxBytes: MAX_RESPONSE_BYTES,
    contentType: /json/i,
    contentTypeError: "cftc_positioning_unexpected_content_type",
    tooLargeError: "cftc_positioning_payload_too_large"
  });
  return text ? JSON.parse(text) as CftcPositioningRow[] : null;
}

async function requestPositioning(asset: PerpetualAsset, now: Date, allowedHosts: string[]) {
  if (!ENDPOINT) return null;
  const url = new URL(ENDPOINT);
  url.searchParams.set("$select", [
    "id",
    "cftc_contract_market_code",
    "report_date_as_yyyy_mm_dd",
    "open_interest_all",
    "change_in_open_interest_all",
    "asset_mgr_positions_long",
    "asset_mgr_positions_short",
    "change_in_asset_mgr_long",
    "change_in_asset_mgr_short",
    "lev_money_positions_long",
    "lev_money_positions_short",
    "change_in_lev_money_long",
    "change_in_lev_money_short"
  ].join(","));
  url.searchParams.set("$where", `cftc_contract_market_code='${cftcContractCode(asset)}'`);
  url.searchParams.set("$order", "report_date_as_yyyy_mm_dd DESC");
  url.searchParams.set("$limit", "1");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);
  try {
    const requestInit: RequestInit & { next: { revalidate: number } } = {
      headers: {
        Accept: "application/json",
        "User-Agent": process.env.NEWS_OFFICIAL_USER_AGENT || "ChartRadar/1.0 (https://chartradar.kr/contact)"
      },
      cache: "force-cache",
      next: { revalidate: 60 * 60 },
      signal: controller.signal
    };
    const response = await fetch(url, requestInit);
    const finalUrl = response.url || url.toString();
    if (!isAllowedUrlForHosts(finalUrl, allowedHosts)) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error("cftc_positioning_redirect_host_not_allowed");
    }
    if (!response.ok) throw new Error(`cftc_positioning_http_${response.status}`);
    const rows = await readBoundedJson(response);
    const normalized = rows?.[0] ? normalizeCftcPositioning(asset, rows[0], now) : null;
    if (!normalized) throw new Error("cftc_positioning_invalid_payload");
    await recordNewsSourceSuccess(SOURCE_ID).catch(() => undefined);
    return { brief: normalized, row: rows![0] };
  } catch (error) {
    await recordNewsSourceFailure(SOURCE_ID, error).catch(() => undefined);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function readCftcPositioning(asset: PerpetualAsset, now = new Date()) {
  const policies = await readEnabledNewsSourcePolicies().catch(() => new Map<string, string[]>());
  const allowedHosts = policies.get(SOURCE_ID) ?? [];
  if (!ENDPOINT || !isAllowedUrlForHosts(ENDPOINT, allowedHosts)) return null;
  const rows = await supabaseAdminRest<StoredCftcPositioningRow[]>(
    `cftc_positioning_observations?select=asset,report_date,observed_at,raw_payload&asset=eq.${asset}&order=report_date.desc&limit=1`
  ).catch(() => []);
  return rows[0] ? normalizeCftcPositioning(asset, rows[0].raw_payload, now) : null;
}

export async function syncCftcPositioningObservations(now = new Date()) {
  const policies = await readEnabledNewsSourcePolicies().catch(() => new Map<string, string[]>());
  const allowedHosts = policies.get(SOURCE_ID) ?? [];
  if (!ENDPOINT || !isAllowedUrlForHosts(ENDPOINT, allowedHosts)) {
    return { sourceId: SOURCE_ID, status: "skipped" as const, fetchedCount: 0, acceptedCount: 0, warning: "source_policy_disabled" };
  }
  const health = await readNewsSourceHealth(SOURCE_ID).catch(() => null);
  if (health?.circuit_open_until && Date.parse(health.circuit_open_until) > now.getTime()) {
    return { sourceId: SOURCE_ID, status: "skipped" as const, fetchedCount: 0, acceptedCount: 0, warning: "circuit_open" };
  }
  let fetchedCount = 0;
  let acceptedCount = 0;
  const failures: string[] = [];
  const assets = ["btc", "eth"] as const;
  for (let index = 0; index < assets.length; index += 1) {
    const asset = assets[index];
    const result = await requestPositioning(asset, now, allowedHosts);
    fetchedCount += 1;
    if (!result) {
      failures.push(asset);
    } else {
      await supabaseAdminRest("cftc_positioning_observations?on_conflict=asset,report_date", {
        method: "POST",
        body: {
          asset,
          report_date: result.brief.reportDate.slice(0, 10),
          observed_at: now.toISOString(),
          raw_payload: result.row
        },
        prefer: "resolution=merge-duplicates"
      });
      acceptedCount += 1;
    }
    if (index === 0) await new Promise((resolve) => setTimeout(resolve, 1_050));
  }
  return {
    sourceId: SOURCE_ID,
    status: failures.length === 0 ? "succeeded" as const : "failed" as const,
    fetchedCount,
    acceptedCount,
    ...(failures.length > 0 ? { warning: `positioning_failed:${failures.join(",")}` } : {})
  };
}
