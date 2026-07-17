import { randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

const gate = process.argv.find((argument) => argument.startsWith("--gate="))?.split("=")[1];
if (gate !== "a" && gate !== "b" && gate !== "c" && gate !== "d") {
  throw new Error("Use --gate=a, --gate=b, --gate=c, or --gate=d.");
}

const expectedProjectRef = "dbdouafktptajamanyno";
const confirmedProjectRef = process.argv
  .find((argument) => argument.startsWith("--confirm-project="))
  ?.split("=")[1];
if (confirmedProjectRef !== expectedProjectRef) {
  throw new Error(`Use --confirm-project=${expectedProjectRef} to confirm the production target.`);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
  throw new Error("Supabase URL, publishable key, and service-role key are required.");
}
if (new URL(supabaseUrl).hostname !== `${expectedProjectRef}.supabase.co`) {
  throw new Error("Configured Supabase URL does not match the confirmed production project.");
}

const email = `gate-${gate}-${randomUUID()}@example.com`;
const password = `${randomBytes(24).toString("base64url")}aA1!`;
let userId = "";
let otherUserId = "";
let accessToken = "";

async function request(path, { key, token = key, method = "GET", body } = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      Prefer: "return=representation"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Empty responses are valid for DELETE and 204 mutations.
  }
  return { response, payload };
}

function assertOk(result, label) {
  if (!result.response.ok) {
    const code = result.payload?.code ?? result.payload?.error_code ?? "unknown";
    throw new Error(`${label} failed with HTTP ${result.response.status} (${code}).`);
  }
}

async function createDisposableUser() {
  const created = await request("/auth/v1/admin/users", {
    key: serviceRoleKey,
    method: "POST",
    body: {
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: `Gate ${gate.toUpperCase()} verification` }
    }
  });
  assertOk(created, "Disposable user creation");
  userId = created.payload?.id ?? "";
  if (!userId) throw new Error("Disposable user response did not include an ID.");

  const signedIn = await request("/auth/v1/token?grant_type=password", {
    key: publishableKey,
    token: publishableKey,
    method: "POST",
    body: { email, password }
  });
  assertOk(signedIn, "Disposable user sign-in");
  accessToken = signedIn.payload?.access_token ?? "";
  if (!accessToken) throw new Error("Disposable sign-in did not return an access token.");
}

async function verifyGateA() {
  const ownProfile = await request(
    `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,membership_tier,display_name`,
    { key: publishableKey, token: accessToken }
  );
  assertOk(ownProfile, "Authenticated own-profile SELECT");
  if (ownProfile.payload?.length !== 1 || ownProfile.payload[0]?.membership_tier !== "free") {
    throw new Error("Signup trigger did not create exactly one free profile.");
  }

  const selfUpgrade = await request(
    `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
    {
      key: publishableKey,
      token: accessToken,
      method: "PATCH",
      body: { membership_tier: "premium" }
    }
  );
  if (selfUpgrade.response.ok && selfUpgrade.payload?.length) {
    throw new Error("Authenticated self-upgrade unexpectedly changed a profile.");
  }

  const unchanged = await request(
    `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=membership_tier`,
    { key: serviceRoleKey }
  );
  assertOk(unchanged, "Service-role profile verification");
  if (unchanged.payload?.length !== 1 || unchanged.payload[0]?.membership_tier !== "free") {
    throw new Error("Disposable profile tier changed during the self-upgrade test.");
  }

  const serviceUpdate = await request(
    `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
    {
      key: serviceRoleKey,
      method: "PATCH",
      body: { display_name: "Gate A disposable verification" }
    }
  );
  assertOk(serviceUpdate, "Service-role profile UPDATE");

  console.log("PASS disposable signup trigger created a free profile.");
  console.log(`PASS authenticated self-upgrade was denied (HTTP ${selfUpgrade.response.status}).`);
  console.log("PASS service-role profile UPDATE remained available.");
}

async function verifyGateB() {
  const anonRead = await request("/rest/v1/signals?select=id&limit=1", {
    key: publishableKey,
    token: publishableKey
  });
  if (anonRead.response.ok) throw new Error("Anonymous signal SELECT unexpectedly succeeded.");

  const authenticatedRead = await request("/rest/v1/signals?select=id&limit=1", {
    key: publishableKey,
    token: accessToken
  });
  if (authenticatedRead.response.ok) {
    throw new Error("Authenticated signal SELECT unexpectedly succeeded.");
  }

  const authenticatedDelete = await request(
    "/rest/v1/signals?id=eq.00000000-0000-0000-0000-000000000000",
    { key: publishableKey, token: accessToken, method: "DELETE" }
  );
  if (authenticatedDelete.response.ok) {
    throw new Error("Authenticated signal DELETE unexpectedly succeeded.");
  }

  console.log(`PASS anonymous signal SELECT was denied (HTTP ${anonRead.response.status}).`);
  console.log(
    `PASS authenticated signal SELECT was denied (HTTP ${authenticatedRead.response.status}).`
  );
  console.log(
    `PASS authenticated signal DELETE was denied (HTTP ${authenticatedDelete.response.status}).`
  );
}

async function verifyGateC() {
  const anonRead = await request("/rest/v1/signals?select=id&limit=1", {
    key: publishableKey,
    token: publishableKey
  });
  assertOk(anonRead, "Anonymous public-signal SELECT");
  if (!Array.isArray(anonRead.payload) || anonRead.payload.length !== 0) {
    throw new Error("Anonymous signal fixture was expected to be empty.");
  }

  const authenticatedRead = await request("/rest/v1/signals?select=id&limit=1", {
    key: publishableKey,
    token: accessToken
  });
  assertOk(authenticatedRead, "Basic authenticated public-signal SELECT");
  if (!Array.isArray(authenticatedRead.payload) || authenticatedRead.payload.length !== 0) {
    throw new Error("Authenticated signal fixture was expected to be empty.");
  }

  const authenticatedDelete = await request(
    "/rest/v1/signals?id=eq.00000000-0000-0000-0000-000000000000",
    { key: publishableKey, token: accessToken, method: "DELETE" }
  );
  if (authenticatedDelete.response.ok) {
    throw new Error("Authenticated signal DELETE unexpectedly succeeded.");
  }

  const rpcBody = {
    p_expected_count: 12,
    p_dry_run: true,
    p_expected_cohort_hash: null
  };
  const anonBackfill = await request(
    "/rest/v1/rpc/backfill_legacy_beta_entitlements",
    { key: publishableKey, token: publishableKey, method: "POST", body: rpcBody }
  );
  if (anonBackfill.response.ok) {
    throw new Error("Anonymous beta backfill RPC unexpectedly succeeded.");
  }

  const authenticatedBackfill = await request(
    "/rest/v1/rpc/backfill_legacy_beta_entitlements",
    { key: publishableKey, token: accessToken, method: "POST", body: rpcBody }
  );
  if (authenticatedBackfill.response.ok) {
    throw new Error("Authenticated beta backfill RPC unexpectedly succeeded.");
  }

  console.log(`PASS anonymous public-signal SELECT returned an empty set (HTTP ${anonRead.response.status}).`);
  console.log(
    `PASS Basic authenticated public-signal SELECT returned an empty set (HTTP ${authenticatedRead.response.status}).`
  );
  console.log(
    `PASS authenticated signal DELETE was denied (HTTP ${authenticatedDelete.response.status}).`
  );
  console.log(`PASS anonymous beta backfill RPC was denied (HTTP ${anonBackfill.response.status}).`);
  console.log(
    `PASS authenticated beta backfill RPC was denied (HTTP ${authenticatedBackfill.response.status}).`
  );
}

async function verifyGateD() {
  const deniedRpcCalls = [
    ["request_account_deletion", { p_user_id: userId }],
    ["cancel_account_deletion", { p_user_id: userId }],
    ["start_account_deletion", { p_request_id: randomUUID() }],
    ["fail_account_deletion", { p_request_id: randomUUID(), p_error: "denied fixture" }],
    ["purge_account_application_data", { p_user_id: userId }]
  ];
  for (const [name, body] of deniedRpcCalls) {
    const denied = await request(`/rest/v1/rpc/${name}`, {
      key: publishableKey,
      token: accessToken,
      method: "POST",
      body
    });
    if (denied.response.ok) throw new Error(`Authenticated ${name} RPC unexpectedly succeeded.`);
  }

  const anonTableRead = await request("/rest/v1/account_deletion_requests?select=id&limit=1", {
    key: publishableKey,
    token: publishableKey
  });
  if (anonTableRead.response.ok) throw new Error("Anonymous deletion-request SELECT unexpectedly succeeded.");

  const requested = await request("/rest/v1/rpc/request_account_deletion", {
    key: serviceRoleKey,
    method: "POST",
    body: { p_user_id: userId }
  });
  assertOk(requested, "Service-role deletion request");
  const first = requested.payload?.[0];
  if (!first?.request_id || first.request_status !== "pending") {
    throw new Error("Deletion request did not enter pending state.");
  }

  const repeated = await request("/rest/v1/rpc/request_account_deletion", {
    key: serviceRoleKey,
    method: "POST",
    body: { p_user_id: userId }
  });
  assertOk(repeated, "Idempotent deletion request");
  if (repeated.payload?.[0]?.request_id !== first.request_id) {
    throw new Error("Repeated pending deletion request created a duplicate active row.");
  }
  if (
    Date.parse(repeated.payload[0]?.requested_at ?? "") !== Date.parse(first.requested_at)
    || Date.parse(repeated.payload[0]?.process_after ?? "") !== Date.parse(first.process_after)
  ) {
    throw new Error("Repeated pending deletion request changed its original deadline.");
  }

  const authenticatedRead = await request(
    `/rest/v1/account_deletion_requests?select=id,user_id,status&user_id=eq.${encodeURIComponent(userId)}`,
    { key: publishableKey, token: accessToken }
  );
  assertOk(authenticatedRead, "Authenticated own deletion-request SELECT");
  if (authenticatedRead.payload?.length !== 1 || authenticatedRead.payload[0]?.status !== "pending") {
    throw new Error("Authenticated user could not read exactly one own pending request.");
  }

  const deniedDelete = await request(
    `/rest/v1/account_deletion_requests?id=eq.${encodeURIComponent(first.request_id)}`,
    { key: publishableKey, token: accessToken, method: "DELETE" }
  );
  if (deniedDelete.response.ok) throw new Error("Authenticated deletion-request DELETE unexpectedly succeeded.");

  const canceled = await request("/rest/v1/rpc/cancel_account_deletion", {
    key: serviceRoleKey,
    method: "POST",
    body: { p_user_id: userId }
  });
  assertOk(canceled, "Pending deletion cancellation");
  if (canceled.payload !== true) throw new Error("Pending deletion request was not canceled.");

  const recanceled = await request("/rest/v1/rpc/cancel_account_deletion", {
    key: serviceRoleKey,
    method: "POST",
    body: { p_user_id: userId }
  });
  assertOk(recanceled, "Repeated deletion cancellation");
  if (recanceled.payload !== false) throw new Error("Repeated cancellation should be idempotently false.");

  const secondRequest = await request("/rest/v1/rpc/request_account_deletion", {
    key: serviceRoleKey,
    method: "POST",
    body: { p_user_id: userId }
  });
  assertOk(secondRequest, "Second deletion request");
  const second = secondRequest.payload?.[0];
  if (!second?.request_id || second.request_id === first.request_id) {
    throw new Error("A post-cancellation deletion request must create a new request.");
  }

  const started = await request("/rest/v1/rpc/start_account_deletion", {
    key: serviceRoleKey,
    method: "POST",
    body: { p_request_id: second.request_id }
  });
  assertOk(started, "Deletion processing lease");
  if (started.payload?.[0]?.request_status !== "processing") {
    throw new Error("Deletion request did not enter processing state.");
  }

  const processingCancel = await request("/rest/v1/rpc/cancel_account_deletion", {
    key: serviceRoleKey,
    method: "POST",
    body: { p_user_id: userId }
  });
  assertOk(processingCancel, "Processing cancellation guard");
  if (processingCancel.payload !== false) throw new Error("Processing deletion request was cancelable.");

  const failed = await request("/rest/v1/rpc/fail_account_deletion", {
    key: serviceRoleKey,
    method: "POST",
    body: { p_request_id: second.request_id, p_error: "disposable verification" }
  });
  assertOk(failed, "Deletion failure transition");

  const failedState = await request(
    `/rest/v1/account_deletion_requests?id=eq.${encodeURIComponent(second.request_id)}&select=status,next_attempt_at`,
    { key: serviceRoleKey }
  );
  assertOk(failedState, "Deletion retry backoff state");
  if (
    failedState.payload?.[0]?.status !== "failed"
    || Date.parse(failedState.payload[0]?.next_attempt_at ?? "") <= Date.now()
  ) {
    throw new Error("Failed deletion request did not receive a future retry deadline.");
  }
  const backoffBlocked = await request("/rest/v1/rpc/start_account_deletion", {
    key: serviceRoleKey,
    method: "POST",
    body: { p_request_id: second.request_id }
  });
  assertOk(backoffBlocked, "Deletion retry backoff enforcement");
  if (backoffBlocked.payload?.length !== 0) {
    throw new Error("Failed deletion request bypassed its retry backoff.");
  }

  const retried = await request("/rest/v1/rpc/request_account_deletion", {
    key: serviceRoleKey,
    method: "POST",
    body: { p_user_id: userId }
  });
  assertOk(retried, "Failed deletion retry");
  if (retried.payload?.[0]?.request_id !== second.request_id || retried.payload[0]?.request_status !== "pending") {
    throw new Error("Failed deletion request did not retry in place.");
  }
  if (
    Date.parse(retried.payload[0]?.requested_at ?? "") !== Date.parse(second.requested_at)
    || Date.parse(retried.payload[0]?.process_after ?? "") !== Date.parse(second.process_after)
  ) {
    throw new Error("Manual deletion retry changed its original deadline.");
  }

  const finalCancel = await request("/rest/v1/rpc/cancel_account_deletion", {
    key: serviceRoleKey,
    method: "POST",
    body: { p_user_id: userId }
  });
  assertOk(finalCancel, "Final disposable deletion cancellation");
  if (finalCancel.payload !== true) throw new Error("Retried deletion request was not cancelable.");

  const otherEmail = `gate-d-cross-${randomUUID()}@example.com`;
  const other = await request("/auth/v1/admin/users", {
    key: serviceRoleKey,
    method: "POST",
    body: { email: otherEmail, password: `${randomBytes(24).toString("base64url")}aA1!`, email_confirm: true }
  });
  assertOk(other, "Cross-user disposable creation");
  otherUserId = other.payload?.id ?? "";
  if (!otherUserId) throw new Error("Cross-user disposable response did not include an ID.");
  const otherRequest = await request("/rest/v1/rpc/request_account_deletion", {
    key: serviceRoleKey,
    method: "POST",
    body: { p_user_id: otherUserId }
  });
  assertOk(otherRequest, "Cross-user deletion request fixture");

  const scopedRead = await request("/rest/v1/account_deletion_requests?select=user_id,status", {
    key: publishableKey,
    token: accessToken
  });
  assertOk(scopedRead, "Cross-user RLS SELECT");
  if (!Array.isArray(scopedRead.payload) || scopedRead.payload.some((row) => row.user_id !== userId)) {
    throw new Error("Authenticated deletion-request SELECT exposed another user row.");
  }

  console.log("PASS all account-deletion mutation RPCs were denied to authenticated users.");
  console.log(`PASS anonymous deletion-request SELECT was denied (HTTP ${anonTableRead.response.status}).`);
  console.log("PASS own-row SELECT and cross-user RLS boundary worked.");
  console.log("PASS request idempotency, cancellation, processing lock, failure, and retry transitions worked.");
}

async function cleanup() {
  for (const candidateId of [otherUserId, userId].filter(Boolean)) {
    const deleted = await request(`/auth/v1/admin/users/${encodeURIComponent(candidateId)}`, {
      key: serviceRoleKey,
      method: "DELETE"
    });
    assertOk(deleted, "Disposable user cleanup");

    const profile = await request(
      `/rest/v1/profiles?id=eq.${encodeURIComponent(candidateId)}&select=id`,
      { key: serviceRoleKey }
    );
    assertOk(profile, "Disposable profile cleanup verification");
    if (profile.payload?.length) throw new Error("Disposable profile remained after user cleanup.");

    if (gate === "d") {
      const requests = await request(
        `/rest/v1/account_deletion_requests?user_id=eq.${encodeURIComponent(candidateId)}&select=id`,
        { key: serviceRoleKey }
      );
      assertOk(requests, "Disposable deletion-request cleanup verification");
      if (requests.payload?.length) throw new Error("Deletion request remained after disposable user cleanup.");
    }
  }
  console.log("PASS disposable user and profile were removed.");
}

let failure;
try {
  await createDisposableUser();
  if (gate === "a") await verifyGateA();
  if (gate === "b") await verifyGateB();
  if (gate === "c") {
    await verifyGateA();
    await verifyGateC();
  }
  if (gate === "d") {
    await verifyGateA();
    await verifyGateD();
  }
} catch (error) {
  failure = error;
} finally {
  try {
    await cleanup();
  } catch (cleanupError) {
    failure = failure
      ? new AggregateError([failure, cleanupError], "Gate verification and cleanup both failed.")
      : cleanupError;
  }
}

if (failure) throw failure;
