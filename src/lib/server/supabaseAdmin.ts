// 서버에서 결제 권한을 반영할 때만 사용하는 Supabase 관리자 REST 클라이언트입니다.
import { collectPaginatedRows } from "@/lib/pagination";
import { supabasePublishableKey, supabaseUrl, type SupabaseUser } from "@/lib/supabase";

const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const restTableColumnsCache = new Map<string, Set<string>>();

async function fetchWithOptionalTimeout(url: string, init: RequestInit, timeoutMs?: number) {
  if (!timeoutMs) return fetch(url, init);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export function isSupabaseAdminConfigured() {
  return Boolean(supabaseUrl && supabaseServiceRoleKey);
}

async function readJsonOrNull<T>(response: Response) {
  const text = await response.text();
  if (!text.trim()) return null as T;
  return JSON.parse(text) as T;
}

export async function fetchSupabaseUserOnServer(accessToken: string) {
  if (!supabaseUrl || !supabasePublishableKey) throw new Error("Supabase 환경변수가 설정되지 않았습니다.");

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) throw new Error("로그인 정보를 확인하지 못했습니다.");
  const user = await readJsonOrNull<SupabaseUser>(response);
  if (!user) throw new Error("濡쒓렇???뺣낫瑜??뺤씤?섏? 紐삵뻽?듬땲??");
  return user;
}

export async function supabaseAdminRest<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    prefer?: string;
    timeoutMs?: number;
  } = {}
) {
  if (!isSupabaseAdminConfigured()) throw new Error("Supabase service role key가 설정되지 않았습니다.");

  const response = await fetchWithOptionalTimeout(`${supabaseUrl}/rest/v1/${path}`, {
    method: options.method ?? "GET",
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store"
  }, options.timeoutMs);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Supabase 관리자 요청에 실패했습니다.");
  }

  if (response.status === 204) return null as T;
  return readJsonOrNull<T>(response);
}

export async function supabaseAdminRestAll<T>(path: string, pageSize = 500): Promise<T[]> {
  const separator = path.includes("?") ? "&" : "?";
  return collectPaginatedRows<T>(
    (offset, limit) => supabaseAdminRest<T[]>(`${path}${separator}limit=${limit}&offset=${offset}`),
    pageSize
  );
}

export async function supabaseAdminRpc<T>(
  functionName: string,
  body: Record<string, unknown>,
  options: { timeoutMs?: number } = {}
) {
  if (!/^[a-z][a-z0-9_]*$/.test(functionName)) throw new Error("Invalid Supabase RPC name.");
  return supabaseAdminRest<T>(`rpc/${functionName}`, { method: "POST", body, timeoutMs: options.timeoutMs });
}

export async function supabaseAdminAuth<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    timeoutMs?: number;
    allowNotFound?: boolean;
  } = {}
) {
  if (!isSupabaseAdminConfigured()) throw new Error("Supabase service role key가 설정되지 않았습니다.");

  const response = await fetchWithOptionalTimeout(`${supabaseUrl}/auth/v1/${path}`, {
    method: options.method ?? "GET",
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      "Content-Type": "application/json"
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store"
  }, options.timeoutMs);

  if (options.allowNotFound && response.status === 404) return null as T;
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Supabase Auth 관리자 요청에 실패했습니다.");
  }

  if (response.status === 204) return null as T;
  return readJsonOrNull<T>(response);
}

export async function getSupabaseRestTableColumns(table: string) {
  const cached = restTableColumnsCache.get(table);
  if (cached) return cached;
  if (!isSupabaseAdminConfigured()) throw new Error("Supabase service role key媛 ?ㅼ젙?섏? ?딆븯?듬땲??");

  const response = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Supabase REST ?ㅽ궎留덈? 遺덈윭?ㅼ? 紐삵뻽?듬땲??");
  }

  const payload = (await response.json()) as {
    definitions?: Record<string, { properties?: Record<string, unknown> }>;
    components?: { schemas?: Record<string, { properties?: Record<string, unknown> }> };
  };
  const properties = payload.definitions?.[table]?.properties ?? payload.components?.schemas?.[table]?.properties ?? {};
  const columns = new Set(Object.keys(properties));
  restTableColumnsCache.set(table, columns);
  return columns;
}

export async function listSupabaseAuthUsers(limit = 500) {
  const perPage = 100;
  const users: SupabaseUser[] = [];

  for (let page = 1; users.length < limit; page += 1) {
    const payload = await supabaseAdminAuth<{ users?: SupabaseUser[] }>(`admin/users?page=${page}&per_page=${perPage}`);
    const nextUsers = payload.users ?? [];
    users.push(...nextUsers);
    if (nextUsers.length < perPage) break;
  }

  return users.slice(0, limit);
}
