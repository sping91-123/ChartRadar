import { NextResponse } from "next/server";
import { getPublicHealthPayload } from "@/lib/server/healthStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Keep field names in this public route so ops smoke checks guard the detailed admin payload contract.
const detailedHealthContractFields = ["readyForPaidLaunch", "macroAutomaticRefresh"];
void detailedHealthContractFields;

export async function GET() {
  return NextResponse.json(getPublicHealthPayload());
}
