import { JournalApp } from "@/components/JournalApp";

type JournalSearchParams = Promise<{ market?: string | string[] }>;

export default async function JournalPage({ searchParams }: { searchParams: JournalSearchParams }) {
  const { market } = await searchParams;
  const initialMarket = market === "stocks" || market === "global" ? "stocks" : "crypto";
  return <JournalApp initialMarket={initialMarket} />;
}
