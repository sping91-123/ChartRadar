import { AlertTriangle, CheckCircle2, GitCompareArrows, type LucideIcon } from "lucide-react";
import { PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";
import { CompactHelp } from "@/components/ui/CompactHelp";

type ConflictTone = "risk" | "watch" | "info" | "long" | "short";

export interface CoinSignalConflictItem {
  label: string;
  title: string;
  detail: string;
  tone: ConflictTone;
  icon?: LucideIcon;
}

function statusText(tone: ConflictTone) {
  if (tone === "risk") return "위험";
  if (tone === "long") return "상승";
  if (tone === "short") return "하락";
  if (tone === "watch") return "확인";
  return "참고";
}

export function CoinSignalConflictPanel({
  title = "신호 충돌",
  description,
  items
}: {
  title?: string;
  description?: string;
  items: CoinSignalConflictItem[];
}) {
  return (
    <PanelCard variant="flat" padding="none" className="space-y-4">
      <SectionHeader title={title} />
      <div className="grid gap-2 md:grid-cols-2">
        {items.map((item) => {
          const Icon = item.icon ?? (item.tone === "risk" ? AlertTriangle : item.tone === "info" ? CheckCircle2 : GitCompareArrows);

          return (
            <article
              key={`${item.label}-${item.title}`}
              className="min-w-0 rounded-ui-sm bg-ui-elevated px-3 py-3"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{item.title}</p>
                </div>
                <StatusPill tone={item.tone} icon={Icon} className="shrink-0">
                  {statusText(item.tone)}
                </StatusPill>
              </div>
              <div className="mt-2">
                <CompactHelp label={description ?? item.label}>{item.detail}</CompactHelp>
              </div>
            </article>
          );
        })}
      </div>
    </PanelCard>
  );
}
