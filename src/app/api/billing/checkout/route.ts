// ??寃곗젣 ?쒖옉???꾩슂??二쇰Ц ?뺣낫瑜?留뚮뱾怨?寃곗젣 ?곌껐 ?곹깭瑜??뚮젮以??
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

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as CheckoutRequest;
  const plan = findBillingPlan(body.planId);

  if (!plan || plan.id === "free") {
    return NextResponse.json({ error: "寃곗젣???뚮옖???ㅼ떆 ?좏깮??二쇱꽭??" }, { status: 400 });
  }

  if (body.platform === "ios") {
    return NextResponse.json({
      configured: false,
      mode: "app_store",
      productId: plan.appStoreProductId,
      message: "iOS ?깆뿉?쒕뒗 App Store 援щ룆 ?곹뭹?쇰줈 ?곌껐?댁빞 ?⑸땲?? App Store Connect?먯꽌 ?곹뭹 ID瑜?留뚮뱺 ???ㅼ씠?곕툕 寃곗젣 紐⑤뱢怨??곌껐?섏꽭??"
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
        message: "寃곗젣 URL ?뺤떇???щ컮瑜댁? ?딆뒿?덈떎. NEXT_PUBLIC_PRO_PAYMENT_URL 媛믪쓣 https://濡??쒖옉?섎뒗 ?꾩껜 二쇱냼濡??뺤씤??二쇱꽭??"
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
      "?꾩옱 寃곗젣李쎌쓣 ?먭??섍퀬 ?덉뒿?덈떎. ?댁쁺 寃곗젣 URL???곌껐?섎㈃ 媛숈? 踰꾪듉?먯꽌 諛붾줈 寃곗젣 ?붾㈃?쇰줈 ?대룞?⑸땲??"
  });
}
