// 결제 시작에 필요한 주문 정보를 만들고 결제 링크 상태를 반환합니다.
import { NextResponse } from "next/server";
import { findBillingPlan } from "@/lib/billing";
import { fetchSupabaseUserOnServer } from "@/lib/server/supabaseAdmin";

interface CheckoutRequest {
  planId?: string;
  platform?: "web" | "ios" | "android";
}

function makeOrderId(planId: string) {
  const random = Math.random().toString(36).slice(2, 8);
  return `cr_${planId}_${Date.now()}_${random}`;
}

function getPaymentUrl(planId: string) {
  const paymentUrlByPlan: Record<string, string | undefined> = {
    crypto_monthly: process.env.NEXT_PUBLIC_CRYPTO_MONTHLY_PAYMENT_URL,
    crypto_yearly: process.env.NEXT_PUBLIC_CRYPTO_YEARLY_PAYMENT_URL,
    stocks_monthly: process.env.NEXT_PUBLIC_GLOBAL_MONTHLY_PAYMENT_URL ?? process.env.NEXT_PUBLIC_STOCKS_MONTHLY_PAYMENT_URL,
    stocks_yearly: process.env.NEXT_PUBLIC_GLOBAL_YEARLY_PAYMENT_URL ?? process.env.NEXT_PUBLIC_STOCKS_YEARLY_PAYMENT_URL,
    bundle_monthly: process.env.NEXT_PUBLIC_BUNDLE_MONTHLY_PAYMENT_URL,
    bundle_yearly: process.env.NEXT_PUBLIC_BUNDLE_YEARLY_PAYMENT_URL
  };

  return (
    paymentUrlByPlan[planId] ??
    (planId.endsWith("_yearly")
      ? process.env.NEXT_PUBLIC_PRO_YEARLY_PAYMENT_URL
      : process.env.NEXT_PUBLIC_PRO_MONTHLY_PAYMENT_URL) ??
    process.env.NEXT_PUBLIC_PRO_PAYMENT_URL
  );
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [type, token] = authorization.split(" ");
  return type?.toLowerCase() === "bearer" ? token : "";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as CheckoutRequest;
  const plan = findBillingPlan(body.planId);

  if (!plan || plan.id === "free") {
    return NextResponse.json({ error: "결제할 플랜을 다시 선택해 주세요." }, { status: 400 });
  }

  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return NextResponse.json({ error: "결제를 시작하려면 먼저 로그인해 주세요." }, { status: 401 });
  }

  try {
    await fetchSupabaseUserOnServer(accessToken);
  } catch {
    return NextResponse.json({ error: "로그인 상태를 확인하지 못했습니다. 다시 로그인한 뒤 결제를 시작해 주세요." }, { status: 401 });
  }

  if (body.platform === "ios") {
    return NextResponse.json({
      configured: false,
      mode: "app_store",
      productId: plan.appStoreProductId,
      confirmationRequired: true,
      message:
        "iOS 앱에서는 App Store 구독 상품으로 결제해야 합니다. App Store Connect에서 상품 ID를 만든 뒤 앱 결제 모듈과 연결해 주세요."
    });
  }

  const orderId = makeOrderId(plan.id);
  const paymentUrl = getPaymentUrl(plan.id);
  if (paymentUrl) {
    let url: URL;
    try {
      url = new URL(paymentUrl);
    } catch {
      return NextResponse.json({
        configured: false,
        mode: "invalid_payment_url",
        orderId,
        amount: plan.billingAmount,
        orderName: plan.name,
        confirmationRequired: true,
        message: "결제 URL 형식이 올바르지 않습니다. 결제 링크 환경변수가 https://로 시작하는 전체 주소인지 확인해 주세요."
      });
    }

    url.searchParams.set("plan", plan.id);
    url.searchParams.set("orderId", orderId);
    url.searchParams.set("amount", String(plan.billingAmount));

    return NextResponse.json({
      configured: true,
      mode: "payment_link",
      orderId,
      amount: plan.billingAmount,
      orderName: plan.name,
      paymentUrl: url.toString(),
      confirmationRequired: true
    });
  }

  return NextResponse.json({
    configured: false,
    mode: "setup_required",
    orderId,
    amount: plan.billingAmount,
    orderName: plan.name,
    confirmationRequired: true,
    message:
      "결제창 연결 상태를 확인하고 있습니다. 잠시 후 다시 시도해 주세요."
  });
}
