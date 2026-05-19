// Android 앱 푸시 토큰을 로그인 사용자 계정에 연결합니다.
import { NextResponse } from "next/server";
import { fetchSupabaseUserOnServer, isSupabaseAdminConfigured, supabaseAdminRest } from "@/lib/server/supabaseAdmin";

type PushPlatform = "android" | "ios" | "web";

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
  market: "crypto" | "stocks";
  symbol: string;
  mode: string | null;
  timeframe: string;
  side: "long" | "short";
  quality: "A" | "B" | "C";
  score: number;
  headline: string;
  saved_at: string;
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

function normalizePreset(item: unknown, fallbackMarket: "crypto" | "stocks"): NormalizedPushPreset | null {
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
    return NextResponse.json({ error: "Supabase 관리자 환경변수가 없어 앱 푸시 토큰을 저장할 수 없습니다." }, { status: 503 });
  }

  const accessToken = bearerToken(request);
  if (!accessToken) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as PushTokenRequestBody;
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const platform = body.platform === "android" || body.platform === "ios" || body.platform === "web" ? body.platform : "android";
  const appId = typeof body.appId === "string" && body.appId.trim() ? body.appId.trim() : "com.staronlabs.chartradar";
  const markets = normalizeStringList(body.markets, new Set(["crypto", "stocks"]));
  const ruleIds = normalizeStringList(body.ruleIds);
  const fallbackMarket = markets.includes("stocks") && !markets.includes("crypto") ? "stocks" : "crypto";
  const shouldSyncPresets = Array.isArray(body.presets);
  const presets = Array.isArray(body.presets)
    ? body.presets.map((item) => normalizePreset(item, fallbackMarket)).filter((item): item is NormalizedPushPreset => item !== null).slice(0, 60)
    : [];

  if (token.length < 20 || token.length > 4096) {
    return NextResponse.json({ error: "앱 푸시 토큰 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const user = await fetchSupabaseUserOnServer(accessToken);
  const now = new Date().toISOString();

  const rows = await supabaseAdminRest<Array<{ id: string }>>("push_tokens?on_conflict=token", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: {
      user_id: user.id,
      token,
      platform,
      provider: platform === "android" ? "fcm" : "apns",
      app_id: appId,
      enabled: body.enabled !== false,
      markets,
      rule_ids: ruleIds,
      last_registered_at: now,
      last_seen_at: now
    }
  });

  if (shouldSyncPresets) {
    const marketsToSync = markets.length > 0 ? markets : [fallbackMarket];
    await Promise.all(
      marketsToSync.map((market) =>
        supabaseAdminRest(`push_alert_presets?user_id=eq.${encodeURIComponent(user.id)}&market=eq.${market}`, {
          method: "DELETE"
        })
      )
    );
  }

  if (presets.length > 0) {
    await supabaseAdminRest("push_alert_presets?on_conflict=user_id,preset_id", {
      method: "POST",
      prefer: "resolution=merge-duplicates",
      body: presets.map((preset) => ({
        user_id: user.id,
        ...preset,
        enabled: true
      }))
    });
  }

  return NextResponse.json({ ok: true, id: rows[0]?.id ?? null });
}

export async function DELETE(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "Supabase 관리자 환경변수가 없어 앱 푸시 토큰을 해제할 수 없습니다." }, { status: 503 });
  }

  const accessToken = bearerToken(request);
  if (!accessToken) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as PushTokenRequestBody;
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) return NextResponse.json({ error: "해제할 앱 푸시 토큰이 없습니다." }, { status: 400 });

  const user = await fetchSupabaseUserOnServer(accessToken);
  await supabaseAdminRest(`push_tokens?token=eq.${encodeURIComponent(token)}&user_id=eq.${encodeURIComponent(user.id)}`, {
    method: "PATCH",
    body: {
      enabled: false,
      last_seen_at: new Date().toISOString()
    }
  });

  return NextResponse.json({ ok: true });
}
