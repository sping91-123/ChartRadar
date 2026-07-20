import { createHmac } from "node:crypto";

export function hashAnonymousProductId(anonymousId: string) {
  const secret = process.env.PRODUCT_ANALYTICS_HMAC_SECRET?.trim();
  if (!secret) throw new Error("product_analytics_not_configured");
  return createHmac("sha256", secret).update(anonymousId).digest("hex");
}

export function anonymousProductRateKey(anonymousIdHash: string) {
  return `product-events:anonymous:${anonymousIdHash.slice(0, 24)}`;
}
