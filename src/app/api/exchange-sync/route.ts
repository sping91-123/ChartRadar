import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { claimDueExchangeConnections } from "@/lib/server/exchangeConnectionStore";
import {
  assertExchangeMutationConfiguration,
  exchangeCronAllowedUserIds,
  ExchangeJournalConfigurationError,
  exchangeSyncBatchSize,
  exchangeSyncConcurrency,
  isExchangeJournalMutationEnabled
} from "@/lib/server/exchangeJournalConfig";
import { assertExchangeOperationalControlEnabled } from "@/lib/server/exchangeOperationalControl";
import { syncExchangeConnection } from "@/lib/server/exchangeSync";
import { isSupabaseAdminConfigured } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 240;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isExchangeJournalMutationEnabled() || !isSupabaseAdminConfigured()) {
    return NextResponse.json({ processed: 0, skipped: true });
  }
  try {
    assertExchangeMutationConfiguration();
    await assertExchangeOperationalControlEnabled();
  } catch (error) {
    const reason = error instanceof ExchangeJournalConfigurationError
      ? error.code
      : "configuration_incomplete";
    return NextResponse.json({ processed: 0, skipped: true, reason });
  }
  try {
    const leaseToken = randomUUID();
    const batchSize = exchangeSyncBatchSize();
    const concurrency = Math.min(exchangeSyncConcurrency(), batchSize);
    const due = await claimDueExchangeConnections(batchSize, leaseToken, exchangeCronAllowedUserIds());
    const results: Array<PromiseSettledResult<Awaited<ReturnType<typeof syncExchangeConnection>>>> = [];
    for (let offset = 0; offset < due.length; offset += concurrency) {
      const batch = due.slice(offset, offset + concurrency);
      results.push(...await Promise.allSettled(
        batch.map((connection) =>
          syncExchangeConnection(connection.user_id, connection.id, {
            leaseToken,
            alreadyClaimed: true
          })
        )
      ));
    }
    const summary = {
      claimed: due.length,
      processed: results.length,
      ready: results.filter((result) => result.status === "fulfilled" && result.value.status === "ready").length,
      partial: results.filter((result) => result.status === "fulfilled" && result.value.status === "partial").length,
      failed: results.filter((result) => result.status === "rejected").length
    };
    console.info("[exchange-sync] cron completed", summary);
    return NextResponse.json(summary);
  } catch {
    console.error("[exchange-sync] cron failed before completion");
    return NextResponse.json({ processed: 0, failed: 1 }, { status: 503 });
  }
}
