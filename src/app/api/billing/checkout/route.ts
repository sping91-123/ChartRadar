// 웹 결제 시작에 필요한 주문 정보를 만들고 결제 연결 상태를 알려준다.
import { NextResponse } from "next/server";
import { findBillingPlan } from "@/lib/billing";

interface CheckoutRequest {
  planId?: string;
  platform?: "web" | "ios" | "android";
}

function makeOrderId(planId: string) {
  const random = Math.random().toString(36).slice(2, 8);
  return `cr_${planId}_${Date.now()}_${random}`;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as CheckoutRequest;
  const plan = findBillingPlan(body.planId);

  if (!plan || plan.id === "free") {
    return NextResponse.json({ error: "결제할 플랜을 다시 선택해 주세요." }, { status: 400 });
  }

  if (body.platform === "ios") {
    return NextResponse.json({
      configured: false,
      mode: "app_store",
      productId: plan.appStoreProductId,
      message: "iOS 앱에서는 App Store 구독 상품으로 연결해야 합니다. App Store Connect에서 상품 ID를 만든 뒤 네이티브 결제 모듈과 연결하세요."
    });
  }

  const orderId = makeOrderId(plan.id);
  const paymentUrl = process.env.NEXT_PUBLIC_PRO_PAYMENT_URL;
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
        message: "결제 URL 형식이 올바르지 않습니다. NEXT_PUBLIC_PRO_PAYMENT_URL 값을 https://로 시작하는 전체 주소로 확인해 주세요."
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
      paymentUrl: url.toString()
    });
  }

  return NextResponse.json({
    configured: false,
    mode: "setup_required",
    orderId,
    amount: plan.billingAmount,
    orderName: plan.name,
    message:
      "현재 결제창을 점검하고 있습니다. 운영 결제 URL이 연결되면 같은 버튼에서 바로 결제 화면으로 이동합니다."
  });
}
