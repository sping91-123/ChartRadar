import { NextResponse } from "next/server";
import { fetchSupabaseUserOnServer, isSupabaseAdminConfigured } from "@/lib/server/supabaseAdmin";
import { getDetailedHealthPayload } from "@/lib/server/healthStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? "";
}

function isAdminUser(user: Awaited<ReturnType<typeof fetchSupabaseUserOnServer>>) {
  return user.app_metadata?.role === "admin" || user.app_metadata?.plan === "admin";
}

export async function GET(request: Request) {
  const accessToken = bearerToken(request);
  if (!accessToken) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "Supabase admin is not configured." }, { status: 503 });
  }

  try {
    const user = await fetchSupabaseUserOnServer(accessToken);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: "Admin account required." }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Authentication could not be verified." }, { status: 401 });
  }

  return NextResponse.json(await getDetailedHealthPayload());
}
