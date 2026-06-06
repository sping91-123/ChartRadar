import { AlertTriangle, BarChart3, Clock3, Gauge, GitCompareArrows, LockKeyhole, Radar } from "lucide-react";
import { PanelCard, StatusPill } from "@/components/ui/DesignPrimitives";

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
      detail: "방향보다 과열과 강제청산 압력을 먼저 봅니다. 쏠림이 크면 변동성 기준이 우선입니다.",
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
      detail: "눌림 후 추세 유지, 반등 실패, 하방 구조 유지를 분리해 봅니다.",
      tone: "watch",
      icon: Gauge
    },
    {
      label: "4. 충돌 처리",
      title: "롱 신호 + 과열이면 위험 우선",
      detail: "상방 근거와 청산·펀딩 과열이 같이 보이면 진입 판단보다 무효화와 변동성 기준을 먼저 확인합니다.",
      tone: "risk",
      icon: GitCompareArrows
    },
    {
      label: "5. 데이터 확인",
      title: "차트·파생·AI 갱신 시각 분리",
      detail: "캔들, 청산 압력, AI 브리핑은 갱신 주기가 다를 수 있어 같은 방향 신호라도 최신 시각을 먼저 확인합니다.",
      tone: "info",
      icon: Clock3
    },
    {
      label: "6. 상세 판단",
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
      label: "4. 충돌 처리",
      title: "급등 후보 + 저유동성이면 회피 우선",
      detail: "알트는 좋은 후보처럼 보여도 변동성·저유동성·BTC 약세가 겹치면 고위험으로 먼저 분류합니다.",
      tone: "risk",
      icon: GitCompareArrows
    },
    {
      label: "5. 데이터 확인",
      title: "시세·거래대금·BTC 기준 분리",
      detail: "알트 후보의 가격 시각, 거래대금 변화, BTC 방향 기준이 서로 어긋나면 추적 후보로 바로 보지 않습니다.",
      tone: "info",
      icon: Clock3
    },
    {
      label: "6. 상세 판단",
      title: "추적 조건·무효화 기준",
      detail: "Basic은 방향 요약 중심이며, 세부 가격 조건과 리스크는 Pro에서 확인합니다.",
      tone: "long",
      icon: LockKeyhole
    }
  ]
};

export function CoinFuturesBrief({ mode }: { mode: FuturesBriefMode }) {
  const isAltMode = mode === "alts";
  const keySignals = briefItems[mode].slice(0, 3);
  const consoleSummary = isAltMode
    ? "알트는 회피 조건을 먼저 걸러봅니다. BTC 방향, 유동성, 변동성이 동시에 맞을 때만 추적 후보로 올립니다."
    : "메이저 선물은 청산 압력과 파생 쏠림을 먼저 봅니다. 차트 구조는 상단 판단의 검증 근거로 둡니다.";

  return (
    <PanelCard variant="flat" padding="none" className="space-y-4 rounded-ui-lg border border-ui-line/25 bg-ui-panel/60 p-4 sm:p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ui-label font-semibold uppercase tracking-[0.12em] text-ui-subtle">{isAltMode ? "Alt Futures" : "Major Futures"}</p>
          <h2 className="mt-1 text-[1.35rem] font-semibold leading-8 tracking-tight text-ui-text sm:text-2xl">선물 시장 결론</h2>
          <p className="mt-2 max-w-3xl text-ui-body text-ui-muted [word-break:keep-all]">{consoleSummary}</p>
        </div>
        <StatusPill tone="risk" icon={AlertTriangle} className="shrink-0">
          리스크 먼저
        </StatusPill>
      </div>

      <div>
        <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">핵심 신호 3개</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {keySignals.map((item) => {
            const Icon = item.icon;

            return (
              <article key={item.label} className="min-w-0 rounded-ui-sm bg-ui-inset/35 p-3">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{item.label}</p>
                    <p className="mt-1 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{item.title}</p>
                  </div>
                  <StatusPill tone={item.tone} icon={Icon} className="shrink-0">
                    {item.tone === "risk" ? "주의" : item.tone === "long" ? "Pro" : "기준"}
                  </StatusPill>
                </div>
                <p className="mt-2 text-xs leading-5 text-ui-muted [word-break:keep-all]">{item.detail}</p>
              </article>
            );
          })}
        </div>
      </div>
    </PanelCard>
  );
}
