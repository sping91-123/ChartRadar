import { NextResponse } from "next/server";
import {
  isAccountDeletionProcessingEnabled,
  listProcessableAccountDeletions,
  processAccountDeletionRequest
} from "@/lib/server/accountDeletion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAccountDeletionProcessingEnabled()) {
    return NextResponse.json({ error: "Account deletion processing is disabled." }, { status: 503 });
  }

  try {
    const requests = await listProcessableAccountDeletions(5);
    const results = [];
    for (const deletionRequest of requests) {
      results.push(await processAccountDeletionRequest(deletionRequest.id));
    }
    return NextResponse.json({
      ok: true,
      processed: results.length,
      completed: results.filter((result) => result.status === "completed").length,
      failed: results.filter((result) => result.status === "failed").length,
      skipped: results.filter((result) => result.status === "not_started").length
    });
  } catch {
    return NextResponse.json({ error: "Account deletion queue processing failed." }, { status: 503 });
  }
}
