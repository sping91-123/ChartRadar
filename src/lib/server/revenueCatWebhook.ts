import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyRevenueCatWebhookSignature(params: {
  rawBody: string;
  signatureHeader: string | null;
  secret: string;
  nowMs?: number;
  toleranceSeconds?: number;
}) {
  if (!params.signatureHeader || !params.secret) return false;
  const parts = Object.fromEntries(
    params.signatureHeader.split(",").map((part) => {
      const separator = part.indexOf("=");
      return separator > 0 ? [part.slice(0, separator).trim(), part.slice(separator + 1).trim()] : ["", ""];
    })
  );
  const timestamp = parts.t;
  const received = parts.v1;
  if (!/^\d{10,13}$/.test(timestamp ?? "") || !/^[a-f0-9]{64}$/i.test(received ?? "")) return false;
  const timestampSeconds = Number(timestamp);
  const nowSeconds = Math.floor((params.nowMs ?? Date.now()) / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > (params.toleranceSeconds ?? 300)) return false;
  const expected = createHmac("sha256", params.secret)
    .update(`${timestamp}.${params.rawBody}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}
