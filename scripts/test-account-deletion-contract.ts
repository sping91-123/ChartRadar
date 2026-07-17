import assert from "node:assert/strict";
import { normalizeAccountDeletionRequest } from "../src/lib/accountDeletionContract";

assert.equal(normalizeAccountDeletionRequest(undefined), null);
assert.deepEqual(
  normalizeAccountDeletionRequest({
    request_id: "00000000-0000-4000-8000-000000000001",
    request_status: "pending",
    requested_at: "2026-07-17T00:00:00.000Z",
    process_after: "2026-07-24T00:00:00.000Z"
  }),
  {
    id: "00000000-0000-4000-8000-000000000001",
    status: "pending",
    requested_at: "2026-07-17T00:00:00.000Z",
    process_after: "2026-07-24T00:00:00.000Z",
    completed_at: null
  }
);

console.log("Account deletion API contract mapping passed.");
