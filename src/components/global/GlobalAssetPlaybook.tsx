import { Clock3, Compass, Shield, Target } from "lucide-react";
import type { Candle } from "@/lib/marketAnalysis";
import type { StockSymbolInfo } from "@/lib/stockMarket";
import type { TechnicalRadarReport } from "@/lib/technicalRadar";
import { directionTone, formatPercent, formatPrice, getGlobalSessionState, groupChecklist, groupPlaybook } from "@/components/global/stockRadarDisplay";

export function GlobalAssetChecklist({ selectedInfo }: { selectedInfo: StockSymbolInfo | null }) {
  const checklist = groupChecklist(selectedInfo?.group);
  const items = [
    { icon: Compass, title: "동반 체크", body: checklist.compare },
    { icon: Shield, title: "위험 체크", body: checklist.risk },
    { icon: Target, title: "판단 순서", body: checklist.action }
  ];

  return (
    <div className="mt-3 grid divide-y divide-ui-line/60 md:grid-cols-3 md:divide-x md:divide-y-0">
      {items.map(({ icon: Icon, title, body }) => (
        <article key={title} className="px-3 py-3">
          <div className="flex items-center gap-2">
            <Icon className="text-ui-brand" size={15} aria-hidden />
            <p className="text-xs font-semibold text-ui-text">{title}</p>
          </div>
          <p className="mt-2 text-[11px] font-medium leading-5 text-ui-muted [word-break:keep-all]">{body}</p>
        </article>
      ))}
    </div>
  );
}

export function GlobalPlaybook({
  report,
  latest,
  changePercent,
  selectedInfo,
  sessionState
}: {
  report: TechnicalRadarReport | null;
  latest: Candle | null;
  changePercent: number | null;
  selectedInfo: StockSymbolInfo | null;
  sessionState: ReturnType<typeof getGlobalSessionState> | null;
}) {
  const supportDistance = report?.supportResistance.supportDistancePercent ?? null;
  const resistanceDistance = report?.supportResistance.resistanceDistancePercent ?? null;
  const tone = directionTone(report);
  const riskScore = report ? Math.min(100, Math.max(0, report.fearGreed.score + Math.max(0, report.bearishCount - report.bullishCount) * 6)) : null;
  const focus =
    tone === "bullish"
      ? "상승 추세 유지 여부"
      : tone === "bearish"
        ? "하락 압력 방어 여부"
        : "방향 확정 전 기준선 반응";
  const basis =
    resistanceDistance !== null && resistanceDistance <= 1.2
      ? "저항선이 가깝습니다. 돌파 후 안착하지 못하면 단기 되돌림을 먼저 의심하세요."
      : supportDistance !== null && supportDistance <= 1.2
        ? "지지선이 가깝습니다. 지지 반응과 거래량 회복이 같이 나오는지 보세요."
        : "지지와 저항 사이 중간 구간입니다. 추격보다 다음 기준선까지의 여유를 먼저 확인하세요.";

  return (
    <div className="mt-5 grid gap-3 lg:grid-cols-4">
      <article className="rounded-ui-lg bg-ui-panel p-3">
        <Clock3 size={20} aria-hidden />
        <p className="mt-3 text-xs font-semibold text-ui-subtle">미국장 구간</p>
        <h3 className="mt-2 text-base font-semibold text-ui-text">{sessionState?.title ?? "미국장 시간 확인 중"}</h3>
        <p className="mt-2 text-xs leading-5 text-ui-muted">{sessionState?.detail ?? "현재 한국 시간 기준 미국장 구간을 확인하고 있습니다."}</p>
      </article>

      <article className="rounded-ui-lg bg-ui-panel p-3">
        <Compass size={20} aria-hidden />
        <p className="mt-3 text-xs font-semibold text-ui-subtle">먼저 볼 것</p>
        <h3 className="mt-2 text-base font-semibold text-ui-text">{focus}</h3>
        <p className="mt-2 text-xs leading-5 text-ui-muted">
          {selectedInfo?.symbol ?? "선택 자산"} {latest ? formatPrice(latest.close) : "가격 확인 중"} · {formatPercent(changePercent)}
        </p>
      </article>

      <article className="rounded-ui-lg bg-ui-panel p-3">
        <Target className="text-ui-brand" size={20} aria-hidden />
        <p className="mt-3 text-xs font-semibold text-ui-subtle">기준선</p>
        <h3 className="mt-2 text-base font-semibold text-ui-text">기준선 행동</h3>
        <p className="mt-2 text-xs leading-5 text-ui-muted">{basis}</p>
      </article>

      <article className="rounded-ui-lg bg-ui-panel p-3">
        <Shield className="text-ui-brand" size={20} aria-hidden />
        <p className="mt-3 text-xs font-semibold text-ui-subtle">위험 메모</p>
        <h3 className="mt-2 text-base font-semibold text-ui-text">위험도 {riskScore === null ? "확인 중" : `${Math.round(riskScore)}%`}</h3>
        <p className="mt-2 text-xs leading-5 text-ui-muted">{groupPlaybook(selectedInfo?.group)}</p>
      </article>
    </div>
  );
}
