import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());

const expectedProjectRef = "dbdouafktptajamanyno";
const confirmedProjectRef = process.argv
  .find((argument) => argument.startsWith("--confirm-project="))
  ?.slice("--confirm-project=".length);
const phase = process.argv
  .find((argument) => argument.startsWith("--phase="))
  ?.slice("--phase=".length);
const statePath = resolve("output/perpetual-revenue-core-production-e2e.json");

if (confirmedProjectRef !== expectedProjectRef) {
  throw new Error(`Use --confirm-project=${expectedProjectRef} to confirm the production target.`);
}
if (!new Set(["prepare", "ids", "verify", "cleanup"]).has(phase)) {
  throw new Error("Use --phase=prepare, --phase=ids, --phase=verify, or --phase=cleanup.");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cronSecret = process.env.CRON_SECRET;
if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
  throw new Error("Supabase URL, publishable key, and service-role key are required.");
}
if (new URL(supabaseUrl).hostname !== `${expectedProjectRef}.supabase.co`) {
  throw new Error("Configured Supabase URL does not match the confirmed production project.");
}

const baseUrlValue = process.argv
  .find((argument) => argument.startsWith("--base-url="))
  ?.slice("--base-url=".length) ?? "https://chartradar.kr";
const baseUrl = new URL(baseUrlValue);
if (phase === "verify" && (baseUrl.protocol !== "https:" || baseUrl.hostname !== "chartradar.kr")) {
  throw new Error("Production verification is restricted to https://chartradar.kr.");
}

async function request(url, { key, token = key, method = "GET", body, headers = {} } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, {
      method,
      headers: {
        ...(key ? { apikey: key } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers
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

function assertStatus(result, status, label) {
  if (result.response.status !== status) {
    const code = result.payload?.code ?? result.payload?.error_code ?? result.payload?.error ?? "unknown";
    throw new Error(`${label} returned HTTP ${result.response.status} (${code}), expected ${status}.`);
  }
}

function assertOk(result, label) {
  if (!result.response.ok) {
    const code = result.payload?.code ?? result.payload?.error_code ?? result.payload?.error ?? "unknown";
    throw new Error(`${label} failed with HTTP ${result.response.status} (${code}).`);
  }
}

function supabase(path, options = {}) {
  return request(`${supabaseUrl}${path}`, options);
}

function app(path, options = {}) {
  return request(new URL(path, baseUrl).toString(), options);
}

async function legacyBetaFingerprint() {
  const result = await supabase(
    "/rest/v1/subscriptions?provider=eq.legacy_beta&select=user_id,current_period_start,current_period_end,status&order=user_id.asc",
    { key: serviceRoleKey }
  );
  assertOk(result, "Legacy beta fingerprint");
  const rows = Array.isArray(result.payload) ? result.payload : [];
  return {
    count: rows.length,
    hash: createHash("sha256").update(JSON.stringify(rows)).digest("hex")
  };
}

async function createDisposable(role) {
  const email = `perpetual-core-${role}-${randomUUID()}@example.com`;
  const password = `${randomBytes(32).toString("base64url")}aA1!`;
  const created = await supabase("/auth/v1/admin/users", {
    key: serviceRoleKey,
    method: "POST",
    body: {
      email,
      password,
      email_confirm: true,
      app_metadata: { perpetual_revenue_core_e2e: true, e2e_role: role },
      user_metadata: { display_name: `Perpetual ${role} E2E disposable` }
    }
  });
  assertOk(created, `Disposable ${role} creation`);
  const id = created.payload?.id;
  if (!id) throw new Error(`Disposable ${role} response did not include an ID.`);
  return { id, email, password };
}

async function grantDisposablePro(userId, expiresAt) {
  const now = new Date().toISOString();
  const result = await supabase("/rest/v1/rpc/apply_billing_entitlement", {
    key: serviceRoleKey,
    method: "POST",
    body: {
      p_user_id: userId,
      p_provider: "manual",
      p_event_id: `perpetual-e2e-grant:${randomUUID()}`,
      p_plan: "crypto_monthly",
      p_market_scope: "crypto",
      p_status: "active",
      p_period_start: now,
      p_period_end: expiresAt,
      p_provider_product_id: "perpetual-e2e-coin",
      p_provider_order_id: `perpetual-e2e:${userId}`,
      p_provider_payment_id: null,
      p_observed_at: now,
      p_revoke: false,
      p_revocation_reason: null,
      p_actor_user_id: null,
      p_reason: "Disposable production canary verification",
      p_metadata: { disposable: true, suite: "perpetual-revenue-core-v1" }
    }
  });
  assertOk(result, "Disposable Pro entitlement grant");
}

async function purgeDisposable(userId) {
  await supabase("/rest/v1/rpc/purge_account_application_data", {
    key: serviceRoleKey,
    method: "POST",
    body: { p_user_id: userId }
  }).then((result) => assertOk(result, `Disposable ${userId} application purge`));
  const deleted = await supabase(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    key: serviceRoleKey,
    method: "DELETE"
  });
  if (!deleted.response.ok && deleted.response.status !== 404) {
    assertOk(deleted, `Disposable ${userId} Auth deletion`);
  }
}

async function readState() {
  const parsed = JSON.parse(await readFile(statePath, "utf8"));
  if (
    parsed?.projectRef !== expectedProjectRef ||
    !parsed?.basic?.id || !parsed?.basic?.email || !parsed?.basic?.password ||
    !parsed?.pro?.id || !parsed?.pro?.email || !parsed?.pro?.password ||
    !parsed?.canaryExpiresAt
  ) {
    throw new Error("Disposable production E2E state is invalid.");
  }
  return parsed;
}

async function prepare() {
  try {
    await readFile(statePath, "utf8");
    throw new Error("Disposable production E2E state already exists. Run cleanup first.");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const betaBefore = await legacyBetaFingerprint();
  if (betaBefore.count !== 12) throw new Error(`Expected exactly 12 legacy beta subscriptions, found ${betaBefore.count}.`);
  const created = [];
  try {
    const basic = await createDisposable("basic");
    created.push(basic.id);
    const pro = await createDisposable("pro");
    created.push(pro.id);
    const canaryExpiresAt = new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString();
    await grantDisposablePro(pro.id, canaryExpiresAt);
    const state = {
      projectRef: expectedProjectRef,
      createdAt: new Date().toISOString(),
      canaryExpiresAt,
      betaBefore,
      basic,
      pro
    };
    await mkdir(dirname(statePath), { recursive: true });
    await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    console.log(JSON.stringify({
      prepared: true,
      basicUserId: basic.id,
      proUserId: pro.id,
      canaryExpiresAt,
      statePath
    }));
  } catch (error) {
    for (const userId of created.reverse()) {
      await purgeDisposable(userId).catch(() => undefined);
    }
    throw error;
  }
}

async function signIn(account) {
  const result = await supabase("/auth/v1/token?grant_type=password", {
    key: publishableKey,
    token: publishableKey,
    method: "POST",
    body: { email: account.email, password: account.password }
  });
  assertOk(result, `Disposable ${account.id} sign-in`);
  if (!result.payload?.access_token) throw new Error("Disposable sign-in did not return an access token.");
  return result.payload.access_token;
}

async function fetchSnapshot(token, asset) {
  const result = await app(`/api/crypto/perpetual/snapshot?asset=${asset}`, { token });
  assertOk(result, `${asset.toUpperCase()} snapshot`);
  if (result.payload?.snapshot?.quality !== "ready") {
    throw new Error(`${asset.toUpperCase()} production snapshot is not ready.`);
  }
  return result.payload;
}

async function createFirstActionableMonitor(token, snapshot, conditions) {
  let lastResult = null;
  for (const condition of conditions) {
    const result = await app("/api/crypto/perpetual/monitors", {
      token,
      method: "POST",
      body: { snapshotId: snapshot.id, conditionId: condition.id }
    });
    lastResult = result;
    if (result.response.status === 201) return result.payload.monitor;
    if (result.response.status !== 422) assertOk(result, "Monitor creation");
  }
  const code = lastResult?.payload?.code ?? "condition_already_met";
  throw new Error(`No actionable monitor condition was available (${code}).`);
}

async function verify() {
  const state = await readState();
  if (Date.parse(state.canaryExpiresAt) <= Date.now()) throw new Error("Disposable canary window has expired.");
  const [basicToken, proToken] = await Promise.all([signIn(state.basic), signIn(state.pro)]);

  const anonAccess = await app("/api/crypto/perpetual/access");
  assertOk(anonAccess, "Anonymous canary access check");
  if (anonAccess.payload?.enabled !== false) throw new Error("Anonymous access unexpectedly enabled the revenue core.");
  for (const [label, token] of [["Basic", basicToken], ["Pro", proToken]]) {
    const access = await app("/api/crypto/perpetual/access", { token });
    assertOk(access, `${label} canary access`);
    if (access.payload?.enabled !== true) throw new Error(`${label} disposable account is not in the active canary.`);
  }

  const [basicBtc, basicEth, proBtc] = await Promise.all([
    fetchSnapshot(basicToken, "btc"),
    fetchSnapshot(basicToken, "eth"),
    fetchSnapshot(proToken, "btc")
  ]);
  if ("pro" in basicBtc.snapshot || basicBtc.capabilities?.monitorLimit !== 1) {
    throw new Error("Basic snapshot leaked Pro detail or returned the wrong monitor limit.");
  }
  if (!proBtc.snapshot?.pro || proBtc.capabilities?.monitorLimit !== 20) {
    throw new Error("Pro snapshot did not return Pro detail and the 20-condition limit.");
  }

  const basicMonitor = await createFirstActionableMonitor(
    basicToken,
    basicBtc.snapshot,
    [basicBtc.snapshot.summary.primaryCondition]
  );
  const basicSecond = await app("/api/crypto/perpetual/monitors", {
    token: basicToken,
    method: "POST",
    body: {
      snapshotId: basicEth.snapshot.id,
      conditionId: basicEth.snapshot.summary.primaryCondition.id
    }
  });
  assertStatus(basicSecond, 403, "Basic second monitor");
  if (basicSecond.payload?.code !== "monitor_limit_reached") {
    throw new Error("Basic second monitor did not return the Coin Pro quota error.");
  }

  const proConditions = [
    proBtc.snapshot.summary.primaryCondition,
    ...proBtc.snapshot.pro.confirmationConditions,
    ...proBtc.snapshot.pro.invalidationConditions
  ];
  const proMonitor = await createFirstActionableMonitor(proToken, proBtc.snapshot, proConditions.slice(1));
  const paused = await app(`/api/crypto/perpetual/monitors/${proMonitor.id}`, {
    token: proToken,
    method: "PATCH",
    body: { action: "pause" }
  });
  assertOk(paused, "Pro monitor pause");
  const resumed = await app(`/api/crypto/perpetual/monitors/${proMonitor.id}`, {
    token: proToken,
    method: "PATCH",
    body: { action: "resume" }
  });
  assertOk(resumed, "Pro monitor resume");

  const journal = await app("/api/crypto/perpetual/journal", {
    token: proToken,
    method: "POST",
    body: { snapshotId: proBtc.snapshot.id, monitorId: proMonitor.id, source: "snapshot" }
  });
  assertStatus(journal, 201, "Perpetual Journal save");

  const [basicList, proList] = await Promise.all([
    app("/api/crypto/perpetual/monitors?status=active", { token: basicToken }),
    app("/api/crypto/perpetual/monitors?status=active", { token: proToken })
  ]);
  assertOk(basicList, "Basic monitor list");
  assertOk(proList, "Pro monitor list");
  if (!basicList.payload?.monitors?.some((monitor) => monitor.id === basicMonitor.id)) {
    throw new Error("Basic monitor was not returned from the owned list.");
  }
  if (!proList.payload?.monitors?.some((monitor) => monitor.id === proMonitor.id)) {
    throw new Error("Pro monitor was not returned from the owned list.");
  }

  let cronVerified = false;
  if (cronSecret) {
    const cron = await app("/api/push-cron?dryRun=true", {
      headers: { Authorization: `Bearer ${cronSecret}` }
    });
    assertOk(cron, "Production push cron dry-run");
    if (cron.payload?.ok !== true || cron.payload?.dryRun !== true) {
      throw new Error("Production push cron did not return a dry-run summary.");
    }
    cronVerified = true;
  }

  const betaAfter = await legacyBetaFingerprint();
  if (betaAfter.count !== state.betaBefore.count || betaAfter.hash !== state.betaBefore.hash) {
    throw new Error("Legacy beta cohort changed during production E2E.");
  }
  console.log(JSON.stringify({
    verified: true,
    basicLimit: basicBtc.capabilities.monitorLimit,
    proLimit: proBtc.capabilities.monitorLimit,
    basicSecondMonitor: basicSecond.payload.code,
    proConditionRole: proMonitor.condition.role,
    journalSaved: true,
    cronDryRun: cronVerified,
    legacyBetaCount: betaAfter.count
  }));
}

async function cleanup() {
  const state = await readState();
  const errors = [];
  for (const account of [state.pro, state.basic]) {
    try {
      await purgeDisposable(account.id);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  const betaAfter = await legacyBetaFingerprint();
  if (betaAfter.count !== state.betaBefore.count || betaAfter.hash !== state.betaBefore.hash) {
    errors.push("Legacy beta cohort changed during disposable cleanup.");
  }
  if (errors.length) throw new Error(errors.join(" "));
  await unlink(statePath);
  console.log(JSON.stringify({ cleaned: true, legacyBetaCount: betaAfter.count }));
}

if (phase === "prepare") await prepare();
if (phase === "ids") {
  const state = await readState();
  console.log(JSON.stringify({
    canaryUserIds: `${state.basic.id},${state.pro.id}`,
    canaryExpiresAt: state.canaryExpiresAt
  }));
}
if (phase === "verify") await verify();
if (phase === "cleanup") await cleanup();
