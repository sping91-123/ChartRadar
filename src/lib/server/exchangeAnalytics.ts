import {
  calculateExchangeAnalytics,
  type ActiveExchangeProvider,
  type ExchangeAnalyticsPosition
} from "@/lib/exchangeJournal";
import { addDecimal, compareDecimal } from "@/lib/decimal";
import type { ExchangePositionRow } from "@/lib/server/exchangeConnectionStore";

function kstDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function analyticsPosition(row: ExchangePositionRow): ExchangeAnalyticsPosition {
  const review = row.exchange_trade_reviews?.[0];
  return {
    id: row.id,
    provider: row.provider,
    symbol: row.symbol,
    positionSide: row.position_side,
    closedAt: row.closed_at,
    netPnl: row.net_pnl,
    feeTotal: row.fee_total,
    fundingTotal: row.funding_total,
    quality: row.quality,
    strategyTags: review?.strategy_tags ?? [],
    keptPrinciples: review?.kept_principles ?? [],
    brokenPrinciples: review?.broken_principles ?? []
  };
}

function groupAnalytics(
  values: Array<{ key: string; label: string; position: ExchangeAnalyticsPosition }>
) {
  const groups = new Map<string, { label: string; positions: ExchangeAnalyticsPosition[] }>();
  for (const item of values) {
    const existing = groups.get(item.key) ?? { label: item.label, positions: [] };
    existing.positions.push(item.position);
    groups.set(item.key, existing);
  }
  return Array.from(groups.entries())
    .map(([key, group]) => ({
      key,
      label: group.label,
      sampleSize: group.positions.filter((position) => position.quality === "complete").length,
      sampleStatus:
        group.positions.filter((position) => position.quality === "complete").length < 5
          ? "insufficient" as const
          : "ready" as const,
      metrics: calculateExchangeAnalytics(group.positions)
    }))
    .sort((left, right) => right.sampleSize - left.sampleSize || left.label.localeCompare(right.label, "ko"));
}

export function buildExchangeAnalytics(
  rows: ExchangePositionRow[],
  windowDays: 30 | 90,
  includeCrossAnalysis = true
) {
  const positions = rows.map(analyticsPosition);
  const thirtyDayCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent30 = positions.filter((position) => Date.parse(position.closedAt) >= thirtyDayCutoff);
  const daily = new Map<string, { date: string; netPnl: string; trades: number; wins: number; losses: number; breakeven: number }>();
  for (const position of positions.filter((item) => item.quality === "complete")) {
    const date = kstDate(position.closedAt);
    const item = daily.get(date) ?? { date, netPnl: "0", trades: 0, wins: 0, losses: 0, breakeven: 0 };
    item.netPnl = addDecimal(item.netPnl, position.netPnl);
    item.trades += 1;
    const comparison = compareDecimal(position.netPnl, "0");
    if (comparison > 0) item.wins += 1;
    else if (comparison < 0) item.losses += 1;
    else item.breakeven += 1;
    daily.set(date, item);
  }

  const brokenCounts = new Map<string, number>();
  for (const position of positions) {
    for (const principle of position.brokenPrinciples ?? []) {
      brokenCounts.set(principle, (brokenCounts.get(principle) ?? 0) + 1);
    }
  }
  const topBroken = Array.from(brokenCounts.entries()).sort((left, right) => right[1] - left[1])[0];
  const unreviewed = rows.filter((row) => !row.exchange_trade_reviews?.[0]).length;
  const partial = rows.filter((row) => row.quality === "partial").length;
  const nextAction = topBroken
    ? `다음 거래 전 “${topBroken[0]}” 기준을 먼저 확인하세요.`
    : unreviewed > 0
      ? `아직 복기하지 않은 종료 거래 ${unreviewed}건에서 지킨 기준과 깨진 기준을 선택하세요.`
      : partial > 0
        ? `일부 거래 ${partial}건의 체결·수수료 대사가 끝나지 않았습니다. 연결 상태를 확인하세요.`
        : "다음 거래 전 진입 근거와 무효화 기준을 먼저 기록하세요.";

  const providers = positions.map((position) => ({
    key: position.provider,
    label: providerLabel(position.provider),
    position
  }));
  const symbols = positions.map((position) => ({ key: position.symbol, label: position.symbol, position }));
  const sides = positions.map((position) => ({
    key: position.positionSide,
    label: position.positionSide === "long" ? "롱" : "숏",
    position
  }));
  const strategies = positions.flatMap((position) =>
    (position.strategyTags ?? []).map((tag) => ({ key: tag, label: tag, position }))
  );

  return {
    windowDays,
    summary: calculateExchangeAnalytics(positions),
    summary30d: calculateExchangeAnalytics(recent30),
    incompleteTrades: partial,
    unreviewedTrades: unreviewed,
    nextAction,
    calendar: Array.from(daily.values()).sort((left, right) => right.date.localeCompare(left.date)),
    groups: includeCrossAnalysis
      ? {
          providers: groupAnalytics(providers),
          symbols: groupAnalytics(symbols),
          sides: groupAnalytics(sides),
          strategies: groupAnalytics(strategies)
        }
      : null
  };
}

function providerLabel(provider: ActiveExchangeProvider) {
  if (provider === "okx") return "OKX";
  if (provider === "bybit") return "Bybit";
  if (provider === "bitget") return "Bitget";
  return "BingX";
}
