import { AlertTriangle, BarChart3, Gauge, GitCompareArrows, Radar } from "lucide-react";
import { PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";
import { CompactHelp } from "@/components/ui/CompactHelp";

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
      title: "청산 압력·펀딩비·포지션 쏠림",
      detail: "방향보다 과열과 강제청산 위험을 먼저 봅니다. 쏠림이 크면 따라가기보다 반대로 크게 흔들릴 가능성을 먼저 봅니다.",
      tone: "risk",
      icon: AlertTriangle
    },
    {
      label: "2. 구조 확인",
      title: "MSB·CHoCH·OB·FVG·POC",
      detail: "차트 구조는 진입 지시가 아니라 상단 판단을 확인하는 보조값으로만 사용합니다.",
      tone: "info",
      icon: BarChart3
    },
    {
      label: "3. 볼 조건",
      title: "가격 조정 후 재상승 또는 반등 실패",
      detail: "상승 쪽은 잠깐 밀린 뒤 다시 오르는지, 하락 쪽은 반등이 오래 버티는지 봅니다.",
      tone: "watch",
      icon: Gauge
    },
    {
      label: "4. 충돌 처리",
      title: "상승 신호 + 과열이면 위험 우선",
      detail: "상승 신호와 청산·펀딩 과열이 같이 보이면 진입 판단보다 기준 이탈과 가격 흔들림을 먼저 확인합니다.",
      tone: "risk",
      icon: GitCompareArrows
    }
  ],
  alts: [
    {
      label: "1. 고위험 필터",
      title: "급등 따라가기·낮은 거래대금·BTC 의존",
      detail: "알트는 좋은 후보를 찾기 전에 피할 후보를 먼저 걸러야 합니다.",
      tone: "risk",
      icon: AlertTriangle
    },
    {
      label: "2. 후보 분류",
      title: "추적 후보·관망·고위험 제외",
      detail: "고위험 알트는 목록에서 빼고, 남은 후보가 추적 후보인지 관망인지 먼저 확인합니다.",
      tone: "watch",
      icon: Radar
    },
    {
      label: "3. 구조 확인",
      title: "BTC 방향·거래량·가격 흔들림",
      detail: "알트 단독 신호보다 BTC 방향과 거래량 동반 여부를 함께 봅니다.",
      tone: "info",
      icon: BarChart3
    },
    {
      label: "4. 충돌 처리",
      title: "급등 후보 + 저유동성이면 회피 우선",
      detail: "알트는 좋아 보여도 가격 흔들림·낮은 거래대금·BTC 약세가 겹치면 고위험으로 먼저 분류합니다.",
      tone: "risk",
      icon: GitCompareArrows
    }
  ]
};

export function CoinFuturesBrief({ mode }: { mode: FuturesBriefMode }) {
  const isAltMode = mode === "alts";

  return (
    <PanelCard variant="report" padding="md" className="space-y-4 border-y border-ui-line">
      <SectionHeader title={isAltMode ? "알트 선물 판단 순서" : "메이저 선물 판단 순서"} />
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
              <div className="mt-2">
                <CompactHelp label={item.label}>{item.detail}</CompactHelp>
              </div>
            </article>
          );
        })}
      </div>
    </PanelCard>
  );
}
