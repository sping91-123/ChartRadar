import { NextResponse } from "next/server";
import { reconcileProviderEntitlements } from "@/lib/server/billingEntitlements";
import {
  buildRevenueCatSnapshot,
  extractRevenueCatWebhookUserIds,
  fetchRevenueCatSubscriber
} from "@/lib/server/revenueCatSnapshot";
import { verifyRevenueCatWebhookSignature } from "@/lib/server/revenueCatWebhook";

interface WebhookPayload {
  event?: Record<string, unknown> & { id?: string };
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > 64_000) {
    return NextResponse.json({ error: "Webhook payload is too large." }, { status: 413 });
  }
  const signatureValid = verifyRevenueCatWebhookSignature({
    rawBody,
    signatureHeader: request.headers.get("x-revenuecat-webhook-signature"),
    secret: process.env.REVENUECAT_WEBHOOK_SIGNING_SECRET ?? ""
  });
  if (!signatureValid) return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "Webhook payload is not valid JSON." }, { status: 400 });
  }

  const eventId = payload.event?.id?.trim() ?? "";
  const eventType = typeof payload.event?.type === "string" ? payload.event.type.trim() : "";
  if (!/^[a-zA-Z0-9._:-]{1,180}$/.test(eventId)) {
    return NextResponse.json({ error: "Webhook event identity is invalid." }, { status: 400 });
  }
  // RevenueCat's signed dashboard TEST payload is intentionally synthetic and
  // is not attached to a real subscriber. Accept it only after signature and
  // event-id validation, without touching the entitlement ledger.
  if (eventType === "TEST") {
    return NextResponse.json({ received: true, test: true });
  }

  const userIds = extractRevenueCatWebhookUserIds(payload.event);
  if (userIds.length === 0) {
    return NextResponse.json({ error: "Webhook subscriber identity is invalid." }, { status: 400 });
  }
  const apiKey = process.env.REVENUECAT_REST_API_KEY ?? "";
  if (!apiKey) return NextResponse.json({ error: "RevenueCat server configuration is missing." }, { status: 503 });

  const observedAtMs = Date.now();
  try {
    const reconciliations = [];
    for (let index = 0; index < userIds.length; index += 1) {
      const userId = userIds[index];
      // Transfer source IDs are intentionally processed first. A tiny monotonic
      // offset lets a verified source revocation precede ownership transfer.
      const observedAt = new Date(observedAtMs + index).toISOString();
      const payloadSnapshot = await fetchRevenueCatSubscriber({ appUserId: userId, apiKey });
      const snapshot = buildRevenueCatSnapshot(payloadSnapshot, observedAt);
      const result = await reconcileProviderEntitlements({
        userId,
        provider: "revenuecat",
        eventId: `webhook:${eventId}:${index}`,
        snapshot,
        observedAtIso: observedAt,
        verifiedEmpty: snapshot.length === 0
      });
      reconciliations.push({
        status: result.status,
        active: snapshot.length > 0,
        changed: result.changed
      });
    }

    return NextResponse.json({ received: true, reconciliations });
  } catch {
    // A non-2xx response lets RevenueCat retry. Raw webhook product data is
    // never used to grant or revoke access; every retry fetches a full snapshot.
    return NextResponse.json({ error: "Webhook snapshot reconciliation is pending." }, { status: 503 });
  }
}
