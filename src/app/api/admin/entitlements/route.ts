// 관리자 전용으로 테스터 Pro 권한을 수동 부여하는 API입니다.
import { NextResponse } from "next/server";
import { findBillingPlan, getMarketScopeForPlan, type BillingPlanId } from "@/lib/billing";
import {
  fetchSupabaseUserOnServer,
  getSupabaseRestTableColumns,
  listSupabaseAuthUsers,
  supabaseAdminRest
} from "@/lib/server/supabaseAdmin";
import type { SupabaseUser } from "@/lib/supabase";

const grantablePlanIds = new Set<BillingPlanId>(["crypto_monthly", "stocks_monthly", "bundle_monthly"]);
const memberListLimit = 500;

interface AdminProfileRow {
  id: string;
  email?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  plan?: string | null;
  membership_tier?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface AdminSubscriptionRow {
  id?: string;
  user_id: string;
  plan?: string | null;
  tier?: string | null;
  market_scope?: string | null;
  status?: string | null;
  provider?: string | null;
  provider_subscription_id?: string | null;
  provider_order_id?: string | null;
  current_period_end?: string | null;
  updated_at?: string | null;
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeUserId(value: unknown) {
  const userId = typeof value === "string" ? value.trim() : "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId) ? userId : "";
}

function normalizeDurationDays(value: unknown) {
  const days = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(days)) return 90;
  return Math.min(365, Math.max(1, Math.floor(days)));
}

function isAdminUser(user: Awaited<ReturnType<typeof fetchSupabaseUserOnServer>>) {
  return user.app_metadata?.role === "admin" || user.app_metadata?.plan === "admin";
}

function getUserDisplayName(user: SupabaseUser) {
  return (
    user.user_metadata?.name ??
    user.user_metadata?.full_name ??
    user.user_metadata?.nickname ??
    user.user_metadata?.preferred_username ??
    null
  );
}

function getUserAvatarUrl(user: SupabaseUser) {
  return user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null;
}

function getProfilePlan(profile: AdminProfileRow | null) {
  return profile?.plan ?? profile?.membership_tier ?? null;
}

function getSubscriptionPlan(subscription: AdminSubscriptionRow | undefined) {
  return subscription?.plan ?? subscription?.tier ?? null;
}

function getSubscriptionMarketScope(subscription: AdminSubscriptionRow | undefined) {
  const plan = getSubscriptionPlan(subscription);
  if (subscription?.market_scope) return subscription.market_scope;
  const billingPlan = findBillingPlan(plan);
  return billingPlan ? getMarketScopeForPlan(billingPlan.id) : null;
}

function pickSchemaBody(columns: Set<string>, body: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(body).filter(([key, value]) => columns.has(key) && value !== undefined));
}

async function requireAdmin(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return {
      error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
    };
  }

  const requester = await fetchSupabaseUserOnServer(token);
  if (!isAdminUser(requester)) {
    return {
      error: NextResponse.json({ error: "관리자 계정만 사용할 수 있습니다." }, { status: 403 })
    };
  }

  return { requester };
}

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const [authUsers, profiles] = await Promise.all([
      listSupabaseAuthUsers(memberListLimit),
      supabaseAdminRest<AdminProfileRow[]>(`profiles?select=*&limit=${memberListLimit}`)
    ]);
    const now = encodeURIComponent(new Date().toISOString());
    const subscriptions = await supabaseAdminRest<AdminSubscriptionRow[]>(
      `subscriptions?select=*&status=in.(active,trialing)&current_period_end=gt.${now}&order=current_period_end.desc&limit=1000`
    );
    const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
    const activeByUser = new Map<string, AdminSubscriptionRow>();
    for (const subscription of subscriptions) {
      if (!activeByUser.has(subscription.user_id)) {
        activeByUser.set(subscription.user_id, subscription);
      }
    }

    const memberMap = new Map<string, {
      id: string;
      email: string | null;
      displayName: string | null;
      profilePlan: string | null;
      createdAt: string | null;
      updatedAt: string | null;
      activePlan: string | null;
      activeMarketScope: string | null;
      activeStatus: string | null;
      activeUntil: string | null;
    }>();

    for (const user of authUsers) {
        const profile = profilesById.get(user.id) ?? null;
        const email = user.email ?? profile?.email ?? null;
        const displayName = profile?.display_name ?? getUserDisplayName(user);
        const activeSubscription = activeByUser.get(user.id);
        memberMap.set(user.id, {
          id: user.id,
          email,
          displayName,
          profilePlan: getProfilePlan(profile) ?? (typeof user.app_metadata?.plan === "string" ? user.app_metadata.plan : null),
          createdAt: user.created_at ?? profile?.created_at ?? null,
          updatedAt: profile?.updated_at ?? profile?.created_at ?? user.last_sign_in_at ?? user.created_at ?? null,
          activePlan: getSubscriptionPlan(activeSubscription),
          activeMarketScope: getSubscriptionMarketScope(activeSubscription),
          activeStatus: activeSubscription?.status ?? null,
          activeUntil: activeSubscription?.current_period_end ?? null
        });
    }

    for (const profile of profiles) {
      if (memberMap.has(profile.id)) continue;
      const activeSubscription = activeByUser.get(profile.id);
      memberMap.set(profile.id, {
        id: profile.id,
        email: profile.email ?? null,
        displayName: profile.display_name ?? null,
        profilePlan: getProfilePlan(profile),
        createdAt: profile.created_at ?? null,
        updatedAt: profile.updated_at ?? profile.created_at ?? null,
        activePlan: getSubscriptionPlan(activeSubscription),
        activeMarketScope: getSubscriptionMarketScope(activeSubscription),
        activeStatus: activeSubscription?.status ?? null,
        activeUntil: activeSubscription?.current_period_end ?? null
      });
    }

    const members = Array.from(memberMap.values())
      .filter((member) => {
        if (!member.email) return false;
        if (!query) return true;
        return member.email?.toLowerCase().includes(query) || member.displayName?.toLowerCase().includes(query);
      })
      .sort((left, right) => new Date(right.updatedAt ?? 0).getTime() - new Date(left.updatedAt ?? 0).getTime());

    return NextResponse.json({ members });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "회원 목록을 불러오지 못했습니다."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const body = (await request.json()) as {
      email?: unknown;
      userId?: unknown;
      planId?: unknown;
      durationDays?: unknown;
    };
    const email = normalizeEmail(body.email);
    const userId = normalizeUserId(body.userId);
    const planId = typeof body.planId === "string" ? body.planId : "";
    const plan = findBillingPlan(planId);
    const durationDays = normalizeDurationDays(body.durationDays);

    if (!userId && (!email || !email.includes("@"))) {
      return NextResponse.json({ error: "테스터 이메일을 입력해 주세요." }, { status: 400 });
    }
    if (!plan || plan.id === "free" || !grantablePlanIds.has(plan.id)) {
      return NextResponse.json({ error: "부여할 Pro 권한을 선택해 주세요." }, { status: 400 });
    }

    const authUsers = await listSupabaseAuthUsers(memberListLimit);
    const target = authUsers.find((user) => (userId ? user.id === userId : user.email?.toLowerCase() === email));
    if (!target) {
      return NextResponse.json({ error: "해당 이메일의 가입 계정을 찾지 못했습니다. 테스터가 먼저 한 번 로그인해야 합니다." }, { status: 404 });
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + durationDays);
    const providerOrderId = `manual_tester_${target.id}_${plan.id}`;
    const targetIsAdmin = isAdminUser(target);
    const [profileColumns, subscriptionColumns] = await Promise.all([
      getSupabaseRestTableColumns("profiles"),
      getSupabaseRestTableColumns("subscriptions")
    ]);
    const profileBody = pickSchemaBody(profileColumns, {
      id: target.id,
      email: (target.email ?? email) || undefined,
      display_name: getUserDisplayName(target),
      avatar_url: getUserAvatarUrl(target),
      plan: targetIsAdmin ? "admin" : plan.id,
      membership_tier: "premium",
      updated_at: now.toISOString()
    });
    await supabaseAdminRest("profiles", {
      method: "POST",
      prefer: "resolution=merge-duplicates",
      body: profileBody
    });

    const canWriteDetailedSubscription =
      subscriptionColumns.has("plan") || subscriptionColumns.has("market_scope") || subscriptionColumns.has("provider_order_id");
    const subscriptionBody = pickSchemaBody(subscriptionColumns, {
      user_id: target.id,
      provider: "manual",
      status: "active",
      plan: plan.id,
      tier: "premium",
      market_scope: getMarketScopeForPlan(plan.id),
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      provider_subscription_id: "manual_tester",
      provider_order_id: providerOrderId
    });

    if (canWriteDetailedSubscription) {
      const existingSubscriptionPath = subscriptionColumns.has("provider_order_id")
        ? `subscriptions?select=id&provider=eq.manual&provider_order_id=eq.${encodeURIComponent(providerOrderId)}&limit=1`
        : [
            `subscriptions?select=id`,
            `user_id=eq.${encodeURIComponent(target.id)}`,
            subscriptionColumns.has("provider") ? "provider=eq.manual" : "",
            subscriptionColumns.has("provider_subscription_id") ? "provider_subscription_id=eq.manual_tester" : "",
            "limit=1"
          ]
            .filter(Boolean)
            .join("&");
      const existing = await supabaseAdminRest<Array<{ id: string }>>(existingSubscriptionPath);

      if (existing[0]?.id) {
        await supabaseAdminRest(`subscriptions?id=eq.${encodeURIComponent(existing[0].id)}`, {
          method: "PATCH",
          body: subscriptionBody
        });
      } else {
        await supabaseAdminRest("subscriptions", {
          method: "POST",
          body: subscriptionBody
        });
      }
    }

    return NextResponse.json({
      ok: true,
      email: (target.email ?? email) || null,
      accountLabel: target.email ?? getUserDisplayName(target) ?? target.id,
      userId: target.id,
      planId: plan.id,
      planName: plan.name,
      marketScope: getMarketScopeForPlan(plan.id),
      currentPeriodEnd: subscriptionBody.current_period_end ?? periodEnd.toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "테스터 권한 부여에 실패했습니다."
      },
      { status: 500 }
    );
  }
}
