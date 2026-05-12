// 서비스 운영 상태와 주요 설정 신선도를 확인하는 헬스체크 API입니다.
import { NextResponse } from "next/server";
import { macroCalendarUpdatedAtIso } from "@/data/macroEvents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const macroStaleAfterHours = 72;

function hasValue(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function hoursSince(iso: string) {
  const updatedAt = Date.parse(iso);
  if (!Number.isFinite(updatedAt)) return null;
  return Math.max(0, Math.round(((Date.now() - updatedAt) / (60 * 60 * 1000)) * 10) / 10);
}

export async function GET() {
  const macroAgeHours = hoursSince(macroCalendarUpdatedAtIso);
  const hasGroq = hasValue(process.env.GROQ_API_KEY);
  const hasGemini = hasValue(process.env.GEMINI_API_KEY);
  const hasTossSecret = hasValue(process.env.TOSS_PAYMENTS_SECRET_KEY);
  const hasTossClient = hasValue(process.env.NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY);
  const hasSupabaseUrl = hasValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasSupabaseKey = hasValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  return NextResponse.json({
    ok: true,
    service: "chart-radar",
    checkedAt: new Date().toISOString(),
    runtime: "nextjs",
    checks: {
      supabasePublic: hasSupabaseUrl && hasSupabaseKey,
      siteUrl: hasValue(process.env.NEXT_PUBLIC_SITE_URL),
      aiProvider: hasGroq ? "groq" : hasGemini ? "gemini" : "not-configured",
      paymentProvider: hasTossSecret && hasTossClient ? "toss-payments" : "not-configured"
    },
    macroCalendar: {
      updatedAtIso: macroCalendarUpdatedAtIso,
      ageHours: macroAgeHours,
      stale: macroAgeHours === null ? true : macroAgeHours > macroStaleAfterHours,
      staleAfterHours: macroStaleAfterHours
    }
  });
}
