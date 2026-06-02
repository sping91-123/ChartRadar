import { AlertTriangle, Gauge, GitCompareArrows, Radar } from "lucide-react";
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
      label: "핵심 확인 1",
      title: "포지션 쏠림",
      detail: "펀딩비, 미결제약정, 상방·하방 포지션 비율이 한쪽으로 몰리는지 먼저 확인합니다.",
      tone: "risk",
      icon: AlertTriangle
    },
    {
      label: "핵심 확인 2",
      title: "큰 체결 흐름",
      detail: "큰 유입·이탈 체결이 반복되는지 확인합니다. 반복 체결은 방향 신호보다 변동성 리스크로 먼저 봅니다.",
      tone: "info",
      icon: Radar
    },
    {
      label: "핵심 확인 3",
      title: "변동성·유동성 압력",
      detail: "옵션 예상 변동, 스테이블코인 유동성, BTC 온체인 혼잡이 동시에 커지는지 확인합니다.",
      tone: "watch",
      icon: Gauge
    }
  ],
  alts: [
    {
      label: "핵심 확인 1",
      title: "알트 포지션 쏠림",
      detail: "SOL, XRP, DOGE, BNB 같은 알트 선물에서 상방·하방 포지션이 한쪽으로 몰리는지 먼저 확인합니다.",
      tone: "risk",
      icon: AlertTriangle
    },
    {
      label: "핵심 확인 2",
      title: "큰 유입·이탈 체결",
      detail: "큰 체결이 한쪽으로 반복되면 후보 신호보다 변동성 확대 여부를 먼저 확인합니다.",
      tone: "watch",
      icon: Radar
    },
    {
      label: "핵심 확인 3",
      title: "유동성·언락·변동성 압력",
      detail: "스테이블코인 유동성, 언락 부담, BTC 변동성이 겹치는지 확인합니다.",
      tone: "info",
      icon: Gauge
    }
  ]
};

export function CoinFuturesBrief({ mode }: { mode: FuturesBriefMode }) {
  const isAltMode = mode === "alts";
  const cautionItems = isAltMode
    ? ["BTC 약세와 같이 밀리는지 확인", "알트만 과열되는지 확인", "큰 이탈 체결이 반복되는지 확인", "언락·유동성 부담이 있는지 확인"]
    : ["포지션 쏠림이 풀리는지 확인", "BTC 추세와 반대로 과열되는지 확인", "큰 유입·이탈 체결이 반복되는지 확인"];

  return (
    <PanelCard variant="report" padding="md" className="space-y-4 border-y border-ui-line">
      <SectionHeader
        title={isAltMode ? "알트 선물 리스크 결론" : "선물 시장 결론"}
        description={
          isAltMode
            ? "알트 선물은 추적 후보보다 쏠림, 유동성, 언락 리스크를 먼저 확인합니다."
            : "오늘 선물은 방향보다 쏠림과 변동성 리스크를 먼저 확인합니다."
        }
      />

      <article className="border-t border-ui-line py-3">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">선물 리스크 결론</p>
            <p className="mt-1 text-base font-semibold leading-6 text-ui-text [word-break:keep-all]">
              {isAltMode ? "알트 변동성 주의 · 리스크 우선" : "리스크 우선 · 확인 대기"}
            </p>
          </div>
          <StatusPill tone="risk" icon={GitCompareArrows} className="shrink-0">
            리스크
          </StatusPill>
        </div>
        <p className="mt-2 text-xs leading-5 text-ui-muted [word-break:keep-all]">
          {isAltMode
            ? "BTC 약세, 낮은 유동성, 큰 이탈 체결, 언락 부담이 겹치면 추적 후보를 제한하고 세부 근거를 다시 확인합니다."
            : "포지션 쏠림과 큰 체결이 함께 커질 때는 추적보다 변동성 확대 여부를 먼저 봅니다."}
        </p>
      </article>

      <div className="grid gap-0 md:grid-cols-3">
        {briefItems[mode].map((item, index) => {
          const Icon = item.icon;

          return (
            <article
              key={item.label}
              className={`min-w-0 py-3 md:px-3 ${index > 0 ? "border-t border-ui-line md:border-l md:border-t-0" : ""}`}
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{item.title}</p>
                </div>
                <StatusPill tone={item.tone} icon={Icon} className="shrink-0">
                  {item.tone === "risk" ? "주의" : "확인"}
                </StatusPill>
              </div>
              <div className="mt-2">
                <CompactHelp label={item.label}>{item.detail}</CompactHelp>
              </div>
            </article>
          );
        })}
      </div>

      <div className="border-t border-ui-line pt-3">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">조심할 것</p>
            <p className="mt-1 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">상단 결론이 바뀌는 조건을 먼저 확인합니다.</p>
          </div>
          <StatusPill tone="watch" className="shrink-0">
            확인 필요
          </StatusPill>
        </div>
        <div className="mt-3 grid gap-0 md:grid-cols-3">
          {cautionItems.map((item, index) => (
            <p key={item} className={`py-2 text-xs font-semibold leading-5 text-ui-muted [word-break:keep-all] md:px-3 ${index > 0 ? "border-t border-ui-line md:border-l md:border-t-0" : ""}`}>
              {item}
            </p>
          ))}
        </div>
      </div>
    </PanelCard>
  );
}
