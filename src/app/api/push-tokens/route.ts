// Android 앱 푸시 토큰을 로그인 사용자 계정에 연결합니다.
import { NextResponse } from "next/server";
import { cryptoAlertConditionLimit } from "@/lib/billing";
import { perpetualDecisionEngineVersion } from "@/lib/perpetualDecisionSnapshot";
import { radarAlertRules, type RadarAlertRule, type RadarAlertRuleId } from "@/lib/radarAlerts";
import { isPerpetualRevenueCoreUserEnabled } from "@/lib/server/perpetualRevenueCore";
import { entitlementRateKey, getRequestEntitlement } from "@/lib/server/requestEntitlement";
import { rateLimit, readJsonBodyLimited } from "@/lib/server/rateLimit";
import { isSupabaseAdminConfigured, supabaseAdminRest, supabaseAdminRpc } from "@/lib/server/supabaseAdmin";

type PushPlatform = "android" | "ios" | "web";
type PushMarket = "crypto" | "stocks";

interface PushTokenRequestBody {
  token?: string;
  platform?: PushPlatform;
  appId?: string;
  markets?: string[];
  ruleIds?: string[];
  presets?: unknown[];
  enabled?: boolean;
}

interface NormalizedPushPreset {
  preset_id: string;
  market: PushMarket;
  symbol: string;
  mode: string | null;
  timeframe: string;
  side: "long" | "short";
  quality: "A" | "B" | "C";
  score: number;
  headline: string;
  saved_at: string;
}

interface ExistingPushTokenRow {
  id: string;
  user_id: string;
  markets: string[] | null;
  rule_ids: string[] | null;
}

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? "";
}

function normalizeStringList(values: unknown, allowed?: Set<string>) {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item && (!allowed || allowed.has(item)))
    )
  ).slice(0, 40);
}

const validRuleIds = new Set(radarAlertRules.map((rule) => rule.id));
const sharedAlertCategories = new Set<RadarAlertRule["category"]>(["news", "system"]);

function normalizePushRuleIds(values: unknown): RadarAlertRuleId[] {
  return normalizeStringList(values, validRuleIds) as RadarAlertRuleId[];
}

function normalizePushMarketValue(value: string) {
  const market = value.trim();
  if (market === "global") return "stocks";
  return market;
}

function normalizePushMarkets(values: unknown): PushMarket[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .filter((item): item is string => typeof item === "string")
        .map(normalizePushMarketValue)
        .filter((item): item is PushMarket => item === "crypto" || item === "stocks")
    )
  ).slice(0, 40);
}

function mergePushMarkets(current: string[] | null | undefined, next: string[]) {
  return normalizePushMarkets([...(current ?? []), ...next]);
}

function ruleAppliesToMarkets(rule: RadarAlertRule, markets: PushMarket[]) {
  const scopedMarkets = markets.length > 0 ? markets : (["crypto", "stocks"] satisfies PushMarket[]);
  if (sharedAlertCategories.has(rule.category)) return true;
  if (rule.category === "crypto") return scopedMarkets.includes("crypto");
  if (rule.category === "stocks") return scopedMarkets.includes("stocks");
  return false;
}

function replaceScopedRuleIds(current: string[] | null | undefined, next: RadarAlertRuleId[], markets: PushMarket[]) {
  const scopedRuleIds = new Set(radarAlertRules.filter((rule) => ruleAppliesToMarkets(rule, markets)).map((rule) => rule.id));
  const preservedRuleIds = normalizePushRuleIds(current).filter((id) => !scopedRuleIds.has(id));
  return Array.from(new Set([...preservedRuleIds, ...next])).slice(0, 40);
}

function normalizePreset(item: unknown, fallbackMarket: PushMarket): NormalizedPushPreset | null {
  if (!item || typeof item !== "object") return null;
  const preset = item as Record<string, unknown>;
  const rawId = typeof preset.id === "string" ? preset.id.trim() : "";
  const symbol = typeof preset.symbol === "string" ? preset.symbol.trim().toUpperCase().slice(0, 32) : "";
  const timeframe = typeof preset.timeframe === "string" ? preset.timeframe.trim().slice(0, 12) : "";
  const headline = typeof preset.headline === "string" ? preset.headline.trim().slice(0, 240) : "";
  const market = preset.market === "stocks" ? "stocks" : fallbackMarket;
  const side = preset.side === "long" || preset.side === "short" ? preset.side : null;
  const quality = preset.quality === "A" || preset.quality === "B" || preset.quality === "C" ? preset.quality : null;
  const score = typeof preset.score === "number" && Number.isFinite(preset.score) ? Math.round(preset.score) : 0;
  const savedAt = typeof preset.savedAt === "number" && Number.isFinite(preset.savedAt) ? new Date(preset.savedAt) : new Date();

  if (!rawId || !symbol || !timeframe || !side || !quality) return null;

  return {
    preset_id: rawId.startsWith(`${market}:`) ? rawId : `${market}:${rawId}`,
    market,
    symbol,
    mode: typeof preset.mode === "string" ? preset.mode.slice(0, 16) : null,
    timeframe,
    side,
    quality,
    score,
    headline: headline || `${symbol} ${timeframe} ${side === "long" ? "상승" : "하락"} 감시`,
    saved_at: Number.isFinite(savedAt.getTime()) ? savedAt.toISOString() : new Date().toISOString()
  };
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "앱 푸시 알림 설정을 저장할 수 없습니다." }, { status: 503 });
  }

  const accessToken = bearerToken(request);
  if (!accessToken) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const entitlement = await getRequestEntitlement(request, "crypto");
  if (!entitlement.userId || !entitlement.isAuthenticated) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (entitlement.state === "deletion_pending") return NextResponse.json({ error: "계정 삭제 대기 중에는 알림 설정을 변경할 수 없습니다." }, { status: 409 });
  if (entitlement.state === "unavailable") return NextResponse.json({ error: "구독 권한을 확인하지 못해 알림 설정을 변경하지 않았습니다." }, { status: 503 });

  const limited = await rateLimit(request, {
    key: entitlementRateKey("push-token-register", entitlement),
    limit: 30,
    windowMs: 5 * 60 * 1000
  });
  if (!limited.allowed) return NextResponse.json({ error: "알림 설정 요청이 많습니다." }, { status: 429 });

  const parsed = await readJsonBodyLimited<PushTokenRequestBody>(request, 64_000);
  if (!parsed.ok && parsed.tooLarge) return NextResponse.json({ error: "알림 설정 요청이 너무 큽니다." }, { status: 413 });
  const body = parsed.ok ? parsed.value : {};
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const rawPlatform = typeof body.platform === "string" ? body.platform : "android";
  if (rawPlatform !== "android") {
    return NextResponse.json({ error: "현재 앱 푸시 알림만 지원합니다." }, { status: 400 });
  }
  const platform: PushPlatform = "android";

  const appId = typeof body.appId === "string" && body.appId.trim() ? body.appId.trim() : "com.staronlabs.chartradar";
  const markets = normalizePushMarkets(body.markets);
  const ruleIds = normalizePushRuleIds(body.ruleIds);
  const fallbackMarket = markets.includes("stocks") && !markets.includes("crypto") ? "stocks" : "crypto";
  const shouldSyncPresets = Array.isArray(body.presets);
  const presets = Array.isArray(body.presets)
    ? body.presets.map((item) => normalizePreset(item, fallbackMarket)).filter((item): item is NormalizedPushPreset => item !== null).slice(0, 60)
    : [];

  if (token.length < 20 || token.length > 4096) {
    return NextResponse.json({ error: "앱 푸시 알림 연결 정보가 올바르지 않습니다." }, { status: 400 });
  }

  const userId = entitlement.userId;
  const now = new Date().toISOString();
  const existingRows = await supabaseAdminRest<ExistingPushTokenRow[]>(
    `push_tokens?select=id,user_id,markets,rule_ids&token=eq.${encodeURIComponent(token)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`
  );
  const existing = existingRows[0] ?? null;
  const mergedMarkets = mergePushMarkets(existing?.markets, markets);
  const nextRuleIds = replaceScopedRuleIds(existing?.rule_ids, ruleIds, markets);

  const rows = await supabaseAdminRest<Array<{ id: string }>>("push_tokens?on_conflict=token", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: {
      user_id: userId,
      token,
      platform,
      provider: "fcm",
      app_id: appId,
      enabled: body.enabled !== false,
      markets: mergedMarkets,
      rule_ids: nextRuleIds,
      last_registered_at: now,
      last_seen_at: now
    }
  });

  if (shouldSyncPresets) {
    const marketsToSync = markets.length > 0 ? markets : [fallbackMarket];
    try {
      if (marketsToSync.includes("crypto") && isPerpetualRevenueCoreUserEnabled(userId)) {
        await supabaseAdminRpc("expire_perpetual_monitors", {
          p_evaluator_version: perpetualDecisionEngineVersion
        });
        await supabaseAdminRpc("reconcile_perpetual_monitor_limit", {
          p_user_id: userId,
          p_monitor_limit: cryptoAlertConditionLimit(entitlement.plan)
        });
        await supabaseAdminRpc("replace_crypto_push_presets", {
          p_user_id: userId,
          p_presets: presets.filter((preset) => preset.market === "crypto"),
          p_monitor_limit: cryptoAlertConditionLimit(entitlement.plan)
        });
      } else if (marketsToSync.includes("crypto")) {
        await supabaseAdminRest(`push_alert_presets?user_id=eq.${encodeURIComponent(userId)}&market=eq.crypto`, {
          method: "DELETE"
        });
      }
      if (marketsToSync.includes("stocks")) {
        await supabaseAdminRest(`push_alert_presets?user_id=eq.${encodeURIComponent(userId)}&market=eq.stocks`, {
          method: "DELETE"
        });
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("monitor_limit_reached")) {
        return NextResponse.json({
          error: "시나리오 감시와 기존 코인 알림을 합친 저장 한도를 초과했습니다.",
          code: "monitor_limit_reached",
          upgrade: { href: "/pro?market=crypto&source=alert-limit" }
        }, { status: 403 });
      }
      throw error;
    }
  }

  const directPresets = isPerpetualRevenueCoreUserEnabled(userId)
    ? presets.filter((preset) => preset.market === "stocks")
    : presets;
  if (directPresets.length > 0) {
    await supabaseAdminRest("push_alert_presets?on_conflict=user_id,preset_id", {
      method: "POST",
      prefer: "resolution=merge-duplicates",
      body: directPresets.map((preset) => ({
        user_id: userId,
        ...preset,
        enabled: true
      }))
    });
  }

  return NextResponse.json({ ok: true, id: rows[0]?.id ?? null, markets: mergedMarkets });
}

export async function DELETE(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "앱 푸시 알림 설정을 해제할 수 없습니다." }, { status: 503 });
  }

  const accessToken = bearerToken(request);
  if (!accessToken) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const entitlement = await getRequestEntitlement(request, "crypto");
  if (!entitlement.userId || !entitlement.isAuthenticated) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const limited = await rateLimit(request, {
    key: entitlementRateKey("push-token-delete", entitlement),
    limit: 30,
    windowMs: 5 * 60 * 1000
  });
  if (!limited.allowed) return NextResponse.json({ error: "알림 해제 요청이 많습니다." }, { status: 429 });

  const parsed = await readJsonBodyLimited<PushTokenRequestBody>(request, 8_192);
  if (!parsed.ok && parsed.tooLarge) return NextResponse.json({ error: "알림 해제 요청이 너무 큽니다." }, { status: 413 });
  const body = parsed.ok ? parsed.value : {};
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) return NextResponse.json({ error: "해제할 앱 푸시 알림 연결 정보가 없습니다." }, { status: 400 });
  const rawPlatform = typeof body.platform === "string" ? body.platform : "android";
  if (rawPlatform !== "android") {
    return NextResponse.json({ error: "현재 앱 푸시 알림만 해제할 수 있습니다." }, { status: 400 });
  }
  await supabaseAdminRest(`push_tokens?token=eq.${encodeURIComponent(token)}&user_id=eq.${encodeURIComponent(entitlement.userId)}&platform=eq.android&provider=eq.fcm`, {
    method: "PATCH",
    body: {
      enabled: false,
      last_seen_at: new Date().toISOString()
    }
  });

  return NextResponse.json({ ok: true });
}
