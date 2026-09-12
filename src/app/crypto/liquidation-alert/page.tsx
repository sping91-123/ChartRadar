import { Header } from "@/components/Header";
import { LiquidationAlert } from "@/components/coin/LiquidationAlert";
import { isLiquidationAlertKey } from "@/lib/liquidationAlert";

export default async function LiquidationAlertPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const key = Array.isArray(params.event) ? params.event[0] : params.event;
  return <main className="min-h-screen px-3 pb-24 sm:px-5"><div className="mx-auto max-w-3xl space-y-5">
    <Header market="crypto" /><LiquidationAlert eventKey={isLiquidationAlertKey(key) ? key : null} />
  </div></main>;
}
