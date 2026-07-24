import type { PerpetualAsset } from "../../perpetualDecisionSnapshot";
import type { NewsMarketBrief } from "../../newsImpact";
import { buildCryptoNewsMarketBrief, buildGlobalNewsMarketBrief, resolveNewsMarketBriefQuality } from "../../newsMarketBrief";
import { getPerpetualDecisionSnapshotById, getReadyPerpetualSnapshotBefore } from "../perpetualDecisionSource";
import { findGlobalObservationBefore } from "./newsImpactStore";
import { readCftcPositioning } from "./cftcPositioning";

const LOOKUP_TOLERANCE_MINUTES = 20;
const CURRENT_MARKET_MAX_AGE_MS = 10 * 60_000;

export async function buildNewsMarketBrief(
  market: "crypto" | "global",
  asset: PerpetualAsset | null,
  now = new Date(),
  requestedSnapshotId?: string | null
): Promise<NewsMarketBrief | null> {
  const nowIso = new Date(now.getTime() + 60_000).toISOString();
  if (market === "crypto" && asset) {
    const requested = requestedSnapshotId
      ? await getPerpetualDecisionSnapshotById(requestedSnapshotId)
      : null;
    const requestedCurrent = requested?.asset === asset &&
      requested.quality === "ready" &&
      Date.parse(requested.expiresAt) > now.getTime()
      ? requested
      : null;
    const current = requestedCurrent ?? await getReadyPerpetualSnapshotBefore(asset, nowIso, LOOKUP_TOLERANCE_MINUTES);
    if (!current) return null;
    const currentMs = Date.parse(current.generatedAt);
    const oneHourAt = new Date(currentMs - 60 * 60_000).toISOString();
    const oneDayAt = new Date(currentMs - 24 * 60 * 60_000).toISOString();
    const [before1h, before24h, weeklyPositioning] = await Promise.all([
      getReadyPerpetualSnapshotBefore(asset, oneHourAt, LOOKUP_TOLERANCE_MINUTES),
      getReadyPerpetualSnapshotBefore(asset, oneDayAt, LOOKUP_TOLERANCE_MINUTES),
      readCftcPositioning(asset, now)
    ]);
    const brief = buildCryptoNewsMarketBrief(asset, current, before1h, before24h);
    return {
      ...brief,
      quality: resolveNewsMarketBriefQuality({
        quality: brief.quality,
        generatedAt: current.generatedAt,
        expiresAt: current.expiresAt,
        nowMs: now.getTime(),
        maxAgeMs: CURRENT_MARKET_MAX_AGE_MS
      }),
      weeklyPositioning
    };
  }

  const oneHourAt = new Date(now.getTime() - 60 * 60_000).toISOString();
  const oneDayAt = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
  const [current, before1h, before24h] = await Promise.all([
    findGlobalObservationBefore(nowIso, LOOKUP_TOLERANCE_MINUTES),
    findGlobalObservationBefore(oneHourAt, LOOKUP_TOLERANCE_MINUTES),
    findGlobalObservationBefore(oneDayAt, LOOKUP_TOLERANCE_MINUTES)
  ]);
  if (!current) return null;
  const brief = buildGlobalNewsMarketBrief(current, before1h, before24h);
  return {
    ...brief,
    quality: resolveNewsMarketBriefQuality({
      quality: brief.quality,
      generatedAt: current.observedAt,
      nowMs: now.getTime(),
      maxAgeMs: CURRENT_MARKET_MAX_AGE_MS
    })
  };
}
