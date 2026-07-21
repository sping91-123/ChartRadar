import { NextResponse } from "next/server";
import { runNewsImpactSync } from "@/lib/server/news/newsImpactSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, {
      status: 401,
      headers: { "Cache-Control": "private, no-store, max-age=0" }
    });
  }
  const result = await runNewsImpactSync();
  const status = result.status === "unconfigured" ? 503 : result.status === "failed" ? 500 : 200;
  return NextResponse.json({ ok: status === 200, ...result }, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" }
  });
}
