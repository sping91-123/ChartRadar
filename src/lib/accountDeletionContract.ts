export interface AccountDeletionRequestRpcRow {
  request_id: string;
  request_status: "pending" | "processing" | "failed";
  requested_at: string;
  process_after: string;
}

export interface AccountDeletionRequestView {
  id: string;
  status: AccountDeletionRequestRpcRow["request_status"];
  requested_at: string;
  process_after: string;
  completed_at: null;
}

export function normalizeAccountDeletionRequest(
  row: AccountDeletionRequestRpcRow | undefined
): AccountDeletionRequestView | null {
  if (!row) return null;
  return {
    id: row.request_id,
    status: row.request_status,
    requested_at: row.requested_at,
    process_after: row.process_after,
    completed_at: null
  };
}
