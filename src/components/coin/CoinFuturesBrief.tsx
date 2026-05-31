import { AlertTriangle, BarChart3, Gauge, LockKeyhole, Radar } from "lucide-react";
import { PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";

type FuturesBriefMode = "major" | "alts";
type BriefTone = "risk" | "watch" | "info" | "long";

const briefItems: Record<
  FuturesBriefMode,
  Array<{
    label: string;
    title: string;
    detail: string;
    tone: BriefTone;
    icon: typeof AlertTriangle;
  }>
> = {
  major: [
    {
      label: "1. 위험 먼저",
      title: "청산 압력·펀딩비·롱숏 쏠림",
      detail: "방향보다 과열과 강제청산 위험을 먼저 봅니다. 쏠림이 크면 추격보다 반대 변동성 확인이 우선입니다.",
      tone: "risk",
      icon: AlertTriangle
    },
    {
      label: "2. 구조 확인",
      title: "MSB·CHoCH·OB·FVG·POC",
      detail: "차트 구조는 진입 지시가 아니라 상단 판단을 검증하는 근거로만 사용합니다.",
      tone: "info",
      icon: BarChart3
    },
    {
      label: "3. 추적 조건",
      title: "눌림 유지 또는 반등 실패",
      detail: "롱 관점은 눌림 후 추세 유지, 숏 관점은 반등 실패와 하방 구조 유지를 확인합니다.",
      tone: "watch",
      icon: Gauge
    },
    {
      label: "4. 상세 판단",
      title: "무효화 기준·세부 리스크",
      detail: "구체 조건, 무효화 기준, AI 브리핑은 Pro 영역에서 전체 맥락으로 확인합니다.",
      tone: "long",
      icon: LockKeyhole
    }
  ],
  alts: [
    {
      label: "1. 고위험 필터",
      title: "급등 추격·저유동성·BTC 의존",
      detail: "알트는 좋은 후보를 찾기 전에 피할 후보를 먼저 걸러야 합니다.",
      tone: "risk",
      icon: AlertTriangle
    },
    {
      label: "2. 후보 분류",
      title: "추적 후보·관망·고위험",
      detail: "알트 기회/위험 필터에서 현재 후보가 어느 묶음인지 먼저 확인합니다.",
      tone: "watch",
      icon: Radar
    },
    {
      label: "3. 구조 확인",
      title: "BTC 방향성·거래량·변동성",
      detail: "알트 단독 신호보다 BTC 방향과 거래량 동반 여부를 함께 봅니다.",
      tone: "info",
      icon: BarChart3
    },
    {
      label: "4. 상세 판단",
      title: "추적 조건·무효화 기준",
      detail: "Basic은 방향 요약 중심이며, 세부 가격 조건과 리스크는 Pro에서 확인합니다.",
      tone: "long",
      icon: LockKeyhole
    }
  ]
};

export function CoinFuturesBrief({ mode }: { mode: FuturesBriefMode }) {
  const isAltMode = mode === "alts";

  return (
    <PanelCard variant="report" padding="md" className="space-y-4 border-y border-ui-line">
      <SectionHeader
        eyebrow={isAltMode ? "Alt Futures" : "Major Futures"}
        title={isAltMode ? "알트 선물 판단 순서" : "메이저 선물 판단 순서"}
        description={
          isAltMode
            ? "알트는 추적 후보보다 회피 후보를 먼저 거르고, BTC 방향성과 변동성을 함께 확인합니다."
            : "BTC/ETH 선물은 방향보다 청산 압력과 파생 쏠림을 먼저 확인한 뒤 차트 구조로 근거를 검증합니다."
        }
      />
      <div className="grid gap-0 md:grid-cols-2">
        {briefItems[mode].map((item, index) => {
          const Icon = item.icon;

          return (
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
                <StatusPill tone={item.tone} icon={Icon} className="shrink-0">
                  {item.tone === "risk" ? "주의" : item.tone === "long" ? "Pro" : "확인"}
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
