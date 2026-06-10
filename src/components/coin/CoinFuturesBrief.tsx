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
      label: "앱 감지 신호 1",
      title: "BTC/ETH 롱·숏 포지션 쏠림",
      detail: "BTC와 ETH의 펀딩비, 미결제약정, 롱·숏 포지션 비율이 한쪽으로 몰리는지 앱이 감지합니다.",
      tone: "risk",
      icon: AlertTriangle
    },
    {
      label: "앱 감지 신호 2",
      title: "BTC/ETH 큰 매수/매도 체결",
      detail: "BTC와 ETH에서 큰 유입·이탈 체결이 반복되는지 봅니다. 반복 체결은 변동성 위험 신호로 먼저 해석합니다.",
      tone: "info",
      icon: Radar
    },
    {
      label: "앱 감지 신호 3",
      title: "BTC/ETH 롱/숏 방향 확인",
      detail: "BTC와 ETH의 차트 구조, ATR, 거래량 상태가 롱 우세 또는 숏 우세 쪽으로 커지는지 봅니다.",
      tone: "watch",
      icon: Gauge
    }
  ],
  alts: [
    {
      label: "앱 감지 신호 1",
      title: "알트 롱·숏 포지션 쏠림",
      detail: "SOL, XRP, DOGE, BNB 같은 알트 선물에서 롱·숏 포지션이 한쪽으로 몰리는지 앱이 감지합니다.",
      tone: "risk",
      icon: AlertTriangle
    },
    {
      label: "앱 감지 신호 2",
      title: "알트 큰 유입·이탈 체결",
      detail: "알트 큰 체결이 한쪽으로 반복되면 방향 판단보다 변동성 위험 증가 여부를 먼저 봅니다.",
      tone: "watch",
      icon: Radar
    },
    {
      label: "앱 감지 신호 3",
      title: "언락·롱/숏 위험",
      detail: "언락 부담과 BTC 변동성이 겹치는지 봅니다. 시장 전체 유동성은 하단 환경 참고로 분리합니다.",
      tone: "info",
      icon: Gauge
    }
  ]
};

export function CoinFuturesBrief({ mode }: { mode: FuturesBriefMode }) {
  const isAltMode = mode === "alts";
  const cautionItems = isAltMode
    ? ["BTC 약세 동반 여부", "알트 단독 과열 여부", "큰 이탈 체결·언락 반복", "유동성 부족 구간"]
    : ["BTC/ETH 롱·숏 쏠림 완화", "큰 유입·이탈 체결 반복", "롱/숏 방향과 변동성 위험 동시 확대"];

  return (
    <PanelCard variant="report" padding="md" className="space-y-4 rounded-ui-lg border border-ui-line/25 bg-ui-panel/45">
      <SectionHeader
        title={isAltMode ? "알트 포지션 위험 결론" : "선물 포지션 위험"}
        description={
          isAltMode
            ? "알트 선물은 방향보다 롱/숏 쏠림, 유동성, 언락 부담을 먼저 봅니다."
            : "오늘 선물은 롱/숏 방향보다 변동성 위험을 먼저 봅니다."
        }
      />

      <article className="rounded-ui-md bg-ui-inset/30 p-3">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">롱/숏 위험 결론</p>
            <p className="mt-1 text-base font-semibold leading-6 text-ui-text [word-break:keep-all]">
              {isAltMode ? "알트 관망 · 롱/숏 위험" : "관망 · 롱/숏 위험"}
            </p>
          </div>
          <StatusPill tone="risk" icon={GitCompareArrows} className="shrink-0">
            관망
          </StatusPill>
        </div>
        <p className="mt-2 text-xs leading-5 text-ui-muted [word-break:keep-all]">
          {isAltMode
            ? "알트 롱·숏 쏠림, 큰 이탈 체결, 언락 부담이 겹치면 방향 판단보다 위험 회피를 우선합니다."
            : "BTC/ETH 롱·숏 쏠림과 큰 체결이 함께 커질 때는 방향 판단보다 위험 회피를 우선합니다."}
        </p>
      </article>

      <section className="pt-1">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">앱이 감지한 핵심 신호</p>
            <p className="mt-1 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">
              {isAltMode ? "알트 선물의 롱/숏 위험 신호만 먼저 봅니다." : "BTC/ETH 선물의 롱/숏 위험 신호만 먼저 봅니다."}
            </p>
          </div>
          <CompactHelp label="판단 기준">
            <div className="space-y-2">
              {briefItems[mode].map((item) => (
                <p key={`criteria-${item.label}`}>
                  <span className="font-semibold text-ui-text">{item.title}</span>: {item.detail}
                </p>
              ))}
            </div>
          </CompactHelp>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {briefItems[mode].map((item) => {
            const Icon = item.icon;

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
                    {item.tone === "risk" ? "관망" : "판단"}
                  </StatusPill>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-ui-muted [word-break:keep-all]">{item.detail}</p>
              </article>
            );
          })}
        </div>
      </section>

      <div className="rounded-ui-md bg-ui-inset/25 p-3">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">전환 기준</p>
            <p className="mt-1 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">관망에서 롱 우세/숏 우세로 바뀌는 조건만 봅니다.</p>
          </div>
          <StatusPill tone="watch" className="shrink-0">
            조건 확인
          </StatusPill>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {cautionItems.map((item, index) => (
            <p key={item} className="rounded-ui-sm bg-ui-panel/35 px-3 py-2 text-xs font-semibold leading-5 text-ui-muted [word-break:keep-all]">
              {item}
            </p>
          ))}
        </div>
      </div>
    </PanelCard>
  );
}
