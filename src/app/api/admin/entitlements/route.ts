// 관리자 전용으로 테스터 Pro 권한을 수동 부여하는 API입니다.
import { NextResponse } from "next/server";
import { findBillingPlan, getMarketScopeForPlan, type BillingPlanId } from "@/lib/billing";
import { fetchSupabaseUserOnServer, supabaseAdminRest } from "@/lib/server/supabaseAdmin";

const grantablePlanIds = new Set<BillingPlanId>(["crypto_monthly", "stocks_monthly", "bundle_monthly"]);
const memberListLimit = 100;

interface AdminProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  plan: string | null;
  created_at: string;
  updated_at: string;
}

interface AdminSubscriptionRow {
  user_id: string;
  plan: string | null;
  market_scope: string | null;
  status: string | null;
  current_period_end: string | null;
  updated_at: string;
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeDurationDays(value: unknown) {
  const days = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(days)) return 90;
  return Math.min(365, Math.max(1, Math.floor(days)));
}

function isAdminUser(user: Awaited<ReturnType<typeof fetchSupabaseUserOnServer>>) {
  return user.app_metadata?.role === "admin" || user.app_metadata?.plan === "admin";
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
    const profiles = await supabaseAdminRest<AdminProfileRow[]>(
      `profiles?select=id,email,display_name,plan,created_at,updated_at&order=updated_at.desc.nullslast&limit=${memberListLimit}`
    );
    const now = encodeURIComponent(new Date().toISOString());
    const subscriptions = await supabaseAdminRest<AdminSubscriptionRow[]>(
      `subscriptions?select=user_id,plan,market_scope,status,current_period_end,updated_at&status=in.(active,trialing)&current_period_end=gt.${now}&order=current_period_end.desc&limit=1000`
    );
    const activeByUser = new Map<string, AdminSubscriptionRow>();
    for (const subscription of subscriptions) {
      if (!activeByUser.has(subscription.user_id)) {
        activeByUser.set(subscription.user_id, subscription);
      }
    }

    const members = profiles
      .filter((profile) => {
        if (!query) return true;
        return profile.email?.toLowerCase().includes(query) || profile.display_name?.toLowerCase().includes(query);
      })
      .map((profile) => {
        const activeSubscription = activeByUser.get(profile.id);
        return {
          id: profile.id,
          email: profile.email,
          displayName: profile.display_name,
          profilePlan: profile.plan,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
          activePlan: activeSubscription?.plan ?? null,
          activeMarketScope: activeSubscription?.market_scope ?? null,
          activeStatus: activeSubscription?.status ?? null,
          activeUntil: activeSubscription?.current_period_end ?? null
        };
      });

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
      planId?: unknown;
      durationDays?: unknown;
    };
    const email = normalizeEmail(body.email);
    const planId = typeof body.planId === "string" ? body.planId : "";
    const plan = findBillingPlan(planId);
    const durationDays = normalizeDurationDays(body.durationDays);

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "테스터 이메일을 입력해 주세요." }, { status: 400 });
    }
    if (!plan || plan.id === "free" || !grantablePlanIds.has(plan.id)) {
      return NextResponse.json({ error: "부여할 Pro 권한을 선택해 주세요." }, { status: 400 });
    }

    const profiles = await supabaseAdminRest<Array<{ id: string; email: string | null }>>(
      `profiles?select=id,email&email=ilike.${encodeURIComponent(email)}&limit=1`
    );
    const target = profiles[0];
    if (!target?.id) {
      return NextResponse.json({ error: "해당 이메일의 가입 계정을 찾지 못했습니다. 테스터가 먼저 한 번 로그인해야 합니다." }, { status: 404 });
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + durationDays);
    const providerOrderId = `manual_tester_${target.id}_${plan.id}`;
    const subscriptionBody = {
      user_id: target.id,
      provider: "manual",
      status: "active",
      plan: plan.id,
      market_scope: getMarketScopeForPlan(plan.id),
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      provider_subscription_id: "manual_tester",
      provider_order_id: providerOrderId
    };

    const existing = await supabaseAdminRest<Array<{ id: string }>>(
      `subscriptions?select=id&provider=eq.manual&provider_order_id=eq.${encodeURIComponent(providerOrderId)}&limit=1`
    );

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

    await supabaseAdminRest(`profiles?id=eq.${encodeURIComponent(target.id)}`, {
      method: "PATCH",
      body: { plan: plan.id }
    });

    return NextResponse.json({
      ok: true,
      email: target.email ?? email,
      planId: plan.id,
      planName: plan.name,
      marketScope: subscriptionBody.market_scope,
      currentPeriodEnd: subscriptionBody.current_period_end
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
