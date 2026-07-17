import { revokeAppleAuthorization } from "@/lib/server/appleAuth";
import { supabaseAdminAuth, supabaseAdminRest, supabaseAdminRpc } from "@/lib/server/supabaseAdmin";

export const accountDeletionRequestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const externalTimeoutMs = 10_000;
const processingLeaseMs = 15 * 60 * 1000;

export interface AccountDeletionQueueRow {
  id: string;
  user_id: string;
  status: "pending" | "processing" | "failed";
  requested_at: string;
  process_after: string;
  started_at: string | null;
  next_attempt_at: string | null;
  attempt_count: number;
  last_error: string | null;
}

export function isAccountDeletionProcessingEnabled() {
  return process.env.ACCOUNT_DELETION_PROCESSING_ENABLED === "true";
}

export async function listProcessableAccountDeletions(limit = 10) {
  const rows = await supabaseAdminRest<AccountDeletionQueueRow[]>(
    "account_deletion_requests?select=id,user_id,status,requested_at,process_after,started_at,next_attempt_at,attempt_count,last_error&status=in.(pending,processing,failed)&order=process_after.asc&limit=100",
    { timeoutMs: externalTimeoutMs }
  );
  const staleBefore = Date.now() - processingLeaseMs;
  return rows
    .filter((row) => {
      if (row.status === "processing") {
        return row.started_at !== null && Date.parse(row.started_at) < staleBefore;
      }
      if (row.status === "failed" && row.next_attempt_at !== null) {
        return Date.parse(row.next_attempt_at) <= Date.now();
      }
      return true;
    })
    .slice(0, Math.max(1, Math.min(25, limit)));
}

async function deleteRevenueCatCustomer(userId: string) {
  const apiKey = process.env.REVENUECAT_REST_API_KEY ?? "";
  if (!apiKey) throw new Error("RevenueCat secret API key is missing.");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), externalTimeoutMs);
  try {
    const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`RevenueCat customer deletion failed (${response.status}).`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

export type AccountDeletionProcessResult =
  | { status: "completed"; requestId: string }
  | { status: "not_started"; requestId: string }
  | { status: "failed"; requestId: string };

export async function processAccountDeletionRequest(requestId: string): Promise<AccountDeletionProcessResult> {
  if (!accountDeletionRequestIdPattern.test(requestId)) {
    throw new Error("Invalid account deletion request id.");
  }

  let started: Array<{ user_id: string; request_status: string }>;
  try {
    started = await supabaseAdminRpc<Array<{ user_id: string; request_status: string }>>(
      "start_account_deletion",
      { p_request_id: requestId },
      { timeoutMs: externalTimeoutMs }
    );
  } catch (error) {
    console.error("[account-deletion] lease acquisition failed", { requestId, error: error instanceof Error ? error.message : "unknown" });
    return { status: "failed", requestId };
  }

  const userId = started[0]?.user_id;
  if (!userId) return { status: "not_started", requestId };

  try {
    await revokeAppleAuthorization(userId);
    await deleteRevenueCatCustomer(userId);
    await supabaseAdminRpc("purge_account_application_data", { p_user_id: userId }, { timeoutMs: externalTimeoutMs });
    await supabaseAdminAuth(`admin/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      timeoutMs: externalTimeoutMs,
      allowNotFound: true
    });
    return { status: "completed", requestId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Account deletion failed.";
    await supabaseAdminRpc(
      "fail_account_deletion",
      { p_request_id: requestId, p_error: message },
      { timeoutMs: externalTimeoutMs }
    ).catch(() => undefined);
    console.error("[account-deletion] processing failed", { requestId, error: message });
    return { status: "failed", requestId };
  }
}
