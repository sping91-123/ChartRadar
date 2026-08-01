import { createHmac, timingSafeEqual } from "node:crypto";

function analyticsSecret() {
  const secret = process.env.PRODUCT_ANALYTICS_HMAC_SECRET?.trim();
  if (!secret) throw new Error("product_analytics_not_configured");
  return secret;
}

export function hashAnonymousProductId(anonymousId: string) {
  return createHmac("sha256", analyticsSecret()).update(`anonymous:${anonymousId}`).digest("hex");
}

export function hashFunnelSessionId(funnelSessionId: string) {
  return createHmac("sha256", analyticsSecret()).update(`funnel:${funnelSessionId}`).digest("hex");
}

export function anonymousProductRateKey(anonymousIdHash: string) {
  return `product-events:anonymous:${anonymousIdHash.slice(0, 24)}`;
}

export function isInternalProductTester(userId: string | null | undefined) {
  if (!userId) return false;
  const ids = new Set(
    (process.env.PRODUCT_ANALYTICS_INTERNAL_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
  return ids.has(userId);
}

export function verifyProductQaSignature(params: {
  header: string | null;
  funnelSessionId: string | null;
  nowMs?: number;
}) {
  const secret = process.env.PRODUCT_ANALYTICS_QA_SECRET?.trim();
  if (!secret || !params.header || !params.funnelSessionId) return false;
  const match = params.header.match(/^t=(\d{10,13}),v1=([0-9a-f]{64})$/i);
  if (!match) return false;
  const timestamp = Number(match[1]);
  const timestampMs = timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
  if (!Number.isFinite(timestampMs) || Math.abs((params.nowMs ?? Date.now()) - timestampMs) > 10 * 60 * 1000) return false;
  const expected = createHmac("sha256", secret)
    .update(`${match[1]}.${params.funnelSessionId}`)
    .digest();
  const received = Buffer.from(match[2], "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
