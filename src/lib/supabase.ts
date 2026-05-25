// Supabase 로그인 세션과 REST 호출을 관리합니다.
import type { BillingEntitlementPlan } from "@/lib/billing";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const googleOAuthClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
export const kakaoRestApiKey = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY ?? "";

export const supabaseSessionStorageKey = "chartRadar.supabase.session";
export const supabaseAuthRefreshEvent = "chartRadar.supabase.authRefresh";
const legacyUntitledRiskSupabaseSessionStorageKey = "untitledRisk.supabase.session";
const legacyPreviousBrandSupabaseSessionStorageKey = `${"position"}${"guard"}.supabase.session`;
const legacySupabaseSessionStorageKey = "co" + "ters.supabase.session";
const allowLocalRefreshToken = process.env.NEXT_PUBLIC_ALLOW_LOCAL_REFRESH_TOKEN !== "false";

export interface SupabaseSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
}

export interface SupabaseUser {
  id: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string;
  email_confirmed_at?: string;
  app_metadata?: {
    plan?: BillingEntitlementPlan | string;
    provider?: string;
    providers?: string[];
    role?: string;
    market_scope?: string;
    [key: string]: unknown;
  };
  user_metadata?: {
    name?: string;
    full_name?: string;
    nickname?: string;
    preferred_username?: string;
    avatar_url?: string;
    picture?: string;
  };
}

export interface SupabaseProfile {
  id: string;
  email: null | string;
  display_name: null | string;
  avatar_url: null | string;
  plan: BillingEntitlementPlan;
  created_at: string;
  updated_at: string;
}

export interface SupabaseSubscription {
  id: string;
  user_id: string;
  provider: string | null;
  status: string | null;
  plan: BillingEntitlementPlan;
  market_scope: "trial" | "crypto" | "stocks" | "bundle" | null;
  current_period_start: string | null;
  current_period_end: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  provider_order_id: string | null;
  created_at: string;
  updated_at: string;
}

type SupabaseProfileRow = Omit<SupabaseProfile, "plan" | "updated_at"> & {
  email?: string | null;
  plan?: BillingEntitlementPlan;
  membership_tier?: BillingEntitlementPlan;
  updated_at?: string | null;
};

type SupabaseSubscriptionRow = Omit<SupabaseSubscription, "plan" | "market_scope" | "updated_at"> & {
  plan?: BillingEntitlementPlan;
  tier?: BillingEntitlementPlan;
  market_scope?: SupabaseSubscription["market_scope"];
  current_period_start?: string | null;
  provider_customer_id?: string | null;
  provider_order_id?: string | null;
  updated_at?: string | null;
};

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabasePublishableKey);
}

export function isGoogleOAuthConfigured() {
  return Boolean(isSupabaseConfigured() && googleOAuthClientId);
}

export function isKakaoOAuthConfigured() {
  return Boolean(isSupabaseConfigured() && kakaoRestApiKey);
}

export function parseSessionFromHash(hash: string): SupabaseSession | null {
  const cleanHash = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(cleanHash);
  const accessToken = params.get("access_token");
  if (!accessToken) return null;

  const expiresIn = Number(params.get("expires_in") ?? 0);
  const expiresAt = expiresIn ? Math.floor(Date.now() / 1000) + expiresIn : undefined;

  return {
    accessToken,
    refreshToken: params.get("refresh_token") ?? undefined,
    expiresAt,
    tokenType: params.get("token_type") ?? undefined
  };
}

export function saveSupabaseSession(session: SupabaseSession) {
  if (typeof window === "undefined") return;
  const persistedSession: SupabaseSession = allowLocalRefreshToken
    ? session
    : {
        accessToken: session.accessToken,
        expiresAt: session.expiresAt,
        tokenType: session.tokenType
      };
  window.localStorage.setItem(supabaseSessionStorageKey, JSON.stringify(persistedSession));
  window.localStorage.removeItem(legacyUntitledRiskSupabaseSessionStorageKey);
  window.localStorage.removeItem(legacyPreviousBrandSupabaseSessionStorageKey);
  window.localStorage.removeItem(legacySupabaseSessionStorageKey);
}

export function getSupabaseSession(): SupabaseSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw =
      window.localStorage.getItem(supabaseSessionStorageKey) ??
      window.localStorage.getItem(legacyUntitledRiskSupabaseSessionStorageKey) ??
      window.localStorage.getItem(legacyPreviousBrandSupabaseSessionStorageKey) ??
      window.localStorage.getItem(legacySupabaseSessionStorageKey);
    if (!raw) return null;
    window.localStorage.setItem(supabaseSessionStorageKey, raw);
    window.localStorage.removeItem(legacyUntitledRiskSupabaseSessionStorageKey);
    window.localStorage.removeItem(legacyPreviousBrandSupabaseSessionStorageKey);
    window.localStorage.removeItem(legacySupabaseSessionStorageKey);
    const session = JSON.parse(raw) as SupabaseSession;
    if (!session.accessToken) return null;
    if (!allowLocalRefreshToken && session.refreshToken) {
      delete session.refreshToken;
      window.localStorage.setItem(supabaseSessionStorageKey, JSON.stringify(session));
    }
    if (session.expiresAt && session.expiresAt < Math.floor(Date.now() / 1000)) {
      if (session.refreshToken) return session;
      clearSupabaseSession();
      return null;
    }
    return session;
  } catch {
    clearSupabaseSession();
    return null;
  }
}

export async function getActiveSupabaseSession(): Promise<SupabaseSession | null> {
  const session = getSupabaseSession();
  if (!session) return null;

  const now = Math.floor(Date.now() / 1000);
  if (session.expiresAt && session.expiresAt <= now) {
    return refreshSupabaseSession(session);
  }

  return session;
}

export function clearSupabaseSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(supabaseSessionStorageKey);
  window.localStorage.removeItem(legacyUntitledRiskSupabaseSessionStorageKey);
  window.localStorage.removeItem(legacyPreviousBrandSupabaseSessionStorageKey);
  window.localStorage.removeItem(legacySupabaseSessionStorageKey);
}

export async function refreshSupabaseSession(session: SupabaseSession): Promise<SupabaseSession | null> {
  if (!isSupabaseConfigured() || !session.refreshToken) return null;

  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: supabasePublishableKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ refresh_token: session.refreshToken })
  });

  if (!response.ok) {
    clearSupabaseSession();
    return null;
  }

  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  };

  if (!payload.access_token) {
    clearSupabaseSession();
    return null;
  }

  const nextSession: SupabaseSession = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? session.refreshToken,
    expiresAt: payload.expires_in ? Math.floor(Date.now() / 1000) + payload.expires_in : undefined,
    tokenType: payload.token_type
  };

  saveSupabaseSession(nextSession);
  return nextSession;
}

export async function exchangeGoogleIdToken(idToken: string, nonce: string): Promise<SupabaseSession> {
  if (!isSupabaseConfigured()) throw new Error("로그인을 잠시 사용할 수 없습니다.");
  if (!idToken) throw new Error("Google 로그인 정보를 받지 못했습니다.");

  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=id_token`, {
    method: "POST",
    headers: {
      apikey: supabasePublishableKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      provider: "google",
      id_token: idToken,
      nonce
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Google 로그인 처리에 실패했습니다.");
  }

  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  };

  if (!payload.access_token) throw new Error("Supabase 세션을 만들지 못했습니다.");

  const nextSession: SupabaseSession = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: payload.expires_in ? Math.floor(Date.now() / 1000) + payload.expires_in : undefined,
    tokenType: payload.token_type
  };

  saveSupabaseSession(nextSession);
  return nextSession;
}

export async function fetchSupabaseUser(accessToken: string) {
  if (!isSupabaseConfigured()) throw new Error("로그인을 잠시 사용할 수 없습니다.");

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) throw new Error("로그인 정보를 다시 확인하지 못했습니다.");
  return (await response.json()) as SupabaseUser;
}

export async function fetchSupabaseProfile(accessToken: string) {
  const user = await fetchSupabaseUser(accessToken);
  const rows = await supabaseRest<SupabaseProfileRow[]>(
    `profiles?select=*&id=eq.${encodeURIComponent(user.id)}&limit=1`,
    { accessToken }
  );

  const profile = rows[0];
  if (!profile) return null;

  const now = new Date().toISOString();
  return {
    id: profile.id,
    email: profile.email ?? user.email ?? null,
    display_name: profile.display_name ?? null,
    avatar_url: profile.avatar_url ?? null,
    plan: profile.plan ?? profile.membership_tier ?? "free",
    created_at: profile.created_at ?? now,
    updated_at: profile.updated_at ?? profile.created_at ?? now
  } satisfies SupabaseProfile;
}

export async function fetchSupabaseActiveSubscriptions(accessToken: string, userId?: string) {
  const user = userId ? null : await fetchSupabaseUser(accessToken);
  const resolvedUserId = userId ?? user?.id;
  if (!resolvedUserId) return [];

  const now = encodeURIComponent(new Date().toISOString());
  const rows = await supabaseRest<SupabaseSubscriptionRow[]>(
    `subscriptions?select=*&user_id=eq.${encodeURIComponent(resolvedUserId)}&status=in.(active,trialing)&current_period_end=gt.${now}&order=current_period_end.desc`,
    { accessToken }
  );

  return rows.map((subscription) => ({
    id: subscription.id,
    user_id: subscription.user_id,
    provider: subscription.provider ?? null,
    status: subscription.status ?? null,
    plan: subscription.plan ?? subscription.tier ?? "free",
    market_scope: subscription.market_scope ?? null,
    current_period_start: subscription.current_period_start ?? null,
    current_period_end: subscription.current_period_end ?? null,
    provider_customer_id: subscription.provider_customer_id ?? null,
    provider_subscription_id: subscription.provider_subscription_id ?? null,
    provider_order_id: subscription.provider_order_id ?? null,
    created_at: subscription.created_at,
    updated_at: subscription.updated_at ?? subscription.created_at
  }));
}

export async function supabaseRest<T>(
  path: string,
  options: {
    accessToken?: string;
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    prefer?: string;
  } = {}
) {
  if (!isSupabaseConfigured()) throw new Error("로그인을 잠시 사용할 수 없습니다.");

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: options.method ?? "GET",
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${options.accessToken ?? supabasePublishableKey}`,
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "요청에 실패했습니다.");
  }

  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}
