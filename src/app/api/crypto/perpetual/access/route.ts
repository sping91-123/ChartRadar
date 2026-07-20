import { NextResponse } from "next/server";
import { isPerpetualRevenueCoreUserEnabled } from "@/lib/server/perpetualRevenueCore";
import { getRequestEntitlement } from "@/lib/server/requestEntitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const entitlement = await getRequestEntitlement(request, "crypto");
  const response = NextResponse.json({
    enabled:
      Boolean(entitlement.userId) &&
      entitlement.isAuthenticated &&
      !entitlement.isAdmin &&
      entitlement.state !== "deletion_pending" &&
      entitlement.state !== "unavailable" &&
      isPerpetualRevenueCoreUserEnabled(entitlement.userId)
  });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Authorization");
  return response;
}
