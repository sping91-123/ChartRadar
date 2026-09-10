import { Header } from "@/components/Header";
import { RapidMoveAlert } from "@/components/coin/RapidMoveAlert";
import { isRapidMoveEventKey } from "@/lib/rapidPriceMove";

export default async function PriceAlertPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const eventKey = Array.isArray(params.event) ? params.event[0] : params.event;
  return <main className="min-h-screen px-3 pb-24 sm:px-5"><div className="mx-auto max-w-3xl space-y-5"><Header market="crypto" /><RapidMoveAlert eventKey={isRapidMoveEventKey(eventKey) ? eventKey : null} /></div></main>;
}
