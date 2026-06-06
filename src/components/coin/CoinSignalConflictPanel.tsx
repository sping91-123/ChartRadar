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
      <div className="grid gap-0 border-y border-ui-line md:grid-cols-2">
        {items.map((item, index) => {
          const Icon = item.icon ?? (item.tone === "risk" ? AlertTriangle : item.tone === "info" ? CheckCircle2 : GitCompareArrows);

          return (
            <article
              key={`${item.label}-${item.title}`}
              className={`min-w-0 py-3 md:px-3 ${index > 0 ? "border-t border-ui-line md:border-t-0" : ""} ${
                index % 2 === 1 ? "md:border-l md:border-ui-line" : ""
              } ${index > 1 ? "md:border-t md:border-ui-line" : ""}`}
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
