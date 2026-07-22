// 매크로 레이더가 사용할 경제 캘린더 데이터를 자동 갱신해 반환합니다.
import { NextResponse } from "next/server";
import {
  getMacroCalendarFallbackPayload,
  getMacroCalendarPayload,
  hasPendingActualRefreshWindow,
  type MacroCalendarPayload,
  withMacroCalendarDebug
} from "@/lib/macroCalendar";
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

const MACRO_ROUTE_FALLBACK_TIMEOUT_MS = 4_500;

async function liveCalendarWithDeadline(options: { bypassCache: boolean; lastKnown?: MacroCalendarPayload | null }) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<MacroCalendarPayload>((resolve) => {
    timer = setTimeout(() => {
      if (options.lastKnown) {
        resolve({
          ...withMacroCalendarDebug(options.lastKnown, "stored-cache"),
          isStale: true,
          warning: "공식 발표값 갱신이 지연되어 마지막 정상 일정을 유지합니다."
        });
        return;
      }
      resolve({
        ...withMacroCalendarDebug(getMacroCalendarFallbackPayload(), "fallback"),
        warning: "공식 일정 갱신이 지연되어 예비 일정을 먼저 표시합니다."
      });
    }, MACRO_ROUTE_FALLBACK_TIMEOUT_MS);
  });

  try {
    return await Promise.race([getMacroCalendarPayload(options), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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
  const storedPayload = await readStoredMacroCalendarPayload({ allowStale: true }).catch(() => null);
  const shouldRefreshActuals = storedPayload ? hasPendingActualRefreshWindow(storedPayload) : false;
  const canUseStoredPayload = Boolean(storedPayload && !storedPayload.isStale && !shouldBypassCache && !shouldRefreshActuals);
  const payload =
    storedPayload && canUseStoredPayload
      ? withMacroCalendarDebug(storedPayload, "stored-cache")
      : await liveCalendarWithDeadline({
          bypassCache: shouldBypassCache || shouldRefreshActuals || Boolean(storedPayload?.isStale),
          lastKnown: storedPayload
        });

  return NextResponse.json(payload, { headers: noStoreHeaders });
}
