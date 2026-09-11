import { Header } from "@/components/Header";
import { RadarTopNav } from "@/components/RadarTopNav";
import { DecisionWorkspace } from "@/components/coin/DecisionWorkspace";
import { isUuid } from "@/lib/perpetualMonitor";
import { PersonalMonitorAlert } from "@/components/coin/PersonalMonitorBrief";

export default async function TrackingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const review = typeof params.review === "string" && isUuid(params.review) ? params.review : null;
  const monitor = typeof params.monitor === "string" && isUuid(params.monitor) ? params.monitor : null;
  const asset = params.asset === "eth" ? "eth" : "btc";
  return <main className="mx-auto min-h-screen w-full max-w-3xl px-3 pb-28"><Header market="crypto" /><RadarTopNav market="crypto" newsImpactEnabled /><div className="space-y-5 py-5">{monitor ? <PersonalMonitorAlert monitorId={monitor} asset={asset} /> : null}<DecisionWorkspace reviewId={review} /></div></main>;
}
