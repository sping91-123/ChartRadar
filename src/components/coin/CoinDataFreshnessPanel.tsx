import type { LucideIcon } from "lucide-react";
import { Clock3 } from "lucide-react";
import { PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";

export type CoinDataFreshnessTone = "long" | "watch" | "info" | "risk" | "short";

export interface CoinDataFreshnessItem {
  label: string;
  title: string;
  detail: string;
  tone: CoinDataFreshnessTone;
  icon?: LucideIcon;
}

const statusLabel: Record<CoinDataFreshnessTone, string> = {
  long: "정상",
  watch: "확인",
  info: "참고",
  risk: "지연",
  short: "지연"
};

function timestampMs(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function formatDataAge(value: number | string | null | undefined) {
  const ms = timestampMs(value);
  if (ms === null) return "시각 확인 중";
  const diff = Math.max(0, Date.now() - ms);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금 갱신";
  if (minutes < 60) return `${minutes}분 전 갱신`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전 갱신`;
  return `${Math.floor(hours / 24)}일 전 갱신`;
}

export function dataFreshnessTone({
  timestamp,
  cached,
  stale,
  warningMs,
  staleMs
}: {
  timestamp: number | string | null | undefined;
  cached?: boolean;
  stale?: boolean;
  warningMs: number;
  staleMs: number;
}): CoinDataFreshnessTone {
  const ms = timestampMs(timestamp);
  if (stale) return "risk";
  if (ms === null) return "watch";
  const age = Math.max(0, Date.now() - ms);
  if (age >= staleMs) return "risk";
  if (cached || age >= warningMs) return "watch";
  return "long";
}

export function CoinDataFreshnessPanel({
  title,
  description,
  items
}: {
  title: string;
  description: string;
  items: CoinDataFreshnessItem[];
}) {
  return (
    <PanelCard variant="report" padding="md" className="space-y-4 rounded-ui-lg border border-ui-line/25 bg-ui-panel/45">
      <SectionHeader eyebrow="Data Check" title={title} description={description} />
      <div className="grid gap-2 md:grid-cols-2">
        {items.map((item) => {
          const Icon = item.icon ?? Clock3;

          return (
            <article
              key={item.label}
              className="min-w-0 rounded-ui-sm bg-ui-inset/30 p-3"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{item.title}</p>
                </div>
                <StatusPill tone={item.tone} icon={Icon} className="shrink-0">
                  {statusLabel[item.tone]}
                </StatusPill>
              </div>
              <p className="mt-2 text-xs leading-5 text-ui-muted [word-break:keep-all]">{item.detail}</p>
            </article>
          );
        })}
      </div>
    </PanelCard>
  );
}
