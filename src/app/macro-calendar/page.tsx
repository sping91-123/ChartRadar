import { ArrowLeft } from "lucide-react";
import { MacroTicker } from "@/components/MacroTicker";
import { ActionButton, PanelCard } from "@/components/ui/DesignPrimitives";

export default function MacroCalendarPage({ searchParams }: { searchParams?: { market?: string } }) {
  const market = searchParams?.market === "stocks" || searchParams?.market === "global" ? "stocks" : "crypto";
  const backHref = market === "stocks" ? "/global" : "/coin";

  return (
    <main className="min-h-screen px-3 pb-28 sm:px-5 sm:pb-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:gap-4">
        <div>
          <ActionButton href={backHref} tone="ghost" className="min-h-8 px-0" aria-label="이전 화면으로 이동">
            <ArrowLeft size={14} aria-hidden />
          </ActionButton>
        </div>
        <PanelCard variant="flat" padding="none" className="py-2">
          <MacroTicker market={market} />
        </PanelCard>
      </div>
    </main>
  );
}
