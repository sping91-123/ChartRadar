// 로그인 세션을 API 요청 헤더에 조용히 붙이는 브라우저 헬퍼입니다.
import { getActiveSupabaseSession } from "@/lib/supabase";

export async function withSupabaseAuth(init: RequestInit = {}): Promise<RequestInit> {
  const session = await getActiveSupabaseSession();
  if (!session?.accessToken) return init;

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.accessToken}`);

  return {
    ...init,
    headers
  };
}
