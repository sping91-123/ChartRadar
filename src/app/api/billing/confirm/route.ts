// 결제 성공 URL을 서버에서 다시 검증한 뒤 Pro 권한을 반영합니다.
import { NextResponse } from "next/server";
import {
  findBillingPlan,
  parsePlanIdFromOrderId,
  type BillingPlanId
} from "@/lib/billing";
import {
  fetchSupabaseUserOnServer,
  isSupabaseAdminConfigured
} from "@/lib/server/supabaseAdmin";
import { grantBillingEntitlement } from "@/lib/server/billingEntitlements";
import { isBodyTooLarge, rateLimit } from "@/lib/server/rateLimit";

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
  const parsedPlan = parsePlanIdFromOrderId(body.orderId);
  const directPlan = findBillingPlan(body.planId);

  if (parsedPlan && parsedPlan !== "free") {
    if (directPlan && directPlan.id !== "free" && directPlan.id !== parsedPlan) return null;
    return parsedPlan;
  }

  if (directPlan && directPlan.id !== "free") return directPlan.id;

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

export async function POST(request: Request) {
  const limit = await rateLimit(request, { key: "billing-confirm", limit: 30, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { status: "rate_limited", message: "결제 확인 요청이 잠시 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  if (isBodyTooLarge(request, 8_000)) {
    return NextResponse.json({ status: "rejected", message: "결제 확인 요청 본문이 너무 큽니다." }, { status: 413 });
  }

  const body = (await request.json().catch(() => ({}))) as ConfirmRequest;
  const accessToken = getBearerToken(request);
  const planId = resolvePlanId(body);
  const plan = findBillingPlan(planId);
  const amount = getNumericAmount(body.amount);

  if (!plan || plan.id === "free") {
    return NextResponse.json({ status: "rejected", message: "확인할 유료 플랜을 찾지 못했습니다." }, { status: 400 });
  }

  if (!body.orderId || !amount) {
    return NextResponse.json({ status: "rejected", message: "주문번호와 결제 금액이 부족합니다." }, { status: 400 });
  }

  if (amount !== plan.billingAmount) {
    return NextResponse.json({ status: "rejected", message: "선택한 플랜 금액과 결제 금액이 다릅니다." }, { status: 400 });
  }

  if (!accessToken) {
    return NextResponse.json({ status: "login_required", message: "Pro 권한을 반영하려면 계정 확인이 필요합니다." }, { status: 401 });
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
      message: "결제 내역을 바로 확인하기 어렵습니다. 영수증을 보관한 뒤 잠시 후 다시 확인해 주세요."
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
      message: "결제 확인이 조금 지연되고 있습니다. 잠시 후 다시 확인해 주세요."
    });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      status: "setup_required",
      planId: plan.id,
      orderId: body.orderId,
      message: "결제는 확인됐지만 Pro 기능을 여는 과정이 지연되고 있습니다. 고객센터로 문의해 주세요."
    });
  }

  const payment = tossResult.payment;
  if (payment?.totalAmount !== plan.billingAmount || payment.orderId !== body.orderId) {
    return NextResponse.json({ status: "rejected", message: "결제 응답과 주문 정보가 일치하지 않습니다." }, { status: 400 });
  }

  if (payment.status && payment.status !== "DONE") {
    return NextResponse.json({ status: "pending", message: `결제 상태가 아직 완료가 아닙니다. 현재 상태는 ${payment.status}입니다.` });
  }

  try {
    await grantBillingEntitlement({
      userId: user.id,
      planId: plan.id,
      provider: "toss",
      providerOrderId: body.orderId,
      providerPaymentId: payment.paymentKey ?? body.paymentKey
    });
  } catch {
    return NextResponse.json({
      status: "setup_required",
      planId: plan.id,
      orderId: body.orderId,
      message: "결제는 확인됐지만 Pro 기능을 여는 과정에서 문제가 발생했습니다. 고객센터로 문의해 주세요."
    }, { status: 500 });
  }

  return NextResponse.json({
    status: "active",
    planId: plan.id,
    orderId: body.orderId,
    message: "결제가 확인되어 Pro 기능이 열렸습니다."
  });
}
