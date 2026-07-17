import { NextResponse } from "next/server";
import { findBillingPlan, getMarketScopeForPlan, type BillingPlanId } from "@/lib/billing";
import { resolveEffectiveEntitlement } from "@/lib/effectiveEntitlement";
import { applyBillingEntitlement } from "@/lib/server/billingEntitlements";
import {
  fetchSupabaseUserOnServer,
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
  plan?: string | null;
  membership_tier?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface AdminSubscriptionRow {
  user_id: string;
  plan?: BillingPlanId | "premium" | null;
  market_scope?: "crypto" | "stocks" | "bundle" | null;
  status?: string | null;
  current_period_end?: string | null;
  revoked_at?: string | null;
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeUserId(value: unknown) {
  const userId = typeof value === "string" ? value.trim() : "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId) ? userId : "";
}

function normalizeRequestId(value: unknown) {
  const requestId = typeof value === "string" ? value.trim() : "";
  return /^[a-zA-Z0-9:_-]{8,160}$/.test(requestId) ? requestId : "";
}

function normalizeDurationDays(value: unknown) {
  const days = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(days)) return null;
  return Math.min(365, Math.max(1, Math.floor(days)));
}

function isAdminUser(user: Awaited<ReturnType<typeof fetchSupabaseUserOnServer>>) {
  return user.app_metadata?.role === "admin";
}

function getUserDisplayName(user: SupabaseUser) {
  return user.user_metadata?.name ?? user.user_metadata?.full_name ?? user.user_metadata?.nickname ?? null;
}

async function requireAdmin(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  const requester = await fetchSupabaseUserOnServer(token);
  if (!isAdminUser(requester)) {
    return { error: NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 }) };
  }
  return { requester };
}

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;
    const query = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
    const [authUsers, profiles, subscriptions] = await Promise.all([
      listSupabaseAuthUsers(memberListLimit),
      supabaseAdminRest<AdminProfileRow[]>(`profiles?select=*&limit=${memberListLimit}`),
      supabaseAdminRest<AdminSubscriptionRow[]>(
        "subscriptions?select=user_id,plan,market_scope,status,current_period_end,revoked_at&order=current_period_end.desc&limit=1000"
      )
    ]);
    const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
    const subscriptionsByUser = new Map<string, AdminSubscriptionRow[]>();
    for (const subscription of subscriptions) {
      const rows = subscriptionsByUser.get(subscription.user_id) ?? [];
      rows.push(subscription);
      subscriptionsByUser.set(subscription.user_id, rows);
    }

    const members = authUsers
      .map((user) => {
        const profile = profilesById.get(user.id);
        const effective = resolveEffectiveEntitlement({
          isAuthenticated: true,
          isAdmin: user.app_metadata?.role === "admin",
          subscriptions: subscriptionsByUser.get(user.id) ?? []
        });
        const email = user.email ?? profile?.email ?? null;
        return {
          id: user.id,
          email,
          displayName: profile?.display_name ?? getUserDisplayName(user),
          profilePlan: profile?.plan ?? profile?.membership_tier ?? null,
          createdAt: user.created_at ?? profile?.created_at ?? null,
          updatedAt: profile?.updated_at ?? profile?.created_at ?? user.last_sign_in_at ?? user.created_at ?? null,
          activePlan: effective.state === "active" ? effective.plan : null,
          activeMarketScope: effective.marketAccess.crypto && effective.marketAccess.stocks
            ? "bundle"
            : effective.marketAccess.crypto ? "crypto" : effective.marketAccess.stocks ? "stocks" : null,
          activeStatus: effective.state,
          activeUntil: effective.marketExpiresAt.crypto ?? effective.marketExpiresAt.stocks
        };
      })
      .filter((member) => {
        if (!member.email) return false;
        if (!query) return true;
        return member.email.toLowerCase().includes(query) || member.displayName?.toLowerCase().includes(query);
      })
      .sort((left, right) => Date.parse(right.updatedAt ?? "") - Date.parse(left.updatedAt ?? ""));

    return NextResponse.json({ members });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "회원 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error || !admin.requester) return admin.error;
    const body = (await request.json()) as {
      email?: unknown;
      userId?: unknown;
      planId?: unknown;
      durationDays?: unknown;
      requestId?: unknown;
      reason?: unknown;
    };
    const email = normalizeEmail(body.email);
    const userId = normalizeUserId(body.userId);
    const requestId = normalizeRequestId(body.requestId);
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const durationDays = normalizeDurationDays(body.durationDays);
    const plan = findBillingPlan(typeof body.planId === "string" ? body.planId : "");

    if (!userId && (!email || !email.includes("@"))) {
      return NextResponse.json({ error: "이메일 또는 사용자 ID가 필요합니다." }, { status: 400 });
    }
    if (!requestId || reason.length < 3 || reason.length > 240 || durationDays === null) {
      return NextResponse.json({ error: "requestId, 3~240자 사유, 1~365일 기간이 필요합니다." }, { status: 400 });
    }
    if (!plan || (plan.id !== "free" && !grantablePlanIds.has(plan.id))) {
      return NextResponse.json({ error: "지원하지 않는 수동 권한입니다." }, { status: 400 });
    }

    const authUsers = await listSupabaseAuthUsers(memberListLimit);
    const target = authUsers.find((user) => (userId ? user.id === userId : user.email?.toLowerCase() === email));
    if (!target) return NextResponse.json({ error: "대상 계정을 찾지 못했습니다." }, { status: 404 });

    const observedAt = new Date().toISOString();
    let currentPeriodEnd: string | null = null;
    if (plan.id === "free") {
      await applyBillingEntitlement({
        userId: target.id,
        provider: "manual",
        eventId: requestId,
        observedAtIso: observedAt,
        revoke: true,
        revocationReason: reason,
        actorUserId: admin.requester.id,
        reason,
        metadata: { source: "admin_api" }
      });
    } else {
      const end = new Date(observedAt);
      end.setUTCDate(end.getUTCDate() + durationDays);
      currentPeriodEnd = end.toISOString();
      await applyBillingEntitlement({
        userId: target.id,
        provider: "manual",
        eventId: requestId,
        planId: plan.id,
        currentPeriodStartIso: observedAt,
        currentPeriodEndIso: currentPeriodEnd,
        providerProductId: "manual_admin_grant",
        providerOrderId: `manual:${target.id}:${plan.id}`,
        observedAtIso: observedAt,
        actorUserId: admin.requester.id,
        reason,
        metadata: { source: "admin_api", durationDays }
      });
    }

    return NextResponse.json({
      ok: true,
      email: target.email ?? email ?? null,
      accountLabel: target.email ?? getUserDisplayName(target) ?? target.id,
      userId: target.id,
      planId: plan.id,
      planName: plan.name,
      marketScope: getMarketScopeForPlan(plan.id),
      currentPeriodEnd
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "권한을 변경하지 못했습니다." }, { status: 500 });
  }
}
