// PGlite에서 production legacy와 repo 호환 profile schema를 각각 재현해
// self-upgrade hotfix의 PostgreSQL 역할·RLS·trigger 동작을 검증합니다.
// PostgREST/JWT HTTP 경계는 별도의 실제 Supabase 역할 테스트가 필요합니다.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";

const root = process.cwd();
const migrationPath = join(
  root,
  "supabase",
  "migrations",
  "20260714120423_close_profile_entitlement_self_upgrade.sql"
);
const migration = readFileSync(migrationPath, "utf8");

const users = {
  basicA: "00000000-0000-0000-0000-000000000001",
  basicB: "00000000-0000-0000-0000-000000000002",
  beta: "00000000-0000-0000-0000-000000000003",
  signupAfterHotfix: "00000000-0000-0000-0000-000000000004"
};

const variants = [
  {
    name: "production-membership-tier",
    entitlementColumn: "membership_tier",
    updatePolicy: "본인 프로필 수정",
    handleNewUserVariant: "production",
    testLegacySubscriptionTrigger: true
  },
  {
    name: "repo-plan",
    entitlementColumn: "plan",
    updatePolicy: "profiles_update_own",
    handleNewUserVariant: "repo",
    testLegacySubscriptionTrigger: false
  }
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function pass(variant, message) {
  console.log(`PASS [${variant}] ${message}`);
}

async function setAuthUser(db, userId) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
}

async function asRole(db, role, callback) {
  await db.exec(`set role ${role};`);
  try {
    return await callback();
  } finally {
    await db.exec("reset role;");
  }
}

async function expectPermissionDenied(db, role, statement, label) {
  let denied = false;

  try {
    await asRole(db, role, () => db.query(statement));
  } catch (error) {
    if (error?.code !== "42501") throw error;
    denied = true;
  }

  assert(denied, `${label}: expected PostgreSQL error 42501`);
}

async function readEntitlement(db, column, userId) {
  const result = await db.query(
    `select ${column} as entitlement from public.profiles where id = $1`,
    [userId]
  );
  return result.rows[0]?.entitlement;
}

async function readProfileSnapshot(db, column) {
  const result = await db.query(`
    select
      id::text,
      email,
      display_name,
      avatar_url,
      ${column} as entitlement,
      created_at::text
    from public.profiles
    order by id
  `);
  return result.rows;
}

function handleNewUserSql(variant) {
  if (variant === "production") {
    return `
      create or replace function public.handle_new_user()
      returns trigger
      language plpgsql
      security definer
      set search_path = public
      as $$
      begin
        insert into public.profiles (id, display_name, avatar_url)
        values (
          new.id,
          coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name'),
          new.raw_user_meta_data->>'avatar_url'
        );
        return new;
      end;
      $$;
    `;
  }

  return `
    create or replace function public.handle_new_user()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $$
    begin
      insert into public.profiles (id, email, display_name, avatar_url)
      values (
        new.id,
        new.email,
        coalesce(
          new.raw_user_meta_data->>'name',
          new.raw_user_meta_data->>'full_name',
          split_part(new.email, '@', 1)
        ),
        coalesce(
          new.raw_user_meta_data->>'avatar_url',
          new.raw_user_meta_data->>'picture'
        )
      )
      on conflict (id) do update
        set email = excluded.email,
            display_name = coalesce(excluded.display_name, profiles.display_name),
            avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url);
      return new;
    end;
    $$;
  `;
}

async function prepareFixture(db, variant) {
  const { entitlementColumn, updatePolicy } = variant;

  await db.exec(`
    create schema auth;

    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;

    create or replace function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;

    create table auth.users (
      id uuid primary key,
      email text not null,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );

    create table public.profiles (
      id uuid primary key references auth.users(id) on delete cascade,
      email text,
      display_name text,
      avatar_url text,
      ${entitlementColumn} text not null default 'free'
        check (${entitlementColumn} in ('free', 'member', 'premium', 'admin')),
      created_at timestamptz not null default now()
    );

    ${handleNewUserSql(variant.handleNewUserVariant)}

    create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

    alter table public.profiles enable row level security;

    create policy "profiles_select_own"
    on public.profiles for select
    to authenticated
    using ((select auth.uid()) = id);

    create policy "${updatePolicy}"
    on public.profiles for update
    using ((select auth.uid()) = id)
    with check ((select auth.uid()) = id);

    grant select, insert, update, delete
      on table public.profiles
      to public, anon, authenticated, service_role;

    grant update (${entitlementColumn})
      on table public.profiles
      to public, anon, authenticated;
  `);

  if (variant.testLegacySubscriptionTrigger) {
    await db.exec(`
      create table public.subscriptions (
        id bigint generated by default as identity primary key,
        user_id uuid not null references auth.users(id) on delete cascade,
        tier text not null check (tier in ('member', 'premium')),
        status text not null default 'active'
      );

      create or replace function public.sync_membership_tier()
      returns trigger
      language plpgsql
      security definer
      set search_path = public
      as $$
      declare
        highest_tier text;
      begin
        select case
          when bool_or(tier = 'premium' and status = 'active') then 'premium'
          when bool_or(tier = 'member' and status = 'active') then 'member'
          else 'free'
        end into highest_tier
        from public.subscriptions
        where user_id = coalesce(new.user_id, old.user_id);

        update public.profiles
          set membership_tier = highest_tier
          where id = coalesce(new.user_id, old.user_id);

        return coalesce(new, old);
      end;
      $$;

      create trigger on_subscription_change
      after insert or delete or update on public.subscriptions
      for each row execute function public.sync_membership_tier();

      grant select, insert, update, delete
        on table public.subscriptions
        to service_role;
      grant usage, select
        on sequence public.subscriptions_id_seq
        to service_role;
    `);
  }

  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data)
     values
       ($1, 'basic-a@example.invalid', '{"name":"Basic A"}'::jsonb),
       ($2, 'basic-b@example.invalid', '{"name":"Basic B"}'::jsonb),
       ($3, 'beta@example.invalid', '{"name":"Beta"}'::jsonb)`,
    [users.basicA, users.basicB, users.beta]
  );

  await db.query(
    `update public.profiles
     set ${entitlementColumn} = 'premium',
         created_at = '2026-05-15T12:34:56Z'::timestamptz
     where id = $1`,
    [users.beta]
  );
}

async function verifyVariant(variant) {
  const db = await PGlite.create();
  const { name, entitlementColumn } = variant;

  try {
    await prepareFixture(db, variant);

    await setAuthUser(db, users.basicA);
    await asRole(db, "authenticated", () =>
      db.query(
        `update public.profiles
         set ${entitlementColumn} = 'premium'
         where id = $1`,
        [users.basicA]
      )
    );
    assert(
      (await readEntitlement(db, entitlementColumn, users.basicA)) === "premium",
      `${name}: pre-hotfix self-upgrade was not reproduced`
    );
    pass(name, "pre-hotfix self-upgrade reproduced");

    await db.query(
      `update public.profiles set ${entitlementColumn} = 'free' where id = $1`,
      [users.basicA]
    );
    const beforeMigration = await readProfileSnapshot(db, entitlementColumn);

    await db.exec(migration);
    await db.exec(migration);
    pass(name, "migration applied twice without error");

    const afterMigration = await readProfileSnapshot(db, entitlementColumn);
    assert(
      JSON.stringify(afterMigration) === JSON.stringify(beforeMigration),
      `${name}: migration changed profile data`
    );
    pass(name, "profile and beta data remained unchanged");

    const privileges = await db.query(`
      select
        has_table_privilege('anon', 'public.profiles', 'UPDATE') as anon_table_update,
        has_table_privilege('authenticated', 'public.profiles', 'UPDATE') as authenticated_table_update,
        has_table_privilege('service_role', 'public.profiles', 'UPDATE') as service_table_update,
        has_column_privilege('anon', 'public.profiles', '${entitlementColumn}', 'UPDATE') as anon_column_update,
        has_column_privilege('authenticated', 'public.profiles', '${entitlementColumn}', 'UPDATE') as authenticated_column_update,
        has_column_privilege('service_role', 'public.profiles', '${entitlementColumn}', 'UPDATE') as service_column_update
    `);
    const privilege = privileges.rows[0];
    assert(privilege.anon_table_update === false, `${name}: anon table UPDATE remained`);
    assert(
      privilege.authenticated_table_update === false,
      `${name}: authenticated table UPDATE remained`
    );
    assert(privilege.service_table_update === true, `${name}: service_role table UPDATE was lost`);
    assert(privilege.anon_column_update === false, `${name}: anon column UPDATE remained`);
    assert(
      privilege.authenticated_column_update === false,
      `${name}: authenticated column UPDATE remained`
    );
    assert(privilege.service_column_update === true, `${name}: service_role column UPDATE was lost`);
    pass(name, "table and entitlement-column privileges are least-privilege");

    const securityState = await db.query(`
      select
        c.relrowsecurity as rls_enabled,
        (
          select count(*)::int
          from pg_policies
          where schemaname = 'public'
            and tablename = 'profiles'
            and cmd in ('UPDATE', 'ALL')
        ) as update_policy_count
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'profiles'
    `);
    assert(securityState.rows[0].rls_enabled === true, `${name}: RLS is disabled`);
    assert(
      securityState.rows[0].update_policy_count === 0,
      `${name}: profile UPDATE policy remained`
    );
    pass(name, "RLS stayed enabled and UPDATE policies were removed");

    await setAuthUser(db, users.basicA);
    const ownProfile = await asRole(db, "authenticated", () =>
      db.query("select id::text from public.profiles order by id")
    );
    assert(
      ownProfile.rows.length === 1 && ownProfile.rows[0].id === users.basicA,
      `${name}: authenticated own-profile SELECT regressed`
    );
    pass(name, "authenticated own-profile SELECT remained available");

    await expectPermissionDenied(
      db,
      "authenticated",
      `update public.profiles set ${entitlementColumn} = 'premium' where id = '${users.basicA}'`,
      `${name}: Basic self-upgrade`
    );
    await expectPermissionDenied(
      db,
      "authenticated",
      `update public.profiles set ${entitlementColumn} = 'premium' where id = '${users.basicB}'`,
      `${name}: cross-user update`
    );
    await expectPermissionDenied(
      db,
      "anon",
      `update public.profiles set ${entitlementColumn} = 'premium'`,
      `${name}: anon update`
    );
    assert(
      (await readEntitlement(db, entitlementColumn, users.basicA)) === "free",
      `${name}: denied Basic update changed the entitlement`
    );
    assert(
      (await readEntitlement(db, entitlementColumn, users.basicB)) === "free",
      `${name}: denied cross-user update changed the entitlement`
    );
    pass(name, "anon, Basic self-upgrade, and cross-user UPDATE were denied");

    await asRole(db, "service_role", () =>
      db.query(
        `update public.profiles set ${entitlementColumn} = 'member' where id = $1`,
        [users.basicA]
      )
    );
    assert(
      (await readEntitlement(db, entitlementColumn, users.basicA)) === "member",
      `${name}: service_role UPDATE did not persist`
    );
    await db.query(
      `update public.profiles set ${entitlementColumn} = 'free' where id = $1`,
      [users.basicA]
    );
    pass(name, "service_role UPDATE remained available");

    if (variant.testLegacySubscriptionTrigger) {
      const insertedSubscription = await asRole(db, "service_role", () =>
        db.query(
          `insert into public.subscriptions (user_id, tier, status)
           values ($1, 'premium', 'active')
           returning id`,
          [users.basicB]
        )
      );
      const subscriptionId = insertedSubscription.rows[0].id;
      assert(
        (await readEntitlement(db, entitlementColumn, users.basicB)) === "premium",
        `${name}: subscription INSERT trigger did not grant premium`
      );

      await asRole(db, "service_role", () =>
        db.query("update public.subscriptions set tier = 'member' where id = $1", [subscriptionId])
      );
      assert(
        (await readEntitlement(db, entitlementColumn, users.basicB)) === "member",
        `${name}: subscription UPDATE trigger did not recalculate member`
      );

      await asRole(db, "service_role", () =>
        db.query("delete from public.subscriptions where id = $1", [subscriptionId])
      );
      assert(
        (await readEntitlement(db, entitlementColumn, users.basicB)) === "free",
        `${name}: subscription DELETE trigger did not revoke to free`
      );
      pass(name, "legacy subscription INSERT/UPDATE/DELETE trigger remained available");
    }

    await db.query(
      `insert into auth.users (id, email, raw_user_meta_data)
       values ($1, 'new-user@example.invalid', '{"name":"New User"}'::jsonb)`,
      [users.signupAfterHotfix]
    );
    const signupProfile = await db.query(
      `select email, display_name, ${entitlementColumn} as entitlement
       from public.profiles
       where id = $1`,
      [users.signupAfterHotfix]
    );
    assert(signupProfile.rows.length === 1, `${name}: signup profile was not created`);
    assert(
      signupProfile.rows[0].entitlement === "free",
      `${name}: signup profile did not start as free`
    );
    pass(name, "signup trigger still created a free profile");

    const betaProfile = await db.query(
      `select
         ${entitlementColumn} as entitlement,
         created_at = '2026-05-15T12:34:56Z'::timestamptz as created_at_unchanged
       from public.profiles
       where id = $1`,
      [users.beta]
    );
    assert(betaProfile.rows[0].entitlement === "premium", `${name}: beta entitlement changed`);
    assert(
      betaProfile.rows[0].created_at_unchanged === true,
      `${name}: beta created_at changed`
    );

    const counts = await db.query(`
      select ${entitlementColumn} as entitlement, count(*)::int as count
      from public.profiles
      group by ${entitlementColumn}
      order by ${entitlementColumn}
    `);
    const countByEntitlement = Object.fromEntries(
      counts.rows.map((row) => [row.entitlement, row.count])
    );
    assert(countByEntitlement.free === 3, `${name}: expected three free fixture profiles`);
    assert(countByEntitlement.premium === 1, `${name}: expected one beta premium fixture`);
    pass(name, "beta entitlement and created_at remained unchanged");
  } finally {
    await db.close();
  }
}

for (const variant of variants) {
  await verifyVariant(variant);
}

console.log("\nSupabase profile self-upgrade hotfix 격리 DB 테스트가 통과했습니다.");
