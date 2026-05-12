// 결제 성공 URL을 서버에서 다시 검증한 뒤 Pro 권한을 반영합니다.
import { NextResponse } from "next/server";
import {
  findBillingPlan,
  getMarketScopeForPlan,
  parsePlanIdFromOrderId,
  type BillingPlanId
} from "@/lib/billing";
import {
  fetchSupabaseUserOnServer,
  isSupabaseAdminConfigured,
  supabaseAdminRest
} from "@/lib/server/supabaseAdmin";

interface ConfirmRequest {
  paymentKey?: string;
  orderId?: string;
  amount?: number | string;
  planId?: string;
}

interface TossPaymentConfirmResponse {
  paymentKey?: string;
  orderId?: string;
  totalAmount?: number;
  status?: string;
  approvedAt?: string;
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [type, token] = authorization.split(" ");
  return type?.toLowerCase() === "bearer" ? token : "";
}

function resolvePlanId(body: ConfirmRequest): BillingPlanId | null {
  const directPlan = findBillingPlan(body.planId);
  if (directPlan && directPlan.id !== "free") return directPlan.id;

  const parsedPlan = parsePlanIdFromOrderId(body.orderId);
  if (parsedPlan && parsedPlan !== "free") return parsedPlan;

  return null;
}

function getNumericAmount(value: number | string | undefined) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  return Number(value.replace(/[^0-9]/g, ""));
}

async function confirmTossPayment(body: Required<Pick<ConfirmRequest, "paymentKey" | "orderId">> & { amount: number }) {
  const secretKey = process.env.TOSS_PAYMENTS_SECRET_KEY ?? "";
  if (!secretKey) {
    return {
      configured: false,
      payment: null as TossPaymentConfirmResponse | null
    };
  }

  const response = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      paymentKey: body.paymentKey,
      orderId: body.orderId,
      amount: body.amount
    }),
    cache: "no-store"
  });

  const payload = (await response.json().catch(() => ({}))) as TossPaymentConfirmResponse & {
    message?: string;
  };

  if (!response.ok) {
    throw new Error(payload.message ?? "토스페이먼츠 결제 승인 확인에 실패했습니다.");
  }

  return {
    configured: true,
    payment: payload
  };
}

async function grantEntitlement(params: {
  userId: string;
  planId: BillingPlanId;
  orderId: string;
  providerPaymentId?: string;
}) {
  const marketScope = getMarketScopeForPlan(params.planId);
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + (params.planId.endsWith("_yearly") ? 12 : 1));

  await supabaseAdminRest("profiles", {
    method: "POST",
    prefer: "resolution=merge-duplicates",
    body: {
      id: params.userId,
      plan: params.planId
    }
  });

  const existing = await supabaseAdminRest<Array<{ id: string }>>(
    `subscriptions?select=id&provider_order_id=eq.${encodeURIComponent(params.orderId)}&limit=1`
  );
  const subscriptionBody = {
    user_id: params.userId,
    provider: "toss",
    status: "active",
    plan: params.planId,
    market_scope: marketScope,
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
    provider_subscription_id: params.providerPaymentId ?? null,
    provider_order_id: params.orderId
  };

  if (existing[0]?.id) {
    await supabaseAdminRest(`subscriptions?id=eq.${encodeURIComponent(existing[0].id)}`, {
      method: "PATCH",
      body: subscriptionBody
    });
    return;
  }

  await supabaseAdminRest("subscriptions", {
    method: "POST",
    body: subscriptionBody
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ConfirmRequest;
  const accessToken = getBearerToken(request);
  const planId = resolvePlanId(body);
  const plan = findBillingPlan(planId);
  const amount = getNumericAmount(body.amount);

  if (!plan || plan.id === "free") {
    return NextResponse.json({ status: "rejected", message: "확인할 유료 플랜을 찾지 못했습니다." }, { status: 400 });
  }

  if (!body.orderId || !amount) {
    return NextResponse.json({ status: "rejected", message: "주문번호나 결제 금액이 부족합니다." }, { status: 400 });
  }

  if (amount !== plan.billingAmount) {
    return NextResponse.json({ status: "rejected", message: "선택한 플랜 금액과 결제 금액이 다릅니다." }, { status: 400 });
  }

  if (!accessToken) {
    return NextResponse.json({ status: "login_required", message: "Pro 권한을 반영하려면 로그인 상태가 필요합니다." }, { status: 401 });
  }

  let user: Awaited<ReturnType<typeof fetchSupabaseUserOnServer>>;
  try {
    user = await fetchSupabaseUserOnServer(accessToken);
  } catch {
    return NextResponse.json({ status: "login_required", message: "로그인 정보를 확인하지 못했습니다. 다시 로그인한 뒤 새로고침해 주세요." }, { status: 401 });
  }

  if (!body.paymentKey) {
    return NextResponse.json({
      status: "pending",
      message: "결제 승인 키가 없어 자동 권한 반영을 보류했습니다. 결제사 성공 URL 설정을 확인해 주세요."
    });
  }

  let tossResult: Awaited<ReturnType<typeof confirmTossPayment>>;
  try {
    tossResult = await confirmTossPayment({
      paymentKey: body.paymentKey,
      orderId: body.orderId,
      amount
    });
  } catch (error) {
    return NextResponse.json({
      status: "pending",
      message: error instanceof Error ? error.message : "결제 승인 확인 중 오류가 발생했습니다."
    }, { status: 502 });
  }

  if (!tossResult.configured) {
    return NextResponse.json({
      status: "setup_required",
      planId: plan.id,
      orderId: body.orderId,
      message: "토스페이먼츠 secret key가 아직 설정되지 않아 실제 승인 검증은 보류했습니다."
    });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      status: "setup_required",
      planId: plan.id,
      orderId: body.orderId,
      message: "Supabase service role key가 없어 결제는 확인했지만 권한 반영은 보류했습니다."
    });
  }

  const payment = tossResult.payment;
  if (payment?.totalAmount !== plan.billingAmount || payment.orderId !== body.orderId) {
    return NextResponse.json({ status: "rejected", message: "결제사 응답과 주문 정보가 일치하지 않습니다." }, { status: 400 });
  }

  if (payment.status && payment.status !== "DONE") {
    return NextResponse.json({ status: "pending", message: `결제 상태가 아직 완료가 아닙니다. 현재 상태는 ${payment.status}입니다.` });
  }

  try {
    await grantEntitlement({
      userId: user.id,
      planId: plan.id,
      orderId: body.orderId,
      providerPaymentId: payment.paymentKey ?? body.paymentKey
    });
  } catch {
    return NextResponse.json({
      status: "setup_required",
      planId: plan.id,
      orderId: body.orderId,
      message: "결제는 확인했지만 Pro 권한 반영 중 오류가 발생했습니다. 관리자 확인이 필요합니다."
    }, { status: 500 });
  }

  return NextResponse.json({
    status: "active",
    planId: plan.id,
    orderId: body.orderId,
    message: "결제가 확인되어 Pro 권한이 활성화되었습니다."
  });
}
