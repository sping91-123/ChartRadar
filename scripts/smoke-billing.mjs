// 출시 전 구독 단일 원장, store 상품, 비활성 Toss 경계를 정적으로 확인합니다.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [];
const read = (path) => {
  const absolute = join(root, path);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
};
const pass = (label, detail = "") => checks.push({ ok: true, label, detail });
const fail = (label, detail = "") => checks.push({ ok: false, label, detail });
const includes = (source, value, label) => source.includes(value) ? pass(label) : fail(label, `missing: ${value}`);
const excludes = (source, value, label) => source.includes(value) ? fail(label, `forbidden: ${value}`) : pass(label);

const files = {
  billing: read("src/lib/billing.ts"),
  requestEntitlement: read("src/lib/server/requestEntitlement.ts"),
  mutation: read("src/lib/server/billingEntitlements.ts"),
  sync: read("src/app/api/billing/app-store/sync/route.ts"),
  webhook: read("src/app/api/billing/app-store/webhook/route.ts"),
  revenueCatSnapshot: read("src/lib/server/revenueCatSnapshot.ts"),
  checkout: read("src/app/api/billing/checkout/route.ts"),
  confirm: read("src/app/api/billing/confirm/route.ts"),
  mobile: read("src/lib/mobilePurchases.ts"),
  adminHealth: read("src/app/api/admin/health/route.ts"),
  adminPushDiagnostics: read("src/app/api/admin/push-diagnostics/route.ts"),
  pushTest: read("src/app/api/push-test/route.ts"),
  accountPage: read("src/app/account/page.tsx"),
  alertCenter: read("src/components/RadarAlertCenter.tsx"),
  accountDeletionRoute: read("src/app/api/account/deletion/route.ts"),
  accountDeletionContract: read("src/lib/accountDeletionContract.ts"),
  migration: read("supabase/migrations/20260715164522_canonical_entitlement_ledger.sql"),
  env: read(".env.example")
};

for (const [name, source] of Object.entries(files)) {
  source ? pass(`file ${name}`) : fail(`file ${name}`, "not found or empty");
}

const paidPlans = [
  ["crypto_monthly", "chart_radar_crypto_monthly", "monthly"],
  ["crypto_yearly", "chart_radar_crypto_yearly", "year-1"],
  ["stocks_monthly", "chart_radar_global_monthly", "monthly"],
  ["stocks_yearly", "chart_radar_global_yearly", "yearly-1"],
  ["bundle_monthly", "chart_radar_bundle_monthly", "monthly"],
  ["bundle_yearly", "chart_radar_bundle_6month", "month-6"]
];

for (const [planId, productId, basePlanId] of paidPlans) {
  includes(files.billing, `id: "${planId}"`, `plan ${planId}`);
  includes(files.billing, `android: { productId: "${productId}", basePlanId: "${basePlanId}" }`, `android product ${planId}`);
  includes(files.billing, `ios: { productId: "${productId}" }`, `ios product ${planId}`);
}
includes(files.billing, "revenueCatPackageId", "RevenueCat package model");
excludes(files.billing, "appStoreProductId:", "legacy appStoreProductId removed");
excludes(files.billing, "appStoreBasePlanId:", "legacy appStoreBasePlanId removed");

for (const sourceName of ["checkout", "confirm"]) {
  const source = files[sourceName];
  includes(source, "{ status: 410 }", `${sourceName} returns 410`);
  excludes(source, "fetch(", `${sourceName} has no provider call`);
  excludes(source, "supabase", `${sourceName} has no entitlement write`);
  excludes(source, "TOSS_PAYMENTS_SECRET_KEY", `${sourceName} has no Toss secret use`);
}

includes(files.requestEntitlement, "resolveEffectiveEntitlement", "server uses effective resolver");
includes(files.requestEntitlement, "fetchSupabaseAccountDeletionRequest", "deletion pending is fail-closed");
excludes(files.requestEntitlement, 'from("profiles")', "server has no profile authorization fallback");
excludes(files.requestEntitlement, "app_metadata.plan", "server has no metadata plan fallback");
for (const sourceName of ["adminHealth", "adminPushDiagnostics", "pushTest", "accountPage", "alertCenter"]) {
  excludes(files[sourceName], "app_metadata?.plan", `${sourceName} has no metadata admin-plan fallback`);
  excludes(files[sourceName], 'profile?.plan === "admin"', `${sourceName} has no profile admin-plan fallback`);
}

includes(files.accountDeletionRoute, "isAccountDeletionProcessingEnabled()", "deletion request requires enabled processor");
includes(files.accountDeletionRoute, "normalizeAccountDeletionRequest", "deletion RPC response is normalized");
includes(files.accountDeletionContract, "request_id", "deletion contract maps request_id");
includes(files.accountDeletionContract, "request_status", "deletion contract maps request_status");

includes(files.mutation, 'supabaseAdminRpc<BillingMutationResult>("apply_billing_entitlement"', "single entitlement RPC");
includes(files.mutation, 'supabaseAdminRpc<BillingMutationResult>("reconcile_provider_entitlements"', "snapshot reconciliation RPC");
excludes(files.mutation, 'from("profiles")', "mutation has no profile-first write");

includes(files.sync, "reconcileProviderEntitlements", "RevenueCat sync reconciles one snapshot");
includes(files.sync, "verifiedEmpty", "RevenueCat sync distinguishes verified empty");
includes(files.sync, "setup_required", "RevenueCat sync preserves unknown setup state");
includes(files.sync, "observedAt", "RevenueCat sync carries observation time");

includes(files.webhook, "verifyRevenueCatWebhookSignature", "webhook verifies raw-body HMAC");
includes(files.webhook, "fetchRevenueCatSubscriber", "webhook refetches latest subscriber snapshot");
includes(files.revenueCatSnapshot, "billing_issues_detected_at", "RevenueCat billing issue is fail-closed");
includes(files.revenueCatSnapshot, "refunded_at", "RevenueCat refund is fail-closed");
includes(files.revenueCatSnapshot, "transferred_from", "RevenueCat transfer source is reconciled");
includes(files.webhook, "Webhook payload is not valid JSON", "webhook rejects malformed JSON");
includes(files.webhook, 'eventType === "TEST"', "signed RevenueCat dashboard test is accepted without ledger mutation");
const signatureGuardIndex = files.webhook.indexOf("if (!signatureValid)");
const eventIdGuardIndex = files.webhook.indexOf("Webhook event identity is invalid.");
const dashboardTestIndex = files.webhook.indexOf('eventType === "TEST"');
signatureGuardIndex >= 0 && eventIdGuardIndex > signatureGuardIndex && dashboardTestIndex > eventIdGuardIndex
  ? pass("dashboard test follows signature and event-id validation")
  : fail("dashboard test follows signature and event-id validation");
excludes(files.webhook, "payload.event?.product_id", "webhook does not authorize raw product event");

includes(files.mobile, "Purchases.configure({ apiKey })", "RevenueCat configure has no user id");
includes(files.mobile, "Purchases.logIn({ appUserID: userId })", "RevenueCat account login");
includes(files.mobile, "Purchases.logOut()", "RevenueCat account logout");
includes(files.mobile, "enqueueIdentityOperation", "RevenueCat identity operations are serialized and recoverable");
includes(files.mobile, "refreshNativeEntitlement", "RevenueCat startup and foreground reconciliation");
excludes(files.mobile, "Purchases.configure({ apiKey, appUserID", "RevenueCat is not reconfigured per user");

for (const marker of [
  "billing_entitlement_events",
  "apply_billing_entitlement",
  "reconcile_provider_entitlements",
  "backfill_legacy_beta_entitlements",
  "legacy_beta",
  "profile.created_at + interval '3 months'",
  "p_expected_count integer default 12",
  "p_period_end > p_observed_at + interval '365 days'",
  "subscriptions_provider_order_id_idx",
  "signals_public_read",
  "signals_premium_read"
]) {
  includes(files.migration, marker, `migration ${marker}`);
}

for (const envName of [
  "NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY",
  "NEXT_PUBLIC_REVENUECAT_IOS_API_KEY",
  "REVENUECAT_REST_API_KEY",
  "REVENUECAT_WEBHOOK_SIGNING_SECRET",
  "ACCOUNT_DELETION_PROCESSING_ENABLED"
]) {
  includes(files.env, envName, `env ${envName}`);
}

const failures = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}${check.detail ? ` - ${check.detail}` : ""}`);
}
if (failures.length > 0) {
  console.error(`\n${failures.length}개 결제 안정성 항목이 실패했습니다.`);
  process.exit(1);
}
console.log("\n구독 단일 원장과 결제 경계가 기본 검사를 통과했습니다.");
