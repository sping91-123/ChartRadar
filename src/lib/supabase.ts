export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const supabaseSessionStorageKey = "coters.supabase.session";

export interface SupabaseSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
  providerToken?: string;
}

export interface SupabaseUser {
  id: string;
  email?: string;
  user_metadata?: {
    name?: string;
    full_name?: string;
    avatar_url?: string;
    picture?: string;
  };
}

export interface SupabaseProfile {
  id: string;
  email: null | string;
  display_name: null | string;
  avatar_url: null | string;
  plan: "free" | "member" | "premium" | "admin";
  created_at: string;
  updated_at: string;
}

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabasePublishableKey);
}

export function getOAuthUrl(provider: "google" | "kakao", redirectPath = "/auth/callback") {
  if (!isSupabaseConfigured() || typeof window === "undefined") return "";

  const redirectTo = new URL(redirectPath, window.location.origin).toString();
  const params = new URLSearchParams({
    provider,
    redirect_to: redirectTo
  });

  return `${supabaseUrl}/auth/v1/authorize?${params.toString()}`;
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
    tokenType: params.get("token_type") ?? undefined,
    providerToken: params.get("provider_token") ?? undefined
  };
}

export function saveSupabaseSession(session: SupabaseSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(supabaseSessionStorageKey, JSON.stringify(session));
}

export function getSupabaseSession(): SupabaseSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(supabaseSessionStorageKey);
    if (!raw) return null;
    const session = JSON.parse(raw) as SupabaseSession;
    if (!session.accessToken) return null;
    if (session.expiresAt && session.expiresAt < Math.floor(Date.now() / 1000)) {
      clearSupabaseSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearSupabaseSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(supabaseSessionStorageKey);
}

export async function fetchSupabaseUser(accessToken: string) {
  if (!isSupabaseConfigured()) throw new Error("Supabase 환경 변수가 설정되지 않았습니다.");

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) throw new Error("로그인 정보를 불러오지 못했습니다.");
  return (await response.json()) as SupabaseUser;
}

export async function fetchSupabaseProfile(accessToken: string) {
  const user = await fetchSupabaseUser(accessToken);
  const rows = await supabaseRest<SupabaseProfile[]>(
    `profiles?select=*&id=eq.${encodeURIComponent(user.id)}&limit=1`,
    { accessToken }
  );

  return rows[0] ?? null;
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
  if (!isSupabaseConfigured()) throw new Error("Supabase 환경 변수가 설정되지 않았습니다.");

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
    throw new Error(text || "Supabase 요청에 실패했습니다.");
  }

  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}
