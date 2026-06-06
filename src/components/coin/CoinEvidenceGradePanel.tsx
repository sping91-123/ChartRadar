import { BadgeCheck, FlaskConical, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";

export type CoinEvidenceGrade = "S" | "A" | "B" | "검증중";
export type CoinEvidenceTone = "long" | "watch" | "info" | "risk";

export interface CoinEvidenceGradeItem {
  grade: CoinEvidenceGrade;
  label: string;
  title: string;
  detail: string;
  tone: CoinEvidenceTone;
  icon?: LucideIcon;
}

type FuturesEvidenceMode = "major" | "alts";

const gradeToneClass: Record<CoinEvidenceGrade, string> = {
  S: "text-ui-long",
  A: "text-ui-brand",
  B: "text-ui-watch",
  검증중: "text-ui-muted"
};

const gradeLabel: Record<CoinEvidenceGrade, string> = {
  S: "S",
  A: "A",
  B: "B",
  검증중: "검증중"
};

const futuresEvidenceItems: Record<FuturesEvidenceMode, CoinEvidenceGradeItem[]> = {
  major: [
    {
      grade: "S",
      label: "핵심 근거",
      title: "청산·펀딩·롱숏",
      detail: "메이저 선물은 파생 쏠림이 커질 때 방향보다 변동성 기준을 먼저 봅니다.",
      tone: "risk",
      icon: ShieldCheck
    },
    {
      grade: "A",
      label: "확인 근거",
      title: "차트 구조와 추세 유지",
      detail: "MSB, CHoCH, OB, FVG는 단독 판단이 아니라 상단 방향의 검증 근거입니다.",
      tone: "info",
      icon: BadgeCheck
    },
    {
      grade: "B",
      label: "보조 근거",
      title: "AI 브리핑과 보조 조건",
      detail: "브리핑은 근거를 압축해 보여주는 보조 레이어이며 실제 데이터 상태와 함께 봅니다.",
      tone: "watch",
      icon: BadgeCheck
    },
    {
      grade: "검증중",
      label: "표본 상태",
      title: "성과 검증은 누적 중",
      detail: "실제 관찰 표본이 충분해질 때까지 확정 적중률처럼 보이는 표현은 쓰지 않습니다.",
      tone: "info",
      icon: FlaskConical
    }
  ],
  alts: [
    {
      grade: "S",
      label: "핵심 근거",
      title: "회피 필터와 유동성",
      detail: "알트 선물은 급등 추격, 저유동성, BTC 약세 충돌을 먼저 걸러냅니다.",
      tone: "risk",
      icon: ShieldCheck
    },
    {
      grade: "A",
      label: "확인 근거",
      title: "거래대금과 변동성",
      detail: "후보가 실제 거래를 동반하는지 확인한 뒤 추적 우선순위를 정합니다.",
      tone: "watch",
      icon: BadgeCheck
    },
    {
      grade: "B",
      label: "보조 근거",
      title: "개별 후보와 브리핑",
      detail: "개별 알트 신호는 BTC 기준, 시장 폭, 데이터 갱신 상태와 함께 낮은 가중치로 봅니다.",
      tone: "info",
      icon: BadgeCheck
    },
    {
      grade: "검증중",
      label: "표본 상태",
      title: "후보별 관찰 표본 누적",
      detail: "후보의 실제 이후 흐름은 충분한 표본이 쌓인 뒤 별도 지표로 분리하는 쪽이 안전합니다.",
      tone: "info",
      icon: FlaskConical
    }
  ]
};

export function CoinEvidenceGradePanel({
  title,
  description,
  items
}: {
  title: string;
  description: string;
  items: CoinEvidenceGradeItem[];
}) {
  return (
    <PanelCard variant="report" padding="md" className="space-y-4 rounded-ui-lg border border-ui-line/25 bg-ui-panel/45">
      <SectionHeader eyebrow="Evidence Grade" title={title} description={description} />
      <div className="grid gap-2 md:grid-cols-2">
        {items.map((item) => {
          const Icon = item.icon ?? BadgeCheck;

          return (
            <article
              key={`${item.grade}-${item.label}`}
              className="min-w-0 rounded-ui-sm bg-ui-inset/30 p-3"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`text-base font-black leading-none ${gradeToneClass[item.grade]}`}>{gradeLabel[item.grade]}</span>
                    <p className="truncate text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{item.label}</p>
                  </div>
                  <p className="mt-1 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{item.title}</p>
                </div>
                <StatusPill tone={item.tone} icon={Icon} className="shrink-0">
                  {item.grade === "검증중" ? "검증" : "근거"}
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

export function CoinFuturesEvidenceGradePanel({ mode }: { mode: FuturesEvidenceMode }) {
  const isAltMode = mode === "alts";

  return (
    <CoinEvidenceGradePanel
      title={isAltMode ? "알트 선물 근거 등급" : "메이저 선물 근거 등급"}
      description={
        isAltMode
          ? "알트 선물 후보를 회피 필터, 유동성 확인, 보조 브리핑, 검증 상태로 나눠 봅니다."
          : "메이저 선물 판단 근거를 파생 쏠림, 차트 구조, 보조 브리핑, 검증 상태로 분리합니다."
      }
      items={futuresEvidenceItems[mode]}
    />
  );
}
