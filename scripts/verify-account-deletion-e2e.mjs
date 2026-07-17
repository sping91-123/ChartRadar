import { randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());

const expectedProjectRef = "dbdouafktptajamanyno";
const confirmedProjectRef = process.argv
  .find((argument) => argument.startsWith("--confirm-project="))
  ?.split("=")[1];
if (confirmedProjectRef !== expectedProjectRef) {
  throw new Error(`Use --confirm-project=${expectedProjectRef} to confirm the production data target.`);
}

const baseUrlValue = process.argv
  .find((argument) => argument.startsWith("--base-url="))
  ?.slice("--base-url=".length) ?? "http://127.0.0.1:3100";
const baseUrl = new URL(baseUrlValue);
if (!/^https?:$/.test(baseUrl.protocol) || !["127.0.0.1", "localhost"].includes(baseUrl.hostname)) {
  throw new Error("Account deletion E2E is restricted to a local app server.");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const revenueCatKey = process.env.REVENUECAT_REST_API_KEY;
if (!supabaseUrl || !publishableKey || !serviceRoleKey || !revenueCatKey) {
  throw new Error("Supabase and RevenueCat server credentials are required for deletion E2E.");
}
if (new URL(supabaseUrl).hostname !== `${expectedProjectRef}.supabase.co`) {
  throw new Error("Configured Supabase URL does not match the confirmed production project.");
}

const email = `account-deletion-e2e-${randomUUID()}@example.com`;
const password = `${randomBytes(24).toString("base64url")}aA1!`;
let userId = "";
let accessToken = "";
let refreshToken = "";

async function jsonRequest(url, { key, token = key, method = "GET", body } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      method,
      headers: {
        ...(key ? { apikey: key } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        Prefer: "return=representation"
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal
    });
    const payload = await response.json().catch(() => null);
    return { response, payload };
  } finally {
    clearTimeout(timeoutId);
  }
}

function assertOk(result, label) {
  if (!result.response.ok) {
    const code = result.payload?.code ?? result.payload?.error_code ?? result.payload?.error ?? "unknown";
    throw new Error(`${label} failed with HTTP ${result.response.status} (${code}).`);
  }
}

async function supabase(path, options = {}) {
  return jsonRequest(`${supabaseUrl}${path}`, options);
}

async function app(path, options = {}) {
  return jsonRequest(new URL(path, baseUrl).toString(), options);
}

function assertDisposableAuthUser(payload, label) {
  const createdAt = Date.parse(payload?.created_at ?? "");
  const ageMs = Date.now() - createdAt;
  if (
    payload?.id !== userId
    || payload?.email !== email
    || payload?.app_metadata?.role !== "admin"
    || payload?.app_metadata?.deletion_e2e !== true
    || !Number.isFinite(createdAt)
    || ageMs < -60_000
    || ageMs > 10 * 60_000
  ) {
    throw new Error(`${label} did not match the exact disposable account marker.`);
  }
}

async function createTarget() {
  const created = await supabase("/auth/v1/admin/users", {
    key: serviceRoleKey,
    method: "POST",
    body: {
      email,
      password,
      email_confirm: true,
      app_metadata: { role: "admin", deletion_e2e: true },
      user_metadata: { display_name: "Deletion E2E disposable" }
    }
  });
  assertOk(created, "Disposable admin creation");
  userId = created.payload?.id ?? "";
  if (!userId) throw new Error("Disposable creation response did not include an ID.");
  assertDisposableAuthUser(created.payload, "Disposable creation response");

  const signedIn = await supabase("/auth/v1/token?grant_type=password", {
    key: publishableKey,
    token: publishableKey,
    method: "POST",
    body: { email, password }
  });
  assertOk(signedIn, "Disposable admin sign-in");
  accessToken = signedIn.payload?.access_token ?? "";
  refreshToken = signedIn.payload?.refresh_token ?? "";
  if (!accessToken || !refreshToken) throw new Error("Disposable sign-in did not return both tokens.");

  const sessionUser = await supabase("/auth/v1/user", {
    key: publishableKey,
    token: accessToken
  });
  assertOk(sessionUser, "Disposable signed-in identity");
  assertDisposableAuthUser(sessionUser.payload, "Disposable signed-in identity");

  const profile = await supabase(
    `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,membership_tier`,
    { key: serviceRoleKey }
  );
  assertOk(profile, "Disposable profile verification");
  if (profile.payload?.length !== 1 || profile.payload[0]?.membership_tier !== "free") {
    throw new Error("Deletion E2E target is not a fresh free profile.");
  }
  const subscription = await supabase(
    `/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=id`,
    { key: serviceRoleKey }
  );
  assertOk(subscription, "Disposable subscription verification");
  if (subscription.payload?.length) throw new Error("Deletion E2E target unexpectedly has a subscription.");
}

async function runDeletion() {
  const requested = await app("/api/account/deletion", {
    token: accessToken,
    method: "POST"
  });
  assertOk(requested, "App deletion request");
  if (requested.response.status !== 202) throw new Error("Deletion request must return HTTP 202.");
  const request = requested.payload?.request;
  if (!request?.id || request.status !== "pending") {
    throw new Error("Deletion API did not return normalized id/status fields.");
  }

  const repeated = await app("/api/account/deletion", { token: accessToken, method: "POST" });
  assertOk(repeated, "Repeated app deletion request");
  if (repeated.payload?.request?.id !== request.id) {
    throw new Error("Repeated app deletion request was not idempotent.");
  }

  const status = await app("/api/account/deletion", { token: accessToken });
  assertOk(status, "App deletion status");
  if (status.payload?.request?.id !== request.id || status.payload?.request?.status !== "pending") {
    throw new Error("Deletion GET did not return the pending request.");
  }

  const boundRequest = await supabase(
    `/rest/v1/account_deletion_requests?id=eq.${encodeURIComponent(request.id)}&user_id=eq.${encodeURIComponent(userId)}&status=eq.pending&select=id,user_id,status`,
    { key: serviceRoleKey }
  );
  assertOk(boundRequest, "Disposable deletion request binding");
  if (
    boundRequest.payload?.length !== 1
    || boundRequest.payload[0]?.id !== request.id
    || boundRequest.payload[0]?.user_id !== userId
  ) {
    throw new Error("Deletion request was not bound to the exact disposable account.");
  }

  const queue = await app("/api/admin/account-deletions", { token: accessToken });
  assertOk(queue, "Admin deletion queue");
  if (queue.payload?.requests?.length !== 1 || queue.payload.requests[0]?.id !== request.id) {
    throw new Error("Deletion queue was not isolated to the disposable request.");
  }
  if ("user_id" in queue.payload.requests[0]) throw new Error("Admin queue exposed a user ID.");

  const targetBeforeProcessing = await supabase(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    key: serviceRoleKey
  });
  assertOk(targetBeforeProcessing, "Disposable pre-processing identity check");
  assertDisposableAuthUser(targetBeforeProcessing.payload, "Disposable pre-processing identity");

  const processed = await app("/api/admin/account-deletions", {
    token: accessToken,
    method: "POST",
    body: { requestId: request.id }
  });
  assertOk(processed, "Explicit disposable account deletion");
  if (processed.payload?.completed !== true) throw new Error("Deletion worker did not report completion.");
}

async function verifyDeleted() {
  const adminRead = await supabase(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    key: serviceRoleKey
  });
  if (adminRead.response.ok || adminRead.response.status !== 404) {
    throw new Error(`Deleted Auth user lookup returned HTTP ${adminRead.response.status}.`);
  }

  const oldSession = await supabase("/auth/v1/user", {
    key: publishableKey,
    token: accessToken
  });
  if (oldSession.response.ok) throw new Error("Deleted user's access token still resolved through Auth.");

  const refresh = await supabase("/auth/v1/token?grant_type=refresh_token", {
    key: publishableKey,
    token: publishableKey,
    method: "POST",
    body: { refresh_token: refreshToken }
  });
  if (refresh.response.ok) throw new Error("Deleted user's refresh token unexpectedly succeeded.");

  const oldJwtDataRead = await supabase("/rest/v1/profiles?select=id&limit=1", {
    key: publishableKey,
    token: accessToken
  });
  if (oldJwtDataRead.response.ok && oldJwtDataRead.payload?.length) {
    throw new Error("Deleted user's unexpired access JWT could still read a profile row.");
  }

  for (const table of [
    "subscriptions",
    "journals",
    "push_alert_events",
    "push_alert_presets",
    "push_tokens",
    "oauth_provider_credentials",
    "account_deletion_requests"
  ]) {
    const rows = await supabase(
      `/rest/v1/${table}?user_id=eq.${encodeURIComponent(userId)}&select=*`,
      { key: serviceRoleKey }
    );
    assertOk(rows, `Deleted ${table} verification`);
    if (rows.payload?.length) throw new Error(`Deleted ${table} rows remained.`);
  }

  const profileRows = await supabase(
    `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id`,
    { key: serviceRoleKey }
  );
  assertOk(profileRows, "Deleted profile verification");
  if (profileRows.payload?.length) throw new Error("Deleted profile row remained.");
}

async function cleanup() {
  if (!userId) return;
  const existing = await supabase(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    key: serviceRoleKey
  });
  if (existing.response.status === 404) return;
  assertOk(existing, "Disposable cleanup identity lookup");
  assertDisposableAuthUser(existing.payload, "Disposable cleanup identity");
  const deleted = await supabase(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    key: serviceRoleKey,
    method: "DELETE"
  });
  assertOk(deleted, "Disposable cleanup fallback");
  const afterCleanup = await supabase(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    key: serviceRoleKey
  });
  if (afterCleanup.response.status !== 404) {
    throw new Error(`Disposable cleanup verification returned HTTP ${afterCleanup.response.status}.`);
  }
}

let failure;
try {
  await createTarget();
  await runDeletion();
  await verifyDeleted();
  console.log("PASS disposable account deletion completed through provider cleanup hooks, app-data purge, and Auth deletion.");
  console.log("PASS deleted Auth access and refresh tokens were rejected by Auth endpoints.");
  console.log("PASS the deleted user's remaining access JWT could not read application profile data.");
  console.log("PASS all disposable application rows were removed.");
} catch (error) {
  failure = error;
} finally {
  try {
    await cleanup();
  } catch (cleanupError) {
    failure = failure
      ? new AggregateError([failure, cleanupError], "Deletion E2E and cleanup both failed.")
      : cleanupError;
  }
}

if (failure) throw failure;
