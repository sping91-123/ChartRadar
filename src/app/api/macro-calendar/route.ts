// 매크로 레이더가 사용할 경제 캘린더 데이터를 자동 갱신해 반환합니다.
import { NextResponse } from "next/server";
import { getMacroCalendarPayload, hasPendingActualRefreshWindow, withMacroCalendarDebug } from "@/lib/macroCalendar";
import { readStoredMacroCalendarPayload } from "@/lib/macro/server/macroStore";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0"
};

export async function GET(request: Request) {
  const limited = await rateLimit(request, {
    key: "macro-calendar",
    limit: 120,
    windowMs: 60_000
  });

  if (!limited.allowed) {
    return NextResponse.json({ error: "매크로 캘린더 요청이 잠시 많습니다.", retryAfter: limited.retryAfter }, { status: 429, headers: noStoreHeaders });
  }

  const url = new URL(request.url);
  const shouldBypassCache = url.searchParams.get("refresh") === "1" || url.searchParams.has("ts");
  const storedPayload = shouldBypassCache ? null : await readStoredMacroCalendarPayload().catch(() => null);
  const shouldRefreshActuals = storedPayload ? hasPendingActualRefreshWindow(storedPayload) : false;
  const payload =
    storedPayload && !shouldRefreshActuals
      ? withMacroCalendarDebug(storedPayload, "stored-cache")
      : await getMacroCalendarPayload({ bypassCache: shouldBypassCache || shouldRefreshActuals });

  return NextResponse.json(payload, { headers: noStoreHeaders });
}
