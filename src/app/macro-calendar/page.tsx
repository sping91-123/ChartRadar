import { redirect } from "next/navigation";

export default async function MacroCalendarPage({ searchParams }: { searchParams: Promise<{ market?: string | string[] }> }) {
  const { market } = await searchParams;
  const marketValue = Array.isArray(market) ? market[0] : market;
  const query = marketValue ? `?market=${encodeURIComponent(marketValue)}` : "";
  redirect(`/schedule${query}`);
}
