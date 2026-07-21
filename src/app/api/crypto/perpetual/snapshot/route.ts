import { NextResponse } from "next/server";
import { cryptoAlertConditionLimit } from "@/lib/billing";
import { serializeBasicPerpetualSnapshot } from "@/lib/perpetualDecisionSnapshot";
import { entitlementRateKey, getRequestEntitlement } from "@/lib/server/requestEntitlement";
import {
  hydratePerpetualDecisionChart,
  normalizePerpetualAsset,
  resolvePerpetualDecisionSnapshot
} from "@/lib/server/perpetualDecisionSource";
import {
  isPerpetualSnapshotGenerationEnabled,
  isPerpetualRevenueCoreUserEnabled,
  perpetualRevenueCoreMode
} from "@/lib/server/perpetualRevenueCore";
import { sharedCryptoConditionUsage } from "@/lib/server/perpetualMonitorStore";
import { readNewsDecisionContext } from "@/lib/server/news/newsImpactStore";
import { newsImpactRuntimePolicy } from "@/lib/server/newsImpactMode";
import { rateLimit } from "@/lib/server/rateLimit";
import { isSupabaseAdminConfigured } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

function privateJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Authorization");
  return response;
}

async function activeCryptoAlertCount(userId: string) {
  if (!isSupabaseAdminConfigured()) {
    return { count: 0, scenarioMonitorCount: 0, presetCount: 0, available: false };
  }
  try {
    const usage = await sharedCryptoConditionUsage(userId);
    return {
      count: usage.total,
      scenarioMonitorCount: usage.activeMonitorCount,
      presetCount: usage.enabledPresetCount,
      available: true
    };
  } catch {
    return { count: 0, scenarioMonitorCount: 0, presetCount: 0, available: false };
  }
}

export async function GET(request: Request) {
  const entitlement = await getRequestEntitlement(request, "crypto");
  const limited = await rateLimit(request, {
    key: entitlementRateKey("crypto-perpetual-snapshot", entitlement),
    limit: entitlement.isPaid ? 180 : 90,
    windowMs: 5 * 60 * 1000
  });
  if (!limited.allowed) {
    return privateJson({ error: "선물 판단 요청이 많습니다. 잠시 후 다시 시도해 주세요." }, {
      status: 429,
      headers: { "Retry-After": String(limited.retryAfter) }
    });
  }

  const url = new URL(request.url);
  const asset = normalizePerpetualAsset(url.searchParams.get("asset"));
  if (!asset) return privateJson({ error: "BTC 또는 ETH 자산을 선택해 주세요." }, { status: 400 });
  const requestedSnapshotId = url.searchParams.get("snapshot");
  const requestSource = url.searchParams.get("source");
  const impactId = url.searchParams.get("impact");
  const newsPolicy = newsImpactRuntimePolicy();
  const preserveLinkedSnapshot = (
    requestSource === "alert" || (requestSource === "news" && newsPolicy.expose)
  ) && Boolean(requestedSnapshotId);
  const mode = perpetualRevenueCoreMode();
  if (!isPerpetualSnapshotGenerationEnabled(mode)) {
    return privateJson({ error: "Perpetual revenue core is disabled." }, { status: 404 });
  }

  try {
    const resolution = await resolvePerpetualDecisionSnapshot({
      asset,
      requestedSnapshotId,
      allowExpiredRequestedSnapshot: preserveLinkedSnapshot
    });
    const hydratedSnapshot = await hydratePerpetualDecisionChart(resolution.snapshot);
    const failClosed = entitlement.state === "unavailable" || entitlement.state === "deletion_pending";
    const monitorEnabled = isPerpetualRevenueCoreUserEnabled(entitlement.userId, mode);
    const canSeeProDetail = entitlement.isPaid && !failClosed;
    const alerts = entitlement.userId && monitorEnabled
      ? await activeCryptoAlertCount(entitlement.userId)
      : { count: 0, scenarioMonitorCount: 0, presetCount: 0, available: false };
    const monitorLimit = failClosed || !monitorEnabled ? 0 : cryptoAlertConditionLimit(entitlement.plan);
    const snapshot = canSeeProDetail ? hydratedSnapshot : serializeBasicPerpetualSnapshot(hydratedSnapshot);
    const snapshotActionable =
      resolution.snapshot.quality === "ready" &&
      new Date(resolution.snapshot.expiresAt).getTime() > Date.now();
    const newsContext = newsPolicy.expose && canSeeProDetail && requestSource === "news" && impactId
      ? await readNewsDecisionContext(impactId, asset, resolution.snapshot.id).catch(() => null)
      : null;

    return privateJson({
      snapshot,
      continuity: resolution.continuity,
      capabilities: {
        monitorLimit,
        activeMonitorCount: alerts.count,
        scenarioMonitorCount: alerts.scenarioMonitorCount,
        presetCount: alerts.presetCount,
        canSeeProDetail,
        monitorEnabled,
        canCreateMonitor:
          Boolean(entitlement.userId) &&
          monitorEnabled &&
          !failClosed &&
          alerts.available &&
          snapshotActionable &&
          alerts.count < monitorLimit,
        requiresAuth: !entitlement.userId,
        setupRequired: Boolean(entitlement.userId) && monitorEnabled && !alerts.available
      },
      newsContext,
      mode
    });
  } catch (error) {
    console.error("[api/crypto/perpetual/snapshot] error:", error);
    return privateJson({ error: "현재 BTC·ETH 선물 시장 분석을 만들지 못했습니다." }, { status: 503 });
  }
}
