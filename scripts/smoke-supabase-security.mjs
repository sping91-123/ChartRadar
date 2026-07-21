// Supabase 운영 migration의 최소 권한 불변식을 정적으로 확인합니다.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [];

function read(relativePath) {
  const absolutePath = join(root, relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : "";
}

function pass(label, detail = "") {
  checks.push({ ok: true, label, detail });
}

function fail(label, detail = "") {
  checks.push({ ok: false, label, detail });
}

function expectMatch(source, pattern, label, detail) {
  if (pattern.test(source)) {
    pass(label, detail);
  } else {
    fail(label, detail);
  }
}

function expectNoMatch(source, pattern, label, detail) {
  if (pattern.test(source)) {
    fail(label, detail);
  } else {
    pass(label, detail);
  }
}

function stripSqlComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "");
}

const migrationDirectory = join(root, "supabase", "migrations");
const migrationNames = existsSync(migrationDirectory)
  ? readdirSync(migrationDirectory).filter((name) => name.endsWith(".sql")).sort()
  : [];
const migrationMatches = migrationNames.filter((name) => name.endsWith("_close_profile_entitlement_self_upgrade.sql"));

if (migrationMatches.length === 1) {
  pass("self-upgrade migration 파일", migrationMatches[0]);
} else {
  fail("self-upgrade migration 파일", `예상 1개, 현재 ${migrationMatches.length}개입니다.`);
}

const migrationPath = migrationMatches.length === 1 ? join("supabase", "migrations", migrationMatches[0]) : "";
const migration = migrationPath ? read(migrationPath) : "";
const migrationSql = stripSqlComments(migration);
const laterMigrationSql = migrationMatches.length === 1
  ? stripSqlComments(
      migrationNames
        .filter((name) => name > migrationMatches[0])
        .map((name) => read(join("supabase", "migrations", name)))
        .join("\n")
    )
  : "";
const schema = read("supabase/schema.sql");
const newsMigrationName = migrationNames.find((name) => name.endsWith("_news_impact_v1.sql"));
const newsMigration = newsMigrationName ? read(join("supabase", "migrations", newsMigrationName)) : "";
const newsHardeningName = migrationNames.find((name) => name.endsWith("_harden_news_impact_v1.sql"));
const newsHardening = newsHardeningName ? read(join("supabase", "migrations", newsHardeningName)) : "";
const newsRpcSql = `${newsMigration}\n${newsHardening}`;

for (const [label, source] of [
  ["migration", migration],
  ["schema", schema]
]) {
  if (!source) fail(`${label} 읽기`, `${label} 파일을 읽지 못했습니다.`);
}

expectMatch(
  migrationSql,
  /alter\s+table\s+public\.profiles\s+enable\s+row\s+level\s+security\s*;/i,
  "profile RLS 활성화",
  "운영 drift와 무관하게 public.profiles RLS를 명시적으로 활성화합니다."
);

expectMatch(
  migrationSql,
  /revoke\s+update\s+on\s+table\s+public\.profiles\s+from\s+public\s*,\s*anon\s*,\s*authenticated\s*;/i,
  "profile UPDATE privilege 회수",
  "PUBLIC, anon, authenticated의 public.profiles UPDATE를 회수합니다."
);

expectMatch(
  migrationSql,
  /drop\s+policy\s+if\s+exists\s+"본인 프로필 수정"\s+on\s+public\.profiles\s*;/i,
  "운영 profile UPDATE policy 제거",
  "운영의 한국어 policy 이름을 제거합니다."
);

for (const columnName of ["membership_tier", "plan"]) {
  expectMatch(
    migrationSql,
    new RegExp(
      `revoke\\s+update\\s*\\(\\s*${columnName}\\s*\\)\\s+on\\s+table\\s+public\\.profiles\\s+from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated`,
      "i"
    ),
    `profile ${columnName} UPDATE privilege 회수`,
    `${columnName} 열의 별도 UPDATE grant도 조건부로 회수합니다.`
  );
}

expectMatch(
  migrationSql,
  /drop\s+policy\s+if\s+exists\s+"profiles_update_own"\s+on\s+public\.profiles\s*;/i,
  "호환 profile UPDATE policy 제거",
  "repo 호환 policy 이름도 제거합니다."
);

expectNoMatch(
  migrationSql,
  /\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:profiles|subscriptions)\b/i,
  "hotfix 사용자 데이터 무변경",
  "hotfix migration에는 profile/subscription DML이 없어야 합니다."
);

expectNoMatch(
  migrationSql,
  /grant\s+update\s+on\s+(?:table\s+)?public\.profiles\s+to\s+(?:public|anon|authenticated)/i,
  "profile UPDATE 재허용 차단",
  "공개 역할에 profile UPDATE를 다시 grant하지 않습니다."
);

expectNoMatch(
  migrationSql,
  /grant\s+update\s*\(\s*(?:membership_tier|plan)\s*\)\s+on\s+(?:table\s+)?public\.profiles\s+to\s+(?:public|anon|authenticated)/i,
  "entitlement 열 UPDATE 재허용 차단",
  "공개 역할에 membership_tier/plan UPDATE를 다시 grant하지 않습니다."
);

expectNoMatch(
  schema,
  /create\s+policy\s+"profiles_update_own"[\s\S]*?on\s+public\.profiles\s+for\s+update/i,
  "기준 schema profile UPDATE 차단",
  "기준 schema에도 공개 profile UPDATE policy가 없어야 합니다."
);

expectNoMatch(
  laterMigrationSql,
  /grant\s+update(?:\s*\([^)]*\))?\s+on\s+(?:table\s+)?public\.profiles\s+to\s+(?:public|anon|authenticated)/i,
  "후속 migration profile UPDATE 재허용 차단",
  "hotfix 이후 migration도 공개 역할에 profile UPDATE를 다시 grant하지 않아야 합니다."
);

expectNoMatch(
  laterMigrationSql,
  /create\s+policy\b[\s\S]*?on\s+public\.profiles\s+for\s+update\b/i,
  "후속 migration profile UPDATE policy 차단",
  "hotfix 이후 migration도 공개 profile UPDATE policy를 다시 만들지 않아야 합니다."
);

for (const [table, label] of [
  ["news_source_catalog", "출처 catalog"],
  ["news_source_items", "출처 item"],
  ["news_impact_events", "뉴스 사건"],
  ["news_market_reactions", "시장 반응"],
  ["news_alert_preferences", "뉴스 알림 설정"]
]) {
  expectMatch(
    newsRpcSql,
    new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, "i"),
    `${label} RLS 활성화`,
    `public.${table}은 service route 밖에서 직접 읽거나 쓸 수 없습니다.`
  );
  expectMatch(
    newsMigration,
    new RegExp(`revoke\\s+all\\s+privileges\\s+on\\s+table\\s+public\\.${table}\\s+from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated\\s*,\\s*service_role`, "i"),
    `${label} 역할 권한 초기화`,
    "PUBLIC/anon/authenticated와 기존 service grant를 먼저 fail-closed로 초기화합니다."
  );
  expectNoMatch(
    newsMigration,
    new RegExp(`grant\\s+(?:select|insert|update|delete|all)\\s+on\\s+(?:table\\s+)?public\\.${table}\\s+to\\s+(?:public|anon|authenticated)`, "i"),
    `${label} Data API 직접 grant 차단`,
    "브라우저 역할에 신규 뉴스 테이블 권한을 부여하지 않습니다."
  );
}

for (const functionName of [
  "claim_news_sync_run",
  "renew_news_sync_run",
  "set_news_alert_preference",
  "claim_news_impact_alert",
  "lease_news_impact_delivery",
  "complete_news_impact_delivery",
  "retire_stale_news_reactions",
  "finalize_exhausted_news_impact_deliveries",
  "expire_news_impact_delivery",
  "purge_news_impact_retention"
]) {
  expectMatch(
    newsRpcSql,
    new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${functionName}\\(`, "i"),
    `${functionName} 공개 실행 회수`,
    "뉴스 원장 RPC는 service role 경계 안에서만 실행됩니다."
  );
}

expectMatch(
  schema,
  /create\s+table\s+if\s+not\s+exists\s+public\.news_market_reactions/i,
  "기준 schema News Impact 반영",
  "forward migration과 canonical schema가 같은 뉴스 원장을 선언합니다."
);

for (const marker of [
  /add\s+column\s+if\s+not\s+exists\s+allowed_hosts\s+text\[\]/i,
  /before\s+insert\s+or\s+update\s+of\s+source_id\s*,\s*policy_status\s*,\s*canonical_url/i,
  /evaluated\.generated_at\s*>\s*baseline\.generated_at/i,
  /account_deletion_requests[\s\S]*status\s+in\s*\('pending',\s*'processing',\s*'failed'\)/i,
  /create\s+or\s+replace\s+function\s+public\.renew_news_sync_run\(/i,
  /create\s+or\s+replace\s+function\s+public\.retire_stale_news_reactions\(\)/i,
  /delivery_succeeded_token_ids\s+uuid\[\]/i,
  /create\s+or\s+replace\s+function\s+public\.finalize_exhausted_news_impact_deliveries\(\)/i,
  /create\s+or\s+replace\s+function\s+public\.expire_news_impact_delivery\(/i,
  /complete_news_impact_delivery\([\s\S]*p_success_token_ids\s+uuid\[\]/i
]) {
  expectMatch(newsHardening, marker, `News Impact hardening ${marker.source}`, "보강 migration이 출처·개정·재시도 경계를 선언합니다.");
  expectMatch(schema, marker, `기준 schema hardening ${marker.source}`, "canonical schema가 forward hardening과 같은 최종 catalog를 선언합니다.");
}

let failed = 0;
for (const check of checks) {
  if (check.ok) {
    console.log(`PASS ${check.label} - ${check.detail}`);
  } else {
    failed += 1;
    console.error(`FAIL ${check.label} - ${check.detail}`);
  }
}

if (failed > 0) {
  process.exitCode = 1;
} else {
  console.log("\nSupabase 정적 보안 스모크 테스트가 통과했습니다.");
}
