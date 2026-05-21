// 관리자 전용으로 테스터 Pro 권한을 수동 부여하는 API입니다.
import { NextResponse } from "next/server";
import { findBillingPlan, getMarketScopeForPlan, type BillingPlanId } from "@/lib/billing";
import { fetchSupabaseUserOnServer, supabaseAdminRest } from "@/lib/server/supabaseAdmin";

const grantablePlanIds = new Set<BillingPlanId>(["crypto_monthly", "stocks_monthly", "bundle_monthly"]);

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

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const requester = await fetchSupabaseUserOnServer(token);
    if (!isAdminUser(requester)) {
      return NextResponse.json({ error: "관리자 계정만 테스터 권한을 부여할 수 있습니다." }, { status: 403 });
    }

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
