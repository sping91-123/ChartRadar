import { BarChart3 } from "lucide-react";
import { PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";

export type CoinSignalPressureTone = "long" | "short" | "watch" | "risk" | "info";

export interface CoinSignalPressureItem {
  label: string;
  title: string;
  detail: string;
  tone: CoinSignalPressureTone;
  percent: number;
  value?: string;
}

type FuturesPressureMode = "major" | "alts";

const barClass: Record<CoinSignalPressureTone, string> = {
  long: "bg-ui-long",
  short: "bg-ui-short",
  watch: "bg-ui-watch",
  risk: "bg-ui-risk",
  info: "bg-ui-brand"
};

const pillLabel: Record<CoinSignalPressureTone, string> = {
  long: "추적",
  short: "압력",
  watch: "확인",
  risk: "위험",
  info: "참고"
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

const futuresPressureItems: Record<FuturesPressureMode, CoinSignalPressureItem[]> = {
  major: [
    {
      label: "파생 쏠림",
      title: "청산·펀딩·롱숏",
      detail: "방향보다 과열과 강제청산 위험을 먼저 분리합니다.",
      tone: "risk",
      percent: 88,
      value: "우선"
    },
    {
      label: "차트 구조",
      title: "MSB·CHoCH·OB·FVG",
      detail: "구조 신호는 상단 판단을 검증하는 보조 근거로만 둡니다.",
      tone: "info",
      percent: 68
    },
    {
      label: "추적 조건",
      title: "눌림 유지·반등 실패",
      detail: "가격이 같은 방향을 유지하는지 확인할 조건만 남깁니다.",
      tone: "watch",
      percent: 56
    },
    {
      label: "충돌",
      title: "상방 근거와 과열 동시 발생",
      detail: "신호가 충돌하면 방향보다 무효화 기준과 변동성부터 봅니다.",
      tone: "risk",
      percent: 74
    }
  ],
  alts: [
    {
      label: "고위험 필터",
      title: "급등·저유동성·언락",
      detail: "좋은 후보를 찾기 전에 회피 후보를 먼저 분리합니다.",
      tone: "risk",
      percent: 86,
      value: "우선"
    },
    {
      label: "유동성",
      title: "거래대금·변동성",
      detail: "알트 단독 움직임보다 실제 거래가 붙었는지 확인합니다.",
      tone: "watch",
      percent: 72
    },
    {
      label: "BTC 기준",
      title: "방향 동조·분리",
      detail: "BTC 약세와 알트 급등이 겹치면 추적 후보로 바로 보지 않습니다.",
      tone: "info",
      percent: 64
    },
    {
      label: "충돌",
      title: "기회 신호와 회피 조건",
      detail: "상승 후보처럼 보여도 위험 신호가 겹치면 관망으로 낮춥니다.",
      tone: "risk",
      percent: 78
    }
  ]
};

export function CoinSignalPressurePanel({
  title,
  description,
  items
}: {
  title: string;
  description: string;
  items: CoinSignalPressureItem[];
}) {
  return (
    <PanelCard variant="report" padding="md" className="space-y-4 border-y border-ui-line">
      <SectionHeader eyebrow="Signal Pressure" title={title} description={description} />
      <div className="grid gap-0 md:grid-cols-2">
        {items.map((item, index) => (
          <article
            key={item.label}
            className={`min-w-0 py-3 md:px-3 ${index > 0 ? "border-t border-ui-line md:border-t-0" : ""} ${
              index % 2 === 1 ? "md:border-l md:border-ui-line" : ""
            } ${index > 1 ? "md:border-t md:border-ui-line" : ""}`}
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{item.label}</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{item.title}</p>
              </div>
              <StatusPill tone={item.tone} icon={BarChart3} className="shrink-0">
                {item.value ?? pillLabel[item.tone]}
              </StatusPill>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-ui-line">
              <span className={`block h-full rounded-full ${barClass[item.tone]}`} style={{ width: `${clampPercent(item.percent)}%` }} aria-hidden />
            </div>
            <p className="mt-2 text-xs leading-5 text-ui-muted [word-break:keep-all]">{item.detail}</p>
          </article>
        ))}
      </div>
    </PanelCard>
  );
}

export function CoinFuturesSignalPressurePanel({ mode }: { mode: FuturesPressureMode }) {
  const isAltMode = mode === "alts";

  return (
    <CoinSignalPressurePanel
      title={isAltMode ? "알트 선물 압력 분해" : "메이저 선물 압력 분해"}
      description={
        isAltMode
          ? "알트 선물은 기회 신호보다 회피 조건, 유동성, BTC 기준 충돌을 먼저 분리합니다."
          : "메이저 선물은 파생 쏠림, 차트 구조, 추적 조건, 충돌 여부를 같은 방향 신호로 섞지 않습니다."
      }
      items={futuresPressureItems[mode]}
    />
  );
}
